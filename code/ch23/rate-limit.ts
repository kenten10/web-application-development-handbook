// Starter for 23.5 課題23.5: レート制限 (★★★)
// Purpose: ブルートフォース攻撃 / DDoS 防御の基本。Token Bucket と Sliding Window 両方を実装。
// TODO:
// - 本文に記載された観察結果または振る舞いを確認できる。

export const exerciseId = "23.5";
// TODO: implement the exercise.

// --- 実装すべき公開API (KEN-61 生成。手で書き換えない) ---
// 完成条件と章のテストは、次の名前と形が公開されている前提で書かれている。
// 別の名前で実装すると、演習カードの「テスト方法」を自分の実装に対して実行できない。
//
//   export class TokenBucket
//     constructor(readonly options: { capacity: number; refillPerSec: number; now?: () => number })
//     tryConsume(n = 1): boolean
//     remaining(): number
//   export class SlidingWindowLimiter
//     constructor(readonly options: { windowMs: number; max: number; now?: () => number })
//     check(key: string):
//
// 実装し終えてから読む模範解答: code/ch23/rate-limit.solution.ts
// --- ここまで ---
