import * as vscode from 'vscode';
import * as path from 'path';
import { DatabaseService } from '../services/DatabaseService';
import { ConnectionConfig } from '../types';

export class DatabaseTreeDataProvider implements vscode.TreeDataProvider<DatabaseTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<DatabaseTreeItem | undefined | null | void> = new vscode.EventEmitter<DatabaseTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<DatabaseTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private dbService: DatabaseService) {
        this.dbService.onDidConfigChange(() => this.refresh());
        this.dbService.onDidReady(() => this.refresh());
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: DatabaseTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: DatabaseTreeItem): Promise<DatabaseTreeItem[]> {
        if (!element) {
            // 根节点：列出连接
            const connections = this.dbService.getConnections();
            return connections.map(c => {
                const isActive = this.dbService.getActiveConnectionId() === c.id;
                return new ConnectionItem(c, isActive, this.dbService.isConnected() && isActive);
            });
        } else if (element instanceof ConnectionItem) {
            // 第 2 层：表 (仅当激活且已连接时)
            if (element.isActive && element.isConnected) {
                // 如果表已缓存/就绪
                if (this.dbService.isReady()) {
                    // 我们需要一种方法从服务中获取表列表。
                    // 理想情况下，DatabaseService 应该公开 getTables() (缓存的名称)
                    // 但我们使用了私有 tableCache。让我们添加一个公共 getter。
                    // 目前，假设我们可以获取它，或者我们必须等待。
                    // 等等！tableCache 是私有的。我需要公开它。
                    // 更好的是，我将把 getTableNames() 添加到 DatabaseService。
                    // 假设我已经添加了 getTableNames() 或类似的。
                    // 让我们先修改 DatabaseService 以公开 getTableNames 或假设它返回 []

                    // 注意：我需要更新 DatabaseService 以公开 getTableNames。
                    // 对于这次写入，我假设 getTableNames 存在或我将很快实现它。
                    const tables = await this.dbService.getTableNames();
                    return tables.map(t => new TableItem(t, element.config, this.dbService.getTableComment(t)));
                }
                return [new InfoItem("正在加载表...")];
            } else if (element.isActive && !element.isConnected) {
                return [new InfoItem("正在连接...")];
            }
            return [new InfoItem("未连接。请右键点击以连接。")];
        } else if (element instanceof TableItem) {
            // 第 3 层：列
            const columns = await this.dbService.getTableSchema(element.tableName);
            return columns.map(c => new ColumnItem(c));
        }
        return [];
    }
}

export abstract class DatabaseTreeItem extends vscode.TreeItem {
    constructor(label: string, collapsibleState: vscode.TreeItemCollapsibleState) {
        super(label, collapsibleState);
    }
}

export class ConnectionItem extends DatabaseTreeItem {
    constructor(
        public readonly config: ConnectionConfig,
        public readonly isActive: boolean,
        public readonly isConnected: boolean
    ) {
        super(config.name, isActive ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'connection';
        this.description = `${config.user}@${config.host}:${config.port}/${config.database}`;
        this.tooltip = `ID: ${config.id}`;

        if (isActive) {
            this.iconPath = new vscode.ThemeIcon('database', new vscode.ThemeColor('charts.green'));
            this.description += " (活跃)";
        } else {
            this.iconPath = new vscode.ThemeIcon('database');
        }
    }
}

export class TableItem extends DatabaseTreeItem {
    constructor(public readonly tableName: string, public readonly connection: ConnectionConfig, comment?: string) {
        super(tableName, vscode.TreeItemCollapsibleState.Collapsed);
        this.contextValue = 'table';
        this.iconPath = new vscode.ThemeIcon('table');
        this.description = comment; // 显示注释

        this.command = {
            command: 'mybatisToolkit.openTableSchema',
            title: '打开架构',
            arguments: [tableName]
        };
        this.tooltip = `${tableName}${comment ? '\n' + comment : ''}`;
    }
}

export class ColumnItem extends DatabaseTreeItem {
    constructor(public readonly column: any) {
        // 字段: 类型
        super(`${column.Field}: ${column.Type}`, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'column';

        if (column.Key === 'PRI') {
            this.iconPath = new vscode.ThemeIcon('key', new vscode.ThemeColor('charts.yellow'));
        } else {
            this.iconPath = new vscode.ThemeIcon('symbol-field');
        }

        const details = [
            column.Key === 'PRI' ? 'PK' : '',
            column.Null === 'YES' ? 'Nullable' : 'NotNull',
            column.Default ? `Def:${column.Default}` : ''
        ].filter(Boolean).join(', ');

        this.description = details + (column.Comment ? `  // ${column.Comment}` : '');
        this.tooltip = column.Comment;
    }
}

class InfoItem extends DatabaseTreeItem {
    constructor(label: string) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'info';
    }
}
