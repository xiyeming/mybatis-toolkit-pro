import { Dialect } from './Dialect';

export class SQLiteDialect implements Dialect {
    getType(): string {
        return 'SQLite';
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
            'JOIN', 'LEFT', 'CROSS', 'INNER', 'OUTER', 'UNION', 'ALL', 'INSERT', 'INTO',
            'VALUES', 'UPDATE', 'SET', 'DELETE', 'ON', 'AS', 'IN', 'IS', 'NULL', 'LIKE',
            'BETWEEN', 'EXISTS', 'NOT', 'DISTINCT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
            'DESC', 'ASC', 'CREATE', 'DROP', 'ALTER', 'TABLE', 'INDEX', 'VIEW', 'TRIGGER',
            'PRAGMA', 'TRANSACTION', 'BEGIN', 'COMMIT', 'ROLLBACK', 'SAVEPOINT', 'RELEASE',
            'ATTACH', 'DETACH', 'REINDEX', 'RENAME', 'ADD', 'COLUMN', 'CONSTRAINT',
            'DEFAULT', 'PRIMARY', 'FOREIGN', 'KEY', 'CHECK', 'UNIQUE', 'AUTOINCREMENT',
            'CAST', 'COLLATE', 'CONFLICT', 'CROSS', 'CURRENT_DATE', 'CURRENT_TIME',
            'CURRENT_TIMESTAMP', 'DATABASE', 'DEFERRED', 'EXCLUSIVE', 'EXPLAIN', 'FAIL',
            'FILTER', 'GLOB', 'IF', 'IGNORE', 'IMMEDIATE', 'INITIALLY', 'INSTEAD', 'MATCH',
            'NATURAL', 'OFFSET', 'PLAN', 'QUERY', 'RAISE', 'RECURSIVE', 'REGEXP', 'REPLACE',
            'RESTRICT', 'ROWID', 'TEMP', 'TEMPORARY', 'VACUUM', 'VIRTUAL', 'WITH', 'WITHOUT'
        ];
    }

    getFunctions(): string[] {
        return [
            // 聚合函数
            'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'GROUP_CONCAT', 'TOTAL',
            // 核心函数
            'ABS', 'CHANGES', 'CHAR', 'COALESCE', 'GLOB', 'HEX', 'IFNULL', 'INSTR', 'LAST_INSERT_ROWID',
            'LENGTH', 'LIKE', 'LIKELIHOOD', 'LIKELY', 'LOAD_EXTENSION', 'LOWER', 'LTRIM',
            'MAX', 'MIN', 'NULLIF', 'PRINTF', 'QUOTE', 'RANDOM', 'RANDOMBLOB', 'REPLACE',
            'ROUND', 'RTRIM', 'SOUNDEX', 'SQLITE_COMPILEOPTION_GET', 'SQLITE_COMPILEOPTION_USED',
            'SQLITE_OFFSET', 'SQLITE_SOURCE_ID', 'SQLITE_VERSION', 'SUBSTR', 'TOTAL_CHANGES',
            'TRIM', 'TYPEOF', 'UNICODE', 'UNLIKELY', 'UPPER', 'ZEROBLOB',
            // 日期和时间函数
            'DATE', 'TIME', 'DATETIME', 'JULIANDAY', 'STRFTIME',
            // 数学函数 (有些技术上是扩展，但很常见)
            'ACCOS', 'ASIN', 'ATAN', 'ATAN2', 'CEIL', 'CEILING', 'COS', 'COSH', 'DEGREES',
            'EXP', 'FLOOR', 'LN', 'LOG', 'LOG10', 'MOD', 'PI', 'POWER', 'RADIANS', 'SIN',
            'SINH', 'SQRT', 'TAN', 'TANH', 'TRUNC',
            // JSON 函数
            'JSON', 'JSON_ARRAY', 'JSON_ARRAY_LENGTH', 'JSON_EXTRACT', 'JSON_INSERT',
            'JSON_OBJECT', 'JSON_PATCH', 'JSON_REMOVE', 'JSON_REPLACE', 'JSON_SET',
            'JSON_TPYE', 'JSON_VALID', 'JSON_QUOTE', 'JSON_GROUP_ARRAY', 'JSON_GROUP_OBJECT'
        ];
    }
}
