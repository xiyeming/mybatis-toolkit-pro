import * as vscode from 'vscode';
import { ProjectIndexer } from '../services/ProjectIndexer';

export class PropertyDefinitionProvider implements vscode.DefinitionProvider {
    constructor(private indexer: ProjectIndexer) { }

    public async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Definition | undefined> {
        const range = document.getWordRangeAtPosition(position);
        if (!range) return;

        const word = document.getText(range);
        const text = document.getText();
        const docOffset = document.offsetAt(position);

        // 仅在 property="..." 或 property='...' 属性值内部触发，支持跨行属性
        let isInPropertyValue = false;
        const propRegex = /property\s*=\s*(["'])([^"']*?)\1/g;
        let propMatch: RegExpExecArray | null;
        while ((propMatch = propRegex.exec(text)) !== null) {
            const openingQuotePos = propMatch.index + propMatch[0].indexOf(propMatch[1]);
            const valueStart = openingQuotePos + 1;
            const valueEnd = valueStart + propMatch[2].length;
            if (docOffset >= valueStart && docOffset <= valueEnd) {
                isInPropertyValue = true;
                break;
            }
        }
        if (!isInPropertyValue) {
            return;
        }

        // 查找包含当前 property 的父级类型（resultMap/collection/association/case）
        const parentType = this.findParentType(text, docOffset);

        if (!parentType) return;

        const javaClass = this.indexer.getClassByFullName(parentType);
        if (!javaClass) return;

        const field = javaClass.fields.get(word);
        if (field) {
            return new vscode.Location(javaClass.fileUri, new vscode.Position(field.line, 0));
        }
    }

    private findParentType(text: string, offset: number): string | undefined {
        const regex = /<\/?(resultMap|collection|association|case)\b([^>]*?)(?:\/?>)/g;
        let match;
        const stack: string[] = []; // 存储类型

        while ((match = regex.exec(text))) {
            if (match.index >= offset) break;

            const fullTag = match[0];
            const tagName = match[1];
            const attrs = match[2];
            const isClosing = fullTag.startsWith('</');
            const isSelfClosing = fullTag.endsWith('/>');

            if (isClosing) {
                if (stack.length > 0) stack.pop();
            } else if (!isSelfClosing) {
                // 打开标签
                let type = this.extractType(attrs);

                // 如果未指定类型，也许继承？(例如没有 javaType 的 association 通常意味着从字段推断，这很复杂)
                // 现在推送我们找到的或 'UNKNOWN' 以保持堆栈平衡
                // 但是等等，如果类型为 null，我们要推送吗？是的，为了匹配关闭标签。
                // 如果是 undefined，我们可以检查是否可以从堆栈顶部继承？
                // <resultMap type="A"> <association property="b"> ... </association> </resultMap>
                // 在 association 内部，类型是 "A" 中 "b" 的类型。
                // 这需要解析 "A" 中的属性 "b"。

                if (!type && stack.length > 0) {
                    // 尝试解析 'property' 属性以找到类型
                    const propMatch = /property=["']([^"']+)["']/.exec(attrs);
                    if (propMatch) {
                        // 解析类型检查逻辑... 跳过以保证速度。
                        // 使用 UNKNOWN 以避免破坏堆栈。
                        type = 'UNKNOWN';
                    }
                }

                stack.push(type || 'UNKNOWN');
            }
        }

        // 栈顶的类型是我们父容器的类型。
        // 过滤掉 UNKNOWN
        while (stack.length > 0) {
            const top = stack[stack.length - 1];
            if (top && top !== 'UNKNOWN') return top;
            stack.pop();
        }
        return undefined;
    }

    private extractType(attributes: string): string | undefined {
        const typeMatch = /type=["']([^"']+)["']/.exec(attributes);
        if (typeMatch) return typeMatch[1];

        const ofTypeMatch = /ofType=["']([^"']+)["']/.exec(attributes);
        if (ofTypeMatch) return ofTypeMatch[1];

        const javaTypeMatch = /javaType=["']([^"']+)["']/.exec(attributes);
        if (javaTypeMatch) return javaTypeMatch[1];

        return undefined;
    }
}
