export type VNode = {
  type: string;
  key?: string | number;
  props?: Record<string, unknown>;
  children?: Array<VNode | string>;
};

export type Patch =
  | { type: 'CREATE'; path: string; node: VNode | string }
  | { type: 'REMOVE'; path: string }
  | { type: 'REPLACE'; path: string; node: VNode | string }
  | { type: 'TEXT'; path: string; value: string }
  | { type: 'PROPS'; path: string; set: Record<string, unknown>; remove: string[] }
  | { type: 'MOVE'; path: string; from: number; to: number; key: string | number };

function propPatch(oldProps: Record<string, unknown>, newProps: Record<string, unknown>) {
  const set: Record<string, unknown> = {};
  const remove: string[] = [];
  for (const [key, value] of Object.entries(newProps)) if (!Object.is(value, oldProps[key])) set[key] = value;
  for (const key of Object.keys(oldProps)) if (!(key in newProps)) remove.push(key);
  return { set, remove };
}

function childKey(child: VNode | string, index: number): string | number {
  return typeof child === 'string' ? `#text:${index}` : child.key ?? `#index:${index}`;
}

export function diff(oldNode: VNode | string | undefined, newNode: VNode | string | undefined, path = '0'): Patch[] {
  if (oldNode === undefined && newNode !== undefined) return [{ type: 'CREATE', path, node: newNode }];
  if (newNode === undefined) return [{ type: 'REMOVE', path }];
  if (oldNode === undefined) return [];
  if (typeof oldNode === 'string' || typeof newNode === 'string') {
    if (typeof oldNode === 'string' && typeof newNode === 'string') {
      return oldNode === newNode ? [] : [{ type: 'TEXT', path, value: newNode }];
    }
    return [{ type: 'REPLACE', path, node: newNode }];
  }
  if (oldNode.type !== newNode.type) return [{ type: 'REPLACE', path, node: newNode }];

  const patches: Patch[] = [];
  const props = propPatch(oldNode.props ?? {}, newNode.props ?? {});
  if (Object.keys(props.set).length || props.remove.length) patches.push({ type: 'PROPS', path, ...props });

  const oldChildren = oldNode.children ?? [];
  const newChildren = newNode.children ?? [];
  const oldByKey = new Map(oldChildren.map((child, index) => [childKey(child, index), { child, index }]));
  const used = new Set<number>();

  newChildren.forEach((child, newIndex) => {
    const key = childKey(child, newIndex);
    const match = oldByKey.get(key);
    const childPath = `${path}.${newIndex}`;
    if (!match) {
      patches.push({ type: 'CREATE', path: childPath, node: child });
      return;
    }
    used.add(match.index);
    if (match.index !== newIndex && !String(key).startsWith('#index:') && !String(key).startsWith('#text:')) {
      patches.push({ type: 'MOVE', path, from: match.index, to: newIndex, key });
    }
    patches.push(...diff(match.child, child, childPath));
  });

  oldChildren.forEach((_, index) => {
    if (!used.has(index)) patches.push({ type: 'REMOVE', path: `${path}.${index}` });
  });
  return patches;
}

export const exerciseId = '6.3';
