import { Dialect } from './Dialect';

export class H2Dialect implements Dialect {
    getType(): string {
        return 'H2';
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
            'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT',
            'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'UNION', 'ALL', 'INSERT', 'INTO',
            'VALUES', 'UPDATE', 'SET', 'DELETE', 'ON', 'AS', 'IN', 'IS', 'NULL', 'LIKE',
            'BETWEEN', 'EXISTS', 'NOT', 'DISTINCT', 'PC', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
            'DESC', 'ASC', 'CREATE', 'DROP', 'ALTER', 'TABLE', 'INDEX', 'VIEW', 'SCHEMA',
            'TRIGGER', 'SEQUENCE', 'DOMAIN', 'ALIAS', 'USER', 'ROLE', 'RIGHTS', 'GRANT',
            'REVOKE', 'COMMIT', 'ROLLBACK', 'CHECKPOINT', 'BACKUP', 'RESTORE', 'EXPLAIN',
            'ANALYZE', 'CALL', 'RUNSCRIPT', 'SCRIPT', 'SHOW', 'SET', 'MERGE', 'KEY', 'PRIMARY',
            'FOREIGN', 'CONSTRAINT', 'DEFAULT', 'CHECK', 'UNIQUE', 'AUTO_INCREMENT',
            'IDENTITY', 'TOP', 'OFFSET', 'FETCH', 'ROWNUM', 'INTERSECT', 'EXCEPT', 'MINUS',
            'CROSS', 'NATURAL', 'USING', 'CURRENT_DATE', 'CURRENT_TIME', 'CURRENT_TIMESTAMP',
            'SYSDATE', 'SYSTIME', 'SYSTIMESTAMP', 'TODAY', 'FALSE', 'TRUE', 'ARRAY'
        ];
    }

    getFunctions(): string[] {
        return [
            // 聚合函数
            'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'STDDEV_POP', 'STDDEV_SAMP',
            'VAR_POP', 'VAR_SAMP', 'GROUP_CONCAT', 'LISTAGG', 'ARRAY_AGG', 'JSON_ARRAYAGG',
            'JSON_OBJECTAGG', 'SELECTIVITY', 'HISTOGRAM',
            // 字符串函数
            'ASCII', 'BIT_LENGTH', 'CHAR', 'CHAR_LENGTH', 'CONCAT', 'CONCAT_WS', 'HEXTORAW',
            'RAWTOHEX', 'INSERT', 'INSTR', 'LCASE', 'LEFT', 'LENGTH', 'LOCATE', 'LOWER', 'LPAD',
            'LTRIM', 'OCTET_LENGTH', 'POSITION', 'REPEAT', 'REPLACE', 'RIGHT', 'RPAD', 'RTRIM',
            'SOUNDEX', 'SPACE', 'STRINGDECODE', 'STRINGENCODE', 'SUBSTR', 'SUBSTRING',
            'TRANSLATE', 'TRIM', 'UCASE', 'UPPER', 'XMLATTR', 'XMLNODE', 'XMLSTARTDOC',
            'XMLTEXT', 'REGEXP_REPLACE', 'REGEXP_LIKE',
            // 数值函数
            'ABS', 'ACOS', 'ASIN', 'ATAN', 'ATAN2', 'BITAND', 'BITOR', 'BITXOR', 'BITNOT',
            'CEILING', 'COS', 'COT', 'DEGREES', 'EXP', 'FLOOR', 'LOG', 'LOG10', 'MOD', 'PI',
            'POWER', 'RADIANS', 'RAND', 'ROUND', 'ROUNDMAGIC', 'SECURE_RAND', 'SIGN', 'SIN',
            'SQRT', 'TAN', 'TRUNCATE',
            // 日期和时间函数
            'ADDDAYS', 'ADDMONTHS', 'ADDYEARS', 'CURRENT_DATE', 'CURRENT_TIME',
            'CURRENT_TIMESTAMP', 'DATEADD', 'DATEDIFF', 'DAYNAME', 'DAYOFMONTH', 'DAYOFWEEK',
            'DAYOFYEAR', 'EXTRACT', 'FORMATDATETIME', 'HOUR', 'MINUTE', 'MONTH', 'MONTHNAME',
            'PARSEDATETIME', 'QUARTER', 'SECOND', 'WEEK', 'YEAR',
            // 系统函数
            'DATABASE', 'USER', 'CURRENT_USER', 'IDENTITY', 'SCOPE_IDENTITY', 'AUTOCOMMIT',
            'READONLY', 'DATABASE_PATH', 'LOCK_TIMEOUT', 'MEMORY_FREE', 'MEMORY_USED',
            'SESSION_ID', 'LOCK_MODE', 'SCHEMA',
            // JSON 函数
            'JSON_OBJECT', 'JSON_ARRAY',
            // 其他函数
            'CAST', 'CONVERT', 'COALESCE', 'NULLIF', 'NVL', 'NVL2', 'DECODE', 'CASEWHEN',
            'TABLE', 'UNNEST', 'FILE_READ', 'FILE_WRITE', 'LINK_SCHEMA', 'CSVREAD', 'CSVWRITE'
        ];
    }
}
