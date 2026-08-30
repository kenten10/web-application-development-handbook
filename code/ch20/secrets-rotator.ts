// Starter for 20.4 課題20.4: Secrets ローテーション スクリプト (★★)
// Purpose: Vault や AWS Secrets Manager 風の「シークレットを定期的にローテーション」する仕組みを実装。
// TODO:
// - シークレットストア(暗号化された JSON)
// - ローテーション policy(N 日経過で更新)
// - 古い値も一定期間保持(N - 7 日前まで)
// - アクセス監査ログ

export const exerciseId = "20.4";
// TODO: implement the exercise.

// --- 実装すべき公開API (KEN-61 生成。手で書き換えない) ---
// 完成条件と章のテストは、次の名前と形が公開されている前提で書かれている。
// 別の名前で実装すると、演習カードの「テスト方法」を自分の実装に対して実行できない。
//
//   export class SecretStore
//     constructor(private readonly file:string,private readonly masterKey:string,private readonly now:()=>Date=()=>new Date())
//     async set(name:string,input:{value:string;metadata:{rotationDays:number}})
//     async get(name:string,options:{version?:'current'|'previous'}={}):Promise<string>
//     async needsRotation(name:string)
//     async rotate(name:string,generate:()=>Promise<string>|string,graceDays=7)
//     async audit()
//   export function generateRandomPassword(bytes=24)
//
// 実装し終えてから読む模範解答: code/ch20/secrets-rotator.solution.ts
// --- ここまで ---
