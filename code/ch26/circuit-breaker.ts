// Starter for 26.1 課題26.1: サーキットブレーカ実装 (★★★)
// Purpose: Hystrix / resilience4j / opossum 風のサーキットブレーカ。
// TODO:
// - 本文に記載された観察結果または振る舞いを確認できる。

export const exerciseId = "26.1";
// TODO: implement the exercise.

// --- 実装すべき公開API (KEN-61 生成。手で書き換えない) ---
// 完成条件と章のテストは、次の名前と形が公開されている前提で書かれている。
// 別の名前で実装すると、演習カードの「テスト方法」を自分の実装に対して実行できない。
//
//   export type CircuitState
//   export class CircuitBreaker
//     constructor(private readonly options:{failureThreshold:number;resetTimeoutMs:number;successThresholdInHalfOpen:number;now?:()=>number})
//     async execute<T>(operation:()=>Promise<T>):Promise<T>
//
// 実装し終えてから読む模範解答: code/ch26/circuit-breaker.solution.ts
// --- ここまで ---
