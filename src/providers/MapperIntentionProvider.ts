import * as vscode from 'vscode';
import { ProjectIndexer } from '../services/ProjectIndexer';
import { MethodSqlGenerator } from '../services/MethodSqlGenerator';
import { JavaAstUtils } from '../utils/JavaAstUtils';
import * as fs from 'fs';

export class MapperIntentionProvider implements vscode.CodeActionProvider {
    private generator: MethodSqlGenerator;

    constructor(private indexer: ProjectIndexer) {
        this.generator = new MethodSqlGenerator(indexer);
    }

    provideCodeActions(document: vscode.TextDocument, range: vscode.Range, context: vscode.CodeActionContext): vscode.CodeAction[] | undefined {
        if (document.languageId !== 'java') return;

        // 仅在 @Mapper 接口中运行
        const text = document.getText();
        if (!text.includes('@Mapper') && !text.includes('interface')) return;

        // 确定光标/范围处的方法
        const methodLine = document.lineAt(range.start.line).text;
        const methodNameStr = JavaAstUtils.getMethodName(methodLine);
        if (!methodNameStr) return;

        // 检查此方法是否已存在于 XML 中
        // 1. 查找 XML 文件 URI
        const mapperClass = this.getMapperClassName(document);
        if (!mapperClass) return;

        const xmlFile = this.indexer.getMapperPath(mapperClass);
        if (!xmlFile) return;

        // 2. 检查 XML 中是否已有该 id，避免重复生成
        try {
            const xmlContent = fs.readFileSync(vscode.Uri.parse(xmlFile).fsPath, 'utf-8');
            if (xmlContent.includes(`id="${methodNameStr}"`)) return;
        } catch {
            return; // 文件不存在或不可读时不提供 Quick Fix
        }

        // 3. 传 URI 字符串而非 document，避免命令序列化时 document 不可用
        const action = new vscode.CodeAction(`为 '${methodNameStr}' 生成 XML`, vscode.CodeActionKind.QuickFix);
        action.command = {
            command: 'mybatisToolkit.generateXmlForMethod',
            title: '生成 XML',
            arguments: [document.uri.toString(), methodNameStr, xmlFile]
        };

        return [action];
    }

    private getMapperClassName(document: vscode.TextDocument): string | null {
        // 获取包名和类名的简单正则
        const text = document.getText();
        const packageMatch = text.match(/package\s+([\w.]+);/);
        const classMatch = text.match(/interface\s+(\w+)/);

        if (packageMatch && classMatch) {
            return `${packageMatch[1]}.${classMatch[1]}`;
        }
        return null;
    }
}
