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

        // 仅在 property="..." 内部触发
        const line = document.lineAt(position.line).text;
        const widthBefore = position.character;
        const prefix = line.substring(0, widthBefore);
        // 基本检查我们是否在 property="..." 内部
        // 更稳健的检查将涉及解析或检查最近的属性
        if (!/property\s*=\s*["'][^"']*$/.test(prefix) && !/^[^"']*["']/.test(line.substring(widthBefore))) {
            // 尝试查看 'word' 是否与行上的属性值正则对齐
            const propRegex = /property\s*=\s*["']([^"']+)["']/;
            const match = propRegex.exec(line);
            if (!match || match[1] !== word) {
                // 可能还需要检查嵌套文本，但让我们假设标准属性用法
                // 再次检查光标是否在值中
                const matchIndex = line.indexOf(`property="${word}"`);
                const matchIndexSingle = line.indexOf(`property='${word}'`);
                if ((matchIndex === -1 || position.character < matchIndex + 10 || position.character > matchIndex + 10 + word.length) &&
                    (matchIndexSingle === -1 || position.character < matchIndexSingle + 10 || position.character > matchIndexSingle + 10 + word.length)) {
                    return;
                }
            }
        }

        // 1. 查找父级 <resultMap> 定义
        // 我们需要从当前位置向后搜索找到 <resultMap type="...">
        // 或者如果是在 <association> 或 <collection> 内部，找到该类型。

        // 简单策略：向上遍历行以找到带有 type/ofType/javaType 的封闭标签
        // 优化：使用基于堆栈的解析器或向后正则搜索。

        let typeName: string | undefined;
        let currentLineNo = position.line;

        // 向上遍历
        const stack: string[] = [];

        while (currentLineNo >= 0) {
            const lineText = document.lineAt(currentLineNo).text;

            // 检查直接父级 (association/collection)
            // 注意：简单的行检查可能会在多行标签上失败，暂时假设单行或标准格式
            // 如果需要稳健的支持，可以使用完整的文档解析进行改进

            // 检查 resultMap 头部
            const resultMapMatch = /<resultMap\s+[^>]*type="([^"]+)"/i.exec(lineText);
            if (resultMapMatch) {
                // 我们找到了根 map。
                // 但也可能在嵌套集合中。
                // 如果我们尚未找到更近的类型，就是它了。
                if (!typeName) typeName = resultMapMatch[1];
                break;
            }

            // 检查 collection/association
            // <collection property="list" ofType="com.pkg.Item">
            // 这更难，因为我们在物理上位于标签内容 *内部*。
            // 标签开启者在我们上方。
            // 如果我们在缩进级别 X，我们查找缩进 < X 的标签。

            // 简化方法：从偏移量向后正则搜索
            currentLineNo--;
        }

        // 更好的方法：正则 Last Index
        const docOffset = document.offsetAt(position);
        const textBefore = text.substring(0, docOffset);

        // 找到最后未关闭的 <resultMap>？不，XML 更简单。
        // 我们需要定义类型的最近祖先。
        // 祖先是: <resultMap>, <collection>, <association>, <case>.

        // 我们可以使用捕获所有标签的正则并构建堆栈，
        // 但更简单的是：找到最后一个未关闭的标签。

        // 让我们依赖于查找标准 MyBatis 标签属性 `type`, `ofType`, `javaType`。
        // 我们向后扫描。我们遇到的第一个 "open" (开始标签)
        // 并且具有这些属性之一的是我们的候选者？
        // 不一定，因为我们可能正在验证兄弟节点的属性。
        // XML 是分层的。我们需要逻辑：
        // 找到我们所在的元素的开始标签。
        // 如果我们在 `<result ... property="foo"/>` 中，我们是自闭合或已关闭的。
        // 我们在显式父级内部。

        // 向后扫描没有中间匹配 `</...>` 的 `<resultMap`, `<collection`, `<association`。

        // 重新实现一个简单的 XML 堆栈解析器用于 "类型上下文"
        const tagStack = [];
        const typeStack: string[] = [];
        const tagsRegex = /<\/?(resultMap|collection|association|case)\b([^>]*)>/g;

        let match;
        while ((match = tagsRegex.exec(text))) {
            const index = match.index;
            if (index > docOffset) break; // 超过光标

            const isClosing = match[0].startsWith('</');
            const tagName = match[1];
            const attributes = match[2];

            if (isClosing) {
                if (typeStack.length > 0) typeStack.pop(); // 弹出作用域
            } else if (!match[0].endsWith('/>')) { // standard open tag
                // 如果是自闭合（由上面的 endsWith /> 检查处理，用于简化解析）
                // 提取类型
                let type = this.extractType(attributes);
                // 如果未指定，继承父类型？
                // Collections/Associations 通常指定类型。
                // 如果没有，可能从父字段推断，如果没有深度分析很难。
                // 让我们按照用户请求/标准假设显式类型。
                typeStack.push(type || 'UNKNOWN');
            }
            // 如果是自闭合 <collection ... />，它不会影响 *后续* 行（兄弟节点）的作用域，
            // 仅影响其自身的属性，如果我们悬停在不同的属性上，我们不应该在其中。
            // 实际上，如果我们正在编辑 collection 标签本身的 `property` 属性，上下文是 *父* 类型。
            // 如果我们在 collection 标签体 *内部*（嵌套标签），上下文是 *collection* 类型。

            // 等等，"property" 属性属于它所在的标签。
            // `<result property="foo" />` -> foo 属于父类型。
            // `<collection property="items" ...>` -> items 属于父类型。
            // 内部 `<collection ...> <result property="bar" /> </collection>` -> bar 属于 Collection 类型。

            // 所以：`property` 属性的类型上下文是直接父元素的类型。
        }

        // 上面的循环让我们处于状态中。
        // 当我们遇到 `index > docOffset` 时，我们处于堆栈中剩余标签的 "内部"。
        // 但是，我们获取 `property` 的标签可能是匹配的 *最后一个*（通过严格内部检查），
        // 或者我们正确地位于最后一个的内容 *内部*。

        // 实际上，具体逻辑：
        // 文本: ... <resultMap type="A"> <collection ofType="B"> <result property="WORD" ...
        // 逻辑:
        // 1. 找到包含当前 `property="..."` 的父标签。
        //    由于 `property` 是标签的属性（例如 `<result`），我们在逻辑上位于该标签定义的 "内部"
        //    （但物理上在标签字符串内）。
        //    但是，"上下文类型" 由该标签的 *容器* 定义。

        //    <resultMap type="User">
        //       <result property="name" />  <-- 上下文是 User
        //    </resultMap>

        //    <collection ofType="Item">
        //       <result property="id" />    <-- 上下文是 Item
        //    </collection>

        // 向后扫描以找到最近的封闭祖先 (resultMap 代码风格)。
        // 通常，<result> 标签是自闭合的或单行的。它们是 resultMap/collection 的子级。

        // 让我们尝试匹配光标前的最后一个 "Open" 容器标签 (resultMap, collection, association)，
        // 忽略自闭合标签。

        // 简化向后搜索
        const reversedText = text.substring(0, docOffset);
        const containerRegex = /<(resultMap|collection|association|case)\b([^>]*)(>)/g; // 匹配开始标签
        // 我们还需要忽略匹配的结束标签... 这对于正则来说变得很复杂。

        // 让我们重用文件开头的正向堆栈方法。对于标准文件来说足够快。
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
