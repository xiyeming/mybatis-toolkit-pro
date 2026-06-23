import * as vscode from 'vscode';
import { ConnectionConfig } from './types';
import { INDEX_PARSE_CONCURRENCY, INDEX_DEBOUNCE_MS, VALIDATION_DEBOUNCE_MS } from './constants';

const SECTION = 'mybatisToolkit';

/**
 * 统一配置入口：所有扩展配置均由此读取，便于维护与默认值一致。
 * 设置界面（UI）中的项与此处键一一对应。
 */
export function getConfig(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration(SECTION);
}

// ---------- 数据库与连接 ----------

export function getDefaultDatabaseType(): string {
    return getConfig().get<string>('database.defaultType', 'MySQL');
}

export function getConnections(): ConnectionConfig[] {
    return getConfig().get<ConnectionConfig[]>('connections', []);
}

export function getLegacyDatabaseConfig(): {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
} {
    const cfg = vscode.workspace.getConfiguration(`${SECTION}.database`);
    return {
        host: cfg.get<string>('host', 'localhost'),
        port: cfg.get<number>('port', 3306),
        user: cfg.get<string>('user', 'root'),
        password: cfg.get<string>('password', ''),
        database: cfg.get<string>('database', '')
    };
}

export function getDatabaseConnectionLimit(): number {
    return vscode.workspace.getConfiguration(`${SECTION}.database`).get<number>('connectionLimit', 10);
}

// ---------- 验证 ----------

export function isValidationEnabled(): boolean {
    return vscode.workspace.getConfiguration(`${SECTION}.validation`).get<boolean>('enable', true);
}

// ---------- 导航与索引 ----------

export function getNavigationExclude(): string[] {
    return getConfig().get<string[]>('navigation.exclude', [
        'target', 'build', 'bin', 'out', 'dist', 'node_modules', '.git',
        '.idea', '.vscode', '.settings', '.project', '.classpath', '.factorypath', '.metadata'
    ]);
}

// ---------- 性能（可 UI 配置，缺省用 constants） ----------

export function getIndexParseConcurrency(): number {
    return getConfig().get<number>('performance.indexParseConcurrency', INDEX_PARSE_CONCURRENCY);
}

export function getIndexDebounceMs(): number {
    return getConfig().get<number>('performance.indexDebounceMs', INDEX_DEBOUNCE_MS);
}

export function getValidationDebounceMs(): number {
    return getConfig().get<number>('performance.validationDebounceMs', VALIDATION_DEBOUNCE_MS);
}

// ---------- 格式化 ----------

export function getFormattingIndentSize(): number {
    return getConfig().get<number>('formatting.indentSize', 4);
}

// ---------- 查询结果（日期时间格式） ----------

export interface QueryResultDateFormats {
    datetimeFormat: string;
    dateFormat: string;
    timeFormat: string;
}

export function getQueryResultDateFormats(): QueryResultDateFormats {
    const cfg = getConfig();
    return {
        datetimeFormat: cfg.get<string>('queryResult.datetimeFormat', '%Y-%m-%d %H:%i:%s'),
        dateFormat: cfg.get<string>('queryResult.dateFormat', '%Y-%m-%d'),
        timeFormat: cfg.get<string>('queryResult.timeFormat', '%H:%i:%s')
    };
}

// ---------- 高亮颜色 ----------

export interface HighlightColors {
    tableName: string;
    keyword: string;
    function: string;
    param: string;
}

export function getHighlightColors(): HighlightColors {
    const cfg = getConfig();
    return {
        tableName: cfg.get<string>('highlights.tableNameColor', '#FFAB70'),
        keyword: cfg.get<string>('highlights.keywordColor', '#C586C0'),
        function: cfg.get<string>('highlights.functionColor', '#DCDCAA'),
        param: cfg.get<string>('highlights.paramColor', '#9CDCFE')
    };
}

// ---------- MyBatis-Plus 代码生成（自动填充、逻辑删除，配置持久化后下次生成回显） ----------

export interface MybatisPlusFillField {
    column: string;
    fill: 'INSERT' | 'INSERT_UPDATE';
}

export type MybatisPlusIdType = 'AUTO' | 'ASSIGN_ID' | 'ASSIGN_UUID' | 'INPUT' | 'NONE';

export function getMybatisPlusCodeGenConfig(): {
    fillFields: MybatisPlusFillField[];
    logicDeleteField: string;
    idType: MybatisPlusIdType;
} {
    const cfg = getConfig();
    const fillFields = cfg.get<MybatisPlusFillField[]>('codeGen.mybatisPlus.fillFields', []);
    const logicDeleteField = cfg.get<string>('codeGen.mybatisPlus.logicDeleteField', '');
    const idType = cfg.get<MybatisPlusIdType>('codeGen.mybatisPlus.idType', 'AUTO');
    const validIdTypes: MybatisPlusIdType[] = ['AUTO', 'ASSIGN_ID', 'ASSIGN_UUID', 'INPUT', 'NONE'];
    return {
        fillFields: Array.isArray(fillFields) ? fillFields : [],
        logicDeleteField: logicDeleteField || '',
        idType: validIdTypes.includes(idType) ? idType : 'AUTO'
    };
}

// ---------- 代码生成目录名（Entity / Mapper / XML / Service） ----------

function sanitizeDirName(name: string, defaultVal: string): string {
    const s = (name || '').trim().replace(/[^a-zA-Z0-9_]/g, '');
    return s || defaultVal;
}

export function getCodeGenDirNames(): { entityDirName: string; mapperDirName: string; xmlDirName: string; serviceDirName: string } {
    const cfg = getConfig();
    return {
        entityDirName: sanitizeDirName(cfg.get<string>('codeGen.dirs.entity', 'entity'), 'entity'),
        mapperDirName: sanitizeDirName(cfg.get<string>('codeGen.dirs.mapper', 'mapper'), 'mapper'),
        xmlDirName: sanitizeDirName(cfg.get<string>('codeGen.dirs.xml', 'mapper'), 'mapper'),
        serviceDirName: sanitizeDirName(cfg.get<string>('codeGen.dirs.service', 'service'), 'service')
    };
}
