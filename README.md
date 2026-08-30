# Web Application Development Handbook

Webアプリケーション開発を、基礎から設計・運用・品質・実践まで体系的に学ぶための全30章の教科書です。

## 構成

- `00-front-matter.md` — 前付け、対象読者、読み方
- `01-toc.md` — 目次（本文見出しから自動生成）
- `02-part1-foundations.md` — 第I部 基礎編
- `03-part2-frontend.md` — 第II部 フロントエンド編
- `04-part3-backend.md` — 第III部 バックエンド編
- `05-part4-data.md` — 第IV部 データ編
- `06-part5-infrastructure.md` — 第V部 インフラストラクチャ編
- `07-part6-quality.md` — 第VI部 品質編
- `08-part7-practice.md` — 第VII部 実践編
- `09-references.md` — 参考文献
- `10-index.md` — 索引（本文の索引メタデータから生成）
- `LEARNING_LEVELS.md` — 学習レベル、初回通読範囲、章別推定時間（分類マニフェストから生成）
- `LEARNING_PATHS.md` — 標準通読と5つの目的別ルート（ルートマニフェストから生成）
- `CHAPTER_TEMPLATE.md` — 全章共通の11教材要素と適用方針（章ガイド定義から生成）
- `STYLE_GUIDE.md` — 表記・用語・コード・図表・注記の規約とルールID、章レビュー用チェックリスト
- `GLOSSARY.md` — 用語の正表記・別表記・定義（用語集の正本から生成）
- `STYLE_BACKLOG.md` — 表記規約の未修正一覧（検査結果から生成）
- `NARRATIVE_ARCHITECTURE.md` — 全30章をつなぐ知識の因果関係と学習物語
- `NARRATIVE_EDITING_GUIDE.md` — 概念を問題・制約・解決の流れで導入する本文編集基準
- `CODE_TOOLCHAIN.md` — Node.js・pnpm・TypeScript・Docker・workspaceの標準方針
- `CLEAN_ENVIRONMENT.md` — devcontainer、固定環境検証、手動・外部サービス確認の基準
- `RELEASE_POLICY.md` — 公開形式、版管理、CHANGELOG・正誤表の運用、章別の見直し周期、サポート範囲
- `LICENSING.md` — 本文とコードのライセンス対応表（ファイル単位の判定規則）
- `CHANGELOG.md` — 変更履歴（Keep a Changelog形式）
- `ERRATA.md` — 正誤表と、正誤報告の受付から反映までの手順
- `BETA_REVIEW_PLAN.md` — ベータレビューのペルソナ、役割、重大度、release blocker、個人情報方針
- `BETA_REVIEW_SCENARIOS.md` — 役割別の検証シナリオと、最低限検証すべき章・演習の確定リスト
- `BETA_REVIEW_TEMPLATES.md` — ベータレビューの質問票、記録テンプレート、同意文面
- `beta-review-scope.json` — 検証対象章・演習、役割、重大度、release blockerの機械可読な正本
- `config/learning-levels.json` — 全415節の学習レベルと推定時間の正本
- `config/learning-paths.json` — 学習ルートの順序、前提、途中参加チェックの正本
- `config/chapter-guides.json` — 全30章の到達目標、前提、本番との差分、診断、判断、評価基準の正本
- `config/narrative-flow.json` — 章ごとの物語編集状況と必要な節間接続数の正本
- `config/clean-environment-plan.json` — 全143演習の環境区分、必要証跡、安全境界の正本
- `config/release.json` — 公開形式、ライセンス判定規則、版管理、章別の見直し周期、サポート範囲の正本
- `code/ch01/`〜`code/ch30/` — 章別サンプルコード

## 正本

- 本文の正本はMarkdown本文です。
- 目次、索引、学習レベル一覧、学習ルート、章共通教材テンプレート、本文中の章学習ガイドは生成物であり、直接編集しません。
- 学習レベルと推定時間の正本は `config/learning-levels.json` です。
- 学習ルートの正本は `config/learning-paths.json` です。
- 各章の学習ガイドの正本は `config/chapter-guides.json` です。
- 公開形式、ライセンス、版番号、見直し周期、サポート範囲の正本は `config/release.json` です。
- サンプルコードの正本はGitリポジトリです。
- Google Drive上のコードは閲覧・共有用の複製です。

編集規約とファイル配置の詳細は [`CONTRIBUTING.md`](./CONTRIBUTING.md)、表記・用語・図表の規約は [`STYLE_GUIDE.md`](./STYLE_GUIDE.md) と [`GLOSSARY.md`](./GLOSSARY.md) を参照してください。

## 公開・利用条件

本書の版は **1.0.0** です。版番号の正本は `config/release.json`、変更履歴は [`CHANGELOG.md`](./CHANGELOG.md)、既知の誤りは [`ERRATA.md`](./ERRATA.md) にあります。

### 公開形式

| 形式 | 位置づけ | 入口 |
|---|---|---|
| GitHubリポジトリ | 正本（Markdown本文とサンプルコード） | `kenten10/web-application-development-handbook`（現在は非公開） |
| 静的Webサイト（GitHub Pages） | 生成物（`pnpm run build:site` で `dist/site/` へ生成） | `dist/site/index.html` |

GitHub Pagesへの配信は、リポジトリを公開するまで止めています。理由と再開手順は [`CI.md`](./CI.md) 第5節にあります。生成と決定性検証自体は、Pull Requestと`main`の双方で常に実行しています。

PDFとEPUBはv1.0では提供しません。理由と将来の方針は [`RELEASE_POLICY.md`](./RELEASE_POLICY.md) 第1.5節にあります。

### ライセンス

本文とサンプルコードでライセンスが異なります。

- 本文（Markdown、図表、文章、生成したHTML）は **CC BY-NC-SA 4.0** です。全文は [`LICENSE-TEXT`](./LICENSE-TEXT) にあります。
- サンプルコード（`code/` 配下、`scripts/`、設定、CI定義）は **MIT** です。全文は [`LICENSE`](./LICENSE) にあります。
- ファイル単位の判定規則は [`LICENSING.md`](./LICENSING.md) にあり、`pnpm run validate:release-policy` が全ファイルの網羅を検証します。

営利利用の可否と別途許諾の窓口は `LICENSE-TEXT` の第4節・第6節を参照してください。

### 版管理と更新

Semantic Versioningを採用し、本文とサンプルコードを1つの版番号で管理します。MAJOR・MINOR・PATCHが本文とコードそれぞれで何を意味するかは [`RELEASE_POLICY.md`](./RELEASE_POLICY.md) 第3節に定義しています。章ごとの見直し周期（四半期・半期・年次・隔年）は同第5節にあります。

### サンプルコードのサポート範囲

保証環境はdevcontainerとLinux (x86_64)、対象バージョンはNode.js 24.18.0、pnpm 11.15.1、TypeScript 6.0.3です。macOSとWindows + WSL2は努力目標、WSL2を使わないWindowsネイティブは対象外です。ブラウザ手動確認と外部サービスを伴う演習は自動再現の保証対象外です。自作フレームワークや脆弱コード例など、教育目的で簡略化した実装をそのまま本番環境で使わないでください。詳細は [`RELEASE_POLICY.md`](./RELEASE_POLICY.md) 第6節にあります。

### 正誤報告と改訂の提案

GitHubのIssueテンプレートから受け付けます。

- 正誤報告: `.github/ISSUE_TEMPLATE/errata-report.yml`
- 改訂・利用の提案: `.github/ISSUE_TEMPLATE/revision-proposal.yml`

受付から [`ERRATA.md`](./ERRATA.md) への反映までの手順は `ERRATA.md` 第5節に定めています。氏名、メールアドレス、所属は収集しません。

## 推奨する読み方

初回は目次で **必修** と表示された節を優先します。必修は199節、推定24時間5分です。担当領域が決まっている場合は、[`LEARNING_PATHS.md`](./LEARNING_PATHS.md) のフロントエンド、バックエンド・DB、インフラ・SRE、セキュリティ、テックリード向けルートから開始できます。分類基準は [`LEARNING_LEVELS.md`](./LEARNING_LEVELS.md) を参照してください。各章を単独で読むときは、章冒頭の「この章の学習ガイド」で前提知識、本番との差分、診断方法、評価基準を確認します。共通構造は [`CHAPTER_TEMPLATE.md`](./CHAPTER_TEMPLATE.md) にまとめています。通読時の知識のつながりは [`NARRATIVE_ARCHITECTURE.md`](./NARRATIVE_ARCHITECTURE.md)、本文の編集基準は [`NARRATIVE_EDITING_GUIDE.md`](./NARRATIVE_EDITING_GUIDE.md) を参照してください。

## サンプルコード

各章のコードは `code/chXX/` に配置します。標準環境はNode.js 24.18.0、pnpm 11.15.1、TypeScript 6.0.3です。セットアップ、統一コマンド、Docker利用基準は [`CODE_TOOLCHAIN.md`](./CODE_TOOLCHAIN.md)、クリーン環境とdevcontainerは [`CLEAN_ENVIRONMENT.md`](./CLEAN_ENVIRONMENT.md) を参照してください。実行方法、前提環境、課題の開始ファイル、模範解答は各章の `README.md` を参照してください。

```bash
npm install --global corepack@latest
corepack enable pnpm
corepack prepare pnpm@11.15.1 --activate
pnpm install
pnpm run validate:workspace
pnpm run validate:clean-environment
```

## 現在の状態

正式版v1.0に向けて、本文・目次・索引・コード参照、全143演習の模範解答、全147課題の演習カード、CI定義まで整備済みです。固定ツールチェーンと外部サービスを使うクリーン環境検証を継続しています。

## 原稿の整合性検証

固定したNode.js 24.18.0とpnpm 11.15.1で、次を実行します。

```bash
pnpm run apply:learning-levels:check
pnpm run generate:learning-paths:check
pnpm run apply:chapter-guides:check
pnpm run generate:handbook:check
pnpm run validate:narrative-flow
pnpm run validate:handbook
pnpm run validate:release-policy
pnpm run test:learning-levels
pnpm run test:handbook-validator
```

検証対象は、完成済み章の章冒頭・節間接続、章・節番号、目次との一致、全節の学習レベルと推定時間、学習ルートの節参照・重複・生成差分、全30章の章学習ガイドと11教材要素、索引参照先、本文中のコードパス、Markdown相対リンク、重複アンカー候補です。不整合がある場合、`validate:handbook` は終了コード1を返します。

## 静的サイトの生成

GitHub Pages向けのHTMLは、Node.jsの標準ライブラリだけで動く `scripts/build-site.mjs` が生成します。外部のMarkdownパーサや静的サイトジェネレータには依存していません。

```bash
pnpm run build:site        # dist/site/ へ生成する
pnpm run build:site:check  # 生成が決定的であることを検証する
```

`dist/site/release-manifest.json` に、入力Markdownと出力HTMLのsha256、版番号、ツールチェーンを記録します。同じコミットからは常に同じmanifestが得られ、v1.0の固定成果物を再現できます。配信は `.github/workflows/pages.yml` が行います。

## コード演習

全章の開始地点・模範解答・必要サービス・推定時間は [コード演習ガイド](CODE_EXERCISES.md) と各 `code/chXX/README.md` を参照してください。

章末の各課題には、本文の見出し直下に「演習カード」があります。カードは目的、難易度、推定時間、前提、完成条件（自己採点用チェックリスト）、期待出力、観察項目、テスト方法（自己採点手順）、段階的ヒント（方針→構造→実装の要点）、本番利用時の警告、starterからsolutionへの導線を含みます。演習だけを実施しても、完成条件のチェックリストで学習目標の達成を確認できます。

演習カードの正本は `config/exercises.json` です。`pnpm run apply:exercise-rubrics` で本文へ、`pnpm run generate:exercise-catalog` で各章READMEへ反映し、`pnpm run validate:exercises` が項目の欠落・定型文・starterとsolutionの導線不一致を検出します。

### CI

Pull Requestでは原稿検査、全30章の`lint`・`typecheck`・`test`・`build`、PostgreSQL・Redisのservice container確認を実行します。Linux/Docker、長時間ベンチマーク、外部クラウド・Kafka・Kubernetesを伴う演習は拡張workflowへ分離しています。詳細は[CI運用ガイド](CI.md)を参照してください。

依存関係のインストールは`pnpm install --frozen-lockfile`で行います。`main`はrulesetで保護し、`Required CI gate`の成功を必須チェックにしています。ruleset定義は[`.github/rulesets/main-required-ci.json`](.github/rulesets/main-required-ci.json)にあります。
