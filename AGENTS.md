# AGENTS.md

本文件为 OpenCode 会话提供本仓库的关键开发上下文。内容仅包含不易从文件名或默认约定推断的高价值信息。

## 项目性质

VS Code 扩展（TypeScript + Webpack 打包到 `dist/extension.js`），为 MyBatis / Java / XML / SQL 开发提供导航、验证、数据库管理与代码生成。入口 `src/extension.ts`。

## 开发命令

| 命令 | 作用 | 注意 |
|------|------|------|
| `npm run compile` | Webpack 开发模式编译到 `dist/` | 调试前必须先执行一次 |
| `npm run watch` | 监视编译 | 开发时常用 |
| `npm run package` | 生产打包（压缩 + hidden source map） | 发布前用 |
| `npm run lint` | `eslint src --ext ts` | |
| `npm run compile-tests` | `tsc -p . --outDir out` | 编译测试到 `out/`，**不编译主源码** |
| `npm run pretest` | `compile-tests` → `compile` → `lint` | 完整验证链 |
| `npm test` | `node ./out/test/runTest.js` | **当前会失败**：仓库无测试文件 |

- 完整验证顺序：`npm run pretest`（含编译测试、编译、lint）。
- 调试扩展：VS Code 中按 `F5` 选 **Run Extension**，启动 Extension Development Host。
- 打包 `.vsix`：`npm install -g @vscode/vsce && vsce package`（自动触发 `vscode:prepublish` → `npm run package`）。

## 构建产物与目录

- `dist/` — Webpack 打包输出（运行时加载的扩展本体），`.gitignore` 已忽略。
- `out/` — `tsc` 编译输出（仅用于测试），`.gitignore` 已忽略。
- `src/` 是唯一源码目录；`rootDir` 为 `src`，`tsconfig.json` 仅 include `src/**/*`。

## 构建配置关键点

- **`tsconfig.json` 与 Webpack 独立**：`npm run compile` 走 Webpack + ts-loader（输出 `dist/`），`npm run compile-tests` 走 `tsc`（输出 `out/`）。两者目标不同，不要混用。
- Webpack `target: 'node'`，`vscode` 作为 external 由宿主提供；`mysql2`、`pg` 打包进 bundle，`pg-native` 等可选原生依赖的警告已通过 `ignoreWarnings` 抑制。
- `oracledb` 是 `optionalDependencies`，未安装时 Oracle 相关功能不可用，但不影响其余数据库。
- VS Code 引擎要求 `^1.100.0`；`@types/vscode` 通过 `"vscode": "npm:@types/vscode@^1.90.0"` 别名安装。

## 架构要点（不易从文件名推断）

- `activate` 中初始化三个核心单例：`ProjectIndexer`（延迟一帧 `setImmediate` 启动以减少首屏卡顿）、`DatabaseService`、`CodeGenerationService`。
- **命令 ID 必须与 `package.json` 的 `contributes.commands` 严格一致**，新增/改名命令需同步修改 `package.json`。
- `ProjectIndexer` 构建三类内存索引：`javaMap`（Mapper 接口）、`dtoMap`（Entity/DTO/返回类型）、`xmlMap`（namespace → MapperXml）。文件保存/新建/删除触发增量更新。
- **Java 解析基于正则，非完整 AST**：`src/utils/JavaAstUtils.ts` 提取包、类、继承、导入、字段、方法签名（含多行）与 Javadoc。
- 数据库适配器分发在 `src/services/db/index.ts`：MySQL/MariaDB/SQLite/DB2/H2 → `MySQLAdapter`，PostgreSQL → `PgAdapter`，Oracle → `OracleAdapter`。
- SQL 方言由 `DialectFactory` 按数据库类型返回，影响关键字、函数、引号字符等判断。
- `QueryResultsPanel` 以 WebView 展示查询结果；SQL 执行快捷键仅在 `editorLangId == sql` 时生效。

## 约定

- 所有命令标题、提示文本、README、CHANGELOG 使用**中文**；代码注释使用中文。
- 配置统一由 `src/config.ts` 读取，默认值在 `src/constants.ts`。
- `DEVELOPMENT.md` 中「仅支持 MySQL/MariaDB」「resources 目录」等描述已**过时**：当前支持 8 种数据库，无 `resources/` 目录。以 `package.json` 与源码为准。

## 已知陷阱

- `npm test` 在无测试文件时会失败（依赖 `out/test/runTest.js`）。新增测试前不要期望它通过。
- `DEVELOPMENT.md` 的安装步骤含一行 `rm -rf ... package-lock.json dist ...` 的清理命令，勿误执行其删除 `package-lock.json`。
