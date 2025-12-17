
import * as vscode from 'vscode';
import { ProjectIndexer } from '../services/ProjectIndexer';
import { JavaInterface, MethodInfo } from '../types';

export class MyBatisHoverProvider implements vscode.HoverProvider {
    constructor(private indexer: ProjectIndexer) { }

    public provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Hover> {

        const range = document.getWordRangeAtPosition(position, /[\#\$]\{[^\}]+\}/);
        if (!range) return undefined;

        const text = document.getText(range);
        // 提取 #{prop} 或 ${prop} -> prop
        const cleanContent = text.substring(2, text.length - 1).trim();
        if (!cleanContent) return undefined;

        // 上下文检查：必须在 <mapper> 和 SQL 块内
        // 目前仅进行简单的正则检查，以确保我们处于可能的 SQL 上下文中
        // 或者简单地信任正则范围触发器

        // 1. 从文件获取 Namespace
        const fileText = document.getText();
        const namespaceMatch = fileText.match(/<mapper\s+namespace="([^"]+)"/);
        if (!namespaceMatch) return undefined;

        const namespace = namespaceMatch[1];
        const javaInterface = this.indexer.getJavaByNamespace(namespace);
        if (!javaInterface) return undefined;

        // 2. 识别 Method ID
        // 查找我们所在的标签。这对于全文正则来说是模糊的，但对目前来说足够了。
        // 我们查找最近的前置 <select|update|insert|delete id="...">
        const offset = document.offsetAt(position);
        const preText = fileText.substring(0, offset);

        // 匹配 id="..." 的最后一次出现，假设它属于父标签
        // 理想情况下我们解析 XML，但正则反向搜索对于简单的悬停来说更快
        const tagMatch = preText.match(/<(?:\w+)\s+(?:[^>]*?)\bid="([^"]+)"(?:[^>]*)>/g);
        if (!tagMatch || tagMatch.length === 0) return undefined;

        const lastTag = tagMatch[tagMatch.length - 1];
        const idMatch = lastTag.match(/id="([^"]+)"/);
        if (!idMatch) return undefined;

        const methodId = idMatch[1];
        const methodInfo = javaInterface.methods.get(methodId);
        if (!methodInfo) return undefined;

        // 3. 构建 Hover
        const parts = cleanContent.split('.');
        const rootParam = parts[0];
        const md = this.buildHoverMarkdown(javaInterface, methodInfo, rootParam, parts);

        if (md) {
            return new vscode.Hover(md);
        }

        return undefined;
    }

    private buildHoverMarkdown(javaInterface: JavaInterface, methodInfo: MethodInfo, rootParam: string, parts: string[]): vscode.MarkdownString | undefined {
        const md = new vscode.MarkdownString();
        md.isTrusted = true;

        let rootType = methodInfo.params.get(rootParam);
        let description = methodInfo.paramDocs.get(rootParam);
        let resolvedFieldDoc: string | undefined = undefined;
        let resolvedFieldType: string | undefined = undefined;

        // 隐式单参数
        if (!rootType && methodInfo.params.size === 1) {
            const entry = methodInfo.params.entries().next().value;
            if (entry) {
                const [singleName, singleType] = entry;
                rootType = singleType;
                rootParam = singleName;
            }
        }

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
}
