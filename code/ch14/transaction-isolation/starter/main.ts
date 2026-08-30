// Starter for 14.2 課題14.2: トランザクション分離レベル実験 (★★★)
// Purpose: 「Read Committed、Repeatable Read、Serializable」の違いを実演する。
// TODO:
// - 本文に記載された観察結果または振る舞いを確認できる。

export const exerciseId = "14.2";
// TODO: implement the exercise.

// --- 実装すべき公開API (KEN-61 生成。手で書き換えない) ---
// 完成条件と章のテストは、次の名前と形が公開されている前提で書かれている。
// 別の名前で実装すると、演習カードの「テスト方法」を自分の実装に対して実行できない。
//
//   export type IsolationLevel
//   export class AccountDatabase
//     constructor(initial: Record<number, number>)
//     begin(level: IsolationLevel): Transaction
//     currentVersion(): number
//     read(id: number, atVersion = this.#version): number
//     commit(writes: Map<number, number>, snapshotVersion: number, serializable: boolean): number
//   export class Transaction
//     constructor(readonly db: AccountDatabase, readonly level: IsolationLevel, readonly snapshotVersion: number)
//     read(id: number): number
//     write(id: number, value: number): void
//     commit(): number
//     rollback(): void
//   export function demonstrateNonRepeatableRead(level: IsolationLevel): [number, number]
//
// 実装し終えてから読む模範解答: code/ch14/transaction-isolation/solution/main.ts
// --- ここまで ---
