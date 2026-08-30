// Starter for 19.2 課題19.2: k8s manifest 検証ツール (★★★)
// Purpose: Kubernetes の YAML マニフェストを静的解析する社内ツールを書く。実プロダクトで kube-score、polaris、kubeval 等が果たす役割を自作する。
// TODO:
// - 本文に記載された観察結果または振る舞いを確認できる。

export const exerciseId = "19.2";
// TODO: implement the exercise.

// --- 実装すべき公開API (KEN-61 生成。手で書き換えない) ---
// 完成条件と章のテストは、次の名前と形が公開されている前提で書かれている。
// 別の名前で実装すると、演習カードの「テスト方法」を自分の実装に対して実行できない。
//
//   export type Severity
//   export type ManifestIssue
//   export function parseSimpleYaml(text: string): Manifest
//   export class ManifestValidator
//     validate(input: string | Manifest): ManifestIssue[]
//
// 実装し終えてから読む模範解答: code/ch19/manifest-validator/solution/main.ts
// --- ここまで ---
