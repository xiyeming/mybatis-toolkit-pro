import * as vscode from 'vscode';
import { ProjectIndexer } from './services/ProjectIndexer';
import { MyBatisCodeLensProvider } from './providers/MyBatisCodeLensProvider';
import { MapperIntentionProvider } from './providers/MapperIntentionProvider';
import { SqlFormattingProvider } from './providers/SqlFormattingProvider';
import { DecorationProvider } from './providers/DecorationProvider';
import { DatabaseService } from './services/DatabaseService';
import { SqlValidationProvider } from './providers/SqlValidationProvider';
import { SqlDefinitionProvider } from './providers/SqlDefinitionProvider';
import { PropertyDefinitionProvider } from './providers/PropertyDefinitionProvider';
import { SchemaDocumentProvider } from './providers/SchemaDocumentProvider';
import { DatabaseTreeDataProvider, ConnectionItem, TableItem } from './providers/DatabaseTreeDataProvider';
import { CodeGenerationService } from './services/CodeGenerationService';
import { MethodSqlGenerator } from './services/MethodSqlGenerator';

export function activate(context: vscode.ExtensionContext) {
    const outputChannel = vscode.window.createOutputChannel("MyBatis Toolkit");
    outputChannel.appendLine('MyBatis Toolkit Pro is activating...');

    // 1. Initialize Service
    const indexer = ProjectIndexer.getInstance(outputChannel);
    indexer.init(); // Async start

    const dbService = DatabaseService.getInstance();
    dbService.init();

    const codeGenService = new CodeGenerationService(dbService);

    // 2. Register Providers
    const codeLensProvider = new MyBatisCodeLensProvider(indexer);
    const mapperIntentionProvider = new MapperIntentionProvider(indexer);
    const formatProvider = new SqlFormattingProvider();
    const decorationProvider = new DecorationProvider(indexer);
    const sqlValidationProvider = new SqlValidationProvider(dbService, indexer);
    const sqlDefinitionProvider = new SqlDefinitionProvider(dbService, indexer);
    const propertyDefinitionProvider = new PropertyDefinitionProvider(indexer);
    const schemaProvider = new SchemaDocumentProvider(dbService);

    // 0. Code Action (Generate XML)
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

    // Formatting
    context.subscriptions.push(
        vscode.languages.registerDocumentFormattingEditProvider(
            { language: 'xml' },
            formatProvider
        )
    );

    // Decorations (Color Highlighting)
    context.subscriptions.push(decorationProvider);

    // SQL Validation
    context.subscriptions.push(sqlValidationProvider);
    // Trigger validation on active editor change and document change
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

    // SQL Definition (Go to Definition)
    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider(
            { language: 'xml' },
            sqlDefinitionProvider
        )
    );

    // Schema Document Provider
    context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider(
            SchemaDocumentProvider.scheme,
            schemaProvider
        )
    );

    // XML Property Definition
    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider(
            { language: 'xml' },
            propertyDefinitionProvider
        )
    );

    // 3. Register Commands (must match package.json)
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

    // Database Explorer
    const treeProvider = new DatabaseTreeDataProvider(dbService);
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('mybatisToolkit.databaseExplorer', treeProvider)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('mybatisToolkit.addConnection', async () => {
            const host = await vscode.window.showInputBox({ prompt: 'Database Host', placeHolder: 'localhost', value: 'localhost' });
            if (!host) return;
            const portStr = await vscode.window.showInputBox({ prompt: 'Database Port', placeHolder: '3306', value: '3306' });
            if (!portStr) return;
            const user = await vscode.window.showInputBox({ prompt: 'Database User', placeHolder: 'root', value: 'root' });
            if (!user) return;
            const password = await vscode.window.showInputBox({ prompt: 'Database Password', password: true });
            if (password === undefined) return;
            const database = await vscode.window.showInputBox({ prompt: 'Database Name' });
            if (!database) return;

            const config = {
                id: Date.now().toString(),
                name: database,
                host,
                port: parseInt(portStr),
                user,
                password,
                database
            };

            await dbService.addConnection(config);
            // Optionally auto-connect
            // await dbService.connect(config.id);
        }),
        vscode.commands.registerCommand('mybatisToolkit.removeConnection', async (item: ConnectionItem) => {
            if (item && item.config) {
                const answer = await vscode.window.showWarningMessage(`Are you sure you want to remove ${item.config.name}?`, 'Yes', 'No');
                if (answer === 'Yes') {
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
            // Prompt for Package
            const basePackage = await vscode.window.showInputBox({
                prompt: 'Enter Base Package (e.g. com.example.demo)',
                placeHolder: 'com.example.demo',
                value: 'com.example.demo'
            });
            if (!basePackage) return;

            // Prompt for Table Prefix Removal (Optional)
            // For now, let's keep it simple or infer it.
            // Service handles generation.

            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                const root = vscode.workspace.workspaceFolders[0].uri.fsPath;
                await codeGenService.generateCode(item.tableName, basePackage, root);
            } else {
                vscode.window.showErrorMessage('No workspace open');
            }
        })
    );

    outputChannel.appendLine('MyBatis Toolkit Pro activated successfully.');
}

export function deactivate() { }