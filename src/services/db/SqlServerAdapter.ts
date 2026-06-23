import { ColumnInfo, ConnectionConfig, QueryResult } from '../../types';
import { IDbAdapter } from './IDbAdapter';
import { loadDriver } from '../../utils/DriverLoader';

/** SQL Server 适配器（基于 mssql） */
export class SqlServerAdapter implements IDbAdapter {
    private pool: any;
    private mssql: any;
    private tableCache: Map<string, string> = new Map();

    private async loadMssql(config: ConnectionConfig): Promise<any> {
        if (this.mssql) return this.mssql;
        this.mssql = await loadDriver('mssql', config.driverPath);
        return this.mssql;
    }

    async connect(config: ConnectionConfig): Promise<void> {
        const mssql = await this.loadMssql(config);
        this.pool = new mssql.ConnectionPool({
            server: config.host,
            port: config.port,
            user: config.user,
            password: config.password,
            database: config.database,
            options: {
                trustServerCertificate: true,
                encrypt: false
            }
        });
        await this.pool.connect();
    }

    async disconnect(): Promise<void> {
        if (this.pool) {
            await this.pool.close();
            this.pool = undefined;
        }
        this.tableCache.clear();
    }

    async getTableNames(): Promise<string[]> {
        if (!this.pool) return [];
        const result = await this.pool.request().query(`
            SELECT t.name AS table_name, ep.value AS comment
            FROM sys.tables t
            LEFT JOIN sys.extended_properties ep ON ep.major_id = t.object_id AND ep.minor_id = 0 AND ep.name = 'MS_Description'
            ORDER BY t.name
        `);
        this.tableCache.clear();
        const names: string[] = [];
        for (const row of result.recordset || []) {
            names.push(row.table_name);
            this.tableCache.set(row.table_name, row.comment || '');
        }
        return names;
    }

    getTableComment(tableName: string): string | undefined {
        return this.tableCache.get(tableName);
    }

    async getTableSchema(tableName: string): Promise<ColumnInfo[]> {
        if (!this.pool) return [];
        const result = await this.pool.request()
            .input('tableName', tableName)
            .query(`
                SELECT
                    c.name AS "Field",
                    tp.name + CASE
                        WHEN tp.name IN ('varchar', 'nvarchar', 'char', 'nchar', 'varbinary')
                            THEN '(' + CASE WHEN c.max_length = -1 THEN 'MAX' ELSE CAST(c.max_length AS VARCHAR) END + ')'
                        WHEN tp.name IN ('decimal', 'numeric')
                            THEN '(' + CAST(c.precision AS VARCHAR) + ',' + CAST(c.scale AS VARCHAR) + ')'
                        ELSE ''
                    END AS "Type",
                    CASE WHEN c.is_nullable = 1 THEN 'YES' ELSE 'NO' END AS "Null",
                    CASE WHEN i.is_primary_key = 1 THEN 'PRI' ELSE '' END AS "Key",
                    dc.definition AS "Default",
                    '' AS "Extra",
                    ep.value AS "Comment"
                FROM sys.columns c
                INNER JOIN sys.types tp ON c.user_type_id = tp.user_type_id
                LEFT JOIN sys.index_columns ic ON ic.object_id = c.object_id AND ic.column_id = c.column_id
                LEFT JOIN sys.indexes i ON i.object_id = ic.object_id AND i.index_id = ic.index_id AND i.is_primary_key = 1
                LEFT JOIN sys.default_constraints dc ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
                LEFT JOIN sys.extended_properties ep ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
                WHERE OBJECT_NAME(c.object_id) = @tableName
                ORDER BY c.column_id
            `);
        const columns: ColumnInfo[] = (result.recordset || []).map((row: any) => ({
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
        if (!this.pool) return '';
        const result = await this.pool.request()
            .input('tableName', tableName)
            .query('SELECT OBJECT_DEFINITION(OBJECT_ID(@tableName)) AS sql');
        return result.recordset?.[0]?.sql || '';
    }

    async executeSql(sql: string, maxRows = 500): Promise<QueryResult> {
        if (!this.pool) return { columns: [], rows: [], totalFetched: 0 };
        const trimmed = sql.trim();
        if (!trimmed) return { columns: [], rows: [], totalFetched: 0, message: '空语句' };
        const start = Date.now();
        try {
            const result = await this.pool.request().query(trimmed);
            const executionTimeMs = Date.now() - start;
            const rows = result.recordset || [];
            const rowsAffected = result.rowsAffected?.[0];
            if (typeof rowsAffected === 'number' && rows.length === 0) {
                return {
                    columns: [],
                    rows: [],
                    totalFetched: 0,
                    affectedRows: rowsAffected,
                    executionTimeMs
                };
            }
            const columns = rows.length > 0 ? Object.keys(rows[0]) : (result.recordsets?.[0]?.columns || []);
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
