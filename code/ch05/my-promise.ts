// Starter for 5.1 課題5.1: Promise を自作する (★★★)
// Purpose: Promise が「単なる値」ではなく「状態を持つステートマシン」であることを内部から理解する。
// TODO:
// - 5.5 で本書が示した実装をベースに、all、allSettled、race、finally を追加
// - マイクロタスクキューで .then を実行(queueMicrotask 使用)
// - 教材用テストとPromise/A+対象範囲のテストを通過する（ネイティブPromiseの完全な置換を完了条件にしない）

export const exerciseId = "5.1";
// TODO: implement the exercise.

// --- 実装すべき公開API (KEN-61 生成。手で書き換えない) ---
// 完成条件と章のテストは、次の名前と形が公開されている前提で書かれている。
// 別の名前で実装すると、演習カードの「テスト方法」を自分の実装に対して実行できない。
//
//   export type PromiseState
//   export class MyPromise<T> implements PromiseLike<T>
//     constructor(executor: Executor<T>)
//     then<TResult1 = T, TResult2 = never>( onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null, ): MyPromise<TResult1 | TResult2>
//     finally(onFinally: () => void | PromiseLike<void>): MyPromise<T>
//     static resolve<T>(value: T | PromiseLike<T>): MyPromise<Awaited<T>>
//     static reject<T = never>(reason?: unknown): MyPromise<T>
//     static all<T extends readonly unknown[]>(values: T): MyPromise<
//     static allSettled<T extends readonly unknown[]>(values: T): MyPromise<
//     static race<T>(values: Iterable<T | PromiseLike<T>>): MyPromise<Awaited<T>>
//
// 実装し終えてから読む模範解答: code/ch05/my-promise.solution.ts
// --- ここまで ---
