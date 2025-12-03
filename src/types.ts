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
}

export interface FieldInfo {
    name: string;
    type: string; // Simple type name
    doc?: string; // Field documentation
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
}

export interface StatementInfo {
    id: string;
    line: number; // Line number where <select|insert|etc> starts
    type: 'select' | 'insert' | 'update' | 'delete';
}

export interface IndexUpdateEvent {
    uri: vscode.Uri;
}