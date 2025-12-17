
// Simplified JS version

class MySQLDialect {
    getQuoteChar() { return '`'; }
    isKeyword(word) {
        // Mock keywords
        const keywords = ['SELECT', 'FROM', 'WHERE', 'AS', 'IN', 'IS', 'NULL', 'LIKE', 'AND', 'OR'];
        return keywords.includes(word.toUpperCase());
    }
    getFunctions() {
        return ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'CONCAT'];
    }
}

const TokenType = {
    Keyword: 'Keyword',
    Function: 'Function',
    Identifier: 'Identifier',
    String: 'String',
    Variable: 'Variable',
    Operator: 'Operator',
    Symbol: 'Symbol',
    XmlTag: 'XmlTag',
    Whitespace: 'Whitespace'
};

function tokenize(text, dialect) {
    const tokens = [];
    let i = 0;
    const length = text.length;

    const xmlTagRegex = /^<\s*(\/?)\s*([\w:\-\.]+)(?:[^>"']|"[^"]*"|'[^']*')*?(\/?)>/;
    const wordRegex = /^[\w\.]+/;

    const quoteChar = dialect.getQuoteChar();

    while (i < length) {
        const char = text[i];
        const rest = text.slice(i);

        if (/\s/.test(char)) {
            tokens.push({ type: TokenType.Whitespace, value: char });
            i++;
            continue;
        }

        if (char === '<') {
            let m = rest.match(xmlTagRegex);
            if (m) { tokens.push({ type: TokenType.XmlTag, value: m[0] }); i += m[0].length; continue; }
        }

        if (/[a-zA-Z0-9_]/.test(char)) {
            const match = rest.match(wordRegex);
            if (match) {
                const word = match[0];
                if (dialect.isKeyword(word)) {
                    console.log(`Matched Keyword: ${word}`);
                    tokens.push({ type: TokenType.Keyword, value: match[0] });
                } else if (dialect.getFunctions().includes(word.toUpperCase())) {
                    console.log(`Matched Function: ${word}`);
                    tokens.push({ type: TokenType.Function, value: match[0] });
                } else {
                    console.log(`Matched Identifier: ${word}`);
                    tokens.push({ type: TokenType.Identifier, value: match[0] });
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

const text = `
    select 
        pk.kind_name AS pet_kind,
        pe.name
    from pets pe
`;

console.log("Tokenizing...");
const tokens = tokenize(text, new MySQLDialect());
console.log("Done.");
