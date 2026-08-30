interface Entry<K, V> { key: K; value: V; }
class Node<K, V> {
  entries: Entry<K, V>[] = [];
  children: Node<K, V>[] = [];
  constructor(public leaf = true) {}
}

export class BTree<K, V> {
  readonly #rootHolder: { root: Node<K, V> } = { root: new Node<K, V>() };
  constructor(readonly minDegree = 2, readonly compare: (left: K, right: K) => number = defaultCompare) {
    if (!Number.isInteger(minDegree) || minDegree < 2) throw new Error('minDegree must be at least 2');
  }

  insert(key: K, value: V): void {
    if (this.#update(this.#rootHolder.root, key, value)) return;
    let root = this.#rootHolder.root;
    if (root.entries.length === 2 * this.minDegree - 1) {
      const next = new Node<K, V>(false); next.children.push(root); this.#splitChild(next, 0); this.#rootHolder.root = next; root = next;
    }
    this.#insertNonFull(root, { key, value });
  }

  search(key: K): V | undefined { return this.#search(this.#rootHolder.root, key)?.value; }
  range(from: K, to: K): V[] {
    const output: V[] = []; this.#walk(this.#rootHolder.root, ({ key, value }) => { if (this.compare(key, from) >= 0 && this.compare(key, to) <= 0) output.push(value); }); return output;
  }
  depth(): number { let depth = 1; let node = this.#rootHolder.root; while (!node.leaf) { depth += 1; node = node.children[0]!; } return depth; }
  print(): string {
    const lines: string[] = []; const queue: Array<{ node: Node<K, V>; level: number }> = [{ node: this.#rootHolder.root, level: 0 }];
    while (queue.length) { const { node, level } = queue.shift()!; lines.push(`${'  '.repeat(level)}[${node.entries.map((entry) => String(entry.key)).join(', ')}]`); queue.push(...node.children.map((child) => ({ node: child, level: level + 1 }))); }
    return lines.join('\n');
  }


  #update(node: Node<K, V>, key: K, value: V): boolean {
    let index = 0;
    while (index < node.entries.length && this.compare(key, node.entries[index]!.key) > 0) index += 1;
    if (index < node.entries.length && this.compare(key, node.entries[index]!.key) === 0) { node.entries[index] = { key, value }; return true; }
    return node.leaf ? false : this.#update(node.children[index]!, key, value);
  }

  #search(node: Node<K, V>, key: K): Entry<K, V> | undefined {
    let index = 0; while (index < node.entries.length && this.compare(key, node.entries[index]!.key) > 0) index += 1;
    if (index < node.entries.length && this.compare(key, node.entries[index]!.key) === 0) return node.entries[index];
    return node.leaf ? undefined : this.#search(node.children[index]!, key);
  }
  #splitChild(parent: Node<K, V>, index: number): void {
    const full = parent.children[index]!; const right = new Node<K, V>(full.leaf); const middle = full.entries[this.minDegree - 1]!;
    right.entries = full.entries.splice(this.minDegree); full.entries.splice(this.minDegree - 1, 1);
    if (!full.leaf) right.children = full.children.splice(this.minDegree);
    parent.entries.splice(index, 0, middle); parent.children.splice(index + 1, 0, right);
  }
  #insertNonFull(node: Node<K, V>, entry: Entry<K, V>): void {
    let index = node.entries.length - 1;
    if (node.leaf) {
      while (index >= 0 && this.compare(entry.key, node.entries[index]!.key) < 0) index -= 1;
      if (index >= 0 && this.compare(entry.key, node.entries[index]!.key) === 0) { node.entries[index] = entry; return; }
      node.entries.splice(index + 1, 0, entry); return;
    }
    while (index >= 0 && this.compare(entry.key, node.entries[index]!.key) < 0) index -= 1;
    index += 1;
    if (node.children[index]!.entries.length === 2 * this.minDegree - 1) {
      this.#splitChild(node, index); const order = this.compare(entry.key, node.entries[index]!.key); if (order === 0) { node.entries[index] = entry; return; } if (order > 0) index += 1;
    }
    this.#insertNonFull(node.children[index]!, entry);
  }
  #walk(node: Node<K, V>, visit: (entry: Entry<K, V>) => void): void {
    node.entries.forEach((entry, index) => { if (!node.leaf) this.#walk(node.children[index]!, visit); visit(entry); }); if (!node.leaf) this.#walk(node.children[node.entries.length]!, visit);
  }
}
function defaultCompare<T>(left: T, right: T): number { return left < right ? -1 : left > right ? 1 : 0; }
