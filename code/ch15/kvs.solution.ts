import net, { type Server } from 'node:net';

export type StoredValue = { value: string; expiresAt?: number };

export class KeyValueStore {
  private readonly values = new Map<string, StoredValue>();

  set(key: string, value: string, ttlSeconds?: number): void {
    const entry: StoredValue = ttlSeconds === undefined
      ? { value }
      : { value, expiresAt: Date.now() + ttlSeconds * 1000 };
    this.values.set(key, entry);
  }

  get(key: string): string | undefined {
    const entry = this.values.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
      this.values.delete(key);
      return undefined;
    }
    return entry.value;
  }

  delete(key: string): boolean { return this.values.delete(key); }
  expire(key: string, ttlSeconds: number): boolean {
    const value = this.get(key);
    if (value === undefined) return false;
    this.values.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    return true;
  }
  size(): number { for (const key of this.values.keys()) this.get(key); return this.values.size; }
}

export function executeCommand(store: KeyValueStore, line: string): string {
  const parts = line.trim().match(/"(?:\\.|[^"\\])*"|\S+/g)?.map((part) =>
    part.startsWith('"') ? JSON.parse(part) as string : part,
  ) ?? [];
  const [rawCommand, ...args] = parts;
  const command = rawCommand?.toUpperCase();
  switch (command) {
    case 'PING': return '+PONG';
    case 'SET': {
      const [key, value, option, ttl] = args;
      if (!key || value === undefined) return '-ERR usage: SET key value [EX seconds]';
      if (option?.toUpperCase() === 'EX') {
        const seconds = Number(ttl);
        if (!Number.isFinite(seconds) || seconds <= 0) return '-ERR invalid expire time';
        store.set(key, value, seconds);
      } else store.set(key, value);
      return '+OK';
    }
    case 'GET': {
      const key = args[0];
      if (!key) return '-ERR usage: GET key';
      const value = store.get(key);
      return value === undefined ? '$-1' : `$${Buffer.byteLength(value)}\r\n${value}`;
    }
    case 'DEL': {
      const key = args[0];
      if (!key) return '-ERR usage: DEL key';
      return `:${store.delete(key) ? 1 : 0}`;
    }
    case 'EXPIRE': {
      const [key, rawSeconds] = args;
      const seconds = Number(rawSeconds);
      if (!key || !Number.isFinite(seconds) || seconds <= 0) return '-ERR usage: EXPIRE key seconds';
      return `:${store.expire(key, seconds) ? 1 : 0}`;
    }
    case 'DBSIZE': return `:${store.size()}`;
    default: return '-ERR unknown command';
  }
}

export function createKvsServer(store = new KeyValueStore()): Server {
  return net.createServer((socket) => {
    socket.setEncoding('utf8');
    let pending = '';
    socket.on('data', (chunk) => {
      pending += chunk;
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() ?? '';
      for (const line of lines) {
        if (line.trim()) socket.write(`${executeCommand(store, line)}\r\n`);
      }
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 6379);
  createKvsServer().listen(port, '127.0.0.1', () => {
    console.log(`mini-kvs listening on 127.0.0.1:${port}`);
  });
}
