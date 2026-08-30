// Starter for 18.3 課題18.3: シグナルハンドリングとグレースフルシャットダウン (★★)
// Purpose: SIGTERM を受けたときに「進行中のリクエストを完了 → 新規拒否 → 終了」する実装。
// TODO:
// - HTTP サーバ
// - SIGTERM で:

export const exerciseId = "18.3";
// TODO: implement the exercise.

// --- 実装すべき公開API (KEN-61 生成。手で書き換えない) ---
// 完成条件と章のテストは、次の名前と形が公開されている前提で書かれている。
// 別の名前で実装すると、演習カードの「テスト方法」を自分の実装に対して実行できない。
//
//   export class GracefulHttpServer
//     constructor(private readonly handler: (request: http.IncomingMessage, response: http.ServerResponse) => Promise<void> | void)
//     listen(port: number): Promise<void>
//     get activeRequests(): number
//     async shutdown(timeoutMs = 30_000): Promise<'drained' | 'timeout'>
//
// 実装し終えてから読む模範解答: code/ch18/graceful-shutdown.solution.ts
// --- ここまで ---
