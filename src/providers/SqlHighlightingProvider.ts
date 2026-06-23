import * as vscode from 'vscode';
import { DatabaseService } from '../services/DatabaseService';
import { getDefaultDatabaseType } from '../config';
import { MAX_HIGHLIGHT_FILE_SIZE_BYTES } from '../constants';
import { DialectFactory } from '../services/dialects/DialectFactory';
import { Dialect } from '../services/dialects/Dialect';
import { tokenize, TokenType, Token } from '../utils/SqlTokenizer';
const TOKEN_TYPES_LEGEND = [
    'keyword', 'function', 'variable', 'string', 'number', 'operator', 'parameter', 'class'
];
const TOKEN_MODIFIERS_LEGEND = [
    'declaration', 'documentation'
];

export const SQL_SEMANTIC_TOKEN_LEGEND = new vscode.SemanticTokensLegend(TOKEN_TYPES_LEGEND, TOKEN_MODIFIERS_LEGEND);

export class SqlHighlightingProvider implements vscode.DocumentSemanticTokensProvider {
    constructor(private dbService: DatabaseService) { }

    async provideDocumentSemanticTokens(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.SemanticTokens> {
        const builder = new vscode.SemanticTokensBuilder(SQL_SEMANTIC_TOKEN_LEGEND);
        const text = document.getText();

        // 超大 XML 跳过语义高亮，避免长时间 tokenize 阻塞扩展宿主
        if (text.length > MAX_HIGHLIGHT_FILE_SIZE_BYTES) {
            return builder.build();
        }

        const dialect = this.getDialect();

        const tokens = tokenize(text, dialect);

        let line = 0;
        let char = 0;
        // 重新计算位置，因为 tokenize 并没有很好地跟踪行/字符？
        // 实际上我在 FormattingProvider 中的 tokenizer 没有跟踪起始索引。
        // 我需要跟踪语义令牌的位置（行、起始字符、长度）。

        // 让我们实现一个位置感知 tokenizer 或将简单 token 映射回去？
        // 如果我们跳过空白或有复杂的 token，映射回去很难。
        // 最好让 tokenizer 跟踪位置。

        let currentOffset = 0;

        for (const t of tokens) {
            // 从 currentOffset 开始在文本中查找 token 的位置
            // 因为我们按顺序 token 化，t.value 对应于文本切片。
            // 但我们需要处理换行符以更新 'line' 和 'char'。

            // 我们可以根据 t.value 内容计算 line/char 增量。
            const lines = t.value.split(/\r\n|\r|\n/);

            // 开始 token 位置
            const startLine = line;
            const startChar = char;

            // 语义令牌是单行的。多行令牌（如注释或块字符串）必须拆分。
            // 如果 token 跨越多行：
            for (let i = 0; i < lines.length; i++) {
                const lineContent = lines[i];
                if (lineContent.length > 0) {
                    // 如果此行部分映射到一种类型，则添加语义令牌
                    const typeIdx = this.getSemanticTypeIndex(t);
                    if (typeIdx !== -1) {
                        // 确保我们不会无意中将 XML prolog/tags 高亮显示为 SQL 关键字？
                        // 我们的 tokenizer 区分 XmlTag 等。
                        // 所以只映射 Keyword/Function/Variable/String
                        builder.push(line + i, (i === 0 ? startChar : 0), lineContent.length, typeIdx, 0);
                    }
                }
            }

            // 更新下一个 token 的位置
            if (lines.length > 1) {
                line += lines.length - 1;
                char = lines[lines.length - 1].length;
            } else {
                char += t.value.length;
            }
            currentOffset += t.value.length;
        }

        return builder.build();
    }

    private getSemanticTypeIndex(token: Token): number {
        switch (token.type) {
            case TokenType.Keyword: return TOKEN_TYPES_LEGEND.indexOf('keyword');
            case TokenType.Function: return TOKEN_TYPES_LEGEND.indexOf('function');
            case TokenType.Variable: return TOKEN_TYPES_LEGEND.indexOf('variable'); // #{...}
            case TokenType.String: return TOKEN_TYPES_LEGEND.indexOf('string');
            case TokenType.Identifier:
                if (token.isTable) return TOKEN_TYPES_LEGEND.indexOf('class');
                return -1;
            // case TokenType.Operator: return TOKEN_TYPES_LEGEND.indexOf('operator'); // 通常由语法着色
            // Identifier? 可能是 'variable' 或默认？留给标准语法。
            default: return -1;
        }
    }

    private getDialect(): Dialect {
        const activeType = this.dbService.getActiveDatabaseType();
        if (activeType) {
            return DialectFactory.getDialect(activeType);
        }
        return DialectFactory.getDialect(getDefaultDatabaseType());
    }
}
