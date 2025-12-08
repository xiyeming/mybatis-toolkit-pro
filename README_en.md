# MyBatis Toolkit Pro

[English](README.md) | [中文](README_zh.md)

Professional MyBatis development toolkit for VS Code, designed to boost your productivity with smart navigation, SQL validation, and rich syntax highlighting.

## Features

### 1. Smart Navigation
-   **Go to Definition**:
    -   **Table Names**: Click on a table name in XML to jump to a schema view.
    -   **ResultMap Properties**: Cmd+Click (Ctrl+Click) on `property` attributes in `<resultMap>` to jump to the Java field definition.

### 2. Rich SQL Highlighting
-   **Enhanced Syntax Highlighting**: Full support for SQL keywords, functions, and MyBatis parameters (`#{...}`, `${...}`).
-   **Comprehensive Coverage**: Includes highlighting for hundreds of MySQL keywords and functions.

### 3. Database Explorer & Multi-Datasource
-   **Multiple Connections**: Manage multiple MySQL connections from the sidebar (Host, Port, User, Password, Database).
-   **Virtual Schema View**: View table definitions and **comments** directly in VS Code.
-   **Comments Display**: Table and column comments are shown in the Database Explorer tree.

### 4. Advanced Validation
-   **SQL Validation**: Real-time validation of table names and columns in your SQL.
-   **Type Safety**:
    -   **Result Mapping**: Checks if fields in `resultMap` and `resultType` actually exist in the corresponding Java class.
    -   **SQL Return Types**: Validates that columns selected in SQL match the properties of the Java return type (handles snake_case to camelCase conversion automatically).
    -   **Nested Validations**: Properly handles attributes in nested `<association>` and `<collection>` tags.

### 5. Code Formatting
-   **SQL Formatting**: Automatically formats SQL blocks within your XML mapper files.

## Requirements

-   **VS Code**: Version 1.90.0 or higher.

## Configuration

You can customize the extension in VS Code settings.

### Database Configuration (Required for Validation & Navigation)

```json
{
  "mybatisToolkit.database.host": "localhost",
  "mybatisToolkit.database.port": 3306,
  "mybatisToolkit.database.user": "root",
  "mybatisToolkit.database.password": "your_password",
  "mybatisToolkit.database.database": "your_database"
}
```

### Appearance & Formatting

```json
{
  "mybatisToolkit.formatting.indentSize": 2,
  "mybatisToolkit.highlights.tableNameColor": "#FFAB70",
  "mybatisToolkit.highlights.keywordColor": "#C586C0",
  "mybatisToolkit.highlights.functionColor": "#DCDCAA",
  "mybatisToolkit.highlights.paramColor": "#9CDCFE"
}
```

## License

[MIT](LICENSE.md)
