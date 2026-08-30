# CHANGELOG

本書のすべての重要な変更をこのファイルに記録する。

書式は [Keep a Changelog 1.1.0](https://keepachangelog.com/ja/1.1.0/) に従い、版番号は [Semantic Versioning 2.0.0](https://semver.org/lang/ja/) に従う。MAJOR・MINOR・PATCHが本文とコードそれぞれで何を意味するかは [`RELEASE_POLICY.md`](./RELEASE_POLICY.md) の第3節に定義する。

版番号の正本は [`config/release.json`](./config/release.json) の `version` である。このファイルの最新の版見出しと日付は、その正本および `package.json` の `version` と一致していなければならない。`pnpm run validate:release-policy` が一致を検証する。

分類は次の6種類だけを使う。

- **Added** — 追加した章・節・演習・機能
- **Changed** — 既存の記述・コードの変更
- **Deprecated** — 次のMAJORで削除する予定の記述・API
- **Removed** — 削除した記述・演習・コード
- **Fixed** — 誤りの訂正とバグ修正。[`ERRATA.md`](./ERRATA.md) に登録済みの項目はIDを併記する
- **Security** — 脆弱性の修正、危険な記述の是正

## [Unreleased]

版番号は上げない。本文・演習・サンプルコード・検証基準はいずれも変更していないため、`config/release.json` の `version` は `1.0.0` のままである。

### Added

- `reports/` を新設し、その一覧と各レポートの内容を示す `reports/README.md` を追加した。`README.md` の「構成」と「正本」に `reports/` の位置づけ（記録であり正本ではない）を追記した。
- `config/release.json` のライセンス判定規則に `reports/data/**`（コード）と `reports/**`（本文）を追加し、`LICENSING.md` の判定規則表を同じ内容へ更新した。移動したファイルが判定規則に一致しない状態を作らないための追加であり、判定対象からの除外はしていない。

### Changed

- ルート直下に置いていたissue単位の作業レポート24本を `reports/` へ、検証結果データ9本を `reports/data/` へ移動した。本文の正本（`00-front-matter.md`〜`10-index.md`）、方針・運用文書、`config/`・`code/`・`scripts/` は移動していない。
- 移動に伴い、`README.md`、`BACKLOG_V1_1.md`、`CLEAN_ENVIRONMENT.md`、`BETA_REVIEW_FINDINGS.md`、`RELEASE_v1.0.0_EVIDENCE.md`、`config/editorial-fixes.json`、`.verification/ken66/verify.mjs` と各レポート内の参照パスを新しい配置へ更新した。

### Fixed

- なし

## [1.0.0] - 2026-08-30

初版。全7部・30章の本文、章別サンプルコード、演習と模範解答、学習ルート、検証基盤を公開する。

公開時点の制約を2点記録する。第1に、`.github/workflows/ci.yml` の必須ジョブはGitHubアカウントの課金設定によって起動せず、**GitHub Actions上での成功証跡を取得できていない**。CIが実行するコマンドはすべて、クリーンなクローン上でNode.js 24.18.0とpnpm 11.15.1を用いてローカル実行し、終了コード0を確認している。第2に、非公開リポジトリかつ無料プランのため、`main` のrulesetによる保護とGitHub Pagesの配信を有効にできていない。いずれも [`RELEASE_v1.0.0_EVIDENCE.md`](./RELEASE_v1.0.0_EVIDENCE.md) に判定と根拠を残し、残作業を [`BACKLOG_V1_1.md`](./BACKLOG_V1_1.md) とLinearのKEN-733へ分離している。

### Added

- 全7部・30章の本文Markdown（`02-part1-foundations.md`〜`08-part7-practice.md`）
- 本文見出しから生成する目次（`01-toc.md`）と索引メタデータから生成する索引（`10-index.md`）
- 全節の学習レベル・推定時間の分類（`config/learning-levels.json`、`LEARNING_LEVELS.md`）
- 標準通読と5つの目的別ルート（`config/learning-paths.json`、`LEARNING_PATHS.md`）
- 全30章の学習ガイドと11教材要素（`config/chapter-guides.json`、`CHAPTER_TEMPLATE.md`）
- 章別サンプルコードとpnpm workspace（`code/ch01/`〜`code/ch30/`）
- 演習カード、starterとsolutionの導線、自己採点用チェックリスト（`config/exercises.json`、`CODE_EXERCISES.md`）
- 固定ツールチェーンとdevcontainerによるクリーン環境（`CODE_TOOLCHAIN.md`、`CLEAN_ENVIRONMENT.md`、`.devcontainer/`）
- GitHub Actionsの必須ゲートと拡張検証（`.github/workflows/ci.yml`、`.github/workflows/extended-ci.yml`、`CI.md`）
- ベータレビュー計画、シナリオ、テンプレート、release blocker定義（`BETA_REVIEW_PLAN.md`ほか）
- 公開形式・ライセンス・版管理・更新方針（`RELEASE_POLICY.md`、`LICENSE`、`LICENSE-TEXT`、`LICENSING.md`、`ERRATA.md`、`config/release.json`）
- 静的サイト生成パイプラインとGitHub Pagesデプロイ（`scripts/build-site.mjs`、`.github/workflows/pages.yml`）
- 正誤報告・改訂提案のissueテンプレート（`.github/ISSUE_TEMPLATE/`）

### Security

- 第23章の脆弱コード例を隔離環境前提の教材として位置づけ、本番利用不可の警告を演習カードへ明記した
- GitHub Actionsで使用するactionをすべて完全なcommit SHAへ固定し、`GITHUB_TOKEN` の権限を `contents: read` に限定した

---

## 運用ルール

1. 変更はまず `## [Unreleased]` の該当分類へ追記する。分類が不要な場合も見出しは残し、本文を「なし」とする。
2. リリース時に `## [Unreleased]` の内容を新しい版見出しへ移し、`config/release.json` の `version` と `releaseDate`、`package.json` の `version` を同時に更新する。
3. `## [Unreleased]` は空の状態で残し、次の変更の受け皿とする。
4. 正誤表由来の修正は `Fixed` へ書き、`[E-2026-001]` のようにERRATA IDを併記する。
5. MAJOR版では、章番号・節番号の移動表を版見出しの直下へ記載する。読者が旧番号から新番号を引けるようにする。
6. RB-08（推定所要時間の乖離）を例外承認した場合は、乖離した章と実測値を該当版の `Changed` へ記載する。
7. 版見出しの書式は `## [MAJOR.MINOR.PATCH] - YYYY-MM-DD` に固定する。この書式から外れると検証が失敗する。
