import * as vscode from 'vscode';

/**
 * Represents a Java Interface (Mapper) defined in the codebase.
 */
export interface JavaInterface {
    name: string; // Simple name, e.g., "UserMapper"
    fullName: string; // Fully qualified name
    fileUri: vscode.Uri;
    methods: Map<string, MethodInfo>; // Method Name -> Metadata
    imports: Map<string, string>; // SimpleName -> FullName (for resolving parameter types)
}

/**
 * Represents a Java Class (DTO/Entity).
 */
export interface JavaClass {
    name: string; // Simple name
    fullName: string; // Fully qualified name
    fileUri: vscode.Uri;
    fields: Map<string, FieldInfo>; // Field Name -> Info
    parentClassName?: string; // Simple Name of parent class
    imports: Map<string, string>; // Imports for resolving parent class
}

export interface FieldInfo {
    name: string;
    type: string; // Simple type name
    doc?: string; // Field documentation
    line: number; // 0-based
}

export interface MethodInfo {
    line: number; // 0-based
    params: Map<string, string>; // Param Name -> Type (Simple Name)
    paramDocs: Map<string, string>; // Param Name -> Description (from @param)
    javaDoc?: string; // Main method description
    returnType?: string;
}

/**
 * Represents a MyBatis XML Mapper file.
 */
export interface MapperXml {
    namespace: string; // The namespace attribute
    fileUri: vscode.Uri;
    statements: Map<string, StatementInfo>; // ID -> Info
    resultMaps: Map<string, ResultMapInfo>; // ID -> Info
}

export interface StatementInfo {
    id: string;
    line: number; // Line number where <select|insert|etc> starts
    type: 'select' | 'insert' | 'update' | 'delete';
    resultMap?: string; // The ID of the resultMap used
}

export interface ResultMapInfo {
    id: string;
    line: number;
    type: string; // The Java type it maps to
}

export interface ConnectionConfig {
    id: string;
    name: string;
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