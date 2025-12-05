import * as vscode from 'vscode';
import * as mysql from 'mysql2/promise';

export interface ColumnInfo {
    Field: string;
    Type: string;
    Null: string;
    Key: string;
    Default: string | null;
    Extra: string;
    Comment?: string;
}

export class DatabaseService {
    private static instance: DatabaseService;
    private pool: mysql.Pool | undefined;
    private outputChannel: vscode.OutputChannel;
    private tableCache: Set<string> = new Set();
    private connectionConfig: any = {};
    private _onDidReady = new vscode.EventEmitter<void>();
    public readonly onDidReady = this._onDidReady.event;
    private isReadyFlag = false;

    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel("MyBatis Database");
        this.loadConfig();

        // Reload config on change
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('mybatisToolkit.database')) {
                this.loadConfig();
                this.reconnect();
            }
        });
    }

    public static getInstance(): DatabaseService {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService();
        }
        return DatabaseService.instance;
    }

    private loadConfig() {
        const config = vscode.workspace.getConfiguration('mybatisToolkit.database');
        this.connectionConfig = {
            host: config.get<string>('host'),
            port: config.get<number>('port'),
            user: config.get<string>('user'),
            password: config.get<string>('password'),
            database: config.get<string>('database'),
            waitForConnections: true,
            connectionLimit: config.get<number>('connectionLimit', 10),
            queueLimit: 0
        };
    }

    private async reconnect() {
        this.isReadyFlag = false;
        if (this.pool) {
            await this.pool.end();
            this.pool = undefined;
        }
        this.tableCache.clear();
        await this.init();
    }

    public async init() {
        this.isReadyFlag = false;
        if (!this.connectionConfig.host || !this.connectionConfig.user || !this.connectionConfig.database) {
            this.outputChannel.appendLine('Database configuration missing. Please configure mybatisToolkit.database settings.');
            return;
        }

        try {
            this.pool = mysql.createPool(this.connectionConfig);
            // Test connection
            const connection = await this.pool.getConnection();
            this.outputChannel.appendLine(`Connected to database: ${this.connectionConfig.database}`);
            connection.release();

            await this.refreshTables();
            this.isReadyFlag = true;
            this._onDidReady.fire();
        } catch (error: any) {
            this.outputChannel.appendLine(`Failed to connect to database: ${error.message}`);
        }
    }

    public async refreshTables() {
        if (!this.pool) return;
        try {
            const [rows] = await this.pool.query<mysql.RowDataPacket[]>('SHOW TABLES');
            this.tableCache.clear();
            rows.forEach(row => {
                const tableName = Object.values(row)[0] as string;
                this.tableCache.add(tableName);
            });
            this.outputChannel.appendLine(`Refreshed ${this.tableCache.size} tables.`);
        } catch (error: any) {
            this.outputChannel.appendLine(`Failed to fetch tables: ${error.message}`);
        }
    }

    public hasTable(tableName: string): boolean {
        return this.tableCache.has(tableName);
    }

    public async getTableSchema(tableName: string): Promise<ColumnInfo[]> {
        if (!this.pool) return [];
        try {
            const [rows] = await this.pool.query<mysql.RowDataPacket[]>(`SHOW FULL COLUMNS FROM ${mysql.escapeId(tableName)}`);
            return rows as ColumnInfo[];
        } catch (error: any) {
            this.outputChannel.appendLine(`Failed to get schema for ${tableName}: ${error.message}`);
            return [];
        }
    }

    public async getCreateTableStatement(tableName: string): Promise<string> {
        if (!this.pool) return '';
        try {
            const [rows] = await this.pool.query<mysql.RowDataPacket[]>(`SHOW CREATE TABLE ${mysql.escapeId(tableName)}`);
            // row is { Table: 'tablename', 'Create Table': 'CREATE TABLE ...' }
            if (rows.length > 0 && rows[0]['Create Table']) {
                return rows[0]['Create Table'];
            }
            return '';
        } catch (error: any) {
            this.outputChannel.appendLine(`Failed to get DDL for ${tableName}: ${error.message}`);
            return '';
        }
    }

    public isConnected(): boolean {
        return !!this.pool;
    }

    public isReady(): boolean {
        return this.isReadyFlag;
    }
}
