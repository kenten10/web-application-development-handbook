type AnyFn = (...args: any[]) => any;
export type MockFunction<F extends AnyFn> = F & {
  calls: Parameters<F>[];
  callCount: number;
  mockReturnValue(value: ReturnType<F>): MockFunction<F>;
  mockReturnValueOnce(value: ReturnType<F>): MockFunction<F>;
  mockImplementation(fn: F): MockFunction<F>;
  reset(): void;
};

export function mock<F extends AnyFn>(): MockFunction<F> {
  const calls: Parameters<F>[] = [];
  const once: ReturnType<F>[] = [];
  let implementation: F | undefined;
  let fallback: ReturnType<F> | undefined;
  const fn = ((...args: Parameters<F>) => {
    calls.push(args);
    if (once.length) return once.shift() as ReturnType<F>;
    return implementation ? implementation(...args) : fallback as ReturnType<F>;
  }) as MockFunction<F>;
  Object.defineProperties(fn, { calls: { get: () => calls }, callCount: { get: () => calls.length } });
  fn.mockReturnValue = value => { fallback = value; return fn; };
  fn.mockReturnValueOnce = value => { once.push(value); return fn; };
  fn.mockImplementation = value => { implementation = value; return fn; };
  fn.reset = () => { calls.length = 0; once.length = 0; implementation = undefined; fallback = undefined; };
  return fn;
}

export function stub<T extends object>(implementations: Partial<T>): T {
  return new Proxy({ ...implementations } as T, {
    get(target, key) {
      if (!(key in target)) throw new Error(`No stub implementation for ${String(key)}`);
      return Reflect.get(target, key);
    },
  });
}

export function spyOn<T extends object, K extends keyof T>(target: T, key: K) {
  const original = target[key];
  if (typeof original !== 'function') throw new Error(`${String(key)} is not a function`);
  const spy = mock<AnyFn>().mockImplementation((original as AnyFn).bind(target));
  target[key] = spy as T[K];
  return { calls: spy.calls, get callCount() { return spy.callCount; }, restore() { target[key] = original; } };
}
export const exerciseId = '25.2';
