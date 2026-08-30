// Starter for 23.4 課題23.4: SSRF 防御 ― URL バリデータ (★★)
// Purpose: ユーザー指定 URL を fetch する機能(画像プレビュー、Webhook 等)で内部リソースを叩かれないようにする。
// TODO:
// - 本文に記載された観察結果または振る舞いを確認できる。

export const exerciseId = "23.4";
// TODO: implement the exercise.

// --- 実装すべき公開API (KEN-61 生成。手で書き換えない) ---
// 完成条件と章のテストは、次の名前と形が公開されている前提で書かれている。
// 別の名前で実装すると、演習カードの「テスト方法」を自分の実装に対して実行できない。
//
//   export function isBlockedAddress(ip:string)
//   export class SSRFGuard
//     constructor(private readonly options:{allowedPorts?:number[];resolve?:(host:string)=>Promise<string[]>}={})
//     async validate(raw:string)
//
// 実装し終えてから読む模範解答: code/ch23/ssrf-guard.solution.ts
// --- ここまで ---
