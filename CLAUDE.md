# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

MyBatis Toolkit Pro 是一个 VS Code 扩展，为 MyBatis / Java / XML / SQL 开发提供智能导航、SQL 验证、数据库管理、SQL 执行、代码生成等功能。代码使用 TypeScript 编写，通过 Webpack 打包为 `dist/extension.js`。

## 常用开发命令

所有脚本定义在 `package.json` 中：

| 命令 | 作用 |
|------|------|
| `npm install` | 安装依赖 |
| `npm run compile` | 使用 Webpack 开发模式编译到 `dist/` |
| `npm run watch` | 开发模式监视编译 |
| `npm run package` | 生产模式编译（压缩、隐藏 source map） |
| `npm run lint` | 对 `src/**/*.ts` 运行 ESLint |
| `npm run compile-tests` | 使用 `tsc` 将源码与测试编译到 `out/` |
| `npm test` | 运行 `out/test/runTest.js` |
| `npm run pretest` | 依次执行 `compile-tests`、`compile`、`lint` |

调试扩展：在 VS Code 中打开项目根目录，按 `F5` 选择 **Run Extension**，会启动 Extension Development Host 窗口。

打包 `.vsix`：

```bash
npm install -g @vscode/vsce
vsce package
```

> 注意：当前仓库中没有测试文件。`npm test` 依赖 `out/test/runTest.js`；在新增测试前，该命令会失败。

## 高层架构

### 1. 入口与生命周期

- `src/extension.ts` 是扩展入口，负责 `activate`/`deactivate`。
- `activate` 中初始化三个核心单例：`ProjectIndexer`、`DatabaseService`、`CodeGenerationService`。
- 随后向 VS Code 注册各类 Provider 与命令；命令 ID 必须与 `package.json` 的 `contributes.commands` 严格一致。

### 2. 项目索引（导航的基础）

- `ProjectIndexer` 单例在激活后异步扫描工作区中所有 `.java` 与 `.xml` 文件。
- 构建三类内存索引：
  - `javaMap`：全限定名 → `JavaInterface`（Mapper 接口）
  - `dtoMap`：全限定名 → `JavaClass`（Entity / DTO / 返回值类型）
  - `xmlMap`：namespace → `MapperXml`
- 按工作区根目录递归收集文件，并为每个根目录注册文件监听器；保存、新建、删除都会触发增量更新。
- 解析并发数与防抖时间可在设置中配置（`performance.indexParseConcurrency`、`performance.indexDebounceMs`）。
- Java 解析基于 `src/utils/JavaAstUtils.ts` 中的正则，**不是完整 AST**。它提取包名、类/接口名、继承、导入、字段、方法签名（含多行签名）与 Javadoc。

### 3. 数据库层

- `DatabaseService` 单例管理连接配置与当前活动连接。
- 连接持久化在 VS Code 全局配置 `mybatisToolkit.connections` 中；若未配置多连接，则回退读取旧的 `mybatisToolkit.database.*` 单连接配置。
- `src/services/db/index.ts` 根据类型创建 `IDbAdapter`：
  - MySQL / MariaDB / SQLite / DB2 / H2 → `MySQLAdapter`
  - PostgreSQL → `PgAdapter`
  - Oracle → `OracleAdapter`
- 元数据（表名、列信息）缓存于 `DatabaseService`；执行 SQL 时通过适配器落到具体驱动。

### 4. SQL 方言与高亮/格式化

- `DialectFactory` 根据数据库类型返回 `Dialect` 实现，用于 SQL 关键字、函数、引号字符等方言相关判断。
- `SqlHighlightingProvider` 提供 XML 内 SQL 的语义高亮（Token 类型包括表名、关键字、函数、参数）。
- `SqlFormattingProvider` 是 XML 文档格式化器，对 XML 标签与 SQL 做分词后重新排版，缩进宽度由 `formatting.indentSize` 控制。

### 5. 验证与诊断

- `SqlValidationProvider` 监听 XML 文档变化与数据库就绪事件，将诊断信息写入 `mybatis-sql` DiagnosticCollection。
- 验证内容包含：
  - `resultMap` / `resultType` 与 Java 类属性是否匹配（支持下划线转驼峰与父类递归）
  - `SELECT` 返回列与目标类的自动映射检查
  - 数据库表/列存在性（需已连接数据库）
  - `UNION` 列数与别名一致性
- 验证开关：`mybatisToolkit.validation.enable`。

### 6. 导航与交互

- `MyBatisCodeLensProvider` 在 Java Mapper 接口与 XML Mapper 之间生成双向跳转 Lens。
- `SqlDefinitionProvider` 支持 XML 中表名、Java 类名等的跳转到定义。
- `PropertyDefinitionProvider` 支持 `resultMap` 中 `property` 跳转到 Java 字段。
- `MyBatisHoverProvider` 在 `#{...}` / `${...}` 上显示参数类型与 Javadoc。
- `MapperIntentionProvider` 提供 Quick Fix：根据 Mapper 方法名自动生成 XML SQL。

### 7. 查询与结果展示

- 数据库浏览器由 `DatabaseTreeDataProvider` 驱动，注册为 `mybatisToolkit.databaseExplorer` 视图。
- SQL 编辑器标题栏提供「选择数据库」「执行选中 SQL」「执行全部 SQL」按钮；快捷键仅在 `editorLangId == sql` 时生效：
  - 执行选中：`Ctrl+Shift+,` / `Cmd+Shift+,`
  - 执行全部：`Ctrl+Shift+.` / `Cmd+Shift+.`
- `QueryResultsPanel` 以 WebView 形式展示查询结果，支持分页、列宽拖拽、单元格弹窗。

### 8. 代码生成

- `CodeGenerationService` 从数据库表生成 Entity、Mapper 接口、XML。
- 支持两种风格：MyBatis-Plus（默认）与传统 MyBatis，通过用户 Quick Pick 选择。
- MyBatis-Plus 相关配置（自动填充字段、逻辑删除字段、主键策略）持久化在 `mybatisToolkit.codeGen.mybatisPlus.*`，下次生成会回显。

## 重要约定

- 配置统一由 `src/config.ts` 读取，默认值在 `src/constants.ts` 中定义。
- 所有命令标题与提示文本使用中文；README、CHANGELOG 也以中文为主。
- 代码注释使用中文。
- 扩展要求 VS Code `^1.100.0`。
- Webpack 目标为 `node`，`vscode`、`mysql2`、`pg` 相关可选原生依赖按当前配置处理；打包时忽略 `pg-native` 等可选模块的警告。
