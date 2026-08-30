export type QueryKey = readonly unknown[];
export type QueryOptions = { staleTime?: number; gcTime?: number };

type Entry<T> = {
  data?: T;
  error?: unknown;
  updatedAt: number;
  lastUsedAt: number;
  stale: boolean;
  inFlight: Promise<T> | undefined;
  gcTime: number;
};

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(object[key])}`).join(',')}}`;
}

export class QueryCache {
  private entries = new Map<string, Entry<unknown>>();
  constructor(private readonly now: () => number = Date.now) {}

  async fetch<T>(key: QueryKey, fetcher: () => Promise<T>, options: QueryOptions = {}): Promise<T> {
    const serialized = stableSerialize(key);
    const staleTime = options.staleTime ?? 0;
    const gcTime = options.gcTime ?? 5 * 60_000;
    const current = this.entries.get(serialized) as Entry<T> | undefined;
    const time = this.now();

    if (current) {
      current.lastUsedAt = time;
      current.gcTime = gcTime;
      if (current.inFlight) return current.inFlight;
      if (current.data !== undefined && !current.stale && time - current.updatedAt <= staleTime) return current.data;
    }

    const entry: Entry<T> = current ?? { updatedAt: 0, lastUsedAt: time, stale: true, gcTime, inFlight: undefined };
    const request = Promise.resolve().then(fetcher).then(
      (data) => {
        entry.data = data;
        entry.error = undefined;
        entry.updatedAt = this.now();
        entry.lastUsedAt = entry.updatedAt;
        entry.stale = false;
        entry.inFlight = undefined;
        return data;
      },
      (error) => {
        entry.error = error;
        entry.inFlight = undefined;
        throw error;
      },
    );
    entry.inFlight = request;
    entry.gcTime = gcTime;
    this.entries.set(serialized, entry as Entry<unknown>);
    return request;
  }

  get<T>(key: QueryKey): T | undefined {
    const entry = this.entries.get(stableSerialize(key)) as Entry<T> | undefined;
    if (entry) entry.lastUsedAt = this.now();
    return entry?.data;
  }

  invalidate(prefix: QueryKey): void {
    const prefixSerialized = stableSerialize(prefix).slice(0, -1);
    for (const [key, entry] of this.entries) if (key.startsWith(prefixSerialized)) entry.stale = true;
  }

  remove(key: QueryKey): void { this.entries.delete(stableSerialize(key)); }

  collectGarbage(): number {
    const time = this.now();
    let removed = 0;
    for (const [key, entry] of this.entries) {
      if (!entry.inFlight && time - entry.lastUsedAt > entry.gcTime) {
        this.entries.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  inspect(key: QueryKey): Readonly<Entry<unknown>> | undefined {
    return this.entries.get(stableSerialize(key));
  }
}

export const exerciseId = '7.2';
