import * as vscode from 'vscode';
import { ProjectIndexer } from './services/ProjectIndexer';
import { MyBatisCodeLensProvider } from './providers/MyBatisCodeLensProvider';
import { SqlFormattingProvider } from './providers/SqlFormattingProvider';
import { DecorationProvider } from './providers/DecorationProvider';
import { DatabaseService } from './services/DatabaseService';
import { SqlValidationProvider } from './providers/SqlValidationProvider';
import { SqlDefinitionProvider } from './providers/SqlDefinitionProvider';
import { SchemaDocumentProvider } from './providers/SchemaDocumentProvider';

export function activate(context: vscode.ExtensionContext) {
    const outputChannel = vscode.window.createOutputChannel("MyBatis Toolkit");
    outputChannel.appendLine('MyBatis Toolkit Pro is activating...');

    // 1. Initialize Service
    const indexer = ProjectIndexer.getInstance(outputChannel);
    indexer.init(); // Async start

    const dbService = DatabaseService.getInstance();
    dbService.init();

    // 2. Register Providers
    const codeLensProvider = new MyBatisCodeLensProvider(indexer);
    const formatProvider = new SqlFormattingProvider();
    const decorationProvider = new DecorationProvider(indexer);
    const sqlValidationProvider = new SqlValidationProvider(dbService);
    const sqlDefinitionProvider = new SqlDefinitionProvider(dbService, indexer);
    const schemaProvider = new SchemaDocumentProvider(dbService);

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

    outputChannel.appendLine('MyBatis Toolkit Pro activated successfully.');
}

export function deactivate() { }