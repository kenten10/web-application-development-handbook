// Starter for 14.3 課題14.3: N+1 問題の解決 ― EXPLAIN 比較 (★★)
// Purpose: 同じ機能を「ループで個別クエリ」vs「JOIN 一発」で実装し、EXPLAIN で実行計画を比較。
// TODO:
// - 本文に記載された観察結果または振る舞いを確認できる。

export const exerciseId = "14.3";
// TODO: implement the exercise.

// --- 実装すべき公開API (KEN-61 生成。手で書き換えない) ---
// 完成条件と章のテストは、次の名前と形が公開されている前提で書かれている。
// 別の名前で実装すると、演習カードの「テスト方法」を自分の実装に対して実行できない。
//
//   export interface User
//   export interface Post
//   export interface PostWithAuthor extends Post
//   export class QueryCountingDatabase
//     constructor(readonly users: readonly User[], readonly posts: readonly Post[])
//     findPosts(): Post[]
//     findUser(id: number): User | undefined
//     joinPostsAndUsers(): PostWithAuthor[]
//     explain(kind: 'n+1' | 'join'): string[]
//   export function loadWithNPlusOne(db: QueryCountingDatabase): PostWithAuthor[]
//   export function loadWithJoin(db: QueryCountingDatabase): PostWithAuthor[]
//
// 実装し終えてから読む模範解答: code/ch14/n-plus-one/solution/main.ts
// --- ここまで ---
