import * as vscode from 'vscode';
import { ColumnInfo, ConnectionConfig, QueryResult } from '../types';
import { createDbAdapter, IDbAdapter } from './db';
import { getConnections as getConfigConnections } from '../config';
import { LruCache } from '../utils/LruCache';
import { DB_TABLE_CACHE_SIZE, DB_SCHEMA_CACHE_SIZE } from '../constants';

export class DatabaseService {
    private static instance: DatabaseService;
    private connections: ConnectionConfig[] = [];
    private activeConnectionId: string | undefined;
    private activeAdapter: IDbAdapter | undefined;
    private secretStorage: vscode.SecretStorage | undefined;

    private tableCache: LruCache<string, string> = new LruCache(DB_TABLE_CACHE_SIZE);
    private schemaCache: LruCache<string, ColumnInfo[]> = new LruCache(DB_SCHEMA_CACHE_SIZE);

    private outputChannel: vscode.OutputChannel;
    private _onDidReady = new vscode.EventEmitter<void>();
    public readonly onDidReady = this._onDidReady.event;
    private _onDidConfigChange = new vscode.EventEmitter<void>();
    public readonly onDidConfigChange = this._onDidConfigChange.event;

    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel("MyBatis Database");
        // 连接配置在 init(secretStorage) 中异步加载，避免在扩展宿主中执行同步 I/O
    }

    public static getInstance(): DatabaseService {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService();
        }
        return DatabaseService.instance;
    }

    /**
     * 初始化数据库服务。必须在 getInstance 之后调用，以注入 SecretStorage 并加载连接。
     */
    public async init(secretStorage: vscode.SecretStorage): Promise<void> {
        this.secretStorage = secretStorage;
        await this.loadConnections();
    }

    private async loadConnections() {
        const rawConnections = getConfigConnections();
        this.connections = rawConnections.map(c => ({ ...c, password: c.password ?? '' }));
        // 从 SecretStorage 读取密码；若配置中仍有旧明文密码则迁移到 secrets 后从 settings 清除
        for (const c of this.connections) {
            const stored = await this.getPassword(c.id);
            if (stored !== undefined) {
                c.password = stored;
            } else if (c.password) {
                await this.storePassword(c.id, c.password);
            }
        }
        // 立即保存一次，确保 settings.json 中不再包含明文密码
        await this.saveConnections();
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
        await this.deletePassword(id);
        await this.saveConnections();
    }

    public async updateConnection(config: ConnectionConfig) {
        const index = this.connections.findIndex(c => c.id === config.id);
        if (index !== -1) {
            this.connections[index] = config;
            await this.saveConnections();
        }
    }

    private async saveConnections() {
        const config = vscode.workspace.getConfiguration('mybatisToolkit');
        // settings.json 中仅保存不含密码的连接元数据
        const sanitized = this.connections.map(c => {
            const { password, ...rest } = c;
            return rest;
        });
        await config.update('connections', sanitized, vscode.ConfigurationTarget.Global);

        if (this.secretStorage) {
            for (const c of this.connections) {
                if (c.password !== undefined) {
                    await this.storePassword(c.id, c.password);
                }
            }
        }
        this._onDidConfigChange.fire();
    }

    private getPasswordKey(id: string): string {
        return `mybatisToolkit.connection.password.${id}`;
    }

    private async storePassword(id: string, password: string): Promise<void> {
        if (!this.secretStorage) { return; }
        await this.secretStorage.store(this.getPasswordKey(id), password);
    }

    private async getPassword(id: string): Promise<string | undefined> {
        if (!this.secretStorage) { return undefined; }
        return this.secretStorage.get(this.getPasswordKey(id));
    }

    private async deletePassword(id: string): Promise<void> {
        if (!this.secretStorage) { return; }
        await this.secretStorage.delete(this.getPasswordKey(id));
    }

    public async connect(id: string) {
        const config = this.connections.find(c => c.id === id);
        if (!config) return;

        await this.disconnect();

        this.outputChannel.appendLine(`正在连接到 ${config.name} (${config.host}) [${config.type}]...`);
        try {
            const adapter = createDbAdapter(config);
            await adapter.connect(config);
            this.activeAdapter = adapter;
            this.activeConnectionId = id;

            this.outputChannel.appendLine(`已连接到数据库: ${config.database}`);
            await this.refreshTables();
            this._onDidReady.fire();
            this._onDidConfigChange.fire();
        } catch (error: any) {
            this.outputChannel.appendLine(`连接 ${config.name} 失败: ${error.message}`);
            vscode.window.showErrorMessage(`连接 ${config.name} 失败: ${error.message}`);
            this.activeAdapter = undefined;
            this.activeConnectionId = undefined;
        }
    }

    public async disconnect() {
        if (this.activeAdapter) {
            await this.activeAdapter.disconnect();
            this.activeAdapter = undefined;
        }
        this.activeConnectionId = undefined;
        this.tableCache.clear();
        this.schemaCache.clear();
        this._onDidConfigChange.fire();
    }

    public getActiveConnectionId(): string | undefined {
        return this.activeConnectionId;
    }

    public getActiveDatabaseType(): string | undefined {
        if (!this.activeConnectionId) return undefined;
        const config = this.connections.find(c => c.id === this.activeConnectionId);
        return config?.type;
    }

    public async refreshTables() {
        if (!this.activeAdapter) return;
        try {
            const names = await this.activeAdapter.getTableNames();
            this.tableCache.clear();
            this.schemaCache.clear();
            for (const name of names) {
                const comment = this.activeAdapter.getTableComment(name) || '';
                this.tableCache.set(name, comment);
            }
            this.outputChannel.appendLine(`已刷新 ${this.tableCache.size()} 张表。`);
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
        if (!this.activeAdapter) return [];
        if (this.schemaCache.has(tableName)) {
            return this.schemaCache.get(tableName)!;
        }
        try {
            const columns = await this.activeAdapter.getTableSchema(tableName);
            this.schemaCache.set(tableName, columns);
            return columns;
        } catch (error: any) {
            this.outputChannel.appendLine(`获取 ${tableName} 的架构失败: ${error.message}`);
            return [];
        }
    }

    public async getCreateTableStatement(tableName: string): Promise<string> {
        if (!this.activeAdapter) return '';
        try {
            return await this.activeAdapter.getCreateTableStatement(tableName);
        } catch (error: any) {
            this.outputChannel.appendLine(`获取 ${tableName} 的 DDL 失败: ${error.message}`);
            return '';
        }
    }

    public isConnected(): boolean {
        return !!this.activeAdapter;
    }

    public isReady(): boolean {
        return !!this.activeAdapter && this.tableCache.size() > 0;
    }

    /** 执行 SQL（用于查询窗口），最多返回 maxRows 行以保证性能 */
    public async executeSql(sql: string, maxRows = 500): Promise<QueryResult> {
        if (!this.activeAdapter) {
            return { columns: [], rows: [], totalFetched: 0, message: '请先选择并连接数据库' };
        }
        return this.activeAdapter.executeSql(sql, maxRows);
    }

    public async testConnection(config: ConnectionConfig): Promise<{ success: boolean; message: string }> {
        this.outputChannel.appendLine(`[测试连接] 开始: 类型=${config.type}, 主机=${config.host}, 端口=${config.port}, 数据库=${config.database}, 用户=${config.user}, 驱动路径=${config.driverPath || '默认'}`);
        let adapter: IDbAdapter | undefined;
        const start = Date.now();
        try {
            adapter = createDbAdapter(config);
            this.outputChannel.appendLine(`[测试连接] 适配器已创建: ${adapter.constructor.name}`);
            await adapter.connect(config);
            const elapsed = Date.now() - start;
            this.outputChannel.appendLine(`[测试连接] 成功 (${elapsed}ms): ${config.host}:${config.port}/${config.database}`);
            await adapter.disconnect();
            return { success: true, message: `连接成功 (${config.host}:${config.port}/${config.database})` };
        } catch (error: any) {
            const elapsed = Date.now() - start;
            this.outputChannel.appendLine(`[测试连接] 失败 (${elapsed}ms): ${error.message || String(error)}`);
            if (adapter) {
                try { await adapter.disconnect(); } catch { /* ignore cleanup errors */ }
            }
            return { success: false, message: error.message || String(error) };
        }
    }

    /** 释放数据库连接与事件发射器 */
    public async dispose(): Promise<void> {
        await this.disconnect();
        this.connections = [];
        this._onDidReady.dispose();
        this._onDidConfigChange.dispose();
        this.outputChannel.dispose();
    }
}
