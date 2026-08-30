// Starter for 15.1 課題15.1: Redis 風 KVS を自作 (★★)
// Purpose: TCP プロトコルで KVS を実装し、Redis の構造を体感する。
// TODO:
// - 本文に記載された観察結果または振る舞いを確認できる。

export const exerciseId = "15.1";
// TODO: implement the exercise.

// --- 実装すべき公開API (KEN-61 生成。手で書き換えない) ---
// 完成条件と章のテストは、次の名前と形が公開されている前提で書かれている。
// 別の名前で実装すると、演習カードの「テスト方法」を自分の実装に対して実行できない。
//
//   export type StoredValue
//   export class KeyValueStore
//     set(key: string, value: string, ttlSeconds?: number): void
//     get(key: string): string | undefined
//     delete(key: string): boolean
//     expire(key: string, ttlSeconds: number): boolean
//     size(): number
//   export function executeCommand(store: KeyValueStore, line: string): string
//   export function createKvsServer(store = new KeyValueStore()): Server
//
// 実装し終えてから読む模範解答: code/ch15/kvs.solution.ts
// --- ここまで ---
