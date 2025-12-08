import * as vscode from 'vscode';
import * as mysql from 'mysql2/promise';
import { ColumnInfo, ConnectionConfig } from '../types';



export class DatabaseService {
    private static instance: DatabaseService;
    private connections: ConnectionConfig[] = [];
    private activeConnectionId: string | undefined;
    private activePool: mysql.Pool | undefined;

    // Caches are now specific to the active connection
    private tableCache: Map<string, string> = new Map(); // Table Name -> Comment
    private schemaCache: Map<string, ColumnInfo[]> = new Map();

    private outputChannel: vscode.OutputChannel;
    private _onDidReady = new vscode.EventEmitter<void>();
    public readonly onDidReady = this._onDidReady.event;
    private _onDidConfigChange = new vscode.EventEmitter<void>();
    public readonly onDidConfigChange = this._onDidConfigChange.event;

    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel("MyBatis Database");
        this.loadConnections();
    }

    public static getInstance(): DatabaseService {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService();
        }
        return DatabaseService.instance;
    }

    // ... [omitted loadConnections, add/remove/save methods] ...

    // (Assume other methods are unchanged up to refreshTables)

    // I need to be careful with replace_file_content scope. 
    // It's safer to target specific blocks.
    // Let's replace the properties and refreshTables method.


    private loadConnections() {
        const config = vscode.workspace.getConfiguration('mybatisToolkit');
        this.connections = config.get<ConnectionConfig[]>('connections', []);

        // Load potentially existing legacy config as a connection if no connections exist
        if (this.connections.length === 0) {
            const dbConfig = vscode.workspace.getConfiguration('mybatisToolkit.database');
            if (dbConfig.get('host') && dbConfig.get('database')) {
                const legacy: ConnectionConfig = {
                    id: 'default',
                    name: 'Default',
                    host: dbConfig.get('host', 'localhost'),
                    port: dbConfig.get('port', 3306),
                    user: dbConfig.get('user', 'root'),
                    password: dbConfig.get('password', ''),
                    database: dbConfig.get('database', '')
                };
                this.addConnection(legacy);
            }
        }
    }

    public getConnections(): ConnectionConfig[] {
        return this.connections;
    }

    public async addConnection(config: ConnectionConfig) {
        this.connections.push(config);
        await this.saveConnections();
    }

    public async removeConnection(id: string) {
        this.connections = this.connections.filter(c => c.id !== id);
        if (this.activeConnectionId === id) {
            await this.disconnect();
        }
        await this.saveConnections();
    }

    private async saveConnections() {
        const config = vscode.workspace.getConfiguration('mybatisToolkit');
        await config.update('connections', this.connections, vscode.ConfigurationTarget.Global);
        this._onDidConfigChange.fire();
    }

    public async connect(id: string) {
        const config = this.connections.find(c => c.id === id);
        if (!config) return;

        await this.disconnect();

        this.outputChannel.appendLine(`Connecting to ${config.name} (${config.host})...`);
        try {
            this.activePool = mysql.createPool({
                host: config.host,
                port: config.port,
                user: config.user,
                password: config.password,
                database: config.database,
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0
            });

            // Test connection
            const connection = await this.activePool.getConnection();
            connection.release();

            this.activeConnectionId = id;
            this.outputChannel.appendLine(`Connected to database: ${config.database}`);

            await this.refreshTables();
            this._onDidReady.fire();
            this._onDidConfigChange.fire(); // Notify UI to update icons
        } catch (error: any) {
            this.outputChannel.appendLine(`Failed to connect to ${config.name}: ${error.message}`);
            vscode.window.showErrorMessage(`Failed to connect to ${config.name}: ${error.message}`);
            this.activePool = undefined;
            this.activeConnectionId = undefined;
        }
    }

    public async disconnect() {
        if (this.activePool) {
            await this.activePool.end();
            this.activePool = undefined;
        }
        this.activeConnectionId = undefined;
        this.tableCache.clear();
        this.schemaCache.clear();
        this._onDidConfigChange.fire();
    }

    public getActiveConnectionId(): string | undefined {
        return this.activeConnectionId;
    }

    public async init() {
        // Auto-connect to the first available connection or last used (todo)
        if (this.connections.length > 0) {
            // await this.connect(this.connections[0].id);
        }
    }

    public async refreshTables() {
        if (!this.activePool) return;
        try {
            // SHOW TABLE STATUS returns Name, Comment, etc.
            const [rows] = await this.activePool.query<mysql.RowDataPacket[]>('SHOW TABLE STATUS');
            this.tableCache.clear();
            this.schemaCache.clear();
            rows.forEach(row => {
                const tableName = row['Name'];
                const comment = row['Comment'] || '';
                this.tableCache.set(tableName, comment);
            });
            this.outputChannel.appendLine(`Refreshed ${this.tableCache.size} tables.`);
        } catch (error: any) {
            this.outputChannel.appendLine(`Failed to fetch tables: ${error.message}`);
        }
    }

    public hasTable(tableName: string): boolean {
        return this.tableCache.has(tableName);
    }

    public async getTableNames(): Promise<string[]> {
        return Array.from(this.tableCache.keys());
    }

    public getTableComment(tableName: string): string | undefined {
        return this.tableCache.get(tableName);
    }

    public async getTableSchema(tableName: string): Promise<ColumnInfo[]> {
        if (!this.activePool) return [];
        if (this.schemaCache.has(tableName)) {
            return this.schemaCache.get(tableName)!;
        }

        try {
            const [rows] = await this.activePool.query<mysql.RowDataPacket[]>(`SHOW FULL COLUMNS FROM ${mysql.escapeId(tableName)}`);
            const columns = rows as ColumnInfo[];
            this.schemaCache.set(tableName, columns);
            return columns;
        } catch (error: any) {
            this.outputChannel.appendLine(`Failed to get schema for ${tableName}: ${error.message}`);
            return [];
        }
    }

    public async getCreateTableStatement(tableName: string): Promise<string> {
        if (!this.activePool) return '';
        try {
            const [rows] = await this.activePool.query<mysql.RowDataPacket[]>(`SHOW CREATE TABLE ${mysql.escapeId(tableName)}`);
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
        return !!this.activePool;
    }

    public isReady(): boolean {
        return !!this.activePool && this.tableCache.size > 0;
    }
}
