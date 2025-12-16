import * as vscode from 'vscode';
import { DatabaseService } from '../services/DatabaseService';

export class SchemaDocumentProvider implements vscode.TextDocumentContentProvider {
    public static readonly scheme = 'mybatis-schema';
    private dbService: DatabaseService;

    constructor(dbService: DatabaseService) {
        this.dbService = dbService;
    }

    async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        let tableName = uri.path.replace(/^\//, ''); // 移除前导斜杠
        // 移除 .md 扩展名
        if (tableName.endsWith('.md')) {
            tableName = tableName.slice(0, -3);
        }

        const columns = await this.dbService.getTableSchema(tableName);
        const ddl = await this.dbService.getCreateTableStatement(tableName);

        if (!columns || columns.length === 0) {
            return `表 '${tableName}' 未找到或没有列。`;
        }

        let md = `# 表结构: ${tableName}\n\n`;

        // DDL 部分
        if (ddl) {
            md += `## DDL\n\n`;
            md += '```sql\n';
            md += ddl + '\n';
            md += '```\n\n';
        }

        // 列字段部分
        md += `## 列信息\n\n`;
        md += `| 字段 | 类型 | 键 | 空 | 默认值 | 注释 |\n`;
        md += `|---|---|---|---|---|---|\n`;

        columns.forEach(col => {
            const key = col.Key === 'PRI' ? '🔑 PK' : (col.Key === 'MUL' ? '🗝️ MUL' : (col.Key === 'UNI' ? '🌟 UNI' : ''));
            const nullable = col.Null === 'YES' ? '✅' : '❌';
            const def = col.Default === null ? 'NULL' : `\`${col.Default}\``;
            const comment = col.Comment || '';

            // 格式化类型以提高可读性
            let type = col.Type;
            if (type.includes('char') || type.includes('text')) {
                type = `🔤 ${type}`;
            } else if (type.includes('int') || type.includes('dec') || type.includes('float') || type.includes('double')) {
                type = `🔢 ${type}`;
            } else if (type.includes('date') || type.includes('time')) {
                type = `📅 ${type}`;
            }

            md += `| **${col.Field}** | ${type} | ${key} | ${nullable} | ${def} | ${comment} |\n`;
        });

        md += `\n\n---\n*由 MyBatis Toolkit Pro 生成*`;
        return md;
    }
}
