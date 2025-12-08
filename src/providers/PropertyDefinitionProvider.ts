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

        // Only trigger within property="..."
        const line = document.lineAt(position.line).text;
        const widthBefore = position.character;
        const prefix = line.substring(0, widthBefore);
        // Basic check if we are inside property="..."
        // A more robust check would involve parsing or checking closest attribute
        if (!/property\s*=\s*["'][^"']*$/.test(prefix) && !/^[^"']*["']/.test(line.substring(widthBefore))) {
            // Try to see if 'word' aligns with property value regex on the line
            const propRegex = /property\s*=\s*["']([^"']+)["']/;
            const match = propRegex.exec(line);
            if (!match || match[1] !== word) {
                // May also checking nested text, but let's assume standard attribute usage
                // Double check if cursor is in the value
                const matchIndex = line.indexOf(`property="${word}"`);
                const matchIndexSingle = line.indexOf(`property='${word}'`);
                if ((matchIndex === -1 || position.character < matchIndex + 10 || position.character > matchIndex + 10 + word.length) &&
                    (matchIndexSingle === -1 || position.character < matchIndexSingle + 10 || position.character > matchIndexSingle + 10 + word.length)) {
                    return;
                }
            }
        }

        // 1. Find the parent <resultMap> definition
        // We need to search backwards from current position to find <resultMap type="...">
        // Or if inside <association> or <collection>, find THAT type.

        // Simple strategy: Go up lines to find the enclosing tag with a type/ofType/javaType
        // Optimization: Use a stack-based parser or regex search backwards.

        let typeName: string | undefined;
        let currentLineNo = position.line;

        // Traverse upwards
        const stack: string[] = [];

        while (currentLineNo >= 0) {
            const lineText = document.lineAt(currentLineNo).text;

            // Check for immediate parent (association/collection)
            // Note: simple line check might fail on multi-line tags, assuming one-line or standard format for now
            // Improvements can be made with full document parsing if robust support needed

            // Check for resultMap header
            const resultMapMatch = /<resultMap\s+[^>]*type="([^"]+)"/i.exec(lineText);
            if (resultMapMatch) {
                // We found the root map. 
                // BUT we might be inside a nested collection.
                // If we haven't found a closer type, this is it.
                if (!typeName) typeName = resultMapMatch[1];
                break;
            }

            // Check for collection/association
            // <collection property="list" ofType="com.pkg.Item">
            // This is harder because we are physically INSIDE the tag content.
            // The tag opener is above us.
            // If we are at indentation level X, we look for tags with indentation < X.

            // Simplified Approach: Regex search backwards in full text from offset
            currentLineNo--;
        }

        // Better Approach: Regex Last Index
        const docOffset = document.offsetAt(position);
        const textBefore = text.substring(0, docOffset);

        // Find the last <resultMap> that hasn't been closed? No, XML is simpler.
        // We need the NEAREST ancestor that defines a type.
        // Ancestors are: <resultMap>, <collection>, <association>, <case>.

        // We can use a regex that captures all tags and build a stack, 
        // but easier: find the last tag open that isn't closed.

        // Let's rely on finding standard MyBatis tag attributes `type`, `ofType`, `javaType`.
        // We scan backwards. The first tag we encounter that is "open" (start tag) 
        // and has one of these attributes is our candidate?
        // Not necessarily, because we might be validation a sibling's property.
        // XML is hierarchical. We need the logic:
        // Find the opening tag of the element we are IN. 
        // If we are in `<result ... property="foo"/>`, we are self-closing or closed. 
        // We are inside the explicit parent.

        // Scan backwards for `<resultMap`, `<collection`, `<association` that DOES NOT have a matching `</...>` in between.

        // Re-implementing a simple XML stack parser for "type context"
        const tagStack = [];
        const typeStack: string[] = [];
        const tagsRegex = /<\/?(resultMap|collection|association|case)\b([^>]*)>/g;

        let match;
        while ((match = tagsRegex.exec(text))) {
            const index = match.index;
            if (index > docOffset) break; // Passed cursor

            const isClosing = match[0].startsWith('</');
            const tagName = match[1];
            const attributes = match[2];

            if (isClosing) {
                if (typeStack.length > 0) typeStack.pop(); // Pop scope
            } else if (!match[0].endsWith('/>')) { // standard open tag
                // If self-closing (handled by endsWith /> check above for simplistic parsing)
                // Extract type
                let type = this.extractType(attributes);
                // Inherit parent type if not specified? 
                // Collections/Associations usually specify type. 
                // If not, it might be inferred from parent field, which is hard without deep analysis.
                // Let's assume explicit type for now as per user request/standard.
                typeStack.push(type || 'UNKNOWN');
            }
            // If self-closing <collection ... /> it doesn't affect scope of *subsequent* lines (siblings), 
            // only its own attributes which we shouldn't be inside if we are hovering a different property.
            // Actually, if we are editing `property` attribute OF the collection tag itself, the context is the *parent* type.
            // If we are INSIDE the collection tag body (nested tags), context is the *collection* type.

            // Wait, "property" attribute belongs to the tag it is ON.
            // `<result property="foo" />` -> foo belongs to Parent Type.
            // `<collection property="items" ...>` -> items belongs to Parent Type.
            // INSIDE `<collection ...> <result property="bar" /> </collection>` -> bar belongs to Collection Type.

            // So: the type context for a `property` attribute is the Type of the IMMEDIATE PARENT ELEMENT.
        }

        // The loop above puts us in states.
        // When we hit `index > docOffset`, we are "inside" the tags remaining in stack.
        // BUT, the tag we are taking `property` from is likely the *last* one matched (if we are strictly inside it), 
        // OR we are properly inside the *content* of the last one.

        // Actually, specific logic:
        // Text: ... <resultMap type="A"> <collection ofType="B"> <result property="WORD" ...
        // Logic:
        // 1. Find the parent tag enclosing the current `property="..."`.
        //    Since `property` is an attribute of a tag (e.g. `<result`), we are logically "inside" that tag's definition 
        //    (but physically the tag string).
        //    However, the "context type" is defined by the *Container* of that tag.

        //    <resultMap type="User">
        //       <result property="name" />  <-- Context is User
        //    </resultMap>

        //    <collection ofType="Item">
        //       <result property="id" />    <-- Context is Item
        //    </collection>

        // Scan backwards to find the NEAREST CLOSING ANCESTOR (resultMap code style).
        // Usually, <result> tags are self-closing or one-liners. They are children of resultMap/collection.

        // Let's try to match the last "Open" container tag (resultMap, collection, association) before cursor.
        // ignoring self-closing tags.

        // Simplified Backwards Search
        const reversedText = text.substring(0, docOffset);
        const containerRegex = /<(resultMap|collection|association|case)\b([^>]*)(>)/g; // Match open tags
        // We also need to ignore matching close tags... this is getting complex for regex.

        // Let's reuse the forward stack approach from beginning of file. It's fast enough for standard files.
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
        const stack: string[] = []; // Stores Types

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
                // Opening tag
                let type = this.extractType(attrs);

                // If no type specified, maybe inherit? (e.g. association without javaType usually implies type from field, complicated)
                // For now push what we found or 'UNKNOWN' to keep stack balanced
                // But wait, if type is null, do we push? Yes, to match closing tag.
                // If it's undefined, we might check if we can inherit from stack top?
                // <resultMap type="A"> <association property="b"> ... </association> </resultMap>
                // Inside association, type is type of "b" in "A".
                // This requires resolving property "b" in "A".

                if (!type && stack.length > 0) {
                    // Try to resolve 'property' attribute to find type
                    const propMatch = /property=["']([^"']+)["']/.exec(attrs);
                    if (propMatch) {
                        // Resolve type check logic... skipping for MVP speed.
                        // Use UNKNOWN to avoid breaking stack.
                        type = 'UNKNOWN';
                    }
                }

                stack.push(type || 'UNKNOWN');
            }
        }

        // The type at top of stack is our parent container's type.
        // Filter out UNKNOWN
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
