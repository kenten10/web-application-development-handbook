export type IsolationLevel = 'read committed' | 'repeatable read' | 'serializable';
interface VersionedValue { version: number; value: number; }

export class AccountDatabase {
  #version = 0; readonly #history = new Map<number, VersionedValue[]>();
  constructor(initial: Record<number, number>) { for (const [id, value] of Object.entries(initial)) this.#history.set(Number(id), [{ version: 0, value }]); }
  begin(level: IsolationLevel): Transaction { return new Transaction(this, level, this.#version); }
  currentVersion(): number { return this.#version; }
  read(id: number, atVersion = this.#version): number { const history = this.#history.get(id); if (!history) throw new Error(`Unknown account ${id}`); return [...history].reverse().find((entry) => entry.version <= atVersion)!.value; }
  commit(writes: Map<number, number>, snapshotVersion: number, serializable: boolean): number {
    if (serializable) for (const id of writes.keys()) if ((this.#history.get(id)?.at(-1)?.version ?? 0) > snapshotVersion) throw new Error('Serialization failure');
    this.#version += 1; for (const [id, value] of writes) this.#history.get(id)!.push({ version: this.#version, value }); return this.#version;
  }
}

export class Transaction {
  readonly #writes = new Map<number, number>(); #closed = false;
  constructor(readonly db: AccountDatabase, readonly level: IsolationLevel, readonly snapshotVersion: number) {}
  read(id: number): number { this.#assertOpen(); if (this.#writes.has(id)) return this.#writes.get(id)!; const version = this.level === 'read committed' ? this.db.currentVersion() : this.snapshotVersion; return this.db.read(id, version); }
  write(id: number, value: number): void { this.#assertOpen(); this.#writes.set(id, value); }
  commit(): number { this.#assertOpen(); this.#closed = true; return this.db.commit(this.#writes, this.snapshotVersion, this.level === 'serializable'); }
  rollback(): void { this.#closed = true; this.#writes.clear(); }
  #assertOpen(): void { if (this.#closed) throw new Error('Transaction is closed'); }
}

export function demonstrateNonRepeatableRead(level: IsolationLevel): [number, number] {
  const db = new AccountDatabase({ 1: 100 }); const first = db.begin(level); const before = first.read(1); const second = db.begin('read committed'); second.write(1, 999); second.commit(); const after = first.read(1); first.rollback(); return [before, after];
}
