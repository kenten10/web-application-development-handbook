// Starter for 26.4 課題26.4: 冪等性キー実装 (★★)
// Purpose: Stripe API 等の Idempotency-Key ヘッダ風の仕組み。
// TODO:
// - 同じキーで2回目以降のリクエスト → 1回目の結果を返す
// - リクエスト body のハッシュも保存(同じキーで違うリクエストはエラー)
// - 一定期間で expire

export const exerciseId = "26.4";
// TODO: implement the exercise.

// --- 実装すべき公開API (KEN-61 生成。手で書き換えない) ---
// 完成条件と章のテストは、次の名前と形が公開されている前提で書かれている。
// 別の名前で実装すると、演習カードの「テスト方法」を自分の実装に対して実行できない。
//
//   export class IdempotencyStore
//     constructor(private readonly options:{ttlSec:number;now?:()=>number})
//     async execute<T>(key:string,body:unknown,operation:()=>Promise<T>):Promise<T>
//
// 実装し終えてから読む模範解答: code/ch26/idempotency.solution.ts
// --- ここまで ---
