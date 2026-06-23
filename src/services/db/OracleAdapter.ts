import { ColumnInfo, ConnectionConfig, QueryResult } from '../../types';
import { IDbAdapter } from './IDbAdapter';

export class OracleAdapter implements IDbAdapter {
    private pool: any;
    private oracledb: any = null;
    private tableCache: Map<string, string> = new Map();
    private currentUser: string = '';

    private async loadOracle(): Promise<any> {
        if (this.oracledb) return this.oracledb;
        try {
            this.oracledb = await import('oracledb');
            return this.oracledb;
        } catch {
            throw new Error('请先安装 oracledb 依赖: npm install oracledb');
        }
    }

    async connect(config: ConnectionConfig): Promise<void> {
        const oracledb = await this.loadOracle();
        const connectString = `${config.host}:${config.port}/${config.database}`;
        this.pool = await oracledb.createPool({
            user: config.user,
            password: config.password,
            connectString,
            poolMin: 1,
            poolMax: 10
        });
        const conn = await this.pool.getConnection();
        const r = await conn.execute('SELECT USER FROM DUAL');
        this.currentUser = (r.rows && r.rows[0]) ? r.rows[0][0] : '';
        await conn.close();
    }

    async disconnect(): Promise<void> {
        if (this.pool) {
            await this.pool.close(10);
            this.pool = undefined;
        }
        this.tableCache.clear();
    }

    async getTableNames(): Promise<string[]> {
        if (!this.pool) return [];
        const conn = await this.pool.getConnection();
        try {
            const r = await conn.execute(
                `SELECT table_name, comments FROM user_tab_comments WHERE table_type = 'TABLE' ORDER BY table_name`
            );
            this.tableCache.clear();
            const names: string[] = [];
            if (r.rows) {
                for (const row of r.rows) {
                    const name = row[0];
                    names.push(name);
                    this.tableCache.set(name, row[1] || '');
                }
            }
            return names;
        } finally {
            await conn.close();
        }
    }

    getTableComment(tableName: string): string | undefined {
        return this.tableCache.get(tableName);
    }

    async getTableSchema(tableName: string): Promise<ColumnInfo[]> {
        if (!this.pool) return [];
        const conn = await this.pool.getConnection();
        try {
            const r = await conn.execute(
                `SELECT c.column_name AS "Field",
                        c.data_type || CASE WHEN c.data_type IN ('VARCHAR2','CHAR') THEN '(' || c.data_length || ')' ELSE '' END AS "Type",
                        c.nullable AS "Null",
                        (SELECT 'PRI' FROM user_cons_columns cc JOIN user_constraints uc ON cc.constraint_name = uc.constraint_name
                         WHERE uc.constraint_type = 'P' AND cc.table_name = c.table_name AND cc.column_name = c.column_name AND ROWNUM = 1) AS "Key",
                        c.data_default AS "Default",
                        '' AS "Extra",
                        com.comments AS "Comment"
                 FROM user_tab_columns c
                 LEFT JOIN user_col_comments com ON c.table_name = com.table_name AND c.column_name = com.column_name
                 WHERE c.table_name = :t
                 ORDER BY c.column_id`,
                { t: tableName }
            );
            const columns: ColumnInfo[] = (r.rows || []).map((row: any[]) => ({
                Field: row[0],
                Type: row[1] || '',
                Null: (row[2] || 'Y') === 'Y' ? 'YES' : 'NO',
                Key: row[3] || '',
                Default: row[4],
                Extra: row[5] || '',
                Comment: row[6] || undefined
            }));
            return columns;
        } finally {
            await conn.close();
        }
    }

    async getCreateTableStatement(_tableName: string): Promise<string> {
        return '';
    }

    async executeSql(sql: string, maxRows = 500): Promise<QueryResult> {
        if (!this.pool) return { columns: [], rows: [], totalFetched: 0 };
        const trimmed = sql.trim();
        if (!trimmed) return { columns: [], rows: [], totalFetched: 0, message: '空语句' };
        const conn = await this.pool.getConnection();
        const start = Date.now();
        try {
            const r = await conn.execute(trimmed);
            const executionTimeMs = Date.now() - start;
            const rows = r.rows || [];
            const metaData = (r as any).metaData;
            const columns: string[] = metaData ? metaData.map((m: any) => m.name) : (rows[0] ? Object.keys(rows[0] as object) : []);
            const rowsAffected = (r as any).rowsAffected;
            if (typeof rowsAffected === 'number' && (columns.length === 0 || rows.length === 0)) {
                return {
                    columns: [],
                    rows: [],
                    totalFetched: 0,
                    affectedRows: rowsAffected,
                    executionTimeMs
                };
            }
            const slice = rows.slice(0, maxRows);
            const rowArrays = slice.map((row: any) => (Array.isArray(row) ? row : columns.map((c: string) => (row as any)[c] ?? null)));
            return {
                columns,
                rows: rowArrays,
                totalFetched: slice.length,
                executionTimeMs,
                message: rows.length > maxRows ? `已截断，仅显示前 ${maxRows} 行（共 ${rows.length} 行）` : undefined
            };
        } catch (e: any) {
            return { columns: [], rows: [], totalFetched: 0, message: (e && e.message) || String(e), executionTimeMs: Date.now() - start };
        } finally {
            conn.close();
        }
    }
}
