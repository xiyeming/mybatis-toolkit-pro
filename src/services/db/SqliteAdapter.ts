import { ColumnInfo, ConnectionConfig, QueryResult } from '../../types';
import { IDbAdapter } from './IDbAdapter';
import { loadDriver } from '../../utils/DriverLoader';

/** SQLite 适配器（基于 better-sqlite3） */
export class SqliteAdapter implements IDbAdapter {
    private db: any;
    private sqlite: any;
    private tableCache: Map<string, string> = new Map();

    private async loadSqlite(config: ConnectionConfig): Promise<any> {
        if (this.sqlite) return this.sqlite;
        this.sqlite = await loadDriver('better-sqlite3', config.driverPath);
        return this.sqlite;
    }

    async connect(config: ConnectionConfig): Promise<void> {
        const sqlite = await this.loadSqlite(config);
        // database 字段作为文件路径；为空时使用内存数据库
        const path = config.database || ':memory:';
        this.db = new sqlite.default(path);
    }

    async disconnect(): Promise<void> {
        if (this.db) {
            this.db.close();
            this.db = undefined;
        }
        this.tableCache.clear();
    }

    async getTableNames(): Promise<string[]> {
        if (!this.db) return [];
        const rows = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
        this.tableCache.clear();
        const names: string[] = [];
        for (const row of rows) {
            names.push(row.name);
            this.tableCache.set(row.name, '');
        }
        return names;
    }

    getTableComment(_tableName: string): string | undefined {
        // SQLite 原生不支持表注释
        return undefined;
    }

    async getTableSchema(tableName: string): Promise<ColumnInfo[]> {
        if (!this.db) return [];
        const rows = this.db.prepare(`PRAGMA table_info("${tableName.replace(/"/g, '""')}")`).all();
        const columns: ColumnInfo[] = rows.map((row: any) => ({
            Field: row.name,
            Type: row.type || '',
            Null: row.notnull ? 'NO' : 'YES',
            Key: row.pk ? 'PRI' : '',
            Default: row.dflt_value ?? null,
            Extra: '',
            Comment: undefined
        }));
        return columns;
    }

    async getCreateTableStatement(tableName: string): Promise<string> {
        if (!this.db) return '';
        const row = this.db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(tableName);
        return row?.sql || '';
    }

    async executeSql(sql: string, maxRows = 500): Promise<QueryResult> {
        if (!this.db) return { columns: [], rows: [], totalFetched: 0 };
        const trimmed = sql.trim();
        if (!trimmed) return { columns: [], rows: [], totalFetched: 0, message: '空语句' };
        const start = Date.now();
        try {
            const stmt = this.db.prepare(trimmed);
            const isSelect = /^\s*SELECT\s/i.test(trimmed);
            if (isSelect) {
                const rows = stmt.all();
                const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
                const slice = rows.slice(0, maxRows);
                const rowArrays = slice.map((row: any) => columns.map((c: string) => row[c] ?? null));
                return {
                    columns,
                    rows: rowArrays,
                    totalFetched: slice.length,
                    executionTimeMs: Date.now() - start,
                    message: rows.length > maxRows ? `已截断，仅显示前 ${maxRows} 行（共 ${rows.length} 行）` : undefined
                };
            } else {
                const result = stmt.run();
                return {
                    columns: [],
                    rows: [],
                    totalFetched: 0,
                    affectedRows: result.changes,
                    executionTimeMs: Date.now() - start
                };
            }
        } catch (e: any) {
            return { columns: [], rows: [], totalFetched: 0, message: e.message || String(e), executionTimeMs: Date.now() - start };
        }
    }
}
