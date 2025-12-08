# 开发编译手册

本文档旨在帮助开发者快速搭建 MyBatis Toolkit Pro 的开发环境，并进行编译、调试和打包。

## 1. 环境准备

在开始之前，请确保您的开发环境满足以下要求：

-   **操作系统**: MacOS / Windows / Linux
-   **Node.js**: 建议使用 LTS 版本 (v18+ 或 v20+)
-   **包管理器**: npm (或 yarn/pnpm)
-   **IDE**: Visual Studio Code
-   **VSCE**: VS Code 扩展打包工具 (`npm install -g @vscode/vsce`)

## 2. 快速开始

### 2.1 克隆项目

```bash
git clone <repository-url>
cd mybatis-toolkit-pro
```

### 2.2 安装依赖

```bash
npm install
```

### 2.3 启动调试 (Debug)

1.  在 VS Code 中打开项目根目录。
2.  按 `F5` 或点击左侧 "运行和调试" 图标，选择 **"Run Extension"**。
3.  这将启动一个新的 "扩展开发宿主" (Extension Development Host) 窗口，您可以在其中测试插件功能。

## 3. 常用命令 (Scripts)

在 `package.json` 中定义了以下常用命令：

| 命令 | 说明 | 对应指令 |
| :--- | :--- | :--- |
| `npm run compile` | 使用 Webpack 编译 TypeScript 代码 | `webpack` |
| `npm run watch` | 监视文件更改并自动重新编译 (开发模式) | `webpack --watch` |
| `npm run package` | 生产环境编译 (压缩混淆) | `webpack --mode production ...` |
| `npm run lint` | 运行 ESLint 代码检查 | `eslint src --ext ts` |
| `npm test` | 运行单元测试 | `node ./out/test/runTest.js` |

## 4. 打包发布 (.vsix)

要生成可供安装的 `.vsix`插件包，请运行以下命令：

```bash
# 1. 确保已全局安装 vsce
npm install -g @vscode/vsce

# 2. 打包 (会自动执行 npm run package 进行预编译)
vsce package
npx vsce package
```

打包成功后，会在根目录生成 `mybatis-toolkit-pro-x.x.x.vsix` 文件。

### 安装测试

在 VS Code 中，按 `Cmd+Shift+P` (或 `Ctrl+Shift+P`)，输入 **"Extensions: Install from VSIX..."**，然后选择生成的 `.vsix` 文件即可安装。

## 5. 项目结构说明

```text
├── src/
│   ├── extension.ts           # 插件入口文件 (activate/deactivate)
│   ├── types.ts               # TypeScript 接口定义
│   ├── services/              # 核心业务逻辑服务
│   │   ├── DatabaseService.ts # 数据库连接与元数据管理
│   │   ├── ProjectIndexer.ts  # 项目文件索引 (Java/XML 解析)
│   │   └── ...
│   ├── providers/             # VS Code 功能提供者
│   │   ├── DatabaseTreeDataProvider.ts # 侧边栏数据库视图
│   │   ├── SqlValidationProvider.ts    # SQL 验证与红线报错
│   │   ├── SqlFormattingProvider.ts    # SQL 格式化
│   │   ├── MyBatisCodeLensProvider.ts  # CodeLens (快捷操作)
│   │   └── ...
│   └── utils/                 # 工具类 (AST 解析等)
├── resources/                 # 静态资源 (图标等)
├── package.json               # 项目配置与命令定义
├── webpack.config.js          # Webpack 配置文件
└── tsconfig.json              # TypeScript 编译配置
```

## 6. 注意事项

-   **WebView UI**: 如果涉及 Webview 开发，请注意内容安全策略 (CSP)。
-   **数据库驱动**: 本项目使用 `mysql2` 库连接 MySQL，目前仅支持 MySQL/MariaDB。
-   **性能**: `ProjectIndexer` 会在启动时扫描工作区，开发时请注意大文件的处理逻辑。
