import { ConnectionConfig } from '../../types';
import { IDbAdapter } from './IDbAdapter';
import { MySQLAdapter } from './MySQLAdapter';
import { PgAdapter } from './PgAdapter';
import { OracleAdapter } from './OracleAdapter';
import { SqlServerAdapter } from './SqlServerAdapter';
import { SqliteAdapter } from './SqliteAdapter';
import { Db2Adapter } from './Db2Adapter';
import { H2Adapter } from './H2Adapter';

export function createDbAdapter(config: ConnectionConfig): IDbAdapter {
    switch (config.type) {
        case 'PostgreSQL':
            return new PgAdapter();
        case 'Oracle':
            return new OracleAdapter();
        case 'MySQL':
        case 'MariaDB':
            return new MySQLAdapter();
        case 'SQL Server':
            return new SqlServerAdapter();
        case 'SQLite':
            return new SqliteAdapter();
        case 'DB2':
            return new Db2Adapter();
        case 'H2':
            return new H2Adapter();
        default:
            throw new Error(`未知的数据库类型: ${config.type}`);
    }
}

export { IDbAdapter } from './IDbAdapter';
