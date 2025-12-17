import * as vscode from 'vscode';

import { DatabaseService } from '../services/DatabaseService';
import { DialectFactory } from '../services/dialects/DialectFactory';
import { Dialect } from '../services/dialects/Dialect';

// Token 类型
enum TokenType {
    Keyword,
    Function,
    Identifier,
    String,
    Variable, // #{...}, ${...}
    Operator, // =, <, >, +, -, *, /
    Symbol, // (, ), ,
    XmlTag,
    XmlComment, // <!-- ... -->
    XmlProlog,  // <?xml ... ?>, <!DOCTYPE ...>
    XmlCdata,   // <![CDATA[ ... ]]>
    Entity,     // &lt; &gt; &amp; &apos; &quot;
    Whitespace,
    Newline
}

interface Token {
    type: TokenType;
    value: string;
    line?: number;
}

export class SqlFormattingProvider implements vscode.DocumentFormattingEditProvider {

    constructor(private dbService: DatabaseService) { }

    private getDialect(): Dialect {
        const activeType = this.dbService.getActiveDatabaseType();
        if (activeType) {
            return DialectFactory.getDialect(activeType);
        }
        const config = vscode.workspace.getConfiguration('mybatisToolkit');
        const defaultType = config.get<string>('defaultDatabaseType', 'MySQL');
        return DialectFactory.getDialect(defaultType);
    }

    public provideDocumentFormattingEdits(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken): vscode.TextEdit[] {
        const text = document.getText();
        const indentSize = options.tabSize;

        // 1. 获取 Dialect
        const dialect = this.getDialect();

        // 2. 分词 (Tokenize)
        const tokens = this.tokenize(text, dialect);

        // 3. 格式化 (Format)
        const formattedText = this.format(tokens, indentSize, dialect);

        // 4. 返回编辑 (替换全文)
        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(text.length)
        );
        return [vscode.TextEdit.replace(fullRange, formattedText)];
    }

    private tokenize(text: string, dialect: Dialect): Token[] {
        const tokens: Token[] = [];
        let i = 0;
        const length = text.length;

        // XML RegEx
        const xmlPrologRegex = /^<\s*\?\s*xml[\s\S]*?\?>/i;
        const xmlDoctypeRegex = /^<\s*!\s*DOCTYPE[\s\S]*?>/i;
        const xmlCommentRegex = /^<\s*!\s*--[\s\S]*?--\s*>/;
        const xmlCdataRegex = /^<\s*!\[CDATA\[[\s\S]*?\]\]>/i;
        const xmlTagRegex = /^<\s*(\/?)\s*([\w:\-\.]+)(?:[^>"']|"[^"]*"|'[^']*')*?(\/?)>/;
        const entityRegex = /^&(#x?[0-9a-fA-F]+|[a-zA-Z0-9]+);/;
        const variableRegex = /^[\#\$]\{[^\}]*\}/;
        const wordRegex = /^[\w\.]+/;

        // Dialect specific
        const quoteChar = dialect.getQuoteChar();

        while (i < length) {
            const char = text[i];
            const rest = text.slice(i);

            // 1. Whitespace
            if (/\s/.test(char)) {
                if (char === '\n' || (char === '\r' && (i + 1 < length && text[i + 1] === '\n'))) {
                    tokens.push({ type: TokenType.Newline, value: '\n' });
                    if (char === '\r') i++;
                } else {
                    tokens.push({ type: TokenType.Whitespace, value: ' ' });
                }
                i++;
                continue;
            }

            // 2. XML Structures
            if (char === '<') {
                let m = rest.match(xmlPrologRegex);
                if (m) {
                    tokens.push({ type: TokenType.XmlProlog, value: m[0] });
                    i += m[0].length;
                    continue;
                }
                m = rest.match(xmlDoctypeRegex);
                if (m) {
                    tokens.push({ type: TokenType.XmlProlog, value: m[0] });
                    i += m[0].length;
                    continue;
                }
                m = rest.match(xmlCommentRegex);
                if (m) {
                    tokens.push({ type: TokenType.XmlComment, value: m[0] });
                    i += m[0].length;
                    continue;
                }
                m = rest.match(xmlCdataRegex);
                if (m) {
                    tokens.push({ type: TokenType.XmlCdata, value: m[0] });
                    i += m[0].length;
                    continue;
                }
                const tagMatch = rest.match(xmlTagRegex);
                if (tagMatch) {
                    tokens.push({ type: TokenType.XmlTag, value: tagMatch[0] });
                    i += tagMatch[0].length;
                    continue;
                }
            }

            // 3. Variables
            if (char === '#' || char === '$') {
                const varMatch = rest.match(variableRegex);
                if (varMatch) {
                    tokens.push({ type: TokenType.Variable, value: varMatch[0] });
                    i += varMatch[0].length;
                    continue;
                }
            }

            // 4. Quote (Identifier) - Dialect Specific
            if (char === quoteChar || (quoteChar === ']' && char === '[')) {
                const endChar = (char === '[') ? ']' : quoteChar;
                // Simple search for endChar
                // TODO: handle escaping
                const endIdx = rest.indexOf(endChar, 1);
                if (endIdx !== -1) {
                    tokens.push({ type: TokenType.Identifier, value: rest.substring(0, endIdx + 1) });
                    i += endIdx + 1;
                    continue;
                }
            }

            // 4b. Backtick (Commonly used in MySQL/Generic, handle as ID if not main quote)
            if (char === '`' && quoteChar !== '`') {
                const endIdx = rest.indexOf('`', 1);
                if (endIdx !== -1) {
                    tokens.push({ type: TokenType.Identifier, value: rest.substring(0, endIdx + 1) });
                    i += endIdx + 1;
                    continue;
                }
            }

            // 5. String (Single Quote mainly, Double Quote if not Identifier)
            if (char === "'") {
                // Match string
                // Handle escaped quotes ''
                let end = 1;
                while (end < rest.length) {
                    if (rest[end] === "'") {
                        if (end + 1 < rest.length && rest[end + 1] === "'") {
                            end += 2; // skip escaped
                            continue;
                        }
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
                // Treat as string (MySQL style)
                let end = 1;
                while (end < rest.length) {
                    if (rest[end] === '"') {
                        if (end + 1 < rest.length && rest[end + 1] === '"') {
                            end += 2;
                            continue;
                        }
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

            // 6. Comments (SQL --)
            if (rest.startsWith('--')) {
                const nl = rest.indexOf('\n');
                const comment = nl === -1 ? rest : rest.substring(0, nl);
                tokens.push({ type: TokenType.XmlComment, value: comment });
                i += comment.length;
                continue;
            }

            // 7. Entities
            if (char === '&') {
                if (rest.startsWith('&apos;')) {
                    const end = rest.indexOf('&apos;', 6);
                    if (end !== -1) {
                        // &apos;...&apos; treated as String
                        tokens.push({ type: TokenType.String, value: rest.substring(0, end + 6) });
                        i += end + 6;
                        continue;
                    }
                }
                if (rest.startsWith('&quot;')) {
                    const end = rest.indexOf('&quot;', 6);
                    if (end !== -1) {
                        // &quot;...&quot; treated as String (or ID?) - let's say String for XML context consistency
                        tokens.push({ type: TokenType.String, value: rest.substring(0, end + 6) });
                        i += end + 6;
                        continue;
                    }
                }
                const entityMatch = rest.match(entityRegex);
                if (entityMatch) {
                    tokens.push({ type: TokenType.Entity, value: entityMatch[0] });
                    i += entityMatch[0].length;
                    continue;
                }
            }

            // 8. Operators
            if (/^(\>=|\<=|\!=|\<\>)/.test(rest)) {
                tokens.push({ type: TokenType.Operator, value: rest.substring(0, 2) });
                i += 2;
                continue;
            }

            // 9. Words (Keywords/Functions/Identifiers)
            if (/[a-zA-Z0-9_]/.test(char)) {
                const match = rest.match(wordRegex);
                if (match) {
                    const word = match[0];
                    if (dialect.isKeyword(word)) {
                        tokens.push({ type: TokenType.Keyword, value: word.toUpperCase() }); // Normalize case
                    } else if (dialect.getFunctions().includes(word.toUpperCase())) {
                        tokens.push({ type: TokenType.Function, value: word }); // Keep original case or normalize?
                    } else {
                        tokens.push({ type: TokenType.Identifier, value: word });
                    }
                    i += word.length;
                    continue;
                }
            }

            // 10. Symbols
            tokens.push({ type: TokenType.Symbol, value: char });
            i++;
        }
        return tokens;
    }

    private format(tokens: Token[], indentSize: number, dialect: Dialect): string {
        let output = "";

        let xmlDepth = 0;
        let clauseDepth = 0;
        let extraIndent = 0; // 来自括号/子查询的累积缩进

        let parenDepth = 0;
        let subqueryDepth = 0;

        const parenStack: boolean[] = [];
        const clauseStack: number[] = []; // 进入括号时保存 clauseDepth 的堆栈

        let newlineRequested = false;
        let spaceRequested = false;

        const append = (str: string) => {
            if (newlineRequested) {
                output = output.trimRight();
                output += '\n';
                // 总缩进包括 xmlDepth + extraIndent (括号的基准) + clauseDepth (当前语句部分)
                // parenDepth 主要用于行内括号的视觉效果，但对于块级子查询，我们通常重置它或通过 extraIndent 处理
                // 让我们改进:
                // 当我们要输入 (SELECT ... 时，我们将其视为一个块。
                // extraIndent 捕获该块的 '基准' 缩进级别。
                // clauseDepth 处理像 WHERE/AND 这样的关键字相对于该基准的缩进。
                const totalIndent = Math.max(0, xmlDepth + extraIndent + clauseDepth);
                output += ' '.repeat(totalIndent * indentSize);
                newlineRequested = false;
                spaceRequested = false;
            } else if (spaceRequested) {
                if (output.length > 0 && !output.endsWith(' ') && !output.endsWith('\n') && !output.endsWith('.')) {
                    output += ' ';
                }
                spaceRequested = false;
            }
            output += str;
        };

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];

            switch (token.type) {
                case TokenType.Whitespace:
                    spaceRequested = true;
                    break;
                case TokenType.Newline:
                    break;

                case TokenType.XmlProlog:
                    newlineRequested = true;
                    append(this.normalizeProlog(token.value));
                    newlineRequested = true;
                    break;

                case TokenType.XmlComment:
                    newlineRequested = true;
                    append(this.normalizeComment(token.value));
                    newlineRequested = true;
                    break;

                case TokenType.XmlCdata:
                    append(token.value);
                    break;

                case TokenType.XmlTag:
                    // 进入/退出 XML 标签时重置 SQL 子句深度
                    clauseDepth = 0;
                    // extraIndent = 0; // 已移除以修复子查询缩进
                    // clauseStack.length = 0; // 已移除以修复子查询缩进


                    const normTag = this.normalizeTag(token.value);
                    const isClosing = normTag.startsWith('</');
                    const isSelfClosing = normTag.endsWith('/>');

                    if (isClosing) {
                        xmlDepth = Math.max(0, xmlDepth - 1);
                        newlineRequested = true; // 关闭标签在新行
                        append(normTag);
                        newlineRequested = true;
                    } else {
                        // 打开标签
                        newlineRequested = true;
                        append(normTag);
                        if (!isSelfClosing) {
                            xmlDepth++;
                        }
                        newlineRequested = true;
                    }
                    break;

                case TokenType.Keyword:
                    const kw = token.value;
                    // SQL 格式化
                    if (['SELECT', 'FROM', 'WHERE', 'GROUP', 'ORDER', 'HAVING', 'UNION', 'SET', 'VALUES', 'UPDATE', 'DELETE', 'INSERT'].includes(kw)) {
                        // 自定义 SELECT 处理以进行 AS 对齐
                        if (kw === 'SELECT') {
                            const totalIndent = Math.max(0, xmlDepth + extraIndent + clauseDepth);
                            // 尝试处理整个 SELECT 子句
                            const selectResult = this.processSelectClause(tokens, i, totalIndent, indentSize);

                            if (selectResult) {
                                // 应用格式化结果
                                if (newlineRequested) {
                                    output = output.trimRight();
                                    output += '\n';
                                    output += ' '.repeat(totalIndent * indentSize);
                                    newlineRequested = false;
                                    spaceRequested = false;
                                } else if (spaceRequested) {
                                    output += ' ';
                                    spaceRequested = false;
                                }

                                output += selectResult.text;
                                i = selectResult.nextIndex - 1; // 更新迭代器 (下一次循环将增加)

                                // 在 SELECT 子句之后，我们通常期望 FROM 或结束
                                // 为下一个 token 准备状态
                                newlineRequested = true;
                                clauseDepth = 0; // 重置子句深度
                                continue;
                            }
                        }

                        if (kw === 'GROUP' || kw === 'ORDER') {
                            clauseDepth = 0;
                            newlineRequested = true;
                            append(kw);

                            // 检查 BY
                            let k = i + 1;
                            while (k < tokens.length) {
                                const t = tokens[k];
                                if (t.type === TokenType.Keyword) {
                                    if (t.value === 'BY') {
                                        append(" BY");
                                        i = k; // 推进主循环
                                    }
                                    break;
                                }
                                if (t.type !== TokenType.Whitespace && t.type !== TokenType.Newline && t.type !== TokenType.XmlComment) {
                                    break;
                                }
                                k++;
                            }

                            clauseDepth = 1;
                            newlineRequested = true;
                        } else if (kw === 'UNION') {
                            clauseDepth = 0;
                            newlineRequested = true;
                            append(kw);

                            // 检查 ALL
                            let k = i + 1;
                            while (k < tokens.length) {
                                const t = tokens[k];
                                if (t.type === TokenType.Keyword) {
                                    if (t.value === 'ALL') {
                                        append(" ALL");
                                        i = k; // 推进主循环
                                    }
                                    break;
                                }
                                if (t.type !== TokenType.Whitespace && t.type !== TokenType.Newline && t.type !== TokenType.XmlComment) {
                                    break;
                                }
                                k++;
                            }

                            clauseDepth = 0;
                            newlineRequested = true;
                        } else {
                            // 标准子句开始
                            clauseDepth = 0;
                            newlineRequested = true;
                            append(kw);
                            clauseDepth = 1; // 子句内容缩进
                            newlineRequested = true;
                        }
                    } else if (['LEFT', 'RIGHT', 'INNER', 'OUTER', 'JOIN'].includes(kw)) {
                        if (kw === 'JOIN') {
                            const prevKw = this.findPrevKeyword(tokens, i);
                            if (['LEFT', 'RIGHT', 'INNER', 'OUTER'].includes(prevKw || '')) {
                                spaceRequested = true;
                                append(kw);
                            } else {
                                clauseDepth = 0;
                                newlineRequested = true;
                                append(kw);
                            }
                        } else {
                            clauseDepth = 0;
                            newlineRequested = true;
                            append(kw);
                        }
                    } else if (['AND', 'OR'].includes(kw)) {
                        newlineRequested = true;
                        append(kw);
                        spaceRequested = true;
                    } else if (kw === 'ON') {
                        spaceRequested = true;
                        append(kw);
                        clauseDepth = 1;
                    } else {
                        spaceRequested = true;
                        append(kw);
                    }
                    if (kw === 'BY') {
                        // 忽略
                    }
                    break;

                case TokenType.Variable:
                    append(token.value);
                    break;

                case TokenType.Symbol:
                    if (token.value === ',') {
                        append(token.value);
                        if (parenDepth > 0 && clauseStack.length === 0 /* 弱检查是否在简单括号内 */) {
                            // 在简单括号内，也许只是空格
                            // 但我们下面的括号处理逻辑会为子查询推入堆栈。
                            // 如果我们在这里，parenDepth > 0。
                            // 如果是子查询，我们可能会在子句逻辑或换行中处理逗号。
                            // 对于简单的 (a, b, c)，空格很好。
                            spaceRequested = true;
                        } else {
                            newlineRequested = true;
                        }
                    } else if (token.value === '(') {
                        const nextKw = this.findNextKeyword(tokens, i);
                        const isSubquery = nextKw === 'SELECT';

                        // 检查前一个 token 是否为函数类型以避免空格
                        // 例如 COUNT (...)
                        let prevT = i > 0 ? tokens[i - 1] : null;
                        // 向上跳过空白/注释？格式化循环线性处理 token，包括空白 token
                        // 但是等等，我们的 'tokens' 数组中有空白 token（参见 tokenize）。
                        // 如果我们正在迭代 'tokens'，i-1 可能是空白。
                        // 我们需要找到“有效”的前一个 token。
                        // 但是 'spaceRequested' 标志处理插入空格的逻辑。
                        // 问题是：spaceRequested = true 可能是由前一个 token 处理设置的。
                        // 如果前一个是 Function，它设置 spaceRequested=true??
                        // 让我们检查 'Identifier' 或 'Function' 的情况。
                        // 实际上，让我们看看我们如何处理 Function/Identifier。
                        // 情况 Function: append(val). 默认: spaceRequested=true?

                        // 检查前一个 token 以避免空格
                        // 例如 COUNT(...), OVER(...)

                        // 如果我们是 '(' 且前一个是 Function/Identifier/OVER，我们需要追溯抑制空格。
                        const prevReal = this.findPrevToken(tokens, i);
                        if (prevReal) {
                            if (prevReal.type === TokenType.Function) {
                                spaceRequested = false;
                            } else if (prevReal.type === TokenType.Identifier) {
                                // 用户定义的函数或未分类的函数 -> 无空格
                                spaceRequested = false;
                            } else if (prevReal.type === TokenType.Keyword) {
                                // 看起来像函数的特定关键字
                                if (['OVER', 'CAST', 'CONVERT', 'EXTRACT', 'TRIM', 'POSITION', 'SUBSTRING', 'OVERLAY'].includes(prevReal.value.toUpperCase())) {
                                    spaceRequested = false;
                                }
                            }
                        }

                        if (isSubquery) {
                            append(token.value);
                            subqueryDepth++;
                            parenStack.push(true);

                            // === 子查询的缩进逻辑 ===
                            // 捕获当前子句缩进 + 1 作为子查询的新 '基准'
                            // 我们希望内部 SELECT/FROM 相对于 ( 开始缩进
                            clauseStack.push(clauseDepth);
                            extraIndent += (clauseDepth + 1);
                            clauseDepth = 0; // 相对于新基准重置子句深度

                            newlineRequested = true;
                        } else {
                            parenStack.push(false);
                            append(token.value);
                        }
                        parenDepth++;
                    } else if (token.value === ')') {
                        parenDepth = Math.max(0, parenDepth - 1);
                        const wasSubquery = parenStack.pop();
                        if (wasSubquery) {
                            subqueryDepth = Math.max(0, subqueryDepth - 1);

                            // 恢复缩进
                            const savedClauseDepth = clauseStack.pop() || 0;
                            extraIndent -= (savedClauseDepth + 1);
                            clauseDepth = savedClauseDepth;

                            newlineRequested = true;
                            append(token.value);
                        } else {
                            append(token.value);
                        }
                    } else {
                        spaceRequested = true;
                        append(token.value);
                    }
                    break;

                case TokenType.Operator:
                    spaceRequested = true;
                    append(token.value);
                    spaceRequested = true;
                    break;

                case TokenType.Entity:
                    // 像运算符一样处理，但处理像 &lt;= 这样的组合情况
                    // 检查下一个 token
                    let nextT = (i + 1 < tokens.length) ? tokens[i + 1] : null;

                    spaceRequested = true;
                    append(token.value);

                    // 如果我们有 &lt;= 或 &gt;=，如果下一个 token 是 =，我们可能希望避免中间有空格
                    // 但是，&lt;= 不是标准实体。通常它是 &lt; =
                    // 我们检查此实体是否为 &lt; 或 &gt; 且下一个是 =
                    if (nextT && nextT.value === '=') {
                        // 合并: 直接追加 = 并跳过下一个 token
                        append('=');
                        i++; // 跳过 = token
                        spaceRequested = true;
                    } else {
                        spaceRequested = true;
                    }
                    break;

                default:
                    spaceRequested = true;
                    append(token.value);
                    break;
            }
        }
        return output.trim();
    }

    private findNextKeyword(tokens: Token[], index: number): string | null {
        for (let i = index + 1; i < tokens.length; i++) {
            if (tokens[i].type === TokenType.Keyword) return tokens[i].value;
            if (tokens[i].type !== TokenType.Whitespace && tokens[i].type !== TokenType.Newline && tokens[i].type !== TokenType.XmlComment) {
                return null;
            }
        }
        return null;
    }

    private findPrevKeyword(tokens: Token[], index: number): string | null {
        for (let i = index - 1; i >= 0; i--) {
            if (tokens[i].type === TokenType.Keyword) return tokens[i].value;
            if (tokens[i].type === TokenType.Symbol || tokens[i].type === TokenType.Identifier) return null;
            // 跳过注释/空白，但在其他地方停止
        }
        return null;
    }

    private findPrevToken(tokens: Token[], index: number): Token | null {
        for (let i = index - 1; i >= 0; i--) {
            const t = tokens[i];
            if (t.type !== TokenType.Whitespace && t.type !== TokenType.Newline && t.type !== TokenType.XmlComment) {
                return t;
            }
        }
        return null;
    }

    // 辅助函数：清理正则捕获的标签字符串
    private normalizeTag(raw: string): string {
        // 移除换行符并折叠空格
        let cleaned = raw.replace(/\s+/g, ' ');

        // 修复 < tag > -> <tag>
        // 正则匹配 < \/? name ...
        // 我们知道它以 < 开头
        cleaned = cleaned.replace(/^<\s*(\/?)\s*/, '<$1');

        // 修复 > 前的空格
        cleaned = cleaned.replace(/\s*(\/?)>$/, '$1>');

        // 修复属性: key = "val" -> key="val"
        // 对于正则来说这很棘手，因为我们不能触及字符串。
        // 但我们可以近似。
        // 或更简单：只需确保标签名称后有空格。

        // 提取部分: <tagname attributes...>
        // 如果是标准标签，则小写标签名？
        // 用户要求说 <select> 等。
        // 让我们把标签名部分小写。
        // 改进的正则以正确捕获属性，即使用引号
        const match = cleaned.match(/^<(\/?)([\w\.\-:]+)(.*?)(\/?)>$/);
        if (match) {
            const prefix = match[1];
            const tagName = match[2];
            let attrs = match[3];
            const suffix = match[4]; // / 或空

            let lowerTag = tagName.toLowerCase();
            // 为特定标签保留 CamelCase
            if (lowerTag === 'resultmap') lowerTag = 'resultMap';

            // 清理属性
            // 1. 移除 = 周围的空格
            // 小心不要匹配引号内的 =。
            // 简单方法：如果看起来像属性赋值，则仅将 ' = ' 替换为 '='？
            // attr = "var"
            // 我们可以使用正则迭代属性字符串
            // 注意：如果字符串包含 ' = '，这个简单的正则仍然可能由风险。
            // 但目前让我们希望它根据之前的逻辑是好的，或者改进它。
            // 最好依赖于我们修复了主解析正则的事实。
            // 清理属性
            // 1. 移除 = 周围的空格并修剪引号内的值
            attrs = attrs.replace(/(\w+)\s*=\s*"([^"]*)"/g, (m, k, v) => `${k}="${v.trim()}"`);
            attrs = attrs.replace(/(\w+)\s*=\s*'([^']*)'/g, (m, k, v) => `${k}='${v.trim()}'`);

            // 确保属性前有空格（如果有）
            if (attrs.length > 0 && !attrs.startsWith(' ')) {
                attrs = ' ' + attrs;
            }

            return `<${prefix}${lowerTag}${attrs}${suffix}>`;
        }

        return cleaned;
    }

    private normalizeProlog(raw: string): string {
        // <?xml ... ?>
        // 折叠空格
        let cleaned = raw.replace(/\s+/g, ' ');
        cleaned = cleaned.replace(/^<\s*\?\s*xml/i, '<?xml');
        cleaned = cleaned.replace(/\s*\?>$/, '?>');
        cleaned = cleaned.replace(/\s*=\s*/g, '=');
        return cleaned;
    }

    private normalizeComment(raw: string): string {
        // <!-- ... -->
        return raw.replace(/^<\s*!\s*--/, '<!--').replace(/--\s*>$/, '-->');
    }

    private processSelectClause(tokens: Token[], startIndex: number, baseIndent: number, indentSize: number): { text: string, nextIndex: number } | null {
        let i = startIndex + 1;
        const fields: Token[][] = [];
        let currentField: Token[] = [];
        let parenDepth = 0;

        // 1. 收集字段
        while (i < tokens.length) {
            const token = tokens[i];

            // 安全检查：避免可能破坏简单逻辑的复杂 XML 或行注释
            if (token.type === TokenType.XmlTag || token.type === TokenType.XmlProlog || token.type === TokenType.XmlCdata || (token.type === TokenType.XmlComment && token.value.trim().startsWith('--'))) {
                return null;
            }

            // 检查 SELECT 子句的结束
            if (parenDepth === 0) {
                if (token.type === TokenType.Keyword) {
                    // 通常开始新子句或语句的关键字
                    if (['FROM', 'WHERE', 'GROUP', 'ORDER', 'HAVING', 'UNION', 'LIMIT', 'INSERT', 'UPDATE', 'DELETE', 'SET', 'VALUES'].includes(token.value)) {
                        break;
                    }
                }
                if (token.value === ')') {
                    // 子查询结束
                    break;
                }
            }

            if (token.value === '(') parenDepth++;
            if (token.value === ')') parenDepth--;

            if (token.value === ',' && parenDepth === 0) {
                fields.push(currentField);
                currentField = [];
            } else if (token.type !== TokenType.Whitespace && token.type !== TokenType.Newline) {
                currentField.push(token);
            }

            i++;
        }

        if (currentField.length > 0) {
            fields.push(currentField);
        }

        if (fields.length === 0) return null;

        // 2. 计算对齐
        // 检查是否应该对齐：我们需要至少一个具有显式 AS 且未嵌套的字段
        // 为简单起见，我们计算所有字段的 AS 前长度。

        const processedFields = fields.map(field => {
            // 查找顶层 AS
            let asIndex = -1;
            let pDepth = 0;
            for (let k = 0; k < field.length; k++) {
                const t = field[k];
                if (t.value === '(') pDepth++;
                else if (t.value === ')') pDepth--;
                else if (t.type === TokenType.Keyword && t.value === 'AS' && pDepth === 0) {
                    asIndex = k;
                    break;
                }
            }

            if (asIndex > -1) {
                const preAsTokens = field.slice(0, asIndex);
                const preAsStr = this.formatSingleLine(preAsTokens);
                return { align: true, preAsStr, preAsLen: preAsStr.length, asIndex, tokens: field };
            } else {
                const preAsStr = this.formatSingleLine(field);
                return { align: false, preAsStr, preAsLen: preAsStr.length, asIndex: -1, tokens: field };
            }
        });

        // 确定最大长度
        // 仅考虑实际具有 AS 的字段来确定最大值，或者可能是所有字段？
        // 通常我们希望将 AS 对齐到最长表达式的右侧。
        // 如果字段没有 AS，它只是打印。
        // 但是如果我们希望 AS 对齐，我们应该找到 具有 AS 的字段 的 AS 前部分的最大长度？
        // 或者所有字段的最大长度（作为列思考）？
        // 用户请求: "同级 最大 AS 为基准对齐" -> 基于兄弟最大 AS 对齐 AS。
        // 这通常意味着找到所需的 AS 最右边位置。
        // 如果有一个没有 AS 的字段很长，它应该推动其他字段的 AS 吗？
        // 例如
        // ...
        // 通常，我们只关心具有 AS 的字段。没有 AS 的长字段不应理想地影响其他字段的 AS 对齐。
        const alignable = processedFields.filter(f => f.align);
        if (alignable.length === 0) {
            // 未找到 AS，回退到标准格式化？或者只是按原样打印？
            // 只需使用我们的单行格式化程序进行打印以保持一致
        }

        let maxPreAsLen = 0;
        if (alignable.length > 0) {
            maxPreAsLen = Math.max(...alignable.map(f => f.preAsLen));
        }

        // 3. 生成输出
        let result = "SELECT";
        const indentStr = " ".repeat((baseIndent + 1) * indentSize);

        processedFields.forEach((item, index) => {
            if (index > 0) result += ",";
            result += "\n" + indentStr;

            if (item.align) {
                const padding = Math.max(0, maxPreAsLen - item.preAsLen);
                result += item.preAsStr + " ".repeat(padding) + " AS";

                const postAsTokens = item.tokens.slice(item.asIndex + 1);
                const postAsStr = this.formatSingleLine(postAsTokens);
                result += (postAsStr.startsWith(' ') ? "" : " ") + postAsStr;
            } else {
                result += item.preAsStr;
            }
        });

        return { text: result, nextIndex: i };
    }

    private formatSingleLine(tokens: Token[]): string {
        let out = "";
        for (let i = 0; i < tokens.length; i++) {
            const t = tokens[i];
            if (i > 0) {
                const prev = tokens[i - 1];
                // 简单的空格启发式
                if (t.value === ',' || t.value === '.') {
                    // 逗号或点之前无空格
                } else if (prev.value.endsWith('.') || prev.value === '(') {
                    // 点或左括号之后无空格
                } else if (t.value === ')') {
                    // 右括号之前无空格
                } else if (t.value === '(') {
                    // 检查我们是否应该在 '(' 之前添加空格
                    let suppressSpace = false;
                    if (prev.type === TokenType.Function) {
                        suppressSpace = true;
                    } else if (prev.type === TokenType.Identifier) {
                        suppressSpace = true;
                    } else if (prev.type === TokenType.Keyword) {
                        if (['OVER', 'CAST', 'CONVERT', 'EXTRACT', 'TRIM', 'POSITION', 'SUBSTRING', 'OVERLAY'].includes(prev.value.toUpperCase())) {
                            suppressSpace = true;
                        }
                    }

                    if (!suppressSpace) {
                        out += " ";
                    }
                } else {
                    out += " ";
                }
            }
            out += t.value;
        }
        return out;
    }
}
