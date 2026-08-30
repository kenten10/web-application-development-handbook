type Cleanup = void | (() => void);
type EffectSlot = { kind: 'effect'; deps: readonly unknown[] | undefined; nextDeps: readonly unknown[] | undefined; effect: () => Cleanup; cleanup: (() => void) | undefined; dirty: boolean };
type StateSlot<T> = { kind: 'state'; value: T };
type MemoSlot<T> = { kind: 'memo'; value: T; deps?: readonly unknown[] };
type RefSlot<T> = { kind: 'ref'; value: { current: T } };
type Slot = StateSlot<unknown> | EffectSlot | MemoSlot<unknown> | RefSlot<unknown>;

let currentRuntime: MiniReactRuntime<unknown> | null = null;

function depsChanged(before: readonly unknown[] | undefined, after: readonly unknown[] | undefined): boolean {
  if (!after) return true;
  if (!before || before.length !== after.length) return true;
  return after.some((value, index) => !Object.is(value, before[index]));
}

export class MiniReactRuntime<Result> {
  private slots: Slot[] = [];
  private cursor = 0;
  private scheduled = false;
  private latest!: Result;
  private listeners = new Set<(value: Result) => void>();

  constructor(private readonly component: () => Result) {}

  render(): Result {
    this.cursor = 0;
    const previous = currentRuntime;
    currentRuntime = this as MiniReactRuntime<unknown>;
    try {
      this.latest = this.component();
    } finally {
      currentRuntime = previous;
    }
    this.flushEffects();
    for (const listener of this.listeners) listener(this.latest);
    return this.latest;
  }

  scheduleRender(): void {
    if (this.scheduled) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      this.render();
    });
  }

  subscribe(listener: (value: Result) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    for (const slot of this.slots) if (slot.kind === 'effect') slot.cleanup?.();
    this.slots = [];
    this.listeners.clear();
  }

  nextIndex(): number { return this.cursor++; }
  getSlot(index: number): Slot | undefined { return this.slots[index]; }
  setSlot(index: number, slot: Slot): void { this.slots[index] = slot; }

  private flushEffects(): void {
    for (const slot of this.slots) {
      if (slot.kind !== 'effect' || !slot.dirty) continue;
      slot.cleanup?.();
      const cleanup = slot.effect();
      slot.cleanup = typeof cleanup === 'function' ? cleanup : undefined;
      slot.deps = slot.nextDeps;
      slot.dirty = false;
    }
  }
}

function runtime(): MiniReactRuntime<unknown> {
  if (!currentRuntime) throw new Error('Hooks must run during MiniReactRuntime.render()');
  return currentRuntime;
}

export function useState<T>(initial: T | (() => T)): [T, (next: T | ((current: T) => T)) => void] {
  const rt = runtime();
  const index = rt.nextIndex();
  let slot = rt.getSlot(index) as StateSlot<T> | undefined;
  if (!slot) {
    slot = { kind: 'state', value: typeof initial === 'function' ? (initial as () => T)() : initial };
    rt.setSlot(index, slot as StateSlot<unknown>);
  }
  const setState = (next: T | ((current: T) => T)): void => {
    const value = typeof next === 'function' ? (next as (current: T) => T)(slot!.value) : next;
    if (Object.is(value, slot!.value)) return;
    slot!.value = value;
    rt.scheduleRender();
  };
  return [slot.value, setState];
}

export function useEffect(effect: () => Cleanup, deps?: readonly unknown[]): void {
  const rt = runtime();
  const index = rt.nextIndex();
  let slot = rt.getSlot(index) as EffectSlot | undefined;
  if (!slot) {
    slot = { kind: 'effect', effect, deps: undefined, nextDeps: deps, cleanup: undefined, dirty: true };
    rt.setSlot(index, slot);
    return;
  }
  slot.effect = effect;
  slot.nextDeps = deps;
  slot.dirty = depsChanged(slot.deps, deps);
}

export function useMemo<T>(factory: () => T, deps: readonly unknown[]): T {
  const rt = runtime();
  const index = rt.nextIndex();
  let slot = rt.getSlot(index) as MemoSlot<T> | undefined;
  if (!slot || depsChanged(slot.deps, deps)) {
    slot = { kind: 'memo', value: factory(), deps };
    rt.setSlot(index, slot as MemoSlot<unknown>);
  }
  return slot.value;
}

export function useRef<T>(initial: T): { current: T } {
  const rt = runtime();
  const index = rt.nextIndex();
  let slot = rt.getSlot(index) as RefSlot<T> | undefined;
  if (!slot) {
    slot = { kind: 'ref', value: { current: initial } };
    rt.setSlot(index, slot as RefSlot<unknown>);
  }
  return slot.value;
}

export function createMiniReact<Result>(component: () => Result): MiniReactRuntime<Result> {
  return new MiniReactRuntime(component);
}

export const exerciseId = '6.1';
