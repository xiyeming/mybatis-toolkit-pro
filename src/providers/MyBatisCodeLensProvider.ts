import * as vscode from 'vscode';
import { ProjectIndexer } from '../services/ProjectIndexer';
import { JavaAstUtils } from '../utils/JavaAstUtils';

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

        // 1. Logic for XML Files
        if (document.languageId === 'xml') {
            const namespaceMatch = content.match(/<mapper\s+namespace="([^"]+)"/);
            if (namespaceMatch) {
                const namespace = namespaceMatch[1];
                const javaInterface = this.indexer.getJavaByNamespace(namespace);

                if (javaInterface) {
                    // Top-level Navigation
                    const range = new vscode.Range(0, 0, 0, 0);
                    const cmd: vscode.Command = {
                        title: `$(symbol-interface) Go to Interface: ${javaInterface.name}`,
                        command: 'vscode.open',
                        arguments: [javaInterface.fileUri]
                    };
                    codeLenses.push(new vscode.CodeLens(range, cmd));

                    // Statement Level Navigation
                    const lines = content.split('\n');
                    const stmtRegex = /<(select|insert|update|delete)\s+id="([^"]+)"/;

                    for (let i = 0; i < lines.length; i++) {
                        const match = lines[i].match(stmtRegex);
                        if (match) {
                            const methodId = match[2];
                            const methodInfo = javaInterface.methods.get(methodId);

                            if (methodInfo) {
                                const range = new vscode.Range(i, 0, i, lines[i].length);
                                const cmd: vscode.Command = {
                                    title: `$(symbol-method) Go to JAVA`,
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
        }

        // 2. Logic for Java Files
        else if (document.languageId === 'java') {
            const packageName = JavaAstUtils.getPackageName(content);
            const interfaceName = JavaAstUtils.getSimpleName(content);

            if (interfaceName && packageName) {
                const fullName = `${packageName}.${interfaceName}`;
                const mapperXml = this.indexer.getXmlByInterface(fullName);

                if (mapperXml) {
                    // Top-level Navigation
                    const range = new vscode.Range(0, 0, 0, 0);
                    const cmd: vscode.Command = {
                        title: `$(file-code) Go to XML Mapper`,
                        command: 'vscode.open',
                        arguments: [mapperXml.fileUri]
                    };
                    codeLenses.push(new vscode.CodeLens(range, cmd));

                    // Method Level Navigation
                    const methods = JavaAstUtils.getMethods(content);
                    for (const [methodName, info] of methods) {
                        const stmtInfo = mapperXml.statements.get(methodName);
                        if (stmtInfo) {
                            const range = new vscode.Range(info.line, 0, info.line, 100);
                            const cmd: vscode.Command = {
                                title: `$(go-to-file) Go to XML`,
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
        }

        return codeLenses;
    }
}