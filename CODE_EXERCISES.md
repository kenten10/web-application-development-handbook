# コード演習ガイド

<!-- handbook:generated; do not edit -->

全30章のコード教材は、直接ファイル型と複数ファイル型の2形式へ統一されています。

- 直接ファイル型: `name.ts` / `name.solution.ts`
- 複数ファイル型: `exercise/starter/` / `exercise/solution/` / `exercise/README.md`

## 演習カードの必須項目

全課題は本文の見出し直下に「演習カード」を持ちます。カードは `config/exercises.json` から生成され、次の項目を必ず備えます。

| 項目 | 内容 | 件数 |
|---|---|---:|
| 目的 | その課題で確認する原理 | 1 |
| 難易度 | ★1〜★3。本文見出しの★数と一致 | 1 |
| 推定時間 | 分単位。内訳を `estimateBasis` に記録 | 1 |
| 前提 | 先に読む節、必要な知識・環境 | 2〜6 |
| 完成条件 | 二値判定できる自己採点チェックリスト | 3〜8 |
| 期待出力 | 実行時に得られる出力の形 | 2〜8 |
| 観察項目 | 原理を確認するために見るもの | 2〜8 |
| テスト方法 | 実行コマンドを含む自己採点手順 | 2〜8 |
| 段階的ヒント | 方針→構造→実装の要点の3段階 | 3 |
| 本番利用時の警告 | 省略した保証と、そのまま使った場合の被害 | 1〜4 |
| 導線 | starterから対応するsolutionへの対応 | 1組 |

`node scripts/validate-exercises.mjs` がこれらの欠落・定型文・導線不一致を検出します。

## 模範解答の完成条件

- `solution` はREADMEや要件メモだけでなく、読者が実行・観察できる実装を含める。
- `referenceArtifact = true`、`model answer scaffold`、実装チェックリストだけのREADME/HTMLは未完成として扱う。
- `node scripts/validate-exercises.mjs` は未完成solutionを `SOLUTION_PLACEHOLDER` として拒否する。
- starterが `name.ts` なら solution は `name.solution.ts`、`starter/` なら `solution/` に1対1で対応する。
- 外部サービスや手動操作が必要な場合も、実行手順、期待結果、確認記録を残す。

## 全体集計

- 章数: 30
- 演習・補助教材単位: 143
- コード成果物を持たない観察課題: 4
- 演習カード総数: 147
- 難易度分布: ★ 10件 / ★★ 68件 / ★★★ 69件
- 推定時間合計: 287時間0分
- 本文コード参照: 156

## 第10章 サーバサイド言語とランタイム

- 課題数: 4
- 推定時間: 7時間15分
- [章README](code/ch10/README.md)

## 第11章 Webフレームワーク設計論

- 課題数: 4
- 推定時間: 8時間0分
- [章README](code/ch11/README.md)

## 第12章 API設計

- 課題数: 6
- 推定時間: 11時間15分
- [章README](code/ch12/README.md)

## 第13章 認証と認可

- 課題数: 7
- 推定時間: 14時間30分
- [章README](code/ch13/README.md)

## 第14章 リレーショナルデータベース

- 課題数: 7
- 推定時間: 15時間30分
- [章README](code/ch14/README.md)

## 第15章 NoSQLとデータモデリング

- 課題数: 5
- 推定時間: 8時間30分
- [章README](code/ch15/README.md)

## 第16章 検索エンジンと全文検索

- 課題数: 5
- 推定時間: 10時間30分
- [章README](code/ch16/README.md)

## 第17章 イベント駆動とメッセージング

- 課題数: 7
- 推定時間: 16時間30分
- [章README](code/ch17/README.md)

## 第18章 Linuxとネットワーク

- 課題数: 5
- 推定時間: 8時間45分
- [章README](code/ch18/README.md)

## 第19章 コンテナとオーケストレーション

- 課題数: 4
- 推定時間: 8時間40分
- [章README](code/ch19/README.md)

## 第20章 クラウドとIaC

- 課題数: 4
- 推定時間: 7時間0分
- [章README](code/ch20/README.md)

## 第21章 CI/CDとDevOps

- 課題数: 4
- 推定時間: 9時間0分
- [章README](code/ch21/README.md)

## 第22章 可観測性 (Observability)

- 課題数: 4
- 推定時間: 8時間0分
- [章README](code/ch22/README.md)

## 第23章 セキュリティ

- 課題数: 10
- 推定時間: 19時間0分
- [章README](code/ch23/README.md)

## 第24章 パフォーマンス

- 課題数: 5
- 推定時間: 9時間30分
- [章README](code/ch24/README.md)

## 第25章 テスト戦略

- 課題数: 4
- 推定時間: 8時間0分
- [章README](code/ch25/README.md)

## 第26章 スケーラビリティとアーキテクチャ

- 課題数: 6
- 推定時間: 11時間0分
- [章README](code/ch26/README.md)

## 第27章 設計とドメインモデリング

- 課題数: 5
- 推定時間: 10時間30分
- [章README](code/ch27/README.md)

## 第28章 大規模リファクタリングとレガシー対応

- 課題数: 4
- 推定時間: 8時間0分
- [章README](code/ch28/README.md)

## 第29章 LLMを組み込むWeb開発

- 課題数: 5
- 推定時間: 9時間30分
- [章README](code/ch29/README.md)

## 第30章 総合演習 ― 本番品質のSaaSをゼロから構築

- 課題数: 1
- 推定時間: 8時間0分
- [章README](code/ch30/README.md)

## 第1章 Webとは何か ― 歴史と全体像

- 課題数: 4
- うち観察課題 (コード成果物なし): 3
- 推定時間: 2時間20分
- [章README](code/ch01/README.md)

## 第2章 HTTPプロトコル徹底解剖

- 課題数: 5
- 推定時間: 7時間45分
- [章README](code/ch02/README.md)

## 第3章 URL・DNS・TLS

- 課題数: 5
- 推定時間: 8時間45分
- [章README](code/ch03/README.md)

## 第4章 HTML/CSS/JavaScriptの設計思想

- 課題数: 5
- 推定時間: 7時間0分
- [章README](code/ch04/README.md)

## 第5章 JavaScriptとTypeScriptの中核機構

- 課題数: 5
- 推定時間: 10時間30分
- [章README](code/ch05/README.md)

## 第6章 フロントエンドフレームワーク

- 課題数: 6
- 推定時間: 12時間15分
- [章README](code/ch06/README.md)

## 第7章 状態管理とデータフェッチング

- 課題数: 4
- 推定時間: 7時間0分
- [章README](code/ch07/README.md)

## 第8章 ビルドツールとモジュールバンドラ

- 課題数: 4
- 推定時間: 8時間0分
- [章README](code/ch08/README.md)

## 第9章 レンダリング戦略

- 課題数: 3
- うち観察課題 (コード成果物なし): 1
- 推定時間: 6時間30分
- [章README](code/ch09/README.md)

## 観察課題一覧 (コード成果物なし)

本文の手順に従って観察し、記録で自己採点します。演習カードは本文の見出し直下にあります。

| 課題 | 章 | 難易度 | 推定時間 | 本文 |
|---|---:|---:|---:|---|
| 課題1.1: ブラウザの開発者ツールでWebを覗く (★) | 第1章 | ★ | 20分 | `02-part1-foundations.md` |
| 課題1.2: curl で生のHTTP通信を見る (★) | 第1章 | ★ | 15分 | `02-part1-foundations.md` |
| 課題1.3: 静的サイトと動的サイトを見分ける (★★) | 第1章 | ★★ | 15分 | `02-part1-foundations.md` |
| 課題9.1: 4方式の Todo アプリ実装と性能比較 (★★★) | 第9章 | ★★★ | 150分 | `03-part2-frontend.md` |

