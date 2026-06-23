import * as vscode from 'vscode';
import { QueryResult } from '../types';
import { QUERY_DEFAULT_PAGE_SIZE } from '../constants';
import type { QueryResultDateFormats } from '../config';

/** 查询结果 Webview 面板：表格展示 + 默认分页，保证性能 */
export class QueryResultsPanel {
    public static viewType = 'mybatisToolkit.queryResults';
    private panel: vscode.WebviewPanel | undefined;
    private data: QueryResult | null = null;
    private pageSize = QUERY_DEFAULT_PAGE_SIZE;
    private currentPage = 1;
    private lastSqlPreview: string | undefined;
    private lastFormats: QueryResultDateFormats | undefined;

    public static createOrShow(extensionUri: vscode.Uri, title: string): QueryResultsPanel {
        const existing = QueryResultsPanel.currentPanel;
        if (existing) {
            existing.panel!.reveal();
            return existing;
        }
        const instance = QueryResultsPanel.createNew(extensionUri, title);
        QueryResultsPanel.currentPanel = instance;
        return instance;
    }

    /** 创建新的结果窗口（不复用、不设为 currentPanel），用于执行多条 SQL 时每条对应一个窗口 */
    public static createNew(extensionUri: vscode.Uri, title: string): QueryResultsPanel {
        const panel = vscode.window.createWebviewPanel(
            QueryResultsPanel.viewType,
            title,
            vscode.ViewColumn.Beside,
            { enableScripts: true, retainContextWhenHidden: true }
        );
        const instance = new QueryResultsPanel(extensionUri, panel);
        panel.onDidDispose(() => {
            if (QueryResultsPanel.currentPanel === instance) QueryResultsPanel.currentPanel = undefined;
        });
        panel.webview.onDidReceiveMessage((msg: { type: string; page?: number }) => {
            if (msg.type === 'page' && typeof msg.page === 'number')
                instance.goToPage(msg.page);
        });
        return instance;
    }

    private static currentPanel: QueryResultsPanel | undefined;

    private constructor(private extensionUri: vscode.Uri, panel: vscode.WebviewPanel) {
        this.panel = panel;
        this.panel.webview.html = this.getEmptyHtml();
    }

    public showResult(result: QueryResult, sqlPreview?: string, dateFormats?: QueryResultDateFormats): void {
        this.data = result;
        this.currentPage = 1;
        this.pageSize = QUERY_DEFAULT_PAGE_SIZE;
        this.lastSqlPreview = sqlPreview;
        this.lastFormats = dateFormats;
        this.updateHtml();
    }

    public showError(message: string): void {
        this.data = null;
        this.panel!.webview.html = this.getErrorHtml(message);
    }

    private get totalPages(): number {
        if (!this.data || this.data.rows.length === 0) return 0;
        return Math.max(1, Math.ceil(this.data.rows.length / this.pageSize));
    }

    private get pageRows(): any[][] {
        if (!this.data) return [];
        const start = (this.currentPage - 1) * this.pageSize;
        return this.data.rows.slice(start, start + this.pageSize);
    }

    private goToPage(page: number): void {
        this.currentPage = Math.max(1, Math.min(page, this.totalPages));
        this.updateHtml();
    }

    private updateHtml(): void {
        if (!this.panel) return;
        this.panel.webview.html = this.buildHtml(this.lastSqlPreview);
    }

    private buildHtml(sqlPreview?: string): string {
        if (!this.data) {
            return this.getEmptyHtml();
        }
        const result = this.data;
        const isError = result.message && result.columns.length === 0 && result.rows.length === 0 && result.affectedRows == null;
        if (isError) return this.getErrorHtml(result.message!);

        const isDmlOnly = result.affectedRows != null && result.columns.length === 0 && result.rows.length === 0;
        const summaryBar = this.buildSummaryBar(result, isDmlOnly);
        const sqlBlock = (sqlPreview && sqlPreview.trim()) ? `<pre class="sql-preview">${escapeHtml(sqlPreview)}</pre>` : '';
        const truncateMsg = result.message ? `<p class="msg">${escapeHtml(result.message)}</p>` : '';

        if (isDmlOnly) {
            return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>${this.getCommonStyles()}</style>
</head>
<body>
    ${sqlBlock}
    ${summaryBar}
    ${truncateMsg}
</body>
</html>`;
        }

        const columns = result.columns;
        const rows = this.pageRows;
        const total = result.rows.length;
        const start = total > 0 ? (this.currentPage - 1) * this.pageSize + 1 : 0;
        const end = Math.min(this.currentPage * this.pageSize, total);
        const paginationInfo = total > 0
            ? `第 ${start}-${end} 行，共 ${result.totalFetched} 行`
            : '无数据';
        const defaultColWidth = 140;
        const rowNumCol = '<col id="col-0" style="width: 56px; min-width: 48px;">';
        const dataCols = columns.map((_, i) => `<col id="col-${i + 1}" style="width: ${defaultColWidth}px; min-width: 80px;">`).join('');
        const colgroup = rowNumCol + dataCols;
        const thRowNum = '<th class="col-rownum">#</th>';
        const ths = thRowNum + columns.map((c, i) =>
            `<th data-col="${i + 1}">${escapeHtml(String(c))}<span class="resizer" data-col="${i + 1}" title="拖动调整列宽"></span></th>`
        ).join('');
        const formats = this.lastFormats;
        const trs = rows.map((row, i) =>
            `<tr class="row-${i % 2 === 0 ? 'even' : 'odd'}"><td class="cell-num">${start + i}</td>${row.map((cell, j) => this.renderCell(cell, j, formats)).join('')}</tr>`
        ).join('');

        const prevDisabled = this.currentPage <= 1 ? ' disabled' : '';
        const nextDisabled = this.currentPage >= this.totalPages ? ' disabled' : '';
        const script = `
            const vscode = acquireVsCodeApi();
            document.getElementById('prev').onclick = function() { vscode.postMessage({ type: 'page', page: ${this.currentPage - 1} }); };
            document.getElementById('next').onclick = function() { vscode.postMessage({ type: 'page', page: ${this.currentPage + 1} }); };
        `;

        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>${this.getCommonStyles()}</style>
</head>
<body>
    ${sqlBlock}
    ${summaryBar}
    ${truncateMsg}
    <div class="toolbar">
        <span class="pagination-info">${paginationInfo}</span>
        <button id="prev" class="btn"${prevDisabled}>上一页</button>
        <span class="page-num">第 ${this.currentPage} / ${this.totalPages} 页</span>
        <button id="next" class="btn"${nextDisabled}>下一页</button>
    </div>
    <div class="table-wrap">
        <table class="result-table">
            <colgroup>${colgroup}</colgroup>
            <thead><tr>${ths}</tr></thead>
            <tbody>${trs}</tbody>
        </table>
    </div>
    <div id="cell-popover" class="cell-popover" style="display:none;"></div>
    <script>${script}</script>
    <script>
    (function() {
        var popover = document.getElementById('cell-popover');
        var lastTd = null;
        document.querySelectorAll('table.result-table td').forEach(function(td) {
            td.addEventListener('click', function(e) {
                if (e.target && e.target.classList && e.target.classList.contains('resizer')) return;
                var full = this.getAttribute('data-full');
                if (full == null) return;
                if (popover.style.display === 'block' && lastTd === this) { popover.style.display = 'none'; lastTd = null; return; }
                lastTd = this;
                popover.textContent = full === '' ? '(空)' : full;
                popover.style.display = 'block';
                var rect = this.getBoundingClientRect();
                popover.style.left = Math.min(rect.left, window.innerWidth - 320) + 'px';
                popover.style.top = (rect.top + rect.height + 4) + 'px';
                popover.style.maxWidth = '320px';
            });
        });
        document.addEventListener('click', function(e) {
            if (e.target && e.target.classList && e.target.classList.contains('resizer')) return;
            if (popover.style.display === 'block' && e.target !== popover && !popover.contains(e.target) && !e.target.closest('td')) {
                popover.style.display = 'none';
                lastTd = null;
            }
        });
        var resizing = null;
        document.querySelectorAll('.resizer').forEach(function(r) {
            r.addEventListener('mousedown', function(e) {
                e.preventDefault();
                var colId = this.getAttribute('data-col');
                var th = this.closest('th');
                var startW = (th && th.offsetWidth) ? th.offsetWidth : 140;
                resizing = { col: colId, startX: e.clientX, startW: startW };
            });
        });
        document.addEventListener('mousemove', function(e) {
            if (!resizing) return;
            var col = document.getElementById('col-' + resizing.col);
            if (!col) return;
            var newW = Math.max(80, resizing.startW + (e.clientX - resizing.startX));
            col.style.width = newW + 'px';
        });
        document.addEventListener('mouseup', function() { resizing = null; });
    })();
    </script>
</body>
</html>`;
    }

    /** 格式化单元格显示并返回 HTML，支持时间/数字/NULL 等样式，data-full 与列表一致（用格式化后的 display）供点击弹出 */
    private renderCell(cell: any, _colIndex: number, formats?: QueryResultDateFormats): string {
        const { display, cssClass } = formatCellDisplay(cell, formats);
        const cls = cssClass ? ` class="${cssClass}"` : '';
        return `<td${cls} data-full="${escapeAttr(display)}" title="点击查看完整内容">${escapeHtml(display)}</td>`;
    }

    private buildSummaryBar(result: QueryResult, isDmlOnly: boolean): string {
        const parts: string[] = [];
        if (result.affectedRows != null) {
            parts.push(`<span class="summary-item"><strong>影响行数</strong> ${result.affectedRows}</span>`);
        }
        if (result.executionTimeMs != null) {
            parts.push(`<span class="summary-item"><strong>执行时长</strong> ${result.executionTimeMs} ms</span>`);
        }
        if (result.columns.length > 0 && result.totalFetched > 0) {
            parts.push(`<span class="summary-item"><strong>返回行数</strong> ${result.totalFetched}</span>`);
        }
        if (parts.length === 0) return '';
        return `<div class="summary-bar">${parts.join('')}</div>`;
    }

    private getCommonStyles(): string {
        return `
        body { font-family: var(--vscode-font-family); font-size: 13px; padding: 12px; margin: 0; color: var(--vscode-foreground); }
        .summary-bar { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; padding: 8px 12px; margin-bottom: 10px;
            background: var(--vscode-editor-inactiveSelectionBackground); border-radius: 6px; border: 1px solid var(--vscode-panelBorder); }
        .summary-item { font-size: 13px; }
        .summary-item strong { margin-right: 4px; color: var(--vscode-descriptionForeground); }
        .toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; flex-wrap: wrap; }
        .toolbar .pagination-info { color: var(--vscode-descriptionForeground); }
        .toolbar .btn { padding: 6px 12px; cursor: pointer; border-radius: 4px; border: 1px solid var(--vscode-button-border); background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
        .toolbar .btn:hover:not(:disabled) { background: var(--vscode-button-hoverBackground); }
        .toolbar .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .table-wrap { overflow: auto; border: 1px solid var(--vscode-panelBorder); border-radius: 6px; max-height: 70vh; }
        table.result-table { border-collapse: collapse; width: 100%; table-layout: fixed; }
        table.result-table thead { position: sticky; top: 0; z-index: 2; }
        table.result-table th { padding: 8px 10px; text-align: left; font-weight: 600;
            background: var(--vscode-editor-inactiveSelectionBackground); border-bottom: 2px solid var(--vscode-panelBorder);
            border-right: 1px solid var(--vscode-panelBorder); white-space: nowrap; position: relative; user-select: none; }
        table.result-table th .resizer { position: absolute; right: 0; top: 0; width: 6px; height: 100%; cursor: col-resize; }
        table.result-table th .resizer:hover { background: var(--vscode-focusBorder); opacity: 0.6; }
        table.result-table th.col-rownum .resizer { display: none; }
        table.result-table th:last-child .resizer { display: none; }
        table.result-table td { padding: 6px 10px; border-bottom: 1px solid var(--vscode-panelBorder); border-right: 1px solid var(--vscode-panelBorder);
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
        table.result-table td:last-child { border-right: none; }
        table.result-table td.cell-null { color: var(--vscode-descriptionForeground); font-style: italic; }
        table.result-table td.cell-num { text-align: right; font-variant-numeric: tabular-nums; }
        table.result-table td.cell-bool { font-style: italic; }
        table.result-table td.cell-date { font-variant-numeric: tabular-nums; }
        .cell-popover { position: fixed; z-index: 100; padding: 10px 12px; max-width: 320px; max-height: 200px; overflow: auto;
            background: var(--vscode-editorWidget-background); border: 1px solid var(--vscode-panelBorder); border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-size: 12px; white-space: pre-wrap; word-break: break-all; }
        table.result-table tbody tr.row-odd { background: var(--vscode-editor-background); }
        table.result-table tbody tr.row-even { background: var(--vscode-editor-inactiveSelectionBackground); }
        table.result-table tbody tr:hover { background: var(--vscode-list-hoverBackground); }
        .msg { color: var(--vscode-editorWarning-foreground); margin: 4px 0 8px; font-size: 12px; }
        .sql-preview { background: var(--vscode-textBlockQuote-background); padding: 10px; overflow-x: auto; font-size: 12px; margin-bottom: 10px; border-radius: 4px; border-left: 3px solid var(--vscode-focusBorder); }
        `;
    }

    private getEmptyHtml(): string {
        return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><p>执行 SQL 后结果将显示在此处。</p></body></html>`;
    }

    private getErrorHtml(message: string): string {
        return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>body{font-family:var(--vscode-font-family);padding:12px;}</style></head>
<body><p style="color:var(--vscode-errorForeground)">${escapeHtml(message)}</p></body></html>`;
    }
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function escapeAttr(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

const DEFAULT_FORMATS: QueryResultDateFormats = {
    datetimeFormat: '%Y-%m-%d %H:%i:%s',
    dateFormat: '%Y-%m-%d',
    timeFormat: '%H:%i:%s'
};

/** 根据值类型格式化单元格显示并返回样式类，便于时间/数字/NULL 等展示 */
function formatCellDisplay(cell: any, formats?: QueryResultDateFormats): { display: string; cssClass: string } {
    if (cell === null || cell === undefined) {
        return { display: 'NULL', cssClass: 'cell-null' };
    }
    if (typeof cell === 'boolean') {
        return { display: cell ? 'true' : 'false', cssClass: 'cell-bool' };
    }
    if (typeof cell === 'number' && !Number.isNaN(cell)) {
        return { display: String(cell), cssClass: 'cell-num' };
    }
    // 数据库驱动可能返回 Date 对象，直接按配置格式输出
    if (cell instanceof Date && !Number.isNaN(cell.getTime())) {
        const f = formats || DEFAULT_FORMATS;
        const hasTime = cell.getHours() !== 0 || cell.getMinutes() !== 0 || cell.getSeconds() !== 0;
        const display = hasTime
            ? formatDateWithFormat(cell, f.datetimeFormat)
            : formatDateWithFormat(cell, f.dateFormat);
        return { display, cssClass: 'cell-date' };
    }
    const s = String(cell).trim();
    if (s === '') return { display: '(空)', cssClass: 'cell-null' };
    const numMatch = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.exec(s);
    if (numMatch) return { display: s, cssClass: 'cell-num' };
    const f = formats || DEFAULT_FORMATS;
    // 只有看起来像日期/时间的字符串才尝试日期解析，避免大量普通字符串触发昂贵正则与 Date 解析
    if (s.length >= 8 && /^\d/.test(s)) {
        const dateFormatted = tryFormatDate(s, f);
        if (dateFormatted) return { display: dateFormatted, cssClass: 'cell-date' };
    }
    return { display: s, cssClass: '' };
}

/** 使用占位符格式化日期：%Y %m %d %H %i %s */
function formatDateWithFormat(d: Date, formatStr: string): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const sec = String(d.getSeconds()).padStart(2, '0');
    return formatStr
        .replace(/%Y/g, String(y))
        .replace(/%m/g, m)
        .replace(/%d/g, day)
        .replace(/%H/g, h)
        .replace(/%i/g, min)
        .replace(/%s/g, sec);
}

/** 尝试识别并格式化日期/时间字符串，使用配置的格式 */
function tryFormatDate(s: string, formats: QueryResultDateFormats): string | null {
    const trimmed = s.trim();
    if (trimmed.length < 8) return null;
    const iso = /^(\d{4})-(\d{2})-(\d{2})([T ](\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/i.exec(trimmed);
    if (iso) {
        const [, y, m, d, , h, min, sec] = iso;
        const month = parseInt(m!, 10) - 1;
        const date = new Date(parseInt(y!, 10), month, parseInt(d!, 10),
            h !== undefined ? parseInt(h, 10) : 0,
            min !== undefined ? parseInt(min, 10) : 0,
            sec !== undefined ? parseInt(sec, 10) : 0);
        if (h !== undefined) {
            return formatDateWithFormat(date, formats.datetimeFormat);
        }
        return formatDateWithFormat(date, formats.dateFormat);
    }
    const onlyTime = /^(\d{2}):(\d{2}):(\d{2})(\.\d+)?$/.exec(trimmed);
    if (onlyTime) {
        const [, h, min, sec] = onlyTime;
        const d = new Date(2000, 0, 1, parseInt(h!, 10), parseInt(min!, 10), parseInt(sec!, 10));
        return formatDateWithFormat(d, formats.timeFormat);
    }
    // 兜底：解析 JS Date.toString() 等格式，如 "Wed Feb 11 2026 09:26:34 GMT+0800 (中国标准时间)"
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
        const hasTime = parsed.getHours() !== 0 || parsed.getMinutes() !== 0 || parsed.getSeconds() !== 0;
        return hasTime
            ? formatDateWithFormat(parsed, formats.datetimeFormat)
            : formatDateWithFormat(parsed, formats.dateFormat);
    }
    return null;
}
