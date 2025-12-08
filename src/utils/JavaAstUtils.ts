import * as vscode from 'vscode';
import { MethodInfo, FieldInfo } from '../types';

export class JavaAstUtils {

    /**
     * Extracts the simple class/interface name from Java source.
     */
    public static getSimpleName(content: string): string | null {
        const match = content.match(/(?:public\s+)?(?:class|interface)\s+(\w+)/);
        return match ? match[1] : null;
    }

    /**
     * Extracts the package name.
     */
    public static getPackageName(content: string): string | null {
        const match = content.match(/package\s+([\w.]+);/);
        return match ? match[1] : null;
    }

    /**
     * Extracts the parent class name (simple name) if exists.
     */
    public static getParentClassName(content: string): string | null {
        // public class Foo extends Bar implements Baz
        const match = content.match(/class\s+\w+(?:\s*<[^>]+>)?\s+extends\s+([\w<>]+)/);
        if (match) {
            const ptr = match[1];
            // Remove generics if any: Base<T> -> Base
            return ptr.split('<')[0].trim();
        }
        return null;
    }

    /**
     * Parses import statements to resolve types.
     * Returns Map<SimpleName, FullQualifiedName>
     */
    public static getImports(content: string): Map<string, string> {
        const imports = new Map<string, string>();
        const lines = content.split('\n');
        const importRegex = /import\s+([\w.]+);/;

        for (const line of lines) {
            const match = line.match(importRegex);
            if (match) {
                const full = match[1];
                const parts = full.split('.');
                const simple = parts[parts.length - 1];
                imports.set(simple, full);
            }
        }
        return imports;
    }

    /**
     * Extracts fields from a DTO/Entity class with their documentation.
     */
    public static getFields(content: string): Map<string, FieldInfo> {
        const fields = new Map<string, FieldInfo>();
        const lines = content.split('\n');

        let docBuffer: string[] = [];
        let inBlockComment = false;

        // Pattern for field declaration: [access] [static] [final] Type name;
        const fieldRegex = /^\s*(?:private|protected|public)\s+(?:static\s+|final\s+)*([\w<>\[\]]+)\s+(\w+)\s*(?:=.*)?;$/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // 1. Empty Line Check (Critical for strict association)
            if (line === '') {
                // If we encounter an empty line and we are NOT inside a block comment,
                // assume the previous comments were for something else or we should reset.
                if (!inBlockComment) {
                    docBuffer = [];
                }
                continue;
            }

            // 2. Comment Handling
            if (line.startsWith('/**')) {
                inBlockComment = true;
                docBuffer = []; // Start fresh for new block
            }
            if (inBlockComment) {
                const clean = line.replace(/^\/\*\*?/, '').replace(/\*\/$/, '').replace(/^\*\s?/, '');
                if (clean.trim()) docBuffer.push(clean.trim());
                if (line.endsWith('*/')) {
                    inBlockComment = false;
                }
                continue;
            }
            if (line.startsWith('//')) {
                const clean = line.replace(/^\/\/\s*/, '').trim();
                if (clean) docBuffer.push(clean);
                continue;
            }
            if (line.startsWith('@')) {
                // Annotations like @Serial, @Deprecated don't break the comment chain
                continue;
            }

            // 3. Field Match
            const match = line.match(fieldRegex);
            if (match) {
                const type = match[1];
                const name = match[2];

                fields.set(name, {
                    name,
                    type,
                    doc: docBuffer.length > 0 ? docBuffer.join('\n') : undefined,
                    line: i
                });

                docBuffer = []; // Clear after assignment
            } else {
                // If line is code but not a field (e.g. method, static block, public field), clear buffer
                // to prevent comments from floating down to the next private field.
                if (!line.startsWith('private') && !line.startsWith('protected') && !line.startsWith('public')) {
                    // It's some other code, reset buffer
                    docBuffer = [];
                }
            }
        }

        return fields;
    }

    /**
     * Extracts public methods with metadata (line, params, javadoc).
     */
    public static getMethods(content: string): Map<string, MethodInfo> {
        const methods = new Map<string, MethodInfo>();
        const lines = content.split('\n');

        let javaDocBuffer: string[] = [];
        let capturingJavaDoc = false;
        let currentParamDocs = new Map<string, string>();

        const methodPattern = /^\s*(?:public\s+|abstract\s+)?(?:[\w<>,\[\]]+\s+)+(\w+)\s*\((.*)\)/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (line === '') {
                // Strict check: empty lines break the javadoc association unless inside block
                if (!capturingJavaDoc) {
                    javaDocBuffer = [];
                    currentParamDocs = new Map();
                }
                continue;
            }

            // 1. JavaDoc Capture
            if (line.startsWith('/**')) {
                capturingJavaDoc = true;
                javaDocBuffer = [];
                currentParamDocs = new Map<string, string>();
            }
            if (capturingJavaDoc) {
                // Strip stars
                let cleanLine = line.replace(/^\/\*\*?/, '').replace(/\*\/$/, '').replace(/^\*\s?/, '').trim();

                // Check for @param
                const paramMatch = cleanLine.match(/^@param\s+(\w+)\s+(.*)/);
                if (paramMatch) {
                    currentParamDocs.set(paramMatch[1], paramMatch[2]);
                } else if (cleanLine && !cleanLine.startsWith('@')) {
                    // Main description
                    javaDocBuffer.push(cleanLine);
                }

                if (line.endsWith('*/')) {
                    capturingJavaDoc = false;
                }
                continue;
            }

            if (line.startsWith('//') || line.startsWith('*')) continue;
            if (line.startsWith('@')) continue;

            // 2. Method Match
            const match = lines[i].match(methodPattern);
            if (match) {
                const methodName = match[1];
                const paramsStr = match[2];
                const methodInfo: MethodInfo = {
                    line: i,
                    params: this.parseParams(paramsStr),
                    paramDocs: currentParamDocs,
                    javaDoc: javaDocBuffer.length > 0 ? javaDocBuffer.join('\n') : undefined
                };

                methods.set(methodName, methodInfo);
                javaDocBuffer = [];
                currentParamDocs = new Map();
            } else if (!line.startsWith('@')) {
                // If we hit code that isn't a method and isn't annotation, clear buffers
                javaDocBuffer = [];
                currentParamDocs = new Map();
            }
        }
        return methods;
    }

    private static parseParams(paramsStr: string): Map<string, string> {
        const params = new Map<string, string>();
        if (!paramsStr || !paramsStr.trim()) return params;

        const parts = paramsStr.split(',');

        for (const part of parts) {
            const cleanPart = part.replace(/@\w+(?:\("[^"]*"\))?/g, '').trim(); // Remove annotations
            const tokens = cleanPart.split(/\s+/);
            if (tokens.length >= 2) {
                const name = tokens[tokens.length - 1];
                const type = tokens.slice(0, tokens.length - 1).join(' ');
                params.set(name, type);
            }
        }
        return params;
    }

    public static normalizePath(fsPath: string): string {
        return fsPath.replace(/\\/g, '/').toLowerCase();
    }
}