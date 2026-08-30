// Starter for 12.2 課題12.2: GraphQL Resolver の N+1 を解決 ― DataLoader 自作 (★★★)
// Purpose: GraphQL の最大の罠「N+1 問題」を、DataLoader パターンで解決する。
// TODO:
// - 同じ tick 内の load() を自動的にバッチング
// - 同じキーで複数回 load してもネットワーク呼び出しは1回(キャッシュ)
// - loadMany([ids]) で複数キー一括
// - リクエスト終了でキャッシュクリア

export const exerciseId = "12.2";
// TODO: implement the exercise.
