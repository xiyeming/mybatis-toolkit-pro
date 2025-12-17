import * as vscode from 'vscode';

/**
 * 表示代码库中定义的 Java 接口 (Mapper)。
 */
export interface JavaInterface {
    name: string; // 简单名称, 例如 "UserMapper"
    fullName: string; // 全限定名
    fileUri: vscode.Uri;
    methods: Map<string, MethodInfo>; // 方法名 -> 元数据
    imports: Map<string, string>; // 简单名称 -> 全称 (用于解析参数类型)
}

/**
 * 表示一个 Java 类 (DTO/Entity)。
 */
export interface JavaClass {
    name: string; // 简单名称
    fullName: string; // 全限定名
    fileUri: vscode.Uri;
    fields: Map<string, FieldInfo>; // 字段名 -> 信息
    parentClassName?: string; // 父类简单名称
    imports: Map<string, string>; // 用于解析父类的导入
}

export interface FieldInfo {
    name: string;
    type: string; // 简单类型名称
    doc?: string; // 字段文档
    line: number; // 从 0 开始
}

export interface MethodInfo {
    line: number; // 从 0 开始
    params: Map<string, string>; // 参数名 -> 类型 (简单名称)
    paramDocs: Map<string, string>; // 参数名 -> 描述 (来自 @param)
    javaDoc?: string; // 主要方法描述
    returnType?: string;
}

/**
 * 表示一个 MyBatis XML Mapper 文件。
 */
export interface MapperXml {
    namespace: string; // 命名空间属性
    fileUri: vscode.Uri;
    statements: Map<string, StatementInfo>; // ID -> 信息
    resultMaps: Map<string, ResultMapInfo>; // ID -> 信息
}

export interface StatementInfo {
    id: string;
    line: number; // <select|insert|etc> 开始的行号
    type: 'select' | 'insert' | 'update' | 'delete';
    resultMap?: string; // 使用的 resultMap ID
}

export interface ResultMapInfo {
    id: string;
    line: number;
    type: string; // 映射到的 Java 类型
}

export type DatabaseType = 'MySQL' | 'PostgreSQL' | 'Oracle' | 'SQL Server' | 'SQLite' | 'DB2' | 'H2' | 'MariaDB';

export interface ConnectionConfig {
    id: string;
    name: string;
    type: DatabaseType;
    host: string;
    port: number;
    user: string;
    password?: string;
    database: string;
}

export interface ColumnInfo {
    Field: string;
    Type: string;
    Null: string;
    Key: string;
    Default: string | null;
    Extra: string;
    Comment?: string;
}

export interface IndexUpdateEvent {
    uri: vscode.Uri;
}