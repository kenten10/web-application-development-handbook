// Starter for 17.4 課題17.4: Saga パターン (補償トランザクション) (★★★)
// Purpose: 分散システムでの「前のステップを巻き戻して整合性を取り戻す」パターン。
// TODO:
// - 本文に記載された観察結果または振る舞いを確認できる。

export const exerciseId = "17.4";
// TODO: implement the exercise.

// --- 実装すべき公開API (KEN-61 生成。手で書き換えない) ---
// 完成条件と章のテストは、次の名前と形が公開されている前提で書かれている。
// 別の名前で実装すると、演習カードの「テスト方法」を自分の実装に対して実行できない。
//
//   export type SagaStep<Result>
//   export type SagaResult
//   export class Saga
//     step<Result>(step: SagaStep<Result>): this
//     async execute(): Promise<SagaResult>
//
// 実装し終えてから読む模範解答: code/ch17/saga.solution.ts
// --- ここまで ---
