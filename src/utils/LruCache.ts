/**
 * 基于 ES Map 的简单 LRU 缓存，限制条目数量，避免无界增长。
 */
export class LruCache<K, V> {
    private map = new Map<K, V>();

    constructor(private readonly maxSize: number) {
        if (maxSize <= 0) {
            throw new Error('LRU 缓存容量必须大于 0');
        }
    }

    public get(key: K): V | undefined {
        const value = this.map.get(key);
        if (value !== undefined) {
            // 访问后移到末尾（最近使用）
            this.map.delete(key);
            this.map.set(key, value);
        }
        return value;
    }

    public set(key: K, value: V): void {
        if (this.map.has(key)) {
            this.map.delete(key);
        } else if (this.map.size >= this.maxSize) {
            // 淘汰最久未使用
            const firstKey = this.map.keys().next().value;
            if (firstKey !== undefined) {
                this.map.delete(firstKey);
            }
        }
        this.map.set(key, value);
    }

    public has(key: K): boolean {
        return this.map.has(key);
    }

    public clear(): void {
        this.map.clear();
    }

    public size(): number {
        return this.map.size;
    }

    public keys(): IterableIterator<K> {
        return this.map.keys();
    }
}
