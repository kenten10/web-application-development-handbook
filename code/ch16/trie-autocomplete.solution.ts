export type Suggestion = { word: string; weight: number };
type Node = { children: Map<string, Node>; terminal?: Suggestion };
const makeNode = (): Node => ({ children: new Map() });

export class Trie {
  private readonly root = makeNode();
  insert(word: string, weight = 0): void {
    let node = this.root;
    for (const char of word.normalize('NFKC').toLowerCase()) {
      const child = node.children.get(char) ?? makeNode(); node.children.set(char, child); node = child;
    }
    node.terminal = { word, weight };
  }
  suggest(prefix: string, limit = 5): Suggestion[] {
    let node = this.root;
    for (const char of prefix.normalize('NFKC').toLowerCase()) { const child = node.children.get(char); if (!child) return []; node = child; }
    const found: Suggestion[] = []; const stack = [node];
    while (stack.length) { const current = stack.pop()!; if (current.terminal) found.push(current.terminal); for (const child of current.children.values()) stack.push(child); }
    return found.sort((a, b) => b.weight - a.weight || a.word.localeCompare(b.word)).slice(0, limit);
  }
}
