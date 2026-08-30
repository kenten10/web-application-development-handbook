export type Length<T extends readonly unknown[]> = T['length'];
export type Head<T extends readonly unknown[]> = T extends readonly [infer H, ...unknown[]] ? H : never;
export type Tail<T extends readonly unknown[]> = T extends readonly [unknown, ...infer R] ? R : [];
export type Reverse<T extends readonly unknown[], Acc extends readonly unknown[] = []> =
  T extends readonly [infer H, ...infer R] ? Reverse<R, readonly [H, ...Acc]> : Acc;
export type Concat<A extends readonly unknown[], B extends readonly unknown[]> = [...A, ...B];

export type DeepReadonly<T> =
  T extends (...args: never[]) => unknown ? T :
  T extends readonly unknown[] ? { readonly [K in keyof T]: DeepReadonly<T[K]> } :
  T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;

type StringKey<T> = Extract<keyof T, string>;
export type PathOf<T> = T extends object ? {
  [K in StringKey<T>]: T[K] extends object ? K | `${K}.${PathOf<T[K]>}` : K
}[StringKey<T>] : never;

export type CamelCase<S extends string> = S extends `${infer H}_${infer T}`
  ? `${Lowercase<H>}${Capitalize<CamelCase<T>>}`
  : Lowercase<S>;

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;

type _Cases = [
  Assert<Equal<Length<[1, 2, 3]>, 3>>,
  Assert<Equal<Head<[1, 2, 3]>, 1>>,
  Assert<Equal<Tail<[1, 2, 3]>, [2, 3]>>,
  Assert<Equal<Reverse<[1, 2, 3]>, readonly [3, 2, 1]>>,
  Assert<Equal<Concat<[1, 2], [3, 4]>, [1, 2, 3, 4]>>,
  Assert<Equal<PathOf<{ a: { b: { c: 1 } } }>, 'a' | 'a.b' | 'a.b.c'>>,
  Assert<Equal<CamelCase<'hello_world_foo'>, 'helloWorldFoo'>>,
];

export const exerciseId = '5.3';
