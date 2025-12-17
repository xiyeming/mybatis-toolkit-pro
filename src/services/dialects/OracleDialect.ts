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
            // 标准 SQL
            'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'ORDER', 'BY', 'GROUP', 'HAVING',
            'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'ON', 'AS', 'IN',
            'IS', 'NULL', 'LIKE', 'BETWEEN', 'EXISTS', 'NOT', 'DISTINCT', 'CASE',
            'WHEN', 'THEN', 'ELSE', 'END', 'DESC', 'ASC', 'CREATE', 'DROP', 'ALTER',
            'TABLE', 'INDEX', 'VIEW', 'PROCEDURE', 'FUNCTION', 'TRIGGER', 'PACKAGE',
            'CONSTRAINT', 'PRIMARY', 'FOREIGN', 'KEY', 'CHECK', 'DEFAULT', 'UNIQUE',
            // 层次查询 / 集合操作
            'UNION', 'ALL', 'INTERSECT', 'MINUS', 'START', 'WITH', 'CONNECT', 'PRIOR',
            'LEVEL', 'ROWNUM', 'ROWID',
            // Oracle 特有
            'NVL', 'NVL2', 'DECODE', 'SYSDATE', 'SYSTIMESTAMP', 'DUAL', 'COMMIT',
            'ROLLBACK', 'SAVEPOINT', 'GRANT', 'REVOKE', 'AUDIT', 'NOAUDIT', 'COMMENT',
            'RENAME', 'LOCK', 'MODE', 'SHARE', 'EXCLUSIVE', 'VALIDATE', 'NOVALIDATE',
            'ENABLE', 'DISABLE', 'CASCADE', 'PURGE', 'RECYCLEBIN', 'FLASHBACK',
            'MERGE', 'USING', 'MATCHED', 'TREAT', 'CAST', 'MULTISET',
            // 窗口函数子句
            'OVER', 'PARTITION', 'ROWS', 'RANGE', 'PRECEDING', 'FOLLOWING', 'CURRENT', 'ROW', 'UNBOUNDED', 'WINDOW'
        ];
    }

    getFunctions(): string[] {
        return [
            // 聚合函数
            'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'MEDIAN', 'STDDEV', 'VARIANCE',
            'LISTAGG', 'WM_CONCAT',
            // 窗口函数
            'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'NTILE', 'CUME_DIST', 'PERCENT_RANK', 'LEAD', 'LAG',
            'FIRST_VALUE', 'LAST_VALUE', 'NTH_VALUE', 'RATIO_TO_REPORT',
            // 字符串函数
            'CONCAT', 'SUBSTR', 'LENGTH', 'INSTR', 'UPPER', 'LOWER', 'INITCAP',
            'TRIM', 'LTRIM', 'RTRIM', 'REPLACE', 'RPAD', 'LPAD', 'TRANSLATE',
            'ASCII', 'CHR', 'REGEXP_SUBSTR', 'REGEXP_REPLACE', 'REGEXP_INSTR', 'REGEXP_LIKE',
            // 数值函数
            'ABS', 'CEIL', 'FLOOR', 'ROUND', 'TRUNC', 'MOD', 'POWER', 'SQRT', 'EXP',
            'LN', 'LOG', 'HEXTORAW', 'RAWTOHEX',
            // 日期和时间函数
            'SYSDATE', 'SYSTIMESTAMP', 'CURRENT_DATE', 'CURRENT_TIMESTAMP', 'ADD_MONTHS',
            'MONTHS_BETWEEN', 'LAST_DAY', 'NEXT_DAY', 'ROUND', 'TRUNC', 'EXTRACT',
            'TO_CHAR', 'TO_DATE', 'TO_TIMESTAMP', 'TO_TIMESTAMP_TZ', 'NUMTODSINTERVAL',
            'NUMTOYMINTERVAL',
            // 条件 / 空值处理
            'NVL', 'NVL2', 'NULLIF', 'COALESCE', 'DECODE', 'GREATEST', 'LEAST',
            'NANVL', 'LNNVL',
            // 其他函数
            'USER', 'UID', 'VSIZE', 'DUMP', 'ORA_HASH', 'SYS_CONTEXT', 'SYS_GUID'
        ];
    }
}
