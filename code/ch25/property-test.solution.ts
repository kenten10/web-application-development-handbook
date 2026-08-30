export interface Arbitrary<T> { sample(random: () => number): T; shrink(value: T): Iterable<T>; }
export function integer(min = -1000, max = 1000): Arbitrary<number> {
  return { sample: r => Math.floor(r() * (max - min + 1)) + min, *shrink(v) { let x = v; while (x !== 0) { x = Math.trunc(x / 2); yield x; } } };
}
export function string(maxLength = 20): Arbitrary<string> {
  return { sample: r => Array.from({ length: Math.floor(r() * (maxLength + 1)) }, () => String.fromCharCode(97 + Math.floor(r() * 26))).join(''), *shrink(v) { for (let n = Math.floor(v.length / 2); n >= 0; n = Math.floor(n / 2)) { yield v.slice(0, n); if (n === 0) break; } } };
}
export function array<T>(item: Arbitrary<T>, maxLength = 20): Arbitrary<T[]> {
  return { sample: r => Array.from({ length: Math.floor(r() * (maxLength + 1)) }, () => item.sample(r)), *shrink(v) { yield []; for (let n = Math.floor(v.length / 2); n > 0; n = Math.floor(n / 2)) yield v.slice(0, n); } };
}
export function record<T extends Record<string, Arbitrary<unknown>>>(shape: T): Arbitrary<{ [K in keyof T]: T[K] extends Arbitrary<infer V> ? V : never }> {
  return { sample(r) { return Object.fromEntries(Object.entries(shape).map(([k, a]) => [k, a.sample(r)])) as any; }, *shrink() {} };
}
export function seededRandom(seed = 1): () => number { let state = seed >>> 0; return () => ((state = (1664525 * state + 1013904223) >>> 0) / 0x1_0000_0000); }
export function forAll<T>(arb: Arbitrary<T>, predicate: (value: T) => boolean, options: { cases?: number; seed?: number } = {}): { cases: number } {
  const random = seededRandom(options.seed ?? 1); const cases = options.cases ?? 1000;
  for (let i = 0; i < cases; i++) {
    const value = arb.sample(random);
    if (!predicate(value)) {
      let minimal = value;
      for (const candidate of arb.shrink(value)) { if (!predicate(candidate)) minimal = candidate; }
      throw new Error(`Property failed after ${i + 1} cases; counterexample=${JSON.stringify(minimal)}`);
    }
  }
  return { cases };
}
export const exerciseId = '25.3';
