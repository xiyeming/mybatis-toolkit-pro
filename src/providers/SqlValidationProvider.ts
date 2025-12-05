import * as vscode from 'vscode';
import { DatabaseService } from '../services/DatabaseService';
import { SQL_KEYWORDS, SQL_FUNCTIONS } from '../constants';

export class SqlValidationProvider implements vscode.Disposable {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private dbService: DatabaseService;
    private timeout: NodeJS.Timeout | undefined = undefined;

    constructor(dbService: DatabaseService) {
        this.dbService = dbService;
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('mybatis-sql');

        // Re-validate when DB is ready
        this.dbService.onDidReady(() => {
            if (vscode.window.activeTextEditor) {
                this.triggerUpdateDiagnostics(vscode.window.activeTextEditor.document);
            }
            // Also update for all visible editors
            vscode.window.visibleTextEditors.forEach(editor => {
                this.triggerUpdateDiagnostics(editor.document);
            });
        });
    }

    public triggerUpdateDiagnostics(document: vscode.TextDocument) {
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = undefined;
        }
        this.timeout = setTimeout(() => this.updateDiagnostics(document), 500);
    }

    public async updateDiagnostics(document: vscode.TextDocument) {
        if (document.languageId !== 'xml') return;

        // Check if validation is enabled
        const config = vscode.workspace.getConfiguration('mybatisToolkit.validation');
        if (!config.get<boolean>('enable', true)) {
            this.diagnosticCollection.clear();
            return;
        }

        // Only validate if connected AND ready (tables fetched)
        if (!this.dbService.isConnected() || !this.dbService.isReady()) {
            // Do not clear diagnostics here, as we might be waiting for connection
            // Clearing them would cause flickering or remove valid errors during reconnect
            return;
        }

        const diagnostics: vscode.Diagnostic[] = [];
        const text = document.getText();

        // 1. Mask XML tags AND MyBatis params to isolate SQL
        let sqlOnly = text.replace(/<[^>]+>/g, (match) => ' '.repeat(match.length));
        sqlOnly = sqlOnly.replace(/([#$]\{[^}]+\})/g, (match) => ' '.repeat(match.length));

        // 1.1 Mask String Literals (Single and Double Quotes) to avoid parsing content as identifiers
        // Regex matches 'string' or "string", handling escaped quotes
        sqlOnly = sqlOnly.replace(/(['"])(?:(?!\1|\\).|\\.)*\1/g, (match) => ' '.repeat(match.length));

        // 1.2 Mask XML Entities (e.g. &lt; &gt; &amp;) to avoid parsing 'lt', 'gt' as columns
        sqlOnly = sqlOnly.replace(/&[a-z]+;/g, (match) => ' '.repeat(match.length));

        // 2. Find all tables AND aliases in the document
        // Matches: FROM table [AS] alias, JOIN table [AS] alias
        const tableRegex = /(?:FROM|JOIN|UPDATE|INTO)\s+([`"']?[\w.]+(?:[`"'][\w.]+)*[`"']?)(?:\s+(?:AS\s+)?([a-zA-Z_]\w*))?/gi;
        const tables = new Set<string>();
        const aliases = new Set<string>();
        const validTables = new Set<string>(); // Tables confirmed to exist in DB

        let match;
        while ((match = tableRegex.exec(sqlOnly))) {
            const rawTableName = match[1];
            const tableName = rawTableName.replace(/[`"']/g, '');

            if (!tableName.includes('#{') && !tableName.includes('${')) {
                tables.add(tableName);

                // Validate Table Existence
                if (this.dbService.hasTable(tableName)) {
                    validTables.add(tableName);
                } else {
                    // Report Table Not Found
                    const startPos = document.positionAt(match.index + match[0].indexOf(rawTableName));
                    const endPos = document.positionAt(match.index + match[0].indexOf(rawTableName) + rawTableName.length);
                    const range = new vscode.Range(startPos, endPos);

                    const diagnostic = new vscode.Diagnostic(
                        range,
                        `Table '${tableName}' not found in database.`,
                        vscode.DiagnosticSeverity.Error
                    );
                    diagnostic.source = 'MyBatis Toolkit';
                    diagnostics.push(diagnostic);
                }
            }

            // Capture alias if present
            if (match[2]) {
                const alias = match[2];
                // Exclude keywords if they are mistakenly matched as aliases (e.g. FROM table WHERE)
                if (!SQL_KEYWORDS.includes(alias.toUpperCase())) {
                    aliases.add(alias);
                }
            }
        }

        // 2.1 Find column aliases (AS alias)
        // Matches: AS alias, AS 'alias', AS "alias"
        const columnAliasRegex = /\bAS\s+([`"']?)([a-zA-Z_]\w*)\1/gi;
        while ((match = columnAliasRegex.exec(sqlOnly))) {
            const alias = match[2];
            if (!SQL_KEYWORDS.includes(alias.toUpperCase())) {
                aliases.add(alias);
            }
        }

        // 2.2 Find subquery/derived table aliases
        // Matches: ) alias, ) AS alias
        const subqueryAliasRegex = /\)\s+(?:AS\s+)?([a-zA-Z_]\w*)/gi;
        while ((match = subqueryAliasRegex.exec(sqlOnly))) {
            const alias = match[1];
            if (!SQL_KEYWORDS.includes(alias.toUpperCase())) {
                aliases.add(alias);
            }
        }

        // 3. Fetch columns for VALID tables only
        const validColumns = new Set<string>();
        for (const table of validTables) {
            const columns = await this.dbService.getTableSchema(table);
            columns.forEach(c => validColumns.add(c.Field.toLowerCase()));
        }

        // 4. Scan for identifiers that look like columns
        // Only proceed if we have at least one valid table to check against.
        // If no tables are found (or all are invalid), skipping column check prevents noise.
        if (validTables.size > 0) {
            const identifierRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;

            // Re-run identifier scan on fully masked text
            while ((match = identifierRegex.exec(sqlOnly))) {
                const word = match[1];
                const lowerWord = word.toLowerCase();

                // Filter out keywords and functions
                if (SQL_KEYWORDS.includes(word.toUpperCase()) || SQL_FUNCTIONS.includes(word.toUpperCase())) {
                    continue;
                }

                // Filter out table names and aliases
                if (tables.has(word) || aliases.has(word)) continue;

                // Check if it's a valid column
                if (!validColumns.has(lowerWord)) {
                    const startPos = document.positionAt(match.index);
                    const endPos = document.positionAt(match.index + word.length);
                    const range = new vscode.Range(startPos, endPos);

                    const diagnostic = new vscode.Diagnostic(
                        range,
                        `Column '${word}' not found in tables: ${Array.from(validTables).join(', ')}`,
                        vscode.DiagnosticSeverity.Error
                    );
                    diagnostic.source = 'MyBatis Toolkit';
                    diagnostics.push(diagnostic);
                }
            }
        }

        this.diagnosticCollection.set(document.uri, diagnostics);
    }

    public dispose() {
        this.diagnosticCollection.dispose();
    }
}
