# 变更日志

所有关于 "MyBatis Toolkit Pro" 扩展的重要变更都将记录在此文件中。

## [1.0.1] - 2025-12-17

### 新增
-   **多数据库支持**: 增加了对 8 种数据库方言的全面支持：
    -   MySQL
    -   PostgreSQL
    -   Oracle
    -   SQL Server
    -   SQLite
    -   DB2
    -   H2
    -   MariaDB
-   **方言特定格式化**: SQL 格式化现在遵循所选数据库的语法规则（例如，引用风格、特定关键字）。
-   **配置**: 添加了 `mybatisToolkit.defaultDatabaseType` 设置，用于在没有活动数据库连接时指定默认方言。
-   **连接配置**: 数据库连接配置现在包含 `type` 字段以指定数据库类型。

### 变更
-   参考标准 SQL 关键字和函数列表以确保所有支持的方言更健壮。
-   改进了 SQL 分词器的性能。
