import * as vscode from 'vscode';
import { ProjectIndexer } from '../services/ProjectIndexer';
import { JavaInterface, MethodInfo } from '../types';

export class DecorationProvider implements vscode.Disposable {
    private timeout: NodeJS.Timeout | undefined = undefined;
    private activeEditor = vscode.window.activeTextEditor;
    private disposables: vscode.Disposable[] = [];

    // Decoration Types
    private tableDecorationType: vscode.TextEditorDecorationType | undefined;
    private keywordDecorationType: vscode.TextEditorDecorationType | undefined;
    private functionDecorationType: vscode.TextEditorDecorationType | undefined;
    private paramDecorationType: vscode.TextEditorDecorationType | undefined;

    private indexer: ProjectIndexer;

    constructor(indexer: ProjectIndexer) {
        this.indexer = indexer;
        // 1. Initial Load
        this.reloadDecorations();

        // 2. Event Listeners
        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor(editor => {
                this.activeEditor = editor;
                if (editor) {
                    this.triggerUpdateDecorations();
                }
            }),
            vscode.workspace.onDidChangeTextDocument(event => {
                if (this.activeEditor && event.document === this.activeEditor.document) {
                    this.triggerUpdateDecorations();
                }
            }),
            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('mybatisToolkit.highlights')) {
                    this.reloadDecorations();
                    this.triggerUpdateDecorations();
                }
            })
        );

        if (this.activeEditor) {
            this.triggerUpdateDecorations();
        }
    }

    /**
     * Recreates decoration types based on current settings
     */
    private reloadDecorations() {
        // Dispose old decorations to apply new colors
        this.tableDecorationType?.dispose();
        this.keywordDecorationType?.dispose();
        this.functionDecorationType?.dispose();
        this.paramDecorationType?.dispose();

        const config = vscode.workspace.getConfiguration('mybatisToolkit.highlights');

        this.tableDecorationType = vscode.window.createTextEditorDecorationType({
            color: config.get('tableNameColor', '#FFAB70'), // Default Orange
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
        });

        this.keywordDecorationType = vscode.window.createTextEditorDecorationType({
            color: config.get('keywordColor', '#C586C0'), // Default Pink/Purple
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
        });

        this.functionDecorationType = vscode.window.createTextEditorDecorationType({
            color: config.get('functionColor', '#DCDCAA'), // Default Yellow/Green
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
        });

        this.paramDecorationType = vscode.window.createTextEditorDecorationType({
            color: config.get('paramColor', '#9CDCFE'), // Default Light Blue
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
        });
    }

    public triggerUpdateDecorations() {
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = undefined;
        }
        this.timeout = setTimeout(() => this.updateDecorations(), 500);
    }

    private updateDecorations() {
        if (!this.activeEditor) return;
        const doc = this.activeEditor.document;

        // Only process XML files
        if (doc.languageId !== 'xml') return;

        const text = doc.getText();

        const tables: vscode.DecorationOptions[] = [];
        const keywords: vscode.DecorationOptions[] = [];
        const functions: vscode.DecorationOptions[] = [];
        const params: vscode.DecorationOptions[] = [];

        // 1. Find SQL Blocks (Simplified Regex)
        // Matches <select|insert|update|delete ...> ... </...>
        const blockRegex = /<(select|insert|update|delete|sql)\b[\s\S]*?>([\s\S]*?)<\/\1>/gi;
        let blockMatch;

        while ((blockMatch = blockRegex.exec(text))) {
            const blockContent = blockMatch[2];
            const blockStartIndex = blockMatch.index + blockMatch[0].indexOf(blockContent);

            // --- Masking Strategy ---
            // To prevent "double rendering" or highlighting inside comments/strings,
            // we create masked versions of the content where comments/strings are replaced by spaces.

            // 1. Mask Comments (/* ... */ and -- ...)
            // Preserves offsets so range calculations remain valid.
            const commentRegex = /(\/\*[\s\S]*?\*\/)|(--[^\n]*)/g;
            const contentNoComments = this.maskText(blockContent, commentRegex);

            // 2. Mask Strings ('...') for Keywords/Tables/Functions
            // We do NOT mask params because ${} often appears inside strings.
            // We do NOT mask "..." or `...` because those are often identifiers (tables).
            const stringRegex = /'([^']|'')*'/g;
            const contentCodeOnly = this.maskText(contentNoComments, stringRegex);


            // --- Matching ---

            // Tables: Use contentCodeOnly (Identifiers are usually clean or " / ` quoted)
            // FROM/JOIN/UPDATE/INTO table_name
            const tableRegex = /(?:FROM|JOIN|UPDATE|INTO)\s+([`"']?[\w.]+(?:[`"'][\w.]+)*[`"']?)/gi;
            this.collectMatches(tableRegex, contentCodeOnly, blockStartIndex, doc, tables, 1);

            // Keywords: Use contentCodeOnly
            const keywordRegex = /\b(SELECT|FROM|WHERE|AND|OR|ORDER BY|GROUP BY|HAVING|LIMIT|OFFSET|AS|ON|SET|VALUES|LEFT|RIGHT|INNER|OUTER|JOIN|UNION|DISTINCT|CASE|WHEN|THEN|ELSE|END|IS|NULL|NOT|IN|EXISTS|LIKE|BETWEEN)\b/gi;
            this.collectMatches(keywordRegex, contentCodeOnly, blockStartIndex, doc, keywords);

            // Functions: Use contentCodeOnly
            const funcRegex = /\b(COUNT|SUM|AVG|MAX|MIN|CAST|COALESCE|CONCAT|IFNULL|NOW|DATE_FORMAT|JSON_EXTRACT|JSON_UNQUOTE|SUBSTRING|TRIM)\s*\(/gi;
            this.collectMatches(funcRegex, contentCodeOnly, blockStartIndex, doc, functions, 1);

            // Params: Use contentNoComments (Params valid inside strings, but not comments)
            const paramRegex = /(#|\$)\{([^\}]+)\}/g;

            // Context for Hover
            let hoverContext: { javaInterface: JavaInterface, methodInfo: MethodInfo } | undefined;

            // 1. Get Namespace
            const namespaceMatch = text.match(/<mapper\s+namespace="([^"]+)"/);
            if (namespaceMatch) {
                const namespace = namespaceMatch[1];
                const javaInterface = this.indexer.getJavaByNamespace(namespace);
                if (javaInterface) {
                    // 2. Get Method ID from the block tag
                    // blockMatch[0] is like <select id="selectById" ...> ... </select>
                    const idMatch = blockMatch[0].match(/id="([^"]+)"/);
                    if (idMatch) {
                        const methodId = idMatch[1];
                        const methodInfo = javaInterface.methods.get(methodId);
                        if (methodInfo) {
                            hoverContext = { javaInterface, methodInfo };
                        }
                    }
                }
            }

            this.collectMatches(paramRegex, contentNoComments, blockStartIndex, doc, params, 0, hoverContext);
        }

        // 3. Apply Decorations
        if (this.tableDecorationType) this.activeEditor.setDecorations(this.tableDecorationType, tables);
        if (this.keywordDecorationType) this.activeEditor.setDecorations(this.keywordDecorationType, keywords);
        if (this.functionDecorationType) this.activeEditor.setDecorations(this.functionDecorationType, functions);
        if (this.paramDecorationType) this.activeEditor.setDecorations(this.paramDecorationType, params);
    }

    /**
     * Replaces regex matches with spaces to preserve length/offsets.
     */
    private maskText(text: string, regex: RegExp): string {
        return text.replace(regex, (match) => ' '.repeat(match.length));
    }

    private collectMatches(
        regex: RegExp,
        content: string,
        baseOffset: number,
        doc: vscode.TextDocument,
        target: vscode.DecorationOptions[],
        groupIndex: number = 0,
        hoverContext?: { javaInterface: JavaInterface, methodInfo: MethodInfo }
    ) {
        let match;
        while ((match = regex.exec(content))) {
            // Determine start/end of the specific capture group
            const matchText = groupIndex === 0 ? match[0] : match[1]; // Use group 1 if specified

            if (!matchText) continue;

            // Calculate relative index if using a group
            const relativeIndex = groupIndex === 0 ? match.index : match.index + match[0].indexOf(matchText);

            const startPos = doc.positionAt(baseOffset + relativeIndex);
            const endPos = doc.positionAt(baseOffset + relativeIndex + matchText.length);

            const decoration: vscode.DecorationOptions = { range: new vscode.Range(startPos, endPos) };

            // Generate Hover if context is available (Only for params)
            if (hoverContext && regex.source.includes('#')) {
                // matchText is like "#{dto.id}" or "${id}"
                // Extract property: dto.id
                const fullProperty = matchText.substring(2, matchText.length - 1).trim();
                if (fullProperty) {
                    const parts = fullProperty.split('.');
                    const rootParam = parts[0];

                    const md = this.buildHoverMarkdown(hoverContext.javaInterface, hoverContext.methodInfo, rootParam, parts);
                    if (md) {
                        decoration.hoverMessage = md;
                    }
                }
            }

            target.push(decoration);
        }
    }

    private buildHoverMarkdown(javaInterface: JavaInterface, methodInfo: MethodInfo, rootParam: string, parts: string[]): vscode.MarkdownString | undefined {
        const md = new vscode.MarkdownString();
        md.isTrusted = true;
        md.supportHtml = false;

        // 1. Determine Root Type and Description
        let rootType = methodInfo.params.get(rootParam);
        let description = methodInfo.paramDocs.get(rootParam);
        let resolvedFieldDoc: string | undefined = undefined;
        let resolvedFieldType: string | undefined = undefined;

        // Implicit single param check
        if (!rootType && methodInfo.params.size === 1) {
            const entry = methodInfo.params.entries().next().value;
            if (entry) {
                const [singleName, singleType] = entry;
                rootType = singleType;
                rootParam = singleName;
            }
        }

        // 2. Resolve Nested Property
        if (rootType && (parts.length > 1 || (parts.length === 1 && parts[0] !== rootParam))) {
            let currentTypeSimple = rootType;
            let currentTypeFull = this.resolveFullName(javaInterface, currentTypeSimple);

            const startIndex = (parts[0] === rootParam) ? 1 : 0;

            for (let i = startIndex; i < parts.length; i++) {
                const propName = parts[i];
                if (!currentTypeFull) break;

                const javaClass = this.indexer.getClassByFullName(currentTypeFull);
                if (!javaClass) break;

                const field = javaClass.fields.get(propName);
                if (field) {
                    resolvedFieldType = field.type;
                    resolvedFieldDoc = field.doc;
                    currentTypeSimple = field.type;
                    currentTypeFull = this.resolveFullName(javaInterface, currentTypeSimple);
                } else {
                    resolvedFieldType = undefined;
                    resolvedFieldDoc = undefined;
                    break;
                }
            }
        }

        // 3. Construct Output
        const targetProp = parts.join('.');
        md.appendMarkdown(`**MyBatis Property**: \`${targetProp}\`\n\n`);

        if (resolvedFieldType) {
            md.appendMarkdown(`**Type**: \`${resolvedFieldType}\`\n\n`);
        } else if (rootType) {
            md.appendMarkdown(`**Root Type**: \`${rootType}\`\n\n`);
        }

        if (resolvedFieldDoc) {
            md.appendMarkdown(`**Description**: ${resolvedFieldDoc}\n`);
        } else if (description) {
            md.appendMarkdown(`**Param Description**: ${description}\n`);
        }

        return md;
    }

    private resolveFullName(iface: JavaInterface, simpleName: string): string | undefined {
        if (iface.imports.has(simpleName)) return iface.imports.get(simpleName);
        if (['String', 'Long', 'Integer', 'Boolean', 'Byte', 'Double', 'Float', 'Short', 'Character'].includes(simpleName)) return `java.lang.${simpleName}`;
        if (iface.fullName) {
            const pkg = iface.fullName.substring(0, iface.fullName.lastIndexOf('.'));
            return `${pkg}.${simpleName}`;
        }
        return undefined;
    }

    public dispose() {
        this.tableDecorationType?.dispose();
        this.keywordDecorationType?.dispose();
        this.functionDecorationType?.dispose();
        this.paramDecorationType?.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}