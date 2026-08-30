export type ClusterMode = 'AP' | 'CP';
type VersionedValue = { value: string; clock: number; nodeId: string };

export class MockCluster {
  private readonly stores = new Map<string, Map<string, VersionedValue>>();
  private groups: string[][];
  private clock = 0;
  constructor(readonly nodeIds: string[], readonly options: { mode: ClusterMode }) {
    if (nodeIds.length < 3) throw new Error('use at least three nodes');
    for (const id of nodeIds) this.stores.set(id, new Map());
    this.groups = [nodeIds.slice()];
  }
  partition(...groups: string[][]): void {
    const flattened = groups.flat();
    if (new Set(flattened).size !== this.nodeIds.length) throw new Error('partition must include every node once');
    this.groups = groups.map((group) => group.slice());
  }
  private groupOf(nodeId: string): string[] { return this.groups.find((group) => group.includes(nodeId)) ?? []; }
  set(nodeId: string, key: string, value: string): boolean {
    const group = this.groupOf(nodeId);
    if (this.options.mode === 'CP' && group.length <= Math.floor(this.nodeIds.length / 2)) return false;
    const version = { value, clock: ++this.clock, nodeId };
    for (const id of group) this.stores.get(id)!.set(key, version);
    return true;
  }
  get(nodeId: string, key: string): string | undefined { return this.stores.get(nodeId)?.get(key)?.value; }
  heal(): void {
    const keys = new Set<string>();
    for (const store of this.stores.values()) for (const key of store.keys()) keys.add(key);
    for (const key of keys) {
      const candidates = [...this.stores.values()].map((store) => store.get(key)).filter((v): v is VersionedValue => Boolean(v));
      candidates.sort((a, b) => a.clock - b.clock || a.nodeId.localeCompare(b.nodeId));
      const winner = candidates.at(-1);
      if (winner) for (const store of this.stores.values()) store.set(key, winner);
    }
    this.groups = [this.nodeIds.slice()];
  }
}
