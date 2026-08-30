// Starter for 18.2 課題18.2: ファイルディスクリプタとリーク検出 (★★)
// Purpose: 「FD を閉じ忘れる」とどうなるか、ulimit -n まで使い切る実演。
// TODO:
// - 1000ファイルを意図的に開きっぱなしにする
// - /proc/self/fd/ で実際の FD 数を確認(Linux)
// - 適切な close 処理を入れた版と比較

export const exerciseId = "18.2";
// TODO: implement the exercise.
