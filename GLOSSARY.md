# 用語集

<!-- handbook:generated; do not edit -->
`config/glossary.json` から生成しています。直接編集せず、正本を修正して `pnpm run generate:glossary` を実行してください。

基準日: 2026-08-30

表記の判定規則は [スタイルガイド](STYLE_GUIDE.md) の S-TERM-001・S-TERM-002 に対応します。
`pnpm run validate:style` が本文と索引を機械検査します。

## 分類

| 分類 | 方針 |
|---|---|
| 日本語表記 | 外来語の日本語表記。語ごとに正表記を固定する。 |
| 製品名・プロジェクト名 | 提供元の公式表記に従う。 |
| 略語 | 初出時に英語正式名称を併記する。 |
| 訳語の選択 | 同義の訳語が併存する語。正表記へ寄せる。 |

## 別表記の扱い

| 区分 | 意味 |
|---|---|
| error | 非正規表記。使用しない。 |
| warn | 非推奨表記。既存箇所はKEN-59で整理する。新規追加はしない。 |

## 英字・記号で始まる語

| 正表記 | 分類 | 使わない表記 | 説明 | 索引 |
|---|---|---|---|---|
| **ABAC** | 略語 | ― | Attribute-Based Access Control。属性の評価で判断する認可方式。 |  |
| **ACID** | 略語 | ― | Atomicity・Consistency・Isolation・Durability。トランザクションが満たす4性質。 | ○ |
| **ADR** | 略語 | ― | Architecture Decision Record。設計判断と背景を記録する文書。 |  |
| **API** | 略語 | ― | Application Programming Interface。プログラムから呼び出せる契約。 |  |
| **ARIA** | 略語 | ― | Accessible Rich Internet Applications。支援技術へ意味を伝える属性群。 |  |
| **BDD** | 略語 | ― | Behavior-Driven Development。振る舞いの記述を起点にする進め方。 |  |
| **CDN** | 略語 | ― | Content Delivery Network。配信元に代わって資産を地理的に分散配信する仕組み。 | ○ |
| **Cloudflare** | 製品名・プロジェクト名 | CloudFlare、cloudflare | CDNとエッジ実行環境を提供するサービス。 |  |
| **Cookie** | 製品名・プロジェクト名 | クッキー、cookie | サーバがブラウザへ保存させる小さな名前付きの値。 |  |
| **CORS** | 略語 | ― | Cross-Origin Resource Sharing。異なるオリジンへの要求を許可する仕組み。 | ○ |
| **CQRS** | 略語 | ― | Command Query Responsibility Segregation。更新系と参照系を分離する構成。 | ○ |
| **CRDT** | 略語 | ― | Conflict-free Replicated Data Type。収束が保証される複製データ型。 |  |
| **CSP** | 略語 | ― | Content Security Policy。読み込み元と実行を制限するブラウザ機構。 |  |
| **CSR** | 略語 | ― | Client-Side Rendering。ブラウザ側でHTMLを生成する方式。 |  |
| **CSRF** | 略語 | ― | Cross-Site Request Forgery。利用者の資格情報を悪用させる攻撃。 | ○ |
| **CSS** | 略語 | ― | Cascading Style Sheets。表示の指定を記述する言語。 |  |
| **DDD** | 略語 | ― | Domain-Driven Design。業務領域のモデルを中心に据える設計手法。 |  |
| **DNS** | 略語 | ― | Domain Name System。名前をアドレスへ解決する分散データベース。 | ○ |
| **Docker** | 製品名・プロジェクト名 | docker | コンテナの構築と実行を提供する製品。 | ○ |
| **DOM** | 略語 | ― | Document Object Model。文書をオブジェクトの木として扱うAPI。 | ○ |
| **DST** | 略語 | ― | Daylight Saving Time。夏時間。地域と年によって切り替え規則が変わる。 |  |
| **Elasticsearch** | 製品名・プロジェクト名 | ElasticSearch、elasticsearch | 転置索引を用いた分散全文検索エンジン。 | ○ |
| **Express** | 製品名・プロジェクト名 | express | Node.js向けの最小構成のHTTPフレームワーク。 |  |
| **GDPR** | 略語 | ― | General Data Protection Regulation。EUの個人データ保護規則。 | ○ |
| **GitHub** | 製品名・プロジェクト名 | Github、GITHUB | Gitホスティングと開発ワークフローを提供するサービス。 |  |
| **GitLab** | 製品名・プロジェクト名 | Gitlab、GITLAB | Gitホスティングとパイプラインを提供するサービス。 |  |
| **Grafana** | 製品名・プロジェクト名 | grafana | メトリクスとログの可視化ダッシュボード。 |  |
| **GraphQL** | 製品名・プロジェクト名 | Graphql、graphQL | クライアントが必要な項目を指定して取得するAPIクエリ言語。 | ○ |
| **HMR** | 略語 | ― | Hot Module Replacement。実行状態を保ったままモジュールを差し替える開発機能。 |  |
| **HTML** | 略語 | ― | HyperText Markup Language。文書構造を表すマークアップ言語。 |  |
| **HTTP** | 略語 | ― | HyperText Transfer Protocol。Web上でメッセージを交換するプロトコル。 |  |
| **IaC** | 略語 | IAC | Infrastructure as Code。インフラ構成をコードで宣言し再現する方法。 |  |
| **JavaScript** | 製品名・プロジェクト名 | javascript、Javascript、JavaScipt、JS(非推奨) | ECMAScript仕様に基づくWebの標準スクリプト言語。 |  |
| **JSON** | 略語 | ― | JavaScript Object Notation。テキストベースのデータ交換形式。 |  |
| **JWT** | 略語 | ― | JSON Web Token。署名付きの主張をJSONで表すトークン形式。 |  |
| **K8s** | 略語 | k8s、K8S | Kubernetes の公式な略記。初出時は Kubernetes を先に示す。 |  |
| **Kafka** | 製品名・プロジェクト名 | kafka | 分散ログを基盤とするイベントストリーミング基盤。 | ○ |
| **KMS** | 略語 | ― | Key Management Service。暗号鍵の生成・保管・利用を担うサービス。 |  |
| **Kubernetes** | 製品名・プロジェクト名 | kubernetes | コンテナ化されたアプリケーションの配置と回復を宣言的に扱うオーケストレータ。 | ○ |
| **MFA** | 略語 | ― | Multi-Factor Authentication。複数要素で本人性を確認する認証。 |  |
| **MongoDB** | 製品名・プロジェクト名 | Mongodb、MongoDb | ドキュメント指向のデータベース。 | ○ |
| **MTTR** | 略語 | ― | Mean Time To Recovery。復旧までに要した時間の平均。 |  |
| **MVCC** | 略語 | ― | Multi-Version Concurrency Control。版を保持して読み書きの競合を避ける方式。 | ○ |
| **MySQL** | 製品名・プロジェクト名 | MySql、Mysql | オープンソースのリレーショナルデータベース管理システム。 |  |
| **Next.js** | 製品名・プロジェクト名 | NextJS、NextJs、next.js | Reactを用いたアプリケーションフレームワーク。 |  |
| **nginx** | 製品名・プロジェクト名 | Nginx、NGINX | リバースプロキシ・Webサーバとして広く使われるオープンソース実装。 | ○ |
| **Node.js** | 製品名・プロジェクト名 | NodeJS、NodeJs、Node.JS、nodejs | V8上で動作するサーバサイドJavaScriptランタイム。 | ○ |
| **OIDC** | 略語 | ― | OpenID Connect。OAuth 2.0上に構築された認証プロトコル。 |  |
| **OLAP** | 略語 | ― | Online Analytical Processing。大量データの集計・分析を扱う用途。 | ○ |
| **OLTP** | 略語 | ― | Online Transaction Processing。短い更新処理を大量に扱う用途。 | ○ |
| **OpenAPI** | 製品名・プロジェクト名 | Open API、OpenApi | HTTP APIの契約を記述する仕様。旧称Swagger。 | ○ |
| **OpenTelemetry** | 製品名・プロジェクト名 | Opentelemetry、openTelemetry | トレース・メトリクス・ログの計装と送信を標準化する枠組み。 | ○ |
| **ORM** | 略語 | ― | Object-Relational Mapping。オブジェクトと関係モデルを対応付ける層。 | ○ |
| **PII** | 略語 | ― | Personally Identifiable Information。個人を特定できる情報。 |  |
| **PKCE** | 略語 | ― | Proof Key for Code Exchange。認可コード横取りを防ぐ拡張。 | ○ |
| **Playwright** | 製品名・プロジェクト名 | PlayWright、playwright | ブラウザ自動操作によるE2Eテストの実行基盤。 |  |
| **PostgreSQL** | 製品名・プロジェクト名 | Postgres、Postgresql、postgreSQL | オープンソースのリレーショナルデータベース管理システム。 | ○ |
| **Prisma** | 製品名・プロジェクト名 | prisma | 型生成とマイグレーションを備えるNode.js向けORM。 |  |
| **Prometheus** | 製品名・プロジェクト名 | prometheus | 時系列メトリクスの収集と問い合わせを行う監視システム。 | ○ |
| **PWA** | 略語 | ― | Progressive Web App。オフライン動作やインストールに対応するWebアプリ。 | ○ |
| **RBAC** | 略語 | ― | Role-Based Access Control。役割に権限を割り当てる認可方式。 | ○ |
| **React** | 製品名・プロジェクト名 | react | 宣言的にUIを構築するJavaScriptライブラリ。 | ○ |
| **Redis** | 製品名・プロジェクト名 | REDIS | インメモリのキー・バリューストア。 | ○ |
| **REST** | 略語 | ― | Representational State Transfer。Webの制約を明文化したアーキテクチャスタイル。 | ○ |
| **RLS** | 略語 | ― | Row Level Security。行単位で参照・更新を制限するデータベース機能。 |  |
| **RPC** | 略語 | ― | Remote Procedure Call。遠隔の手続きを呼び出す通信様式。 |  |
| **RPO** | 略語 | ― | Recovery Point Objective。障害時に許容するデータ損失の範囲。 |  |
| **RSC** | 略語 | ― | React Server Components。サーバ側で実行されるReactコンポーネント。 |  |
| **RTO** | 略語 | ― | Recovery Time Objective。障害からの復旧までに許容する時間。 |  |
| **SAML** | 略語 | ― | Security Assertion Markup Language。XMLで認証情報を交換する規格。 |  |
| **SBOM** | 略語 | ― | Software Bill of Materials。構成部品の一覧。 |  |
| **SCIM** | 略語 | ― | System for Cross-domain Identity Management。利用者情報を同期する規格。 |  |
| **SLA** | 略語 | ― | Service Level Agreement。顧客と合意する品質水準と補償。 |  |
| **SLI** | 略語 | ― | Service Level Indicator。サービス品質を表す測定値。 |  |
| **SLO** | 略語 | ― | Service Level Objective。SLIに対して定める目標値。 |  |
| **SPA** | 略語 | ― | Single Page Application。単一文書上で画面遷移を行う構成。 |  |
| **SQL** | 略語 | ― | Structured Query Language。関係データベースへの問い合わせ言語。 |  |
| **SQLite** | 製品名・プロジェクト名 | Sqlite、SQLLite | 単一ファイルで動作する組み込み型のリレーショナルデータベース。 |  |
| **SSE** | 略語 | ― | Server-Sent Events。サーバからクライアントへの単方向ストリーム。 |  |
| **SSG** | 略語 | ― | Static Site Generation。ビルド時にHTMLを生成する方式。 | ○ |
| **SSO** | 略語 | ― | Single Sign-On。一度の認証で複数サービスを利用できる仕組み。 |  |
| **SSR** | 略語 | ― | Server-Side Rendering。サーバ側でHTMLを生成する方式。 | ○ |
| **SSRF** | 略語 | ― | Server-Side Request Forgery。サーバに任意の宛先へ要求させる脆弱性。 | ○ |
| **Storybook** | 製品名・プロジェクト名 | StoryBook、storybook | UIコンポーネントを独立して開発・確認する環境。 | ○ |
| **Stripe** | 製品名・プロジェクト名 | stripe | 決済APIを提供するサービス。 | ○ |
| **Svelte** | 製品名・プロジェクト名 | svelte | コンパイル時にUI更新コードを生成するフレームワーク。 | ○ |
| **TDD** | 略語 | ― | Test-Driven Development。テストを先に書いて実装を導く進め方。 |  |
| **Terraform** | 製品名・プロジェクト名 | terraform | 宣言的にインフラを構成管理するツール。 | ○ |
| **TLS** | 略語 | ― | Transport Layer Security。通信の機密性と相手認証を提供するプロトコル。 |  |
| **TTL** | 略語 | ― | Time To Live。キャッシュやレコードの有効期間。 |  |
| **TypeScript** | 製品名・プロジェクト名 | Typescript、typescript、TS(非推奨) | JavaScriptへ静的型を加えた言語。 | ○ |
| **URI** | 略語 | ― | Uniform Resource Identifier。リソースを一意に識別する文字列。 |  |
| **URL** | 略語 | ― | Uniform Resource Locator。所在を含めてリソースを指す識別子。 |  |
| **Vite** | 製品名・プロジェクト名 | VITE | ESMを前提とした開発サーバとビルドツール。 | ○ |
| **Vue.js** | 製品名・プロジェクト名 | VueJS、vue.js | 宣言的にUIを構築するJavaScriptフレームワーク。 |  |
| **WAF** | 略語 | ― | Web Application Firewall。HTTP層で攻撃通信を遮断する仕組み。 |  |
| **WAL** | 略語 | ― | Write-Ahead Logging。変更を先にログへ書いて耐障害性を確保する方式。 |  |
| **WCAG** | 略語 | ― | Web Content Accessibility Guidelines。Webコンテンツのアクセシビリティ指針。 | ○ |
| **Web** | 製品名・プロジェクト名 | ウェブ、ウエブ、WEB | URI・HTTP・HTMLを基盤とする分散ハイパーテキストシステム。 |  |
| **WebAssembly** | 製品名・プロジェクト名 | Webassembly、webassembly | ブラウザなどで動作する可搬なバイナリ命令形式。 |  |
| **Webpack** | 製品名・プロジェクト名 | WebPack、webPack | 依存グラフを解析して資産をまとめるバンドラ。 |  |
| **WebSocket** | 製品名・プロジェクト名 | Websocket、websocket | 単一のTCP接続上で双方向通信を行うプロトコル。 | ○ |
| **XSS** | 略語 | ― | Cross-Site Scripting。攻撃者のスクリプトを利用者の文脈で実行させる脆弱性。 |  |

## 日本語 (五十音順)

### あ行

| 正表記 | 分類 | 使わない表記 | 説明 | 索引 |
|---|---|---|---|---|
| **アーキテクチャ** | 日本語表記 | アーキテクチャー | 構成要素とその関係、変更しにくい決定の集合。 | ○ |
| **アクティビティ** | 日本語表記 | アクティビティー | 利用者やシステムの活動記録・活動単位。 |  |
| **イテレータ** | 日本語表記 | イテレーター | 要素を順に取り出す規約を実装した対象。 |  |
| **インタフェース** | 日本語表記 | インターフェース、インターフェイス | 異なる構成要素の間で守られる接続規約。 |  |
| **ウィジェット** | 日本語表記 | ウイジェット | 再利用可能なUI部品。 |  |
| **ウィンドウ** | 日本語表記 | ウインドウ | 画面上の表示単位。またはブラウザのグローバルオブジェクト。 |  |
| **エラー処理** | 訳語の選択 | エラーハンドリング(非推奨) | 失敗を検出し、回復または通知する処理。 |  |
| **エントリ** | 日本語表記 | エントリー | 一覧・表・索引などに登録された1件の項目。 |  |
| **オペレータ** | 日本語表記 | オペレーター | 演算子。またはKubernetesで運用手順をコード化した制御機構。 |  |

### か行

| 正表記 | 分類 | 使わない表記 | 説明 | 索引 |
|---|---|---|---|---|
| **可観測性** | 訳語の選択 | オブザーバビリティ(非推奨) | 外部から得られる出力だけで内部状態を説明できる度合い。 |  |
| **カテゴリ** | 日本語表記 | カテゴリー | 分類の単位。 |  |
| **クエリ** | 日本語表記 | クエリー | データベースや検索系へ渡す問い合わせ。 |  |
| **クラスタ** | 日本語表記 | クラスター | 協調して1つのサービスを構成する複数ノードの集合。 |  |
| **コンテナ** | 日本語表記 | コンテナー | 名前空間とcgroupsでプロセスを隔離した実行単位。 | ○ |
| **コントローラ** | 日本語表記 | コントローラー | 入力を受けて処理を振り分ける制御責務。 |  |
| **コンパイラ** | 日本語表記 | コンパイラー | ソースコードを別の形式へ変換するプログラム。 |  |
| **コンピュータ** | 日本語表記 | コンピューター | プログラムを実行する計算機。 |  |

### さ行

| 正表記 | 分類 | 使わない表記 | 説明 | 索引 |
|---|---|---|---|---|
| **サーバ** | 日本語表記 | サーバー | 要求を受けて応答を返す側のプログラムまたは計算機。 |  |
| **シミュレーション** | 日本語表記 | シュミレーション | 対象の振る舞いを模して観察する方法。 |  |
| **シリアライズ** | 訳語の選択 | 直列化(非推奨) | 構造を持つ値をバイト列や文字列へ変換すること。 |  |
| **スキーマ** | 日本語表記 | スキーマー | データの構造と制約の定義。 |  |
| **スケジューラ** | 日本語表記 | スケジューラー | 実行対象と実行時刻を決めて割り当てる機構。 |  |
| **セキュリティ** | 日本語表記 | セキュリティー | 資産を脅威から守るための性質と手段の総称。 |  |
| **ソフトウェア** | 日本語表記 | ソフトウエア | 計算機上で動作するプログラムと関連資産。 |  |

### た行

| 正表記 | 分類 | 使わない表記 | 説明 | 索引 |
|---|---|---|---|---|
| **ディレクトリ** | 日本語表記 | ディレクトリー | ファイルを階層的にまとめる入れ物。 |  |
| **デコレータ** | 日本語表記 | デコレーター | 対象の定義を包んで振る舞いを追加する記法。 |  |
| **デフォルト** | 訳語の選択 | 既定(非推奨) | 明示指定がないときに適用される値や動作。 |  |
| **トリガー** | 日本語表記 | トリガ | ある事象を検知して処理を起動する仕組み。 |  |

### は行

| 正表記 | 分類 | 使わない表記 | 説明 | 索引 |
|---|---|---|---|---|
| **ハードウェア** | 日本語表記 | ハードウエア | 計算機を構成する物理装置。 |  |
| **パラメータ** | 日本語表記 | パラメーター | 関数・クエリ・設定へ外から与える値。 |  |
| **バリデータ** | 日本語表記 | バリデーター | 入力が規約を満たすかを判定する処理。 |  |
| **ハンドラ** | 日本語表記 | ハンドラー | 特定の事象を受け取って処理する関数。 |  |
| **ファイアウォール** | 日本語表記 | ファイヤウォール、ファイアーウォール | 通信を規則に従って通過・遮断する境界防御。 |  |
| **フィルタ** | 日本語表記 | フィルター | 条件に合う要素だけを通す処理。 |  |
| **フッタ** | 日本語表記 | フッター | 文書・画面・メッセージの末尾に置く領域。 |  |
| **プライバシー** | 日本語表記 | プライバシ | 個人に関する情報を本人の期待の範囲で扱う要求。 |  |
| **ブラウザ** | 日本語表記 | ブラウザー | HTML・CSS・JavaScriptを解釈して画面と操作へ変換するクライアント。 |  |
| **プロキシ** | 日本語表記 | プロキシー | クライアントとサーバの間に立って要求を中継する仕組み。 |  |
| **プロパティ** | 日本語表記 | プロパティー | オブジェクトが持つ名前付きの値。 |  |
| **冪等** | 日本語表記 | べき等、ベき等 | 同じ操作を何度適用しても結果が変わらない性質。 |  |
| **ベクタ** | 日本語表記 | ベクター | 数値の並びで表す量。埋め込み表現の格納単位としても使う。 |  |
| **ヘッダ** | 日本語表記 | ヘッダー | メッセージ本体の前に置かれるメタデータ。HTTPヘッダ、ファイルヘッダなど。 |  |
| **ポインタ** | 日本語表記 | ポインター | 記憶域の位置を指す値。 |  |

### ま行

| 正表記 | 分類 | 使わない表記 | 説明 | 索引 |
|---|---|---|---|---|
| **ミドルウェア** | 日本語表記 | ミドルウエア | 要求と応答の経路に挟んで共通処理を担う層。 | ○ |
| **メモリ** | 日本語表記 | メモリー | 実行中のデータを保持する主記憶。 |  |
| **モニタ** | 日本語表記 | モニター | 状態を継続的に観測する仕組み。 |  |

### や行

| 正表記 | 分類 | 使わない表記 | 説明 | 索引 |
|---|---|---|---|---|
| **ユーザー** | 日本語表記 | ユーザ | システムを利用する人。 |  |

### ら行

| 正表記 | 分類 | 使わない表記 | 説明 | 索引 |
|---|---|---|---|---|
| **ライブラリ** | 日本語表記 | ライブラリー | アプリケーションから呼び出して使う再利用可能なコードの集合。 |  |
| **リトライ** | 訳語の選択 | 再試行(非推奨) | 失敗した操作を条件付きでやり直すこと。 | ○ |
| **ルータ** | 日本語表記 | ルーター | 経路情報に基づいてパケットまたは要求を転送する装置・機構。 |  |
| **レイテンシ** | 日本語表記 | レイテンシー | 要求から応答までに要する時間。 |  |
| **レジストリ** | 日本語表記 | レジストリー | パッケージやコンテナイメージを登録・配布する保管庫。 |  |
| **レンダラ** | 日本語表記 | レンダラー | データを表示可能な形へ変換する処理系。 |  |

## 略語の初出

次の略語は、本文で最初に説明する箇所で `略語 (英語正式名称)` の形を示します (S-EN-001)。

| 略語 | 英語正式名称 |
|---|---|
| HTTP | HyperText Transfer Protocol |
| URI | Uniform Resource Identifier |
| URL | Uniform Resource Locator |
| HTML | HyperText Markup Language |
| CSS | Cascading Style Sheets |
| DNS | Domain Name System |
| TLS | Transport Layer Security |
| API | Application Programming Interface |
| CDN | Content Delivery Network |
| SPA | Single Page Application |
| CSR | Client-Side Rendering |
| SSR | Server-Side Rendering |
| SSG | Static Site Generation |
| CORS | Cross-Origin Resource Sharing |
| CSRF | Cross-Site Request Forgery |
| XSS | Cross-Site Scripting |
| SSRF | Server-Side Request Forgery |
| JWT | JSON Web Token |
| OIDC | OpenID Connect |
| RBAC | Role-Based Access Control |
| ABAC | Attribute-Based Access Control |
| MFA | Multi-Factor Authentication |
| SSO | Single Sign-On |
| SAML | Security Assertion Markup Language |
| SCIM | System for Cross-domain Identity Management |
| PKCE | Proof Key for Code Exchange |
| CSP | Content Security Policy |
| ORM | Object-Relational Mapping |
| OLTP | Online Transaction Processing |
| OLAP | Online Analytical Processing |
| MVCC | Multi-Version Concurrency Control |
| WAL | Write-Ahead Logging |
| RLS | Row-Level Security |
| CQRS | Command Query Responsibility Segregation |
| CRDT | Conflict-free Replicated Data Type |
| DDD | Domain-Driven Design |
| ADR | Architecture Decision Record |
| TDD | Test-Driven Development |
| BDD | Behavior-Driven Development |
| IaC | Infrastructure as Code |
| SLI | Service Level Indicator |
| SLO | Service Level Objective |
| SLA | Service Level Agreement |
| RTO | Recovery Time Objective |
| RPO | Recovery Point Objective |
| MTTR | Mean Time To Recovery |
| WAF | Web Application Firewall |
| SBOM | Software Bill of Materials |
| WCAG | Web Content Accessibility Guidelines |
| ARIA | Accessible Rich Internet Applications |
| GDPR | General Data Protection Regulation |
| PII | Personally Identifiable Information |
| KMS | Key Management Service |
| PWA | Progressive Web App |
| HMR | Hot Module Replacement |
| RSC | React Server Components |
| SSE | Server-Sent Events |
| DOM | Document Object Model |
| JSON | JavaScript Object Notation |
| SQL | Structured Query Language |
| REST | Representational State Transfer |
| RPC | Remote Procedure Call |
| TTL | Time To Live |
| DST | Daylight Saving Time |
| ACID | Atomicity, Consistency, Isolation, Durability |

