import * as vscode from 'vscode';

export class SqlFormattingProvider implements vscode.DocumentFormattingEditProvider {

    public provideDocumentFormattingEdits(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken): vscode.TextEdit[] {
        const edits: vscode.TextEdit[] = [];
        const content = document.getText();
        const indentSize = vscode.workspace.getConfiguration('mybatisToolkit').get('formatting.indentSize', 2);

        // Split by line
        const lines = content.split('\n');

        let inSqlBlock = false;
        let sqlBuffer: { text: string; index: number }[] = [];

        // Regex to identify start/end of SQL bearing tags
        // This is a simplified approach. A full XML parser is safer but regex is requested/faster for simple cases.
        const startTag = /<(select|insert|update|delete|sql)/;
        const endTag = /<\/(select|insert|update|delete|sql)>/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Basic XML Indentation Logic would go here (omitted for brevity to focus on SQL specific reqs)

            if (startTag.test(line)) {
                inSqlBlock = true;
                continue; // Skip the opening tag line for SQL formatting
            }
            if (endTag.test(line)) {
                if (inSqlBlock && sqlBuffer.length > 0) {
                    this.processSqlBlock(sqlBuffer, edits, indentSize, document);
                    sqlBuffer = [];
                }
                inSqlBlock = false;
                continue;
            }

            if (inSqlBlock) {
                // Collect lines within the block that contain SELECT fields
                // We mainly target the "SELECT ... FROM" area for AS alignment
                if (line.trim().length > 0) {
                    sqlBuffer.push({ text: line, index: i });
                }
            }
        }

        return edits;
    }

    private processSqlBlock(buffer: { text: string; index: number }[], edits: vscode.TextEdit[], indentSize: number, doc: vscode.TextDocument) {
        // 1. Process AS Alignment
        this.alignAsKeywords(buffer, edits, doc);

        // 2. Process Logical Operator Alignment (River Style)
        this.alignLogicalOperators(buffer, edits, indentSize, doc);
    }

    private alignAsKeywords(buffer: { text: string; index: number }[], edits: vscode.TextEdit[], doc: vscode.TextDocument) {
        // Simple heuristic: look for lines containing ' as ' (case insensitive)
        const asRegex = /\s+as\s+/i;
        const candidates = buffer.filter(l => asRegex.test(l.text));

        if (candidates.length < 2) return; // Not enough lines to align

        // 2. Calculate the position of 'AS'
        // Strategy: Split into [Left Part] AS [Alias]
        // Find max length of [Left Part]

        let maxLeftLength = 0;
        const parsedLines = candidates.map(item => {
            // Greedy match for last 'AS' to handle CAST(... AS type) AS alias
            const text = item.text;
            const lastAsIndex = text.toLowerCase().lastIndexOf(' as ');

            if (lastAsIndex === -1) return null;

            const preAs = text.substring(0, lastAsIndex).trimEnd(); // Keep leading indentation
            const postAs = text.substring(lastAsIndex + 4).trimStart(); // ' as ' is 4 chars

            // Calculate visual length of preAs (assuming tabs are spaces for calculation)
            if (preAs.length > maxLeftLength) maxLeftLength = preAs.length;

            return {
                originalIndex: item.index,
                preAs,
                postAs
            };
        });

        // 3. Generate Edits
        parsedLines.forEach(p => {
            if (!p) return;

            // Pad spaces
            const padding = ' '.repeat(maxLeftLength - p.preAs.length + 1); // +1 for spacing
            const newText = `${p.preAs}${padding}AS ${p.postAs}`;

            const lineRange = doc.lineAt(p.originalIndex).range;
            if (doc.getText(lineRange) !== newText) {
                edits.push(vscode.TextEdit.replace(lineRange, newText));
            }
        });
    }

    private alignLogicalOperators(buffer: { text: string; index: number }[], edits: vscode.TextEdit[], indentSize: number, doc: vscode.TextDocument) {
        // State for context tracking
        let depth = 0;
        const anchors = new Map<number, number>(); // Depth -> Visual Column Index of WHERE/ON/HAVING

        buffer.forEach(item => {
            const originalText = item.text;
            // 1. Strip strings/comments for parsing safely (simplified)
            // Remove contents of single quoted strings
            const codeText = originalText.replace(/'[^']*'/g, "''");

            // 2. Check if line starts with AND/OR (Logic Application)
            const trimmedLeft = originalText.trimLeft();
            const leadingSpaces = originalText.length - trimmedLeft.length;
            const upper = trimmedLeft.split(' ')[0].toUpperCase();

            if (upper === 'AND' || upper === 'OR') {
                // Determine which anchor to use
                // Look for closest anchor from current depth down to 0
                let anchorCol = -1;
                for (let d = depth; d >= 0; d--) {
                    if (anchors.has(d)) {
                        anchorCol = anchors.get(d)!;
                        break;
                    }
                }

                // Apply alignment if anchor is found
                if (anchorCol !== -1) {
                    const isAnd = upper === 'AND';
                    // Target: Right align to WHERE (5 chars)
                    // AnchorCol points to 'W' of WHERE.
                    // AND (3) -> Anchor + 2
                    // OR (2) -> Anchor + 3

                    const newIndent = anchorCol + (isAnd ? 2 : 3);
                    // If calculated indent is valid (>=0)
                    if (newIndent >= 0) {
                        const padding = ' '.repeat(newIndent);
                        // Reconstruct line
                        // Remove old operator from start
                        const content = trimmedLeft.substring(upper.length).trim();
                        const opWithSpace = content.length > 0 ? `${upper} ` : upper;
                        const newLine = `${padding}${opWithSpace}${content}`;

                        const lineRange = doc.lineAt(item.index).range;
                        if (doc.getText(lineRange) !== newLine) {
                            edits.push(vscode.TextEdit.replace(lineRange, newLine));
                        }
                    }
                }
            }

            // 3. Update Context (Parsing)
            // We search for keywords and parenthesis in order of appearance
            const regex = /(\bWHERE\b|\bON\b|\bHAVING\b|\(|\))/gi;
            let match;
            while ((match = regex.exec(codeText)) !== null) {
                const token = match[0].toUpperCase();
                const index = match.index; // 0-based index in the line string

                if (token === '(') {
                    depth++;
                } else if (token === ')') {
                    depth = Math.max(0, depth - 1);
                    // Optional: Clear anchor for this depth which is now closed?
                    // Usually safer to keep it or let it be overwritten.
                    // But if we close a subquery, the previous anchor at that depth is irrelevant for the next usage of that depth?
                    anchors.delete(depth + 1); // Clean up deeper levels
                } else {
                    // WHERE / ON / HAVING
                    // Set anchor for current depth
                    anchors.set(depth, index);
                }
            }
        });
    }
}

