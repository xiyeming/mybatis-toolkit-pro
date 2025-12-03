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
        // 1. Detect if this is a SELECT block suitable for AS alignment
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
            // Note: In a real editor, indentation depth matters. 
            // Here we assume the user wants to align relative to the longest field.
            
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
}
