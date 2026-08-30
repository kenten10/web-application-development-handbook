# 課題17.6: 外部API連携の障害を再現して耐える (★★★)

## 目的

タイムアウト未設定、予算とジッタのないリトライ、サーキットブレーカ不在、送信後に冪等キーを書くメール送信の4件を、仮想時刻の上で再現し、耐障害実装では再現しなくなることを確かめる。

## 開始地点

`starter/main.ts`（実行入口は `starter/report.ts`）

## 模範解答

`solution/main.ts`（実行入口は `solution/report.ts`）

## 実行・確認

```bash
pnpm --filter @handbook/ch17 exec tsx external-api/solution/report.ts
pnpm --filter @handbook/ch17 run test
```

章READMEのコマンドと本文の評価基準に従ってください。すべての待機は `VirtualClock` 上で行うため、実時間の待機は発生しません。外部サービスへは接続しません。
