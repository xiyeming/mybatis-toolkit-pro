import { ConnectionConfig } from '../../types';
import { IDbAdapter } from './IDbAdapter';
import { MySQLAdapter } from './MySQLAdapter';
import { PgAdapter } from './PgAdapter';
import { OracleAdapter } from './OracleAdapter';

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
        case 'SQLite':
        case 'DB2':
        case 'H2':
            throw new Error(`数据库类型 "${config.type}" 尚未支持连接与元数据查询。`);
        default:
            throw new Error(`未知的数据库类型: ${config.type}`);
    }
}

export { IDbAdapter } from './IDbAdapter';
