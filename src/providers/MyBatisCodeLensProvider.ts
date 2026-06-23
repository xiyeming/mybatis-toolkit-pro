import * as vscode from 'vscode';
import { ProjectIndexer } from '../services/ProjectIndexer';
import { JavaAstUtils } from '../utils/JavaAstUtils';
import { MethodInfo } from '../types';

export class MyBatisCodeLensProvider implements vscode.CodeLensProvider<vscode.CodeLens> {
    private indexer: ProjectIndexer;
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    constructor(indexer: ProjectIndexer) {
        this.indexer = indexer;
        this.indexer.onDidUpdateIndex(() => {
            this._onDidChangeCodeLenses.fire();
        });
    }

    public async provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<any[]> {
        const codeLenses: vscode.CodeLens[] = [];
        const content = document.getText();

        // 1. XML 文件逻辑
        if (document.languageId === 'xml') {
            const namespaceMatch = content.match(/<mapper\s+namespace="([^"]+)"/);
            if (namespaceMatch) {
                const namespace = namespaceMatch[1];
                const javaInterface = this.indexer.getJavaByNamespace(namespace);

                if (javaInterface) {
                    // 顶层导航
                    const range = new vscode.Range(0, 0, 0, 0);
                    const cmd: vscode.Command = {
                        title: `$(symbol-interface) 跳转到接口: ${javaInterface.name}`,
                        command: 'vscode.open',
                        arguments: [javaInterface.fileUri]
                    };
                    codeLenses.push(new vscode.CodeLens(range, cmd));

                    // 语句级导航（支持跨行标签）
                    const stmtRegex = /<(select|insert|update|delete)\b[^>]*?\bid="([^"]+)"[^>]*?>/gi;
                    let stmtMatch: RegExpExecArray | null;
                    while ((stmtMatch = stmtRegex.exec(content)) !== null) {
                        const methodId = stmtMatch[2];
                        const methodInfo = javaInterface.methods.get(methodId);
                        if (methodInfo) {
                            const line = document.positionAt(stmtMatch.index).line;
                            const range = new vscode.Range(line, 0, line, 0);
                            const cmd: vscode.Command = {
                                title: `$(symbol-method) 跳转到 Java`,
                                command: 'vscode.open',
                                arguments: [
                                    javaInterface.fileUri,
                                    { selection: new vscode.Range(methodInfo.line, 0, methodInfo.line, 0) }
                                ]
                            };
                            codeLenses.push(new vscode.CodeLens(range, cmd));
                        }
                    }
                }
            }
        }

        // 2. Java 文件逻辑
        else if (document.languageId === 'java') {
            // 优先使用索引器缓存，避免每次刷新都重新解析当前文档
            let javaInterface = this.indexer.getClassByFileUri(document.uri);
            let mapperXml;
            let methods: Map<string, MethodInfo> | undefined;

            if (javaInterface) {
                mapperXml = this.indexer.getXmlByInterface(javaInterface.fullName);
                methods = javaInterface.methods;
            } else {
                const packageName = JavaAstUtils.getPackageName(content);
                const interfaceName = JavaAstUtils.getSimpleName(content);
                if (interfaceName && packageName) {
                    const fullName = `${packageName}.${interfaceName}`;
                    mapperXml = this.indexer.getXmlByInterface(fullName);
                    methods = JavaAstUtils.getMethods(content);
                }
            }

            if (mapperXml && methods) {
                // 顶层导航
                const range = new vscode.Range(0, 0, 0, 0);
                const cmd: vscode.Command = {
                    title: `$(file-code) 跳转到 XML Mapper`,
                    command: 'vscode.open',
                    arguments: [mapperXml.fileUri]
                };
                codeLenses.push(new vscode.CodeLens(range, cmd));

                // 方法级导航
                for (const [methodName, info] of methods) {
                    const stmtInfo = mapperXml.statements.get(methodName);
                    if (stmtInfo) {
                        const range = new vscode.Range(info.line, 0, info.line, 100);
                        const cmd: vscode.Command = {
                            title: `$(go-to-file) 跳转到 XML`,
                            command: 'vscode.open',
                            arguments: [
                                mapperXml.fileUri,
                                { selection: new vscode.Range(stmtInfo.line, 0, stmtInfo.line, 0) }
                            ]
                        };
                        codeLenses.push(new vscode.CodeLens(range, cmd));
                    }
                }
            }
        }

        return codeLenses;
    }
}