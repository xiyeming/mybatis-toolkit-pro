import { Dialect } from './Dialect';
import { MySQLDialect } from './MySQLDialect';
import { PostgreSQLDialect } from './PostgreSQLDialect';
import { OracleDialect } from './OracleDialect';
import { SQLServerDialect } from './SQLServerDialect';
import { SQLiteDialect } from './SQLiteDialect';
import { DB2Dialect } from './DB2Dialect';
import { H2Dialect } from './H2Dialect';
import { MariaDBDialect } from './MariaDBDialect';

export class DialectFactory {
    static getDialect(type: string): Dialect {
        switch (type) {
            case 'MySQL':
                return new MySQLDialect();
            case 'MariaDB':
                return new MariaDBDialect();
            case 'PostgreSQL':
                return new PostgreSQLDialect();
            case 'Oracle':
                return new OracleDialect();
            case 'SQL Server':
                return new SQLServerDialect();
            case 'SQLite':
                return new SQLiteDialect();
            case 'H2':
                return new H2Dialect();
            case 'DB2':
                return new DB2Dialect();
            default:
                return new MySQLDialect();
        }
    }
}
