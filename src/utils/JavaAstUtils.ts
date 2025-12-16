import * as vscode from 'vscode';
import { MethodInfo, FieldInfo } from '../types';

export class JavaAstUtils {

    /**
     * 从 Java 源码中提取简单的类/接口名称。
     */
    public static getSimpleName(content: string): string | null {
        const match = content.match(/(?:public\s+)?(?:class|interface)\s+(\w+)/);
        return match ? match[1] : null;
    }

    /**
     * 提取包名。
     */
    public static getPackageName(content: string): string | null {
        const match = content.match(/package\s+([\w.]+);/);
        return match ? match[1] : null;
    }

    /**
     * 提取父类名称 (简单名称) 如果存在。
     */
    public static getParentClassName(content: string): string | null {
        // 公共类 Foo 继承 Bar 实现 Baz
        const match = content.match(/class\s+\w+(?:\s*<[^>]+>)?\s+extends\s+([\w<>]+)/);
        if (match) {
            const ptr = match[1];
            // 移除泛型（如果有）: Base<T> -> Base
            return ptr.split('<')[0].trim();
        }
        return null;
    }

    /**
     * 解析导入语句以解析类型。
     * 返回 Map<简单名称, 全限定名称>
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
     * 从 DTO/Entity 类中提取字段及其文档。
     */
    public static getFields(content: string): Map<string, FieldInfo> {
        const fields = new Map<string, FieldInfo>();
        const lines = content.split('\n');

        let docBuffer: string[] = [];
        let inBlockComment = false;

        // 字段声明模式: [access] [static] [final] Type name;
        const fieldRegex = /^\s*(?:private|protected|public)\s+(?:static\s+|final\s+)*(.+?)\s+(\w+)\s*(?:=.*)?;$/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // 1. Empty Line Check (Critical for strict association)
            if (line === '') {
                // 如果遇到空行且不在块注释内，
                // 假设之前的注释是用于其他内容的，或者是时候重置了。
                if (!inBlockComment) {
                    docBuffer = [];
                }
                continue;
            }

            // 2. Comment Handling
            if (line.startsWith('/**')) {
                inBlockComment = true;
                docBuffer = []; // 为新块重新开始
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
                // 像 @Serial, @Deprecated 这样的注解不会打断注释链
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

                docBuffer = []; // 赋值后清除
            } else {
                // 如果行是代码但不是字段（例如方法、静态块、公共字段），清除缓冲区
                // 以防止注释漂移到下一个私有字段。
                if (!line.startsWith('private') && !line.startsWith('protected') && !line.startsWith('public')) {
                    // 这是其他代码，重置缓冲区
                    docBuffer = [];
                }
            }
        }

        return fields;
    }

    /**
     * 提取带有元数据 (行号, 参数, javadoc) 的公共方法。
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
                // 严格检查：空行会打断 Javadoc 关联，除非在块内
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
                // 去除星号
                let cleanLine = line.replace(/^\/\*\*?/, '').replace(/\*\/$/, '').replace(/^\*\s?/, '').trim();

                // 检查 @param
                const paramMatch = cleanLine.match(/^@param\s+(\w+)\s+(.*)/);
                if (paramMatch) {
                    currentParamDocs.set(paramMatch[1], paramMatch[2]);
                } else if (cleanLine && !cleanLine.startsWith('@')) {
                    // 主要描述
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
                // 如果我们遇到不是方法也不是注解的代码，清除缓冲区
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
            const cleanPart = part.replace(/@\w+(?:\("[^"]*"\))?/g, '').trim(); // 移除注解
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

    /**
     * 从签名行提取方法名称。
     */
    public static getMethodName(line: string): string | null {
        // 匹配: public ResultType methodName(...)
        // 或接口: ResultType methodName(...)
        const match = line.match(/^\s*(?:public\s+|abstract\s+)?(?:[\w<>,\[\]]+\s+)+(\w+)\s*\(/);
        return match ? match[1] : null;
    }
}