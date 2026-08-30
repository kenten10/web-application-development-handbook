// Starter for 23.7 課題23.7: 依存パッケージ脆弱性スキャナ (★★)
// Purpose: npm audit 風のツールを自作。package.json と package-lock.json を読んで、脆弱性 DB (簡易版) と照合。
// TODO:
// - package-lock.json から依存ツリーを抽出
// - 既知脆弱性 DB(本実装では簡易JSON)と照合
// - semver マッチング
// - 結果を CRITICAL / HIGH / MEDIUM / LOW で分類

export const exerciseId = "23.7";
// TODO: implement the exercise.
