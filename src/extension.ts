import * as vscode from 'vscode';
import { ProjectIndexer } from './services/ProjectIndexer';
import { MyBatisCodeLensProvider } from './providers/MyBatisCodeLensProvider';
import { SqlFormattingProvider } from './providers/SqlFormattingProvider';
import { DecorationProvider } from './providers/DecorationProvider';

export function activate(context: vscode.ExtensionContext) {
    const outputChannel = vscode.window.createOutputChannel("MyBatis Toolkit");
    outputChannel.appendLine('MyBatis Toolkit Pro is activating...');

    // 1. Initialize Service
    const indexer = ProjectIndexer.getInstance(outputChannel);
    indexer.init(); // Async start

    // 2. Register Providers
    // 2. Register Providers
    const codeLensProvider = new MyBatisCodeLensProvider(indexer);
    const formatProvider = new SqlFormattingProvider();
    const decorationProvider = new DecorationProvider(indexer);

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