# 变更日志

本文件记录 “MyBatis Toolkit Pro” 扩展的重要变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [1.6.2] - 2026-06-23

### 优化

- **测试连接日志**：`DatabaseService.testConnection()` 与 `ConnectionFormPanel.handleTestConnection()` 添加详细 VS Code 输出通道日志，记录连接参数（不含密码）、适配器类型、耗时与结果，便于排查连接问题。
- **代码生成日志**：`CodeGenerationService.generateCode()` 添加完整日志链路，记录开始参数、获取列数、主键列、输出文件路径与耗时，异常时记录错误信息。

---

## [1.6.0] - 2026-06-23

### 优化

- **删除设置 UI 单连接配置**：移除 `mybatisToolkit.database.host/port/user/password/database/connectionLimit` 等 legacy 配置项，设置界面中仅保留 `database.defaultType` 与 `connections`，引导用户通过侧栏管理连接。
- **代码生成弹窗重构**：将原来的 3 个顺序弹窗（输入包名 → 选择风格 → 选择目录）合并为单个 WebView 弹窗，支持：
  - 基础包名输入
  - 代码风格下拉选择（MyBatis-Plus / MyBatis）
  - 生成目录输入框（支持手动输入路径）
  - 实时预览生成路径与包名
  - 取消 / 生成按钮

### 修复

- **WebView 弹窗按钮无反应**：连接表单与代码生成弹窗的消息处理添加 try-catch，修复 WebView 与扩展通信时的静默失败问题。
- **测试连接状态卡住**：`handleTestConnection` 添加错误处理，确保测试结果始终回传 WebView，按钮状态正确恢复。
- **表单验证改进**：移除 HTML5 `required` 属性，改为 JavaScript 验证，避免浏览器原生验证阻止提交导致用户"无反应"错觉。

---

## [1.5.0] - 2026-06-23

### 新增

- **测试连接**：「添加连接」与「编辑连接」弹窗中新增「测试连接」按钮，点击后使用当前表单参数验证连通性，结果直接在表单下方显示（绿色成功/红色失败），测试中按钮禁用。
- **本地驱动路径支持**：连接配置新增可选 `driverPath` 字段，允许指定原生 Node.js 驱动模块（如 better-sqlite3、oracledb、mssql、ibm_db、jdbc）的本地路径。未配置时自动加载默认模块名；配置后优先从指定路径加载，解决原生模块未全局安装时的加载问题。
- **连接配置 `options` 字段**：新增 `options` 对象，用于传递数据库特定选项（如 H2 的 `jarPath`），ConnectionConfig 类型已同步扩展。
- **侧栏空状态引导**：无数据库连接时，侧边栏显示「点击添加数据库连接」可点击项，点击直接打开连接表单。

### 优化

- **连接表单重构**：侧边栏「添加连接」/「编辑连接」命令改为 WebView 弹窗，所有参数（类型、名称、主机、端口、用户、密码、数据库、驱动路径）在同一界面填写，体验更流畅。密码仍通过 SecretStorage 安全存储。
- **驱动加载统一**：新增 `src/utils/DriverLoader.ts`，统一处理原生驱动的动态加载与错误提示，SQLite/Oracle/SQL Server/DB2/H2 适配器均已接入。

---

## [1.4.0] - 2026-06-23

### 优化

- **设置 UI 分组**：引入 `configurationGroups`，按「数据库、验证、索引与导航、性能、查询结果、代码生成、格式化、高亮」分组展示配置项，设置界面更清晰。
- **配置键名统一**：
  - `mybatisToolkit.defaultDatabaseType` → `mybatisToolkit.database.defaultType`
  - `mybatisToolkit.codeGen.{entity,mapper,xml,service}DirName` → `mybatisToolkit.codeGen.dirs.{entity,mapper,xml,service}`
- **废弃配置标注**：单连接配置（`database.host/port/user/password/database`）添加 `deprecationMessage`，引导用户使用侧栏「添加连接」。
- **数组配置 UI 引导**：`connections` 与 `fillFields` 的 `markdownDescription` 补充侧栏/生成向导管理建议。
- **resource 级配置**：`formatting.indentSize` 与 `highlights.*` 颜色配置添加 `"scope": "resource"`，支持工作区级覆盖。
- **所有配置项补充 `group`**：设置 UI 中按分组折叠/展开。

---

## [1.3.0] - 2026-06-23

### 新增

- **IDE 目录默认排除**：`navigation.exclude` 默认列表中新增 `.idea`、`.vscode`、`.settings`、`.project`、`.classpath`、`.factorypath`、`.metadata`，覆盖 JetBrains 全系列、VS Code、Eclipse 等主流 IDE 的配置目录。
- **`.gitignore` 支持**：索引器在启动时自动读取工作区根目录的 `.gitignore`，解析目录类排除规则并合并到 `findFiles` 的排除模式与运行时 `shouldExclude` 检查中，无需手动添加 `node_modules`、`target` 等常见目录。
  - 支持语法：`dir/` 结尾的目录规则、无斜杠的纯目录名；跳过注释（`#`）、否定行（`!`）及通配符文件模式（如 `*.class`）。
  - 启动日志输出：`[索引器] 从 .gitignore 加载排除目录: ...`。

### 修复

- **SQL 列名跳转：驼峰别名匹配**：`SqlDefinitionProvider.toCamelCase()` 对已经是驼峰的别名（如 `payPoints`）误执行 `toLowerCase()`，导致 Java 字段查找失败。现已修复：仅对含下划线的列名执行转换，驼峰命名保持原样。

---

## [1.2.0] - 2026-06-23

### 新增

- **SQL 列名跳转**：在 SQL 语句中点击列名可跳转到对应 Entity 字段或 resultMap 列定义，支持别名优先（`AS alias` 及隐式空格别名），无别名时取列名最后一段转驼峰匹配。
- **共享词法分析器**：提取 `src/utils/SqlTokenizer.ts`，统一 SQL/XML 分词逻辑，消除 `SqlFormattingProvider` 与 `SqlHighlightingProvider` 间的重复代码。

### 修复

- **格式化缩进默认值**：`config.ts` 中 `formatting.indentSize` 默认值由 `2` 修正为 `4`，与 `package.json` 声明一致。
- **文案错误**：编辑连接后提示信息「已已更新」修正为「已更新」。
- **Oracle 连接泄漏**：`OracleAdapter` 中 3 处 `conn.close()` 缺少 `await`，连接可能未正确释放回连接池，现已修复。
- **H2 空指针**：`H2Adapter` 的 `getTableSchema` / `executeSql` 缺少 `this.pool` null 检查，未连接时调用会抛异常，已添加守卫。
- **getTableComment 返回值**：`SqliteAdapter` / `Db2Adapter` 返回空字符串而非 `undefined`，与接口签名 `string | undefined` 语义不一致，已修正。
- **关键字误报列名**：`LEFT`/`RIGHT`/`INSERT`/`VALUES`/`IF` 等 17 个关键字被误从 `SQL_KEYWORDS` 及全部方言列表中删除，导致验证器将其当作列名报错，已全部恢复。
- **方言关键字完整性**：全量修复 8 个方言文件的关键字/函数列表——`MySQLDialect` 中 `Create` 大小写错误（`isKeyword('create')` 返回 false）；`OracleDialect`/`SQLServerDialect` 缺失 `JOIN`/`INNER`/`OUTER`；全部方言缺失 `REFERENCES`；7 个方言缺失 `CASCADE`；`SQLiteDialect` 拼写错误 `ACCOS`→`ACOS`、`JSON_TPYE`→`JSON_TYPE`；`H2Dialect` 可疑条目 `PC` 移除、缺失 `WITH`；`SQLite`/`DB2`/`H2`/`MariaDB` 缺失 `OVER`/`PARTITION`；`PostgreSQLDialect` `On`→`ON`；`MariaDBDialect` `Soundex`→`SOUNDEX`；全部方言去重 14 处重复条目并统一为大写。

### 优化

- **SQL 格式化：SQL 块隔离**：`<select>`/`<insert>`/`<update>`/`<delete>` 标签进入/退出时重置 SQL 子句状态（`clauseDepth`、`extraIndent`、括号栈等），确保每个 SQL 块互不影响。
- **SQL 格式化：XML 标签继承缩进**：`<if>`/`<foreach>`/`<choose>` 等标签继承当前 SQL 子句缩进上下文（如 WHERE 中的 `<if>` 与 WHERE 内容对齐）。
- **SQL 格式化：括号内缩进**：非子查询括号 `(cond1 OR cond2)` 中的内容增加一级缩进，AND/OR 正确换行。
- **SQL 格式化：逗号逻辑**：函数括号内逗号加空格、子查询内逗号换行，通过 `parenStack` 顶值精确区分。

### 重构

- **删除死代码**：移除未使用的 `DatabaseManager.ts`（46 行占位实现，引用 `@dbcode/vscode-api`）。
- **清理废弃逻辑**：`PropertyDefinitionProvider` 移除 130 行被 `findParentType` 覆盖的废弃解析代码。
- **移除未使用 import**：`DatabaseTreeDataProvider` / `MapperIntentionProvider` 中未使用的 `import * as path`。
- **清理残留注释**：`extension.ts` 中已删除 `DecorationProvider` 的残留注释。
- **移除冗余缓存**：7 个 Adapter 的 `schemaCache` 与 `DatabaseService` 的 LRU 缓存重复，已移除 Adapter 层缓存，保留 Service 层统一管理。

---

## [1.1.5] - 2026-06-23

### 修复

- **资源释放**：`deactivate` 中现在正确释放数据库连接、索引器、SQL 验证器与文件监听器，避免扩展重载/卸载时资源泄漏。
- **文件监听**：`ProjectIndexer` 维护 watcher 列表并提供 `dispose()`，重复激活不会累加监听器。
- **未支持数据库类型**：`createDbAdapter` 对 SQL Server / SQLite / DB2 / H2 等未实现类型直接抛出明确错误，不再误用 MySQL 适配器执行。

### 新增

- **多数据库适配器**：新增 SQL Server、SQLite、DB2、H2 数据库连接与元数据查询适配器。
  - SQL Server 使用 `mssql`（可选依赖），通过 `sys.tables` / `sys.columns` 查询表名、注释、列类型、主键、默认值。
  - SQLite 使用 `better-sqlite3`（可选依赖），基于 `sqlite_master` 与 `PRAGMA table_info` 获取元数据。
  - DB2 使用 `ibm_db`（可选依赖），通过 `SYSCAT.TABLES` / `SYSCAT.COLUMNS` 获取元数据。
  - H2 使用 `jdbc`（可选依赖）+ H2 JDBC jar，通过 `INFORMATION_SCHEMA` 获取元数据；连接配置需指定 `options.jarPath`。
- **可选数据库驱动 external**：`webpack.config.js` 中将上述可选驱动标记为 external，避免打包进 `extension.js`，按需动态加载。

- **端口校验**：添加/编辑连接时校验端口为 1–65535 有效数字，避免 `NaN` 持久化到配置。
- **同步 I/O 异步化**：「为方法生成 XML」命令使用 `fs.promises` 读写文件，避免阻塞扩展宿主。
- **密码安全**：数据库密码迁移到 VS Code `SecretStorage`，不再明文写入 `settings.json`。
- **Oracle 适配器错误处理**：移除 `disconnect()` 与 `getTableSchema()` 中静默吞错的空 `catch`。
- **多行 XML 标签**：`PropertyDefinitionProvider` 支持跨行标签中 `property` 属性的跳转到定义。
- **SQL 生成参数回退**：`MethodSqlGenerator` 显式处理参数不足场景，避免生成 `#{undefined}`。
- **跨行 Mapper 标签**：`MyBatisCodeLensProvider` 支持 `<select|insert|update|delete>` 标签跨行时的双向跳转。
- **转义引号**：`SqlHighlightingProvider` 正确识别反斜杠转义的单/双引号。
- **XML 属性解析**：`SqlValidationProvider.getAttribute()` 正确解析含转义实体与不同引号类型的属性值。
- **类型安全**：`DatabaseTreeDataProvider.ColumnItem` 使用 `ColumnInfo` 替代 `any`。

### 新增

- **GitHub Actions 自动发布 Release**：推送 `v*` 标签时自动打包扩展并创建 GitHub Release，上传 `.vsix` 作为发布资产。

### 优化

- **索引并发与大文件保护**：`ProjectIndexer` 使用受控并发 worker 池解析文件，并跳过超过 500KB 的超大文件；`ProjectIndexer` 单例支持 `destroyInstance()` 重置。
- **SQL 验证大文件保护**：超过 200KB 的 XML 文件跳过实时诊断，降低大文件编辑时的 CPU 占用。
- **SQL 格式化**：限制 200KB 文件大小；优化 XML 标签正则，降低回溯风险；使用 `trimEnd()` 替代废弃的 `trimRight()`。
- **语义高亮**：限制 200KB 文件大小；处理转义引号，避免无界扫描。
- **`showFullStructure` 并行化**：批量并行获取表结构（并发 10），100+ 张表展示更快。
- **减少重复解析**：CodeLens Provider 优先使用索引器缓存的 `JavaInterface`，不再每次都重新解析当前 Java 文档。
- **数据库缓存限制**：`DatabaseService` 表名/列信息缓存改用 `LruCache`（各 2000 条），避免表极多时内存持续增长。
- **单元格日期解析优化**：查询结果面板仅对看起来像日期的字符串执行日期正则与 `Date` 解析，减少大量普通字符串的无效计算。

---

## [1.1.4] - 2026-03-15

### 修复

- **方法识别与跳转**：修复 Mapper 接口中多行方法签名（如参数列表换行、多行 `@Param`）未被识别、无法跳转到对应 XML 的问题。现支持跨行方法声明：当方法名与开括号在同一行但签名在后续行以 `);` 结束时，会正确解析方法名与参数并建立索引，CodeLens「跳转到 XML」与从 XML 跳回接口可正常使用。

---

## [1.1.3] - 2026-03-15

### 修复

- **索引与跳转**：修复 DAO 接口目录、Mapper XML 目录下存在子目录时无法被扫描和跳转的问题。现按工作区根目录使用 `RelativePattern` 递归收集 `**/*.java` 与 `**/*.xml`，确保如 `dao/order/OrderMapper.java`、`mapper/order/OrderMapper.xml` 等子目录中的文件均被索引；文件监听改为按每个工作区根目录注册递归 watcher，子目录内新建/修改/删除也会正确触发索引更新。

---

## [1.1.2] - 2026-03-09

### 变更

- **SQL 校验**：补充窗口函数与分析函数相关关键字/函数名（如 `ROW_NUMBER`、`RANK`、`PARTITION`、`OVER` 等），避免被误当作列名校验并报“未在表中找到”。
- **列别名（无 AS）识别**：在 `SELECT expr alias`、`ROW_NUMBER() OVER(...) rn` 等场景下自动识别 `alias` 为列别名并加入别名集合，避免被当作真实列校验。
- **SQL 格式化缩进**：当未显式设置 `mybatisToolkit.formatting.indentSize` 时，缩进宽度自动跟随 VS Code 的 `editor.tabSize`（例如设置为 4 空格时，格式化后的 SQL 也使用 4 个空格）。

---

## [1.1.1] - 2026-03-08

### 新增

- **代码生成：MyBatis-Plus / MyBatis 风格可选**
  - 生成前可选择 **MyBatis-Plus（默认）** 或 **MyBatis** 代码风格。
  - MyBatis-Plus：Entity 使用 `@TableName`、`@TableId`、`@TableField` 等注解，Mapper 继承 `BaseMapper`，XML 仅保留 resultMap 与 Base_Column_List。
  - MyBatis：传统 Mapper 接口 + 完整 XML CRUD。
- **MyBatis-Plus 可配置项（均在设置 UI 中可配置，持久化后下次生成回显）**
  - **自动填充字段**（`codeGen.mybatisPlus.fillFields`）：可配置多列及填充策略（INSERT / INSERT_UPDATE），生成 `@TableField(value = "列名", fill = FieldFill.xxx)`；设置中支持添加项、列名与下拉选择。
  - **逻辑删除字段**（`codeGen.mybatisPlus.logicDeleteField`）：指定列名（如 `del_flag`），生成 `@TableLogic`，若该列在填充列表中则同时带 `fill`。
  - **主键生成策略**（`codeGen.mybatisPlus.idType`）：可选 AUTO、ASSIGN_ID、ASSIGN_UUID、INPUT、NONE，生成 `@TableId(type = IdType.xxx)`。
- **代码生成：目录名可自定义**
  - **Entity 目录名**（`codeGen.entityDirName`）：默认 `entity`，可改为 `po`、`domain` 等。
  - **Mapper/DAO 目录名**（`codeGen.mapperDirName`）：默认 `mapper`，可改为 `dao` 等。
  - **Mapper XML 目录名**（`codeGen.xmlDirName`）：默认 `mapper`（位于 `src/main/resources` 下），可改为 `mappers`、`xml` 等。
  - **Service 目录名**（`codeGen.serviceDirName`）：默认 `service`，预留供后续生成 Service 层使用。

### 变更

- **设置 UI**：所有配置项均可在「设置」中搜索 MyBatis / mybatisToolkit 进行配置；配置总说明与各选项的 `markdownDescription` 已补充，便于在 UI 中查看。
- **fillFields**：数组项 schema 完善（required、enumDescriptions、默认说明），便于在设置界面中添加/编辑自动填充字段。

---

## [1.1.0] - 2026-03-07

### 新增

- **SQL 查询与执行**
  - **选择数据库**：在 SQL 编辑器标题栏或侧栏选择/连接数据库后再执行 SQL。
  - **新建查询窗口**：通过命令或入口打开空白 SQL 文件，用于编写并执行 SQL。
  - **执行选中 SQL**：在 SQL 文件中执行当前光标所在语句或选中内容。
  - **执行全部 SQL**：按分号拆分并依次执行当前文件中的多条语句；每条语句对应一个独立结果窗口（如「查询结果 (1/N)」），便于分别查看。
- **查询结果面板**
  - 结果表支持**行号列**（第一列显示行号）。
  - **分页**：上一页/下一页，可查看大量结果。
  - **日期时间格式可配置**：在设置中配置 `mybatisToolkit.queryResult.datetimeFormat`、`dateFormat`、`timeFormat`（占位符：`%Y` `%m` `%d` `%H` `%i` `%s`），默认分别为 `%Y-%m-%d %H:%i:%s`、`%Y-%m-%d`、`%H:%i:%s`。
  - 列表与点击单元格**弹出内容**使用同一套格式化，时间显示一致。
  - DML 语句展示影响行数、执行时长；SELECT 展示返回行数。
  - 列宽可拖拽、单元格点击可查看完整内容。
- **快捷键**（仅在 SQL 编辑器中生效）
  - **Ctrl+Shift+,**（Mac：Cmd+Shift+,）：执行选中 SQL。
  - **Ctrl+Shift+.**（Mac：Cmd+Shift+.）：执行全部 SQL。
  - 可在 VS Code「键盘快捷方式」中搜索「执行选中 SQL」「执行全部 SQL」修改绑定。
- **激活**：增加 `onLanguage:sql`，在打开 SQL 文件时激活扩展，确保上述命令与快捷键可用。
- **生成代码（从表）**
  - 生成前**选择基础目录**：可从工作区根目录列表选择、或「选择其他文件夹」、或「输入路径」；默认当前项目根目录。Entity/Mapper/XML 生成在该目录下的 `src/main/java`、`src/main/resources`。
  - **主键自动识别**：根据列 `Key='PRI'` 识别主键列，生成的 Mapper 接口与 XML 中 update/delete/selectById 使用实际主键列名（如 `user_id`），不再写死 `id`。
  - 生成过程**异常捕获**与明确成功/失败提示。
- **为方法生成 XML（Quick Fix）**
  - 命令 `mybatisToolkit.generateXmlForMethod` 已在 `package.json` 中声明，避免「command not found」。
  - 传 Java 文件 **URI 字符串**而非 document，避免命令序列化后执行失败。
  - 插入前**二次检查**是否已存在同 id，避免重复插入；读 XML 失败时 Quick Fix 不展示。
- **方法名生成 SQL**：实体名转表名时去掉前导下划线（如 `User` → `user`，不再生成 `_user`）。

### 变更

- 执行多条 SQL 时由「仅显示最后一条结果」改为「每条语句一个结果窗口」。
- 查询结果中日期/时间列统一按配置格式显示（包括 Date 对象与常见字符串格式的解析与格式化）。

### 修复

- 修复查询结果中时间列仍显示为 `Date.toString()` 原始格式的问题，改为使用配置的日期时间格式。
- 修复在纯 SQL 文件中快捷键不生效的问题（通过 SQL 激活事件与快捷键绑定）。
- 修复「为 xxx 生成 XML」报错 `command 'mybatisToolkit.generateXmlForMethod' not found`（命令声明 + 传参方式）。

---

## [1.0.1] - 2025-12-17

### 新增

- **多数据库支持**：全面支持 8 种数据库方言（MySQL、PostgreSQL、Oracle、SQL Server、SQLite、DB2、H2、MariaDB）。
- **方言特定格式化**：SQL 格式化按所选数据库语法规则处理（引号、关键字等）。
- **配置**：新增 `mybatisToolkit.defaultDatabaseType`，用于在无活动连接时指定默认方言。
- **连接配置**：数据库连接配置支持 `type` 字段以指定数据库类型。

### 变更

- 参考标准 SQL 关键字与函数列表，使各方言支持更稳健。
- 改进 SQL 分词器性能。
