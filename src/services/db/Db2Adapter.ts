import { ColumnInfo, ConnectionConfig, QueryResult } from '../../types';
import { IDbAdapter } from './IDbAdapter';

/** DB2 适配器（基于 ibm_db） */
export class Db2Adapter implements IDbAdapter {
    private conn: any;
    private ibmdb: any;
    private tableCache: Map<string, string> = new Map();

    private async loadIbmDb(): Promise<any> {
        if (this.ibmdb) return this.ibmdb;
        try {
            this.ibmdb = await import('ibm_db');
            return this.ibmdb;
        } catch {
            throw new Error('请先安装 ibm_db 依赖: npm install ibm_db');
        }
    }

    private buildConnStr(config: ConnectionConfig): string {
        return `HOSTNAME=${config.host};PORT=${config.port};DATABASE=${config.database};UID=${config.user};PWD=${config.password};`;
    }

    async connect(config: ConnectionConfig): Promise<void> {
        const ibmdb = await this.loadIbmDb();
        this.conn = ibmdb.openSync(this.buildConnStr(config));
    }

    async disconnect(): Promise<void> {
        if (this.conn) {
            this.conn.closeSync();
            this.conn = undefined;
        }
        this.tableCache.clear();
    }

    async getTableNames(): Promise<string[]> {
        if (!this.conn) return [];
        const rows = this.conn.querySync("SELECT TABNAME FROM SYSCAT.TABLES WHERE TABSCHEMA = CURRENT_SCHEMA AND TYPE = 'T' ORDER BY TABNAME");
        this.tableCache.clear();
        const names: string[] = [];
        for (const row of rows || []) {
            const name = row.TABNAME;
            names.push(name);
            this.tableCache.set(name, '');
        }
        return names;
    }

    getTableComment(_tableName: string): string | undefined {
        return undefined;
    }

    async getTableSchema(tableName: string): Promise<ColumnInfo[]> {
        if (!this.conn) return [];
        const rows = this.conn.querySync(
            `SELECT COLNAME AS "Field",
                    TYPENAME AS "Type",
                    NULLS AS "Null",
                    CASE WHEN KEYSEQ IS NOT NULL THEN 'PRI' ELSE '' END AS "Key",
                    DEFAULT AS "Default",
                    '' AS "Extra",
                    REMARKS AS "Comment"
             FROM SYSCAT.COLUMNS
             WHERE TABNAME = ? AND TABSCHEMA = CURRENT_SCHEMA
             ORDER BY COLNO`,
            [tableName]
        );
        const columns: ColumnInfo[] = (rows || []).map((row: any) => ({
            Field: row.Field,
            Type: row.Type || '',
            Null: row.Null,
            Key: row.Key || '',
            Default: row.Default,
            Extra: row.Extra || '',
            Comment: row.Comment || undefined
        }));
        return columns;
    }

    async getCreateTableStatement(tableName: string): Promise<string> {
        if (!this.conn) return '';
        const rows = this.conn.querySync('SELECT DDL FROM SYSCAT.TABLES WHERE TABNAME = ? AND TABSCHEMA = CURRENT_SCHEMA', [tableName]);
        return rows?.[0]?.DDL || '';
    }

    async executeSql(sql: string, maxRows = 500): Promise<QueryResult> {
        if (!this.conn) return { columns: [], rows: [], totalFetched: 0 };
        const trimmed = sql.trim();
        if (!trimmed) return { columns: [], rows: [], totalFetched: 0, message: '空语句' };
        const start = Date.now();
        try {
            const rows = this.conn.querySync(trimmed);
            const executionTimeMs = Date.now() - start;
            if (!Array.isArray(rows)) {
                return { columns: [], rows: [], totalFetched: 0, affectedRows: rows || 0, executionTimeMs };
            }
            const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
            const slice = rows.slice(0, maxRows);
            const rowArrays = slice.map((row: any) => columns.map((c: string) => row[c] ?? null));
            return {
                columns,
                rows: rowArrays,
                totalFetched: slice.length,
                executionTimeMs,
                message: rows.length > maxRows ? `已截断，仅显示前 ${maxRows} 行（共 ${rows.length} 行）` : undefined
            };
        } catch (e: any) {
            return { columns: [], rows: [], totalFetched: 0, message: e.message || String(e), executionTimeMs: Date.now() - start };
        }
    }
}
