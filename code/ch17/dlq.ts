// Starter for 17.3 課題17.3: Dead Letter Queue + 指数バックオフ (★★)
// Purpose: メッセージ処理が失敗したときの自動再試行と「諦めるべき時の DLQ 退避」を実装。
// TODO:
// - 最大 5 回まで再試行
// - 各リトライで指数バックオフ(1秒、2秒、4秒、8秒、16秒)
// - 5回失敗で DLQ に移動 + 元キューから削除
// - DLQ メッセージは手動で再投入可能

export const exerciseId = "17.3";
// TODO: implement the exercise.
