/**
 * A simple LRU (Least Recently Used) cache backed by a Map.
 *
 * When the cache exceeds `maxSize`, the least-recently-used entries are evicted.
 * "Use" means either `set()` or `get()` — both promote the key to most-recent.
 *
 * Drop-in replacement for `new Map<K, V>()` with a size limit.
 *
 * An optional byte budget evicts on total size as well as count. Frame caches
 * need it: one entry is anywhere from 0.3 MB (a 2 km Iceland grid) to 4 MB
 * (ICON-EU, ECMWF), so a count alone let 50 frames hold 200 MB per cache.
 * The newest entry is always kept, even if it alone exceeds the budget.
 */
export interface LRUMapByteBudget<V> {
  maxBytes: number;
  sizeOf: (value: V) => number;
}

export class LRUMap<K, V> {
  private readonly map = new Map<K, V>();
  private readonly bytes = new Map<K, number>();
  private totalBytes = 0;
  readonly maxSize: number;
  private readonly budget: LRUMapByteBudget<V> | null;

  constructor(maxSize: number, budget?: LRUMapByteBudget<V>) {
    if (maxSize < 1) throw new RangeError("LRUMap maxSize must be >= 1");
    this.maxSize = maxSize;
    this.budget = budget ?? null;
  }

  /** Total of `sizeOf` over the entries held (0 without a byte budget). */
  get byteSize(): number {
    return this.totalBytes;
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
      this.delete(key);
    }
    this.map.set(key, value);
    if (this.budget) {
      const size = this.budget.sizeOf(value);
      this.bytes.set(key, size);
      this.totalBytes += size;
    }
    // Evict oldest entries if over capacity
    while (
      this.map.size > this.maxSize ||
      (this.budget !== null &&
        this.totalBytes > this.budget.maxBytes &&
        this.map.size > 1)
    ) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.delete(oldest);
    }
    return this;
  }

  delete(key: K): boolean {
    this.totalBytes -= this.bytes.get(key) ?? 0;
    this.bytes.delete(key);
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
    this.bytes.clear();
    this.totalBytes = 0;
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
