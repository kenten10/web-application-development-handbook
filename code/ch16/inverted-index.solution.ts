export type Posting = { docId: number; positions: number[] };

export function tokenize(text: string): string[] {
  return text.toLowerCase().normalize('NFKC').match(/[\p{L}\p{N}]+/gu) ?? [];
}

export class InvertedIndex {
  private readonly postings = new Map<string, Map<number, number[]>>();
  private readonly documents = new Map<number, string>();
  addDocument(docId: number, text: string): void {
    this.removeDocument(docId);
    this.documents.set(docId, text);
    tokenize(text).forEach((term, position) => {
      const docs = this.postings.get(term) ?? new Map<number, number[]>();
      const positions = docs.get(docId) ?? [];
      positions.push(position); docs.set(docId, positions); this.postings.set(term, docs);
    });
  }
  removeDocument(docId: number): void {
    if (!this.documents.delete(docId)) return;
    for (const [term, docs] of this.postings) { docs.delete(docId); if (docs.size === 0) this.postings.delete(term); }
  }
  search(query: string): number[] {
    const terms = [...new Set(tokenize(query))];
    if (terms.length === 0) return [];
    const sets = terms.map((term) => new Set(this.postings.get(term)?.keys() ?? []));
    const [first, ...rest] = sets.sort((a, b) => a.size - b.size);
    return [...(first ?? [])].filter((id) => rest.every((set) => set.has(id))).sort((a, b) => a - b);
  }
  phraseSearch(phrase: string): number[] {
    const terms = tokenize(phrase); if (terms.length === 0) return [];
    return this.search(phrase).filter((docId) => {
      const starts = this.postings.get(terms[0]!)?.get(docId) ?? [];
      return starts.some((start) => terms.every((term, offset) => this.postings.get(term)?.get(docId)?.includes(start + offset)));
    });
  }
  getDocument(docId: number): string | undefined { return this.documents.get(docId); }
  documentFrequency(term: string): number { return this.postings.get(term.toLowerCase())?.size ?? 0; }
}
