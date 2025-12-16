import * as vscode from 'vscode';
import { ProjectIndexer } from '../services/ProjectIndexer';
import { SQL_KEYWORDS, SQL_FUNCTIONS } from '../constants';
import { JavaInterface, MethodInfo } from '../types';

export class DecorationProvider implements vscode.Disposable {
    private timeout: NodeJS.Timeout | undefined = undefined;
    private activeEditor = vscode.window.activeTextEditor;
    private disposables: vscode.Disposable[] = [];

    // 装饰类型
    private tableDecorationType: vscode.TextEditorDecorationType | undefined;
    private keywordDecorationType: vscode.TextEditorDecorationType | undefined;
    private functionDecorationType: vscode.TextEditorDecorationType | undefined;
    private paramDecorationType: vscode.TextEditorDecorationType | undefined;

    private indexer: ProjectIndexer;

    constructor(indexer: ProjectIndexer) {
        this.indexer = indexer;
        // 1. 初始加载
        this.reloadDecorations();

        // 2. 事件监听器
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
     * 根据当前设置重新创建装饰类型
     */
    private reloadDecorations() {
        // 销毁旧装饰以应用新颜色
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

        // 仅处理 XML 文件
        if (doc.languageId !== 'xml') return;

        const text = doc.getText();

        const tables: vscode.DecorationOptions[] = [];
        const keywords: vscode.DecorationOptions[] = [];
        const functions: vscode.DecorationOptions[] = [];
        const params: vscode.DecorationOptions[] = [];

        // 1. 查找 SQL 块 (简化正则)
        // 匹配 <select|insert|update|delete ...> ... </...>
        const blockRegex = /<(select|insert|update|delete|sql)\b[\s\S]*?>([\s\S]*?)<\/\1>/gi;
        let blockMatch;

        while ((blockMatch = blockRegex.exec(text))) {
            const blockContent = blockMatch[2];
            const blockStartIndex = blockMatch.index + blockMatch[0].indexOf(blockContent);

            // --- 掩码策略 ---
            // 为了防止“双重渲染”或在注释/字符串内部高亮，
            // 我们创建内容的掩码版本，其中注释/字符串被替换为空格。

            // 1. 掩码注释 (/* ... */ 和 -- ...)
            // 保留偏移量以便范围计算保持有效。
            const commentRegex = /(\/\*[\s\S]*?\*\/)|(--[^\n]*)/g;
            const contentNoComments = this.maskText(blockContent, commentRegex);

            // 2. 掩码字符串 ('...') 用于关键字/表/函数
            // 我们不掩码参数，因为 ${} 经常出现在字符串内部。
            // 我们不掩码 "..." 或 `...` 因为这些通常是标识符 (表名)。
            const stringRegex = /'([^']|'')*'/g;
            const contentCodeOnly = this.maskText(contentNoComments, stringRegex);


            // --- Matching ---

            // 表: 使用仅代码内容 (标识符通常是干净的或被引用)
            // FROM/JOIN/UPDATE/INTO table_name
            const tableRegex = /(?:FROM|JOIN|UPDATE|INTO)\s+([`"']?[\w.]+(?:[`"'][\w.]+)*[`"']?)/gi;
            this.collectMatches(tableRegex, contentCodeOnly, blockStartIndex, doc, tables, 1);

            // 关键字: 使用仅代码内容
            // Comprehensive list of MySQL keywords
            const keywordRegex = new RegExp(`\\b(${SQL_KEYWORDS.join('|')})\\b`, 'gi');
            this.collectMatches(keywordRegex, contentCodeOnly, blockStartIndex, doc, keywords);

            // 函数: 使用仅代码内容
            // Comprehensive list of MySQL functions
            const funcRegex = new RegExp(`\\b(${SQL_FUNCTIONS.join('|')})\\b`, 'gi');
            this.collectMatches(funcRegex, contentCodeOnly, blockStartIndex, doc, functions, 1);

            // 参数: 使用无注释内容 (参数在字符串内有效，但在注释内无效)
            const paramRegex = /(#|\$)\{([^\}]+)\}/g;

            // 悬停上下文
            let hoverContext: { javaInterface: JavaInterface, methodInfo: MethodInfo } | undefined;

            // 1. 获取命名空间
            const namespaceMatch = text.match(/<mapper\s+namespace="([^"]+)"/);
            if (namespaceMatch) {
                const namespace = namespaceMatch[1];
                const javaInterface = this.indexer.getJavaByNamespace(namespace);
                if (javaInterface) {
                    // 2. 从块标签获取方法 ID
                    // blockMatch[0] 就像 <select id="selectById" ...> ... </select>
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

        // 3. 应用装饰
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
            // 确定特定捕获组的开始/结束
            const matchText = groupIndex === 0 ? match[0] : match[1]; // Use group 1 if specified

            if (!matchText) continue;

            // 计算相对索引
            const relativeIndex = groupIndex === 0 ? match.index : match.index + match[0].indexOf(matchText);

            const startPos = doc.positionAt(baseOffset + relativeIndex);
            const endPos = doc.positionAt(baseOffset + relativeIndex + matchText.length);

            const decoration: vscode.DecorationOptions = { range: new vscode.Range(startPos, endPos) };

            // 生成悬停 (仅针对参数)
            if (hoverContext && regex.source.includes('#')) {
                // matchText 就像 "#{dto.id}" 或 "${id}"
                // 提取属性: dto.id
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

        // 1. 确定根类型和描述
        let rootType = methodInfo.params.get(rootParam);
        let description = methodInfo.paramDocs.get(rootParam);
        let resolvedFieldDoc: string | undefined = undefined;
        let resolvedFieldType: string | undefined = undefined;

        // 隐式单参数检查
        if (!rootType && methodInfo.params.size === 1) {
            const entry = methodInfo.params.entries().next().value;
            if (entry) {
                const [singleName, singleType] = entry;
                rootType = singleType;
                rootParam = singleName;
            }
        }

        // 2. 解析嵌套属性
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

        // 3. 构建输出
        const targetProp = parts.join('.');
        md.appendMarkdown(`**MyBatis 属性**: \`${targetProp}\`\n\n`);

        if (resolvedFieldType) {
            md.appendMarkdown(`**类型**: \`${resolvedFieldType}\`\n\n`);
        } else if (rootType) {
            md.appendMarkdown(`**根类型**: \`${rootType}\`\n\n`);
        }

        if (resolvedFieldDoc) {
            md.appendMarkdown(`**描述**: ${resolvedFieldDoc}\n`);
        } else if (description) {
            md.appendMarkdown(`**参数描述**: ${description}\n`);
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