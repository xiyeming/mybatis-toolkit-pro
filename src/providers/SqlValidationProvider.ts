import * as vscode from 'vscode';
import { DatabaseService } from '../services/DatabaseService';
import { ProjectIndexer } from '../services/ProjectIndexer';
import { SQL_KEYWORDS, SQL_FUNCTIONS } from '../constants';

export class SqlValidationProvider implements vscode.Disposable {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private indexer: ProjectIndexer;
    private dbService: DatabaseService;
    private timeout: NodeJS.Timeout | undefined = undefined;

    constructor(dbService: DatabaseService, indexer: ProjectIndexer) {
        this.dbService = dbService;
        this.indexer = indexer;
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

        const diagnostics: vscode.Diagnostic[] = [];

        // --- 1. Validate Type Mappings (resultMap & resultType) ---
        await this.validateTypeMappings(document, diagnostics);

        // --- 2. Validate SQL Return Fields (Select Clause -> Java Class) ---
        await this.validateSqlFieldMappings(document, diagnostics);

        // --- 3. Validate Database Tables & Columns (Statement Scoped) ---
        if (this.dbService.isConnected() && this.dbService.isReady()) {
            await this.validateDatabaseConsistency(document, diagnostics);
        }

        // --- 4. Validate UNION Consistency ---
        this.validateUnionConsistency(document, diagnostics);

        this.diagnosticCollection.set(document.uri, diagnostics);
    }

    private async validateDatabaseConsistency(document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]) {
        const text = document.getText();

        // Regex for SQL statements
        const sqlBlockRegex = /<(select|insert|update|delete)\s+[^>]*>([\s\S]*?)<\/\1>/g;
        let blockMatch;

        while ((blockMatch = sqlBlockRegex.exec(text))) {
            const blockContent = blockMatch[2];
            const blockStartOffset = blockMatch.index + blockMatch[0].indexOf(blockContent);

            // Mask XML tags / params / strings / comments 
            let sqlOnly = blockContent.replace(/<[^>]+>/g, (m) => ' '.repeat(m.length));
            sqlOnly = sqlOnly.replace(/([#$]\{[^}]+\})/g, (m) => ' '.repeat(m.length));
            sqlOnly = sqlOnly.replace(/(['"])(?:(?!\1|\\).|\\.)*\1/g, (m) => ' '.repeat(m.length));
            sqlOnly = sqlOnly.replace(/&[a-z]+;/g, (m) => ' '.repeat(m.length));
            // Mask comments (simple -- and /* */)
            sqlOnly = sqlOnly.replace(/--.*$/gm, (m) => ' '.repeat(m.length));
            sqlOnly = sqlOnly.replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length));

            // 1. Identify Tables used IN THIS BLOCK
            const tableRegex = /(?:FROM|JOIN|UPDATE|INTO)\s+([`"']?[\w.]+(?:[`"'][\w.]+)*[`"']?)(?:\s+(?:AS\s+)?([a-zA-Z_]\w*))?/gi;
            const tables = new Set<string>();
            const aliases = new Set<string>();
            const validTables = new Set<string>();

            let match;
            while ((match = tableRegex.exec(sqlOnly))) {
                const rawTableName = match[1];
                const tableName = rawTableName.replace(/[`"']/g, ''); // strip quotes

                if (!tableName.includes(' ')) { // Simple check to avoid noise
                    tables.add(tableName);
                    if (this.dbService.hasTable(tableName)) {
                        validTables.add(tableName);
                    } else {
                        // Report Table Not Found
                        const absIndex = blockStartOffset + match.index + match[0].indexOf(rawTableName);
                        const range = new vscode.Range(
                            document.positionAt(absIndex),
                            document.positionAt(absIndex + rawTableName.length)
                        );
                        diagnostics.push(new vscode.Diagnostic(
                            range,
                            `Table '${tableName}' not found in database.`,
                            vscode.DiagnosticSeverity.Error
                        ));
                    }
                }

                if (match[2]) {
                    const alias = match[2];
                    if (!SQL_KEYWORDS.includes(alias.toUpperCase())) {
                        aliases.add(alias);
                    }
                }
            }

            // 2. Identify Aliases (Column/Subquery)
            const columnAliasRegex = /\bAS\s+([`"']?)([a-zA-Z_]\w*)\1/gi;
            while ((match = columnAliasRegex.exec(sqlOnly))) {
                const alias = match[2];
                if (!SQL_KEYWORDS.includes(alias.toUpperCase())) aliases.add(alias);
            }

            // 2b. Identify Subquery Aliases (e.g. JOIN (SELECT ...) t2 ON ...)
            // Heuristic: Closing parenthesis followed by a non-keyword identifier
            const subqueryAliasRegex = /\)\s+(?:AS\s+)?([a-zA-Z_]\w*)/gi;
            while ((match = subqueryAliasRegex.exec(sqlOnly))) {
                const alias = match[1];
                if (!SQL_KEYWORDS.includes(alias.toUpperCase())) {
                    aliases.add(alias);
                }
            }

            // 3. Fetch Schema for Valid Tables
            const validColumns = new Set<string>();
            for (const t of validTables) {
                const cols = await this.dbService.getTableSchema(t);
                cols.forEach(c => validColumns.add(c.Field.toLowerCase()));
            }

            // 4. Validate Identifiers
            if (validTables.size > 0) {
                const identifierRegex = /\b([a-zA-Z_][a-zA-Z0-9_.]*)\b/g; // Allow dots for alias.col handling
                while ((match = identifierRegex.exec(sqlOnly))) {
                    const fullWord = match[1];

                    // Split by dot (alias.col) or check raw
                    const parts = fullWord.split('.');
                    let colName = fullWord;

                    if (parts.length > 1) {
                        // t.id -> check 'id'
                        // db.t.id -> check 'id'
                        colName = parts[parts.length - 1];
                    }

                    const lowerCol = colName.toLowerCase();

                    // Skip if:
                    // 1. Keyword/Function
                    if (SQL_KEYWORDS.includes(colName.toUpperCase()) || SQL_FUNCTIONS.includes(colName.toUpperCase())) continue;
                    // 2. Is a Table or Alias
                    if (tables.has(colName) || aliases.has(colName)) continue;
                    if (parts.length > 1 && (tables.has(parts[0]) || aliases.has(parts[0]))) {
                        // It is prefix.col -> valid prefix logic handled by exclusion above?
                        // strict check: prefix must be valid alias/table
                    }

                    // 3. Validation Logic
                    if (!validColumns.has(lowerCol)) {
                        const absIndex = blockStartOffset + match.index;
                        const range = new vscode.Range(
                            document.positionAt(absIndex),
                            document.positionAt(absIndex + fullWord.length)
                        );

                        // Double check against loose aliases set?
                        // If 'ids' is alias, it should be in aliases set.
                        if (!aliases.has(colName)) {
                            diagnostics.push(new vscode.Diagnostic(
                                range,
                                `Column '${colName}' not found in tables: ${Array.from(validTables).join(', ')}`,
                                vscode.DiagnosticSeverity.Error
                            ));
                        }
                    }
                }
            }
        }
    }

    private async validateTypeMappings(document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]) {
        const text = document.getText();
        const tagRegex = /<\/?(resultMap|collection|association|id|result|case|constructor|arg)\b([^>]*?)(?:\/?>)/g;

        // Stack of types: { typeName: string, javaClass: JavaClass | undefined | null }
        // null javaClass means we couldn't resolve the type (so skip validation for this scope)
        const stack: { typeName: string, javaClass: any }[] = [];

        let match;
        while ((match = tagRegex.exec(text))) {
            const fullTag = match[0];
            const tagName = match[1];
            const attributes = match[2];
            const isClosing = fullTag.startsWith('</');
            const isSelfClosing = fullTag.endsWith('/>');
            const range = new vscode.Range(
                document.positionAt(match.index),
                document.positionAt(match.index + fullTag.length)
            );

            if (isClosing) {
                // Pop stack if it matches the current scope context
                // Note: <id>, <result> are usually self-closing or empty, 
                // but if they are explicitly closed </id>, we shouldn't pop the *Type* stack 
                // because <id> doesn't introduce a new Type scope (unless nested, which is invalid).
                // Only resultMap, collection, association introduce scopes.
                if (['resultMap', 'collection', 'association', 'case'].includes(tagName)) {
                    stack.pop();
                }
            } else {
                // Opening Tag (or Self-Closing)

                // 1. Determine if this tag introduces a new Type Scope
                let newType: string | undefined;

                if (tagName === 'resultMap') {
                    newType = this.getAttribute(attributes, 'type');
                } else if (tagName === 'collection') {
                    newType = this.getAttribute(attributes, 'ofType') || this.getAttribute(attributes, 'javaType');
                } else if (tagName === 'association') {
                    newType = this.getAttribute(attributes, 'javaType');
                } else if (tagName === 'case') {
                    newType = this.getAttribute(attributes, 'resultType');
                }

                // Push to stack if it's a scoping tag
                if (['resultMap', 'collection', 'association', 'case'].includes(tagName)) {
                    if (newType) {
                        const javaClass = this.indexer.getClassByFullName(newType);
                        stack.push({ typeName: newType, javaClass });
                    } else {
                        // Missing type info (e.g. implicit association). 
                        // For now, push null to indicate "Unknown Scope" -> Skip validation inside.
                        // Improvement: Try to infer type from parent field.
                        stack.push({ typeName: 'unknown', javaClass: null });
                    }
                }

                // 2. Validate Property (if applicable)
                // <id property="...">, <result property="...">, <collection property="...">, <association property="...">
                const property = this.getAttribute(attributes, 'property');
                if (property && stack.length > 0) {
                    // Check against the CURRENT scope (Top of stack)
                    // If we just pushed a new scope (e.g. <collection property="list" ofType="Item">),
                    // "property" belongs to the PARENT scope, not the new scope.
                    // EXCEPT if we are at the root <resultMap>, but <resultMap> has no property.

                    // Logic: The tag *itself* is a property of the *enclosing* object.
                    // So we must look at stack[stack.length - 2] if we just pushed, 
                    // OR stack[stack.length - 1] if self-closing/non-scoping.

                    // Actually, let's look at it this way:
                    // If this tag IS a scoping tag (collection/association), it was just pushed.
                    // So we check stack[stack.length - 2].
                    // If valid stack depth...

                    let parentScopeIdx = stack.length - 1;
                    if (['resultMap', 'collection', 'association', 'case'].includes(tagName) && !isClosing) {
                        // We just pushed this tag's type. The property attribute belongs to the previous type.
                        parentScopeIdx = stack.length - 2;
                    }

                    if (parentScopeIdx >= 0) {
                        const parentContext = stack[parentScopeIdx];
                        if (parentContext.javaClass) {
                            if (!this.hasFieldRecursive(parentContext.javaClass, property)) {
                                // Calculate position of 'property="val"'
                                const propMatch = new RegExp(`property=["']${property}["']`).exec(attributes);
                                if (propMatch) {
                                    const propStart = match.index + match[0].indexOf(propMatch[0]);
                                    const startPos = document.positionAt(propStart);
                                    const endPos = document.positionAt(propStart + propMatch[0].length);

                                    diagnostics.push(new vscode.Diagnostic(
                                        new vscode.Range(startPos, endPos),
                                        `Property '${property}' not found in class '${parentContext.typeName}'.`,
                                        vscode.DiagnosticSeverity.Warning
                                    ));
                                }
                            }
                        }
                    }
                }

                // Pop if self-closing scoping tag (e.g. <collection ... /> empty)
                if (isSelfClosing && ['resultMap', 'collection', 'association', 'case'].includes(tagName)) {
                    stack.pop();
                }
            }
        }
    }

    private async validateSqlFieldMappings(document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]) {
        const text = document.getText();

        // Match <select> tags
        const selectRegex = /<select\s+[^>]*>([\s\S]*?)<\/select>/g;
        let match;

        while ((match = selectRegex.exec(text))) {
            const fullTag = match[0];
            const content = match[1];
            const startOffset = match.index;
            const contentStartOffset = startOffset + fullTag.indexOf(content);

            // Extract Attributes from the opening tag
            const openTag = fullTag.substring(0, fullTag.indexOf('>') + 1);
            const resultType = this.getAttribute(openTag, 'resultType');
            const resultMap = this.getAttribute(openTag, 'resultMap');

            let targetClass: any = undefined; // JavaClass
            // Store explicitly mapped columns (whitelisted)
            const mappedColumns = new Set<string>();

            // Pre-index local ResultMaps for O(1) lookup
            const localResultMaps = new Map<string, { type: string, content: string }>();
            const resultMapRegex = /<resultMap\s+[^>]*id=["']([^"']+)["'][^>]*type=["']([^"']+)["'][^>]*>([\s\S]*?)<\/resultMap>/g;
            let rmMatch;
            while ((rmMatch = resultMapRegex.exec(text))) {
                localResultMaps.set(rmMatch[1], { type: rmMatch[2], content: rmMatch[3] });
            }

            if (resultType) {
                targetClass = this.indexer.getClassByFullName(resultType);
            } else if (resultMap) {
                // O(1) Lookup
                const rm = localResultMaps.get(resultMap);
                if (rm) {
                    targetClass = this.indexer.getClassByFullName(rm.type);

                    // Extract all column="..." from the resultMap content (deep scan)
                    const columnRegex = /column=["']([^"']+)["']/g;
                    let colMatch;
                    while ((colMatch = columnRegex.exec(rm.content))) {
                        mappedColumns.add(colMatch[1]);
                    }
                }
            }

            if (!targetClass) continue;

            // Parse SQL to find SELECT clause
            const cleanSql = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

            // Regex to capture content between SELECT and FROM
            // Non-greedy match until the first FROM that isn't inside quotes/parens (hard with regex)
            // Simplified: Assume strictly `SELECT ... FROM` pattern.
            const selectMatch = /^\s*SELECT\s+(.+?)\s+FROM\b/i.exec(cleanSql);

            if (selectMatch) {
                const columnsPart = selectMatch[1];
                const columns = this.splitColumns(columnsPart);

                let currentPos = 0; // Relative to contentStartOffset

                for (const col of columns) {
                    const cleanCol = col.trim();
                    if (!cleanCol || cleanCol === '*' || cleanCol.endsWith('.*')) continue;

                    // Extract Alias or Field Name
                    // Logic:
                    // 1. Check for explicit " AS "
                    // 2. Check for implicit alias (space separator), ignoring function parens
                    let fieldName = '';
                    let isExpression = false;

                    // Normalize quotes for processing
                    const normCol = cleanCol; // .replace(/['"`]/g, ''); // Keep quotes for precise replacement later

                    const upperCol = normCol.toUpperCase();
                    const asIndex = upperCol.lastIndexOf(' AS ');

                    if (asIndex > -1) {
                        // "table.col AS alias" or "FUNC(...) AS alias"
                        fieldName = normCol.substring(asIndex + 4).trim();
                    } else {
                        // Implicit alias or just column
                        // "table.col alias" or "table.col"
                        // If there are spaces OUTSIDE of parentheses, the last part is the alias
                        // e.g. "count(*) c" -> c
                        // e.g. "t.status" -> status

                        const lastSpace = this.lastIndexOfNotInParens(normCol, ' ');
                        if (lastSpace > -1) {
                            fieldName = normCol.substring(lastSpace + 1).trim();
                            // If the part before space ends with ')', and part after is an identifier -> Alias
                            // If part before is 't.col', part after is alias.
                        } else {
                            // No spaces outside parens -> it's just the column/expression
                            // "t.col" -> col
                            // "col" -> col
                            // "count(*)" -> Skip validation (no alias mapping)
                            if (normCol.includes('(')) {
                                isExpression = true;
                            } else {
                                const dotIndex = normCol.lastIndexOf('.');
                                if (dotIndex > -1) {
                                    fieldName = normCol.substring(dotIndex + 1);
                                } else {
                                    fieldName = normCol;
                                }
                            }
                        }
                    }

                    if (isExpression && !fieldName) continue;

                    // Clean quotes from field name
                    fieldName = fieldName.replace(/^['"`]|['"`]$/g, '');

                    // 1. Check Explicit Mapping (ResultMap)
                    if (mappedColumns.has(fieldName)) {
                        continue; // Valid
                    }

                    // 2. Check Auto-Mapping (CamelCase in Root Class)
                    const camelName = fieldName.replace(/_([a-z])/g, (g) => g[1].toUpperCase());

                    // Check existence (Recursive for inheritance)
                    if (!this.hasFieldRecursive(targetClass, camelName)) {
                        // Locate in document
                        const searchStr = col.trim();
                        let matchIndex = content.indexOf(searchStr, currentPos);

                        if (matchIndex === -1) {
                            matchIndex = content.indexOf(fieldName, currentPos);
                        }

                        if (matchIndex > -1) {
                            const absStart = contentStartOffset + matchIndex;
                            const startPos = document.positionAt(absStart);
                            const endPos = document.positionAt(absStart + searchStr.length);

                            diagnostics.push(new vscode.Diagnostic(
                                new vscode.Range(startPos, endPos),
                                `Field '${camelName}' (from '${fieldName}') not found in return type '${targetClass.name}' (or parents) and not mapped in ResultMap.`,
                                vscode.DiagnosticSeverity.Warning
                            ));

                            currentPos = matchIndex + searchStr.length;
                        }
                    }
                }
            }
        }
    }

    private hasFieldRecursive(javaClass: any, fieldName: string): boolean {
        if (!javaClass) return false;

        // 1. Check current class
        if (javaClass.fields.has(fieldName)) return true;

        // 2. Check parent class
        if (javaClass.parentClassName && javaClass.imports) {
            // Resolve Parent Full Name
            let parentFullName = javaClass.imports.get(javaClass.parentClassName);

            // If not in imports, could be in same package (implicit import)
            if (!parentFullName) {
                // Infer from same package
                const currentPackage = javaClass.fullName.substring(0, javaClass.fullName.lastIndexOf('.'));
                parentFullName = `${currentPackage}.${javaClass.parentClassName}`;
            }

            // Look up parent class
            if (parentFullName) {
                const parentClass = this.indexer.getClassByFullName(parentFullName);
                if (parentClass) {
                    return this.hasFieldRecursive(parentClass, fieldName);
                }
            }
        }

        return false;
    }

    private splitColumns(sql: string): string[] {
        const columns: string[] = [];
        let parenDepth = 0;
        let lastSplit = 0;
        let inQuote = false;
        let quoteChar = '';

        for (let i = 0; i < sql.length; i++) {
            const char = sql[i];

            if (inQuote) {
                if (char === quoteChar && sql[i - 1] !== '\\') {
                    inQuote = false;
                }
            } else {
                if (char === "'" || char === '"' || char === '`') {
                    inQuote = true;
                    quoteChar = char;
                } else if (char === '(') {
                    parenDepth++;
                } else if (char === ')') {
                    parenDepth--;
                } else if (char === ',' && parenDepth === 0) {
                    columns.push(sql.substring(lastSplit, i));
                    lastSplit = i + 1;
                }
            }
        }
        if (lastSplit < sql.length) {
            columns.push(sql.substring(lastSplit));
        }

        return columns;
    }

    private lastIndexOfNotInParens(str: string, char: string): number {
        let parenDepth = 0;
        let inQuote = false;
        let quoteChar = '';

        for (let i = str.length - 1; i >= 0; i--) {
            const c = str[i];
            if (inQuote) {
                if (c === quoteChar && str[i - 1] !== '\\') { // reverse scan escaping check is tricky but sufficient for simple cases
                    inQuote = false;
                }
            } else {
                if (c === "'" || c === '"' || c === '`') {
                    inQuote = true;
                    quoteChar = c;
                } else if (c === ')') {
                    parenDepth++;
                } else if (c === '(') {
                    parenDepth--;
                } else if (c === char && parenDepth === 0) {
                    return i;
                }
            }
        }
        return -1;
    }

    private getAttribute(attributes: string, name: string): string | undefined {
        const match = new RegExp(`${name}=["']([^"']+)["']`).exec(attributes);
        return match ? match[1] : undefined;
    }

    private validateUnionConsistency(document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]) {
        const text = document.getText();
        // Match <select> tags
        const selectRegex = /<select\s+[^>]*>([\s\S]*?)<\/select>/g;
        let match;

        while ((match = selectRegex.exec(text))) {
            const content = match[1];
            const startOffset = match.index + match[0].indexOf(content);

            // Clean content for parsing (replace XML tags but keep length)
            const cleanSql = content.replace(/<[^>]+>/g, (m) => ' '.repeat(m.length));

            const parts = this.splitByUnion(cleanSql);
            if (parts.length <= 1) continue;

            // Process first part as baseline
            const baseColumns = this.extractColumnsFromUnionPart(parts[0].content);
            if (!baseColumns) continue;

            // Compare subsequent parts
            for (let i = 1; i < parts.length; i++) {
                const part = parts[i];
                const currentColumns = this.extractColumnsFromUnionPart(part.content);

                if (!currentColumns) continue;

                const partAbsStart = startOffset + part.offset;

                // 1. Check Column Count (Error)
                if (currentColumns.length !== baseColumns.length) {
                    // Try to highlight the SELECT clause or the whole part
                    const selectIdx = part.content.toUpperCase().indexOf('SELECT');
                    const rangeStart = selectIdx > -1 ? selectIdx : 0;
                    // Highlight until FROM or end of line roughly
                    const fromIdx = part.content.toUpperCase().indexOf('FROM', rangeStart);
                    const rangeEnd = fromIdx > -1 ? fromIdx : part.content.length;

                    const range = new vscode.Range(
                        document.positionAt(partAbsStart + rangeStart),
                        document.positionAt(partAbsStart + rangeEnd)
                    );

                    diagnostics.push(new vscode.Diagnostic(
                        range,
                        `The used SELECT statements have a different number of columns (${currentColumns.length} vs ${baseColumns.length}).`,
                        vscode.DiagnosticSeverity.Error
                    ));
                    continue; // Skip name check if count is wrong
                }

                // 2. Check Column Names/Aliases (Warning)
                for (let j = 0; j < baseColumns.length; j++) {
                    const baseCol = baseColumns[j];
                    const currentCol = currentColumns[j];

                    if (baseCol.name !== currentCol.name) {
                        // Locate the column in the current part
                        // Crude location: part start + column string index
                        // Better: We parsed it, but didn't keep offset. 
                        // Let's just highlight the SELECT keyword of the part for simplicity, or re-search

                        // We can search for the raw string of the column in the part
                        const colIdx = part.content.indexOf(currentCol.raw); // This is approximate (could match elsewhere)
                        let range: vscode.Range;

                        if (colIdx > -1) {
                            range = new vscode.Range(
                                document.positionAt(partAbsStart + colIdx),
                                document.positionAt(partAbsStart + colIdx + currentCol.raw.length)
                            );
                        } else {
                            // Fallback to start of part
                            range = new vscode.Range(
                                document.positionAt(partAbsStart),
                                document.positionAt(partAbsStart + 10)
                            );
                        }

                        diagnostics.push(new vscode.Diagnostic(
                            range,
                            `Column name mismatch: '${currentCol.name}' vs '${baseCol.name}' (first SELECT). Order matters in UNION.`,
                            vscode.DiagnosticSeverity.Warning
                        ));
                    }
                }
            }
        }
    }

    private extractColumnsFromUnionPart(sql: string): { name: string, raw: string }[] | null {
        // Find SELECT ... FROM
        // Simplified regex, assumes basic structure
        const selectMatch = /^\s*SELECT\s+(.+?)\s+FROM\b/i.exec(sql);
        if (!selectMatch) return null;

        const columnsPart = selectMatch[1];
        const columns = this.splitColumns(columnsPart);

        return columns.map(col => {
            const raw = col.trim();
            const fieldName = this.extractColumnName(raw);
            return { name: fieldName, raw };
        });
    }

    private extractColumnName(col: string): string {
        // Reuse logic from validateSqlFieldMappings roughly
        let fieldName = '';
        const normCol = col;
        const upperCol = normCol.toUpperCase();
        const asIndex = upperCol.lastIndexOf(' AS ');

        if (asIndex > -1) {
            fieldName = normCol.substring(asIndex + 4).trim();
        } else {
            const lastSpace = this.lastIndexOfNotInParens(normCol, ' ');
            if (lastSpace > -1) {
                fieldName = normCol.substring(lastSpace + 1).trim();
            } else {
                if (normCol.includes('(')) {
                    // Expression without alias -> use full text as implicit name (often nondeterministic in DB, but consistent for check)
                    fieldName = normCol;
                } else {
                    const dotIndex = normCol.lastIndexOf('.');
                    if (dotIndex > -1) {
                        fieldName = normCol.substring(dotIndex + 1);
                    } else {
                        fieldName = normCol;
                    }
                }
            }
        }
        return fieldName.replace(/^['"`]|['"`]$/g, ''); // strip quotes
    }

    private splitByUnion(sql: string): { content: string, offset: number }[] {
        const parts: { content: string, offset: number }[] = [];
        let parenDepth = 0;
        let inQuote = false;
        let quoteChar = '';
        let lastSplit = 0;
        const len = sql.length;

        for (let i = 0; i < len; i++) {
            const char = sql[i];

            if (inQuote) {
                if (char === quoteChar && sql[i - 1] !== '\\') {
                    inQuote = false;
                }
            } else {
                if (char === "'" || char === '"' || char === '`') {
                    inQuote = true;
                    quoteChar = char;
                } else if (char === '(') {
                    parenDepth++;
                } else if (char === ')') {
                    parenDepth--;
                } else if (parenDepth === 0) {
                    // Check for UNION
                    // distinct check: space boundary or newline before/after
                    // Simplification: check if we match "UNION" or "UNION ALL"
                    // Optimization: check first char 'U' or 'u'
                    if (char === 'U' || char === 'u') {
                        // Look ahead
                        const rest = sql.substring(i);
                        const unionMatch = /^(UNION(?:\s+ALL)?)\b/i.exec(rest);
                        if (unionMatch) {
                            // Check previous char is whitespace or boundary
                            const prevChar = i > 0 ? sql[i - 1] : ' ';
                            if (/[\s)]/.test(prevChar)) {
                                // Found split
                                parts.push({
                                    content: sql.substring(lastSplit, i),
                                    offset: lastSplit
                                });
                                lastSplit = i + unionMatch[0].length;
                                i += unionMatch[0].length - 1; // Advance
                            }
                        }
                    }
                }
            }
        }

        if (lastSplit < len) {
            parts.push({
                content: sql.substring(lastSplit),
                offset: lastSplit
            });
        }

        return parts.filter(p => p.content.trim().length > 0);
    }

    public dispose() {
        this.diagnosticCollection.dispose();
    }
}
