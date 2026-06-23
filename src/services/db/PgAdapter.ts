import { Pool } from 'pg';
import { ColumnInfo, ConnectionConfig, QueryResult } from '../../types';
import { IDbAdapter } from './IDbAdapter';

export class PgAdapter implements IDbAdapter {
    private pool: Pool | undefined;
    private tableCache: Map<string, string> = new Map();
    private schemaName = 'public';

    async connect(config: ConnectionConfig): Promise<void> {
        this.pool = new Pool({
            host: config.host,
            port: config.port,
            user: config.user,
            password: config.password,
            database: config.database,
            max: 10
        });
        const client = await this.pool.connect();
        client.release();
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
        const client = await this.pool.connect();
        try {
            const r = await client.query(
                `SELECT c.relname AS table_name, obj_description(c.oid, 'pg_class') AS comment
                 FROM pg_catalog.pg_class c
                 JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
                 WHERE c.relkind = 'r' AND n.nspname = $1
                 ORDER BY c.relname`,
                [this.schemaName]
            );
            this.tableCache.clear();
            const names: string[] = [];
            for (const row of r.rows) {
                const name = row.table_name;
                names.push(name);
                this.tableCache.set(name, row.comment || '');
            }
            return names;
        } finally {
            client.release();
        }
    }

    getTableComment(tableName: string): string | undefined {
        return this.tableCache.get(tableName);
    }

    async getTableSchema(tableName: string): Promise<ColumnInfo[]> {
        if (!this.pool) return [];
        const client = await this.pool.connect();
        try {
            const r = await client.query(
                `SELECT a.attname AS "Field",
                        pg_catalog.format_type(a.atttypid, a.atttypmod) AS "Type",
                        CASE WHEN a.attnotnull THEN 'NO' ELSE 'YES' END AS "Null",
                        CASE WHEN i.indisprimary THEN 'PRI' ELSE '' END AS "Key",
                        pg_catalog.pg_get_expr(d.adbin, d.adrelid) AS "Default",
                        '' AS "Extra",
                        pg_catalog.col_description(a.attrelid, a.attnum) AS "Comment"
                 FROM pg_catalog.pg_attribute a
                 LEFT JOIN pg_catalog.pg_attrdef d ON (a.attrelid, a.attnum) = (d.adrelid, d.adnum)
                 LEFT JOIN pg_catalog.pg_index i ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey) AND a.attnum > 0 AND NOT i.indispartial
                 WHERE a.attrelid = ($1::regclass) AND a.attnum > 0 AND NOT a.attisdropped
                 ORDER BY a.attnum`,
                [`${this.schemaName}.${tableName}`]
            );
            const columns: ColumnInfo[] = r.rows.map((row: any) => ({
                Field: row.Field,
                Type: row.Type,
                Null: row.Null,
                Key: row.Key || '',
                Default: row.Default,
                Extra: row.Extra || '',
                Comment: row.Comment || undefined
            }));
            return columns;
        } catch {
            return [];
        } finally {
            client.release();
        }
    }

    async getCreateTableStatement(tableName: string): Promise<string> {
        const cols = await this.getTableSchema(tableName);
        if (cols.length === 0) return '';
        const colDefs = cols.map(c => `  ${c.Field} ${c.Type} ${c.Null === 'NO' ? 'NOT NULL' : ''}`).join(',\n');
        return `CREATE TABLE ${tableName} (\n${colDefs}\n);`;
    }

    async executeSql(sql: string, maxRows = 500): Promise<QueryResult> {
        if (!this.pool) return { columns: [], rows: [], totalFetched: 0 };
        const trimmed = sql.trim();
        if (!trimmed) return { columns: [], rows: [], totalFetched: 0, message: '空语句' };
        const client = await this.pool.connect();
        const start = Date.now();
        try {
            const r = await client.query(trimmed);
            const executionTimeMs = Date.now() - start;
            const rawRows = r.rows || [];
            const cmd = (r as any).command || '';
            const rowCount = (r as any).rowCount;
            if (rawRows.length === 0 && typeof rowCount === 'number' && cmd !== 'SELECT') {
                return {
                    columns: [],
                    rows: [],
                    totalFetched: 0,
                    affectedRows: rowCount,
                    executionTimeMs
                };
            }
            const columns = r.fields ? r.fields.map((f: any) => f.name) : (rawRows[0] ? Object.keys(rawRows[0]) : []);
            const slice = rawRows.slice(0, maxRows);
            const rowArrays = slice.map((row: any) => columns.map(c => row[c] ?? null));
            return {
                columns,
                rows: rowArrays,
                totalFetched: slice.length,
                executionTimeMs,
                message: rawRows.length > maxRows ? `已截断，仅显示前 ${maxRows} 行（共 ${rawRows.length} 行）` : undefined
            };
        } catch (e: any) {
            return { columns: [], rows: [], totalFetched: 0, message: e.message || String(e), executionTimeMs: Date.now() - start };
        } finally {
            client.release();
        }
    }
}
