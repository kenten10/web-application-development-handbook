type Subscriber = ReactiveEffect;
let activeEffect: ReactiveEffect | null = null;

class ReactiveEffect {
  readonly deps = new Set<Set<Subscriber>>();
  running = false;
  disposed = false;

  constructor(readonly fn: () => void) {}

  run(): void {
    if (this.disposed) return;
    if (this.running) throw new Error('Reactive cycle detected');
    for (const dep of this.deps) dep.delete(this);
    this.deps.clear();
    const previous = activeEffect;
    activeEffect = this;
    this.running = true;
    try { this.fn(); }
    finally { this.running = false; activeEffect = previous; }
  }

  dispose(): void {
    this.disposed = true;
    for (const dep of this.deps) dep.delete(this);
    this.deps.clear();
  }
}

export type Signal<T> = readonly [() => T, (next: T | ((current: T) => T)) => void];

export function createSignal<T>(initial: T): Signal<T> {
  let value = initial;
  const subscribers = new Set<Subscriber>();
  const get = (): T => {
    if (activeEffect) {
      subscribers.add(activeEffect);
      activeEffect.deps.add(subscribers);
    }
    return value;
  };
  const set = (next: T | ((current: T) => T)): void => {
    const resolved = typeof next === 'function' ? (next as (current: T) => T)(value) : next;
    if (Object.is(value, resolved)) return;
    value = resolved;
    for (const subscriber of [...subscribers]) {
      if (subscriber.running) throw new Error('Reactive cycle detected');
      subscriber.run();
    }
  };
  return [get, set] as const;
}

export function effect(fn: () => void): () => void {
  const reactive = new ReactiveEffect(fn);
  reactive.run();
  return () => reactive.dispose();
}

export function computed<T>(compute: () => T): () => T {
  const [get, set] = createSignal<T>(undefined as T);
  effect(() => set(compute()));
  return get;
}

export const exerciseId = '6.2';
