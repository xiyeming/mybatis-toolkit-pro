
import * as vscode from 'vscode';
import { ProjectIndexer } from './services/ProjectIndexer';
import { MyBatisCodeLensProvider } from './providers/MyBatisCodeLensProvider';
import { MapperIntentionProvider } from './providers/MapperIntentionProvider';
import { SqlFormattingProvider } from './providers/SqlFormattingProvider';
// import { DecorationProvider } from './providers/DecorationProvider'; // Removed
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

export function activate(context: vscode.ExtensionContext) {
    const outputChannel = vscode.window.createOutputChannel("MyBatis Toolkit");
    outputChannel.appendLine('MyBatis Toolkit Pro 正在激活...');

    // 1. 初始化服务
    const indexer = ProjectIndexer.getInstance(outputChannel);
    indexer.init(); // 异步启动

    const dbService = DatabaseService.getInstance();
    dbService.init();

    const codeGenService = new CodeGenerationService(dbService);

    // 2. 注册提供者
    const codeLensProvider = new MyBatisCodeLensProvider(indexer);
    const mapperIntentionProvider = new MapperIntentionProvider(indexer);
    const formatProvider = new SqlFormattingProvider(dbService);
    // const decorationProvider = new DecorationProvider(indexer); // Removed
    const sqlValidationProvider = new SqlValidationProvider(dbService, indexer);
    const sqlDefinitionProvider = new SqlDefinitionProvider(dbService, indexer);
    const propertyDefinitionProvider = new PropertyDefinitionProvider(indexer);
    const schemaProvider = new SchemaDocumentProvider(dbService);
    const hoverProvider = new MyBatisHoverProvider(indexer);

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

    const semanticTokensProvider = new SqlHighlightingProvider(dbService);
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

    // 装饰器 (代码高亮) - REMOVED
    // context.subscriptions.push(decorationProvider);

    // SQL 验证
    context.subscriptions.push(sqlValidationProvider);
    // 在活动编辑器更改和文档更改时触发验证
    if (vscode.window.activeTextEditor) {
        sqlValidationProvider.triggerUpdateDiagnostics(vscode.window.activeTextEditor.document);
    }
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) {
                sqlValidationProvider.triggerUpdateDiagnostics(editor.document);
            }
        }),
        vscode.workspace.onDidChangeTextDocument(event => {
            sqlValidationProvider.triggerUpdateDiagnostics(event.document);
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
    const treeProvider = new DatabaseTreeDataProvider(dbService);
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
                port: parseInt(portStr),
                user,
                password,
                database
            };

            await dbService.addConnection(config);
            // 可选：自动连接
            // await dbService.connect(config.id);
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
                port: parseInt(portStr),
                user,
                password: finalPassword,
                database
            };

            await dbService.updateConnection(newConfig);
            if (item.isActive) {
                const reload = await vscode.window.showInformationMessage('连接配置已更新。是否重新连接？', '是', '否');
                if (reload === '是') {
                    await dbService.connect(newConfig.id);
                }
            } else {
                vscode.window.showInformationMessage(`连接 ${newConfig.name} 已已更新。`);
            }
        }),
        vscode.commands.registerCommand('mybatisToolkit.removeConnection', async (item: ConnectionItem) => {
            if (item && item.config) {
                const answer = await vscode.window.showWarningMessage(`确定要移除 ${item.config.name} 吗？`, '是', '否');
                if (answer === '是') {
                    await dbService.removeConnection(item.config.id);
                }
            }
        }),
        vscode.commands.registerCommand('mybatisToolkit.connect', async (item: ConnectionItem) => {
            if (item && item.config) {
                await dbService.connect(item.config.id);
                vscode.commands.executeCommand('setContext', 'mybatisToolkit.connected', true);
            }
        }),
        vscode.commands.registerCommand('mybatisToolkit.disconnect', async () => {
            await dbService.disconnect();
            vscode.commands.executeCommand('setContext', 'mybatisToolkit.connected', false);
        }),
        vscode.commands.registerCommand('mybatisToolkit.refresh', async () => {
            await dbService.refreshTables();
        }),
        vscode.commands.registerCommand('mybatisToolkit.openTableSchema', async (tableName: string) => {
            const uri = vscode.Uri.parse(`${SchemaDocumentProvider.scheme}:///${tableName}.md`);
            await vscode.window.showTextDocument(uri);
        }),
        vscode.commands.registerCommand('mybatisToolkit.generateCode', async (item: TableItem) => {
            if (!item || !item.tableName) {
                return;
            }
            // 提示输入包名
            const basePackage = await vscode.window.showInputBox({
                prompt: '输入基础包名 (例如 com.example.demo)',
                placeHolder: 'com.example.demo',
                value: 'com.example.demo'
            });
            if (!basePackage) return;

            // 提示移除表前缀 (可选)
            // 目前保持简单或自动推断。
            // 服务处理生成逻辑。

            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                const root = vscode.workspace.workspaceFolders[0].uri.fsPath;
                await codeGenService.generateCode(item.tableName, basePackage, root);
            } else {
                vscode.window.showErrorMessage('未打开工作区');
            }
        })
    );

    outputChannel.appendLine('MyBatis Toolkit Pro 激活成功。');
}

export function deactivate() { }