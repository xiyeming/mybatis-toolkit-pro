export interface Dialect {
    /**
     * 获取数据库类型名称
     */
    getType(): string;

    /**
     * 获取用于引用标识符的字符 (例如 MySQL 为 `, PostgreSQL 为 ")
     */
    getQuoteChar(): string;

    /**
     * 检查单词是否为此方言的关键字
     */
    isKeyword(word: string): boolean;

    /**
     * 获取此方言的所有关键字
     */
    getKeywords(): string[];

    /**
     * 获取此方言的所有函数
     */
    getFunctions(): string[];
}
