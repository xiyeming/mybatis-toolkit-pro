import * as vscode from 'vscode';
import { DatabaseService } from '../services/DatabaseService';
import { SchemaDocumentProvider } from './SchemaDocumentProvider';
import { ProjectIndexer } from '../services/ProjectIndexer';

export class SqlDefinitionProvider implements vscode.DefinitionProvider {
    private outputChannel: vscode.OutputChannel;

    constructor(
        private dbService: DatabaseService,
        private indexer: ProjectIndexer
    ) {
        this.outputChannel = vscode.window.createOutputChannel('MyBatis Definition');
    }

    private log(msg: string): void {
        this.outputChannel.appendLine(`[Definition] ${msg}`);
    }

    async provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Definition | null> {
        // 4. SQL 列名 → Java 字段 / resultMap 列定义
        if (document.languageId === 'xml') {
            this.log(`点击位置: 行${position.line} 列${position.character}`);

            // 先用默认正则获取光标所在标识符
            const defaultRange = document.getWordRangeAtPosition(position);
            if (defaultRange) {
                const defaultWord = document.getText(defaultRange);
                this.log(`默认正则匹配: word="${defaultWord}", range=行${defaultRange.start.line} 列${defaultRange.start.character}-${defaultRange.end.character}`);
                if (defaultWord && !defaultWord.includes('#{') && !defaultWord.includes('${}')) {
                    const result = this.resolveColumnDefinition(document, position, defaultWord, defaultRange);
                    if (result) {
                        this.log(`跳转成功 (默认正则路径)`);
                        return result;
                    }
                }
            } else {
                this.log(`默认正则未匹配到词`);
            }

            // 尝试含点号的正则（如 a.col 形式的列名）
            const dotRange = document.getWordRangeAtPosition(position, /[\w.]+/);
            if (dotRange) {
                const dotWord = document.getText(dotRange).replace(/[`"']/g, '');
                this.log(`点号正则匹配: word="${dotWord}", range=行${dotRange.start.line} 列${dotRange.start.character}-${dotRange.end.character}`);
                if (dotWord && !dotWord.includes('#{') && !dotWord.includes('${}')) {
                    const result = this.resolveColumnDefinition(document, position, dotWord, dotRange);
                    if (result) {
                        this.log(`跳转成功 (点号正则路径)`);
                        return result;
                    }
                }
            } else {
                this.log(`点号正则未匹配到词`);
            }
        }

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
        if (!blockInfo) {
            this.log(`  resolveColumn: 光标不在 SQL 块内 (offset=${offset})`);
            return null;
        }
        this.log(`  resolveColumn: 找到 SQL 块, openTag="${blockInfo.openTag.substring(0, 80)}..."`);

        // 4b. 提取光标所在列的别名（优先）或列名
        const propertyName = this.extractPropertyName(text, offset, word, wordRange, document);
        if (!propertyName) {
            this.log(`  resolveColumn: extractPropertyName 返回 null`);
            return null;
        }
        this.log(`  resolveColumn: word="${word}" → propertyName="${propertyName}"`);

        // 4c. 获取当前 SQL 块的 resultMap 或 resultType
        const { resultMapId, resultType } = this.extractBlockAttrs(blockInfo.openTag);
        this.log(`  resolveColumn: resultMapId="${resultMapId ?? '无'}", resultType="${resultType ?? '无'}"`);

        // 4d. 有 resultMap → 跳转到 <result>/<id> property="..." 行
        if (resultMapId) {
            const namespaceMatch = text.match(/<mapper\s+namespace="([^"]+)"/);
            if (namespaceMatch) {
                const mapperXml = this.indexer.getXmlByInterface(namespaceMatch[1]);
                if (mapperXml && mapperXml.resultMaps.has(resultMapId)) {
                    const rm = mapperXml.resultMaps.get(resultMapId)!;
                    const resultLine = this.findResultMapPropertyLine(text, rm.line, propertyName);
                    this.log(`  resolveColumn: resultMap 查找 property="${propertyName}" → 行${resultLine}`);
                    if (resultLine >= 0) {
                        return new vscode.Location(document.uri, new vscode.Position(resultLine, 0));
                    }
                } else {
                    this.log(`  resolveColumn: resultMap "${resultMapId}" 未在索引中找到`);
                }
            }
        }

        // 4e. 有 resultType → 跳转到 Java 类字段
        if (resultType) {
            const camelName = this.toCamelCase(propertyName);
            const javaClass = this.indexer.getClassByFullName(resultType);
            if (!javaClass) {
                this.log(`  resolveColumn: Java 类 "${resultType}" 未在索引中找到`);
            } else {
                const field = javaClass.fields.get(camelName);
                this.log(`  resolveColumn: 查找字段 "${camelName}" → ${field ? `行${field.line}` : '未找到'}`);
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
     * - 光标在列名上时，向前检查同一 SELECT 项是否有 AS 别名，有则返回别名
     * - 无别名时取列名最后一段（去 alias. 前缀）
     */
    private extractPropertyName(
        text: string,
        offset: number,
        word: string,
        wordRange: vscode.Range,
        document: vscode.TextDocument
    ): string | null {
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
        const implicitAliasMatch = /([)\w.`"\']+)\s+$/i.exec(before);
        if (implicitAliasMatch && !/\bAS\s+$/i.test(before)) {
            if (/^[a-zA-Z_]\w*$/.test(word) && !/^(SELECT|FROM|WHERE|AND|OR|ON|JOIN|LEFT|RIGHT|INNER|OUTER|GROUP|ORDER|HAVING|LIMIT|UNION|CASE|WHEN|THEN|ELSE|END|AS|IN|IS|NOT|NULL|LIKE|BETWEEN|EXISTS|INSERT|UPDATE|DELETE|SET|VALUES|INTO|DISTINCT|ALL)$/i.test(word)) {
                if (/^\s*(,|FROM\b|\bFROM|$)/i.test(after)) {
                    return word;
                }
            }
        }

        // 光标点击的是列名本身，检查同行是否有 AS 别名
        // 如 bup.id AS recId → 点击 id 时应返回 recId
        const afterTrimmed = after.trimStart();
        const asAfterMatch = /^\bAS\b\s+([\w`"']+)\s*(?:,|FROM\b|$)/i.exec(afterTrimmed);
        if (asAfterMatch) {
            return asAfterMatch[1].replace(/^["'`]|["'`]$/g, '');
        }

        // 检查隐式别名：列名后跟空格 + 标识符（非关键字）
        const implicitAfterMatch = /^\s+([a-zA-Z_]\w*)\s*(?:,|FROM\b|$)/i.exec(after);
        if (implicitAfterMatch) {
            const alias = implicitAfterMatch[1];
            if (!/^(SELECT|FROM|WHERE|AND|OR|ON|JOIN|LEFT|RIGHT|INNER|OUTER|GROUP|ORDER|HAVING|LIMIT|UNION|CASE|WHEN|THEN|ELSE|END|AS|IN|IS|NOT|NULL|LIKE|BETWEEN|EXISTS|INSERT|UPDATE|DELETE|SET|VALUES|INTO|DISTINCT|ALL)$/i.test(alias)) {
                return alias;
            }
        }

        // 无别名，取列名最后一段：a.pet_name -> pet_name
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
        if (str.includes('_')) {
            return str.toLowerCase().replace(/_([a-z])/g, (g) => g[1].toUpperCase());
        }
        return str;
    }
}
