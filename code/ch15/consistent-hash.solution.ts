import { createHash } from 'node:crypto';

type Point<T> = { hash: number; node: T };
export class ConsistentHashRing<T extends string> {
  private readonly points: Point<T>[] = [];
  private readonly nodes = new Set<T>();
  readonly virtualNodes: number;
  constructor(options: { virtualNodes?: number } = {}) { this.virtualNodes = options.virtualNodes ?? 128; }
  private hash(value: string): number { return createHash('sha256').update(value).digest().readUInt32BE(0); }
  addNode(node: T): void {
    if (this.nodes.has(node)) return;
    this.nodes.add(node);
    for (let replica = 0; replica < this.virtualNodes; replica++) this.points.push({ hash: this.hash(`${node}#${replica}`), node });
    this.points.sort((a, b) => a.hash - b.hash);
  }
  removeNode(node: T): void {
    this.nodes.delete(node);
    for (let i = this.points.length - 1; i >= 0; i--) if (this.points[i]!.node === node) this.points.splice(i, 1);
  }
  getNode(key: string): T {
    if (this.points.length === 0) throw new Error('ring has no nodes');
    const hash = this.hash(key);
    let low = 0; let high = this.points.length;
    while (low < high) { const mid = (low + high) >>> 1; if (this.points[mid]!.hash < hash) low = mid + 1; else high = mid; }
    return this.points[low === this.points.length ? 0 : low]!.node;
  }
  distribution(keys: Iterable<string>): Map<T, number> {
    const counts = new Map<T, number>();
    for (const key of keys) { const node = this.getNode(key); counts.set(node, (counts.get(node) ?? 0) + 1); }
    return counts;
  }
}
