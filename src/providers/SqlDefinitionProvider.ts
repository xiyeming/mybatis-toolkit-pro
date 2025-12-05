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

        // Skip parameters
        if (word.includes('#{') || word.includes('${')) return null;

        // 1. Check if it's a Java Class (resultType, parameterType, etc.)
        const javaClass = this.indexer.getClassByFullName(word);
        if (javaClass) {
            return new vscode.Location(javaClass.fileUri, new vscode.Position(0, 0));
        }

        // 2. Check if it's a ResultMap (in the current file)
        if (document.languageId === 'xml') {
            const lineContent = document.lineAt(position.line).text;

            // Case A: Definition -> Usages (<resultMap id="Target"> -> <select resultMap="Target">)
            // Check if we are clicking on the ID of a resultMap definition
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

            // Case B: Usage -> Definition (resultMap="Target" -> <resultMap id="Target">)
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

        // 3. Check if it's a Database Table
        if (this.dbService.hasTable(word)) {
            // Return a location to the virtual document
            // Use triple slash to ensure tableName is treated as path, not authority
            const uri = vscode.Uri.parse(`${SchemaDocumentProvider.scheme}:///${word}.md`);
            return new vscode.Location(uri, new vscode.Position(0, 0));
        }

        return null;
    }
}
