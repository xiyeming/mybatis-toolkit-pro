# MyBatis Toolkit Pro

![MyBatis Toolkit Pro](images/mybatis.png)

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/xiyeming.mybatis-toolkit-pro)](https://marketplace.visualstudio.com/items?itemName=xiyeming.mybatis-toolkit-pro)
[![GitHub stars](https://img.shields.io/github/stars/xiyeming/mybatis-toolkit-pro)](https://github.com/xiyeming/mybatis-toolkit-pro)
[![License](https://img.shields.io/github/license/xiyeming/mybatis-toolkit-pro)](https://github.com/xiyeming/mybatis-toolkit-pro/blob/main/LICENSE.md)
[![Version](https://img.shields.io/badge/version-1.1.4-blue)](https://github.com/xiyeming/mybatis-toolkit-pro/releases)

[English](README_en.md) | [中文](README.md)

专为 VS Code 设计的专业 MyBatis 开发工具包，通过智能导航、SQL 验证、多数据源管理与内置查询执行，提升 MyBatis 与数据库开发效率。

## ✨ 主要特性

- 🚀 **智能导航**：Mapper ↔ XML 跳转、表名/ResultMap 属性/Java 类跳转、参数悬停与类型提示
- 🎨 **SQL 高亮与格式化**：8 种数据库方言、关键字/函数/参数高亮、可配置引号与缩进
- 🗄️ **数据库管理**：多连接、数据库浏览器、表结构查看、执行 SQL 与结果展示
- 🔍 **查询与结果**：新建查询、执行选中/全部 SQL、分页、行号、可配置日期格式、多结果窗口
- ✅ **高级验证**：表/列存在性、resultMap/resultType 与 Java 属性匹配、嵌套 association/collection
- 🛠️ **代码生成**：从表生成 Entity / Mapper 接口 / XML
- ⚡ **方法名生成 SQL**：根据 Mapper 方法名生成 XML SQL（Quick Fix）

---

## 📦 安装

- **VS Code 扩展市场**：搜索 "MyBatis Toolkit Pro" 并安装。
- **VSIX**：从 [Releases](https://github.com/xiyeming/mybatis-toolkit-pro/releases) 下载 `.vsix`，通过 "从 VSIX 安装…" 安装。

**要求**：VS Code 1.100.0 及以上。

---

## 🚀 一、智能导航

- **跳转到定义**
  - **数据库表**：在 XML 中点击表名 → 跳转到虚拟架构视图。
  - **ResultMap 属性**：在 `<resultMap>` 的 `property` 上 **Ctrl+Click (Cmd+Click)** → 跳转到 Java 字段。
  - **Java 类**：`resultType` / `parameterType` 指定类 → 跳转到对应 Java 类。
- **Mapper ↔ XML**：在 Mapper 接口与对应 XML 之间互相跳转（命令或 CodeLens）。
- **悬停**：悬停于 `#{variable}` / `${variable}` 可查看 Java 类型与 Javadoc。

---

## 🎨 二、SQL 高亮与格式化

- **方言**：支持 MySQL、PostgreSQL、Oracle、SQL Server、SQLite、DB2、H2、MariaDB。
- **高亮**：关键字、系统函数、MyBatis 参数；方言特有关键字（如 PostgreSQL 的 `RETURNING`、`ILIKE`）。
- **格式化**：按方言处理引号与缩进，支持子查询、`UNION`、`CASE WHEN` 等；保留 XML 与 SQL 注释。
- **默认方言**：设置 `mybatisToolkit.defaultDatabaseType`；若已连接数据库，优先使用当前连接类型。

---

## 🗄️ 三、数据库管理与查询执行

### 3.1 数据库浏览器（侧栏 MyBatis）

- **连接**：点击「添加连接」配置主机、端口、用户、密码、数据库类型与库名；支持多数据源。
- **操作**：连接 / 断开、编辑、移除、刷新。
- **表与结构**：展开连接查看表；右键表可「打开表结构」或「生成代码」。

### 3.2 执行 SQL

1. **选择数据库**：在 SQL 编辑器标题栏点击「选择数据库」，或从侧栏连接后，再执行 SQL。
2. **新建查询**：命令面板执行「新建查询窗口」或从数据库浏览器入口，打开空白 SQL 文件。
3. **执行方式**：
   - **执行选中 SQL**：选中一段 SQL，或未选中时按“当前语句”执行。
   - **执行全部 SQL**：执行当前文件中以分号分隔的所有语句。

### 3.3 快捷键（仅 SQL 编辑器内生效）

| 功能             | Windows / Linux   | macOS        |
|------------------|------------------|--------------|
| 执行选中 SQL     | `Ctrl+Shift+,`   | `Cmd+Shift+,` |
| 执行全部 SQL     | `Ctrl+Shift+.`   | `Cmd+Shift+.` |

可在 **键盘快捷方式**（Ctrl+K Ctrl+S）中搜索「执行选中 SQL」「执行全部 SQL」修改绑定。

### 3.4 查询结果

- **单条执行**：一个结果窗口；可显示影响行数、执行时长、返回行数。
- **执行全部 SQL**：每条语句对应一个结果标签页（如「查询结果 (1/3)」），便于分别查看。
- **结果表**：行号列、分页（上一页/下一页）、列宽可拖拽、单元格点击弹出完整内容。
- **日期时间**：按设置格式显示；列表与弹窗格式一致。
  - 设置项：`queryResult.datetimeFormat`、`queryResult.dateFormat`、`queryResult.timeFormat`（占位符：`%Y` `%m` `%d` `%H` `%i` `%s`）。

### 3.5 展示全部结构

在数据库浏览器视图标题或相关入口执行「展示全部结构 (表与列)」，在结果面板中查看当前库下所有表与列信息。

---

## ✅ 四、高级验证

- **SQL 验证**：实时检查 SQL 中的表名、列名是否存在。
- **结果映射**：检查 `resultMap` / `resultType` 与 Java 类属性是否一致（含下划线转驼峰）。
- **嵌套**：支持 `<association>`、`<collection>` 内的属性验证；识别 resultMap 显式列避免误报。
- 可在设置中通过 `mybatisToolkit.validation.enable` 开关验证。

---

## 🛠️ 五、代码生成

- 在**数据库浏览器**中右键表 →「生成代码 (Entity/Mapper/XML)」。
- 按提示输入包名，自动生成 Entity、Mapper 接口与 XML，含基础 CRUD 与类型映射，可选 Lombok。

---

## ⚡ 六、方法名生成 SQL

- 在 Mapper 接口中写方法名（如 `selectUserByNameAndAge`），出现灯泡时选择 Quick Fix，自动在对应 XML 中生成 SQL。
- 支持前缀：`select`、`update`、`delete`、`count`、`insert`；条件连接：`And`、`Or`；后缀如 `Like`、`In` 等。

---

## 配置摘要

在 VS Code 设置中搜索 “MyBatis” 可看到全部配置。

| 分类     | 配置示例 | 说明 |
|----------|----------|------|
| 方言     | `mybatisToolkit.defaultDatabaseType` | 默认数据库类型（高亮/格式化） |
| 连接     | `mybatisToolkit.connections`         | 多数据源列表；另有 host/port/user/password/database |
| 验证     | `mybatisToolkit.validation.enable`  | 是否启用 SQL 与映射验证 |
| 导航     | `mybatisToolkit.navigation.exclude` | 索引排除目录（如 target、node_modules） |
| 性能     | `indexParseConcurrency`、`indexDebounceMs`、`validationDebounceMs` | 索引并发与防抖 |
| 查询结果 | `queryResult.datetimeFormat` 等     | 日期时间/日期/时间的显示格式 |
| 格式化   | `formatting.indentSize`             | SQL 缩进空格数 |
| 高亮     | `highlights.tableNameColor` 等      | 表名、关键字、函数、参数颜色 |

---

## 贡献

欢迎通过 [GitHub Issues](https://github.com/xiyeming/mybatis-toolkit-pro/issues) 反馈问题或建议，或提交 Pull Request。

## 许可证

[MIT](LICENSE.md)
