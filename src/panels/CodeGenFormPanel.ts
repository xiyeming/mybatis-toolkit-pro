import * as vscode from 'vscode';
import { CodeGenStyle } from '../services/CodeGenerationService';

export class CodeGenFormPanel {
    public static viewType = 'mybatisToolkit.codeGenForm';
    private static currentPanel: CodeGenFormPanel | undefined;
    private panel: vscode.WebviewPanel | undefined;
    private resolvePromise: ((result: {
        basePackage: string;
        style: CodeGenStyle;
        workspaceRoot: string;
    } | undefined) => void) | undefined;

    public static createOrShow(tableName: string, existing?: {
        basePackage: string;
        style: CodeGenStyle;
        workspaceRoot: string;
    }): Promise<{ basePackage: string; style: CodeGenStyle; workspaceRoot: string } | undefined> {
        const promise = new Promise<{ basePackage: string; style: CodeGenStyle; workspaceRoot: string } | undefined>((resolve) => {
            CodeGenFormPanel.currentPanel = CodeGenFormPanel.createNew(tableName, existing, resolve);
        });
        return promise;
    }

    private static createNew(
        tableName: string,
        existing: { basePackage: string; style: CodeGenStyle; workspaceRoot: string } | undefined,
        resolve: (result: { basePackage: string; style: CodeGenStyle; workspaceRoot: string } | undefined) => void
    ): CodeGenFormPanel {
        const panel = vscode.window.createWebviewPanel(
            CodeGenFormPanel.viewType,
            '生成代码',
            vscode.ViewColumn.Beside,
            { enableScripts: true, retainContextWhenHidden: true }
        );
        const instance = new CodeGenFormPanel(panel, resolve);
        panel.onDidDispose(() => {
            if (CodeGenFormPanel.currentPanel === instance) {
                CodeGenFormPanel.currentPanel = undefined;
                resolve(undefined);
            }
        });
        panel.webview.html = instance.buildHtml(tableName, existing);
        panel.webview.onDidReceiveMessage((msg: any) => {
            try {
                if (msg.type === 'submit') {
                    instance.handleSubmit(msg.payload);
                } else if (msg.type === 'cancel') {
                    instance.handleCancel();
                } else if (msg.type === 'formError') {
                    vscode.window.showWarningMessage(msg.message);
                }
            } catch (error) {
                console.error('CodeGenFormPanel message handler error:', error);
                vscode.window.showErrorMessage(`操作失败: ${error}`);
            }
        });
        return instance;
    }

    private constructor(panel: vscode.WebviewPanel, resolve: (result: { basePackage: string; style: CodeGenStyle; workspaceRoot: string } | undefined) => void) {
        this.panel = panel;
        this.resolvePromise = resolve;
    }

    private buildHtml(tableName: string, existing: { basePackage: string; style: CodeGenStyle; workspaceRoot: string } | undefined): string {
        const data = existing || {
            basePackage: 'com.example',
            style: 'mybatis-plus' as CodeGenStyle,
            workspaceRoot: ''
        };

        const roots = vscode.workspace.workspaceFolders || [];
        const defaultRoot = data.workspaceRoot || roots[0]?.uri.fsPath || '';

        const workspaceOptions = roots.map((f, i) =>
            `<option value="${escapeHtml(f.uri.fsPath)}" ${defaultRoot === f.uri.fsPath ? 'selected' : ''}>${i === 0 ? '默认' : ''} ${escapeHtml(f.name)} (${escapeHtml(f.uri.fsPath)})</option>`
        ).join('');

        const styleOptions = [
            { value: 'mybatis-plus', label: 'MyBatis-Plus（默认）', desc: 'Entity 注解 + BaseMapper，XML 仅 resultMap' },
            { value: 'mybatis', label: 'MyBatis', desc: '传统 Mapper 接口 + 完整 XML CRUD' }
        ].map(s =>
            `<option value="${s.value}" ${data.style === s.value ? 'selected' : ''}>${s.label} — ${s.desc}</option>`
        ).join('');

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
        .form-container { width: 100%; max-width: 560px; }
        h2 { margin: 0 0 6px 0; font-size: 18px; font-weight: 600; }
        .subtitle { margin: 0 0 20px 0; font-size: 13px; opacity: 0.7; }
        .field { margin-bottom: 14px; }
        label { display: block; font-size: 13px; margin-bottom: 6px; opacity: 0.9; }
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
        input:focus, select:focus { border-color: var(--accent); }
        .row { display: flex; gap: 12px; }
        .row .field { flex: 1; }
        .actions { display: flex; gap: 10px; margin-top: 20px; }
        button {
            flex: 1;
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
        }
        .btn-primary { background: var(--accent); color: #fff; }
        .btn-primary:hover { background: var(--accent-hover); }
        .btn-secondary {
            background: transparent;
            color: var(--fg);
            border: 1px solid var(--input-border);
        }
        .btn-secondary:hover { background: rgba(255,255,255,0.05); }
        .hint { font-size: 12px; opacity: 0.6; margin-top: 4px; }
        .preview {
            margin-top: 16px;
            padding: 12px;
            background: rgba(255,255,255,0.03);
            border: 1px solid var(--input-border);
            border-radius: 4px;
            font-size: 12px;
            line-height: 1.6;
        }
        .preview-title { font-weight: 600; margin-bottom: 6px; opacity: 0.8; }
    </style>
</head>
<body>
    <div class="form-container">
        <h2>生成代码</h2>
        <p class="subtitle">表：<strong>${escapeHtml(tableName)}</strong></p>
        <form id="codeGenForm">
            <div class="field">
                <label for="basePackage">基础包名</label>
                <input id="basePackage" name="basePackage" type="text" value="${escapeHtml(data.basePackage)}" placeholder="com.example.demo" />
                <div class="hint">Entity/Mapper 将生成在 basePackage.{entity|mapper} 下</div>
            </div>
            <div class="field">
                <label for="style">代码风格</label>
                <select id="style" name="style">
                    ${styleOptions}
                </select>
            </div>
            <div class="field">
                <label for="workspaceRoot">生成目录（项目根目录）</label>
                <input id="workspaceRoot" name="workspaceRoot" type="text" value="${escapeHtml(defaultRoot)}" placeholder="/path/to/project" />
                <div class="hint">Entity/Mapper 将生成在 src/main/java，XML 生成在 src/main/resources。可直接输入路径或使用工作区文件夹路径。</div>
            </div>
            <div class="actions">
                <button type="button" class="btn-secondary" id="btnCancel">取消</button>
                <button type="submit" class="btn-primary">生成</button>
            </div>
        </form>
        <div class="preview" id="preview" style="display:none;">
            <div class="preview-title">生成预览</div>
            <div id="previewContent"></div>
        </div>
    </div>
    <script>
        const form = document.getElementById('codeGenForm');
        const basePackageInput = document.getElementById('basePackage');
        const styleSelect = document.getElementById('style');
        const workspaceInput = document.getElementById('workspaceRoot');
        const preview = document.getElementById('preview');
        const previewContent = document.getElementById('previewContent');

        function updatePreview() {
            const pkg = basePackageInput.value.trim();
            const style = styleSelect.value;
            const root = workspaceInput.value.trim();
            if (!pkg || !root) {
                preview.style.display = 'none';
                return;
            }
            const entityPkg = pkg + '.entity';
            const mapperPkg = pkg + '.mapper';
            const xmlDir = 'src/main/resources/mapper';
            previewContent.innerHTML = '<strong>包名：</strong>' + escapeHtml(pkg) + '<br>' +
                '<strong>风格：</strong>' + escapeHtml(style === 'mybatis-plus' ? 'MyBatis-Plus' : 'MyBatis') + '<br>' +
                '<strong>目录：</strong>' + escapeHtml(root) + '<br>' +
                '<strong>Entity：</strong>' + escapeHtml(entityPkg) + '<br>' +
                '<strong>Mapper：</strong>' + escapeHtml(mapperPkg) + '<br>' +
                '<strong>XML：</strong>' + escapeHtml(xmlDir);
            preview.style.display = 'block';
        }

        basePackageInput.addEventListener('input', updatePreview);
        styleSelect.addEventListener('change', updatePreview);
        workspaceInput.addEventListener('input', updatePreview);
        updatePreview();

        document.getElementById('btnCancel').addEventListener('click', () => {
            vscode.postMessage({ type: 'cancel' });
        });
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const fd = new FormData(form);
            const payload = {
                basePackage: (fd.get('basePackage') || '').trim(),
                style: fd.get('style'),
                workspaceRoot: (fd.get('workspaceRoot') || '').trim()
            };
            if (!payload.basePackage || !payload.workspaceRoot) {
                vscode.postMessage({ type: 'formError', message: '请填写基础包名并选择生成目录' });
                return;
            }
            vscode.postMessage({ type: 'submit', payload });
        });

        function escapeHtml(s) {
            return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }
    </script>
</body>
</html>`;
    }

    private handleSubmit(payload: any): void {
        const basePackage = (payload?.basePackage || '').trim();
        const workspaceRoot = (payload?.workspaceRoot || '').trim();
        if (!basePackage || !workspaceRoot) {
            this.panel?.webview.postMessage({ type: 'formError', message: '请填写基础包名并输入生成目录' });
            return;
        }
        if (this.resolvePromise) {
            this.resolvePromise({
                basePackage,
                style: payload.style,
                workspaceRoot
            });
        }
        this.panel?.dispose();
    }

    private handleCancel(): void {
        if (this.resolvePromise) {
            this.resolvePromise(undefined);
        }
        this.panel?.dispose();
    }
}

function escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
