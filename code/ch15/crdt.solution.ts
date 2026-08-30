export type CounterState = Readonly<Record<string, number>>;

function mergeCounters(a: CounterState, b: CounterState): CounterState {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return Object.fromEntries([...keys].map((key) => [key, Math.max(a[key] ?? 0, b[key] ?? 0)]));
}

export class GCounter {
  private stateValue: CounterState;
  constructor(readonly nodeId: string, state: CounterState = {}) { this.stateValue = { ...state }; }
  increment(by = 1): void {
    if (!Number.isInteger(by) || by < 0) throw new Error('GCounter accepts non-negative integers');
    this.stateValue = { ...this.stateValue, [this.nodeId]: (this.stateValue[this.nodeId] ?? 0) + by };
  }
  get state(): CounterState { return { ...this.stateValue }; }
  get value(): number { return GCounter.value(this.stateValue); }
  merge(other: CounterState): void { this.stateValue = GCounter.merge(this.stateValue, other); }
  static merge(a: CounterState, b: CounterState): CounterState { return mergeCounters(a, b); }
  static value(state: CounterState): number { return Object.values(state).reduce((sum, n) => sum + n, 0); }
}

export type PNState = { positive: CounterState; negative: CounterState };
export class PNCounter {
  private readonly positive: GCounter;
  private readonly negative: GCounter;
  constructor(nodeId: string, state: PNState = { positive: {}, negative: {} }) {
    this.positive = new GCounter(nodeId, state.positive);
    this.negative = new GCounter(nodeId, state.negative);
  }
  increment(by = 1): void { this.positive.increment(by); }
  decrement(by = 1): void { this.negative.increment(by); }
  get state(): PNState { return { positive: this.positive.state, negative: this.negative.state }; }
  get value(): number { return this.positive.value - this.negative.value; }
  merge(other: PNState): void { this.positive.merge(other.positive); this.negative.merge(other.negative); }
}

export type RegisterState<T> = { value: T; timestamp: number; nodeId: string };
export class LWWRegister<T> {
  private stateValue: RegisterState<T>;
  constructor(initial: T, readonly nodeId: string, timestamp = 0) {
    this.stateValue = { value: initial, timestamp, nodeId };
  }
  set(value: T, timestamp = Date.now()): void { this.stateValue = { value, timestamp, nodeId: this.nodeId }; }
  get state(): RegisterState<T> { return { ...this.stateValue }; }
  get value(): T { return this.stateValue.value; }
  merge(other: RegisterState<T>): void { this.stateValue = LWWRegister.merge(this.stateValue, other); }
  static merge<T>(a: RegisterState<T>, b: RegisterState<T>): RegisterState<T> {
    if (a.timestamp !== b.timestamp) return a.timestamp > b.timestamp ? { ...a } : { ...b };
    return a.nodeId >= b.nodeId ? { ...a } : { ...b };
  }
}
