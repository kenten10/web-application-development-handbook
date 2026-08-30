export type RouteHandler<T = unknown> = (params: Record<string, string>) => T;
interface TrieNode<T> {
  staticChildren: Map<string, TrieNode<T>>;
  parameter?: { name: string; node: TrieNode<T> };
  wildcard?: { name: string; node: TrieNode<T> };
  handlers: Map<string, RouteHandler<T>>;
}
function node<T>(): TrieNode<T> { return { staticChildren: new Map(), handlers: new Map() }; }

export class TrieRouter<T = unknown> {
  readonly #root = node<T>();

  add(method: string, pattern: string, handler: RouteHandler<T>): void {
    let current = this.#root;
    const segments = split(pattern);
    for (const [index, segment] of segments.entries()) {
      if (segment.startsWith(':')) {
        current.parameter ??= { name: segment.slice(1), node: node<T>() };
        current = current.parameter.node;
      } else if (segment.startsWith('*')) {
        if (index !== segments.length - 1) throw new Error('Wildcard must be the final segment');
        current.wildcard ??= { name: segment.slice(1) || 'wildcard', node: node<T>() };
        current = current.wildcard.node;
      } else {
        let child = current.staticChildren.get(segment);
        if (!child) { child = node<T>(); current.staticChildren.set(segment, child); }
        current = child;
      }
    }
    current.handlers.set(method.toUpperCase(), handler);
  }

  match(method: string, pathname: string): { handler: RouteHandler<T>; params: Record<string, string> } | null {
    const segments = split(pathname);
    const search = (current: TrieNode<T>, index: number, params: Record<string, string>): { handler: RouteHandler<T>; params: Record<string, string> } | null => {
      if (index === segments.length) {
        const handler = current.handlers.get(method.toUpperCase());
        if (handler) return { handler, params };
        if (current.wildcard) {
          const wildcardHandler = current.wildcard.node.handlers.get(method.toUpperCase());
          if (wildcardHandler) return { handler: wildcardHandler, params: { ...params, [current.wildcard.name]: '' } };
        }
        return null;
      }
      const segment = segments[index]!;
      const staticChild = current.staticChildren.get(segment);
      if (staticChild) {
        const result = search(staticChild, index + 1, params);
        if (result) return result;
      }
      if (current.parameter) {
        const result = search(current.parameter.node, index + 1, { ...params, [current.parameter.name]: decodeURIComponent(segment) });
        if (result) return result;
      }
      if (current.wildcard) {
        const handler = current.wildcard.node.handlers.get(method.toUpperCase());
        if (handler) return { handler, params: { ...params, [current.wildcard.name]: decodeURIComponent(segments.slice(index).join('/')) } };
      }
      return null;
    };
    return search(this.#root, 0, {});
  }
}

function split(pathname: string): string[] {
  return pathname.split('?')[0]!.split('/').filter(Boolean);
}
