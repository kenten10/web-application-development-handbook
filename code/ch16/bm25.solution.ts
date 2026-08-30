import { tokenize } from './inverted-index.solution.js';

export class BM25Scorer {
  private readonly docs = new Map<number, string[]>();
  private readonly documentFrequency = new Map<string, number>();
  readonly k1: number; readonly b: number;
  constructor(options: { k1?: number; b?: number } = {}) { this.k1 = options.k1 ?? 1.5; this.b = options.b ?? 0.75; }
  indexDocument(docId: number, text: string): void {
    if (this.docs.has(docId)) this.rebuildWithout(docId);
    const tokens = tokenize(text); this.docs.set(docId, tokens);
    for (const term of new Set(tokens)) this.documentFrequency.set(term, (this.documentFrequency.get(term) ?? 0) + 1);
  }
  private rebuildWithout(docId: number): void {
    this.docs.delete(docId); this.documentFrequency.clear();
    for (const tokens of this.docs.values()) for (const term of new Set(tokens)) this.documentFrequency.set(term, (this.documentFrequency.get(term) ?? 0) + 1);
  }
  search(query: string, limit = 10): Array<{ docId: number; score: number }> {
    const terms = tokenize(query); const n = this.docs.size;
    const avgLength = [...this.docs.values()].reduce((sum, t) => sum + t.length, 0) / Math.max(1, n);
    const scores: Array<{ docId: number; score: number }> = [];
    for (const [docId, tokens] of this.docs) {
      let score = 0;
      for (const term of terms) {
        const tf = tokens.filter((token) => token === term).length; if (tf === 0) continue;
        const df = this.documentFrequency.get(term) ?? 0;
        const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
        score += idf * (tf * (this.k1 + 1)) / (tf + this.k1 * (1 - this.b + this.b * tokens.length / avgLength));
      }
      if (score > 0) scores.push({ docId, score });
    }
    return scores.sort((a, b) => b.score - a.score || a.docId - b.docId).slice(0, limit);
  }
}
