
import * as vscode from 'vscode';
import * as fs from 'fs';
import { JavaAstUtils } from './utils/JavaAstUtils';
import { ProjectIndexer } from './services/ProjectIndexer';
import { MyBatisCodeLensProvider } from './providers/MyBatisCodeLensProvider';
import { MapperIntentionProvider } from './providers/MapperIntentionProvider';
import { SqlFormattingProvider } from './providers/SqlFormattingProvider';
import { DatabaseService } from './services/DatabaseService';
import { SqlValidationProvider } from './providers/SqlValidationProvider';
import { SqlDefinitionProvider } from './providers/SqlDefinitionProvider';
import { PropertyDefinitionProvider } from './providers/PropertyDefinitionProvider';
import { SchemaDocumentProvider } from './providers/SchemaDocumentProvider';
import { DatabaseTreeDataProvider, ConnectionItem, TableItem } from './providers/DatabaseTreeDataProvider';
import { CodeGenerationService } from './services/CodeGenerationService';
import { MethodSqlGenerator } from './services/MethodSqlGenerator';
import { SqlHighlightingProvider, SQL_SEMANTIC_TOKEN_LEGEND } from './providers/SqlHighlightingProvider';
import { MyBatisHoverProvider } from './providers/MyBatisHoverProvider';
import { QueryResultsPanel } from './panels/QueryResultsPanel';
import { QUERY_DEFAULT_MAX_ROWS } from './constants';
import { QueryResult } from './types';
import { getQueryResultDateFormats } from './config';

/**
 * 解析并校验端口输入。返回有效端口号；无效时提示用户并返回 undefined。
 */
async function parsePortInput(portStr: string): Promise<number | undefined> {
    const port = parseInt(portStr, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
        vscode.window.showErrorMessage('端口必须是 1-65535 之间的有效数字。');
        return undefined;
    }
    return port;
}

// 在 deactivate 中需要释放的全局服务引用
let indexerInstance!: ProjectIndexer;
let dbServiceInstance!: DatabaseService;
let sqlValidationProviderInstance!: SqlValidationProvider;

export async function activate(context: vscode.ExtensionContext) {
    const outputChannel = vscode.window.createOutputChannel("MyBatis Toolkit");
    outputChannel.appendLine('MyBatis Toolkit Pro 正在激活...');

    // 1. 初始化服务（延迟一帧启动索引，让激活先完成，减少首屏卡顿）
    indexerInstance = ProjectIndexer.getInstance(outputChannel);
    setImmediate(() => indexerInstance!.init());

    dbServiceInstance = DatabaseService.getInstance();
    await dbServiceInstance.init(context.secrets);
    vscode.commands.executeCommand('setContext', 'mybatisToolkit.connected', dbServiceInstance.isConnected());

    const codeGenService = new CodeGenerationService(dbServiceInstance);

    // 2. 注册提供者
    const codeLensProvider = new MyBatisCodeLensProvider(indexerInstance);
    const mapperIntentionProvider = new MapperIntentionProvider(indexerInstance);
    const formatProvider = new SqlFormattingProvider(dbServiceInstance);
    sqlValidationProviderInstance = new SqlValidationProvider(dbServiceInstance, indexerInstance);
    const sqlDefinitionProvider = new SqlDefinitionProvider(dbServiceInstance, indexerInstance);
    const propertyDefinitionProvider = new PropertyDefinitionProvider(indexerInstance);
    const schemaProvider = new SchemaDocumentProvider(dbServiceInstance);
    const hoverProvider = new MyBatisHoverProvider(indexerInstance);

    // 0. 代码操作 (生成 XML)
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            { language: 'java', scheme: 'file' },
            mapperIntentionProvider
        )
    );

    // CodeLens
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider(
            [{ language: 'xml' }, { language: 'java' }],
            codeLensProvider
        )
    );

    // 格式化
    context.subscriptions.push(
        vscode.languages.registerDocumentFormattingEditProvider(
            { language: 'xml' },
            formatProvider
        )
    );

    const semanticTokensProvider = new SqlHighlightingProvider(dbServiceInstance);
    context.subscriptions.push(
        vscode.languages.registerDocumentSemanticTokensProvider(
            { language: 'xml' },
            semanticTokensProvider,
            SQL_SEMANTIC_TOKEN_LEGEND
        )
    );

    // Hover Provider
    context.subscriptions.push(
        vscode.languages.registerHoverProvider(
            [{ language: 'xml' }, { language: 'java' }],
            hoverProvider
        )
    );

    // SQL 验证
    context.subscriptions.push(sqlValidationProviderInstance);
    // 在活动编辑器更改和文档更改时触发验证
    if (vscode.window.activeTextEditor) {
        sqlValidationProviderInstance.triggerUpdateDiagnostics(vscode.window.activeTextEditor.document);
    }
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor && editor.document.languageId === 'xml') {
                sqlValidationProviderInstance.triggerUpdateDiagnostics(editor.document);
            }
        }),
        vscode.workspace.onDidChangeTextDocument(event => {
            if (event.document.languageId === 'xml') {
                sqlValidationProviderInstance.triggerUpdateDiagnostics(event.document);
            }
        })
    );

    // SQL 定义 (跳转到定义)
    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider(
            { language: 'xml' },
            sqlDefinitionProvider
        )
    );

    // 架构文档提供者
    context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider(
            SchemaDocumentProvider.scheme,
            schemaProvider
        )
    );

    // XML 属性定义
    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider(
            { language: 'xml' },
            propertyDefinitionProvider
        )
    );

    // 3. 注册命令 (必须与 package.json 匹配)
    context.subscriptions.push(
        vscode.commands.registerCommand('mybatisToolkit.goToMapper', (uri: vscode.Uri) => {
            vscode.window.showTextDocument(uri);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('mybatisToolkit.goToXml', (uri: vscode.Uri) => {
            vscode.window.showTextDocument(uri);
        })
    );

    // 数据库浏览器
    const treeProvider = new DatabaseTreeDataProvider(dbServiceInstance);
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('mybatisToolkit.databaseExplorer', treeProvider)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('mybatisToolkit.addConnection', async () => {
            const type = await vscode.window.showQuickPick(['MySQL', 'PostgreSQL', 'Oracle', 'SQL Server', 'SQLite', 'DB2', 'H2', 'MariaDB'], { placeHolder: '选择数据库类型' });
            if (!type) return;

            const host = await vscode.window.showInputBox({ prompt: '数据库主机', placeHolder: 'localhost', value: 'localhost' });
            if (!host) return;
            const portStr = await vscode.window.showInputBox({ prompt: '数据库端口', placeHolder: '3306', value: '3306' });
            if (!portStr) return;
            const port = await parsePortInput(portStr);
            if (port === undefined) return;
            const user = await vscode.window.showInputBox({ prompt: '数据库用户名', placeHolder: 'root', value: 'root' });
            if (!user) return;
            const password = await vscode.window.showInputBox({ prompt: '数据库密码', password: true });
            if (password === undefined) return;
            const database = await vscode.window.showInputBox({ prompt: '数据库名称' });
            if (!database) return;

            const config = {
                id: Date.now().toString(),
                name: database,
                type: type as any,
                host,
                port,
                user,
                password,
                database
            };

            await dbServiceInstance.addConnection(config);
            // 可选：自动连接
            // await dbServiceInstance.connect(config.id);
        }),
        vscode.commands.registerCommand('mybatisToolkit.editConnection', async (item: ConnectionItem) => {
            if (!item || !item.config) return;
            const oldConfig = item.config;

            const dbTypes: vscode.QuickPickItem[] = ['MySQL', 'PostgreSQL', 'Oracle', 'SQL Server', 'SQLite', 'DB2', 'H2', 'MariaDB'].map(label => ({ label }));
            const selectedTypeItem = await vscode.window.showQuickPick(
                dbTypes,
                {
                    // 预选与 oldConfig.type 匹配的项
                    // 注意：'selection' 在简单的 showQuickPick 用法中可能不直接受支持，而不保留引用？
                    // 实际上，对于简单的项目，showQuickPick 不容易在选项中接受 'selection'。
                    // 为了预选，我们通常需要将其分开或仅依赖用户挑选。
                    // 但是等等，之前的代码通过了 `selection: [oldConfig.type]`。
                    // 让我们删除 'selection' 并依赖用户知道它是什么（也许放在占位符中？）
                    placeHolder: `选择数据库类型 (当前: ${oldConfig.type})`
                }
            );
            if (!selectedTypeItem) return;
            const type = selectedTypeItem.label;

            const host = await vscode.window.showInputBox({
                prompt: '数据库主机',
                placeHolder: 'localhost',
                value: oldConfig.host
            });
            if (!host) return;

            const portStr = await vscode.window.showInputBox({
                prompt: '数据库端口',
                placeHolder: '3306',
                value: oldConfig.port.toString()
            });
            if (!portStr) return;
            const port = await parsePortInput(portStr);
            if (port === undefined) return;

            const user = await vscode.window.showInputBox({
                prompt: '数据库用户名',
                placeHolder: 'root',
                value: oldConfig.user
            });
            if (!user) return;

            // 密码：留空以保持不变？还是显示 '***'？
            // 如果为空，用户可能意味着空密码或“不更改”。
            // 让我们通过占位符/提示解释来询问。
            // "留空以保持现有密码"
            const password = await vscode.window.showInputBox({
                prompt: '数据库密码 (留空则保持不变)',
                password: true,
                placeHolder: '******'
            });

            // 如果密码未定义 (Esc)，取消。如果为空字符串，保留旧的？
            // 实际上标准 InputBox 在 Esc 上返回 undefined，在 Enter 且无内容时返回空字符串。
            if (password === undefined) return;
            const finalPassword = password === '' ? oldConfig.password : password;

            const database = await vscode.window.showInputBox({
                prompt: '数据库名称',
                value: oldConfig.database
            });
            if (!database) return;

            const newConfig = {
                ...oldConfig,
                name: database, // 通常名称默认为数据库名称或用户自定义？
                // 如果我们想要自定义名称，我们需要另一个输入。目前保持简单：名称 = 数据库
                type: type as any,
                host,
                port,
                user,
                password: finalPassword,
                database
            };

            await dbServiceInstance.updateConnection(newConfig);
            if (item.isActive) {
                const reload = await vscode.window.showInformationMessage('连接配置已更新。是否重新连接？', '是', '否');
                if (reload === '是') {
                    await dbServiceInstance.connect(newConfig.id);
                }
            } else {
                vscode.window.showInformationMessage(`连接 ${newConfig.name} 已更新。`);
            }
        }),
        vscode.commands.registerCommand('mybatisToolkit.removeConnection', async (item: ConnectionItem) => {
            if (item && item.config) {
                const answer = await vscode.window.showWarningMessage(`确定要移除 ${item.config.name} 吗？`, '是', '否');
                if (answer === '是') {
                    await dbServiceInstance.removeConnection(item.config.id);
                }
            }
        }),
        vscode.commands.registerCommand('mybatisToolkit.connect', async (item: ConnectionItem) => {
            if (item && item.config) {
                await dbServiceInstance.connect(item.config.id);
                vscode.commands.executeCommand('setContext', 'mybatisToolkit.connected', true);
            }
        }),
        vscode.commands.registerCommand('mybatisToolkit.disconnect', async () => {
            await dbServiceInstance.disconnect();
            vscode.commands.executeCommand('setContext', 'mybatisToolkit.connected', false);
        }),
        vscode.commands.registerCommand('mybatisToolkit.refresh', async () => {
            await dbServiceInstance.refreshTables();
        }),
        vscode.commands.registerCommand('mybatisToolkit.selectConnection', async () => {
            const connections = dbServiceInstance.getConnections();
            if (connections.length === 0) {
                vscode.window.showInformationMessage('请先在数据库浏览器中添加连接。');
                return;
            }
            const picked = await vscode.window.showQuickPick(
                connections.map(c => ({
                    label: c.name,
                    description: `${c.type} · ${c.user}@${c.host}:${c.port}/${c.database}`,
                    id: c.id
                })),
                { placeHolder: '选择要连接的数据库' }
            );
            if (picked && picked.id) {
                await dbServiceInstance.connect(picked.id);
                vscode.commands.executeCommand('setContext', 'mybatisToolkit.connected', true);
            }
        }),
        vscode.commands.registerCommand('mybatisToolkit.newQuery', async () => {
            const doc = await vscode.workspace.openTextDocument({ language: 'sql', content: '' });
            await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.One });
        }),
        vscode.commands.registerCommand('mybatisToolkit.runSelectedSql', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.languageId !== 'sql') {
                vscode.window.showWarningMessage('请在 SQL 编辑器中执行，或先使用「新建查询窗口」打开 SQL 文件。');
                return;
            }
            if (!dbServiceInstance.isConnected()) {
                vscode.window.showWarningMessage('请先点击标题栏「选择数据库」连接后再执行。');
                return;
            }
            const selection = editor.selection;
            const text = selection.isEmpty ? editor.document.getText() : editor.document.getText(selection);
            const sql = text.trim();
            if (!sql) {
                vscode.window.showWarningMessage('请选中要执行的 SQL 或确保文档非空。');
                return;
            }
            const panel = QueryResultsPanel.createOrShow(context.extensionUri, '查询结果');
            const result = await dbServiceInstance.executeSql(sql, QUERY_DEFAULT_MAX_ROWS);
            if (result.message && result.columns.length === 0 && result.rows.length === 0) {
                panel.showError(result.message);
            } else {
                panel.showResult(result, sql, getQueryResultDateFormats());
            }
        }),
        vscode.commands.registerCommand('mybatisToolkit.runAllSql', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.languageId !== 'sql') {
                vscode.window.showWarningMessage('请在 SQL 编辑器中执行。');
                return;
            }
            if (!dbServiceInstance.isConnected()) {
                vscode.window.showWarningMessage('请先点击标题栏「选择数据库」连接后再执行。');
                return;
            }
            const fullText = editor.document.getText();
            const statements = fullText.split(';').map(s => s.trim()).filter(Boolean);
            if (statements.length === 0) {
                vscode.window.showWarningMessage('文档中无有效 SQL 语句。');
                return;
            }
            const formats = getQueryResultDateFormats();
            const total = statements.length;
            for (let i = 0; i < statements.length; i++) {
                const sql = statements[i];
                const runSql = sql.endsWith(';') ? sql : sql + ';';
                const title = total > 1 ? `查询结果 (${i + 1}/${total})` : '查询结果';
                const panel = QueryResultsPanel.createNew(context.extensionUri, title);
                const result = await dbServiceInstance.executeSql(runSql, QUERY_DEFAULT_MAX_ROWS);
                if (result.message && result.columns.length === 0 && result.rows.length === 0 && !result.message.includes('空语句')) {
                    panel.showError(result.message);
                } else if (result.columns.length > 0 || result.rows.length > 0) {
                    panel.showResult(result, sql, formats);
                } else {
                    panel.showResult(
                        { columns: [], rows: [], totalFetched: 0, affectedRows: result.affectedRows, executionTimeMs: result.executionTimeMs, message: result.message ?? '执行成功，无结果集' },
                        sql,
                        formats
                    );
                }
            }
        }),
        vscode.commands.registerCommand('mybatisToolkit.showFullStructure', async () => {
            if (!dbServiceInstance.isConnected()) {
                vscode.window.showWarningMessage('请先点击标题栏「选择数据库」连接后再执行。');
                return;
            }
            const panel = QueryResultsPanel.createOrShow(context.extensionUri, '全部结构');
            const tables = await dbServiceInstance.getTableNames();
            const columns = ['表名', '列名', '类型', '可空', '键', '默认', '注释'];
            const rows: any[][] = [];
            const maxTables = 200;
            const schemaConcurrency = 10;
            const selectedTables = tables.slice(0, maxTables);
            for (let i = 0; i < selectedTables.length; i += schemaConcurrency) {
                const chunk = selectedTables.slice(i, i + schemaConcurrency);
                const schemas = await Promise.all(chunk.map(t => dbServiceInstance.getTableSchema(t)));
                for (let j = 0; j < chunk.length; j++) {
                    const tableName = chunk[j];
                    for (const c of schemas[j]) {
                        rows.push([tableName, c.Field, c.Type, c.Null, c.Key, c.Default ?? '', c.Comment ?? '']);
                    }
                }
            }
            const result: QueryResult = {
                columns,
                rows,
                totalFetched: rows.length,
                message: tables.length > maxTables ? `仅显示前 ${maxTables} 张表的结构。` : undefined
            };
            panel.showResult(result, undefined, getQueryResultDateFormats());
        }),
        vscode.commands.registerCommand('mybatisToolkit.openTableSchema', async (tableName: string) => {
            const uri = vscode.Uri.parse(`${SchemaDocumentProvider.scheme}:///${tableName}.md`);
            await vscode.window.showTextDocument(uri);
        }),
        vscode.commands.registerCommand('mybatisToolkit.generateCode', async (item: TableItem) => {
            if (!item || !item.tableName) {
                return;
            }
            const basePackage = await vscode.window.showInputBox({
                prompt: '输入基础包名 (例如 com.example.demo)',
                placeHolder: 'com.example.demo',
                value: 'com.example.demo'
            });
            if (!basePackage) return;

            const stylePick = await vscode.window.showQuickPick(
                [
                    { label: '$(library) MyBatis-Plus (默认)', description: 'Entity 注解 + BaseMapper，XML 仅 resultMap', style: 'mybatis-plus' as const },
                    { label: '$(file-code) MyBatis', description: '传统 Mapper 接口 + 完整 XML CRUD', style: 'mybatis' as const }
                ],
                { placeHolder: '选择代码风格', ignoreFocusOut: true }
            );
            if (!stylePick) return;
            const codeGenStyle = stylePick.style;

            const roots = vscode.workspace.workspaceFolders;
            const defaultRoot = roots?.[0]?.uri.fsPath ?? '';

            interface FolderChoice extends vscode.QuickPickItem {
                choiceType: 'workspace' | 'pick' | 'input';
                root?: string;
            }
            const choices: FolderChoice[] = [];
            if (roots && roots.length > 0) {
                roots.forEach((f, i) => {
                    choices.push({
                        label: i === 0 ? `$(folder) ${f.name} (默认)` : `$(folder) ${f.name}`,
                        description: f.uri.fsPath,
                        choiceType: 'workspace',
                        root: f.uri.fsPath
                    });
                });
            }
            choices.push({ label: '$(folder-opened) 选择其他文件夹...', choiceType: 'pick' });
            choices.push({ label: '$(edit) 输入路径', description: defaultRoot || '输入项目根目录路径', choiceType: 'input' });

            const chosen = await vscode.window.showQuickPick(choices, {
                placeHolder: '选择或指定生成代码的基础目录（Entity/Mapper/XML 将生成在其下的 src/main/java、src/main/resources）',
                ignoreFocusOut: true,
                matchOnDescription: true
            });
            if (!chosen) return;

            let workspaceRoot: string;
            if (chosen.choiceType === 'workspace' && chosen.root) {
                workspaceRoot = chosen.root;
            } else if (chosen.choiceType === 'pick') {
                const uris = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectMany: false, defaultUri: roots?.[0]?.uri });
                if (!uris || uris.length === 0) return;
                workspaceRoot = uris[0].fsPath;
            } else if (chosen.choiceType === 'input') {
                const input = await vscode.window.showInputBox({
                    prompt: '输入基础路径（项目根目录）',
                    value: defaultRoot,
                    placeHolder: defaultRoot || '/path/to/project'
                });
                if (input === undefined || input.trim() === '') return;
                workspaceRoot = input.trim();
            } else {
                return;
            }

            await codeGenService.generateCode(item.tableName, basePackage, workspaceRoot, codeGenStyle);
        }),
        vscode.commands.registerCommand('mybatisToolkit.generateXmlForMethod', async (javaFileUriOrDoc: string | vscode.TextDocument, methodName: string, xmlFile: string) => {
            try {
                if (!methodName || !xmlFile) {
                    vscode.window.showErrorMessage('生成 XML：参数不完整（方法名或 XML 路径缺失）');
                    return;
                }
                // 兼容旧调用传 document；新调用传 uri 字符串，避免序列化问题
                const uriString = typeof javaFileUriOrDoc === 'string' ? javaFileUriOrDoc : javaFileUriOrDoc.uri.toString();
                const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(uriString));

                const text = document.getText();
                const methods = JavaAstUtils.getMethods(text);
                const methodInfo = methods.get(methodName);

                if (!methodInfo) {
                    vscode.window.showErrorMessage(`无法在文件中找到方法 ${methodName}`);
                    return;
                }

                const className = JavaAstUtils.getSimpleName(text) || '';
                const fullClassName = `${JavaAstUtils.getPackageName(text)}.${className}`;

                const params: { name: string; type: string }[] = [];
                methodInfo.params.forEach((type, name) => params.push({ name, type }));

                const returnType = methodInfo.returnType || '';
                const generator = new MethodSqlGenerator(indexerInstance);
                const sqlXml = generator.generateSql(methodName, returnType, params, fullClassName);

                if (!sqlXml) {
                    vscode.window.showErrorMessage(`无法为 ${methodName} 生成 SQL (不支持的操作类型?)`);
                    return;
                }

                const xmlPath = vscode.Uri.parse(xmlFile).fsPath;
                let xmlContent: string;
                try {
                    xmlContent = await fs.promises.readFile(xmlPath, 'utf-8');
                } catch (e) {
                    const msg = e instanceof Error ? e.message : String(e);
                    vscode.window.showErrorMessage(`读取 XML 文件失败: ${msg}`);
                    return;
                }
                if (xmlContent.includes(`id="${methodName}"`)) {
                    vscode.window.showInformationMessage(`XML 中已存在 id="${methodName}"，未重复插入`);
                    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(xmlPath));
                    await vscode.window.showTextDocument(doc);
                    return;
                }

                const closeTagIndex = xmlContent.lastIndexOf('</mapper>');
                if (closeTagIndex === -1) {
                    vscode.window.showErrorMessage('XML 文件格式不正确 (未找到 </mapper>)');
                    return;
                }

                const newContent = xmlContent.slice(0, closeTagIndex) + '\n  ' + sqlXml + '\n' + xmlContent.slice(closeTagIndex);
                try {
                    await fs.promises.writeFile(xmlPath, newContent, 'utf-8');
                } catch (e) {
                    const msg = e instanceof Error ? e.message : String(e);
                    vscode.window.showErrorMessage(`写入 XML 文件失败: ${msg}`);
                    return;
                }

                const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(xmlPath));
                await vscode.window.showTextDocument(doc);
                vscode.window.showInformationMessage(`已为方法 ${methodName} 生成 XML`);
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                vscode.window.showErrorMessage(`生成 XML 失败: ${msg}`);
            }
        })
    );

    outputChannel.appendLine('MyBatis Toolkit Pro 激活成功。');
}

export async function deactivate() {
    sqlValidationProviderInstance?.dispose();
    await dbServiceInstance?.dispose();
    indexerInstance?.dispose();
    ProjectIndexer.destroyInstance();
}