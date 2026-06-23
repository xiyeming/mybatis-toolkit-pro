import * as vscode from 'vscode';
import { ConnectionConfig } from '../types';
import { DatabaseService } from '../services/DatabaseService';

const DB_TYPES = ['MySQL', 'PostgreSQL', 'Oracle', 'SQL Server', 'SQLite', 'DB2', 'H2', 'MariaDB'] as const;

export class ConnectionFormPanel {
    public static viewType = 'mybatisToolkit.connectionForm';
    private static currentPanel: ConnectionFormPanel | undefined;
    private panel: vscode.WebviewPanel | undefined;
    private resolvePromise: ((config: ConnectionConfig | undefined) => void) | undefined;
    private extensionUri: vscode.Uri;
    private dbService: DatabaseService;
    private outputChannel: vscode.OutputChannel;

    public static createOrShow(extensionUri: vscode.Uri, dbService: DatabaseService, outputChannel: vscode.OutputChannel, mode: 'add' | 'edit', existing?: ConnectionConfig): Promise<ConnectionConfig | undefined> {
        const promise = new Promise<ConnectionConfig | undefined>((resolve) => {
            ConnectionFormPanel.currentPanel = ConnectionFormPanel.createNew(extensionUri, dbService, outputChannel, mode, existing, resolve);
        });
        return promise;
    }

    private static createNew(extensionUri: vscode.Uri, dbService: DatabaseService, outputChannel: vscode.OutputChannel, mode: 'add' | 'edit', existing: ConnectionConfig | undefined, resolve: (config: ConnectionConfig | undefined) => void): ConnectionFormPanel {
        const panel = vscode.window.createWebviewPanel(
            ConnectionFormPanel.viewType,
            mode === 'edit' ? '编辑数据库连接' : '添加数据库连接',
            vscode.ViewColumn.Beside,
            { enableScripts: true, retainContextWhenHidden: true }
        );
        const instance = new ConnectionFormPanel(extensionUri, dbService, outputChannel, panel, mode, existing?.id, resolve);
        panel.onDidDispose(() => {
            if (ConnectionFormPanel.currentPanel === instance) {
                ConnectionFormPanel.currentPanel = undefined;
                resolve(undefined);
            }
        });
        panel.webview.html = instance.buildHtml(mode, existing);
        panel.webview.onDidReceiveMessage((msg: any) => {
            try {
                if (msg.type === 'submit') {
                    instance.handleSubmit(msg.payload);
                } else if (msg.type === 'cancel') {
                    instance.handleCancel();
                } else if (msg.type === 'testConnection') {
                    instance.handleTestConnection(msg.payload);
                }
            } catch (error) {
                console.error('ConnectionFormPanel message handler error:', error);
                instance.panel?.webview.postMessage({ type: 'testResult', success: false, message: `处理失败: ${error}` });
            }
        });
        return instance;
    }

    private constructor(extensionUri: vscode.Uri, dbService: DatabaseService, outputChannel: vscode.OutputChannel, panel: vscode.WebviewPanel, private mode: 'add' | 'edit', private editId: string | undefined, resolve: (config: ConnectionConfig | undefined) => void) {
        this.extensionUri = extensionUri;
        this.dbService = dbService;
        this.outputChannel = outputChannel;
        this.panel = panel;
        this.resolvePromise = resolve;
    }

    private buildHtml(mode: 'add' | 'edit', existing: ConnectionConfig | undefined): string {
        const isEdit = mode === 'edit';
        const title = isEdit ? '编辑连接' : '添加连接';
        const submitLabel = isEdit ? '保存' : '添加';
        const data = existing || {
            type: 'MySQL',
            name: '',
            host: 'localhost',
            port: 3306,
            user: 'root',
            password: '',
            database: '',
            driverPath: ''
        };

        const typeOptions = DB_TYPES.map(t => `<option value="${t}" ${data.type === t ? 'selected' : ''}>${t}</option>`).join('');

        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        :root {
            --bg: var(--vscode-editor-background, #1e1e1e);
            --fg: var(--vscode-editor-foreground, #cccccc);
            --input-bg: var(--vscode-input-background, #3c3c3c);
            --input-border: var(--vscode-input-border, #3c3c3c);
            --accent: var(--vscode-button-background, #0e639c);
            --accent-hover: var(--vscode-button-hoverBackground, #1177bb);
            --danger: var(--vscode-errorForeground, #f48771);
        }
        * { box-sizing: border-box; }
        body {
            font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
            background: var(--bg);
            color: var(--fg);
            margin: 0;
            padding: 20px;
            display: flex;
            justify-content: center;
        }
        .form-container {
            width: 100%;
            max-width: 520px;
        }
        h2 {
            margin: 0 0 20px 0;
            font-size: 18px;
            font-weight: 600;
        }
        .field {
            margin-bottom: 14px;
        }
        label {
            display: block;
            font-size: 13px;
            margin-bottom: 6px;
            opacity: 0.9;
        }
        input, select {
            width: 100%;
            padding: 8px 10px;
            background: var(--input-bg);
            color: var(--fg);
            border: 1px solid var(--input-border);
            border-radius: 4px;
            font-size: 13px;
            outline: none;
        }
        input:focus, select:focus {
            border-color: var(--accent);
        }
        .row {
            display: flex;
            gap: 12px;
        }
        .row .field { flex: 1; }
        .actions {
            display: flex;
            gap: 10px;
            margin-top: 20px;
        }
        button {
            flex: 1;
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
        }
        .btn-primary {
            background: var(--accent);
            color: #fff;
        }
        .btn-primary:hover { background: var(--accent-hover); }
        .btn-secondary {
            background: transparent;
            color: var(--fg);
            border: 1px solid var(--input-border);
        }
        .btn-secondary:hover { background: rgba(255,255,255,0.05); }
        .hint {
            font-size: 12px;
            opacity: 0.6;
            margin-top: 4px;
        }
    </style>
</head>
<body>
    <div class="form-container">
        <h2>${title}</h2>
        <form id="connForm">
            <div class="row">
                <div class="field">
                    <label for="type">数据库类型</label>
                    <select id="type" name="type">
                        ${typeOptions}
                    </select>
                </div>
                <div class="field">
                    <label for="name">连接名称</label>
                    <input id="name" name="name" type="text" value="${escapeHtml(data.name || '')}" placeholder="例如：生产库" />
                </div>
            </div>
            <div class="row">
                <div class="field">
                    <label for="host">主机</label>
                    <input id="host" name="host" type="text" value="${escapeHtml(data.host)}" placeholder="localhost" />
                </div>
                <div class="field">
                    <label for="port">端口</label>
                    <input id="port" name="port" type="number" value="${data.port}" placeholder="3306" />
                </div>
            </div>
            <div class="row">
                <div class="field">
                    <label for="user">用户名</label>
                    <input id="user" name="user" type="text" value="${escapeHtml(data.user)}" placeholder="root" />
                </div>
                <div class="field">
                    <label for="password">密码</label>
                    <input id="password" name="password" type="password" value="${escapeHtml(data.password || '')}" placeholder="留空则保持不变" />
                    <div class="hint">密码通过 VS Code SecretStorage 安全存储，不会明文保存到 settings.json</div>
                </div>
            </div>
            <div class="field">
                <label for="driverPath">驱动路径（可选）</label>
                <input id="driverPath" name="driverPath" type="text" value="${escapeHtml(data.driverPath || '')}" placeholder="留空则自动加载默认驱动（如 better-sqlite3、oracledb）" />
                <div class="hint">对于原生驱动，可指定本地 .node 模块路径（如 /path/to/better-sqlite3）。H2 请使用 options.jarPath 指定 jar 路径。</div>
            </div>
            <div class="field">
                <label for="database">数据库 / Schema</label>
                <input id="database" name="database" type="text" value="${escapeHtml(data.database)}" placeholder="数据库名" />
            </div>
            <div class="actions">
                <button type="button" class="btn-secondary" id="btnTest">测试连接</button>
                <button type="button" class="btn-secondary" id="btnCancel">取消</button>
                <button type="submit" class="btn-primary">${submitLabel}</button>
            </div>
        </form>
    </div>
    <script>
        const form = document.getElementById('connForm');
        const btnTest = document.getElementById('btnTest');
        const btnCancel = document.getElementById('btnCancel');
        const resultDiv = document.createElement('div');
        resultDiv.id = 'testResult';
        resultDiv.style.cssText = 'margin-top:10px;padding:8px;border-radius:4px;display:none;font-size:12px;';
        form.parentNode.insertBefore(resultDiv, form.nextSibling);

        const errorDiv = document.createElement('div');
        errorDiv.id = 'formError';
        errorDiv.style.cssText = 'margin-top:10px;padding:8px;border-radius:4px;display:none;font-size:12px;background:rgba(244, 135, 113, 0.2);color:#f48771;';
        form.parentNode.insertBefore(errorDiv, resultDiv.nextSibling);

        btnCancel.addEventListener('click', () => {
            vscode.postMessage({ type: 'cancel' });
        });
        btnTest.addEventListener('click', () => {
            const fd = new FormData(form);
            const payload = {
                type: fd.get('type'),
                name: fd.get('name'),
                host: fd.get('host'),
                port: parseInt(fd.get('port'), 10) || 3306,
                user: fd.get('user'),
                password: fd.get('password'),
                database: fd.get('database'),
                driverPath: fd.get('driverPath')
            };
            errorDiv.style.display = 'none';
            resultDiv.style.display = 'none';
            btnTest.disabled = true;
            btnTest.textContent = '测试中...';
            vscode.postMessage({ type: 'testConnection', payload });
        });
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const fd = new FormData(form);
            const payload = {
                type: fd.get('type'),
                name: fd.get('name'),
                host: fd.get('host'),
                port: parseInt(fd.get('port'), 10) || 3306,
                user: fd.get('user'),
                password: fd.get('password'),
                database: fd.get('database'),
                driverPath: fd.get('driverPath')
            };
            vscode.postMessage({ type: 'submit', payload });
        });
        window.addEventListener('message', (event) => {
            const msg = event.data;
            if (msg.type === 'testResult') {
                btnTest.disabled = false;
                btnTest.textContent = '测试连接';
                resultDiv.style.display = 'block';
                resultDiv.style.background = msg.success ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 135, 113, 0.2)';
                resultDiv.style.color = msg.success ? '#4caf50' : '#f48771';
                resultDiv.textContent = msg.message;
            } else if (msg.type === 'formError') {
                errorDiv.style.display = 'block';
                errorDiv.textContent = msg.message;
                setTimeout(() => { errorDiv.style.display = 'none'; }, 3000);
            }
        });
    </script>
</body>
</html>`;
    }

    private handleSubmit(payload: any): void {
        const host = (payload?.host || '').trim();
        const database = (payload?.database || '').trim();
        if (!host || !database) {
            this.panel?.webview.postMessage({ type: 'formError', message: '请填写必填字段（主机、数据库名）' });
            return;
        }
        const config: ConnectionConfig = {
            id: this.editId || Date.now().toString(),
            type: payload.type,
            name: (payload.name || database).trim(),
            host,
            port: Number(payload.port) || 3306,
            user: (payload.user || '').trim(),
            password: payload.password,
            database,
            driverPath: payload.driverPath || undefined
        };
        const action = this.mode === 'edit' ? '更新' : '添加';
        this.outputChannel.appendLine(`[连接表单] ${action}连接: 名称=${config.name}, 类型=${config.type}, 主机=${config.host}, 端口=${config.port}, 数据库=${config.database}, 用户=${config.user}, 驱动路径=${config.driverPath || '默认'}`);
        if (this.resolvePromise) {
            this.resolvePromise(config);
        }
        this.panel?.dispose();
    }

    private async handleTestConnection(payload: any): Promise<void> {
        const host = (payload?.host || '').trim();
        const database = (payload?.database || '').trim();
        if (!host || !database) {
            this.outputChannel.appendLine('[连接表单] 测试连接失败: 请填写必填字段（主机、数据库名）');
            this.panel?.webview.postMessage({ type: 'testResult', success: false, message: '请填写必填字段（主机、数据库名）' });
            return;
        }
        try {
            const config: ConnectionConfig = {
                id: this.editId || 'test',
                type: payload.type,
                name: (payload.name || database).trim(),
                host,
                port: Number(payload.port) || 3306,
                user: (payload.user || '').trim(),
                password: payload.password,
                database,
                driverPath: payload.driverPath || undefined
            };
            this.outputChannel.appendLine(`[连接表单] 测试连接开始: 类型=${config.type}, 主机=${config.host}:${config.port}, 数据库=${config.database}, 用户=${config.user}, 驱动=${config.driverPath || '默认'}`);
            const result = await this.dbService.testConnection(config);
            this.outputChannel.appendLine(`[连接表单] 测试连接结果: 成功=${result.success}, 消息=${result.message}`);
            if (this.panel) {
                this.panel.webview.postMessage({ type: 'testResult', success: result.success, message: result.message });
            }
        } catch (error: any) {
            const msg = error.message || String(error);
            this.outputChannel.appendLine(`[连接表单] 测试连接异常: ${msg}`);
            if (this.panel) {
                this.panel.webview.postMessage({ type: 'testResult', success: false, message: msg });
            }
        }
    }

    private handleCancel(): void {
        this.outputChannel.appendLine('[连接表单] 取消操作，关闭弹窗');
        if (this.resolvePromise) {
            this.resolvePromise(undefined);
        }
        if (this.panel) {
            this.panel.dispose();
        }
    }
}

function escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
