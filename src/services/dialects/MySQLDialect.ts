import { Dialect } from './Dialect';

export class MySQLDialect implements Dialect {
    getType(): string {
        return 'MySQL';
    }

    getQuoteChar(): string {
        return '`';
    }

    isKeyword(word: string): boolean {
        return this.getKeywords().includes(word.toUpperCase());
    }

    getKeywords(): string[] {
        return [
            'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT',
            'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'UNION', 'ALL', 'INSERT', 'INTO', 'VALUES',
            'UPDATE', 'SET', 'DELETE', 'ON', 'AS', 'IN', 'IS', 'NULL', 'LIKE', 'BETWEEN',
            'EXISTS', 'NOT', 'DISTINCT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'DESC', 'ASC',
            'CREATE', 'DROP', 'ALTER', 'TABLE', 'INDEX', 'VIEW', 'PROCEDURE', 'FUNCTION', 'TRIGGER', 'KEY',
            'PRIMARY', 'FOREIGN', 'CONSTRAINT', 'DEFAULT', 'CHECK', 'UNIQUE', 'AUTO_INCREMENT', 'UNSIGNED', 'CHAR', 'VARCHAR',
            'TEXT', 'INT', 'BIGINT', 'FLOAT', 'DOUBLE', 'DECIMAL', 'DATE', 'DATETIME', 'TIMESTAMP', 'BOOLEAN',
            'TRUE', 'FALSE', 'SHOW', 'USE', 'DESCRIBE', 'EXPLAIN', 'REPLACE', 'TRUNCATE', 'LOCK', 'UNLOCK',
            'TABLES', 'DATABASES', 'COLUMNS', 'PRIVILEGES', 'FLUSH', 'KILL', 'OPTIMIZE', 'REPAIR', 'ANALYZE', 'FORCE',
            'IGNORE', 'DUPLICATE', 'OFFSET', 'WINDOW', 'WITH', 'OVER', 'PARTITION', 'ROWS', 'RANGE', 'PRECEDING',
            'FOLLOWING', 'CURRENT', 'ROW', 'UNBOUNDED', 'IF', 'MOD', 'REPEAT', 'CURRENT_DATE', 'CURRENT_TIME', 'CURRENT_TIMESTAMP',
            'CURRENT_USER', 'DATABASE', 'LOCALTIME', 'LOCALTIMESTAMP', 'SCHEMA', 'UTC_DATE', 'UTC_TIME', 'UTC_TIMESTAMP', 'REFERENCES', 'CASCADE',
        ];
    }

    getFunctions(): string[] {
        return [
            'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'GROUP_CONCAT', 'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'NTILE',
            'CUME_DIST', 'PERCENT_RANK', 'LEAD', 'LAG', 'FIRST_VALUE', 'LAST_VALUE', 'NTH_VALUE', 'CONCAT', 'SUBSTRING', 'SUBSTR',
            'LENGTH', 'CHAR_LENGTH', 'UPPER', 'LOWER', 'TRIM', 'LTRIM', 'RTRIM', 'REPLACE', 'LEFT', 'RIGHT',
            'MID', 'INSTR', 'LOCATE', 'REPEAT', 'REVERSE', 'SPACE', 'STRCMP', 'FORMAT', 'LPAD', 'RPAD',
            'ABS', 'CEIL', 'CEILING', 'FLOOR', 'ROUND', 'TRUNCATE', 'MOD', 'POW', 'POWER', 'SQRT',
            'EXP', 'LOG', 'LN', 'SIGN', 'PI', 'RAND', 'DEGREES', 'RADIANS', 'NOW', 'CURDATE',
            'CURTIME', 'SYSDATE', 'DATE', 'TIME', 'YEAR', 'MONTH', 'DAY', 'HOUR', 'MINUTE', 'SECOND',
            'DATEDIFF', 'DATE_ADD', 'DATE_SUB', 'ADDDATE', 'SUBDATE', 'DATE_FORMAT', 'STR_TO_DATE', 'TIMESTAMP', 'FROM_UNIXTIME', 'UNIX_TIMESTAMP',
            'LAST_DAY', 'DAYNAME', 'MONTHNAME', 'WEEK', 'QUARTER', 'IF', 'IFNULL', 'NULLIF', 'COALESCE', 'CASE',
            'CAST', 'CONVERT', 'USER', 'DATABASE', 'VERSION', 'MD5', 'SHA1', 'SHA2', 'UUID', 'LAST_INSERT_ID',
            'JSON_OBJECT', 'JSON_ARRAY', 'JSON_EXTRACT', 'JSON_UNQUOTE', 'CHAR', 'CURRENT_DATE', 'CURRENT_TIME', 'CURRENT_TIMESTAMP', 'CURRENT_USER', 'LOCALTIME',
            'LOCALTIMESTAMP', 'SCHEMA', 'UTC_DATE', 'UTC_TIME', 'UTC_TIMESTAMP', 'INSERT', 'VALUES',
        ];
    }
}
