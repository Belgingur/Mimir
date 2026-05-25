/**
 * A simple LRU (Least Recently Used) cache backed by a Map.
 *
 * When the cache exceeds `maxSize`, the least-recently-used entries are evicted.
 * "Use" means either `set()` or `get()` — both promote the key to most-recent.
 *
 * Drop-in replacement for `new Map<K, V>()` with a size limit.
 */
export class LRUMap<K, V> {
  private readonly map = new Map<K, V>();
  readonly maxSize: number;

  constructor(maxSize: number) {
    if (maxSize < 1) throw new RangeError("LRUMap maxSize must be >= 1");
    this.maxSize = maxSize;
  }

  get size(): number {
    return this.map.size;
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  get(key: K): V | undefined {
    const value = this.map.get(key);
    if (value !== undefined) {
      // Promote to most-recent by re-inserting
      this.map.delete(key);
      this.map.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): this {
    // If key already exists, delete first to refresh insertion order
    if (this.map.has(key)) {
      this.map.delete(key);
    }
    this.map.set(key, value);
    // Evict oldest entries if over capacity
    while (this.map.size > this.maxSize) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) {
        this.map.delete(oldest);
      }
    }
    return this;
  }

  delete(key: K): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  keys(): MapIterator<K> {
    return this.map.keys();
  }

  values(): MapIterator<V> {
    return this.map.values();
  }

  entries(): MapIterator<[K, V]> {
    return this.map.entries();
  }

  forEach(callbackfn: (value: V, key: K, map: Map<K, V>) => void): void {
    this.map.forEach(callbackfn);
  }
}
