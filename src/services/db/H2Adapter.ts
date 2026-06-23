import { ColumnInfo, ConnectionConfig, QueryResult } from '../../types';
import { IDbAdapter } from './IDbAdapter';

/**
 * H2 适配器（基于 jdbc + H2 JDBC 驱动）。
 * H2 是 Java 数据库，Node.js 没有原生驱动，因此需要：
 * 1. 安装 jdbc 依赖：npm install jdbc
 * 2. 下载 H2 JDBC jar（如 h2-2.2.224.jar）
 * 3. 在连接配置的 options.jarPath 中指定 jar 路径
 */
export class H2Adapter implements IDbAdapter {
    private pool: any;
    private jdbc: any;
    private jinst: any;
    private tableCache: Map<string, string> = new Map();
    private schemaCache: Map<string, ColumnInfo[]> = new Map();
    private pkCache: Map<string, Set<string>> = new Map();

    private async loadJdbc(): Promise<{ jdbc: any; jinst: any }> {
        if (this.jdbc && this.jinst) return { jdbc: this.jdbc, jinst: this.jinst };
        try {
            this.jdbc = await import('jdbc');
            this.jinst = await import('jdbc/lib/jinst');
            return { jdbc: this.jdbc, jinst: this.jinst };
        } catch {
            throw new Error('请先安装 jdbc 依赖: npm install jdbc');
        }
    }

    private setupClasspath(jinst: any, jarPath: string): void {
        if (!jinst.isJvmCreated()) {
            jinst.addOption('-Xrs');
            jinst.setupClasspath([jarPath]);
        }
    }

    async connect(config: ConnectionConfig): Promise<void> {
        const { jdbc, jinst } = await this.loadJdbc();
        const jarPath = (config as any).options?.jarPath;
        if (!jarPath) {
            throw new Error('H2 连接需要配置 options.jarPath（H2 JDBC jar 路径），例如 "./drivers/h2-2.2.224.jar"');
        }
        this.setupClasspath(jinst, jarPath);

        const url = `jdbc:h2:tcp://${config.host}:${config.port}/${config.database}`;
        const Pool = jdbc.default || jdbc;
        this.pool = new Pool({
            url,
            drivername: 'org.h2.Driver',
            minpoolsize: 1,
            maxpoolsize: 5,
            properties: {
                user: config.user,
                password: config.password
            }
        });
        await this.initialize(this.pool);
    }

    async disconnect(): Promise<void> {
        if (this.pool) {
            await this.purge(this.pool);
            this.pool = undefined;
        }
        this.tableCache.clear();
        this.schemaCache.clear();
        this.pkCache.clear();
    }

    async getTableNames(): Promise<string[]> {
        const rows = await this.query(
            "SELECT TABLE_NAME, REMARKS FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = CURRENT_SCHEMA AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME"
        );
        this.tableCache.clear();
        this.pkCache.clear();
        const names: string[] = [];
        for (const row of rows) {
            const name = row.TABLE_NAME;
            names.push(name);
            this.tableCache.set(name, row.REMARKS || '');
        }
        // 预加载主键信息
        for (const name of names) {
            const pks = await this.query(
                "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_NAME = ? AND CONSTRAINT_NAME LIKE 'PRIMARY%' AND TABLE_SCHEMA = CURRENT_SCHEMA",
                [name]
            );
            this.pkCache.set(name, new Set(pks.map((r: any) => r.COLUMN_NAME)));
        }
        return names;
    }

    getTableComment(tableName: string): string | undefined {
        return this.tableCache.get(tableName);
    }

    async getTableSchema(tableName: string): Promise<ColumnInfo[]> {
        if (this.schemaCache.has(tableName)) return this.schemaCache.get(tableName)!;
        const rows = await this.query(
            `SELECT COLUMN_NAME AS "Field",
                    TYPE_NAME AS "Type",
                    IS_NULLABLE AS "Null",
                    COLUMN_DEFAULT AS "Default",
                    REMARKS AS "Comment",
                    ORDINAL_POSITION AS "Pos"
             FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_NAME = ? AND TABLE_SCHEMA = CURRENT_SCHEMA
             ORDER BY ORDINAL_POSITION`,
            [tableName]
        );
        const pkSet = this.pkCache.get(tableName) || new Set<string>();
        const columns: ColumnInfo[] = rows.map((row: any) => ({
            Field: row.Field,
            Type: row.Type || '',
            Null: row.Null,
            Key: pkSet.has(row.Field) ? 'PRI' : '',
            Default: row.Default,
            Extra: '',
            Comment: row.Comment || undefined
        }));
        this.schemaCache.set(tableName, columns);
        return columns;
    }

    async getCreateTableStatement(tableName: string): Promise<string> {
        const rows = await this.query(
            'SELECT SQL FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = ? AND TABLE_SCHEMA = CURRENT_SCHEMA',
            [tableName]
        );
        return rows[0]?.SQL || '';
    }

    async executeSql(sql: string, maxRows = 500): Promise<QueryResult> {
        const trimmed = sql.trim();
        if (!trimmed) return { columns: [], rows: [], totalFetched: 0, message: '空语句' };
        const start = Date.now();
        const conn = await this.reserve(this.pool);
        try {
            const statement = await this.createStatement(conn.conn);
            const isSelect = /^\s*SELECT\s/i.test(trimmed);
            if (isSelect) {
                const rs = await this.executeQuery(statement, trimmed);
                const rows = await this.toObjArray(rs);
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
                const count = await this.executeUpdate(statement, trimmed);
                return {
                    columns: [],
                    rows: [],
                    totalFetched: 0,
                    affectedRows: count,
                    executionTimeMs: Date.now() - start
                };
            }
        } catch (e: any) {
            return { columns: [], rows: [], totalFetched: 0, message: e.message || String(e), executionTimeMs: Date.now() - start };
        } finally {
            await this.release(this.pool, conn);
        }
    }

    // -------------- jdbc 回调 Promise 封装 --------------

    private async query(sql: string, params?: any[]): Promise<any[]> {
        if (!this.pool) return [];
        const conn = await this.reserve(this.pool);
        try {
            let statement: any;
            if (params && params.length > 0) {
                const ps = await this.prepareStatement(conn.conn, sql);
                params.forEach((p, i) => ps.setString(i + 1, p));
                const rs = await this.executeQuery(ps, '');
                return await this.toObjArray(rs);
            } else {
                statement = await this.createStatement(conn.conn);
                const rs = await this.executeQuery(statement, sql);
                return await this.toObjArray(rs);
            }
        } finally {
            await this.release(this.pool, conn);
        }
    }

    private initialize(pool: any): Promise<void> {
        return new Promise((resolve, reject) => pool.initialize((err: any) => err ? reject(err) : resolve()));
    }

    private purge(pool: any): Promise<void> {
        return new Promise((resolve) => pool.purge(() => resolve()));
    }

    private reserve(pool: any): Promise<any> {
        return new Promise((resolve, reject) => pool.reserve((err: any, conn: any) => err ? reject(err) : resolve(conn)));
    }

    private release(pool: any, conn: any): Promise<void> {
        return new Promise((resolve, reject) => pool.release(conn, (err: any) => err ? reject(err) : resolve()));
    }

    private createStatement(conn: any): Promise<any> {
        return new Promise((resolve, reject) => conn.createStatement((err: any, stmt: any) => err ? reject(err) : resolve(stmt)));
    }

    private prepareStatement(conn: any, sql: string): Promise<any> {
        return new Promise((resolve, reject) => conn.prepareStatement(sql, (err: any, stmt: any) => err ? reject(err) : resolve(stmt)));
    }

    private executeQuery(statement: any, sql: string): Promise<any> {
        return new Promise((resolve, reject) => statement.executeQuery(sql, (err: any, rs: any) => err ? reject(err) : resolve(rs)));
    }

    private executeUpdate(statement: any, sql: string): Promise<number> {
        return new Promise((resolve, reject) => statement.executeUpdate(sql, (err: any, count: any) => err ? reject(err) : resolve(count)));
    }

    private toObjArray(rs: any): Promise<any[]> {
        return new Promise((resolve, reject) => rs.toObjArray((err: any, rows: any) => err ? reject(err) : resolve(rows || [])));
    }
}
