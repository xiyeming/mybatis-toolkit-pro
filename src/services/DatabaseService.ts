import * as vscode from 'vscode';
import * as mysql from 'mysql2/promise';
import { ColumnInfo, ConnectionConfig } from '../types';



export class DatabaseService {
    private static instance: DatabaseService;
    private connections: ConnectionConfig[] = [];
    private activeConnectionId: string | undefined;
    private activePool: mysql.Pool | undefined;

    // 缓存现在特定于活动连接
    private tableCache: Map<string, string> = new Map(); // 表名 -> 注释
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

    // 我需要小心 replace_file_content 的范围。
    // 针对特定块更安全。
    // 让我们替换属性和 refreshTables 方法。


    private loadConnections() {
        const config = vscode.workspace.getConfiguration('mybatisToolkit');
        this.connections = config.get<ConnectionConfig[]>('connections', []);

        // 如果不存在连接，则加载可能存在的旧配置作为连接
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

        this.outputChannel.appendLine(`正在连接到 ${config.name} (${config.host})...`);
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

            // 测试连接
            const connection = await this.activePool.getConnection();
            connection.release();

            this.activeConnectionId = id;
            this.outputChannel.appendLine(`已连接到数据库: ${config.database}`);

            await this.refreshTables();
            this._onDidReady.fire();
            this._onDidConfigChange.fire(); // 通知 UI 更新图标
        } catch (error: any) {
            this.outputChannel.appendLine(`连接 ${config.name} 失败: ${error.message}`);
            vscode.window.showErrorMessage(`连接 ${config.name} 失败: ${error.message}`);
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
        // 自动连接到第一个可用连接或上次使用的 (待办)
        if (this.connections.length > 0) {
            // await this.connect(this.connections[0].id);
        }
    }

    public async refreshTables() {
        if (!this.activePool) return;
        try {
            // SHOW TABLE STATUS 返回名称、注释等
            const [rows] = await this.activePool.query<mysql.RowDataPacket[]>('SHOW TABLE STATUS');
            this.tableCache.clear();
            this.schemaCache.clear();
            rows.forEach(row => {
                const tableName = row['Name'];
                const comment = row['Comment'] || '';
                this.tableCache.set(tableName, comment);
            });
            this.outputChannel.appendLine(`已刷新 ${this.tableCache.size} 张表。`);
        } catch (error: any) {
            this.outputChannel.appendLine(`获取表失败: ${error.message}`);
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
            this.outputChannel.appendLine(`获取 ${tableName} 的架构失败: ${error.message}`);
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
            this.outputChannel.appendLine(`获取 ${tableName} 的 DDL 失败: ${error.message}`);
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
