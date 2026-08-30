// Starter for 19.3 課題19.3: ローリングアップデート シミュレーション (★★)
// Purpose: Kubernetes の maxSurge / maxUnavailable 設定が実際にどう動くか観察。
// TODO:
// - 10 個の "Pod" を持つ Deployment
// - 新バージョンへのローリング: maxSurge=25%, maxUnavailable=25%
// - 各ステップで「Ready Pod 数(旧/新)」「総 Pod 数」を表示
// - ヘルスチェック失敗率を設定できる(失敗で再起動)

export const exerciseId = "19.3";
// TODO: implement the exercise.

// --- 実装すべき公開API (KEN-61 生成。手で書き換えない) ---
// 完成条件と章のテストは、次の名前と形が公開されている前提で書かれている。
// 別の名前で実装すると、演習カードの「テスト方法」を自分の実装に対して実行できない。
//
//   export type RolloutState
//   export class Rollout
//     constructor( readonly options: { replicas: number; oldVersion: string; newVersion: string; maxSurge: number; maxUnavailable: number; newPodFailureRate?: number; random?: () => number; }, )
//     async execute(onStep?: (state: RolloutState) => void): Promise<RolloutState[]>
//
// 実装し終えてから読む模範解答: code/ch19/rollout-simulator.solution.ts
// --- ここまで ---
