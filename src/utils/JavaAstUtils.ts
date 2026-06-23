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
     * 提取父类名称 (简单名称)，仅 class 的 extends。泛型会擦除，如 Base<T> -> Base。
     */
    public static getParentClassName(content: string): string | null {
        const match = content.match(/class\s+\w+(?:\s*<[^>]+>)?\s+extends\s+([\w.<>, ]+?)(?:\s+implements\s|$)/);
        if (match) {
            const ptr = match[1].trim();
            return ptr.split('<')[0].trim();
        }
        return null;
    }

    /**
     * 解析导入语句以解析类型（含 static import）。
     * 返回 Map<简单名称, 全限定名称>
     */
    public static getImports(content: string): Map<string, string> {
        const imports = new Map<string, string>();
        const lines = content.split('\n');
        // 普通 import: import pkg.Type; 或 import pkg.Type.*;
        const importRegex = /import\s+(?:static\s+)?([\w.]+)(?:\.\*)?\s*;/;

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
     * 从完整类型字符串中取出简单类型名（擦除泛型、数组），用于解析与展示。
     * 例如: List<User> -> List, Map<String,Object> -> Map, String[] -> String
     */
    public static getSimpleTypeName(typeStr: string): string {
        if (!typeStr || !typeStr.trim()) return typeStr;
        const t = typeStr.trim();
        const genericStart = t.indexOf('<');
        const arrayStart = t.indexOf('[');
        let end = t.length;
        if (genericStart >= 0 && (arrayStart < 0 || genericStart < arrayStart)) end = genericStart;
        else if (arrayStart >= 0) end = arrayStart;
        return t.slice(0, end).trim();
    }

    /**
     * 从完整类型字符串中取出“主”类型简单名（用于 resultType 等解析）。
     * 例如: List<User> -> User, Optional<Order> -> Order
     */
    public static getFirstGenericTypeName(typeStr: string): string | null {
        const t = typeStr.trim();
        const m = t.match(/<([^<>]+)>/);
        if (!m) return null;
        const inner = m[1].trim();
        const comma = inner.indexOf(',');
        const first = comma >= 0 ? inner.slice(0, comma).trim() : inner;
        return this.getSimpleTypeName(first);
    }

    /**
     * 从 DTO/Entity 类中提取字段及其文档。
     */
    public static getFields(content: string): Map<string, FieldInfo> {
        const fields = new Map<string, FieldInfo>();
        const lines = content.split('\n');

        let docBuffer: string[] = [];
        let inBlockComment = false;

        // 字段声明模式: [access] [static] [final] Type name; 支持泛型类型如 List<OrderItem>
        const fieldRegex = /^\s*(?:private|protected|public)\s+(?:static\s+|final\s+)*(.+)\s+(\w+)\s*(?:=.*)?;$/;

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
                const type = match[1].trim();
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

        // 单行完整方法签名：返回值 方法名(参数列表)
        const methodPattern = /^\s*(?:public\s+|abstract\s+)?(?:[\w<>,\[\]]+\s+)+(\w+)\s*\((.*)\)\s*;?\s*$/;
        // 多行方法签名起始：返回值 方法名( 且本行未以 ); 结束
        const methodStartPattern = /^\s*(?:public\s+|abstract\s+)?(?:[\w<>,\[\]]+\s+)+(\w+)\s*\(/;

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

            // 2. Method Match（单行完整签名）
            const match = lines[i].match(methodPattern);
            if (match) {
                const methodName = match[1];
                const paramsStr = match[2];
                const returnType = this.extractReturnType(lines[i], methodName);
                const methodInfo: MethodInfo = {
                    line: i,
                    params: this.parseParams(paramsStr),
                    paramDocs: currentParamDocs,
                    javaDoc: javaDocBuffer.length > 0 ? javaDocBuffer.join('\n') : undefined,
                    returnType: returnType ?? undefined
                };

                methods.set(methodName, methodInfo);
                javaDocBuffer = [];
                currentParamDocs = new Map();
                continue;
            }

            // 3. 多行方法签名：本行以 方法名( 结尾且未出现 );，继续收集直到 );
            const startMatch = lines[i].match(methodStartPattern);
            if (startMatch && !/\)\s*;?\s*$/.test(line)) {
                const methodName = startMatch[1];
                const collected: string[] = [lines[i]];
                let j = i + 1;
                for (; j < lines.length; j++) {
                    collected.push(lines[j]);
                    if (/\)\s*;?\s*$/.test(lines[j].trim())) break;
                }
                // 未找到闭合括号：跳过该签名，避免将文件剩余内容拼接成巨型字符串
                if (j >= lines.length) {
                    i = j;
                    continue;
                }
                const fullSignature = collected.join(' ');
                const paramsStr = this.extractParamsFromSignature(fullSignature);
                if (paramsStr !== null) {
                    const returnType = this.extractReturnType(lines[i], methodName);
                    const methodInfo: MethodInfo = {
                        line: i,
                        params: this.parseParams(paramsStr),
                        paramDocs: currentParamDocs,
                        javaDoc: javaDocBuffer.length > 0 ? javaDocBuffer.join('\n') : undefined,
                        returnType: returnType ?? undefined
                    };
                    methods.set(methodName, methodInfo);
                    javaDocBuffer = [];
                    currentParamDocs = new Map();
                }
                i = j;
                continue;
            }

            if (!line.startsWith('@')) {
                javaDocBuffer = [];
                currentParamDocs = new Map();
            }
        }
        return methods;
    }

    /**
     * 从完整方法签名字符串中提取括号内的参数部分（支持嵌套括号，如泛型）。
     */
    private static extractParamsFromSignature(fullSignature: string): string | null {
        const open = fullSignature.indexOf('(');
        if (open < 0) return null;
        let depth = 0;
        for (let k = open; k < fullSignature.length; k++) {
            const c = fullSignature[k];
            if (c === '(') depth++;
            else if (c === ')') {
                depth--;
                if (depth === 0) return fullSignature.slice(open + 1, k).trim();
            }
        }
        return null;
    }

    /**
     * 从方法签名行提取返回值类型（支持泛型，如 List<User>、Map<String,Object>）。
     */
    private static extractReturnType(signatureLine: string, methodName: string): string | null {
        const idx = signatureLine.indexOf(methodName);
        if (idx <= 0) return null;
        let prefix = signatureLine.slice(0, idx).trim();
        // 去掉 public / abstract 等修饰
        prefix = prefix.replace(/^\s*(?:public|protected|private|abstract|static|final|default)\s+/g, '').trim();
        if (!prefix) return null;
        return prefix;
    }

    private static parseParams(paramsStr: string): Map<string, string> {
        const params = new Map<string, string>();
        if (!paramsStr || !paramsStr.trim()) return params;

        // 按逗号分割时需考虑泛型内的逗号，简单按顶层逗号分割
        const parts = this.splitParams(paramsStr);

        for (const part of parts) {
            const cleanPart = part.replace(/@\w+(?:\("[^"]*"\))?/g, '').trim(); // 移除注解
            const tokens = cleanPart.split(/\s+/);
            if (tokens.length >= 2) {
                const name = tokens[tokens.length - 1];
                const type = tokens.slice(0, tokens.length - 1).join(' ').trim();
                params.set(name, type);
            }
        }
        return params;
    }

    /** 按参数列表逗号分割，避免把 Map<K,V> 中的逗号拆开。 */
    private static splitParams(paramsStr: string): string[] {
        const result: string[] = [];
        let depth = 0;
        let start = 0;
        for (let i = 0; i < paramsStr.length; i++) {
            const c = paramsStr[i];
            if (c === '<' || c === '(' || c === '[') depth++;
            else if (c === '>' || c === ')' || c === ']') depth--;
            else if (c === ',' && depth === 0) {
                result.push(paramsStr.slice(start, i));
                start = i + 1;
            }
        }
        if (start < paramsStr.length) result.push(paramsStr.slice(start));
        return result;
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