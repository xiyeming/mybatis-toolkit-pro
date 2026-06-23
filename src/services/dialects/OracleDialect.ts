import { Dialect } from './Dialect';

export class OracleDialect implements Dialect {
    getType(): string {
        return 'Oracle';
    }

    getQuoteChar(): string {
        return '"';
    }

    isKeyword(word: string): boolean {
        return this.getKeywords().includes(word.toUpperCase());
    }

    getKeywords(): string[] {
        return [
            'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'ORDER', 'BY', 'GROUP', 'HAVING', 'INSERT',
            'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'ON', 'AS', 'IN', 'IS', 'NULL',
            'LIKE', 'BETWEEN', 'EXISTS', 'NOT', 'DISTINCT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
            'DESC', 'ASC', 'CREATE', 'DROP', 'ALTER', 'TABLE', 'INDEX', 'VIEW', 'PROCEDURE', 'FUNCTION',
            'TRIGGER', 'PACKAGE', 'CONSTRAINT', 'PRIMARY', 'FOREIGN', 'KEY', 'CHECK', 'DEFAULT', 'UNIQUE', 'UNION',
            'ALL', 'INTERSECT', 'MINUS', 'START', 'WITH', 'CONNECT', 'PRIOR', 'LEVEL', 'ROWNUM', 'ROWID',
            'NVL', 'NVL2', 'DECODE', 'SYSDATE', 'SYSTIMESTAMP', 'DUAL', 'COMMIT', 'ROLLBACK', 'SAVEPOINT', 'GRANT',
            'REVOKE', 'AUDIT', 'NOAUDIT', 'COMMENT', 'RENAME', 'LOCK', 'MODE', 'SHARE', 'EXCLUSIVE', 'VALIDATE',
            'NOVALIDATE', 'ENABLE', 'DISABLE', 'CASCADE', 'PURGE', 'RECYCLEBIN', 'FLASHBACK', 'MERGE', 'USING', 'MATCHED',
            'TREAT', 'CAST', 'MULTISET', 'OVER', 'PARTITION', 'ROWS', 'RANGE', 'PRECEDING', 'FOLLOWING', 'CURRENT',
            'ROW', 'UNBOUNDED', 'WINDOW', 'LEFT', 'RIGHT', 'IF', 'MOD', 'REPEAT', 'REPLACE', 'CHAR',
            'CURRENT_DATE', 'CURRENT_TIME', 'CURRENT_TIMESTAMP', 'CURRENT_USER', 'DATABASE', 'LOCALTIME', 'LOCALTIMESTAMP', 'SCHEMA', 'UTC_DATE', 'UTC_TIME',
            'UTC_TIMESTAMP', 'REFERENCES', 'JOIN', 'INNER', 'OUTER',
        ];
    }

    getFunctions(): string[] {
        return [
            'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'MEDIAN', 'STDDEV', 'VARIANCE', 'LISTAGG', 'WM_CONCAT',
            'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'NTILE', 'CUME_DIST', 'PERCENT_RANK', 'LEAD', 'LAG', 'FIRST_VALUE', 'LAST_VALUE',
            'NTH_VALUE', 'RATIO_TO_REPORT', 'CONCAT', 'SUBSTR', 'LENGTH', 'INSTR', 'UPPER', 'LOWER', 'INITCAP', 'TRIM',
            'LTRIM', 'RTRIM', 'REPLACE', 'RPAD', 'LPAD', 'TRANSLATE', 'ASCII', 'CHR', 'REGEXP_SUBSTR', 'REGEXP_REPLACE',
            'REGEXP_INSTR', 'REGEXP_LIKE', 'ABS', 'CEIL', 'FLOOR', 'ROUND', 'TRUNC', 'MOD', 'POWER', 'SQRT',
            'EXP', 'LN', 'LOG', 'HEXTORAW', 'RAWTOHEX', 'SYSDATE', 'SYSTIMESTAMP', 'CURRENT_DATE', 'CURRENT_TIMESTAMP', 'ADD_MONTHS',
            'MONTHS_BETWEEN', 'LAST_DAY', 'NEXT_DAY', 'EXTRACT', 'TO_CHAR', 'TO_DATE', 'TO_TIMESTAMP', 'TO_TIMESTAMP_TZ', 'NUMTODSINTERVAL', 'NUMTOYMINTERVAL',
            'NVL', 'NVL2', 'NULLIF', 'COALESCE', 'DECODE', 'GREATEST', 'LEAST', 'NANVL', 'LNNVL', 'USER',
            'UID', 'VSIZE', 'DUMP', 'ORA_HASH', 'SYS_CONTEXT', 'SYS_GUID', 'LEFT', 'RIGHT', 'REPEAT', 'IF',
            'CHAR', 'CURRENT_TIME', 'CURRENT_USER', 'DATABASE', 'LOCALTIME', 'LOCALTIMESTAMP', 'SCHEMA', 'UTC_DATE', 'UTC_TIME', 'UTC_TIMESTAMP',
            'INSERT', 'VALUES',
        ];
    }
}
