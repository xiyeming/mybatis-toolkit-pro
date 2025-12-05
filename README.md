# MyBatis Toolkit Pro

[English](README.md) | [中文](README_zh.md)

Professional MyBatis development toolkit for VS Code, designed to boost your productivity with smart navigation, SQL validation, and rich syntax highlighting.

## Features

### 1. Smart Navigation
-   **Jump to Definition**: Click on a table name in your XML mapper to jump to its definition (requires Database Client integration).
-   **CodeLens**:
    -   **Java Interface**: Quickly jump to the corresponding XML mapper file.
    -   **XML Mapper**: Quickly jump to the corresponding Java interface method.

### 2. Rich SQL Highlighting
-   **Enhanced Syntax Highlighting**: Full support for SQL keywords, functions, and MyBatis parameters (`#{...}`, `${...}`).
-   **Comprehensive Coverage**: Includes highlighting for hundreds of MySQL keywords (e.g., `DESC`, `ASC`, `INTERVAL`) and functions (e.g., `DATE_SUB`, `NOW`, `IF`).
-   **Customizable Colors**: Configure colors for table names, keywords, functions, and parameters in VS Code settings.

### 3. Database Support
-   **Standalone Support**: Built-in MySQL support for table validation and schema viewing.
-   **SQL Validation**: Real-time validation of table names in your XML mappers against your configured database.
-   **Go to Definition**: Jump directly to a virtual schema view of the table.

### 4. Code Formatting
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
