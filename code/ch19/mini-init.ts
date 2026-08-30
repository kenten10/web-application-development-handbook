// Starter for 19.4 課題19.4: 簡易 PID 1 init プロセス (★★)
// Purpose: コンテナで PID 1 として動くプロセスの役割(ゾンビ回収、シグナル伝搬)を理解。
// TODO:
// - 子プロセスを fork
// - SIGTERM を受け取ったら子に転送 + 終了
// - 子プロセスがゾンビ化したら waitpid で回収

export const exerciseId = "19.4";
// TODO: implement the exercise.

// --- 実装すべき公開API (KEN-61 生成。手で書き換えない) ---
// 完成条件と章のテストは、次の名前と形が公開されている前提で書かれている。
// 別の名前で実装すると、演習カードの「テスト方法」を自分の実装に対して実行できない。
//
//   export function runInit(command: string, args: string[] = []): Promise<number>
//
// 実装し終えてから読む模範解答: code/ch19/mini-init.solution.ts
// --- ここまで ---
