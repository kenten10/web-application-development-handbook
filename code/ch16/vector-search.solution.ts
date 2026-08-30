export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || a.length === 0) throw new Error('vectors must have the same non-zero dimension');
  let dot = 0; let aa = 0; let bb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i]! * b[i]!; aa += a[i]! ** 2; bb += b[i]! ** 2; }
  return aa === 0 || bb === 0 ? 0 : dot / Math.sqrt(aa * bb);
}

type Item<T> = { id: number; vector: number[]; metadata: T };
export class VectorStore<T = Record<string, unknown>> {
  private readonly items = new Map<number, Item<T>>();
  constructor(readonly dimensions: number) { if (dimensions <= 0) throw new Error('dimensions must be positive'); }
  add(id: number, vector: readonly number[], metadata: T): void {
    if (vector.length !== this.dimensions) throw new Error(`expected ${this.dimensions} dimensions`);
    this.items.set(id, { id, vector: [...vector], metadata });
  }
  search(query: readonly number[], limit = 5): Array<{ id: number; score: number; metadata: T }> {
    if (query.length !== this.dimensions) throw new Error(`expected ${this.dimensions} dimensions`);
    return [...this.items.values()].map((item) => ({ id: item.id, score: cosineSimilarity(query, item.vector), metadata: item.metadata }))
      .sort((a, b) => b.score - a.score || a.id - b.id).slice(0, limit);
  }
}
