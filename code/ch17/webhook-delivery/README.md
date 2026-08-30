# 課題17.5: Webhook 配送の失敗を再現して冪等・順序耐性にする (★★★)

## 目的

生ボディでない署名検証、重複配送、順序逆転、欠落の4件を固定の配送表で再現し、受信側の実装を差し替えると1件も再現しなくなることを確かめる。

## 開始地点

`starter/main.ts`（実行入口は `starter/report.ts`）

## 模範解答

`solution/main.ts`（実行入口は `solution/report.ts`）

## 実行・確認

```bash
pnpm --filter @handbook/ch17 exec tsx webhook-delivery/solution/report.ts
pnpm --filter @handbook/ch17 run test
```

章READMEのコマンドと本文の評価基準に従ってください。同じ `runFindings` を `naive` 受信側と `guarded` 受信側の両方へ適用し、4/4 から 0/4 へ変わることを示せることが、この課題の合否条件です。送信側と受信側は同一プロセス内にあり、ネットワークへは出ません。
