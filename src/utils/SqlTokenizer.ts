import { Dialect } from '../services/dialects/Dialect';

/** SQL/XML 混合词法分析器的 Token 类型 */
export enum TokenType {
    Keyword,
    Function,
    Identifier,
    String,
    Variable,   // #{...}, ${...}
    Operator,   // =, <, >, +, -, *, /
    Symbol,     // (, ), ,
    XmlTag,
    XmlComment, // <!-- ... --> 以及 SQL 行注释 --
    XmlProlog,  // <?xml ... ?>, <!DOCTYPE ...>
    XmlCdata,   // <![CDATA[ ... ]]>
    Entity,     // &lt; &gt; &amp; &apos; &quot;
    Whitespace,
    Newline
}

export interface Token {
    type: TokenType;
    value: string;
    /** 标识当前 Token 是否出现在表名上下文（FROM/JOIN/UPDATE/INTO 之后） */
    isTable?: boolean;
}

/**
 * 共享词法分析器：对 MyBatis XML 中的 SQL 进行分词。
 * - 保留原始大小写与完整空白运行，调用方可按需后处理。
 * - 识别 XML 结构（标签、注释、CDATA、实体）、MyBatis 变量、SQL 关键字/函数/标识符。
 * - 支持方言相关的引号字符与关键字/函数集合。
 */
export function tokenize(text: string, dialect: Dialect): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    const length = text.length;

    const xmlPrologRegex = /^<\s*\?\s*xml[\s\S]*?\?>/i;
    const xmlDoctypeRegex = /^<\s*!\s*DOCTYPE[\s\S]*?>/i;
    const xmlCommentRegex = /^<\s*!\s*--[\s\S]*?--\s*>/;
    const xmlCdataRegex = /^<\s*!\[CDATA\[[\s\S]*?\]\]>/i;
    // 兼容任意属性内容（含 <, > 之外的字符），只要引号配对即可
    const xmlTagRegex = /^<\s*(\/?)\s*([\w:\-\.]+)(?:[^>"']|"[^"]*"|'[^']*')*?(\/?)>/;
    const entityRegex = /^&(#x?[0-9a-fA-F]+|[a-zA-Z0-9]+);/;
    const variableRegex = /^[\#\$]\{[^\}]*\}/;
    const wordRegex = /^[\w\.]+/;

    const quoteChar = dialect.getQuoteChar();

    while (i < length) {
        const char = text[i];
        const rest = text.slice(i);

        // 1. 空白：保留完整运行（高亮需要精确位置，格式化可后处理）
        if (/\s/.test(char)) {
            const wsMatch = rest.match(/^\s+/);
            if (wsMatch) {
                // 区分换行与普通空白
                const ws = wsMatch[0];
                if (ws.includes('\n')) {
                    // 包含换行符的空白运行拆分为 Newline + Whitespace
                    const lines = ws.split(/\r\n|\r|\n/);
                    for (let li = 0; li < lines.length; li++) {
                        if (li > 0) tokens.push({ type: TokenType.Newline, value: '\n' });
                        if (lines[li].length > 0) {
                            tokens.push({ type: TokenType.Whitespace, value: lines[li] });
                        }
                    }
                } else {
                    tokens.push({ type: TokenType.Whitespace, value: ws });
                }
                i += ws.length;
                continue;
            }
            tokens.push({ type: TokenType.Whitespace, value: char });
            i++;
            continue;
        }

        // 2. XML 结构
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

        // 3. MyBatis 变量 #{...} / ${...}
        if (char === '#' || char === '$') {
            const varMatch = rest.match(variableRegex);
            if (varMatch) { tokens.push({ type: TokenType.Variable, value: varMatch[0] }); i += varMatch[0].length; continue; }
        }

        // 4. 引号包裹的标识符（方言相关）
        if (char === quoteChar || (quoteChar === ']' && char === '[')) {
            const endChar = (char === '[') ? ']' : quoteChar;
            const endIdx = rest.indexOf(endChar, 1);
            if (endIdx !== -1) {
                const tokenVal = rest.substring(0, endIdx + 1);
                tokens.push({ type: TokenType.Identifier, value: tokenVal, isTable: isTableContext(tokens) });
                i += endIdx + 1;
                continue;
            }
        }

        // 4b. 反引号（MySQL 常用，非主引号时作为标识符处理）
        if (char === '`' && quoteChar !== '`') {
            const endIdx = rest.indexOf('`', 1);
            if (endIdx !== -1) {
                const tokenVal = rest.substring(0, endIdx + 1);
                tokens.push({ type: TokenType.Identifier, value: tokenVal, isTable: isTableContext(tokens) });
                i += endIdx + 1;
                continue;
            }
        }

        // 5. 字符串字面量（单引号，处理 '' 转义与 \\' 转义）
        if (char === "'") {
            let end = 1;
            while (end < rest.length) {
                if (rest[end] === "'") {
                    if (isEscapedQuote(rest, end)) { end++; continue; }
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

        // 5b. 双引号字符串（当双引号不是标识符引号时）
        if (char === '"' && quoteChar !== '"') {
            let end = 1;
            while (end < rest.length) {
                if (rest[end] === '"') {
                    if (isEscapedQuote(rest, end)) { end++; continue; }
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

        // 6. SQL 行注释 --
        if (rest.startsWith('--')) {
            const nl = rest.indexOf('\n');
            const comment = nl === -1 ? rest : rest.substring(0, nl);
            tokens.push({ type: TokenType.XmlComment, value: comment });
            i += comment.length;
            continue;
        }

        // 7. XML 实体
        if (char === '&') {
            if (rest.startsWith('&apos;')) {
                const end = rest.indexOf('&apos;', 6);
                if (end !== -1) {
                    tokens.push({ type: TokenType.String, value: rest.substring(0, end + 6) });
                    i += end + 6;
                    continue;
                }
            }
            if (rest.startsWith('&quot;')) {
                const end = rest.indexOf('&quot;', 6);
                if (end !== -1) {
                    tokens.push({ type: TokenType.String, value: rest.substring(0, end + 6) });
                    i += end + 6;
                    continue;
                }
            }
            const entityMatch = rest.match(entityRegex);
            if (entityMatch) { tokens.push({ type: TokenType.Entity, value: entityMatch[0] }); i += entityMatch[0].length; continue; }
        }

        // 8. 多字符运算符
        if (/^(\>=|\<=|\!=|\<\>)/.test(rest)) {
            tokens.push({ type: TokenType.Operator, value: rest.substring(0, 2) });
            i += 2;
            continue;
        }

        // 9. 单词（关键字/函数/标识符）
        if (/[a-zA-Z0-9_]/.test(char)) {
            const match = rest.match(wordRegex);
            if (match) {
                const word = match[0];
                if (dialect.isKeyword(word)) {
                    tokens.push({ type: TokenType.Keyword, value: word });
                } else if (dialect.getFunctions().includes(word.toUpperCase())) {
                    tokens.push({ type: TokenType.Function, value: word });
                } else {
                    tokens.push({ type: TokenType.Identifier, value: word, isTable: isTableContext(tokens) });
                }
                i += word.length;
                continue;
            }
        }

        // 10. 单字符符号
        tokens.push({ type: TokenType.Symbol, value: char });
        i++;
    }
    return tokens;
}

/** 判断反斜杠转义：前导反斜杠数量为奇数则被转义 */
function isEscapedQuote(text: string, pos: number): boolean {
    let backslashCount = 0;
    let p = pos - 1;
    while (p >= 0 && text[p] === '\\') {
        backslashCount++;
        p--;
    }
    return backslashCount % 2 === 1;
}

/** 向后检查最近的非空白 Token 是否为表名上下文关键字（FROM/JOIN/UPDATE/INTO） */
function isTableContext(tokens: Token[]): boolean {
    for (let i = tokens.length - 1; i >= 0; i--) {
        const t = tokens[i];
        if (t.type === TokenType.Whitespace || t.type === TokenType.Newline || t.type === TokenType.XmlComment) continue;
        if (t.type === TokenType.Keyword) {
            const k = t.value.toUpperCase();
            return ['FROM', 'JOIN', 'UPDATE', 'INTO'].includes(k);
        }
        if (t.type === TokenType.Symbol && t.value === ',') {
            continue;
        }
        return false;
    }
    return false;
}
