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
            // Comprehensive list of MySQL keywords
            const keywordRegex = /\b(ACCESSIBLE|ADD|ALL|ALTER|ANALYZE|AND|AS|ASC|ASENSITIVE|BEFORE|BETWEEN|BIGINT|BINARY|BLOB|BOTH|BY|CALL|CASCADE|CASE|CHANGE|CHAR|CHARACTER|CHECK|COLLATE|COLUMN|CONDITION|CONSTRAINT|CONTINUE|CONVERT|CREATE|CROSS|CURRENT_DATE|CURRENT_TIME|CURRENT_TIMESTAMP|CURRENT_USER|CURSOR|DATABASE|DATABASES|DAY_HOUR|DAY_MICROSECOND|DAY_MINUTE|DAY_SECOND|DEC|DECIMAL|DECLARE|DEFAULT|DELAYED|DELETE|DESC|DESCRIBE|DETERMINISTIC|DISTINCT|DISTINCTROW|DIV|DOUBLE|DROP|DUAL|EACH|ELSE|ELSEIF|ENCLOSED|ESCAPED|EXISTS|EXIT|EXPLAIN|FALSE|FETCH|FLOAT|FLOAT4|FLOAT8|FOR|FORCE|FOREIGN|FROM|FULLTEXT|GRANT|GROUP|HAVING|HIGH_PRIORITY|HOUR_MICROSECOND|HOUR_MINUTE|HOUR_SECOND|IF|IGNORE|IN|INDEX|INFILE|INNER|INOUT|INSENSITIVE|INSERT|INT|INTEGER|INTERVAL|INTO|IO_AFTER_GTIDS|IO_BEFORE_GTIDS|IS|ITERATE|JOIN|KEY|KEYS|KILL|LEADING|LEAVE|LEFT|LIKE|LIMIT|LINEAR|LINES|LOAD|LOCALTIME|LOCALTIMESTAMP|LOCK|LONG|LONGBLOB|LONGTEXT|LOOP|LOW_PRIORITY|MASTER_BIND|MASTER_SSL_VERIFY_SERVER_CERT|MATCH|MAXVALUE|MEDIUMBLOB|MEDIUMINT|MEDIUMTEXT|MIDDLEINT|MINUTE_MICROSECOND|MINUTE_SECOND|MOD|MODIFIES|NATURAL|NOT|NO_WRITE_TO_BINLOG|NULL|NUMERIC|ON|OPTIMIZE|OPTION|OPTIONALLY|OR|ORDER|OUT|OUTER|OUTFILE|PARTITION|PRECISION|PRIMARY|PROCEDURE|PURGE|RANGE|READ|READS|READ_WRITE|REAL|REFERENCES|REGEXP|RELEASE|RENAME|REPEAT|REPLACE|REQUIRE|RESIGNAL|RESTRICT|RETURN|REVOKE|RIGHT|RLIKE|SCHEMA|SCHEMAS|SECOND_MICROSECOND|SELECT|SENSITIVE|SEPARATOR|SET|SHOW|SIGNAL|SMALLINT|SPATIAL|SPECIFIC|SQL|SQLEXCEPTION|SQLSTATE|SQLWARNING|SQL_BIG_RESULT|SQL_CALC_FOUND_ROWS|SQL_SMALL_RESULT|SSL|STARTING|STRAIGHT_JOIN|TABLE|TERMINATED|THEN|TINYBLOB|TINYINT|TINYTEXT|TO|TRAILING|TRIGGER|TRUE|UNDO|UNION|UNIQUE|UNLOCK|UNSIGNED|UPDATE|USAGE|USE|USING|UTC_DATE|UTC_TIME|UTC_TIMESTAMP|VALUES|VARBINARY|VARCHAR|VARCHARACTER|VARYING|WHEN|WHERE|WHILE|WITH|WRITE|XOR|YEAR_MONTH|ZEROFILL|INTERVAL|MINUTE|HOUR|SECOND|DAY|MONTH|YEAR|WEEK|QUARTER|MICROSECOND)\b/gi;
            this.collectMatches(keywordRegex, contentCodeOnly, blockStartIndex, doc, keywords);

            // Functions: Use contentCodeOnly
            // Comprehensive list of MySQL functions
            const funcRegex = /\b(ABS|ACOS|ADDDATE|ADDTIME|AES_DECRYPT|AES_ENCRYPT|ANY_VALUE|ASCII|ASIN|ATAN|ATAN2|AVG|BENCHMARK|BIN|BIN_TO_UUID|BIT_AND|BIT_COUNT|BIT_LENGTH|BIT_OR|BIT_XOR|CAN_ACCESS_COLUMN|CAN_ACCESS_DATABASE|CAN_ACCESS_TABLE|CAN_ACCESS_VIEW|CAST|CEIL|CEILING|CHAR|CHAR_LENGTH|CHARACTER_LENGTH|CHARSET|COALESCE|COERCIBILITY|COLLATION|COMPRESS|CONCAT|CONCAT_WS|CONNECTION_ID|CONV|CONVERT|CONVERT_TZ|COS|COT|COUNT|CRC32|CUME_DIST|CURDATE|CURRENT_DATE|CURRENT_ROLE|CURRENT_TIME|CURRENT_TIMESTAMP|CURRENT_USER|CURTIME|DATABASE|DATE|DATE_ADD|DATE_FORMAT|DATE_SUB|DATEDIFF|DAY|DAYNAME|DAYOFMONTH|DAYOFWEEK|DAYOFYEAR|DECODE|DEGREES|DENSE_RANK|ELT|ENCODE|ENCRYPT|EXP|EXPORT_SET|EXTRACT|EXTRACTVALUE|FIELD|FIND_IN_SET|FIRST_VALUE|FLOOR|FORMAT|FORMAT_BYTES|FORMAT_PICO_TIME|FOUND_ROWS|FROM_BASE64|FROM_DAYS|FROM_UNIXTIME|GEOMCOLLECTION|GEOMETRYCOLLECTION|GET_FORMAT|GET_LOCK|GREATEST|GROUP_CONCAT|GROUPING|GTID_SUBSET|GTID_SUBTRACT|HEX|HOUR|ICU_VERSION|IF|IFNULL|INET6_ATON|INET6_NTOA|INET_ATON|INET_NTOA|INSERT|INSTR|INTERNAL_AUTO_INCREMENT|INTERVAL|IS_FREE_LOCK|IS_IPV4|IS_IPV4_COMPAT|IS_IPV4_MAPPED|IS_IPV6|IS_USED_LOCK|IS_UUID|ISNULL|JSON_ARRAY|JSON_ARRAY_APPEND|JSON_ARRAY_INSERT|JSON_CONTAINS|JSON_CONTAINS_PATH|JSON_DEPTH|JSON_EXTRACT|JSON_INSERT|JSON_KEYS|JSON_LENGTH|JSON_MERGE|JSON_MERGE_PATCH|JSON_MERGE_PRESERVE|JSON_OBJECT|JSON_OVERLAPS|JSON_PRETTY|JSON_QUOTE|JSON_REMOVE|JSON_REPLACE|JSON_SCHEMA_VALID|JSON_SCHEMA_VALIDATION_REPORT|JSON_SEARCH|JSON_SET|JSON_STORAGE_FREE|JSON_STORAGE_SIZE|JSON_TABLE|JSON_TYPE|JSON_UNQUOTE|JSON_VALID|JSON_VALUE|LAG|LAST_DAY|LAST_INSERT_ID|LCASE|LEAD|LEAST|LEFT|LENGTH|LINESTRING|LN|LOAD_FILE|LOCALTIME|LOCALTIMESTAMP|LOCATE|LOG|LOG10|LOG2|LOWER|LPAD|LTRIM|MAKE_SET|MAKEDATE|MAKETIME|MASTER_POS_WAIT|MAX|MBRCONTAINS|MBRCOVEREDBY|MBRCOVERS|MBRDISJOINT|MBREQUALS|MBRINTERSECTS|MBROVERLAPS|MBRTOUCHES|MBRWITHIN|MD5|MEMBER_OF|MICROSECOND|MID|MIN|MINUTE|MOD|MONTH|MONTHNAME|MULTILINESTRING|MULTIPOINT|MULTIPOLYGON|NAME_CONST|NOW|NTH_VALUE|NTILE|NULLIF|OCT|OCTET_LENGTH|OLD_PASSWORD|ORD|PASSWORD|PERCENT_RANK|PERIOD_ADD|PERIOD_DIFF|PI|POINT|POLYGON|POSITION|POW|POWER|PROCEDURE_ANALYSE|PS_CURRENT_THREAD_ID|PS_THREAD_ID|QUARTER|QUOTE|RADIANS|RAND|RANDOM_BYTES|RANK|REGEXP_INSTR|REGEXP_LIKE|REGEXP_REPLACE|REGEXP_SUBSTR|RELEASE_ALL_LOCKS|RELEASE_LOCK|REPEAT|REPLACE|REVERSE|RIGHT|ROLES_GRAPHML|ROUND|ROW_COUNT|ROW_NUMBER|RPAD|RTRIM|SCHEMA|SEC_TO_TIME|SECOND|SESSION_USER|SHA1|SHA2|SIGN|SIN|SLEEP|SOUNDEX|SPACE|SQRT|ST_AREA|ST_ASBINARY|ST_ASGEOJSON|ST_ASTEXT|ST_BUFFER|ST_BUFFER_STRATEGY|ST_CENTROID|ST_CONTAINS|ST_CONVEXHULL|ST_CROSSES|ST_DIFFERENCE|ST_DIMENSION|ST_DISJOINT|ST_DISTANCE|ST_DISTANCE_SPHERE|ST_ENDPOINT|ST_ENVELOPE|ST_EQUALS|ST_EXTERIORRING|ST_GEOHASH|ST_GEOMCOLLFROMTEXT|ST_GEOMCOLLFROMWKB|ST_GEOMETRYN|ST_GEOMETRYTYPE|ST_GEOMFROMGEOJSON|ST_GEOMFROMTEXT|ST_GEOMFROMWKB|ST_INTERIORRINGN|ST_INTERSECTION|ST_INTERSECTS|ST_ISCLOSED|ST_ISEMPTY|ST_ISSIMPLE|ST_ISVALID|ST_LATITUDE|ST_LENGTH|ST_LINEFROMTEXT|ST_LINEFROMWKB|ST_LONGITUDE|ST_MAKEENVELOPE|ST_MLINEFROMTEXT|ST_MLINEFROMWKB|ST_MPOINTFROMTEXT|ST_MPOINTFROMWKB|ST_MPOLYFROMTEXT|ST_MPOLYFROMWKB|ST_NUMGEOMETRIES|ST_NUMINTERIORRING|ST_NUMPOINTS|ST_OVERLAPS|ST_POINTFROMGEOHASH|ST_POINTFROMTEXT|ST_POINTFROMWKB|ST_POINTN|ST_POLYFROMTEXT|ST_POLYFROMWKB|ST_SIMPLIFY|ST_SRID|ST_STARTPOINT|ST_SWAPXY|ST_SYMDIFFERENCE|ST_TOUCHES|ST_TRANSFORM|ST_UNION|ST_VALIDATE|ST_WITHIN|ST_X|ST_Y|STATEMENT_DIGEST|STATEMENT_DIGEST_TEXT|STD|STDDEV|STDDEV_POP|STDDEV_SAMP|STR_TO_DATE|STRCMP|SUBDATE|SUBSTR|SUBSTRING|SUBSTRING_INDEX|SUBTIME|SUM|SYSDATE|SYSTEM_USER|TAN|TIME|TIME_FORMAT|TIME_TO_SEC|TIMEDIFF|TIMESTAMP|TIMESTAMPADD|TIMESTAMPDIFF|TO_BASE64|TO_DAYS|TO_SECONDS|TRIM|TRUNCATE|UCASE|UNCOMPRESS|UNCOMPRESSED_LENGTH|UNHEX|UNIX_TIMESTAMP|UPDATEXML|UPPER|USER|UTC_DATE|UTC_TIME|UTC_TIMESTAMP|UUID|UUID_SHORT|UUID_TO_BIN|VALIDATE_PASSWORD_STRENGTH|VALUES|VAR_POP|VAR_SAMP|VARIANCE|VERSION|WAIT_FOR_EXECUTED_GTID_SET|WAIT_UNTIL_SQL_THREAD_AFTER_GTIDS|WEEK|WEEKDAY|WEEKOFYEAR|WEIGHT_STRING|YEAR|YEARWEEK)\s*\(/gi;
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