# MyBatis Toolkit Pro

<p align="center">
  <img src="images/mybatis.png" alt="MyBatis Toolkit Pro" width="128">
</p>

<p align="center">
  <strong>Professional MyBatis Development Toolkit for VS Code</strong>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=xiyeming.mybatis-toolkit-pro">
    <img src="https://img.shields.io/visual-studio-marketplace/v/xiyeming.mybatis-toolkit-pro?style=flat-square&label=VS%20Code%20Marketplace" alt="VS Code Marketplace Version">
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=xiyeming.mybatis-toolkit-pro">
    <img src="https://img.shields.io/visual-studio-marketplace/i/xiyeming.mybatis-toolkit-pro?style=flat-square" alt="Installs">
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=xiyeming.mybatis-toolkit-pro">
    <img src="https://img.shields.io/visual-studio-marketplace/r/xiyeming.mybatis-toolkit-pro?style=flat-square" alt="Rating">
  </a>
  <a href="https://github.com/xiyeming/mybatis-toolkit-pro/actions/workflows/package.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/xiyeming/mybatis-toolkit-pro/package.yml?style=flat-square&label=CI" alt="CI Status">
  </a>
  <a href="https://github.com/xiyeming/mybatis-toolkit-pro/releases">
    <img src="https://img.shields.io/github/v/release/xiyeming/mybatis-toolkit-pro?style=flat-square" alt="GitHub Release">
  </a>
  <a href="https://github.com/xiyeming/mybatis-toolkit-pro/blob/main/LICENSE.md">
    <img src="https://img.shields.io/github/license/xiyeming/mybatis-toolkit-pro?style=flat-square" alt="License">
  </a>
  <a href="https://github.com/xiyeming/mybatis-toolkit-pro">
    <img src="https://img.shields.io/github/stars/xiyeming/mybatis-toolkit-pro?style=flat-square" alt="GitHub Stars">
  </a>
</p>

<p align="center">
  <a href="README.md">中文</a> | <a href="README_en.md">English</a>
</p>

---

## 📖 Table of Contents

- [✨ Features](#-features)
- [📦 Installation](#-installation)
- [🚀 Getting Started](#-getting-started)
- [🎯 Smart Navigation](#-smart-navigation)
- [🎨 SQL Highlighting & Formatting](#-sql-highlighting--formatting)
- [🗄️ Database Management](#️-database-management)
- [🔍 Query Execution](#-query-execution)
- [✅ SQL Validation](#-sql-validation)
- [🛠️ Code Generation](#️-code-generation)
- [⚡ Method Name to SQL](#-method-name-to-sql)
- [⚙️ Configuration](#️-configuration)
- [🔧 Development Guide](#-development-guide)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)
- [🙏 Acknowledgements](#-acknowledgements)

---

## ✨ Features

### 🚀 Smart Navigation
- **Mapper ↔ XML Jump**: Quick jump between Mapper interface and XML
- **Table Name Jump**: Click table name in SQL → jump to database schema view
- **ResultMap Property Jump**: Ctrl+Click to jump to Java field definition
- **SQL Column Jump**: Supports alias priority, jumps to Entity field or resultMap column
- **Parameter Hover**: Hover over `#{variable}` to see Java type and Javadoc
- **CodeLens**: Shows "Jump to XML / Jump to Interface" above Mapper methods

### 🎨 SQL Highlighting & Formatting
- **8 Database Dialects**: MySQL, PostgreSQL, Oracle, SQL Server, SQLite, DB2, H2, MariaDB
- **Semantic Highlighting**: Keywords, system functions, MyBatis parameters, table names with independent colors
- **Smart Formatting**: Supports subqueries, UNION, CASE WHEN, bracket indentation, XML tag inheritance
- **Dialect-Aware**: Keyword lists and quote characters change with database dialect

### 🗄️ Multi-Datasource Management
- **Database Explorer**: Sidebar TreeView showing connections, tables, columns hierarchy
- **Multiple Connections**: Configure multiple datasources, switch with one click
- **Table Schema View**: View column names, types, comments, primary keys, defaults
- **Test Connection**: Real-time connectivity verification during configuration

### 🔍 SQL Query Execution
- **Run Selected SQL**: Execute selection or current statement instantly
- **Run All SQL**: Split by semicolons, each statement gets independent result window
- **Result Panel**: Pagination, row numbers, resizable columns, cell popup for full details
- **Date Formatting**: Configurable datetime/date/time display formats

### ✅ Advanced Validation
- **Table/Column Existence**: Real-time check that referenced tables and columns exist
- **Result Mapping Validation**: Check resultMap/resultType matches Java properties
- **Nested Support**: Validates properties inside association/collection
- **Auto .gitignore**: Automatically excludes gitignore directories during indexing

### 🛠️ Code Generation
- **One-Click Generate**: Right-click table → Generate Entity, Mapper, XML, Service, ServiceImpl
- **MyBatis-Plus Style**: `@TableName`, `@TableId`, `BaseMapper`, `IService`
- **MyBatis Style**: Traditional Mapper interface + full XML CRUD
- **Configurable**: Auto-fill fields, logic delete, primary key strategy, directory names

### ⚡ Method Name to SQL
- **Quick Fix**: Write method name (e.g., `selectUserByNameAndAge`), lightbulb prompt auto-generates SQL
- **Supported Prefixes**: select, update, delete, count, insert
- **Condition Links**: And, Or; Suffixes: Like, In, Between, etc.

---

## 📦 Installation

### Option 1: VS Code Marketplace (Recommended)

1. Open VS Code
2. Press `Ctrl+Shift+X` to open Extensions
3. Search for **MyBatis Toolkit Pro**
4. Click **Install**

### Option 2: Command Line

```bash
code --install-extension xiyeming.mybatis-toolkit-pro
```

### Option 3: VSIX Manual Install

1. Download the latest `.vsix` from [GitHub Releases](https://github.com/xiyeming/mybatis-toolkit-pro/releases)
2. VS Code → Extensions panel → `...` → **Install from VSIX...**
3. Select the downloaded `.vsix` file

### Requirements

| Dependency | Version |
|------------|---------|
| VS Code | `^1.100.0` |
| Node.js | `>=16` (for driver installation) |

### Optional Database Drivers

Built-in drivers (work out of the box):
- `mysql2` — MySQL / MariaDB
- `pg` — PostgreSQL

Drivers requiring manual installation:

| Database | Driver Package | Install Command |
|----------|----------------|-----------------|
| Oracle | `oracledb` | `npm install oracledb` |
| SQL Server | `mssql` | `npm install mssql` |
| SQLite | `better-sqlite3` | `npm install better-sqlite3` |
| DB2 | `ibm_db` | `npm install ibm_db` |
| H2 | `jdbc` + H2 jar | `npm install jdbc` + configure `options.jarPath` |

> 💡 You can also specify the local driver path in the connection's `driverPath` field without global installation.

---

## 🚀 Getting Started

### 1. Add Database Connection

1. Click the **MyBatis** icon in the sidebar
2. Click the **+** button in the title bar (Add Connection)
3. Fill in database type, host, port, username, password, database name
4. Click **Test Connection** to verify
5. Click **Add** to save

### 2. Browse Database

- Expand connection to view table list
- Right-click table → **Open Table Schema** to view column info
- Right-click table → **Generate Code** to generate Entity/Mapper/XML

### 3. Execute SQL

1. Create or open a `.sql` file
2. Click the database icon in the editor title bar to select connection
3. Select SQL statement, press `Ctrl+Shift+,` to execute

### 4. Navigate Code

- Click **Jump to XML** above methods in Mapper interface
- Ctrl+Click table names in XML to jump to schema view
- Ctrl+Click `resultType` class names to jump to Java class

---

## 🎯 Smart Navigation

### Mapper ↔ XML Jump

```
┌─────────────────────┐         ┌─────────────────────┐
│   UserMapper.java   │ ◄─────► │   UserMapper.xml    │
│                     │         │                     │
│  + selectById()     │         │  <select id=        │
│  + selectByName()   │         │   "selectById">     │
│  + insert()         │         │                     │
└─────────────────────┘         └─────────────────────┘
```

- **CodeLens**: Shows "Jump to XML" / "Jump to Interface" above methods
- **Commands**: Right-click → **MyBatis: Jump to XML / Jump to Mapper Interface**

### Table & Column Name Jump

```sql
SELECT u.user_name, u.email
FROM biz_user u  -- Ctrl+Click biz_user to jump to table schema
WHERE u.id = #{userId}
```

### ResultMap Property Jump

```xml
<resultMap id="userMap" type="com.example.entity.User">
    <id column="user_id" property="userId" />  <!-- Ctrl+Click userId to jump to Java field -->
    <result column="user_name" property="userName" />
</resultMap>
```

---

## 🎨 SQL Highlighting & Formatting

### Semantic Highlighting

| Element | Default Color | Configuration |
|---------|---------------|---------------|
| Table Name | 🟠 `#FFAB70` | `highlights.tableNameColor` |
| Keyword | 🟣 `#C586C0` | `highlights.keywordColor` |
| Function | 🟡 `#DCDCAA` | `highlights.functionColor` |
| Parameter | 🔵 `#9CDCFE` | `highlights.paramColor` |

### Formatting Example

```sql
-- Before formatting
SELECT u.id,u.name,o.order_no FROM biz_user u LEFT JOIN biz_order o ON u.id=o.user_id WHERE u.status=1 AND o.amount>100

-- After formatting
SELECT
    u.id,
    u.name,
    o.order_no
FROM biz_user u
LEFT JOIN biz_order o
    ON u.id = o.user_id
WHERE u.status = 1
    AND o.amount > 100
```

### Supported Dialects

| Database | Keywords | Functions | Quotes |
|----------|----------|-----------|--------|
| MySQL | ✅ | ✅ | `` ` `` |
| PostgreSQL | ✅ | ✅ | `"` |
| Oracle | ✅ | ✅ | `"` |
| SQL Server | ✅ | ✅ | `[]` |
| SQLite | ✅ | ✅ | `"` |
| DB2 | ✅ | ✅ | `"` |
| H2 | ✅ | ✅ | `"` |
| MariaDB | ✅ | ✅ | `` ` `` |

---

## 🗄️ Database Management

### Database Explorer

```
📦 MyBasis
├── 🟢 Production DB (MySQL) - root@localhost:3306/prod
│   ├── 📋 biz_user
│   │   ├── 🔑 id: bigint
│   │   ├── user_name: varchar
│   │   └── email: varchar
│   ├── 📋 biz_order
│   └── 📋 biz_product
└── 🔴 Test DB (PostgreSQL) - admin@192.168.1.100:5432/test
```

### Connection Management

- **Add Connection**: Click **+** button in title bar
- **Edit Connection**: Right-click connection → Edit
- **Test Connection**: Click "Test Connection" in edit dialog
- **Delete Connection**: Right-click connection → Remove
- **Connect/Disconnect**: Right-click connection → Connect/Disconnect

### Supported Databases

| Database | Status | Driver |
|----------|--------|--------|
| MySQL | ✅ Built-in | `mysql2` |
| MariaDB | ✅ Built-in | `mysql2` |
| PostgreSQL | ✅ Built-in | `pg` |
| Oracle | ✅ Optional | `oracledb` |
| SQL Server | ✅ Optional | `mssql` |
| SQLite | ✅ Optional | `better-sqlite3` |
| DB2 | ✅ Optional | `ibm_db` |
| H2 | ✅ Optional | `jdbc` |

---

## 🔍 Query Execution

### Keyboard Shortcuts

| Action | Windows / Linux | macOS |
|--------|-----------------|-------|
| Run Selected SQL | `Ctrl+Shift+,` | `Cmd+Shift+,` |
| Run All SQL | `Ctrl+Shift+.` | `Cmd+Shift+.` |

### Result Panel

- **Pagination**: Previous/Next page, supports large result sets
- **Row Numbers**: First column shows row number
- **Column Width**: Drag to resize
- **Cell Details**: Click to popup full content
- **Date Format**: Configurable display format

### Run All SQL

Execute all statements in file split by semicolons, each statement gets independent result window:

```
Query Result (1/3)  Query Result (2/3)  Query Result (3/3)
```

---

## ✅ SQL Validation

### Table/Column Validation

```xml
<select id="selectUser" resultType="User">
    SELECT user_name, non_exist_column  <!-- ⚠️ Column not found -->
    FROM non_exist_table  <!-- ⚠️ Table not found -->
</select>
```

### Result Mapping Validation

```xml
<resultMap id="userMap" type="User">
    <result column="user_name" property="nonExistField" />  <!-- ⚠️ Property not found -->
</resultMap>
```

### Validation Configuration

```json
{
  "mybatisToolkit.validation.enable": true
}
```

---

## 🛠️ Code Generation

### Generated Content

Right-click table → **Generate Code**, select style to auto-generate:

| File | MyBatis-Plus | MyBatis |
|------|--------------|---------|
| Entity | `@TableName` `@TableId` | POJO |
| Mapper | Extends `BaseMapper` | Full CRUD methods |
| XML | resultMap + Base_Column_List | Full SQL |
| Service | Extends `IService` | Interface + CRUD methods |
| ServiceImpl | Extends `ServiceImpl` | Inject Mapper implementation |

### Generated Directory Structure

```
src/main/java/
└── com/example/
    ├── entity/
    │   └── User.java
    ├── mapper/
    │   └── UserMapper.java
    └── service/
        ├── UserService.java
        └── impl/
            └── UserServiceImpl.java

src/main/resources/
└── mapper/
    └── UserMapper.xml
```

### MyBatis-Plus Configurable Options

| Config | Description | Example |
|--------|-------------|---------|
| `codeGen.mybatisPlus.fillFields` | Auto-fill fields | `[{column: "create_time", fill: "INSERT"}]` |
| `codeGen.mybatisPlus.logicDeleteField` | Logic delete field | `del_flag` |
| `codeGen.mybatisPlus.idType` | Primary key strategy | `AUTO` / `ASSIGN_ID` / `ASSIGN_UUID` |

---

## ⚡ Method Name to SQL

Write method name in Mapper interface, use Quick Fix to auto-generate XML SQL:

```java
// Write method name
List<User> selectUserByNameAndAge(String name, Integer age);
```

↓ Quick Fix auto-generates ↓

```xml
<select id="selectUserByNameAndAge" resultMap="BaseResultMap">
    SELECT * FROM user
    WHERE name = #{name}
      AND age = #{age}
</select>
```

### Supported Method Name Patterns

| Prefix | Description | Example |
|--------|-------------|---------|
| `select` | Query | `selectByName` |
| `insert` | Insert | `insertSelective` |
| `update` | Update | `updateById` |
| `delete` | Delete | `deleteByStatus` |
| `count` | Count | `countByType` |

| Connector | Description | Example |
|-----------|-------------|---------|
| `And` | AND condition | `ByNameAndAge` |
| `Or` | OR condition | `ByStatusOrType` |

| Suffix | Description | Example |
|--------|-------------|---------|
| `Like` | LIKE query | `ByNameLike` |
| `In` | IN query | `ByIdIn` |
| `Between` | BETWEEN | `ByDateBetween` |
| `OrderBy` | Sort | `OrderByNameDesc` |

---

## ⚙️ Configuration

Search `mybatisToolkit` in VS Code settings to see all options.

### Database Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `database.defaultType` | string | `MySQL` | Default database dialect |
| `connections` | array | `[]` | Database connection list |

### Validation Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `validation.enable` | boolean | `true` | Enable SQL validation |

### Index Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `navigation.exclude` | array | `["target", "build", ...]` | Index exclude directories |

### Performance Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `performance.indexParseConcurrency` | number | `20` | Index concurrency |
| `performance.indexDebounceMs` | number | `300` | Index debounce (ms) |
| `performance.validationDebounceMs` | number | `400` | Validation debounce (ms) |

### Formatting Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `formatting.indentSize` | number | `4` | Indent spaces |

### Highlight Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `highlights.tableNameColor` | color | `#FFAB70` | Table name color |
| `highlights.keywordColor` | color | `#C586C0` | Keyword color |
| `highlights.functionColor` | color | `#DCDCAA` | Function color |
| `highlights.paramColor` | color | `#9CDCFE` | Parameter color |

### Query Result Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `queryResult.datetimeFormat` | string | `%Y-%m-%d %H:%i:%s` | Datetime format |
| `queryResult.dateFormat` | string | `%Y-%m-%d` | Date format |
| `queryResult.timeFormat` | string | `%H:%i:%s` | Time format |

### Code Generation Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `codeGen.dirs.entity` | string | `entity` | Entity directory name |
| `codeGen.dirs.mapper` | string | `mapper` | Mapper directory name |
| `codeGen.dirs.xml` | string | `mapper` | XML directory name |
| `codeGen.dirs.service` | string | `service` | Service directory name |
| `codeGen.mybatisPlus.idType` | enum | `AUTO` | Primary key strategy |
| `codeGen.mybatisPlus.logicDeleteField` | string | `` | Logic delete field |
| `codeGen.mybatisPlus.fillFields` | array | `[]` | Auto-fill fields |

---

## 🔧 Development Guide

### Prerequisites

```bash
# Clone repository
git clone https://github.com/xiyeming/mybatis-toolkit-pro.git
cd mybatis-toolkit-pro

# Install dependencies
npm install

# Compile
npm run compile

# Watch mode
npm run watch
```

### Project Structure

```
mybatis-toolkit-pro/
├── src/
│   ├── extension.ts              # Extension entry point
│   ├── config.ts                 # Configuration reading
│   ├── constants.ts              # Constants
│   ├── types.ts                  # Type definitions
│   ├── providers/                # VS Code Providers
│   │   ├── MyBatisCodeLensProvider.ts
│   │   ├── SqlDefinitionProvider.ts
│   │   ├── SqlFormattingProvider.ts
│   │   ├── SqlHighlightingProvider.ts
│   │   ├── SqlValidationProvider.ts
│   │   ├── DatabaseTreeDataProvider.ts
│   │   └── ...
│   ├── services/                 # Business services
│   │   ├── DatabaseService.ts    # Database service
│   │   ├── CodeGenerationService.ts
│   │   ├── ProjectIndexer.ts     # Project indexer
│   │   └── db/                   # Database adapters
│   │       ├── IDbAdapter.ts
│   │       ├── MySQLAdapter.ts
│   │       ├── PgAdapter.ts
│   │       └── ...
│   ├── panels/                   # WebView panels
│   │   ├── QueryResultsPanel.ts
│   │   ├── ConnectionFormPanel.ts
│   │   └── CodeGenFormPanel.ts
│   └── utils/                    # Utilities
│       ├── JavaAstUtils.ts
│       ├── SqlTokenizer.ts
│       ├── DriverLoader.ts
│       └── LruCache.ts
├── package.json
├── tsconfig.json
├── webpack.config.js
└── images/
    └── mybatis.png
```

### Development Commands

| Command | Description |
|---------|-------------|
| `npm run compile` | Webpack development mode compile |
| `npm run watch` | Watch mode compile |
| `npm run package` | Production mode build |
| `npm run lint` | ESLint check |
| `npm run pretest` | Full verification (compile test + compile + lint) |

### Debug Extension

1. Press `F5` to start debugging
2. Select **Run Extension**
3. Test the extension in the new window

### Package VSIX

```bash
npm install -g @vscode/vsce
vsce package
```

---

## 🤝 Contributing

Contributions, issues and feature requests are welcome!

### Reporting Issues

- [GitHub Issues](https://github.com/xiyeming/mybatis-toolkit-pro/issues)
- Please provide: VS Code version, extension version, reproduction steps, error logs

### Submitting PRs

1. Fork the repository
2. Create feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -m 'feat: add my feature'`
4. Push branch: `git push origin feature/my-feature`
5. Create Pull Request

### Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: New feature
fix: Bug fix
docs: Documentation
style: Formatting
refactor: Code refactoring
test: Tests
chore: Build/tooling
```

---

## 📄 License

[MIT License](LICENSE.md)

---

## 🙏 Acknowledgements

- [VS Code Extension API](https://code.visualstudio.com/api)
- [MyBatis](https://mybatis.org/mybatis-3/)
- [MyBatis-Plus](https://baomidou.com/)
- [mysql2](https://github.com/sidorares/node-mysql2)
- [pg](https://github.com/brianc/node-postgres)

---

<p align="center">
  If this extension helps you, please give a ⭐ Star to support!
</p>
