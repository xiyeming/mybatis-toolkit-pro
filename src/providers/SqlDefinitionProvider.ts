import * as vscode from 'vscode';
import { DatabaseService } from '../services/DatabaseService';
import { SchemaDocumentProvider } from './SchemaDocumentProvider';
import { ProjectIndexer } from '../services/ProjectIndexer';

export class SqlDefinitionProvider implements vscode.DefinitionProvider {
    constructor(
        private dbService: DatabaseService,
        private indexer: ProjectIndexer
    ) { }

    async provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Definition | null> {
        const range = document.getWordRangeAtPosition(position, /[`"']?[\w.]+(?:[`"'][\w.]+)*[`"']?/);
        if (!range) return null;

        const rawWord = document.getText(range);
        const word = rawWord.replace(/[`"']/g, '');

        // 跳过参数
        if (word.includes('#{') || word.includes('${')) return null;

        // 1. 检查是否为 Java 类 (resultType, parameterType 等)
        const javaClass = this.indexer.getClassByFullName(word);
        if (javaClass) {
            return new vscode.Location(javaClass.fileUri, new vscode.Position(0, 0));
        }

        // 2. 检查是否为 ResultMap (在当前文件中)
        if (document.languageId === 'xml') {
            const lineContent = document.lineAt(position.line).text;

            // 情况 A: 定义 -> 用法 (<resultMap id="Target"> -> <select resultMap="Target">)
            // 检查我们是否点击了 resultMap 定义的 ID
            const definitionMatch = lineContent.match(/<resultMap\s+id="([^"]+)"/);
            if (definitionMatch && definitionMatch[1] === word) {
                const namespaceMatch = document.getText().match(/<mapper\s+namespace="([^"]+)"/);
                if (namespaceMatch) {
                    const namespace = namespaceMatch[1];
                    const mapperXml = this.indexer.getXmlByInterface(namespace);
                    if (mapperXml) {
                        const locations: vscode.Location[] = [];
                        for (const stmt of mapperXml.statements.values()) {
                            if (stmt.resultMap === word) {
                                locations.push(new vscode.Location(mapperXml.fileUri, new vscode.Position(stmt.line, 0)));
                            }
                        }
                        if (locations.length > 0) {
                            return locations.length === 1 ? locations[0] : locations;
                        }
                    }
                }
                return null;
            }

            // 情况 B: 用法 -> 定义 (resultMap="Target" -> <resultMap id="Target">)
            const namespaceMatch = document.getText().match(/<mapper\s+namespace="([^"]+)"/);
            if (namespaceMatch) {
                const namespace = namespaceMatch[1];
                const mapperXml = this.indexer.getXmlByInterface(namespace);
                if (mapperXml && mapperXml.resultMaps.has(word)) {
                    const resultMap = mapperXml.resultMaps.get(word)!;
                    return new vscode.Location(mapperXml.fileUri, new vscode.Position(resultMap.line, 0));
                }
            }
        }

        // 3. 检查是否为数据库表
        if (this.dbService.hasTable(word)) {
            // 返回到虚拟文档的位置
            // 使用三斜杠确保 tableName 被视为路径，而不是 authority
            const uri = vscode.Uri.parse(`${SchemaDocumentProvider.scheme}:///${word}.md`);
            return new vscode.Location(uri, new vscode.Position(0, 0));
        }

        return null;
    }
}
