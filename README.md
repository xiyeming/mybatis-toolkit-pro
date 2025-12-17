# MyBatis Toolkit Pro

[English](README_en.md) | [中文](README.md)

专为 VS Code 设计的专业 MyBatis 开发工具包，旨在通过智能导航、SQL 验证和丰富的语法高亮提高您的生产力。

## 安装

您可以通过以下方式安装本插件：

1.  **VS Code 插件市场**：在扩展商店搜索 "MyBatis Toolkit Pro" 并安装。
2.  **VSIX 安装**：从 [Releases](https://github.com/xiyeming/mybatis-toolkit-pro/releases) 页面下载最新的 `.vsix` 文件，在 VS Code 中通过 "Install from VSIX..." 进行安装。

## 功能特性

### 1. 智能导航
-   **跳转到定义**：
    -   **数据库表**：点击 XML 中的表名跳转到虚拟架构视图。
    -   **ResultMap 属性**：按住 Cmd+Click (Ctrl+Click) 点击 `<resultMap>` 中的 `property` 属性跳转到 Java 字段定义。
    -   **Java 类**：跳转到 `resultType` 或 `parameterType` 对应的 Java 类。
-   **悬停提示**：
    -   **MyBatis 参数**：悬停在 XML 中的 `#{variable}` 或 `${variable}` 上，可查看对应的 Java 类型及 Javadoc 注释。

### 2. 强大的 SQL 高亮与格式化
-   **多数据库方言支持**：全面支持 **MySQL, PostgreSQL, Oracle, SQL Server, SQLite, DB2, H2, MariaDB** 8 种主流数据库方言。
-   **增强高亮**：根据所选方言，智能高亮 SQL 关键字、系统函数及 MyBatis 参数 (`#{...}`, `${...}`)。例如，在 PostgreSQL 模式下会高亮 `RETURNING`, `ILIKE` 等特有关键字。
-   **智能格式化**：
    -   根据方言规则自动处理引号（如 MySQL 的 \`，SQL Server 的 `[]`，Oracle/PG 的 `""`）。
    -   支持复杂的 SQL 结构格式化，包括嵌套子查询、`UNION`、`CASE WHEN` 等。
    -   **注释保留**：格式化时完整保留 XML 注释 (`<!-- -->`) 和 SQL 注释 (`--`)。

> [!TIP]
> **提示**：插件会自动根据当前激活的数据库连接推断方言。您也可以在设置中配置 `mybatisToolkit.defaultDatabaseType` 来指定默认使用的数据库方言。

### 3. 数据库管理器 & 多数据源
-   **多连接管理**：支持连接多种数据库（MySQL, PostgreSQL, Oracle, SQL Server, SQLite, DB2, H2, MariaDB）。
-   **虚拟架构视图**：直接在 VS Code 中查看表结构和**注释**。
-   **注释提示**：
    -   数据库资源管理器树状图中直接显示表和字段的注释。
    -   鼠标悬停在表名或字段名上时显示详细注释信息。

### 4. 高级验证
-   **SQL 实时验证**：实时验证 SQL 中的表名和列名。
-   **类型安全**：
    -   **结果映射**：检查 `resultMap` 和 `resultType` 中的字段是否存在于 Java 类中。
    -   **SQL 返回值**：验证 SQL `SELECT` 的列是否与 Java 返回对象的属性匹配（自动处理下划线转驼峰）。
    -   **嵌套验证**：正确处理嵌套 `<association>` 和 `<collection>` 标签中的属性验证。
    -   **ResultMap 白名单**：自动识别 `resultMap` 中显式映射的列，避免误报。

### 5. 代码生成器 (Code Generator)
-   **从数据库生成代码**：右键点击数据库表，选择 "Generate Code"，自动生成 Entity、Mapper 接口和 XML 文件。
    -   自动映射数据类型。
    -   支持 Lombok 注解。
    -   包含基础 CRUD 操作。

### 6. 方法名生成 SQL (Generate SQL from Method)
-   **智能 SQL 生成**：在 Mapper 接口中编写方法名（如 `selectUserByNameAndAge`），点击灯泡图标（Quick Fix），自动生成对应的 XML SQL 语句。
    -   支持 `select`, `update`, `delete`, `count`, `insert` 前缀。
    -   支持 `And`, `Or` 多条件连接。
    -   支持 `Like`, `In` 等后缀。

## 需求

-   **VS Code**：版本 1.90.0 或更高。

## 配置

您可以在 VS Code 设置中自定义扩展。

### 数据库配置（验证和导航所需）

```json
{
  "mybatisToolkit.database.host": "localhost",
  "mybatisToolkit.database.port": 3306,
  "mybatisToolkit.database.user": "root",
  "mybatisToolkit.database.password": "your_password",
  "mybatisToolkit.database.database": "your_database"
}
```

### 外观与格式化

```json
{
  "mybatisToolkit.formatting.indentSize": 2,
  "mybatisToolkit.highlights.tableNameColor": "#FFAB70",
  "mybatisToolkit.highlights.keywordColor": "#C586C0",
  "mybatisToolkit.highlights.functionColor": "#DCDCAA",
  "mybatisToolkit.highlights.paramColor": "#9CDCFE"
}
```

## 贡献

欢迎通过 [GitHub Issues](https://github.com/xiyeming/mybatis-toolkit-pro/issues) 提交问题或建议。如果您想为项目贡献代码，请 fork 本仓库并提交 Pull Request。

## 许可证

[MIT](LICENSE.md)
