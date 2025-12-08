import * as vscode from 'vscode';
import { ProjectIndexer } from '../services/ProjectIndexer';
import { MethodSqlGenerator } from '../services/MethodSqlGenerator';
import { JavaAstUtils } from '../utils/JavaAstUtils';
import * as path from 'path';
import * as fs from 'fs';

export class MapperIntentionProvider implements vscode.CodeActionProvider {
    private generator: MethodSqlGenerator;

    constructor(private indexer: ProjectIndexer) {
        this.generator = new MethodSqlGenerator(indexer);
    }

    provideCodeActions(document: vscode.TextDocument, range: vscode.Range, context: vscode.CodeActionContext): vscode.CodeAction[] | undefined {
        if (document.languageId !== 'java') return;

        // Only run if we are in a @Mapper interface
        const text = document.getText();
        if (!text.includes('@Mapper') && !text.includes('interface')) return;

        // Determine method at cursor/range
        const methodLine = document.lineAt(range.start.line).text;
        const methodNameStr = JavaAstUtils.getMethodName(methodLine);
        if (!methodNameStr) return;

        // Check if this method already exists in XML
        // 1. Find XML file URI
        const mapperClass = this.getMapperClassName(document);
        if (!mapperClass) return;

        const xmlFile = this.indexer.getMapperPath(mapperClass);
        if (!xmlFile) return; // XML not found, maybe offer to create one?

        // 2. Check XML for id="methodName"
        const xmlContent = fs.readFileSync(vscode.Uri.parse(xmlFile).fsPath, 'utf-8');
        if (xmlContent.includes(`id="${methodNameStr}"`)) return; // Already exists

        // 3. Create Action
        const action = new vscode.CodeAction(`Generate XML for '${methodNameStr}'`, vscode.CodeActionKind.QuickFix);
        action.command = {
            command: 'mybatisToolkit.generateXmlForMethod',
            title: 'Generate XML',
            arguments: [document, methodNameStr, xmlFile]
        };

        return [action];
    }

    private getMapperClassName(document: vscode.TextDocument): string | null {
        // Simple regex to get package and class name
        const text = document.getText();
        const packageMatch = text.match(/package\s+([\w.]+);/);
        const classMatch = text.match(/interface\s+(\w+)/);

        if (packageMatch && classMatch) {
            return `${packageMatch[1]}.${classMatch[1]}`;
        }
        return null;
    }
}
