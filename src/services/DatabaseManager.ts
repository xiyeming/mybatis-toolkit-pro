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
            // Probe for undocumented API methods
            console.log('Database Client API keys:', Object.keys(this.api || {}));
        }
    }

    public getApi(): DBCodeAPI | undefined {
        return this.api;
    }

    public async getTableSchema(tableName: string): Promise<string[]> {
        // Placeholder: If we can't get the connection, we can't get the schema.
        // We might need to ask the user to provide connection details or use a command.
        return [];
    }

    public async validateTable(tableName: string): Promise<boolean> {
        // TODO: Implement actual validation against the database
        // For now, return true to avoid false positives
        return true;
    }
}
