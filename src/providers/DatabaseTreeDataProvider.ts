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
            // Root: List Connections
            const connections = this.dbService.getConnections();
            return connections.map(c => {
                const isActive = this.dbService.getActiveConnectionId() === c.id;
                return new ConnectionItem(c, isActive, this.dbService.isConnected() && isActive);
            });
        } else if (element instanceof ConnectionItem) {
            // Level 2: Tables (only if active and connected)
            if (element.isActive && element.isConnected) {
                // If tables are cached/ready
                if (this.dbService.isReady()) {
                    // We need a way to get the table list from service.
                    // Ideally DatabaseService should expose getTables() (cached names)
                    // But we used private tableCache. Let's add a public getter.
                    // For now, assume we can get it or we have to wait.
                    // Wait! tableCache is private. I need to expose it.
                    // Better yet, I'll add getTableNames() to DatabaseService.
                    // Assuming I've added getTableNames() or similar.
                    // Let's modify DatabaseService to expose getTableNames first or assume it returns []

                    // Note: I will need to update DatabaseService to expose getTableNames.
                    // For this write, I'll assume getTableNames exists or I'll implement it shortly.
                    const tables = await this.dbService.getTableNames();
                    return tables.map(t => new TableItem(t, element.config, this.dbService.getTableComment(t)));
                }
                return [new InfoItem("Loading tables...")];
            } else if (element.isActive && !element.isConnected) {
                return [new InfoItem("Connecting...")];
            }
            return [new InfoItem("Not connected. Right click to connect.")];
        } else if (element instanceof TableItem) {
            // Level 3: Columns
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
            this.description += " (Active)";
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
        this.description = comment; // Show comment

        this.command = {
            command: 'mybatisToolkit.openTableSchema',
            title: 'Open Schema',
            arguments: [tableName]
        };
        this.tooltip = `${tableName}${comment ? '\n' + comment : ''}`;
    }
}

export class ColumnItem extends DatabaseTreeItem {
    constructor(public readonly column: any) {
        // Field: Type
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
