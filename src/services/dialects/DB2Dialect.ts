import { Dialect } from './Dialect';

export class DB2Dialect implements Dialect {
    getType(): string {
        return 'DB2';
    }

    getQuoteChar(): string {
        return '"';
    }

    isKeyword(word: string): boolean {
        return this.getKeywords().includes(word.toUpperCase());
    }

    getKeywords(): string[] {
        return [
            // 标准 SQL
            'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'ORDER', 'BY', 'GROUP', 'HAVING',
            'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'ON', 'AS', 'IN',
            'IS', 'NULL', 'LIKE', 'BETWEEN', 'EXISTS', 'NOT', 'DISTINCT', 'CASE',
            'WHEN', 'THEN', 'ELSE', 'END', 'DESC', 'ASC', 'CREATE', 'DROP', 'ALTER',
            'TABLE', 'INDEX', 'VIEW', 'PROCEDURE', 'FUNCTION', 'TRIGGER', 'CONSTRAINT',
            'PRIMARY', 'FOREIGN', 'KEY', 'CHECK', 'DEFAULT', 'UNIQUE',
            // DB2 特有
            'FETCH', 'FIRST', 'ROWS', 'ONLY', 'OPTIMIZE', 'FOR', 'WITH', 'UR', 'CS',
            'RS', 'RR', 'UNION', 'ALL', 'EXCEPT', 'INTERSECT', 'JOIN', 'INNER', 'OUTER',
            'LEFT', 'RIGHT', 'FULL', 'CROSS', 'LATERAL', 'TABLE', 'MERGE', 'MATCHED',
            'USING', 'ALIAS', 'SEQUENCE', 'VARIABLE', 'GOTO', 'LEAVE', 'LOOP', 'REPEAT',
            'WHILE', 'UNTIL', 'BEGIN', 'DECLARE', 'RETURN', 'SIGNAL', 'RESIGNAL',
            'VALUES', 'CALL', 'ASSOCIATE', 'LOCATOR', 'ALLOCATE', 'DESCRIBE', 'PREPARE',
            'EXECUTE', 'OPEN', 'CLOSE', 'COMMIT', 'ROLLBACK', 'CONNECT', 'DISCONNECT',
            'RELEASE', 'SET', 'CURRENT', 'SCHEMA', 'PATH', 'USER', 'TIMEZONE',
            'ISOLATION', 'LOCK', 'SIZE', 'PRIORITY', 'FEDERATED', 'NICKNAME'
        ];
    }

    getFunctions(): string[] {
        return [
            // 聚合函数
            'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'STDDEV', 'VARIANCE', 'LISTAGG',
            'XMLAGG', 'JSON_ARRAYAGG', 'JSON_OBJECTAGG',
            // 字符串函数
            'CONCAT', 'SUBSTR', 'SUBSTRING', 'LENGTH', 'LCASE', 'UCASE', 'LOWER', 'UPPER',
            'LTRIM', 'RTRIM', 'TRIM', 'REPLACE', 'TRANSLATE', 'LOCATE', 'POSSTR',
            'REPEAT', 'SPACE', 'STRIP', 'LEFT', 'RIGHT', 'INSERT', 'OVERLAY', 'XMLCAST',
            // 数值函数
            'ABS', 'CEIL', 'CEILING', 'FLOOR', 'ROUND', 'TRUNC', 'TRUNCATE', 'MOD',
            'POWER', 'SQRT', 'EXP', 'LN', 'LOG10', 'SIGN', 'PI', 'RAND', 'RANDOM',
            'ACOS', 'ASIN', 'ATAN', 'COS', 'SIN', 'TAN', 'DEGREES', 'RADIANS',
            // 日期和时间函数
            'CURRENT_DATE', 'CURRENT_TIME', 'CURRENT_TIMESTAMP', 'DATE', 'TIME', 'TIMESTAMP',
            'YEAR', 'MONTH', 'DAY', 'HOUR', 'MINUTE', 'SECOND', 'MICROSECOND', 'DAYOFWEEK',
            'DAYOFYEAR', 'WEEK', 'QUARTER', 'DAYS', 'JULIAN_DAY', 'MIDNIGHT_SECONDS',
            'TIMESTAMP_FORMAT', 'VARCHAR_FORMAT', 'ADD_MONTHS', 'NEXT_DAY', 'LAST_DAY',
            // 条件 / 空值处理
            'COALESCE', 'NULLIF', 'VALUE', 'NVL', 'DECODE', 'GREATEST', 'LEAST',
            // 转换函数
            'CAST', 'CHAR', 'VARCHAR', 'INTEGER', 'DECIMAL', 'DOUBLE', 'FLOAT', 'BIGINT',
            'SMALLINT', 'REAL', 'GRAPHIC', 'VARGRAPHIC', 'DIGITS', 'HEX',
            // 其他函数
            'GENERATE_UNIQUE', 'IDENTITY_VAL_LOCAL', 'ROW_NUMBER', 'RANK', 'DENSE_RANK',
            'LAG', 'LEAD'
        ];
    }
}
