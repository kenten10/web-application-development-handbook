# 公開・ライセンス・版管理・更新方針

基準日: 2026-08-30

この文書は、『WEBアプリケーション開発者になれる解説書 ― 基礎から一流までの30章 ―』をどの形式で公開し、どのライセンスで利用を許諾し、どの規則で版を進め、どの周期で内容を見直すかを定める。

機械可読な正本は [`config/release.json`](./config/release.json) である。本文書の記述は正本から逸脱してはならず、`pnpm run validate:release-policy` が両者の一致を検証する。

## 1. 公開形式

v1.0では次の2形式で公開する。

| 形式 | 位置づけ | 成果物 | 入口 | 固定方法 |
|---|---|---|---|---|
| GitHubリポジトリ | 正本 | Markdown本文と `code/chXX/` のサンプルコード | `README.md` | gitタグ `v1.0.0` |
| 静的Webサイト（GitHub Pages） | 生成物 | `dist/site/` 配下のHTML | `dist/site/index.html` | `pnpm run build:site` の出力とrelease manifestのsha256 |

Markdownが正本であり、HTMLは常にMarkdownから生成する。HTMLを直接編集しない。両者に差分が生じた場合はMarkdownを正とする。この関係は [`CONTRIBUTING.md`](./CONTRIBUTING.md) 第1節の正本規定と同じ扱いである。

### 1.1 静的サイトの生成

生成は `scripts/build-site.mjs` が行う。Node.jsの標準ライブラリだけで完結し、Markdownパーサ、静的サイトジェネレータ、テンプレートエンジンを含む外部依存を一切追加していない。

外部依存を足さなかった理由は次のとおりである。

- 本書は「依存を固定して再現可能に検証する」ことを教材として繰り返し主張している。生成基盤だけが未固定の依存を抱えるのは一貫しない。
- 静的サイトジェネレータはメジャー更新のたびに設定と出力が変わる。第20章・第21章で見直し周期を半期としている領域と同じ変化速度を、本書の公開基盤へ持ち込みたくない。
- 本書のMarkdownは `CONTRIBUTING.md` で書式を統一しており、汎用パーサが必要とする網羅性を必要としない。

将来、数式や複雑な図版の要求が出た場合に限り依存の追加を検討する。追加する場合は、採用理由、固定バージョン、更新周期を本節へ追記する。

対応するMarkdown記法は次のとおりである。

- 見出し（`#`〜`######`）、段落、水平線
- 順序なしリスト、順序付きリスト、ネスト
- 表（GFM形式、左寄せ・中央・右寄せの整列指定を含む）
- 引用ブロック
- フェンス付きコードブロック（言語名を `data-lang` 属性として保持する）
- インラインコード、強調、太字、取り消し線
- リンク、画像、自動リンク
- 本文中の `<a id="..."></a>` アンカー（章・節への直接リンクに使う）
- `<!-- handbook:... -->` 形式の生成メタデータ（HTMLコメントとして保持し、表示しない）

上記以外の生のHTMLはエスケープして表示する。本文が意図しないマークアップを注入できないようにするためである。

### 1.2 生成物の構造

```text
dist/site/
├── index.html                  ページ一覧
├── style.css                   共通スタイル
├── release-manifest.json       入力・出力のsha256とツールチェーン情報
├── LICENSE.txt                 MITライセンス本文の複製
├── LICENSE-TEXT.txt            CC BY-NC-SA 4.0の適用条件の複製
├── 00-front-matter.html
├── 01-toc.html
├── 02-part1-foundations.html
├── ...
└── NARRATIVE_EDITING_GUIDE.html
```

出力対象ページの一覧は `config/release.json` の `site.pages`、Markdown以外の複製対象は `site.copies` を正本とする。ページを増減させる場合は正本を更新する。

各ページのフッタには、版番号、公開日、著者、本文とコードのSPDX識別子、`LICENSING.md`・`CHANGELOG.md`・`ERRATA.md` へのリンクを埋め込む。どのページから読み始めても利用条件と正誤表へ到達できる。

Markdown間の相対リンク（`./LEARNING_PATHS.md#route-standard` など）は、生成時に対応するHTMLへ書き換える。生成対象に含まれないMarkdownへのリンクは、リポジトリ内のパスとして残す。

### 1.3 決定性

同じ入力からは常に同じ出力を得る。生成時刻、乱数、実行環境に依存する値を出力へ含めない。版番号と公開日は `config/release.json` から読む。

```bash
pnpm run build:site        # dist/site/ へ生成する
pnpm run build:site:check  # 一時ディレクトリへ2回生成し、manifestの一致を検証する
```

`build:site:check` は、2回の生成結果が一致すること、および `dist/site/` が存在する場合はその内容と一致することを確認する。一致しなければ終了コード1を返す。

### 1.4 GitHub Pagesへの配信

`.github/workflows/pages.yml` が配信を担当する。`main` へのpush、および手動実行で起動する。

- Pull Requestでは生成のみ行い、配信しない。生成の失敗をPRの時点で検出するためである。
- 配信ジョブの権限は `pages: write` と `id-token: write` に限定する。`contents` は `read` のままとする。
- 使用するactionは完全なcommit SHAへ固定する。`.github/workflows/ci.yml` と同じ方針である。
- `actions/checkout` では `persist-credentials: false` を指定する。

正本のリポジトリは `kenten10/web-application-development-handbook` である。KEN-70で確定し、`config/release.json` の `site.repoLinkBase` へ反映した。サイトに含めないリポジトリ内パスへのリンクは、このURLを基点に書き換わる。

**配信は有効である。公開URLは <https://kenten10.github.io/web-application-development-handbook/> である。** v1.0.0の公開時点ではリポジトリが非公開であり、GitHub Pagesが無料プランの非公開リポジトリでは利用できなかったため配信を止めていた。その後リポジトリを公開し、Pages の Source を GitHub Actions に切り替えて配信を開始した。第7.4節のタグ付け手順7は、この作業をもって完了している。

配信の有無は「配信ステップの実行条件」で切り替える。検査の削除ではない。

- 静的サイトの生成と決定性検証（`build-site.mjs` と `--check`）はPull Requestと `main` の双方で常に実行する。配信を止めても、この2つは止まらない。
- Pages artifactのアップロードと配信ジョブだけを、repository variable `PAGES_ENABLED` が `true` のときに限定する。正本のリポジトリではこの変数を `true` に設定してある。

Pagesを有効化していないリポジトリで `actions/deploy-pages` を実行するとPages APIで失敗し、原稿の検証とは無関係な赤い実行履歴が `main` に残る。フォークや移管先でそうならないよう、条件は明示的なopt-inのままにしてある。手順は [`CI.md`](./CI.md) 第5.2節にある。

### 1.5 v1.0で提供しない形式

| 形式 | 提供しない理由 | 将来の方針 |
|---|---|---|
| PDF | 組版品質、図版、索引のページ番号の作り込みがv1.0の作業量に見合わない | 要望が集まった場合、MINOR版でHTMLからの派生成果物として検討する。生成する場合もMarkdownが正本である点は変えない |
| EPUB | リフロー環境でのコード折り返しと横スクロールの検証コストが高く、v1.0では品質を保証できない | PDFと同じ判断基準で、MINOR版以降に静的サイトのHTMLから派生させる形で検討する |

どちらも「作れないから出さない」のではなく、「保証できない品質のものを配布しない」という判断である。提供を開始する場合は、本節と `config/release.json` の `distribution` を同時に更新する。

## 2. ライセンス

本文とサンプルコードで異なるライセンスを採用する。

| 区分 | SPDX識別子 | 全文 | 対象 |
|---|---|---|---|
| 本文 | `CC-BY-NC-SA-4.0` | [`LICENSE-TEXT`](./LICENSE-TEXT) | 本文Markdown、図表、文章、生成されたHTML |
| コード | `MIT` | [`LICENSE`](./LICENSE) | サンプルコード、スクリプト、設定ファイル、CI定義 |

ファイル単位の判定規則と判定順序は [`LICENSING.md`](./LICENSING.md) にある。判定は `pnpm run validate:release-policy` で機械的に検証する。判定規則に一致しないファイルが1件でもあれば検証は失敗する。

営利利用の可否、表示の書き方、別途許諾の窓口は [`LICENSE-TEXT`](./LICENSE-TEXT) の第4節・第6節を参照する。

## 3. 版管理

### 3.1 採用する方式

[Semantic Versioning 2.0.0](https://semver.org/lang/ja/) を採用する。タグ書式は `vMAJOR.MINOR.PATCH`、プレリリースは `vMAJOR.MINOR.PATCH-rc.N` とする。

本文とサンプルコードは1つの版番号で管理する。両者は同じリポジトリで同時に検証され、章とコードが常に対応しているためである。本文だけを更新した場合も、コードだけを更新した場合も、版番号は1つ進む。

版番号の正本は `config/release.json` の `version` である。`package.json` の `version` と `CHANGELOG.md` の最新版見出しは、これと一致していなければならない。3者の不一致は `pnpm run validate:release-policy` が検出する。

### 3.2 MAJOR

読者が持っている読了記録・演習成果物・引用が、そのままでは新しい版へ対応付かなくなる変更である。

本文:

- 部・章の追加、削除、統合、分割
- 章番号または節番号の付け替え
- 対象読者・前提知識の変更
- 標準ルート（初回通読の必修範囲）の再定義

コード:

- Node.jsメジャーバージョンの引き上げ（例: 24.x から 26.x）
- pnpmメジャーバージョンの引き上げ
- 既存演習の課題定義・完成条件の非互換な変更
- 章ディレクトリ構成またはworkspace package名の変更

MAJOR版では、旧番号から新番号を引ける移動表を `CHANGELOG.md` の版見出し直下へ必ず記載する。

### 3.3 MINOR

既存の章番号・節番号が保たれ、読者が差分だけを追える変更である。

本文:

- 既存章への節の追加
- 既存節への説明・図表・一次資料の追加
- 学習レベル分類や推定時間の見直し
- 新しい学習ルートの追加

コード:

- 新しい演習・模範解答の追加
- 既存演習を壊さない依存ライブラリのMINOR更新
- 検証スクリプト・CIジョブの追加
- TypeScriptのMINOR更新

### 3.4 PATCH

節の意味が変わらない訂正である。

本文:

- 誤字脱字、用語表記、リンク切れの修正
- 技術的な事実誤りの訂正（記述の骨子を変えない範囲）
- `ERRATA.md` に登録済みの正誤の本文反映

コード:

- サンプルコードのバグ修正
- 依存ライブラリのPATCH更新とセキュリティ修正
- テスト・lint設定の微修正

### 3.5 判断に迷う場合

「節を読み直す必要があるか」を基準にする。読み直しが必要ならMINOR以上、手元の版を機械的に読み替えれば済むならPATCHとする。誤りの訂正であっても、その節の結論が変わるならMINORとする。

## 4. CHANGELOGと正誤表の運用

### 4.1 CHANGELOG

[`CHANGELOG.md`](./CHANGELOG.md) は [Keep a Changelog 1.1.0](https://keepachangelog.com/ja/1.1.0/) の書式に従う。分類は `Added`、`Changed`、`Deprecated`、`Removed`、`Fixed`、`Security` の6種類だけを使う。

変更はまず `## [Unreleased]` へ追記し、リリース時に版見出しへ移す。版見出しの書式は `## [MAJOR.MINOR.PATCH] - YYYY-MM-DD` に固定する。この書式から外れると検証が失敗する。

運用の詳細な手順は `CHANGELOG.md` の末尾にある運用ルールに従う。

### 4.2 正誤表

[`ERRATA.md`](./ERRATA.md) は、公開済みの版に含まれる誤りとその訂正を記録する。IDは `E-<報告年>-<3桁連番>` とし、却下した項目の番号も再利用しない。

対象箇所は「節番号 + 位置」で書く。ファイル名と行番号では、本文が動いたときに追えなくなるためである。

状態は `受付` → `再現確認中` → `確認済` → `修正済` の順に遷移する。誤りでないと判断した場合は `却下` とし、行を削除せず理由を残す。

### 4.3 CHANGELOGと正誤表の関係

- 正誤の受付だけでは版番号は上がらない。本文またはコードへ反映した時点でPATCHを発行する。
- 反映時は `CHANGELOG.md` の `Fixed` へERRATA IDを併記する。
- 1つのPATCHで複数の正誤を反映してよい。その場合はすべてのIDを列挙する。

### 4.4 更新履歴の公開

`CHANGELOG.md` と `ERRATA.md` は静的サイトの生成対象に含める。読者は本文と同じ入口から、いつ何が変わったかと、手元の版に既知の誤りがあるかを確認できる。

## 5. 依存技術の更新頻度に応じた見直し周期

### 5.1 区分

扱う技術の変化速度で章を4段階に分類し、周期を割り当てる。

| 区分 | 周期 | 判定基準 |
|---|---:|---|
| 四半期 | 3か月 | 製品・モデル・API仕様が四半期単位で入れ替わり、記述の陳腐化がもっとも速い領域 |
| 半期 | 6か月 | 主要ツールやマネージドサービスのメジャー更新が年1回以上あり、推奨構成が入れ替わる領域 |
| 年次 | 12か月 | 年次リリースサイクルの仕様・ランタイムに追随すればよい領域 |
| 隔年 | 24か月 | プロトコル、OS、設計原則など、数年単位でしか前提が変わらない領域 |

### 5.2 章別の割り当て

| 章 | 表題 | 見直し周期 | 変化を駆動する要素 | 判断理由 |
|---|---|---|---|---|
| 第1章 | Webとは何か ― 歴史と全体像 | 隔年（24か月） | Web標準の歴史、アーキテクチャ原則 | URI・HTTP・クライアント/サーバという長寿命の原理を扱い、記述の前提がほとんど動かない。 |
| 第2章 | HTTPプロトコル徹底解剖 | 隔年（24か月） | HTTPセマンティクス、HTTP/2・HTTP/3 | HTTPセマンティクスはRFC 9110系で安定している。HTTP/3の普及動向だけを隔年で確認する。 |
| 第3章 | URL・DNS・TLS | 年次（12か月） | TLS、証明書運用、DNS | 証明書の有効期間短縮やポスト量子暗号への移行など、運用側の推奨値が年単位で更新される。 |
| 第4章 | HTML/CSS/JavaScriptの設計思想 | 年次（12か月） | CSS新機能、ブラウザAPI | HTMLの土台は安定しているが、CSSのレイアウト・カラー機能とBaseline判定が年次で更新される。 |
| 第5章 | JavaScriptとTypeScriptの中核機構 | 年次（12か月） | ECMAScript年次仕様、TypeScript | ECMAScriptは年1回の仕様確定であり、その周期に合わせて構文と型の記述を見直す。 |
| 第6章 | フロントエンドフレームワーク | 半期（6か月） | React、Vue、Svelte、Angular | 主要フレームワークが半期ごとに推奨APIとレンダリングモデルを更新するため、比較記述が最も陳腐化しやすい。 |
| 第7章 | 状態管理とデータフェッチング | 半期（6か月） | 状態管理ライブラリ、データフェッチ層 | 推奨される状態管理・キャッシュ戦略がフレームワークの更新に連動して入れ替わる。 |
| 第8章 | ビルドツールとモジュールバンドラ | 半期（6か月） | Vite、Rust製バンドラ、モジュール仕様 | バンドラの実装置き換えが継続しており、ベンチマークと推奨構成の寿命が短い。 |
| 第9章 | レンダリング戦略 | 半期（6か月） | SSR/SSG/ISR、ストリーミング | レンダリング戦略の名称と適用条件がフレームワーク側の更新で頻繁に変わる。 |
| 第10章 | サーバサイド言語とランタイム | 年次（12か月） | Node.js LTS、代替ランタイム | Node.jsのLTSが年次で切り替わり、標準API・実行モデルの記述を追随させる必要がある。 |
| 第11章 | Webフレームワーク設計論 | 隔年（24か月） | ミドルウェア設計、ルーティング設計 | 自作フレームワークを通じた設計論が主題であり、特定製品の更新に依存しない。 |
| 第12章 | API設計 | 年次（12か月） | OpenAPI、GraphQL、gRPC | スキーマ記述形式とバージョニング慣行が年次で更新される。 |
| 第13章 | 認証と認可 | 年次（12か月） | OAuth 2.1、OIDC、パスキー | 認証仕様の推奨プロファイルとパスキーの実装状況が年単位で更新される。 |
| 第14章 | リレーショナルデータベース | 隔年（24か月） | リレーショナルモデル、トランザクション | 関係モデル、正規化、分離レベルは数年単位でしか前提が変わらない。 |
| 第15章 | NoSQLとデータモデリング | 年次（12か月） | ドキュメントDB、KVS、分散DB | 製品ごとの一貫性保証と課金モデルが年次で更新される。 |
| 第16章 | 検索エンジンと全文検索 | 半期（6か月） | 全文検索エンジン、ベクトル検索 | ベクトル検索とハイブリッド検索の実装・推奨構成が半期単位で入れ替わっている。 |
| 第17章 | イベント駆動とメッセージング | 年次（12か月） | Kafka、キュー製品、配信保証 | 配信保証の理屈は安定しているが、製品の運用モードと推奨設定が年次で更新される。 |
| 第18章 | Linuxとネットワーク | 隔年（24か月） | Linuxカーネル、TCP/IP | プロセス、ファイルディスクリプタ、ネットワークスタックの基礎は長期に安定している。 |
| 第19章 | コンテナとオーケストレーション | 年次（12か月） | OCIランタイム、Kubernetes | Kubernetesは年3回リリースされるが、本章が扱うAPIと概念の寿命は年単位である。 |
| 第20章 | クラウドとIaC | 半期（6か月） | マネージドサービス、Terraform、IaC | クラウド事業者のサービス名・料金・推奨構成が半期で変わり、手順の再現性が落ちやすい。 |
| 第21章 | CI/CDとDevOps | 半期（6か月） | GitHub Actions、サプライチェーン対策 | ホスト型CIの機能とactionの固定SHAを半期ごとに更新する必要がある。 |
| 第22章 | 可観測性 (Observability) | 年次（12か月） | OpenTelemetry、メトリクス・トレース | OpenTelemetryのシグナル安定化が進行中で、SDKと属性規約を年次で追随させる。 |
| 第23章 | セキュリティ | 半期（6か月） | OWASP、脆弱性動向、暗号方式 | 攻撃手法と推奨対策、暗号アルゴリズムの推奨が半期単位で更新される。 |
| 第24章 | パフォーマンス | 年次（12か月） | Core Web Vitals、計測手法 | 指標の定義としきい値が年次で見直され、計測ツールの出力も変わる。 |
| 第25章 | テスト戦略 | 年次（12か月） | テストランナー、E2Eツール | node:testと外部ランナーの位置づけが年次で更新される。 |
| 第26章 | スケーラビリティとアーキテクチャ | 隔年（24か月） | 分散システム理論、アーキテクチャパターン | スケーリングの原理とトレードオフは長期に安定している。 |
| 第27章 | 設計とドメインモデリング | 隔年（24か月） | ドメインモデリング、設計手法 | モデリング手法と設計判断の枠組みは特定製品の更新に依存しない。 |
| 第28章 | 大規模リファクタリングとレガシー対応 | 隔年（24か月） | リファクタリング手法、移行戦略 | 段階的移行の手順と安全網の作り方は長期に有効である。 |
| 第29章 | LLMを組み込むWeb開発 | 四半期（3か月） | LLM、エージェント、推論API | モデル、API仕様、コスト、推奨アーキテクチャが四半期単位で入れ替わる本書で最も変化が速い章。 |
| 第30章 | 総合演習 ― 本番品質のSaaSをゼロから構築 | 半期（6か月） | フルスタック構成、全章の依存関係 | 全部の技術スタックを束ねる総合演習であり、いずれかの章の更新が直接波及する。 |

内訳は四半期1章、半期9章、年次12章、隔年8章である。合計は `config/chapter-guides.json` の章数と一致していなければならず、`pnpm run validate:release-policy` が全章に周期が割り当てられていることを検証する。章を増減させた場合は `config/release.json` の `reviewCycle.chapters` を同時に更新する。

### 5.3 周期によらない随時見直し

次のいずれかが起きた場合、周期を待たずに該当章を見直す。

- Node.jsのLTS系統が切り替わったとき
- pnpmまたはTypeScriptのメジャー更新が出たとき
- 本書が扱う技術に重大な脆弱性（CVSS 7.0以上）が公表されたとき
- 参照している一次資料が非推奨化または移動したとき
- `ERRATA.md` へBlockerまたはMajorの正誤が登録されたとき

### 5.4 見直しで確認すること

各章の見直しでは、次の4点を確認する。

1. **一次資料の生存** — 章の学習ガイドが参照するURLが到達可能で、内容が非推奨化していないか。
2. **固定バージョンの妥当性** — 章が依存するライブラリ・サービスのバージョンが、まだ現実的な選択肢か。
3. **演習の再現性** — 該当章の演習が固定ツールチェーンで成功するか。外部サービスを使う演習は、コンソールUIと無料枠が記述どおりか。
4. **展望節の陳腐化** — 学習レベル `展望` を付けた節の予測が、すでに結果が出ていないか。

見直しの結果、記述を変えなかった場合も「確認した」ことを `CHANGELOG.md` の `Unreleased` へ残さない。変更がないことは版に現れないため、見直しの記録はLinearのissueで管理する。

## 6. サンプルコードのサポート範囲

### 6.1 対象バージョン

| ツール | 固定バージョン | 許容範囲 |
|---|---|---|
| Node.js | 24.18.0 | `>=24.18.0 <25` |
| pnpm | 11.15.1 | `>=11.15.1 <12` |
| TypeScript | 6.0.3 | `6.0.x` |

固定の根拠と更新方針は [`CODE_TOOLCHAIN.md`](./CODE_TOOLCHAIN.md) にある。これらのメジャー更新はMAJOR版の対象である。

### 6.2 対象環境

| 環境 | 水準 | 内容 |
|---|---|---|
| devcontainer | 保証 | `.devcontainer/` で定義したDebian bookworm + Node.js 24.18.0。CIとクリーン環境検証の基準環境 |
| Linux (x86_64) | 保証 | GitHub Actionsの `ubuntu-24.04` で継続的に検証する |
| macOS | 努力目標 | Apple Silicon / Intel。手元検証はするが、CIでは常時実行しない |
| Windows + WSL2 | 努力目標 | Linux手順を前提として動作報告を受け付ける |
| Windowsネイティブ | 対象外 | WSL2を使わない環境。パス・改行・シェルの差分は正誤報告の対象外 |

「保証」の環境で再現しない不具合は正誤報告の対象とする。「努力目標」の環境固有の不具合は、再現条件が特定できた場合に限り対応する。「対象外」の環境については報告を受け付けない。

### 6.3 動作を保証する範囲

- 固定ツールチェーンで `pnpm run check:workspace` と `pnpm run check:handbook` が成功する。
- `code/chXX/` の各章で `lint`、`typecheck`、`test`、`build` が成功する。
- 各演習のstarterからsolutionへの導線が `pnpm run validate:exercises` で検証される。

### 6.4 動作を保証しない範囲

- ブラウザ手動確認と外部サービスを伴う演習の自動再現。証跡は `config/clean-environment-plan.json` の `requiredEvidence` に従う。自動テストの成功だけで完了扱いにしない（[`BETA_REVIEW_PLAN.md`](./BETA_REVIEW_PLAN.md) のRB-06と同じ扱いである）。
- クラウド事業者・SaaSの無料枠、料金体系、コンソールUIの変化。
- 本書が固定していないOS・ブラウザ・ミドルウェアのバージョン組み合わせ。
- 長時間ベンチマークの絶対値。相対的な傾向のみを教材として扱う。

### 6.5 本番利用できない教育用実装

本書のサンプルコードは、原理を理解するために意図的に簡略化してある。次の実装は、そのまま本番環境で使ってはならない。

- 第6章の自作レンダリング実装は、差分検出・スケジューリング・並行制御を省略している。
- 第11章の自作Webフレームワークは、HTTPの境界条件処理とセキュリティヘッダの網羅性を省略している。
- 第13章の認証・署名実装は、鍵管理、失効、リプレイ防御、監査ログを省略している。
- 第23章の脆弱コード例は攻撃再現のための教材であり、隔離環境以外で実行しない。
- 第25章のテスト用スタブとフィクスチャは、実データを模した固定値であり本番データではない。
- 第30章の総合演習は本番品質を目指すが、事業者固有の可用性要件と法令要件は対象外である。

章ごとに省略した保証と本番実装との差分は、`config/chapter-guides.json` の `productionGaps` に記載し、本文の章学習ガイドへ生成している。演習単位の警告は演習カードの「本番利用時の警告」にある。

### 6.6 サポート期間

- 最新のMINOR系列だけをサポート対象とする。旧MINOR系列にはPATCHを提供しない。
- サンプルコードの依存関係に重大な脆弱性が見つかった場合、最新MINOR系列に対してPATCHを発行する。
- 報告の窓口は `.github/ISSUE_TEMPLATE/errata-report.yml` である。

## 7. v1.0の固定成果物と再現手順

### 7.1 固定するもの

| 種類 | 内容 |
|---|---|
| Markdown正本 | `00-front-matter.md`、`01-toc.md`、`02-part1-foundations.md`〜`08-part7-practice.md`、`09-references.md`、`10-index.md` |
| 方針文書 | `README.md`、`RELEASE_POLICY.md`、`LICENSING.md`、`LICENSE`、`LICENSE-TEXT`、`CHANGELOG.md`、`ERRATA.md` |
| 生成HTML | `dist/site/` 配下の全ページ、`dist/site/style.css`、`dist/site/index.html` |
| 再現マニフェスト | `dist/site/release-manifest.json` |
| 検証ログ | `check:handbook`、`check:workspace`、クリーン環境構築、サイト生成検証の各実行記録 |

一覧の正本は `config/release.json` の `fixedArtifacts` である。

### 7.2 再現手順

固定した環境で次を順に実行する。

```bash
corepack prepare pnpm@11.15.1 --activate
pnpm install --frozen-lockfile
pnpm run check:handbook
pnpm run build:site
pnpm run build:site:check
```

`build:site` が `dist/site/release-manifest.json` を出力する。manifestは次を含む。

- `version`、`releaseDate`（`config/release.json` から取得）
- 入力Markdownごとのsha256とバイト数
- 出力HTMLごとのsha256とバイト数
- 生成に使ったツールチェーンの宣言値（Node.js、pnpm、TypeScript）

同じコミットから生成したmanifestは、実行環境や実行時刻が変わっても一致する。一致しなければ `build:site:check` が失敗する。

### 7.3 検証ログ

| ID | コマンド | 証跡 |
|---|---|---|
| `check-handbook` | `pnpm run check:handbook` | GitHub Actions run URL（Handbook CI / Manuscript and configuration） |
| `check-workspace` | `pnpm run check:workspace` | GitHub Actions run URL（Handbook CI / chapter matrix） |
| `clean-environment` | `bash scripts/bootstrap-clean-environment.sh` | クリーン環境の実行ログ（[`CLEAN_ENVIRONMENT.md`](./CLEAN_ENVIRONMENT.md)） |
| `build-site` | `pnpm run build:site:check` | `dist/site/release-manifest.json` のsha256一致 |

### 7.4 タグ付け

リリース時の手順を次の順序に固定する。

1. `config/release.json` の `version`、`releaseDate` を確定し、`state` を `released` にする。
2. `package.json` の `version` を合わせる。
3. `CHANGELOG.md` の `## [Unreleased]` を版見出しへ移す。
4. `pnpm run validate:release-policy` と `pnpm run check:handbook` を実行する。
5. `pnpm run build:site` と `pnpm run build:site:check` を実行し、manifestのsha256を記録する。
6. `git tag -a v<version>` でタグを打つ。
7. GitHub Pagesへ配信し、公開URLを `README.md` へ記載する。

手順4と5を飛ばしてタグを打たない。`dist/` はgit管理対象外であるため、固定は「タグ + manifestのsha256」の組で行う。

## 8. リリースゲートとの対応

[`BETA_REVIEW_PLAN.md`](./BETA_REVIEW_PLAN.md) 第9節のrelease blockerのうち、本文書が直接責任を持つのはRB-10である。

| release blocker | 対応するKEN-63のゲート | 本文書での担保 | 判定コマンド |
|---|---|---|---|
| RB-10 公開・利用条件が未確定である | ライセンス、版番号、CHANGELOG、正誤報告先が公開済み | 第1節〜第4節、`LICENSE`、`LICENSE-TEXT`、`LICENSING.md`、`CHANGELOG.md`、`ERRATA.md`、`config/release.json`、`README.md`、`00-front-matter.md` | `pnpm run validate:release-policy` |
| RB-04 原稿整合性検証が失敗する | 目次・索引・コード参照検査が成功 / 全文校正とリンク検査が成功 | `validate:release-policy` を `check:handbook` チェーンへ組み込み、公開条件の破損が原稿検証と同じゲートで止まるようにした | `pnpm run check:handbook` |
| RB-08 推定所要時間が実測から大きく乖離している | 必修・選択・発展の分類が完了 | 例外承認時に乖離した章と実測値をCHANGELOGへ記載する運用を第4.1節と `CHANGELOG.md` の運用ルール6へ定義した | リリース判定会の記録 |

RB-06（ブラウザ手動・外部サービス演習の証跡）については、第6.4節で「自動テストの成功だけで完了扱いにしない」ことをサポート範囲の側からも明示し、`BETA_REVIEW_PLAN.md` と同じ判断基準に揃えている。

KEN-63のリリースゲート「ライセンス、版番号、CHANGELOG、正誤報告先が公開済み」は、次の4点がすべて満たされたときに成立する。

1. `LICENSE` と `LICENSE-TEXT` が存在し、`LICENSING.md` の対応表が全ファイルを網羅している。
2. `config/release.json`、`package.json`、`CHANGELOG.md` の版番号が一致している。
3. `CHANGELOG.md` の最新版見出しが公開する版と一致している。
4. `ERRATA.md` と `.github/ISSUE_TEMPLATE/errata-report.yml` が存在し、`README.md` と `00-front-matter.md` から到達できる。

4点はすべて `pnpm run validate:release-policy` が機械的に確認する。

## 9. 検証

```bash
pnpm run validate:release-policy   # 方針文書と正本の一致を検証する
pnpm run test:release-policy       # 検証ロジックとサイト生成の回帰テスト
pnpm run build:site                # 静的サイトを生成する
pnpm run build:site:check          # 生成の決定性を検証する
```

`validate:release-policy` は `check:handbook`、`test:release-policy` は `test:handbook` のチェーンへ組み込んである。原稿検証と同じ入口で、公開・利用条件の破損を検出できる。
