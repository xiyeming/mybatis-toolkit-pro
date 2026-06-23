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
            const uri = vscode.Uri.parse(`${SchemaDocumentProvider.scheme}:///${word}.md`);
            return new vscode.Location(uri, new vscode.Position(0, 0));
        }

        // 4. SQL 列名 → Java 字段 / resultMap 列定义
        if (document.languageId === 'xml') {
            const result = this.resolveColumnDefinition(document, position, word, range);
            if (result) return result;
        }

        return null;
    }

    /**
     * 解析 SQL 列名跳转：支持别名优先，跳转到 resultMap 列定义或 Entity 字段。
     */
    private resolveColumnDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        word: string,
        wordRange: vscode.Range
    ): vscode.Definition | null {
        const text = document.getText();
        const offset = document.offsetAt(position);

        // 4a. 确认光标在 SQL 语句块内
        const blockInfo = this.findSqlBlock(text, offset);
        if (!blockInfo) return null;

        // 4b. 提取光标所在列的别名（优先）或列名
        const propertyName = this.extractPropertyName(text, offset, word, wordRange, document);
        if (!propertyName) return null;

        // 4c. 获取当前 SQL 块的 resultMap 或 resultType
        const { resultMapId, resultType } = this.extractBlockAttrs(blockInfo.openTag);

        // 4d. 有 resultMap → 跳转到 <result>/<id> property="..." 行
        if (resultMapId) {
            const namespaceMatch = text.match(/<mapper\s+namespace="([^"]+)"/);
            if (namespaceMatch) {
                const mapperXml = this.indexer.getXmlByInterface(namespaceMatch[1]);
                if (mapperXml && mapperXml.resultMaps.has(resultMapId)) {
                    const rm = mapperXml.resultMaps.get(resultMapId)!;
                    // 在 resultMap 区域内查找 property="propertyName" 的 <result>/<id> 行
                    const resultLine = this.findResultMapPropertyLine(text, rm.line, propertyName);
                    if (resultLine >= 0) {
                        return new vscode.Location(document.uri, new vscode.Position(resultLine, 0));
                    }
                }
            }
        }

        // 4e. 有 resultType → 跳转到 Java 类字段
        if (resultType) {
            const camelName = this.toCamelCase(propertyName);
            const javaClass = this.indexer.getClassByFullName(resultType);
            if (javaClass) {
                const field = javaClass.fields.get(camelName);
                if (field) {
                    return new vscode.Location(javaClass.fileUri, new vscode.Position(field.line, 0));
                }
            }
        }

        return null;
    }

    /** 查找光标所在的 SQL 语句块（<select>/<insert>/<update>/<delete>） */
    private findSqlBlock(text: string, offset: number): { openTag: string, start: number, end: number } | null {
        const blockRegex = /<(select|insert|update|delete)\b([^>]*)>/gi;
        let match: RegExpExecArray | null;
        let lastOpen: { openTag: string, start: number } | null = null;

        while ((match = blockRegex.exec(text)) !== null) {
            const tagEnd = match.index + match[0].length;
            if (match.index <= offset) {
                // 查找对应的关闭标签
                const closeTag = `</${match[1]}>`;
                const closeIdx = text.indexOf(closeTag, tagEnd);
                if (closeIdx === -1) continue;
                if (offset < closeIdx) {
                    lastOpen = { openTag: match[0], start: match.index };
                }
            }
        }
        if (lastOpen) {
            const closeTagRegex = new RegExp(`</(?:select|insert|update|delete)>`, 'i');
            const after = text.substring(offset);
            const closeMatch = after.match(closeTagRegex);
            const end = closeMatch ? offset + closeMatch.index! + closeMatch[0].length : text.length;
            return { openTag: lastOpen.openTag, start: lastOpen.start, end };
        }
        return null;
    }

    /** 从 SQL 块的开始标签中提取 resultMap 和 resultType 属性 */
    private extractBlockAttrs(openTag: string): { resultMapId?: string, resultType?: string } {
        const rmMatch = /\bresultMap=["']([^"']+)["']/.exec(openTag);
        const rtMatch = /\bresultType=["']([^"']+)["']/.exec(openTag);
        return {
            resultMapId: rmMatch ? rmMatch[1] : undefined,
            resultType: rtMatch ? rtMatch[1] : undefined,
        };
    }

    /**
     * 提取光标所在列对应的属性名：
     * - 优先使用别名（AS alias 或隐式空格别名）
     * - 无别名时取列名最后一段（去 alias. 前缀）
     * - 如果光标本身就点击在别名上，直接返回别名
     */
    private extractPropertyName(
        text: string,
        offset: number,
        word: string,
        wordRange: vscode.Range,
        document: vscode.TextDocument
    ): string | null {
        // 获取当前行光标前后的文本片段
        const lineText = document.lineAt(wordRange.start.line).text;
        const wordStartInLine = wordRange.start.character;

        // 光标前部分（同行）
        const before = lineText.substring(0, wordStartInLine);
        // 光标后部分（同行，跳过 word 本身）
        const after = lineText.substring(wordRange.end.character);

        // 检查光标是否在 AS alias 的别名上：
        // 向前查找最近的 AS（不跨行）
        const asMatch = /\bAS\s+$/i.exec(before);
        if (asMatch) {
            // 光标词就是别名
            return word.replace(/^["'`]|["'`]$/g, '');
        }

        // 检查光标是否在隐式别名上（expr alias，空格分隔）：
        // 前面有 "expr " 且 expr 看起来像列/表达式
        // 但需确认 word 不是 expr 本身而是别名
        // 判断：before 以 "标识符/右括号 + 空格" 结尾，且不是 AS
        const implicitAliasMatch = /([)\w.`"\']+)\s+$/i.exec(before);
        if (implicitAliasMatch && !/\bAS\s+$/i.test(before)) {
            const prevPart = implicitAliasMatch[1];
            // 前面部分看起来像表达式（含 .、括号、引号）或纯标识符
            // 且当前 word 是简单标识符（不像表达式）
            if (/^[a-zA-Z_]\w*$/.test(word) && !/^(SELECT|FROM|WHERE|AND|OR|ON|JOIN|LEFT|RIGHT|INNER|OUTER|GROUP|ORDER|HAVING|LIMIT|UNION|CASE|WHEN|THEN|ELSE|END|AS|IN|IS|NOT|NULL|LIKE|BETWEEN|EXISTS|INSERT|UPDATE|DELETE|SET|VALUES|INTO|DISTINCT|ALL)$/i.test(word)) {
                // 确认后面不是继续的列（如 "a b c" 的中间词不应被当作别名）
                // 后面应该是逗号、FROM、或行尾
                if (/^\s*(,|FROM\b|\bFROM|$)/i.test(after)) {
                    return word;
                }
            }
        }

        // 光标点击的是列名本身（非别名）
        // 提取列名最后一段：a.pet_name -> pet_name
        const colName = word.includes('.') ? word.split('.').pop()! : word;
        return colName.replace(/^["'`]|["'`]$/g, '');
    }

    /** 在 resultMap 区域内查找 property="propertyName" 的 <result>/<id> 标签所在行 */
    private findResultMapPropertyLine(text: string, resultMapLine: number, propertyName: string): number {
        const lines = text.split('\n');
        // 从 resultMap 开始行向下搜索，直到遇到 </resultMap> 或另一个 <resultMap>
        let depth = 1;
        for (let i = resultMapLine + 1; i < lines.length; i++) {
            const line = lines[i];
            if (/<resultMap\b/i.test(line)) break;
            if (/<\/resultMap\s*>/i.test(line)) break;

            // 匹配 <result ... property="xxx" ...> 或 <id ... property="xxx" ...>
            const propMatch = /<(?:result|id)\b[^>]*\bproperty=["']([^"']+)["']/i.exec(line);
            if (propMatch && propMatch[1] === propertyName) {
                return i;
            }
        }
        return -1;
    }

    /** 下划线转驼峰：pet_name → petName */
    private toCamelCase(str: string): string {
        return str.toLowerCase().replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    }
}
