// Starter for 22.4 課題22.4: SLO Burn Rate アラート計算 (★★)
// Purpose: 「SLO の error budget を、現在の速度で食い尽くすまで何時間か」を計算するロジックを実装。
// TODO:
// - 本文に記載された観察結果または振る舞いを確認できる。

export const exerciseId = "22.4";
// TODO: implement the exercise.

// --- 実装すべき公開API (KEN-61 生成。手で書き換えない) ---
// 完成条件と章のテストは、次の名前と形が公開されている前提で書かれている。
// 別の名前で実装すると、演習カードの「テスト方法」を自分の実装に対して実行できない。
//
//   export class SLOTracker
//     constructor(readonly options:{target:number;windowDays:number})
//     record(e:Event)
//     status(windowMin=this.options.windowDays*1440,now=Date.now())
//     evaluateAlerts(rules:AlertRule[],now=Date.now())
//     hoursUntilBudgetExhausted(now=Date.now())
//
// 実装し終えてから読む模範解答: code/ch22/slo-burn-rate.solution.ts
// --- ここまで ---
