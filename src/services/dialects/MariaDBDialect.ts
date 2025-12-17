import { Dialect } from './Dialect';

export class MariaDBDialect implements Dialect {
    getType(): string {
        return 'MariaDB';
    }

    getQuoteChar(): string {
        return '`';
    }

    isKeyword(word: string): boolean {
        return this.getKeywords().includes(word.toUpperCase());
    }

    getKeywords(): string[] {
        return [
            // 标准 SQL
            'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT',
            'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'UNION', 'ALL', 'INSERT', 'INTO',
            'VALUES', 'UPDATE', 'SET', 'DELETE', 'ON', 'AS', 'IN', 'IS', 'NULL', 'LIKE',
            'BETWEEN', 'EXISTS', 'NOT', 'DISTINCT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
            'DESC', 'ASC', 'CREATE', 'DROP', 'ALTER', 'TABLE', 'INDEX', 'VIEW', 'PROCEDURE',
            'FUNCTION', 'TRIGGER', 'KEY', 'PRIMARY', 'FOREIGN', 'CONSTRAINT', 'DEFAULT',
            'CHECK', 'UNIQUE', 'AUTO_INCREMENT', 'UNSIGNED', 'CHAR', 'VARCHAR', 'TEXT',
            'INT', 'BIGINT', 'FLOAT', 'DOUBLE', 'DECIMAL', 'DATE', 'DATETIME', 'TIMESTAMP',
            'BOOLEAN', 'TRUE', 'FALSE',
            // MariaDB / MySQL 继承
            'SHOW', 'USE', 'DESCRIBE', 'EXPLAIN', 'REPLACE', 'TRUNCATE', 'LOCK', 'UNLOCK',
            'TABLES', 'DATABASES', 'COLUMNS', 'PRIVILEGES', 'FLUSH', 'KILL', 'OPTIMIZE',
            'REPAIR', 'ANALYZE', 'FORCE', 'IGNORE', 'DUPLICATE', 'KEY', 'OFFSET', 'WINDOW',
            'WITH', 'RECURSIVE', 'RETURNING', 'EXCEPT', 'INTERSECT', 'ROLE', 'START', 'TRANSACTION',
            'COMMIT', 'ROLLBACK', 'SAVEPOINT', 'DO', 'HANDLER', 'LOAD', 'DATA', 'INFILE',
            'PREPARE', 'EXECUTE', 'DEALLOCATE'
        ];
    }

    getFunctions(): string[] {
        return [
            // 聚合函数
            'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'GROUP_CONCAT', 'STDDEV', 'VARIANCE',
            'BIT_AND', 'BIT_OR', 'BIT_XOR', 'JSON_ARRAYAGG', 'JSON_OBJECTAGG',
            // 字符串函数
            'CONCAT', 'CONCAT_WS', 'SUBSTRING', 'SUBSTR', 'LENGTH', 'CHAR_LENGTH',
            'UPPER', 'LOWER', 'UCASE', 'LCASE', 'TRIM', 'LTRIM', 'RTRIM', 'REPLACE',
            'LEFT', 'RIGHT', 'MID', 'INSTR', 'LOCATE', 'POSITION', 'REPEAT', 'REVERSE',
            'SPACE', 'STRCMP', 'FORMAT', 'LPAD', 'RPAD', 'ELT', 'FIELD', 'FIND_IN_SET',
            'MAKE_SET', 'EXPORT_SET', 'QUOTE', 'BIN', 'OCT', 'HEX', 'UNHEX', 'ORD', 'CHAR',
            'Soundex', 'TO_BASE64', 'FROM_BASE64', 'REGEXP_REPLACE', 'REGEXP_INSTR', 'REGEXP_SUBSTR',
            // 数值函数
            'ABS', 'CEIL', 'CEILING', 'FLOOR', 'ROUND', 'TRUNCATE', 'MOD', 'POW', 'POWER',
            'SQRT', 'EXP', 'LOG', 'LOG10', 'LOG2', 'LN', 'SIGN', 'PI', 'RAND', 'DEGREES',
            'RADIANS', 'SIN', 'COS', 'TAN', 'ASIN', 'ACOS', 'ATAN', 'ATAN2', 'COT', 'CRC32',
            // 日期和时间函数
            'NOW', 'CURDATE', 'CURTIME', 'SYSDATE', 'DATE', 'TIME', 'YEAR', 'MONTH', 'DAY',
            'HOUR', 'MINUTE', 'SECOND', 'MICROSECOND', 'DATEDIFF', 'DATE_ADD', 'DATE_SUB',
            'ADDDATE', 'SUBDATE', 'ADDTIME', 'SUBTIME', 'DATE_FORMAT', 'STR_TO_DATE',
            'TIMESTAMP', 'FROM_UNIXTIME', 'UNIX_TIMESTAMP', 'LAST_DAY', 'DAYNAME', 'MONTHNAME',
            'WEEK', 'QUARTER', 'WEEKOFYEAR', 'YEARWEEK', 'MAKEDATE', 'MAKETIME', 'CONVERT_TZ',
            // 流程控制函数
            'IF', 'IFNULL', 'NULLIF', 'COALESCE', 'CASE', 'CAST', 'CONVERT', 'DECODE',
            // JSON 函数
            'JSON_OBJECT', 'JSON_ARRAY', 'JSON_EXTRACT', 'JSON_UNQUOTE', 'JSON_TYPE',
            'JSON_VALID', 'JSON_KEYS', 'JSON_SEARCH', 'JSON_QUERY', 'JSON_VALUE',
            // 其他函数
            'USER', 'DATABASE', 'VERSION', 'MD5', 'SHA1', 'SHA2', 'UUID', 'LAST_INSERT_ID',
            'CONNECTION_ID', 'FOUND_ROWS', 'ROW_COUNT', 'GET_LOCK', 'RELEASE_LOCK',
            'SLEEP', 'BENCHMARK', 'INET_ATON', 'INET_NTOA', 'INET6_ATON', 'INET6_NTOA'
        ];
    }
}
