// Starter for 13.4 課題13.4: HMAC-SHA256 Webhook 署名検証 (★★)
// Purpose: Stripe / GitHub の Webhook 署名検証ロジックを自作。
// TODO:
// - 送信側: body + timestamp を秘密鍵で HMAC 署名
// - 受信側: 検証(タイミング安全比較、timestamp 5分以内チェック)
// - リプレイ攻撃対策

export const exerciseId = "13.4";
// TODO: implement the exercise.
