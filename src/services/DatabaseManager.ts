import * as vscode from 'vscode';
import { DBCodeAPI } from '@dbcode/vscode-api';

export class DatabaseManager {
    private api: DBCodeAPI | undefined;
    private static instance: DatabaseManager;

    private constructor() {
        this.init();
    }

    public static getInstance(): DatabaseManager {
        if (!DatabaseManager.instance) {
            DatabaseManager.instance = new DatabaseManager();
        }
        return DatabaseManager.instance;
    }

    private async init() {
        const ext = vscode.extensions.getExtension('cweijan.vscode-database-client2');
        if (ext) {
            if (!ext.isActive) {
                await ext.activate();
            }
            this.api = ext.exports;
            // 探测未记录的 API 方法
            console.log('Database Client API keys:', Object.keys(this.api || {}));
        }
    }

    public getApi(): DBCodeAPI | undefined {
        return this.api;
    }

    public async getTableSchema(tableName: string): Promise<string[]> {
        // 占位符：如果我们无法获取连接，我们就无法获取 schema。
        // 我们可能需要要求用户提供连接详细信息或使用命令。
        return [];
    }

    public async validateTable(tableName: string): Promise<boolean> {
        // 待办: 实现针对数据库的实际验证
        // 目前返回 true 以避免误报
        return true;
    }
}
