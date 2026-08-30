export type BatchLoadFn<K, V> = (keys: readonly K[]) => Promise<readonly V[]>;

export class DataLoader<K, V> {
  readonly #cache = new Map<K, Promise<V>>();
  #queue: Array<{ key: K; resolve(value: V): void; reject(error: unknown): void }> = [];
  #scheduled = false;

  constructor(readonly batchLoad: BatchLoadFn<K, V>, readonly cacheEnabled = true) {}

  load(key: K): Promise<V> {
    const cached = this.#cache.get(key);
    if (cached) return cached;
    const promise = new Promise<V>((resolve, reject) => {
      this.#queue.push({ key, resolve, reject });
      if (!this.#scheduled) {
        this.#scheduled = true;
        queueMicrotask(() => void this.#dispatch());
      }
    });
    if (this.cacheEnabled) this.#cache.set(key, promise);
    return promise;
  }

  loadMany(keys: readonly K[]): Promise<V[]> { return Promise.all(keys.map((key) => this.load(key))); }
  clear(key: K): this { this.#cache.delete(key); return this; }
  clearAll(): this { this.#cache.clear(); return this; }
  prime(key: K, value: V): this {
    if (!this.#cache.has(key)) this.#cache.set(key, Promise.resolve(value));
    return this;
  }

  async #dispatch(): Promise<void> {
    this.#scheduled = false;
    const batch = this.#queue;
    this.#queue = [];
    const keys = batch.map((entry) => entry.key);
    try {
      const values = await this.batchLoad(keys);
      if (values.length !== keys.length) throw new Error(`Batch loader returned ${values.length} values for ${keys.length} keys`);
      values.forEach((value, index) => batch[index]!.resolve(value));
    } catch (error) {
      for (const entry of batch) { if (this.cacheEnabled) this.#cache.delete(entry.key); entry.reject(error); }
    }
  }
}
