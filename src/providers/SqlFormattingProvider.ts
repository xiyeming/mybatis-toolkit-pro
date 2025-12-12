import * as vscode from 'vscode';

// Token Types
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

    public provideDocumentFormattingEdits(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken): vscode.TextEdit[] {
        const text = document.getText();
        const indentSize = options.tabSize;

        // 1. Tokenize
        const tokens = this.tokenize(text);

        // 2. Format
        const formattedText = this.format(tokens, indentSize);

        // 3. Return Edit (Replace Full Text)
        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(text.length)
        );
        return [vscode.TextEdit.replace(fullRange, formattedText)];
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

        // Tag regex: Robust matching for < tag ... > including across lines, handling quoted strings containing >
        const xmlTagRegex = /^<\s*(\/?)\s*([\w:\-\.]+)(?:[^>"']|"[^"]*"|'[^']*')*?(\/?)>/;

        // Entity regex: &name; or &#123; or &#x123;
        const entityRegex = /^&(#x?[0-9a-fA-F]+|[a-zA-Z0-9]+);/;

        const variableRegex = /^[\#\$]\{[^\}]*\}/;
        // String regex: Allow single and double quotes
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

            // 2. XML Constructs (Start with <)
            if (char === '<') {
                // Prolog (?xml)
                let m = rest.match(xmlPrologRegex);
                if (m) {
                    tokens.push({ type: TokenType.XmlProlog, value: m[0] });
                    i += m[0].length;
                    continue;
                }

                // Doctype (!DOCTYPE)
                m = rest.match(xmlDoctypeRegex);
                if (m) {
                    tokens.push({ type: TokenType.XmlProlog, value: m[0] });
                    i += m[0].length;
                    continue;
                }

                // Comment (!--)
                m = rest.match(xmlCommentRegex);
                if (m) {
                    tokens.push({ type: TokenType.XmlComment, value: m[0] });
                    i += m[0].length;
                    continue;
                }

                // CDATA (![CDATA[)
                m = rest.match(xmlCdataRegex);
                if (m) {
                    tokens.push({ type: TokenType.XmlCdata, value: m[0] });
                    i += m[0].length;
                    continue;
                }

                // Tags
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

            // 4. Strings (Single and Double Quotes)
            if (char === "'" || char === '"') {
                const strMatch = rest.match(stringRegex);
                if (strMatch) {
                    tokens.push({ type: TokenType.String, value: strMatch[0] });
                    i += strMatch[0].length;
                    continue;
                }
            }

            // 5. Plain Comments (SQL -- style, in case user mixes)
            if (rest.startsWith('--')) {
                const nl = rest.indexOf('\n');
                const comment = nl === -1 ? rest : rest.substring(0, nl);
                tokens.push({ type: TokenType.XmlComment, value: comment });
                i += comment.length;
                continue;
            }

            // 6. XML Entities (Start with &)
            if (char === '&') {
                // Check for Entity-quoted strings first
                // &apos;...&apos;
                if (rest.startsWith('&apos;')) {
                    const end = rest.indexOf('&apos;', 6);
                    if (end !== -1) {
                        tokens.push({ type: TokenType.String, value: rest.substring(0, end + 6) });
                        i += end + 6;
                        continue;
                    }
                }
                // &quot;...&quot;
                if (rest.startsWith('&quot;')) {
                    const end = rest.indexOf('&quot;', 6);
                    if (end !== -1) {
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

            // 7. Operators Multi-char
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
        let extraIndent = 0; // Cumulative indent from parens/subqueries

        let parenDepth = 0;
        let subqueryDepth = 0;

        const parenStack: boolean[] = [];
        const clauseStack: number[] = []; // Stack to save clauseDepth when entering parens

        let newlineRequested = false;
        let spaceRequested = false;

        const append = (str: string) => {
            if (newlineRequested) {
                output = output.trimRight();
                output += '\n';
                // Total indent includes xmlDepth + extraIndent (base from parens) + clauseDepth (current statement part)
                // parenDepth is mostly visual for inline parens, but for block subqueries we often reset it or handle via extraIndent
                // Let's refine:
                // When we enter (SELECT ..., we treat it as a block.
                // extraIndent captures the 'base' indent level of that block.
                // clauseDepth handles indenting keywords like WHERE/AND relative to that base.
                const totalIndent = Math.max(0, xmlDepth + extraIndent + clauseDepth);
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
                    // Reset SQL clause depth when entering/exiting XML tags
                    clauseDepth = 0;
                    // extraIndent = 0; // Removed to fix subquery indentation
                    // clauseStack.length = 0; // Removed to fix subquery indentation


                    const normTag = this.normalizeTag(token.value);
                    const isClosing = normTag.startsWith('</');
                    const isSelfClosing = normTag.endsWith('/>');

                    if (isClosing) {
                        xmlDepth = Math.max(0, xmlDepth - 1);
                        newlineRequested = true; // Closing tag on new line
                        append(normTag);
                        newlineRequested = true;
                    } else {
                        // Opening tag
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
                    // SQL formatting
                    if (['SELECT', 'FROM', 'WHERE', 'GROUP', 'ORDER', 'HAVING', 'UNION', 'SET', 'VALUES', 'UPDATE', 'DELETE', 'INSERT'].includes(kw)) {
                        // Custom SELECT processing for AS alignment
                        if (kw === 'SELECT') {
                            const totalIndent = Math.max(0, xmlDepth + extraIndent + clauseDepth);
                            // Attempt to process the whole SELECT clause
                            const selectResult = this.processSelectClause(tokens, i, totalIndent, indentSize);

                            if (selectResult) {
                                // Apply the formatted result
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
                                i = selectResult.nextIndex - 1; // Update iterator (will increment next loop)

                                // After SELECT clause, we usually expect FROM or end
                                // Prepare state for next token
                                newlineRequested = true;
                                clauseDepth = 0; // Reset clause depth
                                continue;
                            }
                        }

                        if (kw === 'GROUP' || kw === 'ORDER') {
                            newlineRequested = true;
                            clauseDepth = 1;
                            append(kw);
                        } else if (kw === 'UNION') {
                            clauseDepth = 0;
                            newlineRequested = true;
                            append(kw);

                            // Check for ALL
                            let k = i + 1;
                            while (k < tokens.length) {
                                const t = tokens[k];
                                if (t.type === TokenType.Keyword) {
                                    if (t.value === 'ALL') {
                                        append(" ALL");
                                        i = k; // Advance main loop
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
                            // Standard clause start
                            clauseDepth = 0;
                            newlineRequested = true;
                            append(kw);
                            clauseDepth = 1; // Content of clause indented
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
                        // ignore
                    }
                    break;

                case TokenType.Variable:
                    append(token.value);
                    break;

                case TokenType.Symbol:
                    if (token.value === ',') {
                        append(token.value);
                        if (parenDepth > 0 && clauseStack.length === 0 /* weak check if inside simple parents */) {
                            // Inside simple parens, maybe just space
                            // But our paren processing logic below pushes to stack for subqueries.
                            // If we are here, parenDepth > 0.
                            // If it's a subquery, we likely handle comma in the clause logic or new lines.
                            // For simple (a, b, c), space is fine.
                            spaceRequested = true;
                        } else {
                            newlineRequested = true;
                        }
                    } else if (token.value === '(') {
                        const nextKw = this.findNextKeyword(tokens, i);
                        const isSubquery = nextKw === 'SELECT';

                        if (isSubquery) {
                            append(token.value);
                            subqueryDepth++;
                            parenStack.push(true);

                            // === Indentation Logic for Subquery ===
                            // Capture current clause indent + 1 as the new 'base' for the subquery
                            // We want the inner SELECT/FROM to start indented relative to the (
                            clauseStack.push(clauseDepth);
                            extraIndent += (clauseDepth + 1);
                            clauseDepth = 0; // Reset clause depth relative to new base

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

                            // Restore indentation
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
                    // Treat like operator, but handle combined cases like &lt;=
                    // check next token
                    let nextT = (i + 1 < tokens.length) ? tokens[i + 1] : null;

                    spaceRequested = true;
                    append(token.value);

                    // If we have &lt;= or &gt;=, we might want to avoid space in between if the next token is =
                    // However, &lt;= is not a standard entity. Usually it is &lt; =
                    // We check if this entity is &lt; or &gt; and next is =
                    if (nextT && nextT.value === '=') {
                        // MERGE: Append = directly and skip next token
                        append('=');
                        i++; // Skip the = token
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
            // Skip comments/whitespace, but stop at other things
        }
        return null;
    }

    // Helper to clean up tag strings caught by regex
    private normalizeTag(raw: string): string {
        // Remove newlines and collapse spaces
        let cleaned = raw.replace(/\s+/g, ' ');

        // Fix < tag > -> <tag>
        // Regex matched < \/? name ...
        // We know it starts with <
        cleaned = cleaned.replace(/^<\s*(\/?)\s*/, '<$1');

        // Fix space before >
        cleaned = cleaned.replace(/\s*(\/?)>$/, '$1>');

        // Fix attributes: key = "val" -> key="val"
        // This is tricky with regex because we must not touch strings.
        // But we can approximate.
        // Or simpler: Just ensure space after Tag Name.

        // Extract parts: <tagname attributes...>
        // Lowercase the tagname if it's a standard one? 
        // User requirements say <select> etc.
        // Let's lowercase the tagname part.
        // Improved regex to capture attributes correctly even with quotes
        const match = cleaned.match(/^<(\/?)([\w\.\-:]+)(.*?)(\/?)>$/);
        if (match) {
            const prefix = match[1];
            const tagName = match[2];
            let attrs = match[3];
            const suffix = match[4]; // / or empty

            let lowerTag = tagName.toLowerCase();
            // Preserve CamelCase for specific tags
            if (lowerTag === 'resultmap') lowerTag = 'resultMap';

            // Clean attributes
            // 1. Remove space around =
            // Be careful not to match = inside quotes.
            // Simple approach: Replace ' = ' with '=' only if it looks like attr assignment?
            // attr = "val"
            // We can iterate over attribute string with regex
            // NOTE: This simple regex might still be risky if strings contain ' = '. 
            // But for now let's hope it's fine as per previous logic, or improve it.
            // Better to rely on the fact that we fixed the main parsing regex.
            // Clean attributes
            // 1. Remove space around = and trim value inside quotes
            attrs = attrs.replace(/(\w+)\s*=\s*"([^"]*)"/g, (m, k, v) => `${k}="${v.trim()}"`);
            attrs = attrs.replace(/(\w+)\s*=\s*'([^']*)'/g, (m, k, v) => `${k}='${v.trim()}'`);

            // Ensure space before attrs if any
            if (attrs.length > 0 && !attrs.startsWith(' ')) {
                attrs = ' ' + attrs;
            }

            return `<${prefix}${lowerTag}${attrs}${suffix}>`;
        }

        return cleaned;
    }

    private normalizeProlog(raw: string): string {
        // <?xml ... ?>
        // Collapse spaces
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

        // 1. Collect fields
        while (i < tokens.length) {
            const token = tokens[i];

            // Safety check: avoid complex XML or line comments that might break simple logic
            if (token.type === TokenType.XmlTag || token.type === TokenType.XmlProlog || token.type === TokenType.XmlCdata || (token.type === TokenType.XmlComment && token.value.trim().startsWith('--'))) {
                return null;
            }

            // Check for end of SELECT clause
            if (parenDepth === 0) {
                if (token.type === TokenType.Keyword) {
                    // Keywords that typically start a new clause or statement
                    if (['FROM', 'WHERE', 'GROUP', 'ORDER', 'HAVING', 'UNION', 'LIMIT', 'INSERT', 'UPDATE', 'DELETE', 'SET', 'VALUES'].includes(token.value)) {
                        break;
                    }
                }
                if (token.value === ')') {
                    // End of subquery
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

        // 2. Calculate alignment
        // Check if we should align: we need at least one field with explicit AS that is not nested 
        // For simplicity, we calculate Pre-AS length for all fields.

        const processedFields = fields.map(field => {
            // Find Top-Level AS
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

        // Determine Max Length
        // Only consider fields that actually have AS for determining the max, or maybe all fields?
        // Usually we want to align AS to the right of the longest expression.
        // If a field doesn't have AS, it just prints.
        // But if we want AS to align, we should find max len of Pre-AS parts of fields THAT HAVE AS?
        // Or max len of ALL fields (thinking as columns)?
        // User request: "同级 最大 AS 为基准对齐" -> Align AS based on sibling max AS.
        // This usually implies finding the rightmost AS position needed.
        // If there is a field *without* AS that is very long, should it push the AS of other fields?
        // e.g.
        // very_long_field_without_as
        // short AS s
        //
        // vs
        //
        // very_long_field_without_as
        // short                    AS s
        //
        // Typically, we only care about fields WITH AS. Long fields without AS shouldn't affect AS alignment of others ideally.
        const alignable = processedFields.filter(f => f.align);
        if (alignable.length === 0) {
            // No AS found, fallback to standard formatting? Or just print as is?
            // Just print using our single line formatter to be consistent
        }

        let maxPreAsLen = 0;
        if (alignable.length > 0) {
            maxPreAsLen = Math.max(...alignable.map(f => f.preAsLen));
        }

        // 3. Generate Output
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
                // Simple heuristic for spacing
                if (t.value === ',' || t.value === '.') {
                    // No space before comma or dot
                } else if (prev.value === '.' || prev.value === '(') {
                    // No space after dot or open paren
                } else if (t.value === ')') {
                    // No space before close paren
                } else {
                    out += " ";
                }
            }
            out += t.value;
        }
        return out;
    }
}
