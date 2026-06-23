import * as vscode from 'vscode';
import { JavaInterface, JavaClass, MapperXml, StatementInfo, ResultMapInfo } from '../types';
import { JavaAstUtils } from '../utils/JavaAstUtils';
import { getNavigationExclude, getIndexParseConcurrency, getIndexDebounceMs } from '../config';
import { MAX_INDEX_FILE_SIZE_BYTES } from '../constants';

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

    private pendingUpdateTimeout: ReturnType<typeof setTimeout> | undefined;
    private pendingFire = false;
    private watchers: vscode.FileSystemWatcher[] = [];
    private disposed = false;
    private gitignoreExcludes: string[] = [];

    private constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
    }

    /** 将多文件变更合并为一次索引更新通知，降低 CodeLens/验证等重复计算 */
    private scheduleFireIndexUpdated(): void {
        if (this.pendingUpdateTimeout) {
            clearTimeout(this.pendingUpdateTimeout);
        }
        this.pendingFire = true;
        this.pendingUpdateTimeout = setTimeout(() => {
            this.pendingUpdateTimeout = undefined;
            if (this.pendingFire) {
                this.pendingFire = false;
                this._onDidUpdateIndex.fire();
            }
        }, getIndexDebounceMs());
    }

    public static getInstance(outputChannel?: vscode.OutputChannel): ProjectIndexer {
        if (!ProjectIndexer.instance && outputChannel) {
            ProjectIndexer.instance = new ProjectIndexer(outputChannel);
        }
        return ProjectIndexer.instance;
    }

    /**
     * 销毁当前单例，清空缓存、定时器与文件监听。主要用于 deactivate 与测试。
     */
    public static destroyInstance(): void {
        if (ProjectIndexer.instance) {
            ProjectIndexer.instance.dispose();
            ProjectIndexer.instance = undefined as any;
        }
    }

    /**
     * 释放所有资源：文件监听器、定时器、缓存、事件发射器。
     */
    public dispose(): void {
        if (this.disposed) return;
        this.disposed = true;

        for (const watcher of this.watchers) {
            watcher.dispose();
        }
        this.watchers = [];

        if (this.pendingUpdateTimeout) {
            clearTimeout(this.pendingUpdateTimeout);
            this.pendingUpdateTimeout = undefined;
        }

        this.javaMap.clear();
        this.dtoMap.clear();
        this.xmlMap.clear();
        this._onDidUpdateIndex.dispose();
    }

    public async init() {
        if (this.disposed) return;
        this.outputChannel.appendLine('[索引器] 开始全项目扫描...');
        const start = Date.now();

        await this.loadGitignoreExcludes();

        const excludes = getNavigationExclude();
        const allExcludes = [...excludes, ...this.gitignoreExcludes];
        const excludePattern = `**/{${allExcludes.join(',')}}/**`;
        // 提高上限，确保多模块、dao/mapper 子目录（如 dao/order/OrderMapper.java、mapper/order/OrderMapper.xml）均被扫描
        const maxResults = 100000;

        // 按工作区文件夹递归扫描，确保每个根目录下的子目录（dao/xxx、mapper/xxx）都被索引
        const javaFiles = await this.collectFilesRecursively('**/*.java', excludePattern, maxResults);
        const xmlFiles = await this.collectFilesRecursively('**/*.xml', excludePattern, maxResults);

        await this.parseFilesInBatches(javaFiles, file => this.parseJavaFile(file));
        await this.parseFilesInBatches(xmlFiles, file => this.parseXmlFile(file));

        this.outputChannel.appendLine(`[索引器] 扫描完成，耗时 ${Date.now() - start}ms。Mappers: ${this.javaMap.size}, DTOs: ${this.dtoMap.size}, XML: ${this.xmlMap.size}`);
        this._onDidUpdateIndex.fire();

        // 为每个工作区根目录注册递归监听，确保 dao/mapper 子目录下的新建/变更/删除都能触发索引更新
        this.registerFileWatchers();
    }

    /**
     * 递归收集文件：多根工作区时对每个 folder 使用 RelativePattern 递归匹配，确保子目录（如 dao/order、mapper/order）被完整扫描。
     */
    private async collectFilesRecursively(glob: string, excludePattern: string, maxResults: number): Promise<vscode.Uri[]> {
        const folders = vscode.workspace.workspaceFolders;
        if (folders && folders.length > 0) {
            const allUris: vscode.Uri[] = [];
            const seen = new Set<string>();
            for (const folder of folders) {
                const pattern = new vscode.RelativePattern(folder, glob);
                const uris = await vscode.workspace.findFiles(pattern, excludePattern, maxResults);
                for (const uri of uris) {
                    const key = uri.toString();
                    if (!seen.has(key)) {
                        seen.add(key);
                        allUris.push(uri);
                    }
                }
            }
            return allUris;
        }
        return vscode.workspace.findFiles(glob, excludePattern, maxResults);
    }

    /** 为每个工作区根目录注册递归文件监听（匹配任意深度的 .java 与 .xml），子目录变更也会触发索引更新。 */
    private registerFileWatchers(): void {
        const folders = vscode.workspace.workspaceFolders;
        if (folders && folders.length > 0) {
            for (const folder of folders) {
                const pattern = new vscode.RelativePattern(folder, '**/*.{java,xml}');
                const watcher = vscode.workspace.createFileSystemWatcher(pattern);
                watcher.onDidChange(uri => this.handleFileChange(uri));
                watcher.onDidCreate(uri => this.handleFileChange(uri));
                watcher.onDidDelete(uri => this.handleFileDelete(uri));
                this.watchers.push(watcher);
            }
        } else {
            const watcher = vscode.workspace.createFileSystemWatcher('**/*.{java,xml}');
            watcher.onDidChange(uri => this.handleFileChange(uri));
            watcher.onDidCreate(uri => this.handleFileChange(uri));
            watcher.onDidDelete(uri => this.handleFileDelete(uri));
            this.watchers.push(watcher);
        }
    }

    /** 限制并发解析数量，避免大仓库下同时打开大量文档导致卡顿；超过大小阈值的文件直接跳过。 */
    private async parseFilesInBatches(files: vscode.Uri[], parseOne: (uri: vscode.Uri) => Promise<void>): Promise<void> {
        const concurrency = Math.max(1, getIndexParseConcurrency());
        let skipped = 0;
        let index = 0;
        const workers: Promise<void>[] = [];

        const worker = async () => {
            while (index < files.length) {
                const uri = files[index++];
                if (await this.isOversized(uri)) {
                    skipped++;
                    this.outputChannel.appendLine(`[索引器] 跳过超大文件: ${uri.fsPath}`);
                    continue;
                }
                try {
                    await parseOne(uri);
                } catch (e) {
                    this.outputChannel.appendLine(`[索引器] 解析文件失败 ${uri.fsPath}: ${e}`);
                }
            }
        };

        for (let w = 0; w < concurrency; w++) {
            workers.push(worker());
        }
        await Promise.all(workers);

        if (skipped > 0) {
            this.outputChannel.appendLine(`[索引器] 共跳过 ${skipped} 个超大文件（>${MAX_INDEX_FILE_SIZE_BYTES / 1024}KB）。`);
        }
    }

    private async isOversized(uri: vscode.Uri): Promise<boolean> {
        try {
            const stat = await vscode.workspace.fs.stat(uri);
            return stat.size > MAX_INDEX_FILE_SIZE_BYTES;
        } catch {
            return false;
        }
    }

    /**
     * 检查文件路径是否应该被排除
     */
    private shouldExclude(uri: vscode.Uri): boolean {
        const excludes = getNavigationExclude();

        const fsPath = JavaAstUtils.normalizePath(uri.fsPath);
        // 检查路径中是否包含排除的目录
        const configExcluded = excludes.some(pattern => {
            const normalized = pattern.toLowerCase();
            return fsPath.includes(`/${normalized}/`) || fsPath.includes(`\\${normalized}\\`);
        });
        // 同时检查 .gitignore 提取的目录
        const gitignoreExcluded = this.gitignoreExcludes.some(pattern => {
            const normalized = pattern.toLowerCase();
            return fsPath.includes(`/${normalized}/`) || fsPath.includes(`\\${normalized}\\`);
        });
        return configExcluded || gitignoreExcluded;
    }

    /** 读取各工作区根目录的 .gitignore，提取目录排除项 */
    private async loadGitignoreExcludes(): Promise<void> {
        this.gitignoreExcludes = [];
        const folders = vscode.workspace.workspaceFolders;
        if (!folders) return;

        for (const folder of folders) {
            const gitignoreUri = vscode.Uri.joinPath(folder.uri, '.gitignore');
            try {
                const doc = await vscode.workspace.openTextDocument(gitignoreUri);
                const dirs = this.parseGitignorePatterns(doc.getText());
                for (const d of dirs) {
                    if (!this.gitignoreExcludes.includes(d)) {
                        this.gitignoreExcludes.push(d);
                    }
                }
            } catch {
                // .gitignore 不存在，跳过
            }
        }

        if (this.gitignoreExcludes.length > 0) {
            this.outputChannel.appendLine(`[索引器] 从 .gitignore 加载排除目录: ${this.gitignoreExcludes.join(', ')}`);
        }
    }

    /** 从 .gitignore 内容中提取目录名（以 / 结尾或无明显扩展名的隐藏目录） */
    private parseGitignorePatterns(content: string): string[] {
        const dirs: string[] = [];
        const lines = content.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            if (trimmed.startsWith('!')) continue;

            let pattern = trimmed.replace(/^\//, '');

            if (pattern.endsWith('/')) {
                const dirName = pattern.slice(0, -1);
                if (dirName) {
                    const leaf = dirName.split('/').pop()!;
                    if (!dirs.includes(leaf)) dirs.push(leaf);
                }
            } else if (!pattern.includes('*') && !pattern.includes('/')) {
                const leaf = pattern.split('/').pop()!;
                if (leaf && !dirs.includes(leaf)) dirs.push(leaf);
            }
        }

        return dirs;
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
        this.scheduleFireIndexUpdated();
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
        this.scheduleFireIndexUpdated();
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