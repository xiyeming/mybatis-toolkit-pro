# MyBatis Toolkit Pro

![MyBatis Toolkit Pro](images/mybatis.png)

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/xiyeming.mybatis-toolkit-pro)](https://marketplace.visualstudio.com/items?itemName=xiyeming.mybatis-toolkit-pro)
[![GitHub stars](https://img.shields.io/github/stars/xiyeming/mybatis-toolkit-pro)](https://github.com/xiyeming/mybatis-toolkit-pro)
[![License](https://img.shields.io/github/license/xiyeming/mybatis-toolkit-pro)](https://github.com/xiyeming/mybatis-toolkit-pro/blob/main/LICENSE.md)
[![Version](https://img.shields.io/badge/version-1.1.4-blue)](https://github.com/xiyeming/mybatis-toolkit-pro/releases)

[English](README_en.md) | [中文](README.md)

Professional MyBatis development toolkit for VS Code. Improve productivity with smart navigation, SQL validation, multi-datasource management, and built-in query execution.

## ✨ Key Features

- 🚀 **Smart Navigation**: Mapper ↔ XML jump, table/ResultMap property/Java class go-to-definition, parameter hover and type hints
- 🎨 **SQL Highlighting & Formatting**: 8 database dialects, keyword/function/parameter highlighting, configurable quotes and indent
- 🗄️ **Database Management**: Multiple connections, Database Explorer, table schema view, run SQL and view results
- 🔍 **Query & Results**: New query, run selected/all SQL, pagination, row numbers, configurable date format, multiple result tabs
- ✅ **Advanced Validation**: Table/column existence, resultMap/resultType vs Java property matching, nested association/collection
- 🛠️ **Code Generation**: Generate Entity / Mapper interface / XML from table
- ⚡ **Method-to-SQL**: Generate XML SQL from Mapper method name (Quick Fix)

---

## 📦 Installation

- **VS Code Marketplace**: Search for "MyBatis Toolkit Pro" and install.
- **VSIX**: Download the `.vsix` from [Releases](https://github.com/xiyeming/mybatis-toolkit-pro/releases) and install via "Install from VSIX...".

**Requirements**: VS Code 1.100.0 or higher.

---

## 🚀 1. Smart Navigation

- **Go to Definition**
  - **Database tables**: Click a table name in XML → jump to virtual schema view.
  - **ResultMap properties**: **Ctrl+Click (Cmd+Click)** on `property` in `<resultMap>` → jump to Java field.
  - **Java classes**: `resultType` / `parameterType` → jump to the corresponding Java class.
- **Mapper ↔ XML**: Jump between Mapper interface and its XML (commands or CodeLens).
- **Hover**: Hover over `#{variable}` / `${variable}` to see Java type and Javadoc.

---

## 🎨 2. SQL Highlighting & Formatting

- **Dialects**: MySQL, PostgreSQL, Oracle, SQL Server, SQLite, DB2, H2, MariaDB.
- **Highlighting**: Keywords, system functions, MyBatis parameters; dialect-specific keywords (e.g. PostgreSQL `RETURNING`, `ILIKE`).
- **Formatting**: Dialect-aware quotes and indent; supports subqueries, `UNION`, `CASE WHEN`; preserves XML and SQL comments.
- **Default dialect**: Set `mybatisToolkit.defaultDatabaseType`; if a database is connected, the current connection type is used first.

---

## 🗄️ 3. Database Management & Query Execution

### 3.1 Database Explorer (MyBatis sidebar)

- **Connections**: "Add connection" to configure host, port, user, password, database type and name; multiple datasources supported.
- **Actions**: Connect / Disconnect, Edit, Remove, Refresh.
- **Tables & schema**: Expand a connection to see tables; right-click a table for "Open table schema" or "Generate code".

### 3.2 Running SQL

1. **Select database**: Click "Select database" in the SQL editor title bar, or connect from the sidebar, then run SQL.
2. **New query**: Run "New query window" from the command palette or from the Database Explorer to open a blank SQL file.
3. **Execution**:
   - **Run selected SQL**: Execute the selection, or the current statement when nothing is selected.
   - **Run all SQL**: Execute all statements in the current file (split by semicolons).

### 3.3 Shortcuts (SQL editor only)

| Action | Windows / Linux | macOS |
|--------|-----------------|-------|
| Run selected SQL | `Ctrl+Shift+,` | `Cmd+Shift+,` |
| Run all SQL | `Ctrl+Shift+.` | `Cmd+Shift+.` |

You can change these in **Keyboard Shortcuts** (Ctrl+K Ctrl+S) by searching for "Run selected SQL" or "Run all SQL".

### 3.4 Query Results

- **Single execution**: One result tab; shows affected rows, execution time, and row count when applicable.
- **Run all SQL**: Each statement gets its own result tab (e.g. "Query result (1/3)") for separate viewing.
- **Result grid**: Row number column, pagination (prev/next), resizable columns, click a cell to popover full content.
- **Date/time**: Display follows settings; list and popover use the same format.
  - Settings: `queryResult.datetimeFormat`, `queryResult.dateFormat`, `queryResult.timeFormat` (placeholders: `%Y` `%m` `%d` `%H` `%i` `%s`).

### 3.5 Show full structure

From the Database Explorer view title or related entry, run "Show full structure (tables & columns)" to open a result panel with all tables and columns for the current database.

---

## ✅ 4. Advanced Validation

- **SQL validation**: Real-time check that table and column names in SQL exist.
- **Result mapping**: Check that `resultMap` / `resultType` match Java class properties (including snake_case to camelCase).
- **Nested**: Validates properties inside `<association>` and `<collection>`; uses resultMap explicit columns to reduce false positives.
- Toggle with `mybatisToolkit.validation.enable` in settings.

---

## 🛠️ 5. Code Generation

- In the **Database Explorer**, right-click a table → "Generate code (Entity/Mapper/XML)".
- Enter the package name when prompted; generates Entity, Mapper interface, and XML with basic CRUD and type mapping; Lombok optional.

---

## ⚡ 6. Method name to SQL

- In a Mapper interface, write a method name (e.g. `selectUserByNameAndAge`); use the lightbulb Quick Fix to generate the corresponding XML SQL.
- Supports prefixes: `select`, `update`, `delete`, `count`, `insert`; condition links: `And`, `Or`; suffixes like `Like`, `In`, etc.

---

## Configuration Summary

Search for "MyBatis" in VS Code settings to see all options.

| Category | Example | Description |
|-----------|---------|-------------|
| Dialect | `mybatisToolkit.defaultDatabaseType` | Default database type (highlighting/formatting) |
| Connections | `mybatisToolkit.connections` | Multi-datasource list; also host/port/user/password/database |
| Validation | `mybatisToolkit.validation.enable` | Enable/disable SQL and mapping validation |
| Navigation | `mybatisToolkit.navigation.exclude` | Directories to exclude from indexing (e.g. target, node_modules) |
| Performance | `indexParseConcurrency`, `indexDebounceMs`, `validationDebounceMs` | Index concurrency and debounce |
| Query result | `queryResult.datetimeFormat` etc. | Date/time display formats |
| Formatting | `formatting.indentSize` | SQL indent size (spaces) |
| Highlights | `highlights.tableNameColor` etc. | Table name, keyword, function, parameter colors |

---

## Contributing

Issues and suggestions are welcome via [GitHub Issues](https://github.com/xiyeming/mybatis-toolkit-pro/issues). Pull requests are welcome.

## License

[MIT](LICENSE.md)
