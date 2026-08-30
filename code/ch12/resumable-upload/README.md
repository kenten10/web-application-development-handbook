# 課題12.6: 再開可能アップロードの中断を再現して直す (★★★)

## 目的

署名条件の欠落、受信済みオフセットを答えられないサーバ、条件なしの追記、中断セッションの放置という4件を、決まった位置で切れる回線の模擬の上で再現し、修正実装では再現しなくなることを確かめる。

## 開始地点

`starter/main.ts`（実行入口は `starter/report.ts`）

## 模範解答

`solution/main.ts`（実行入口は `solution/report.ts`）

## 実行・確認

```bash
pnpm --filter @handbook/ch12 exec tsx resumable-upload/solution/report.ts
pnpm --filter @handbook/ch12 run test
```

章READMEのコマンドと本文の評価基準に従ってください。同じ `runFindings` を `naive` サーバと `fixed` サーバの両方へ適用し、4/4 から 0/4 へ変わることを示せることが、この課題の合否条件です。外部のオブジェクトストレージへは接続しません。
