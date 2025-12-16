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

        // 数据库就绪时重新验证
        this.dbService.onDidReady(() => {
            if (vscode.window.activeTextEditor) {
                this.triggerUpdateDiagnostics(vscode.window.activeTextEditor.document);
            }
            // 同时更新所有可见编辑器的诊断
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

        // 检查验证是否启用
        const config = vscode.workspace.getConfiguration('mybatisToolkit.validation');
        if (!config.get<boolean>('enable', true)) {
            this.diagnosticCollection.clear();
            return;
        }

        const diagnostics: vscode.Diagnostic[] = [];

        // --- 1. 验证类型映射 (resultMap & resultType) ---
        await this.validateTypeMappings(document, diagnostics);

        // --- 2. 验证 SQL 返回字段 (Select 子句 -> Java 类) ---
        await this.validateSqlFieldMappings(document, diagnostics);

        // --- 3. 验证数据库表和列 (语句作用域) ---
        if (this.dbService.isConnected() && this.dbService.isReady()) {
            await this.validateDatabaseConsistency(document, diagnostics);
        }

        // --- 4. 验证 UNION 一致性 ---
        this.validateUnionConsistency(document, diagnostics);

        this.diagnosticCollection.set(document.uri, diagnostics);
    }

    private async validateDatabaseConsistency(document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]) {
        const text = document.getText();

        // SQL 语句的正则表达式
        const sqlBlockRegex = /<(select|insert|update|delete)\s+[^>]*>([\s\S]*?)<\/\1>/g;
        let blockMatch;

        while ((blockMatch = sqlBlockRegex.exec(text))) {
            const blockContent = blockMatch[2];
            const blockStartOffset = blockMatch.index + blockMatch[0].indexOf(blockContent);

            // 屏蔽 XML 标签 / 参数 / 字符串 / 注释 
            let sqlOnly = blockContent.replace(/<[^>]+>/g, (m) => ' '.repeat(m.length));
            sqlOnly = sqlOnly.replace(/([#$]\{[^}]+\})/g, (m) => ' '.repeat(m.length));
            sqlOnly = sqlOnly.replace(/(['"])(?:(?!\1|\\).|\\.)*\1/g, (m) => ' '.repeat(m.length));
            sqlOnly = sqlOnly.replace(/&[a-z]+;/g, (m) => ' '.repeat(m.length));
            // 屏蔽注释 (简单的 -- 和 /* */)
            sqlOnly = sqlOnly.replace(/--.*$/gm, (m) => ' '.repeat(m.length));
            sqlOnly = sqlOnly.replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length));

            // 1. 识别当前块中使用的表
            const tableRegex = /(?:FROM|JOIN|UPDATE|INTO)\s+([`"']?[\w.]+(?:[`"'][\w.]+)*[`"']?)(?:\s+(?:AS\s+)?([a-zA-Z_]\w*))?/gi;
            const tables = new Set<string>();
            const aliases = new Set<string>();
            const validTables = new Set<string>();

            let match;
            while ((match = tableRegex.exec(sqlOnly))) {
                const rawTableName = match[1];
                const tableName = rawTableName.replace(/[`"']/g, ''); // strip quotes

                if (!tableName.includes(' ')) { // 简单检查以避免干扰
                    tables.add(tableName);
                    if (this.dbService.hasTable(tableName)) {
                        validTables.add(tableName);
                    } else {
                        // 报告未找到表
                        const absIndex = blockStartOffset + match.index + match[0].indexOf(rawTableName);
                        const range = new vscode.Range(
                            document.positionAt(absIndex),
                            document.positionAt(absIndex + rawTableName.length)
                        );
                        diagnostics.push(new vscode.Diagnostic(
                            range,
                            `表 '${tableName}' 在数据库中未找到。`,
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

            // 2. 识别别名 (列/子查询)
            const columnAliasRegex = /\bAS\s+([`"']?)([a-zA-Z_]\w*)\1/gi;
            while ((match = columnAliasRegex.exec(sqlOnly))) {
                const alias = match[2];
                if (!SQL_KEYWORDS.includes(alias.toUpperCase())) aliases.add(alias);
            }

            // 2b. 识别子查询别名 (例如 JOIN (SELECT ...) t2 ON ...)
            // 启发式：闭合括号后跟非关键字标识符
            const subqueryAliasRegex = /\)\s+(?:AS\s+)?([a-zA-Z_]\w*)/gi;
            while ((match = subqueryAliasRegex.exec(sqlOnly))) {
                const alias = match[1];
                if (!SQL_KEYWORDS.includes(alias.toUpperCase())) {
                    aliases.add(alias);
                }
            }

            // 3. 获取有效表的架构
            const validColumns = new Set<string>();
            for (const t of validTables) {
                const cols = await this.dbService.getTableSchema(t);
                cols.forEach(c => validColumns.add(c.Field.toLowerCase()));
            }

            // 4. 验证标识符
            if (validTables.size > 0) {
                const identifierRegex = /\b([a-zA-Z_][a-zA-Z0-9_.]*)\b/g; // 允许点号用于处理 alias.col
                while ((match = identifierRegex.exec(sqlOnly))) {
                    const fullWord = match[1];

                    // 按点分割 (alias.col) 或检查原始值
                    const parts = fullWord.split('.');
                    let colName = fullWord;

                    if (parts.length > 1) {
                        // t.id -> 检查 'id'
                        // db.t.id -> 检查 'id'
                        colName = parts[parts.length - 1];
                    }

                    const lowerCol = colName.toLowerCase();

                    // 跳过如果：
                    // 1. 关键字/函数
                    if (SQL_KEYWORDS.includes(colName.toUpperCase()) || SQL_FUNCTIONS.includes(colName.toUpperCase())) continue;
                    // 2. 是表或别名
                    if (tables.has(colName) || aliases.has(colName)) continue;
                    if (parts.length > 1 && (tables.has(parts[0]) || aliases.has(parts[0]))) {
                        // 这是 prefix.col -> 上面的排除逻辑处理了有效前缀吗？
                        // 严格检查：前缀必须是有效别名/表
                    }

                    // 3. 验证逻辑
                    if (!validColumns.has(lowerCol)) {
                        const absIndex = blockStartOffset + match.index;
                        const range = new vscode.Range(
                            document.positionAt(absIndex),
                            document.positionAt(absIndex + fullWord.length)
                        );

                        // 根据宽松别名集进行双重检查？
                        // 如果 'ids' 是别名，它应该在别名集中。
                        if (!aliases.has(colName)) {
                            diagnostics.push(new vscode.Diagnostic(
                                range,
                                `列 '${colName}' 未在表: ${Array.from(validTables).join(', ')} 中找到`,
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

        // 类型栈: { typeName: string, javaClass: JavaClass | undefined | null }
        // null javaClass 意味着即使无法解析类型 (因此跳过此作用域的验证)
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
                // 如果匹配当前作用域上下文则弹出堆栈
                // 注意：<id>, <result> 通常是自闭合或空的，
                // 但如果它们被显式关闭 </id>，我们不应该弹出 *Type* 堆栈
                // 因为 <id> 不引入新的类型作用域（除非嵌套，这是无效的）。
                // 只有 resultMap, collection, association 引入作用域。
                if (['resultMap', 'collection', 'association', 'case'].includes(tagName)) {
                    stack.pop();
                }
            } else {
                // 开始标签 (或自闭合)

                // 1. 确定此标签是否引入新的类型作用域
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

                // 如果是作用域标签则压入堆栈
                if (['resultMap', 'collection', 'association', 'case'].includes(tagName)) {
                    if (newType) {
                        const javaClass = this.indexer.getClassByFullName(newType);
                        stack.push({ typeName: newType, javaClass });
                    } else {
                        // 缺少类型信息 (例如隐式关联)。
                        // 暂时压入 null 以表示“未知作用域” -> 跳过内部验证。
                        // 改进：尝试从父字段推断类型。
                        stack.push({ typeName: 'unknown', javaClass: null });
                    }
                }

                // 2. 验证属性 (如果适用)
                // <id property="...">, <result property="...">, <collection property="...">, <association property="...">
                const property = this.getAttribute(attributes, 'property');
                if (property && stack.length > 0) {
                    // 对照当前作用域检查 (堆栈顶部)
                    // 如果我们刚刚推入了一个新作用域 (例如 <collection property="list" ofType="Item">)，
                    // "property" 属于父作用域，而不是新作用域。
                    // 除非我们在根 <resultMap> 处，但 <resultMap> 没有 property。

                    // 逻辑：标签 *本身* 是 *封闭* 对象的属性。
                    // 所以如果我们刚刚推入，我们必须查看 stack[stack.length - 2]，
                    // 如果是自闭合/非作用域，则查看 stack[stack.length - 1]。

                    // 实际上，让我们这样看：
                    // 如果此标签 *是* 作用域标签 (collection/association)，它刚刚被推送。
                    // 所以我们检查 stack[stack.length - 2]。
                    // 如果有效堆栈深度...

                    let parentScopeIdx = stack.length - 1;
                    if (['resultMap', 'collection', 'association', 'case'].includes(tagName) && !isClosing) {
                        // 我们刚刚推送了这个标签的类型。property 属性属于前一个类型。
                        parentScopeIdx = stack.length - 2;
                    }

                    if (parentScopeIdx >= 0) {
                        const parentContext = stack[parentScopeIdx];
                        if (parentContext.javaClass) {
                            if (!this.hasFieldRecursive(parentContext.javaClass, property)) {
                                // 计算 'property="val"' 的位置
                                const propMatch = new RegExp(`property=["']${property}["']`).exec(attributes);
                                if (propMatch) {
                                    const propStart = match.index + match[0].indexOf(propMatch[0]);
                                    const startPos = document.positionAt(propStart);
                                    const endPos = document.positionAt(propStart + propMatch[0].length);

                                    diagnostics.push(new vscode.Diagnostic(
                                        new vscode.Range(startPos, endPos),
                                        `属性 '${property}' 未在类 '${parentContext.typeName}' 中找到。`,
                                        vscode.DiagnosticSeverity.Warning
                                    ));
                                }
                            }
                        }
                    }
                }

                // 如果是自闭合作用域标签则弹出 (例如 <collection ... />Empty)
                if (isSelfClosing && ['resultMap', 'collection', 'association', 'case'].includes(tagName)) {
                    stack.pop();
                }
            }
        }
    }

    private async validateSqlFieldMappings(document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]) {
        const text = document.getText();

        // 匹配 <select> 标签
        const selectRegex = /<select\s+[^>]*>([\s\S]*?)<\/select>/g;
        let match;

        while ((match = selectRegex.exec(text))) {
            const fullTag = match[0];
            const content = match[1];
            const startOffset = match.index;
            const contentStartOffset = startOffset + fullTag.indexOf(content);

            // 从开始标签提取属性
            const openTag = fullTag.substring(0, fullTag.indexOf('>') + 1);
            const resultType = this.getAttribute(openTag, 'resultType');
            const resultMap = this.getAttribute(openTag, 'resultMap');

            let targetClass: any = undefined; // Java 类
            // 存储显式映射的列 (白名单)
            const mappedColumns = new Set<string>();

            // 预索引本地 ResultMaps 以进行 O(1) 查找
            const localResultMaps = new Map<string, { type: string, content: string }>();
            const resultMapRegex = /<resultMap\s+[^>]*id=["']([^"']+)["'][^>]*type=["']([^"']+)["'][^>]*>([\s\S]*?)<\/resultMap>/g;
            let rmMatch;
            while ((rmMatch = resultMapRegex.exec(text))) {
                localResultMaps.set(rmMatch[1], { type: rmMatch[2], content: rmMatch[3] });
            }

            if (resultType) {
                targetClass = this.indexer.getClassByFullName(resultType);
            } else if (resultMap) {
                // O(1) 查找
                const rm = localResultMaps.get(resultMap);
                if (rm) {
                    targetClass = this.indexer.getClassByFullName(rm.type);

                    // 从 resultMap 内容中提取所有 column="..." (深度扫描)
                    const columnRegex = /column=["']([^"']+)["']/g;
                    let colMatch;
                    while ((colMatch = columnRegex.exec(rm.content))) {
                        mappedColumns.add(colMatch[1].toLowerCase());
                    }
                }
            }

            if (!targetClass) continue;

            // 解析 SQL 以查找 SELECT 子句
            const cleanSql = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

            // 正则捕获内容在 SELECT 和 FROM 之间
            // 非贪婪匹配直到第一个不在引号/括号内的 FROM (正则表达式很难做到)
            // 简化：假设严格的 `SELECT ... FROM` 模式。
            const selectMatch = /^\s*SELECT\s+(.+?)\s+FROM\b/i.exec(cleanSql);

            if (selectMatch) {
                const columnsPart = selectMatch[1];
                const columns = this.splitColumns(columnsPart);

                let currentPos = 0; // 相对于 contentStartOffset

                for (const col of columns) {
                    const cleanCol = col.trim();
                    if (!cleanCol || cleanCol === '*' || cleanCol.endsWith('.*')) continue;

                    // 提取别名或字段标识
                    // 逻辑:
                    // 1. 检查显式 " AS "
                    // 2. 检查隐式别名 (空格分隔)，忽略函数括号
                    let fieldName = '';
                    let isExpression = false;

                    // 规范化引号以进行处理
                    const normCol = cleanCol; // .replace(/['"`]/g, ''); // 保留引号以便稍后精确替换

                    const upperCol = normCol.toUpperCase();
                    const asIndex = upperCol.lastIndexOf(' AS ');

                    if (asIndex > -1) {
                        // 这是 prefix.col -> 上面的排除逻辑处理了有效前缀吗？
                        // 严格检查：前缀必须是有效别名/表
                        fieldName = normCol.substring(asIndex + 4).trim();
                    } else {
                        // 隐式别名或只是列
                        // "table.col alias" 或 "table.col"
                        // 如果括号 *外部* 有空格，则最后一部分是别名
                        // 例如 "count(*) c" -> c
                        // 例如 "t.status" -> status

                        const lastSpace = this.lastIndexOfNotInParens(normCol, ' ');
                        if (lastSpace > -1) {
                            fieldName = normCol.substring(lastSpace + 1).trim();
                            // 如果空格前的部分以 ')' 结尾，并且后面的部分是标识符 -> 别名
                            // 如果前面的部分是 't.col'，后面的部分是别名。
                        } else {
                            // 括号外没空格 -> 它只是列/表达式
                            // "t.col" -> col
                            // "col" -> col
                            // "count(*)" -> 跳过验证 (无别名映射)
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

                    // 从字段名中清除引号
                    fieldName = fieldName.replace(/^['"`]|['"`]$/g, '');

                    // 1. 检查显式映射 (ResultMap) - 不区分大小写
                    if (mappedColumns.has(fieldName.toLowerCase())) {
                        continue; // 有效
                    }

                    // 2. 检查自动映射 (根类中的 CamelCase)
                    const camelName = fieldName.replace(/_([a-z])/g, (g) => g[1].toUpperCase());

                    // 检查存在性 (继承递归)
                    if (!this.hasFieldRecursive(targetClass, camelName)) {
                        // 在文档中定位
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
                                `字段 '${camelName}' (来自 '${fieldName}') 未在返回类型 '${targetClass.name}' (或父类) 中找到，且未在 ResultMap 中映射。`,
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

        // 1. 检查当前类
        if (javaClass.fields.has(fieldName)) return true;

        // 2. 检查父类
        if (javaClass.parentClassName && javaClass.imports) {
            // 解析父类全名
            let parentFullName = javaClass.imports.get(javaClass.parentClassName);

            // 如果不在 imports 中，可能在同一个包中 (隐式导入)
            if (!parentFullName) {
                // 从同一个包推断
                const currentPackage = javaClass.fullName.substring(0, javaClass.fullName.lastIndexOf('.'));
                parentFullName = `${currentPackage}.${javaClass.parentClassName}`;
            }

            // 查找父类
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
                if (c === quoteChar && str[i - 1] !== '\\') { // 反向扫描转义检查是棘手的，但对于简单的情况足够了
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
        // 匹配 <select> 标签
        const selectRegex = /<select\s+[^>]*>([\s\S]*?)<\/select>/g;
        let match;

        while ((match = selectRegex.exec(text))) {
            const content = match[1];
            const startOffset = match.index + match[0].indexOf(content);

            // 清理内容以进行解析 (替换 XML 标签但保持长度)
            const cleanSql = content.replace(/<[^>]+>/g, (m) => ' '.repeat(m.length));

            const parts = this.splitByUnion(cleanSql);
            if (parts.length <= 1) continue;

            // 处理第一部分作为基准
            const baseColumns = this.extractColumnsFromUnionPart(parts[0].content);
            if (!baseColumns) continue;

            // 比较后续部分
            for (let i = 1; i < parts.length; i++) {
                const part = parts[i];
                const currentColumns = this.extractColumnsFromUnionPart(part.content);

                if (!currentColumns) continue;

                const partAbsStart = startOffset + part.offset;

                // 1. 检查列数 (错误)
                if (currentColumns.length !== baseColumns.length) {
                    // 尝试高亮 SELECT 子句或整个部分
                    const selectIdx = part.content.toUpperCase().indexOf('SELECT');
                    const rangeStart = selectIdx > -1 ? selectIdx : 0;
                    // 大致高亮直到 FROM 或行尾
                    const fromIdx = part.content.toUpperCase().indexOf('FROM', rangeStart);
                    const rangeEnd = fromIdx > -1 ? fromIdx : part.content.length;

                    const range = new vscode.Range(
                        document.positionAt(partAbsStart + rangeStart),
                        document.positionAt(partAbsStart + rangeEnd)
                    );

                    diagnostics.push(new vscode.Diagnostic(
                        range,
                        `使用的 SELECT 语句列数不同 (${currentColumns.length} vs ${baseColumns.length})。`,
                        vscode.DiagnosticSeverity.Error
                    ));
                    continue; // 如果计数错误则跳过名称检查
                }

                // 2. 检查列名/别名 (警告)
                for (let j = 0; j < baseColumns.length; j++) {
                    const baseCol = baseColumns[j];
                    const currentCol = currentColumns[j];

                    if (baseCol.name !== currentCol.name) {
                        // 在当前部分定位列
                        // 粗略位置：部分开始 + 列字符串索引
                        // 更好：我们解析了它，但没有保留偏移量。
                        // 为了简单起见，让我们只高亮该部分的 SELECT 关键字，或者重新搜索

                        // 我们可以在该部分中搜索列的原始字符串
                        const colIdx = part.content.indexOf(currentCol.raw); // 这是近似值 (可能在其他地方匹配)
                        let range: vscode.Range;

                        if (colIdx > -1) {
                            range = new vscode.Range(
                                document.positionAt(partAbsStart + colIdx),
                                document.positionAt(partAbsStart + colIdx + currentCol.raw.length)
                            );
                        } else {
                            // 回退到部分开始
                            range = new vscode.Range(
                                document.positionAt(partAbsStart),
                                document.positionAt(partAbsStart + 10)
                            );
                        }

                        diagnostics.push(new vscode.Diagnostic(
                            range,
                            `列名不匹配: '${currentCol.name}' vs '${baseCol.name}' (第一个 SELECT)。UNION 操作顺序很重要。`,
                            vscode.DiagnosticSeverity.Warning
                        ));
                    }
                }
            }
        }
    }

    private extractColumnsFromUnionPart(sql: string): { name: string, raw: string }[] | null {
        // 查找 SELECT ... FROM
        // 简化正则，假设基本结构
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
        // 大致重用 validateSqlFieldMappings 中的逻辑
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
                    // 无别名的表达式 -> 使用全文作为隐式名称 (在数据库中通常是不确定的，但对于检查是一致的)
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
        return fieldName.replace(/^['"`]|['"`]$/g, ''); // 去除引号
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
                    // 检查 UNION
                    // 明显的检查：空格边界或前后换行
                    // 简化：检查是否匹配 "UNION" 或 "UNION ALL"
                    // 优化：检查第一个字符 'U' 或 'u'
                    if (char === 'U' || char === 'u') {
                        // 向前看
                        const rest = sql.substring(i);
                        const unionMatch = /^(UNION(?:\s+ALL)?)\b/i.exec(rest);
                        if (unionMatch) {
                            // 检查前一个字符是否为空白或边界
                            const prevChar = i > 0 ? sql[i - 1] : ' ';
                            if (/[\s)]/.test(prevChar)) {
                                // 找到分割
                                parts.push({
                                    content: sql.substring(lastSplit, i),
                                    offset: lastSplit
                                });
                                lastSplit = i + unionMatch[0].length;
                                i += unionMatch[0].length - 1; // 前进
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
