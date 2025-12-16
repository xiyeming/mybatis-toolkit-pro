import * as vscode from 'vscode';
import { JavaInterface, JavaClass, MapperXml, StatementInfo, ResultMapInfo } from '../types';
import { JavaAstUtils } from '../utils/JavaAstUtils';

export class ProjectIndexer {
    private static instance: ProjectIndexer;
    private outputChannel: vscode.OutputChannel;

    // 缓存: 全类名 -> JavaInterface (Mappers)
    private javaMap = new Map<string, JavaInterface>();
    // 缓存: 全类名 -> JavaClass (DTOs/Entities)
    private dtoMap = new Map<string, JavaClass>();
    // 缓存: Namespace -> MapperXml
    private xmlMap = new Map<string, MapperXml>();

    private _onDidUpdateIndex = new vscode.EventEmitter<void>();
    public readonly onDidUpdateIndex = this._onDidUpdateIndex.event;

    private constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
    }

    public static getInstance(outputChannel?: vscode.OutputChannel): ProjectIndexer {
        if (!ProjectIndexer.instance && outputChannel) {
            ProjectIndexer.instance = new ProjectIndexer(outputChannel);
        }
        return ProjectIndexer.instance;
    }

    public async init() {
        this.outputChannel.appendLine('[索引器] 开始全项目扫描...');
        const start = Date.now();

        const config = vscode.workspace.getConfiguration('mybatisToolkit');
        // 同步更新默认排除列表，确保初始扫描时生效
        const excludes = config.get<string[]>('navigation.exclude',
            ['target', 'build', 'bin', 'out', 'dist', 'node_modules', '.git']);
        const excludePattern = `**/{${excludes.join(',')}}/**`;

        const javaFiles = await vscode.workspace.findFiles('**/*.java', excludePattern);
        await Promise.all(javaFiles.map(file => this.parseJavaFile(file)));

        const xmlFiles = await vscode.workspace.findFiles('**/*.xml', excludePattern);
        await Promise.all(xmlFiles.map(file => this.parseXmlFile(file)));

        this.outputChannel.appendLine(`[索引器] 扫描完成，耗时 ${Date.now() - start}ms。Mappers: ${this.javaMap.size}, DTOs: ${this.dtoMap.size}, XML: ${this.xmlMap.size}`);
        this._onDidUpdateIndex.fire();

        const watcher = vscode.workspace.createFileSystemWatcher('**/*.{java,xml}');
        watcher.onDidChange(async uri => await this.handleFileChange(uri));
        watcher.onDidCreate(async uri => await this.handleFileChange(uri));
        watcher.onDidDelete(async uri => this.handleFileDelete(uri));
    }

    /**
     * 检查文件路径是否应该被排除
     */
    private shouldExclude(uri: vscode.Uri): boolean {
        const config = vscode.workspace.getConfiguration('mybatisToolkit');
        const excludes = config.get<string[]>('navigation.exclude',
            ['target', 'build', 'bin', 'out', 'dist', 'node_modules', '.git']);

        const fsPath = JavaAstUtils.normalizePath(uri.fsPath);
        // 检查路径中是否包含排除的目录
        return excludes.some(pattern => {
            const normalized = pattern.toLowerCase();
            return fsPath.includes(`/${normalized}/`) || fsPath.includes(`\\${normalized}\\`);
        });
    }

    private async handleFileChange(uri: vscode.Uri) {
        // 检查文件是否在排除目录中
        if (this.shouldExclude(uri)) {
            this.outputChannel.appendLine(`[索引器] 跳过排除的文件: ${uri.fsPath}`);
            return;
        }

        if (uri.fsPath.endsWith('.java')) {
            await this.parseJavaFile(uri);
        } else if (uri.fsPath.endsWith('.xml')) {
            await this.parseXmlFile(uri);
        }
        this._onDidUpdateIndex.fire();
    }

    private handleFileDelete(uri: vscode.Uri) {
        const normPath = JavaAstUtils.normalizePath(uri.fsPath);
        // 清除所有映射
        [this.javaMap, this.dtoMap].forEach(map => {
            for (const [key, val] of map) {
                if (JavaAstUtils.normalizePath(val.fileUri.fsPath) === normPath) map.delete(key);
            }
        });
        for (const [key, val] of this.xmlMap) {
            if (JavaAstUtils.normalizePath(val.fileUri.fsPath) === normPath) this.xmlMap.delete(key);
        }
        this._onDidUpdateIndex.fire();
    }

    private async parseJavaFile(uri: vscode.Uri) {
        try {
            const doc = await vscode.workspace.openTextDocument(uri);
            const content = doc.getText();

            const simpleName = JavaAstUtils.getSimpleName(content);
            if (!simpleName) return;

            const packageName = JavaAstUtils.getPackageName(content);
            const fullName = packageName ? `${packageName}.${simpleName}` : simpleName;

            const isInterface = /public\s+interface/.test(content);

            if (isInterface) {
                const methods = JavaAstUtils.getMethods(content);
                const imports = JavaAstUtils.getImports(content);
                const javaInterface: JavaInterface = {
                    name: simpleName,
                    fullName: fullName,
                    fileUri: uri,
                    methods: methods,
                    imports: imports
                };
                this.javaMap.set(fullName, javaInterface);
            } else {
                // 这是一个类 (DTO, Entity)
                const fields = JavaAstUtils.getFields(content);
                const imports = JavaAstUtils.getImports(content); // 也捕获类的导入
                const parentClassName = JavaAstUtils.getParentClassName(content); // 捕获父类

                const javaClass: JavaClass = {
                    name: simpleName,
                    fullName: fullName,
                    fileUri: uri,
                    fields: fields,
                    parentClassName: parentClassName || undefined,
                    imports: imports
                };
                this.dtoMap.set(fullName, javaClass);
            }

        } catch (e) {
            this.outputChannel.appendLine(`[错误] 解析 Java 文件 ${uri.fsPath} 失败: ${e}`);
        }
    }

    private async parseXmlFile(uri: vscode.Uri) {
        try {
            const doc = await vscode.workspace.openTextDocument(uri);
            const content = doc.getText();

            const namespaceMatch = content.match(/<mapper\s+namespace="([^"]+)"/);
            if (!namespaceMatch) return;

            const namespace = namespaceMatch[1];
            const lines = content.split('\n');
            const statements = new Map<string, StatementInfo>();
            const resultMaps = new Map<string, ResultMapInfo>();

            const stmtRegex = /<(select|insert|update|delete)\s+id="([^"]+)"(?:[^>]*resultMap="([^"]+)")?/;
            const resultMapRegex = /<resultMap\s+id="([^"]+)"\s+type="([^"]+)"/;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                // 解析 Statements
                const stmtMatch = line.match(stmtRegex);
                if (stmtMatch) {
                    statements.set(stmtMatch[2], {
                        id: stmtMatch[2],
                        type: stmtMatch[1] as any,
                        line: i,
                        resultMap: stmtMatch[3] // 如果存在，捕获 resultMap
                    });
                }

                // 解析 ResultMaps
                const resultMapMatch = line.match(resultMapRegex);
                if (resultMapMatch) {
                    resultMaps.set(resultMapMatch[1], {
                        id: resultMapMatch[1],
                        type: resultMapMatch[2],
                        line: i
                    });
                }
            }

            const xmlInfo: MapperXml = {
                namespace,
                fileUri: uri,
                statements,
                resultMaps
            };

            this.xmlMap.set(namespace, xmlInfo);
        } catch (e) {
            this.outputChannel.appendLine(`[错误] 解析 XML 文件 ${uri.fsPath} 失败: ${e}`);
        }
    }

    public getJavaByNamespace(namespace: string): JavaInterface | undefined {
        return this.javaMap.get(namespace);
    }

    public getXmlByInterface(fullName: string): MapperXml | undefined {
        return this.xmlMap.get(fullName);
    }

    public getClassByFullName(fullName: string): JavaClass | undefined {
        return this.dtoMap.get(fullName);
    }

    public getMapperPath(fullName: string): string | undefined {
        const xml = this.getXmlByInterface(fullName);
        return xml ? xml.fileUri.toString() : undefined;
    }

    public getJavaFileUri(fullName: string): vscode.Uri | undefined {
        const java = this.javaMap.get(fullName);
        return java ? java.fileUri : undefined;
    }

    public getClassByFileUri(uri: vscode.Uri): JavaInterface | undefined {
        for (const [key, val] of this.javaMap) {
            if (val.fileUri.toString() === uri.toString()) {
                return val;
            }
        }
        return undefined;
    }
}