# MyBatis Toolkit Pro

[English](README.md) | [中文](README_zh.md)

专为 VS Code 设计的专业 MyBatis 开发工具包，旨在通过智能导航、SQL 验证和丰富的语法高亮提高您的生产力。

## 功能特性

### 1. 智能导航
-   **跳转到定义**：
    -   **数据库表**：在 XML 映射文件中点击表名即可跳转到其虚拟架构定义。
    -   **Java 类**：按住 `Cmd/Ctrl` 点击 `resultType`、`parameterType` 或 `id` 中的 Java 类名，跳转到对应的 Java 类定义。
    -   **ResultMap**：按住 `Cmd/Ctrl` 点击 `resultMap` 属性值，跳转到对应的 `<resultMap>` 定义。
-   **CodeLens**：
    -   **Java 接口**：快速跳转到对应的 XML 映射文件。
    -   **XML 映射**：快速跳转到对应的 Java 接口方法。

### 2. 强大的 SQL 验证
-   **实时验证**：根据配置的数据库实时验证 XML 中的表名和字段名。
-   **智能识别**：
    -   支持 **表别名** 和 **列别名**（`AS alias`）。
    -   支持 **子查询别名**（`FROM (SELECT ...) t2`）。
    -   支持 **JSON 函数**（`JSON_EXTRACT`, `JSON_UNQUOTE` 等）。
    -   自动忽略 **XML 实体**（`&lt;`, `&gt;`）和 **字符串常量**，避免误报。
-   **错误提示**：当表或字段不存在时，提供精确的波浪线错误提示。

### 3. 丰富的 SQL 高亮
-   **增强的语法高亮**：全面支持 SQL 关键字、函数以及 MyBatis 参数（`#{...}`、`${...}`）。
-   **全面覆盖**：包含数百个 MySQL 关键字（如 `DESC`、`ASC`、`INTERVAL`）和函数（如 `DATE_SUB`、`NOW`、`IF`）的高亮显示。
-   **可自定义颜色**：在 VS Code 设置中配置表名、关键字、函数和参数的颜色。

### 4. 性能优化
-   **极速启动**：经过 Webpack 打包优化，插件体积小，启动速度快。
-   **增量索引**：智能索引项目中的 Java 和 XML 文件，提供毫秒级跳转体验。

### 5. 代码格式化
-   **SQL 格式化**：自动格式化 XML 映射文件中的 SQL 代码块。

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

## 许可证

[MIT](LICENSE.md)
