import * as mysql from 'mysql2/promise';
import { ColumnInfo, ConnectionConfig, QueryResult } from '../../types';
import { IDbAdapter } from './IDbAdapter';

export class MySQLAdapter implements IDbAdapter {
    private pool: mysql.Pool | undefined;
    private tableCache: Map<string, string> = new Map();

    async connect(config: ConnectionConfig): Promise<void> {
        this.pool = mysql.createPool({
            host: config.host,
            port: config.port,
            user: config.user,
            password: config.password,
            database: config.database,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
        const conn = await this.pool.getConnection();
        conn.release();
    }

    async disconnect(): Promise<void> {
        if (this.pool) {
            await this.pool.end();
            this.pool = undefined;
        }
        this.tableCache.clear();
    }

    async getTableNames(): Promise<string[]> {
        if (!this.pool) return [];
        const [rows] = await this.pool.query<mysql.RowDataPacket[]>('SHOW TABLE STATUS');
        this.tableCache.clear();
        const names: string[] = [];
        rows.forEach(row => {
            const name = row['Name'];
            names.push(name);
            this.tableCache.set(name, row['Comment'] || '');
        });
        return names;
    }

    getTableComment(tableName: string): string | undefined {
        return this.tableCache.get(tableName);
    }

    async getTableSchema(tableName: string): Promise<ColumnInfo[]> {
        if (!this.pool) return [];
        const [rows] = await this.pool.query<mysql.RowDataPacket[]>(
            `SHOW FULL COLUMNS FROM ${mysql.escapeId(tableName)}`
        );
        const columns = rows as ColumnInfo[];
        return columns;
    }

    async getCreateTableStatement(tableName: string): Promise<string> {
        if (!this.pool) return '';
        const [rows] = await this.pool.query<mysql.RowDataPacket[]>(
            `SHOW CREATE TABLE ${mysql.escapeId(tableName)}`
        );
        return rows.length > 0 && rows[0]['Create Table'] ? rows[0]['Create Table'] : '';
    }

    async executeSql(sql: string, maxRows = 500): Promise<QueryResult> {
        if (!this.pool) return { columns: [], rows: [], totalFetched: 0 };
        const trimmed = sql.trim();
        if (!trimmed) return { columns: [], rows: [], totalFetched: 0, message: '空语句' };
        const start = Date.now();
        try {
            const [rows, fields] = await this.pool.query(trimmed);
            const executionTimeMs = Date.now() - start;
            const okPacket = rows as any;
            if (!Array.isArray(rows) && okPacket && typeof okPacket.affectedRows === 'number') {
                return {
                    columns: [],
                    rows: [],
                    totalFetched: 0,
                    affectedRows: okPacket.affectedRows,
                    executionTimeMs
                };
            }
            const rawRows = Array.isArray(rows) ? rows : [];
            const columns = (fields as mysql.FieldPacket[]).map(f => f.name);
            const slice = rawRows.slice(0, maxRows);
            const rowArrays = slice.map((r: any) => columns.map(c => r[c] ?? null));
            return {
                columns,
                rows: rowArrays,
                totalFetched: slice.length,
                executionTimeMs,
                message: rawRows.length > maxRows ? `已截断，仅显示前 ${maxRows} 行（共 ${rawRows.length} 行）` : undefined
            };
        } catch (e: any) {
            return { columns: [], rows: [], totalFetched: 0, message: e.message || String(e), executionTimeMs: Date.now() - start };
        }
    }
}
