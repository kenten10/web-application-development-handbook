# Contributing Guide

この文書は、『WEBアプリケーション開発者になれる解説書 ― 基礎から一流までの30章 ―』の本文、目次、索引、サンプルコードを一貫した方法で編集・管理するための規約を定める。

## 1. 正本（Single Source of Truth）

### 1.1 本文

本文の正本は、このリポジトリ内のMarkdownファイルとする。

- `00-front-matter.md`
- `02-part1-foundations.md`
- `03-part2-frontend.md`
- `04-part3-backend.md`
- `05-part4-data.md`
- `06-part5-infrastructure.md`
- `07-part6-quality.md`
- `08-part7-practice.md`
- `09-references.md`

章番号、節番号、見出し名、章間参照は、本文Markdownに記載された内容を正とする。

本文と目次・索引・外部共有物の内容が食い違う場合は、本文Markdownを基準に修正する。ただし、本文側に誤りがあることが明らかな場合は、本文を先に修正してから生成物を更新する。

### 1.2 目次

`01-toc.md` は本文見出しから自動生成する生成物とする。

- 目次を直接編集しない。
- 章・節の追加、削除、改名、移動は本文Markdownで行う。
- 本文更新後に目次生成コマンドを実行する。
- CIでは、目次を再生成したときに差分が発生しないことを検証する。

### 1.3 索引

`10-index.md` は本文側に付与する索引メタデータから生成する生成物とする。

- 索引本文を直接編集しない。
- 索引語の追加・削除・参照先変更は、本文側の索引メタデータで行う。
- 索引生成方式とメタデータ記法は、生成スクリプト導入時に確定する。
- CIでは、索引の全参照先が実在する章・節を指すことを検証する。

### 1.4 学習レベルと学習ルート

- `config/learning-levels.json` は全節の分類と推定時間の正本とする。
- `LEARNING_LEVELS.md` と本文側の `handbook:learning` は生成物とする。
- `config/learning-paths.json` は標準通読、目的別ルート、途中参加チェックの正本とする。
- `LEARNING_PATHS.md` は生成物とし、直接編集しない。
- 節の追加・削除・改名時は、分類マニフェストとルートマニフェストの双方を確認する。

### 1.5 章共通教材テンプレート

- `config/chapter-guides.json` は、全30章の学習ガイドの正本とする。
- 本文中の `handbook:chapter-guide` ブロックと `CHAPTER_TEMPLATE.md` は生成物とし、直接編集しない。
- 章の追加・改名、節の移動時は、前提知識・中核概念・最小実装・演習の節参照を更新する。
- 教育用自作実装を含む章では、本番利用できない理由または省略した保証を必ず記載する。

### 1.6 本文の概念接続と物語構造

- 本文の章・節間の接続方針は `NARRATIVE_EDITING_GUIDE.md` を正本とする。
- 全30章の因果関係と部をまたぐ学習の流れは `NARRATIVE_ARCHITECTURE.md` を参照する。
- 新しい概念は定義から唐突に始めず、直前までの知識で解けない問題、必要な性質、新概念が追加する責務の順に導入する。
- 章冒頭には前章の到達点、本章を必要とする未解決問題、本章が次章へ渡す理解を文章で含める。
- 主要節の接続文には `handbook:narrative-bridge` コメントを付与し、本文の表示を変えずに編集状況を追跡できるようにする。
- 章末は用語の再掲だけで終えず、処理・設計・診断の流れへ再統合し、次章へ残る問いを示す。
- 技術的主張、コード、引用、アンカー、生成ブロックの意味を文章接続のために変更しない。

### 1.7 サンプルコード

サンプルコードの正本はGitリポジトリとする。

Google Drive上のコードは、閲覧・共有用の複製として扱う。Drive上のファイルを直接編集して正本にしない。

コードを変更する場合は、必ずGitリポジトリで修正し、レビュー・検証後にGoogle Driveへ同期する。


### 1.8 コード教材のツールチェーン

- 標準バージョンと統一コマンドの正本は `CODE_TOOLCHAIN.md`、`package.json`、`pnpm-workspace.yaml` とする。
- Node.jsは `.node-version` と `.nvmrc`、pnpmは `packageManager`、共通パッケージはpnpm catalogで固定する。
- 章固有の依存関係はルートではなく `code/chXX/package.json` に宣言する。
- 未実装のlint、typecheck、test、buildを黙ってskipせず、`config/workspace-exceptions.json` に追跡issueと理由を記録する。
- Dockerは外部サービス、Linux固有機能、隔離が必要な演習に限定する。
- クリーン環境の区分と必要証跡は `config/clean-environment-plan.json` を正本とし、ブラウザ・外部サービス項目を自動テストだけで完了扱いにしない。
- 固定環境の再現手順は `.devcontainer/` と `scripts/bootstrap-clean-environment.sh` で管理する。

### 1.9 表記・用語・コード・図表のスタイル

- 表記、用語、コードブロック、図表、注記の規約は [`STYLE_GUIDE.md`](STYLE_GUIDE.md) を正本とする。各ルールにはID (`S-JA-001` など) を与え、章レビューと編集校正はこのIDで指摘する。
- ルールID、検査対象、語彙一覧、未修正件数のベースラインは `config/style-guide.json` を正本とする。
- 用語の正表記・別表記・定義は `config/glossary.json` を正本とし、`GLOSSARY.md` は生成物とする。直接編集しない。
- `STYLE_BACKLOG.md` は未修正の違反一覧であり、検査結果からの生成物とする。直接編集しない。
- 本文の文体は常体 (だ・である調)、`README.md`、`CONTRIBUTING.md`、`code/chXX/README.md` などの運用文書は敬体とする。
- 索引語は用語集の正表記と一致させる。`pnpm run validate:style` が本文と `10-index.md` の双方を検査する。
- 機械適用できるルールは `pnpm run apply:style-fixes` で一括適用する。本文を手作業で大量置換しない。

### 1.10 公開・ライセンス・版管理

- 公開形式、ライセンス判定規則、版番号、章別の見直し周期、サポート範囲の正本は `config/release.json` とする。
- `RELEASE_POLICY.md` と `LICENSING.md` は正本の内容を人が読む形で説明する文書とし、正本から逸脱させない。
- `CHANGELOG.md` と `ERRATA.md` は手動で維持する。生成物ではないが、書式は `config/release.json` の `changelog` と `errata` に従う。
- 版番号は `config/release.json`、`package.json`、`CHANGELOG.md` の3か所で一致させる。
- `dist/site/` の生成HTMLは生成物であり、直接編集しない。生成は `scripts/build-site.mjs` が行う。
- 上記の一致は `pnpm run validate:release-policy` が検証する。ライセンス判定規則に一致しないファイルを追加すると検証が失敗する。

## 2. 標準ディレクトリ構成

サンプルコードは、章ごとに次の標準パスへ配置する。

```text
code/
├── ch01/
├── ch02/
├── ...
└── ch30/
```

章番号は必ず2桁のゼロ埋めとする。

- 正: `code/ch01/`, `code/ch07/`, `code/ch30/`
- 誤: `code/ch1/`, `code/ch7/`, `code/ch030/`

本文からコードを参照するときは、リポジトリルートからの相対パスを用いる。

```text
code/ch07/redux.ts
code/ch14/n-plus-one/
```

## 3. 章・節番号と見出し

### 3.1 章見出し

章見出しは次の形式とする。

```markdown
## 第7章 状態管理
```

### 3.2 節見出し

節見出しは次の形式とする。

```markdown
### 7.1 状態管理とは何か
### 7.2 Reduxの基本
```

### 3.3 番号の規則

- 章番号は1から30までの連番とする。
- 節番号の整数部は所属する章番号と一致させる。
- 同じ章の中で節番号を重複させない。
- 節の追加・削除時は、本文・章間参照・索引メタデータを同時に更新する。
- 見出しアンカーは生成スクリプトが扱える形式を維持する。

## 4. コード教材の命名規則

各演習は、可能な限り「開始用コード」と「模範解答」を分離する。

### 4.1 単一ファイル課題

```text
feature.ts
feature.solution.ts
```

React JSXを含む場合は、両方とも同じ拡張子にする。

```text
form-validation.tsx
form-validation.solution.tsx
```

### 4.2 ディレクトリ単位の課題

```text
feature/
feature-solution/
```

または、1つのディレクトリ内で明確に分離する。

```text
feature/
├── starter/
└── solution/
```

同じ書籍内では、採用した方式を統一する。

### 4.3 README

各章の `code/chXX/README.md` には、最低限次を記載する。

- 対応する章・演習番号
- 学習目的
- 前提環境
- セットアップ手順
- 実行コマンド
- 期待結果
- starterとsolutionの対応
- 既知の制約
- セキュリティ上の注意

READMEに記載されたファイル名・コマンドは、実ファイルおよび `package.json` と一致させる。

### 4.4 模範解答の完成条件

- solutionは要件一覧や本文スニペットへの参照だけではなく、実行または観察できる実装を含める。
- `referenceArtifact = true`、`model answer scaffold`、チェックリストだけのREADME/HTMLを模範解答として登録しない。
- 外部サービスが必要な演習は、サービス起動、環境変数、終了処理、期待結果をREADMEへ記載する。
- 手動演習は、確認項目と記録テンプレートを用意する。
- `pnpm run validate:exercises` が `SOLUTION_PLACEHOLDER` を報告する状態では、演習整備を完了扱いにしない。
- starterが `name.ts` なら solution は `name.solution.ts`、`starter/` なら `solution/` に対応させる。対応が取れない登録は `STARTER_SOLUTION_UNPAIRED` で拒否される。

### 4.5 演習カードの必須項目

章末の各課題は、本文の見出し直下に「演習カード」を持つ。カードは `config/exercises.json` から `scripts/apply-exercise-rubrics.mjs` で生成し、手編集しない。

| 項目 | キー | 件数 | 書き方 |
|---|---|---:|---|
| 目的 | `purpose` | 1 | その課題で確認する原理を1文で示す |
| 難易度 | `difficulty` | 1 | 1〜3。本文見出しの★数と一致させる |
| 推定時間 | `minutes` / `estimateBasis` | 1 | 5分刻み。内訳を `estimateBasis` に残す |
| 前提 | `prerequisites` | 2〜6 | 先に読む節、必要な知識、必要な環境 |
| 完成条件 | `completion` | 3〜8 | 二値判定できる条件のみ。「理解する」は不可 |
| 期待出力 | `expected` | 2〜8 | 出力の形（列数、キー、ステータス、レンジ） |
| 観察項目 | `observations` | 2〜8 | どのツールのどこを見て何が読めるか |
| テスト方法 | `verification` | 2〜8 | 1件以上に実行コマンドをバッククォートで含める |
| 段階的ヒント | `hints` | 3 | 方針→構造→実装の要点の順に詳細化する |
| 本番利用時の警告 | `warnings` | 1〜4 | 省略した保証と、そのまま使った場合の被害を書く |

- 汎用テンプレート文をそのまま残さない。`RUBRIC_ITEM_BOILERPLATE` で拒否される。
- 各項目は1行のプレーンテキストにする。改行、`|`、行頭の箇条書き記号・括弧、Markdownリンク記法は使わない。
- コード成果物を持たない観察課題は `observationExercises` へ登録し、同じ項目を必ず備える。

## 5. Google Driveへの同期

Google Driveは、読者・レビュー担当者がコードを閲覧または共有するための複製先とする。

同期時は次を守る。

1. Gitリポジトリ側の変更を先に確定する。
2. lint、typecheck、test、buildなど必要な検証を通す。
3. `code/ch01/` から `code/ch30/` の構造を維持してDriveへ反映する。
4. `node_modules`、`dist`、一時ファイル、シークレットを同期しない。
5. Drive上で独自の変更が発生した場合は、正本へ逆輸入する前に差分を確認する。

DriveとGitリポジトリの内容が食い違う場合、Gitリポジトリを正とする。

## 6. 変更手順

本文またはコードを変更するときは、原則として次の順序で作業する。

1. 本文MarkdownまたはGit管理されたコードを修正する。
2. 章・節番号、章間参照、コードパスを確認する。
3. 目次と索引を再生成する。
4. 検証スクリプトを実行する。
5. サンプルコードのlint、typecheck、test、buildを実行する。
6. 生成物を含めて差分をレビューする。
7. Gitリポジトリへコミットする。
8. 必要に応じてGoogle Driveへ同期する。

## 7. 手動編集してよいもの・いけないもの

| 対象 | 手動編集 | 備考 |
|---|---|---|
| 本文Markdown | 可 | 正本 |
| 参考文献Markdown | 可 | 正本 |
| 本文側の索引メタデータ | 可 | 正本 |
| `01-toc.md` | 不可 | 自動生成物 |
| `10-index.md` | 不可 | 自動生成物 |
| `LEARNING_LEVELS.md` | 不可 | 自動生成物 |
| `LEARNING_PATHS.md` | 不可 | 自動生成物 |
| `CHAPTER_TEMPLATE.md` | 不可 | 自動生成物 |
| `GLOSSARY.md` | 不可 | 自動生成物 |
| `STYLE_BACKLOG.md` | 不可 | 自動生成物 |
| `STYLE_GUIDE.md` | 可 | 表記・用語・図表規約の正本 |
| `config/style-guide.json` | 可 | ルールIDと検査設定の正本 |
| `config/glossary.json` | 可 | 用語の正表記・別表記の正本 |
| `CODE_TOOLCHAIN.md` | 可 | コード教材の標準環境と運用方針 |
| `config/workspace-exceptions.json` | 可 | 一時的な検証除外と追跡issueの正本 |
| `config/learning-levels.json` | 可 | 学習レベルと推定時間の正本 |
| `config/learning-paths.json` | 可 | 通読順序、目的別ルート、途中参加チェックの正本 |
| `config/chapter-guides.json` | 可 | 全30章の教材ガイドの正本 |
| 本文側の `handbook:chapter-guide` ブロック | 不可 | 章ガイド定義から生成 |
| 本文側の `handbook:learning` メタデータ | 不可 | 分類マニフェストから生成 |
| `BETA_REVIEW_PLAN.md` | 不可 | `beta-review-scope.json` からの生成物 (KEN-60) |
| `BETA_REVIEW_SCENARIOS.md` | 不可 | `beta-review-scope.json` からの生成物 (KEN-60) |
| `BETA_REVIEW_TEMPLATES.md` | 不可 | `beta-review-scope.json` からの生成物 (KEN-60) |
| `beta-review-scope.json` | 可 | ベータ読者レビューの範囲・観点・重大度の正本 (KEN-60)。章タイトルは `config/narrative-flow.json` と一致させる |
| `config/links.json` | 可 | リンク検査の対象・規則・到達性検査の設定の正本 |
| `config/editorial-fixes.json` | 可 | 全文校正で確定した個別修正の正本。本文へは `apply:editorial-fixes` で反映する |
| 本文側の `handbook:code-usage` ブロック | 不可 | `config/exercises.json` から生成 |
| 本文の「所要時間: 演習カードの推定時間の合計で…」 | 不可 | `config/exercises.json` から生成 |
| Gitリポジトリ内のコード | 可 | 正本 |
| Google Drive上のコード | 原則不可 | 閲覧・共有用複製 |

## 8. Pull Requestの確認項目

- [ ] 本文の章・節番号に欠番や重複がない
- [ ] 目次を再生成済み
- [ ] 索引を再生成済み
- [ ] 新規・改名した節の学習レベルと推定時間を更新済み
- [ ] `pnpm run apply:learning-levels:check` が成功する
- [ ] `pnpm run generate:learning-paths:check` が成功する
- [ ] `pnpm run apply:chapter-guides:check` が成功する
- [ ] `pnpm run validate:style` がエラー0で成功する
- [ ] `pnpm run generate:glossary:check` が成功する
- [ ] `STYLE_BACKLOG.md` の未修正件数が増えていない
- [ ] 新しく導入した用語を `config/glossary.json` へ登録した
- [ ] 章間リンクが有効
- [ ] 本文中のコード参照先が存在する
- [ ] READMEの記載と実ファイルが一致する
- [ ] starterとsolutionの対応が明確
- [ ] `pnpm run validate:workspace` が成功する
- [ ] `pnpm run validate:ci` が成功する
- [ ] `pnpm run validate:clean-environment` と `pnpm run test:clean-environment` が成功する
- [ ] 必要なコード検証が成功する、または例外台帳に追跡issueがある
- [ ] Google Driveへ同期すべき変更か確認した
- [ ] シークレットや生成不要物が含まれていない

## 9. 自動検証

次のコマンドで原稿の整合性を検証する。

```bash
pnpm run apply:learning-levels:check
pnpm run generate:learning-paths:check
pnpm run apply:chapter-guides:check
pnpm run apply:code-usage:check
pnpm run apply:exercise-totals:check
pnpm run apply:editorial-fixes:check
pnpm run generate:handbook:check
pnpm run generate:glossary:check
pnpm run validate:links
pnpm run validate:handbook
pnpm run validate:style
pnpm run validate:beta-review
```

すべてをまとめて実行するには `pnpm run check:handbook` を使う。

現在、次の項目を自動検証する。

- 章番号1〜30の存在、欠番、重複
- 節番号の章番号一致、欠番、重複
- 本文と目次の章・節タイトル一致
- 索引参照先の存在
- 本文中のコードパス存在
- Markdown相対リンクの存在
- 同一Markdownファイル内の重複アンカー候補
- 全番号付き節の学習レベル・推定時間・分類マニフェストとの一致
- 学習ルートの参照先、重複、空ステージ、生成差分
- 全30章の章学習ガイド、11教材要素、章・節参照、生成差分
- 全143演習のクリーン環境区分、必要証跡、安全境界、devcontainer構成
- 日本語表記、句読点、全角半角、文体、記号の統一 (`STYLE_GUIDE.md` の S-JA・S-SYM 系)
- コードブロックの言語指定、表の区切り行、図の記法、注記ラベル (S-CODE 系)
- 用語の正表記、略語の初出併記、曖昧表現の根拠 (S-TERM・S-EN・S-VAGUE 系)
- 索引語と用語集の正表記の一致 (S-IDX 系)
- 索引メタデータの `group` が五十音の行かアルファベット1文字であること (INDEX_GROUP_INVALID)
- 内部Markdownリンクの参照先とアンカーの実在 (L-INT・L-ANC・L-SEC 系)
- 本文の「第N章」「N.M」参照が実在する章節を指すこと (L-XREF-001)
- 本文が参照する `code/` のパスと、「コード集の使い方」のコマンドの実在 (L-CODE 系)
- 引用キーが `09-references.md` に登録されていること (L-CITE-001)
- 外部URLの形式と表記の一致 (L-URL 系)。到達性検査は `pnpm run validate:links:external` で任意に実行し、`check:handbook` には含めない
- ベータ読者レビューの範囲・章タイトル・演習集合の整合 (`validate:beta-review`、KEN-60 の `beta-review-scope.json` が正本)

不整合がある場合は終了コード1を返す。検証スクリプト自体の回帰テストは次で実行する。

```bash
pnpm run test:handbook-validator
```

学習レベルの正本は `config/learning-levels.json`、学習ルートの正本は `config/learning-paths.json`、章学習ガイドの正本は `config/chapter-guides.json` とする。変更後は `pnpm run apply:learning-levels`、`pnpm run generate:learning-paths`、`pnpm run apply:chapter-guides`、`pnpm run generate:handbook` の順に実行する。

## ベータ読者レビューの正本

- レビュー範囲、章の tier (必須検証章・演習のみ・サンプリング)、ペルソナ、設問、重大度、リリースブロッカーは `beta-review-scope.json` を正本とする (KEN-60)。
- `BETA_REVIEW_PLAN.md` / `BETA_REVIEW_SCENARIOS.md` / `BETA_REVIEW_TEMPLATES.md` はその生成物であり、手編集しない。
- 章タイトルは `config/narrative-flow.json` を基準に照合される。章タイトルを変えたときは、本文・`config/narrative-flow.json`・`narrative-flow.json`・`beta-review-scope.json`・`config/exercises.json`・`config/chapter-guides.json` を同時に更新する。
- 変更後は `pnpm run validate:beta-review` と `pnpm run test:beta-review` を実行する。

## 全文校正で入れた個別修正の正本

- KEN-59 の全文校正で確定した個別修正は `config/editorial-fixes.json` を正本とし、`pnpm run apply:editorial-fixes` で本文と正本JSONへ適用する。
- 各修正は `id` / `file` / `note` / `from` / `to` を持ち、`note` に修正理由を書く。適用は冪等で、`--check` は未適用があると失敗する。
- 生成物 (演習カード、章ガイド、コード集の使い方) の中身を直す場合は、本文ではなく生成元の正本JSONを `file` に指定する。

## コード演習の正本

- 演習の開始地点・模範解答・必要サービス・推定時間は `config/exercises.json` を正本とします。
- 直接ファイル型は `<name>.<ext>` / `<name>.solution.<ext>`、複数ファイル型は `starter/` / `solution/` を使います。
- 演習カード（前提・完成条件・期待出力・観察項目・テスト方法・段階的ヒント・本番利用時の警告）も `config/exercises.json` を正本とします。
- 各章READMEは `scripts/generate-exercise-catalog.mjs` で再生成し、手編集しません。
- 本文の演習カードは `scripts/apply-exercise-rubrics.mjs` で再生成し、手編集しません。
- `node_modules/`、`dist/`、`coverage/`、秘密情報、計測生成物をコミットしません。

正本を変更したら、次の順に実行します。

```bash
pnpm run apply:exercise-rubrics
pnpm run generate:exercise-catalog
pnpm run validate:exercises
pnpm run test:exercises
pnpm run test:exercise-rubrics
```

## CIの変更

CIの正本は`config/ci-plan.json`、workflowは`.github/workflows/ci.yml`と`.github/workflows/extended-ci.yml`です。章を追加・削除した場合はCI matrixも同時に更新し、`pnpm run validate:ci`と`pnpm run test:ci`を実行してください。検証対象外は黙ってskipせず、`config/ci-plan.json`の拡張・手動区分へ理由が追跡できる形で登録します。詳細は`CI.md`を参照してください。

## クリーン環境検証

クリーン環境の正本は `config/clean-environment-plan.json`、再現手順は `CLEAN_ENVIRONMENT.md` と `.devcontainer/` です。固定版Node.js・pnpmで `bash scripts/bootstrap-clean-environment.sh` を実行し、ブラウザ手動・外部サービス演習は台帳の必要証跡を残します。`node_modules/`、`dist/`、`.verification/` は配布対象に含めません。

## 表記・用語のスタイル

表記、用語、コードブロック、図表、注記の規約は [`STYLE_GUIDE.md`](STYLE_GUIDE.md)、用語の一覧は [`GLOSSARY.md`](GLOSSARY.md) を参照してください。章をレビューするときは `STYLE_GUIDE.md` の「9. 章レビュー用チェックリスト」を使います。

正本を変更したら、次の順に実行します。

```bash
pnpm run apply:style-fixes
pnpm run apply:chapter-guides
pnpm run apply:exercise-rubrics
pnpm run generate:exercise-catalog
pnpm run generate:handbook
pnpm run generate:glossary
pnpm run report:style-backlog
pnpm run validate:style
pnpm run test:style
```

`config/style-guide.json` の `baselines` は未修正違反の上限です。修正して件数が減ったときだけ `pnpm run validate:style --update-baseline` で下げます。引き上げてはいけません。
