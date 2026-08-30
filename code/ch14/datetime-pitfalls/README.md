# 課題14.6: 日時バグを再現して直す (★★★)

## 目的

DST 境界、カレンダー日と瞬間の混同、24時間加算とカレンダー加算の取り違え、日境界のずれという4つの日時バグを固定の条件で再現し、修正実装では再現しなくなることを機械的に確かめる。

## 開始地点

`starter/main.ts`（実行入口は `starter/report.ts`）

## 模範解答

`solution/main.ts`（実行入口は `solution/report.ts`）

## 実行・確認

```bash
pnpm --filter @handbook/ch14 exec tsx datetime-pitfalls/solution/report.ts
pnpm --filter @handbook/ch14 run test
```

章READMEのコマンドと本文の評価基準に従ってください。判定はすべて固定の日時 (`FIXTURES`) に基づき、実行時の現在時刻とプロセスのタイムゾーンに依存しないことが、この課題の合否条件です。
