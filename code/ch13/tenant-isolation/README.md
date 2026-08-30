# 課題13.7: テナント境界の漏洩を再現して塞ぐ (★★★)

## 目的

主キー直接参照、全文検索、親の付け替え、キャッシュキーの4経路でテナント境界が破れることを実際に再現し、Row-Level Security に相当するポリシー層を通すと同じ手順で再現しなくなることを確かめる。

## 開始地点

`starter/main.ts`（実行入口は `starter/report.ts`）

## 模範解答

`solution/main.ts`（実行入口は `solution/report.ts`）

## 実行・確認

```bash
pnpm --filter @handbook/ch13 exec tsx tenant-isolation/solution/report.ts
pnpm --filter @handbook/ch13 run test
```

章READMEのコマンドと本文の評価基準に従ってください。同じ `probeLeaks` を境界の抜けた実装とポリシー層つき実装の両方へ適用し、4/4 から 0/4 へ変わることを示せることが、この課題の合否条件です。
