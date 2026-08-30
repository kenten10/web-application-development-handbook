# 課題6.6: フォーカスとエラー通知の欠落を再現して塞ぐ (★★★)

## 目的

モーダルのフォーカス移動・閉じ込め・復帰の欠落と、送信エラーが支援技術へ届かない状態の4件を、ブラウザを使わずに再現し、実装を差し替えると1件も残らず、かつ正しい入力が素通りし続けることを確かめる。

## 開始地点

`starter/main.ts`（実行入口は `starter/report.ts`）

## 模範解答

`solution/main.ts`（実行入口は `solution/report.ts`）

## 実行・確認

```bash
pnpm --filter @handbook/ch06 exec tsx a11y-focus/solution/report.ts
pnpm --filter @handbook/ch06 run test
```

## 注意

ここで扱うのは純粋なデータ構造であり、実ブラウザや支援技術の挙動をすべて再現するものではありません。25.11 の3層のうち、自動検査の層に相当します。キーボード走査と読み上げ確認は、実際の環境で別途行ってください。
