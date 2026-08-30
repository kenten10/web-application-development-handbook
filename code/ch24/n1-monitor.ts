// Starter for 24.4 課題24.4: N+1 自動検出 + DataLoader 比較 (★★)
// Purpose: 課題14.3 を発展させ、N+1 が起きると警告するモニタリングを実装。
// TODO:
// - DB アクセス層に hook を入れ、同一クエリパターンが N 回 (デフォルト 5回) 同じリクエスト内で発火したら警告
// - AsyncLocalStorage でリクエストスコープを判定
// - 警告には stack trace を含める

export const exerciseId = "24.4";
// TODO: implement the exercise.
