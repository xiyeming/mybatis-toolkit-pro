import { Dialect } from './Dialect';

export class SQLServerDialect implements Dialect {
    getType(): string {
        return 'SQL Server';
    }

    getQuoteChar(): string {
        return ']'; // Special handling for [ ]
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
            // T-SQL 特有
            'TOP', 'WITH', 'EXEC', 'EXECUTE', 'UNION', 'ALL', 'INTERSECT', 'EXCEPT',
            'CROSS', 'OUTER', 'APPLY', 'PIVOT', 'UNPIVOT', 'OFFSET', 'FETCH', 'NEXT',
            'ROW', 'ROWS', 'ONLY', 'OVER', 'PARTITION', 'RANK', 'DENSE_RANK', 'ROW_NUMBER',
            'NTILE', 'BEGIN', 'TRAN', 'TRANSACTION', 'COMMIT', 'ROLLBACK', 'SAVE',
            // 窗口帧
            'RANGE', 'PRECEDING', 'FOLLOWING', 'UNBOUNDED', 'CURRENT', 'WINDOW',
            'DECLARE', 'SET', 'IF', 'ELSE', 'WHILE', 'BREAK', 'CONTINUE', 'GOTO',
            'RETURN', 'TRY', 'CATCH', 'THROW', 'RAISERROR', 'WAITFOR', 'MERGE',
            'BACKUP', 'RESTORE', 'USE', 'GO', 'OPTION', 'RECOMPILE', 'NOLOCK'
        ];
    }

    getFunctions(): string[] {
        return [
            // 聚合函数
            'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'STDEV', 'VAR', 'STRING_AGG', 'CHECKSUM_AGG',
            // 字符串函数
            'CONCAT', 'CONCAT_WS', 'SUBSTRING', 'LEFT', 'RIGHT', 'LEN', 'DATALENGTH',
            'CHARINDEX', 'PATINDEX', 'UPPER', 'LOWER', 'LTRIM', 'RTRIM', 'TRIM',
            'REPLACE', 'REPLICATE', 'REVERSE', 'SPACE', 'STUFF', 'FORMAT', 'ASCII',
            'CHAR', 'NCHAR', 'UNICODE', 'SOUNDEX', 'DIFFERENCE',
            // 数值函数
            'ABS', 'CEILING', 'FLOOR', 'ROUND', 'POWER', 'SQRT', 'SQUARE', 'EXP',
            'LOG', 'LOG10', 'SIGN', 'PI', 'RAND', 'DEGREES', 'RADIANS', 'ACOS', 'ASIN',
            // 日期和时间函数
            'GETDATE', 'GETUTCDATE', 'SYSDATETIME', 'SYSDATETIMEOFFSET', 'DATEADD',
            'DATEDIFF', 'DATENAME', 'DATEPART', 'DAY', 'MONTH', 'YEAR', 'ISDATE',
            'EOMONTH', 'SWITCHOFFSET', 'TODATETIMEOFFSET',
            // 条件 / 空值处理
            'ISNULL', 'COALESCE', 'NULLIF', 'IIF', 'CHOOSE',
            // 转换函数
            'CAST', 'CONVERT', 'PARSE', 'TRY_CAST', 'TRY_CONVERT', 'TRY_PARSE',
            // 其他函数
            'NEWID', 'NEWSEQUENTIALID', 'ISNUMERIC', 'USER_NAME', 'SUSER_NAME',
            'DB_NAME', 'OBJECT_NAME', 'COL_NAME', 'APP_NAME', 'HOST_NAME',
            'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'NTILE', 'LAG', 'LEAD',
            'FIRST_VALUE', 'LAST_VALUE'
        ];
    }
}
