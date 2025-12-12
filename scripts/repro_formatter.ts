
// Mock Enums and Interfaces
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
    Whitespace,
    Newline
}

interface Token {
    type: TokenType;
    value: string;
    line?: number;
}

// Logic copied from SqlFormattingProvider.ts
class SqlFormatter {

    public formatDocument(text: string, indentSize: number): string {
        const tokens = this.tokenize(text);
        return this.format(tokens, indentSize);
    }

    private tokenize(text: string): Token[] {
        const tokens: Token[] = [];
        let i = 0;
        const length = text.length;

        // Regular Expressions
        const xmlPrologRegex = /^<\s*\?\s*xml[\s\S]*?\?>/i;
        const xmlDoctypeRegex = /^<\s*!\s*DOCTYPE[\s\S]*?>/i;
        const xmlCommentRegex = /^<\s*!\s*--[\s\S]*?--\s*>/;
        const xmlCdataRegex = /^<\s*!\[CDATA\[[\s\S]*?\]\]>/i;
        const xmlTagRegex = /^<\s*(\/?)\s*([\w:\-\.]+)([^>]*)(\/?)>/;
        const variableRegex = /^[\#\$]\{[^\}]*\}/;
        const stringRegex = /^('[^']*'|"[^"]*")/;
        const wordRegex = /^[\w\.]+/;

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

            // 2. XML Constructs
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

            // 3. Variables
            if (char === '#' || char === '$') {
                const varMatch = rest.match(variableRegex);
                if (varMatch) { tokens.push({ type: TokenType.Variable, value: varMatch[0] }); i += varMatch[0].length; continue; }
            }

            // 4. Strings
            if (char === "'" || char === '"') {
                const strMatch = rest.match(stringRegex);
                if (strMatch) { tokens.push({ type: TokenType.String, value: strMatch[0] }); i += strMatch[0].length; continue; }
            }

            // 5. Plain Comments
            if (rest.startsWith('--')) {
                const nl = rest.indexOf('\n');
                const comment = nl === -1 ? rest : rest.substring(0, nl);
                tokens.push({ type: TokenType.XmlComment, value: comment });
                i += comment.length;
                continue;
            }

            // 6. Operators
            if (/^(\>=|\<=|\!=|\<\>)/.test(rest)) {
                tokens.push({ type: TokenType.Operator, value: rest.substring(0, 2) });
                i += 2;
                continue;
            }

            // 7. Words
            if (/[a-zA-Z0-9_]/.test(char)) {
                const match = rest.match(wordRegex);
                if (match) {
                    const word = match[0];
                    const uppercase = word.toUpperCase();
                    if ([
                        'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'UNION', 'ALL', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'ON', 'AS', 'IN', 'IS', 'NULL', 'LIKE', 'BETWEEN', 'EXISTS', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'DESC', 'ASC'
                    ].includes(uppercase)) {
                        tokens.push({ type: TokenType.Keyword, value: uppercase });
                    } else {
                        tokens.push({ type: TokenType.Identifier, value: word });
                    }
                    i += word.length;
                    continue;
                }
            }

            // 8. Symbols
            tokens.push({ type: TokenType.Symbol, value: char });
            i++;
        }
        return tokens;
    }

    private format(tokens: Token[], indentSize: number): string {
        let output = "";

        let xmlDepth = 0;
        let clauseDepth = 0;
        let parenDepth = 0;
        let subqueryDepth = 0; // Extra indent for subqueries (SELECT)

        const parenStack: boolean[] = []; // true if subquery, false if normal

        let newlineRequested = false;
        let spaceRequested = false;

        const append = (str: string) => {
            if (newlineRequested) {
                output = output.replace(/\s+$/, ''); // trimRight
                output += '\n';
                // Indent calculation: 
                // xmlDepth: base XML indent
                // clauseDepth: 0 or 1 (keywords vs content)
                // parenDepth: standard indent for being inside parens (params or subqueries)
                // subqueryDepth: EXTRA indent to make subqueries stand out
                const totalIndent = Math.max(0, xmlDepth + clauseDepth + parenDepth + subqueryDepth);
                output += ' '.repeat(totalIndent * indentSize);
                newlineRequested = false;
                spaceRequested = false;
            } else if (spaceRequested) {
                if (output.length > 0 && !output.endsWith(' ') && !output.endsWith('\n')) {
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
                    clauseDepth = 0;
                    const normTag = this.normalizeTag(token.value);
                    const isClosing = normTag.startsWith('</');
                    const isSelfClosing = normTag.endsWith('/>');

                    if (isClosing) {
                        xmlDepth = Math.max(0, xmlDepth - 1);
                        newlineRequested = true;
                        append(normTag);
                        newlineRequested = true;
                    } else {
                        newlineRequested = true;
                        append(normTag);
                        if (!isSelfClosing) xmlDepth++;
                        newlineRequested = true;
                    }
                    break;

                case TokenType.Keyword:
                    const kw = token.value;
                    if (['SELECT', 'FROM', 'WHERE', 'GROUP', 'ORDER', 'HAVING', 'UNION', 'SET', 'VALUES', 'UPDATE', 'DELETE', 'INSERT'].includes(kw)) {
                        if (kw === 'GROUP' || kw === 'ORDER') {
                            newlineRequested = true;
                            clauseDepth = 0;
                            append(kw);
                        } else {
                            clauseDepth = 0;
                            newlineRequested = true;
                            append(kw);
                            clauseDepth = 1;
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
                        // Handle ORDER BY, GROUP BY logic if needed
                    }
                    break;

                case TokenType.Variable:
                    append(token.value);
                    break;

                case TokenType.Symbol:
                    if (token.value === ',') {
                        append(token.value);
                        if (parenDepth > 0) {
                            // If inside subquery, maybe newline? 
                            // For now keep space behavior unless user requested specific column list formatting, 
                            // but usually SELECT list in subquery might want newlines. 
                            // Let's stick to space for now to minimize diff, focus on indentation.
                            spaceRequested = true;
                        } else {
                            newlineRequested = true;
                        }
                    } else if (token.value === '(') {
                        // Check ahead for SELECT
                        const nextKw = this.findNextKeyword(tokens, i);
                        const isSubquery = nextKw === 'SELECT';

                        if (isSubquery) {
                            subqueryDepth++;
                            parenStack.push(true);
                            // newlineRequested = true; // Maybe not before '(', but after?
                            // User example: AND r.id IN (
                            //                     SELECT
                            append(token.value);
                            newlineRequested = true; // New line AFTER (
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
                            newlineRequested = true; // Force new line before )
                            append(token.value);
                            // newlineRequested = true; // And maybe after?
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
            // Stop at symbol or identifiers? 
            // For " ( SELECT ", we skip whitespace.
            if (tokens[i].type !== TokenType.Whitespace && tokens[i].type !== TokenType.Newline && tokens[i].type !== TokenType.XmlComment) {
                // If we hit a non-skippable that isn't the keyword we want, stop.
                // Actually we specifically look for ( SELECT. 
                // If we hit " ( something SELECT ", not a subquery start immediately.
                return null;
            }
        }
        return null;
    }

    private findPrevKeyword(tokens: Token[], index: number): string | null {
        for (let i = index - 1; i >= 0; i--) {
            if (tokens[i].type === TokenType.Keyword) return tokens[i].value;
            if (tokens[i].type === TokenType.Symbol || tokens[i].type === TokenType.Identifier) return null;
        }
        return null;
    }

    private normalizeTag(raw: string): string {
        let cleaned = raw.replace(/\s+/g, ' ');
        cleaned = cleaned.replace(/^<\s*(\/?)\s*/, '<$1');
        cleaned = cleaned.replace(/\s*(\/?)>$/, '$1>');
        const match = cleaned.match(/^<(\/?)([\w\.\-:]+)(.*?)(\/?)>$/);
        if (match) {
            const prefix = match[1];
            const tagName = match[2];
            let attrs = match[3];
            const suffix = match[4];
            let lowerTag = tagName.toLowerCase();
            if (lowerTag === 'resultmap') lowerTag = 'resultMap';
            attrs = attrs.replace(/\s*=\s*/g, '=');
            if (attrs.length > 0 && !attrs.startsWith(' ')) {
                attrs = ' ' + attrs;
            }
            return `<${prefix}${lowerTag}${attrs}${suffix}>`;
        }
        return cleaned;
    }

    private normalizeProlog(raw: string): string {
        let cleaned = raw.replace(/\s+/g, ' ');
        cleaned = cleaned.replace(/^<\s*\?\s*xml/i, '<?xml');
        cleaned = cleaned.replace(/\s*\?>$/, '?>');
        cleaned = cleaned.replace(/\s*=\s*/g, '=');
        return cleaned;
    }

    private normalizeComment(raw: string): string {
        return raw.replace(/^<\s*!\s*--/, '<!--').replace(/--\s*>$/, '-->');
    }
}

// Test Case
const inputXml = `
    <select id="selectTopPerformingRegions" resultType="map">
        SELECT
            r.region_name AS region,
            r.headquarter AS hq,
            r.sales_volume AS volume
        FROM
            regions r
        WHERE
            r.active = 1
            AND r.id IN (
            SELECT
                s.region_id
            FROM
                regional_sales s
            WHERE
                s.amount > (
                SELECT
                    AVG( amount) * 1.5
                FROM
                    regional_sales
                WHERE
                    fiscal_year = 2023 ) )
    </select>
`;

const formatter = new SqlFormatter();
const formatted = formatter.formatDocument(inputXml, 4);
console.log(formatted);
