import { Dialect } from './Dialect';

export class PostgreSQLDialect implements Dialect {
    getType(): string {
        return 'PostgreSQL';
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
            'BETWEEN', 'EXISTS', 'NOT', 'DISTINCT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
            'DESC', 'ASC', 'OFFSET', 'WITH', 'RECURSIVE', 'CREATE', 'DROP', 'ALTER', 'TABLE',
            'INDEX', 'VIEW', 'FUNCTION', 'TRIGGER', 'On', 'CONSTRAINT', 'DEFAULT', 'CHECK',
            'UNIQUE', 'PRIMARY', 'FOREIGN', 'KEY',
            // PostgreSQL 特有
            'RETURNING', 'ILIKE', 'SIMILAR', 'TO', 'OVER', 'PARTITION', 'WINDOW', 'NULLS',
            'FIRST', 'LAST', 'TYPE', 'CAST', 'EXPLAIN', 'ANALYZE', 'VERBOSE', 'VACUUM',
            'SHOW', 'SET', 'RESET', 'LISTEN', 'NOTIFY', 'BEGIN', 'COMMIT', 'ROLLBACK',
            'SAVEPOINT', 'GRANT', 'REVOKE', 'DO', 'DECLARE', 'LOOP', 'RAISE',
            // 窗口子句
            'ROWS', 'RANGE', 'PRECEDING', 'FOLLOWING', 'CURRENT', 'ROW', 'UNBOUNDED'
        ];
    }

    getFunctions(): string[] {
        return [
            // 聚合函数
            'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'STRING_AGG', 'ARRAY_AGG', 'JSON_AGG', 'JSONB_AGG',
            // 窗口函数
            'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'NTILE', 'CUME_DIST', 'PERCENT_RANK', 'LEAD', 'LAG',
            'FIRST_VALUE', 'LAST_VALUE', 'NTH_VALUE',
            // 字符串函数
            'CONCAT', 'SUBSTRING', 'LENGTH', 'UPPER', 'LOWER', 'TRIM', 'LTRIM', 'RTRIM',
            'REPLACE', 'LEFT', 'RIGHT', 'RPAD', 'LPAD', 'SPLIT_PART', 'REGEXP_REPLACE',
            'REGEXP_MATCH', 'POSITION', 'INITCAP', 'TRANSLATE', 'CHR',
            // 数值函数
            'ABS', 'CEIL', 'CEILING', 'FLOOR', 'ROUND', 'TRUNC', 'MOD', 'POWER', 'SQRT',
            'EXP', 'LN', 'LOG', 'SIGN', 'PI', 'RANDOM', 'WIDTH_BUCKET',
            // 日期和时间函数
            'NOW', 'CURRENT_DATE', 'CURRENT_TIME', 'CURRENT_TIMESTAMP', 'LOCALTIME',
            'LOCALTIMESTAMP', 'AGE', 'DATE_PART', 'DATE_TRUNC', 'EXTRACT', 'TO_CHAR',
            'TO_DATE', 'TO_TIMESTAMP', 'MAKE_DATE', 'MAKE_TIME', 'JUSTIFY_DAYS', 'JUSTIFY_HOURS',
            // 条件函数
            'COALESCE', 'NULLIF', 'GREATEST', 'LEAST',
            // JSON 函数
            'JSON_BUILD_OBJECT', 'JSON_BUILD_ARRAY', 'TO_JSON', 'TO_JSONB',
            'JSONB_SET', 'JSONB_INSERT',
            // 其他函数
            'CAST', 'GENERATE_SERIES', 'NEXTVAL', 'CURRVAL', 'SETVAL', 'VERSION', 'USER'
        ];
    }
}
