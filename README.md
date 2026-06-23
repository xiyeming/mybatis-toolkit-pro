# MyBatis Toolkit Pro

<p align="center">
  <img src="images/mybatis.png" alt="MyBatis Toolkit Pro" width="128">
</p>

<p align="center">
  <strong>专业的 VS Code MyBatis 开发工具包</strong>
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

## 📖 目录

- [✨ 功能特性](#-功能特性)
- [📦 安装](#-安装)
- [🚀 快速开始](#-快速开始)
- [🎯 智能导航](#-智能导航)
- [🎨 SQL 高亮与格式化](#-sql-高亮与格式化)
- [🗄️ 数据库管理](#️-数据库管理)
- [🔍 查询执行](#-查询执行)
- [✅ SQL 验证](#-sql-验证)
- [🛠️ 代码生成](#️-代码生成)
- [⚡ 方法名生成 SQL](#-方法名生成-sql)
- [⚙️ 配置](#️-配置)
- [🔧 开发指南](#-开发指南)
- [🤝 贡献](#-贡献)
- [📄 许可证](#-许可证)
- [🙏 致谢](#-致谢)

---

## ✨ 功能特性

### 🚀 智能导航
- **Mapper ↔ XML 双向跳转**：在 Mapper 接口与对应 XML 之间快速跳转
- **表名跳转**：在 SQL 中点击表名 → 跳转到数据库结构视图
- **ResultMap 属性跳转**：Ctrl+Click 跳转到 Java 字段定义
- **SQL 列名跳转**：支持别名优先，跳转到 Entity 字段或 resultMap 列定义
- **参数悬停提示**：悬停于 `#{variable}` 查看 Java 类型与 Javadoc
- **CodeLens**：Mapper 方法上方显示「跳转到 XML / 跳转到接口」快捷入口

### 🎨 SQL 高亮与格式化
- **8 种数据库方言**：MySQL、PostgreSQL、Oracle、SQL Server、SQLite、DB2、H2、MariaDB
- **语义高亮**：关键字、系统函数、MyBatis 参数、表名独立着色
- **智能格式化**：支持子查询、UNION、CASE WHEN、括号内缩进、XML 标签继承
- **方言感知**：关键字列表、引号字符随数据库方言变化

### 🗄️ 多数据源管理
- **数据库浏览器**：侧栏 TreeView 展示连接、表、列层级结构
- **多连接支持**：同时配置多个数据源，一键切换
- **表结构查看**：查看列名、类型、注释、主键、默认值
- **测试连接**：配置时实时验证连通性，支持指定本地驱动路径

### 🔍 SQL 查询执行
- **执行选中 SQL**：选中或当前语句即时执行
- **执行全部 SQL**：按分号拆分，每条语句独立结果窗口
- **结果面板**：分页、行号、列宽可拖拽、单元格弹窗查看详情
- **日期格式化**：可配置 datetime/date/time 显示格式

### ✅ 高级验证
- **表/列存在性**：实时检查 SQL 中引用的表和列是否存在
- **结果映射验证**：检查 resultMap/resultType 与 Java 属性是否匹配
- **嵌套支持**：验证 association/collection 内部属性
- **自动 .gitignore**：索引时自动排除 gitignore 中的目录

### 🛠️ 代码生成
- **一键生成**：右键表 → 生成 Entity、Mapper、XML、Service、ServiceImpl
- **MyBatis-Plus 风格**：`@TableName`、`@TableId`、`BaseMapper`、`IService`
- **MyBatis 风格**：传统 Mapper 接口 + 完整 XML CRUD
- **可配置**：自动填充字段、逻辑删除、主键策略、目录名

### ⚡ 方法名生成 SQL
- **Quick Fix**：写方法名（如 `selectUserByNameAndAge`），灯泡提示自动生成 SQL
- **支持前缀**：select、update、delete、count、insert
- **条件连接**：And、Or；后缀：Like、In、Between 等

---

## 📦 安装

### 方式一：VS Code 扩展市场（推荐）

1. 打开 VS Code
2. 按 `Ctrl+Shift+X` 打开扩展面板
3. 搜索 **MyBatis Toolkit Pro**
4. 点击 **Install**

### 方式二：命令行安装

```bash
code --install-extension xiyeming.mybatis-toolkit-pro
```

### 方式三：VSIX 手动安装

1. 从 [GitHub Releases](https://github.com/xiyeming/mybatis-toolkit-pro/releases) 下载最新 `.vsix` 文件
2. VS Code → 扩展面板 → `...` → **Install from VSIX...**
3. 选择下载的 `.vsix` 文件

### 系统要求

| 依赖 | 版本要求 |
|------|----------|
| VS Code | `^1.100.0` |
| Node.js | `>=16` (用于驱动安装) |

### 可选数据库驱动

内置驱动（开箱即用）：
- `mysql2` — MySQL / MariaDB
- `pg` — PostgreSQL

需要手动安装的驱动：

| 数据库 | 驱动包 | 安装命令 |
|--------|--------|----------|
| Oracle | `oracledb` | `npm install oracledb` |
| SQL Server | `mssql` | `npm install mssql` |
| SQLite | `better-sqlite3` | `npm install better-sqlite3` |
| DB2 | `ibm_db` | `npm install ibm_db` |
| H2 | `jdbc` + H2 jar | `npm install jdbc` + 配置 `options.jarPath` |

> 💡 也可以在连接配置的 `driverPath` 字段指定本地驱动路径，无需全局安装。

---

## 🚀 快速开始

### 1. 添加数据库连接

1. 点击侧栏 **MyBatis** 图标
2. 点击标题栏 **+** 按钮（添加连接）
3. 填写数据库类型、主机、端口、用户名、密码、数据库名
4. 点击 **测试连接** 验证
5. 点击 **添加** 保存

### 2. 浏览数据库

- 展开连接查看表列表
- 右键表 → **打开表结构** 查看列信息
- 右键表 → **生成代码** 生成 Entity/Mapper/XML

### 3. 执行 SQL

1. 新建或打开 `.sql` 文件
2. 点击编辑器标题栏数据库图标选择连接
3. 选中 SQL 语句，按 `Ctrl+Shift+,` 执行

### 4. 导航代码

- 在 Mapper 接口点击方法名上方的 **跳转到 XML**
- 在 XML 中 Ctrl+Click 表名跳转到结构视图
- Ctrl+Click `resultType` 类名跳转到 Java 类

---

## 🎯 智能导航

### Mapper ↔ XML 跳转

```
┌─────────────────────┐         ┌─────────────────────┐
│   UserMapper.java   │ ◄─────► │   UserMapper.xml    │
│                     │         │                     │
│  + selectById()     │         │  <select id=        │
│  + selectByName()   │         │   "selectById">     │
│  + insert()         │         │                     │
└─────────────────────┘         └─────────────────────┘
```

- **CodeLens**：方法上方显示「跳转到 XML」/「跳转到接口」
- **命令**：右键 → **MyBatis: 跳转到 XML / 跳转到 Mapper 接口**

### 表名与列名跳转

```sql
SELECT u.user_name, u.email
FROM biz_user u  -- Ctrl+Click biz_user 跳转到表结构
WHERE u.id = #{userId}
```

### ResultMap 属性跳转

```xml
<resultMap id="userMap" type="com.example.entity.User">
    <id column="user_id" property="userId" />  <!-- Ctrl+Click userId 跳转到 Java 字段 -->
    <result column="user_name" property="userName" />
</resultMap>
```

---

## 🎨 SQL 高亮与格式化

### 语义高亮

| 元素 | 默认颜色 | 配置项 |
|------|----------|--------|
| 表名 | 🟠 `#FFAB70` | `highlights.tableNameColor` |
| 关键字 | 🟣 `#C586C0` | `highlights.keywordColor` |
| 函数 | 🟡 `#DCDCAA` | `highlights.functionColor` |
| 参数 | 🔵 `#9CDCFE` | `highlights.paramColor` |

### 格式化示例

```sql
-- 格式化前
SELECT u.id,u.name,o.order_no FROM biz_user u LEFT JOIN biz_order o ON u.id=o.user_id WHERE u.status=1 AND o.amount>100

-- 格式化后
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

### 支持的方言

| 数据库 | 关键字 | 函数 | 引号 |
|--------|--------|------|------|
| MySQL | ✅ | ✅ | `` ` `` |
| PostgreSQL | ✅ | ✅ | `"` |
| Oracle | ✅ | ✅ | `"` |
| SQL Server | ✅ | ✅ | `[]` |
| SQLite | ✅ | ✅ | `"` |
| DB2 | ✅ | ✅ | `"` |
| H2 | ✅ | ✅ | `"` |
| MariaDB | ✅ | ✅ | `` ` `` |

---

## 🗄️ 数据库管理

### 数据库浏览器

```
📦 MyBatis
├── 🟢 生产库 (MySQL) - root@localhost:3306/prod
│   ├── 📋 biz_user
│   │   ├── 🔑 id: bigint
│   │   ├── user_name: varchar
│   │   └── email: varchar
│   ├── 📋 biz_order
│   └── 📋 biz_product
└── 🔴 测试库 (PostgreSQL) - admin@192.168.1.100:5432/test
```

### 连接管理

- **添加连接**：点击标题栏 **+** 按钮
- **编辑连接**：右键连接 → 编辑
- **测试连接**：在编辑弹窗中点击「测试连接」
- **删除连接**：右键连接 → 移除
- **连接/断开**：右键连接 → 连接/断开

### 支持的数据库

| 数据库 | 状态 | 驱动 |
|--------|------|------|
| MySQL | ✅ 内置 | `mysql2` |
| MariaDB | ✅ 内置 | `mysql2` |
| PostgreSQL | ✅ 内置 | `pg` |
| Oracle | ✅ 可选 | `oracledb` |
| SQL Server | ✅ 可选 | `mssql` |
| SQLite | ✅ 可选 | `better-sqlite3` |
| DB2 | ✅ 可选 | `ibm_db` |
| H2 | ✅ 可选 | `jdbc` |

---

## 🔍 查询执行

### 快捷键

| 功能 | Windows / Linux | macOS |
|------|-----------------|-------|
| 执行选中 SQL | `Ctrl+Shift+,` | `Cmd+Shift+,` |
| 执行全部 SQL | `Ctrl+Shift+.` | `Cmd+Shift+.` |

### 结果面板

- **分页**：上一页/下一页，支持大量结果
- **行号**：第一列显示行号
- **列宽**：拖拽调整
- **单元格详情**：点击弹出完整内容
- **日期格式**：可配置显示格式

### 执行全部 SQL

执行文件中以分号分隔的所有语句，每条语句独立结果窗口：

```
查询结果 (1/3)  查询结果 (2/3)  查询结果 (3/3)
```

---

## ✅ SQL 验证

### 表/列验证

```xml
<select id="selectUser" resultType="User">
    SELECT user_name, non_exist_column  <!-- ⚠️ 列不存在 -->
    FROM non_exist_table  <!-- ⚠️ 表不存在 -->
</select>
```

### 结果映射验证

```xml
<resultMap id="userMap" type="User">
    <result column="user_name" property="nonExistField" />  <!-- ⚠️ 属性不存在 -->
</resultMap>
```

### 验证配置

```json
{
  "mybatisToolkit.validation.enable": true
}
```

---

## 🛠️ 代码生成

### 生成内容

右键表 → **生成代码**，选择风格后自动生成：

| 文件 | MyBatis-Plus | MyBatis |
|------|--------------|---------|
| Entity | `@TableName` `@TableId` | POJO |
| Mapper | 继承 `BaseMapper` | 完整 CRUD 方法 |
| XML | resultMap + Base_Column_List | 完整 SQL |
| Service | 继承 `IService` | 接口 + CRUD 方法 |
| ServiceImpl | 继承 `ServiceImpl` | 注入 Mapper 实现 |

### 生成目录

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

### MyBatis-Plus 可配置项

| 配置项 | 说明 | 示例 |
|--------|------|------|
| `codeGen.mybatisPlus.fillFields` | 自动填充字段 | `[{column: "create_time", fill: "INSERT"}]` |
| `codeGen.mybatisPlus.logicDeleteField` | 逻辑删除字段 | `del_flag` |
| `codeGen.mybatisPlus.idType` | 主键策略 | `AUTO` / `ASSIGN_ID` / `ASSIGN_UUID` |

---

## ⚡ 方法名生成 SQL

在 Mapper 接口写方法名，使用 Quick Fix 自动生成 XML SQL：

```java
// 写方法名
List<User> selectUserByNameAndAge(String name, Integer age);
```

↓ Quick Fix 自动生成 ↓

```xml
<select id="selectUserByNameAndAge" resultMap="BaseResultMap">
    SELECT * FROM user
    WHERE name = #{name}
      AND age = #{age}
</select>
```

### 支持的方法名模式

| 前缀 | 说明 | 示例 |
|------|------|------|
| `select` | 查询 | `selectByName` |
| `insert` | 插入 | `insertSelective` |
| `update` | 更新 | `updateById` |
| `delete` | 删除 | `deleteByStatus` |
| `count` | 计数 | `countByType` |

| 连接词 | 说明 | 示例 |
|--------|------|------|
| `And` | AND 条件 | `ByNameAndAge` |
| `Or` | OR 条件 | `ByStatusOrType` |

| 后缀 | 说明 | 示例 |
|------|------|------|
| `Like` | LIKE 查询 | `ByNameLike` |
| `In` | IN 查询 | `ByIdIn` |
| `Between` | BETWEEN | `ByDateBetween` |
| `OrderBy` | 排序 | `OrderByNameDesc` |

---

## ⚙️ 配置

在 VS Code 设置中搜索 `mybatisToolkit` 查看所有配置项。

### 数据库配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `database.defaultType` | string | `MySQL` | 默认数据库方言 |
| `connections` | array | `[]` | 数据库连接列表 |

### 验证配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `validation.enable` | boolean | `true` | 启用 SQL 验证 |

### 索引配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `navigation.exclude` | array | `["target", "build", ...]` | 索引排除目录 |

### 性能配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `performance.indexParseConcurrency` | number | `20` | 索引并发数 |
| `performance.indexDebounceMs` | number | `300` | 索引防抖 (ms) |
| `performance.validationDebounceMs` | number | `400` | 验证防抖 (ms) |

### 格式化配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `formatting.indentSize` | number | `4` | 缩进空格数 |

### 高亮配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `highlights.tableNameColor` | color | `#FFAB70` | 表名颜色 |
| `highlights.keywordColor` | color | `#C586C0` | 关键字颜色 |
| `highlights.functionColor` | color | `#DCDCAA` | 函数颜色 |
| `highlights.paramColor` | color | `#9CDCFE` | 参数颜色 |

### 查询结果配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `queryResult.datetimeFormat` | string | `%Y-%m-%d %H:%i:%s` | 日期时间格式 |
| `queryResult.dateFormat` | string | `%Y-%m-%d` | 日期格式 |
| `queryResult.timeFormat` | string | `%H:%i:%s` | 时间格式 |

### 代码生成配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `codeGen.dirs.entity` | string | `entity` | Entity 目录名 |
| `codeGen.dirs.mapper` | string | `mapper` | Mapper 目录名 |
| `codeGen.dirs.xml` | string | `mapper` | XML 目录名 |
| `codeGen.dirs.service` | string | `service` | Service 目录名 |
| `codeGen.mybatisPlus.idType` | enum | `AUTO` | 主键策略 |
| `codeGen.mybatisPlus.logicDeleteField` | string | `` | 逻辑删除字段 |
| `codeGen.mybatisPlus.fillFields` | array | `[]` | 自动填充字段 |

---

## 🔧 开发指南

### 环境准备

```bash
# 克隆仓库
git clone https://github.com/xiyeming/mybatis-toolkit-pro.git
cd mybatis-toolkit-pro

# 安装依赖
npm install

# 编译
npm run compile

# 监听模式
npm run watch
```

### 项目结构

```
mybatis-toolkit-pro/
├── src/
│   ├── extension.ts              # 扩展入口
│   ├── config.ts                 # 配置读取
│   ├── constants.ts              # 常量定义
│   ├── types.ts                  # 类型定义
│   ├── providers/                # VS Code Provider
│   │   ├── MyBatisCodeLensProvider.ts
│   │   ├── SqlDefinitionProvider.ts
│   │   ├── SqlFormattingProvider.ts
│   │   ├── SqlHighlightingProvider.ts
│   │   ├── SqlValidationProvider.ts
│   │   ├── DatabaseTreeDataProvider.ts
│   │   └── ...
│   ├── services/                 # 业务服务
│   │   ├── DatabaseService.ts    # 数据库服务
│   │   ├── CodeGenerationService.ts
│   │   ├── ProjectIndexer.ts     # 项目索引
│   │   └── db/                   # 数据库适配器
│   │       ├── IDbAdapter.ts
│   │       ├── MySQLAdapter.ts
│   │       ├── PgAdapter.ts
│   │       └── ...
│   ├── panels/                   # WebView 面板
│   │   ├── QueryResultsPanel.ts
│   │   ├── ConnectionFormPanel.ts
│   │   └── CodeGenFormPanel.ts
│   └── utils/                    # 工具类
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

### 开发命令

| 命令 | 说明 |
|------|------|
| `npm run compile` | Webpack 开发模式编译 |
| `npm run watch` | 监听模式编译 |
| `npm run package` | 生产模式打包 |
| `npm run lint` | ESLint 检查 |
| `npm run pretest` | 完整验证（编译测试 + 编译 + lint） |

### 调试扩展

1. 按 `F5` 启动调试
2. 选择 **Run Extension**
3. 在新窗口中测试扩展

### 打包 VSIX

```bash
npm install -g @vscode/vsce
vsce package
```

---

## 🤝 贡献

欢迎贡献代码、报告问题或提出建议！

### 报告问题

- [GitHub Issues](https://github.com/xiyeming/mybatis-toolkit-pro/issues)
- 请提供：VS Code 版本、扩展版本、复现步骤、错误日志

### 提交 PR

1. Fork 仓库
2. 创建特性分支：`git checkout -b feature/my-feature`
3. 提交更改：`git commit -m 'feat: add my feature'`
4. 推送分支：`git push origin feature/my-feature`
5. 创建 Pull Request

### Commit 规范

使用 [Conventional Commits](https://www.conventionalcommits.org/)：

```
feat: 新功能
fix: 修复
docs: 文档
style: 格式
refactor: 重构
test: 测试
chore: 构建/工具
```

---

## 📄 许可证

[MIT License](LICENSE.md)

---

## 🙏 致谢

- [VS Code Extension API](https://code.visualstudio.com/api)
- [MyBatis](https://mybatis.org/mybatis-3/)
- [MyBatis-Plus](https://baomidou.com/)
- [mysql2](https://github.com/sidorares/node-mysql2)
- [pg](https://github.com/brianc/node-postgres)

---

<p align="center">
  如果这个扩展对你有帮助，请给个 ⭐ Star 支持一下！
</p>
