# Starter — 課題4.1: レンダリングパイプラインを計測する (★)

**目的**: リフローとリペイントが実際にいつ起きているかを、計測して確認する。

## この starter に入っているもの

- `index.html` ― 1000要素のステージ、3方式のボタン、`performance.mark` / `performance.measure` による計測の枠。
  各ボタンのハンドラは空になっており、そこに実装を書く。

計測対象のページを白紙から作る必要はない。この演習で確かめたいのは
「どの書き方でLayoutとPaintが何回走るか」であって、HTMLの組み立てではない。

## 手順

1. `npx http-server code/ch04/render-bench/starter -p 8080` などで配信し、ブラウザで開く。
2. DevTools の Performance パネルで記録を開始する。
3. `index.html` の TODO(1)〜(3) を1つずつ実装し、そのつどボタンを押して記録する。
4. 記録の Main レーンで Layout / Paint / Composite Layers の回数と所要時間を読み、
   User Timing レーンの `bad` / `better` / `best` と突き合わせる。
5. 3方式の Layout 回数・Paint 回数・所要時間を表にまとめる。

## 記録する内容

| 方式 | Layout 回数 | Paint 回数 | 所要時間 | 何がボトルネックか |
|---|---|---|---|---|
| bad | | | | |
| better | | | | |
| best | | | | |

模範解答 (`../index.solution.html`) は、3方式を実装し終えてから開いて突き合わせる。
