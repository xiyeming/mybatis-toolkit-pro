# MyBatis Toolkit Pro 代码审查与性能分析报告

**生成日期**：2026-06-22  
**关联版本**：1.1.4  
**分析范围**：`src/` 下全部 TypeScript 源码及 `package.json` 配置

---

## 1. 概述

本报告对 MyBatis Toolkit Pro VS Code 扩展进行代码审查与性能评估，重点识别潜在缺陷、资源泄漏、安全风险和性能瓶颈，为后续修复与优化提供依据。

---

## 2. Bug 与缺陷清单

### 2.1 严重（发布前必须修复）

| 编号 | 问题 | 位置 | 说明 |
|------|------|------|------|
| BUG-01 | `deactivate` 为空，未释放资源 | `src/extension.ts:540` | 扩展重载或卸载时，数据库连接、文件 watcher、诊断集合、输出通道均未清理，造成资源泄漏。 |
| BUG-02 | 文件 watcher 未注册到 subscriptions | `src/services/ProjectIndexer.ts:97-113` | `createFileSystemWatcher` 返回值未保存或 dispose，扩展反复激活后监听累加。 |
| BUG-03 | 多种数据库类型缺少对应适配器 | `src/services/db/index.ts:7-18` | SQL Server、SQLite、DB2、H2 等全部 fallback 到 `MySQLAdapter`，执行元数据查询必然报错。 |

### 2.2 高（强烈建议修复）

| 编号 | 问题 | 位置 | 说明 |
|------|------|------|------|
| BUG-04 | 端口输入未校验 NaN | `src/extension.ts:163,177,218,255` | `parseInt(portStr)` 可能得到 `NaN` 并持久化到配置。 |
| BUG-05 | 异步命令中使用同步 I/O | `src/extension.ts:510,525` | `fs.readFileSync` / `fs.writeFileSync` 阻塞扩展宿主线程。 |
| BUG-06 | `buildHtml` 非空断言风险 | `src/panels/QueryResultsPanel.ts:89` | `this.data!` 在 `showError` 后的调用路径下可能崩溃。 |
| BUG-07 | SQL 格式化器存在 ReDoS 风险 | `src/providers/SqlFormattingProvider.ts:75` | XML 标签正则在特殊输入下可能严重回溯。 |
| BUG-08 | `getMethods` 多行签名越界 | `src/utils/JavaAstUtils.ts:238-264` | 文件末尾未闭合签名时 `lines[j]` 为 `undefined`。 |
| BUG-09 | HoverProvider 修改入参数组 | `src/providers/MyBatisHoverProvider.ts:67-84` | `parts[0]` 被重新赋值后影响后续 `parts.join('.')`。 |
| BUG-10 | 密码明文持久化 | `src/services/DatabaseService.ts:77-81` | 数据库密码写入 `settings.json`，应使用 `SecretStorage`。 |
| BUG-11 | `ProjectIndexer` 单例状态残留 | `src/services/ProjectIndexer.ts:42-47` | 测试或特殊重载场景下旧缓存与定时器无法重置。 |

### 2.3 中 / 低

| 编号 | 问题 | 位置 | 级别 |
|------|------|------|------|
| BUG-12 | `OracleAdapter` 静默吞错 | `src/services/db/OracleAdapter.ts:74-109` | 中 |
| BUG-13 | `PropertyDefinitionProvider` 无法处理多行 XML 标签 | `src/providers/PropertyDefinitionProvider.ts:187-237` | 中 |
| BUG-14 | `MethodSqlGenerator` 参数不足生成 `#{undefined}` | `src/services/MethodSqlGenerator.ts:99-140` | 中 |
| BUG-15 | `MyBatisCodeLensProvider` `stmtRegex` 仅单行匹配 | `src/providers/MyBatisCodeLensProvider.ts:40` | 中 |
| BUG-16 | `SqlHighlightingProvider` 未处理转义引号 | `src/providers/SqlHighlightingProvider.ts:210-224` | 中 |
| BUG-17 | 使用已废弃的 `trimRight()` | `src/providers/SqlFormattingProvider.ts:294` 等 | 低 |
| BUG-18 | `getAttribute` 未处理属性值转义引号 | `src/providers/SqlValidationProvider.ts:601-604` | 低 |
| BUG-19 | `ColumnItem` 使用 `any` 类型 | `src/providers/DatabaseTreeDataProvider.ts:107` | 低 |

---

## 3. 性能瓶颈清单

### 3.1 严重

| 编号 | 问题 | 位置 | 影响 |
|------|------|------|------|
| PERF-01 | 启动时全量扫描并打开所有 Java/XML | `src/services/ProjectIndexer.ts:49-70` | `maxResults = 100000`，大项目启动慢、内存占用高。 |
| PERF-02 | 验证器对整个 XML 全文多次正则扫描 | `src/providers/SqlValidationProvider.ts` | 每次编辑后用多条 `[</s>]*?` 正则全局匹配，大文件 CPU 占用高。 |
| PERF-03 | SQL 格式化器逐字符正则分词 | `src/providers/SqlFormattingProvider.ts:65-274` | 每个位置多次 `rest.match(...)`，大 XML 下显著慢。 |
| PERF-04 | 语义高亮重复昂贵分词 | `src/providers/SqlHighlightingProvider.ts:126+` | 与格式化器几乎相同的 tokenize 逻辑，每次打开/编辑 XML 都运行。 |

### 3.2 高

| 编号 | 问题 | 位置 | 影响 |
|------|------|------|------|
| PERF-05 | 分块内并发打开大量文档 | `src/services/ProjectIndexer.ts:116-122` | 每块内同时 `openTextDocument`，大仓库下文件描述符与内存压力大。 |
| PERF-06 | `showFullStructure` 串行拉取表结构 | `src/extension.ts:377-400` | 最多 200 张表，每张 `await getTableSchema`，UI 长时间无响应。 |
| PERF-07 | WebView 一次性构建完整 HTML | `src/panels/QueryResultsPanel.ts:88-216` | 即使分页也生成所有行 HTML，字符串拼接量大。 |
| PERF-08 | 当前文档被反复重新解析 | `MyBatisCodeLensProvider`、`MapperIntentionProvider` 等 | 索引器已缓存，Provider 仍调用 `JavaAstUtils.getMethods(content)`。 |

### 3.3 中

| 编号 | 问题 | 位置 | 影响 |
|------|------|------|------|
| PERF-09 | 表/列缓存无大小限制 | `src/services/DatabaseService.ts:12-13` | 表极多时缓存持续增长。 |
| PERF-10 | 数据库树展开频繁访问 schema | `src/providers/DatabaseTreeDataProvider.ts:57` | 每次展开表都 `getTableSchema`，列列表未独立缓存。 |
| PERF-11 | 每格尝试日期正则匹配 | `src/panels/QueryResultsPanel.ts:339` | 字符串单元格都过 ISO 日期正则，大量数据时累加。 |

---

## 4. 优先修复建议

### 4.1 立即处理（阻塞发布）

1. **补全 `deactivate`**：调用 `dbService.disconnect()`、`indexer.dispose()`、`sqlValidationProvider.dispose()`。
2. **保存并释放文件 watcher**：在 `ProjectIndexer` 中维护 watcher 列表并提供 `dispose()`。
3. **数据库适配器兜底策略**：为未实现的数据库类型抛出明确错误，避免用 MySQL 适配器误执行。

### 4.2 近期修复

4. **端口输入校验**：`parseInt` 后检查 `isNaN`。
5. **密码安全存储**：迁移到 `context.secrets`。
6. **同步 I/O 异步化**：`generateXmlForMethod` 中改用 `fs.promises.readFile` / `writeFile`。
7. **大文件保护**：给 `SqlValidationProvider` 和 `SqlFormattingProvider` 增加文件大小阈值，超大文件跳过或仅处理可见区域。

### 4.3 性能优化

8. **索引并发控制**：使用真正的受控并发（如 `p-limit`）替代 `Promise.all` 分块。
9. **避免重复解析**：Provider 优先从 `ProjectIndexer` 获取已缓存的当前文档解析结果。
10. **WebView 渲染优化**：只渲染当前页数据，虚拟滚动或延迟加载大量结果。
11. **`showFullStructure` 并行化**：批量/并行获取表结构，或改为按需懒加载。

---

## 5. 验证计划

修复后建议执行以下验证：

- [ ] 扩展重载 3 次后，进程内 watcher 与数据库连接数量不再累加。
- [ ] 配置 SQL Server / H2 等未适配类型时，提示明确错误而非执行 MySQL 语句。
- [ ] 打开 1MB 以上 Mapper XML 文件时，格式化和验证不触发扩展无响应。
- [ ] 包含 100+ 张表的数据库，全部结构展示可在 5 秒内完成。
- [ ] 新增测试覆盖 `JavaAstUtils.getMethods` 多行签名边界场景。

---

## 6. 附录：相关文件路径

- 入口：`src/extension.ts`
- 索引器：`src/services/ProjectIndexer.ts`
- 数据库服务：`src/services/DatabaseService.ts`
- Java 解析：`src/utils/JavaAstUtils.ts`
- 格式化：`src/providers/SqlFormattingProvider.ts`
- 验证：`src/providers/SqlValidationProvider.ts`
- 高亮：`src/providers/SqlHighlightingProvider.ts`
- 结果面板：`src/panels/QueryResultsPanel.ts`
