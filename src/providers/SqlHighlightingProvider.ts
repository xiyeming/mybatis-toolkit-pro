import * as vscode from 'vscode';
import { DatabaseService } from '../services/DatabaseService';
import { DialectFactory } from '../services/dialects/DialectFactory';
import { Dialect } from '../services/dialects/Dialect';

enum TokenType {
    Keyword,
    Function,
    Identifier,
    String,
    Variable,
    Operator,
    Symbol,
    XmlTag,
    XmlComment,
    XmlProlog,
    XmlCdata,
    Entity,
    Whitespace,
    Newline
}

interface Token {
    type: TokenType;
    value: string;
    line?: number;
    start?: number; // 语义令牌范围需要
    isTable?: boolean;
}
const TOKEN_TYPES_LEGEND = [
    'keyword', 'function', 'variable', 'string', 'number', 'operator', 'parameter', 'class'
];
const TOKEN_MODIFIERS_LEGEND = [
    'declaration', 'documentation'
];

export const SQL_SEMANTIC_TOKEN_LEGEND = new vscode.SemanticTokensLegend(TOKEN_TYPES_LEGEND, TOKEN_MODIFIERS_LEGEND);

export class SqlHighlightingProvider implements vscode.DocumentSemanticTokensProvider {
    constructor(private dbService: DatabaseService) { }

    async provideDocumentSemanticTokens(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.SemanticTokens> {
        const builder = new vscode.SemanticTokensBuilder(SQL_SEMANTIC_TOKEN_LEGEND);
        const text = document.getText();
        const dialect = this.getDialect();

        const tokens = this.tokenize(text, dialect);

        let line = 0;
        let char = 0;
        // 重新计算位置，因为 tokenize 并没有很好地跟踪行/字符？
        // 实际上我在 FormattingProvider 中的 tokenizer 没有跟踪起始索引。
        // 我需要跟踪语义令牌的位置（行、起始字符、长度）。

        // 让我们实现一个位置感知 tokenizer 或将简单 token 映射回去？
        // 如果我们跳过空白或有复杂的 token，映射回去很难。
        // 最好让 tokenizer 跟踪位置。

        let currentOffset = 0;

        for (const t of tokens) {
            // 从 currentOffset 开始在文本中查找 token 的位置
            // 因为我们按顺序 token 化，t.value 对应于文本切片。
            // 但我们需要处理换行符以更新 'line' 和 'char'。

            // 我们可以根据 t.value 内容计算 line/char 增量。
            const lines = t.value.split(/\r\n|\r|\n/);

            // 开始 token 位置
            const startLine = line;
            const startChar = char;

            // 语义令牌是单行的。多行令牌（如注释或块字符串）必须拆分。
            // 如果 token 跨越多行：
            for (let i = 0; i < lines.length; i++) {
                const lineContent = lines[i];
                if (lineContent.length > 0) {
                    // 如果此行部分映射到一种类型，则添加语义令牌
                    const typeIdx = this.getSemanticTypeIndex(t);
                    if (typeIdx !== -1) {
                        // 确保我们不会无意中将 XML prolog/tags 高亮显示为 SQL 关键字？
                        // 我们的 tokenizer 区分 XmlTag 等。
                        // 所以只映射 Keyword/Function/Variable/String
                        builder.push(line + i, (i === 0 ? startChar : 0), lineContent.length, typeIdx, 0);
                    }
                }
            }

            // 更新下一个 token 的位置
            if (lines.length > 1) {
                line += lines.length - 1;
                char = lines[lines.length - 1].length;
            } else {
                char += t.value.length;
            }
            currentOffset += t.value.length;
        }

        return builder.build();
    }

    private getSemanticTypeIndex(token: Token): number {
        switch (token.type) {
            case TokenType.Keyword: return TOKEN_TYPES_LEGEND.indexOf('keyword');
            case TokenType.Function: return TOKEN_TYPES_LEGEND.indexOf('function');
            case TokenType.Variable: return TOKEN_TYPES_LEGEND.indexOf('variable'); // #{...}
            case TokenType.String: return TOKEN_TYPES_LEGEND.indexOf('string');
            case TokenType.Identifier:
                if (token.isTable) return TOKEN_TYPES_LEGEND.indexOf('class');
                return -1;
            // case TokenType.Operator: return TOKEN_TYPES_LEGEND.indexOf('operator'); // 通常由语法着色
            // Identifier? 可能是 'variable' 或默认？留给标准语法。
            default: return -1;
        }
    }

    private getDialect(): Dialect {
        const activeType = this.dbService.getActiveDatabaseType();
        if (activeType) {
            return DialectFactory.getDialect(activeType);
        }
        const config = vscode.workspace.getConfiguration('mybatisToolkit');
        const defaultType = config.get<string>('defaultDatabaseType', 'MySQL');
        return DialectFactory.getDialect(defaultType);
    }

    private tokenize(text: string, dialect: Dialect): Token[] {
        // 从 SqlFormattingProvider 复制逻辑，更改极小
        // 为了稳定性和独立性而复制
        const tokens: Token[] = [];
        let i = 0;
        const length = text.length;

        const xmlPrologRegex = /^<\s*\?\s*xml[\s\S]*?\?>/i;
        const xmlDoctypeRegex = /^<\s*!\s*DOCTYPE[\s\S]*?>/i;
        const xmlCommentRegex = /^<\s*!\s*--[\s\S]*?--\s*>/;
        const xmlCdataRegex = /^<\s*!\[CDATA\[[\s\S]*?\]\]>/i;
        const xmlTagRegex = /^<\s*(\/?)\s*([\w:\-\.]+)(?:[^>"']|"[^"]*"|'[^']*')*?(\/?)>/;
        const entityRegex = /^&(#x?[0-9a-fA-F]+|[a-zA-Z0-9]+);/;
        const variableRegex = /^[\#\$]\{[^\}]*\}/;
        const wordRegex = /^[\w\.]+/;

        const quoteChar = dialect.getQuoteChar();

        while (i < length) {
            const char = text[i];
            const rest = text.slice(i);

            if (/\s/.test(char)) {
                // FormattingProvider 折叠了空白。在这里我们必须保留严格的长度以进行位置跟踪。
                // 空白运行的正则
                const wsMatch = rest.match(/^\s+/);
                if (wsMatch) {
                    tokens.push({ type: TokenType.Whitespace, value: wsMatch[0] });
                    i += wsMatch[0].length;
                    continue;
                }
                tokens.push({ type: TokenType.Whitespace, value: char });
                i++;
                continue;
            }

            if (char === '<') {
                let m = rest.match(xmlPrologRegex);
                if (m) { tokens.push({ type: TokenType.XmlProlog, value: m[0] }); i += m[0].length; continue; }
                m = rest.match(xmlDoctypeRegex);
                if (m) { tokens.push({ type: TokenType.XmlProlog, value: m[0] }); i += m[0].length; continue; }
                m = rest.match(xmlCommentRegex);
                if (m) { tokens.push({ type: TokenType.XmlComment, value: m[0] }); i += m[0].length; continue; }
                m = rest.match(xmlCdataRegex);
                if (m) { tokens.push({ type: TokenType.XmlCdata, value: m[0] }); i += m[0].length; continue; }
                const tagMatch = rest.match(xmlTagRegex);
                if (tagMatch) { tokens.push({ type: TokenType.XmlTag, value: tagMatch[0] }); i += tagMatch[0].length; continue; }
            }

            if (char === '#' || char === '$') {
                const varMatch = rest.match(variableRegex);
                if (varMatch) { tokens.push({ type: TokenType.Variable, value: varMatch[0] }); i += varMatch[0].length; continue; }
            }

            if (char === quoteChar || (quoteChar === ']' && char === '[')) {
                const endChar = (char === '[') ? ']' : quoteChar;
                const endIdx = rest.indexOf(endChar, 1);
                if (endIdx !== -1) {
                    // 检查上下文以获取 "Table" 类型
                    const tokenVal = rest.substring(0, endIdx + 1);
                    if (this.isTableContext(tokens)) {
                        tokens.push({ type: TokenType.Identifier, value: tokenVal, isTable: true });
                    } else {
                        tokens.push({ type: TokenType.Identifier, value: tokenVal });
                    }
                    i += endIdx + 1;
                    continue;
                }
            }
            if (char === '`' && quoteChar !== '`') {
                const endIdx = rest.indexOf('`', 1);
                if (endIdx !== -1) {
                    const tokenVal = rest.substring(0, endIdx + 1);
                    if (this.isTableContext(tokens)) {
                        tokens.push({ type: TokenType.Identifier, value: tokenVal, isTable: true });
                    } else {
                        tokens.push({ type: TokenType.Identifier, value: tokenVal });
                    }
                    i += endIdx + 1;
                    continue;
                }
            }


            if (char === "'") {
                let end = 1;
                while (end < rest.length) {
                    if (rest[end] === "'") {
                        if (end + 1 < rest.length && rest[end + 1] === "'") { end += 2; continue; }
                        break;
                    }
                    end++;
                }
                if (end < rest.length) {
                    tokens.push({ type: TokenType.String, value: rest.substring(0, end + 1) });
                    i += end + 1;
                    continue;
                }
            }
            if (char === '"' && quoteChar !== '"') {
                let end = 1;
                while (end < rest.length) {
                    if (rest[end] === '"') {
                        if (end + 1 < rest.length && rest[end + 1] === '"') { end += 2; continue; }
                        break;
                    }
                    end++;
                }
                if (end < rest.length) {
                    tokens.push({ type: TokenType.String, value: rest.substring(0, end + 1) });
                    i += end + 1;
                    continue;
                }
            }

            if (rest.startsWith('--')) {
                const nl = rest.indexOf('\n');
                const comment = nl === -1 ? rest : rest.substring(0, nl);
                tokens.push({ type: TokenType.XmlComment, value: comment });
                i += comment.length;
                continue;
            }

            if (char === '&') {
                // 简化实体处理
                if (rest.startsWith('&apos;') || rest.startsWith('&quot;')) {
                    // treat as string content for highlighting purposes? or symbol?
                    // Let's treat as symbol or entity
                    tokens.push({ type: TokenType.Entity, value: rest.startsWith('&apos;') ? '&apos;' : '&quot;' });
                    i += 6;
                    continue;
                }
                const entityMatch = rest.match(entityRegex);
                if (entityMatch) { tokens.push({ type: TokenType.Entity, value: entityMatch[0] }); i += entityMatch[0].length; continue; }
            }

            if (/^(\>=|\<=|\!=|\<\>)/.test(rest)) {
                tokens.push({ type: TokenType.Operator, value: rest.substring(0, 2) });
                i += 2;
                continue;
            }

            if (/[a-zA-Z0-9_]/.test(char)) {
                const match = rest.match(wordRegex);
                if (match) {
                    const word = match[0];
                    if (dialect.isKeyword(word)) {
                        tokens.push({ type: TokenType.Keyword, value: match[0] }); // 使用原始字符串进行文本切片
                    } else if (dialect.getFunctions().includes(word.toUpperCase())) {
                        tokens.push({ type: TokenType.Function, value: match[0] });
                    } else {
                        // 发现 Identifier
                        if (this.isTableContext(tokens)) {
                            tokens.push({ type: TokenType.Identifier, value: match[0], isTable: true });
                        } else {
                            tokens.push({ type: TokenType.Identifier, value: match[0] });
                        }
                    }
                    i += word.length;
                    continue;
                }
            }

            tokens.push({ type: TokenType.Symbol, value: char });
            i++;
        }
        return tokens;
    }

    private isTableContext(tokens: Token[]): boolean {
        // 向后查找以该表为前缀的关键字：FROM, JOIN, UPDATE, INTO
        // 跳过空白/注释
        for (let i = tokens.length - 1; i >= 0; i--) {
            const t = tokens[i];
            if (t.type === TokenType.Whitespace || t.type === TokenType.Newline || t.type === TokenType.XmlComment) continue;
            if (t.type === TokenType.Keyword) {
                const k = t.value.toUpperCase();
                return ['FROM', 'JOIN', 'UPDATE', 'INTO'].includes(k);
            }
            if (t.type === TokenType.Symbol && t.value === ',') {
                // 逗号可能意味着表列表：FROM a, b
                // 继续向后搜索？
                // 对于简单的 tokenizer 来说太复杂？
                // 让我们递归或只是继续回顾？
                // 最低支持：继续循环
                continue;
            }
            // 如果遇到另一个标识符或 token，有效上下文被打破（逗号除外）
            return false;
        }
        return false;
    }
}
