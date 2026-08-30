# 課題23.9: アップロードファイルの受け入れ判定を破って塞ぐ (★★★)

## 目的

MIME 偽装、多重拡張子、圧縮爆弾、配信ヘッダの不足という4件を無害な検体で再現し、判定を差し替えると1件も通らず、かつ正当なファイルは受理され続けることを確かめる。

## 開始地点

`starter/main.ts`（実行入口は `starter/report.ts`）

## 模範解答

`solution/main.ts`（実行入口は `solution/report.ts`）

## 実行・確認

```bash
pnpm --filter @handbook/ch23 exec tsx upload-validation/solution/report.ts
pnpm --filter @handbook/ch23 run test
```

## 安全上の注意

検体はすべて `crypto` を使わずに組み立てた無害なバイト列で、実際のマルウェアやエクスプロイトを含みません。バイト列はプロセス外へ書き出しません。実検体を扱う場合は隔離環境と組織の規程に従ってください。
