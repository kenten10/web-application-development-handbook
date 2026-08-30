# 学習ルート

<!-- handbook:generated; do not edit -->
基準日: 2026-08-30

このファイルは `config/learning-paths.json` と `config/learning-levels.json` から生成されます。ルート定義を変更した場合は `npm run generate:learning-paths` を実行してください。

## ルート一覧

| ルート | 想定読者 | 節数 | 推定時間 |
|---|---|---:|---:|
| [標準通読](#route-standard) | Web開発経験1〜3年で、担当領域を限定せず全体像をつかみたい読者 | 199 | 24時間5分 |
| [フロントエンド強化](#route-frontend) | UI実装だけでなく、ブラウザ、状態、性能、API連携まで理解したいフロントエンド開発者 | 157 | 23時間10分 |
| [バックエンド・DB強化](#route-backend-db) | API、認証、RDB、非同期処理を中心に本番設計力を高めたいバックエンド開発者 | 255 | 42時間20分 |
| [インフラ・SRE強化](#route-infra-sre) | クラウド、デリバリー、可観測性、信頼性を体系的に学びたい開発者・SRE | 154 | 20時間 |
| [セキュリティ強化](#route-security) | アプリケーション、認証、インフラ、サプライチェーンを横断して防御設計を学びたい開発者 | 210 | 33時間55分 |
| [テックリード・設計強化](#route-tech-lead) | 技術選定、設計判断、チーム運営、移行計画を担うテックリード候補 | 310 | 50時間25分 |

## 使い方

1. 担当領域を限定しない場合は標準通読から始めます。
2. 目的別ルートへ途中参加する場合は、各ルートの「途中参加チェック」を先に確認します。
3. チェック項目を説明できない場合は、リンク先の節を読んでから開始ステージへ進みます。
4. 推定時間は本文と短いコード例を追う時間です。長時間の実装課題、環境構築、発展改造は別途見積もります。
5. 同じ節を複数ルートで学ぶ場合、2回目以降は復習として短縮できます。

<a id="route-standard"></a>
## 標準通読

**想定読者:** Web開発経験1〜3年で、担当領域を限定せず全体像をつかみたい読者

**到達目標:** 全30章の中核概念を約24時間で一周し、必要な実務選択へ進むための共通語彙を得る。

**開始方法:** 第1章から開始する。既知の章は節末の判断軸と必修節だけを確認して先へ進む。

**ルート全体:** 199節 / 24時間5分

### 1. Web基礎

ブラウザとサーバの間で何が起きるかを理解する。

**このステージ:** 25節 / 2時間55分

- [1.1 Webの誕生と設計思想](02-part1-foundations.md#section-1-1) — **必修** / 5分
- [1.2 静的Webから動的Webへ ― 4つの時代](02-part1-foundations.md#section-1-2) — **必修** / 5分
- [1.3 クライアント/サーバモデルとステートレス性](02-part1-foundations.md#section-1-3) — **必修** / 5分
- [1.4 「Webアプリケーション」とは何か](02-part1-foundations.md#section-1-4) — **必修** / 5分
- [1.5 本書の使い方](02-part1-foundations.md#section-1-5) — **必修** / 5分
- [1.6 本書が扱う読者層](02-part1-foundations.md#section-1-6) — **必修** / 5分
- [1.7 本書が扱う範囲と扱わない範囲](02-part1-foundations.md#section-1-7) — **必修** / 5分
- [1.8 コード例について](02-part1-foundations.md#section-1-8) — **必修** / 5分
- [1.9 読み始める前に](02-part1-foundations.md#section-1-9) — **必修** / 5分
- [2.1 HTTPメッセージの構造](02-part1-foundations.md#section-2-1) — **必修** / 5分
- [2.2 メソッドの意味論](02-part1-foundations.md#section-2-2) — **必修** / 5分
- [2.3 ステータスコード](02-part1-foundations.md#section-2-3) — **必修** / 10分
- [2.4 ヘッダ ― HTTPの真の主役](02-part1-foundations.md#section-2-4) — **必修** / 5分
- [2.5 Keep-Aliveとコネクション再利用](02-part1-foundations.md#section-2-5) — **必修** / 5分
- [2.9 デバッグの実践技法](02-part1-foundations.md#section-2-9) — **必修** / 5分
- [3.1 URI/URL/URN](02-part1-foundations.md#section-3-1) — **必修** / 10分
- [3.2 DNS ― 名前を住所に変える](02-part1-foundations.md#section-3-2) — **必修** / 10分
- [3.3 TLS/SSL ― 通信を暗号化する](02-part1-foundations.md#section-3-3) — **必修** / 15分
- [3.5 ブラウザがURLを叩いてからHTMLを受け取るまで (まとめ)](02-part1-foundations.md#section-3-5) — **必修** / 5分
- [4.1 ブラウザのレンダリングパイプライン](02-part1-foundations.md#section-4-1) — **必修** / 10分
- [4.2 リフローとリペイントを抑える](02-part1-foundations.md#section-4-2) — **必修** / 5分
- [4.3 DOMの中身](02-part1-foundations.md#section-4-3) — **必修** / 10分
- [4.4 CSSの仕組み](02-part1-foundations.md#section-4-4) — **必修** / 10分
- [4.5 JavaScriptランタイムとイベントループ](02-part1-foundations.md#section-4-5) — **必修** / 10分
- [4.6 モジュールシステムの進化](02-part1-foundations.md#section-4-6) — **必修** / 10分

### 2. フロントエンド基礎

JavaScript、UI、状態、ビルド、レンダリングの判断軸を得る。

**このステージ:** 24節 / 3時間15分

- [5.1 変数とスコープ ― `var`、`let`、`const`](03-part2-frontend.md#section-5-1) — **必修** / 5分
- [5.2 値型と参照型、等価性](03-part2-frontend.md#section-5-2) — **必修** / 10分
- [5.3 関数 ― First-class Citizen](03-part2-frontend.md#section-5-3) — **必修** / 10分
- [5.4 非同期処理の進化](03-part2-frontend.md#section-5-4) — **必修** / 10分
- [5.7 TypeScript ― 型システムの設計思想](03-part2-frontend.md#section-5-7) — **必修** / 20分
- [5.9 エラー処理の設計](03-part2-frontend.md#section-5-9) — **必修** / 10分
- [6.1 Reactの登場と「単方向データフロー」](03-part2-frontend.md#section-6-1) — **必修** / 5分
- [6.2 仮想DOMの正体](03-part2-frontend.md#section-6-2) — **必修** / 5分
- [6.4 Hooks の仕組み ― なぜ呼び出し順序が重要なのか](03-part2-frontend.md#section-6-4) — **必修** / 5分
- [6.8 フレームワーク選択の現実的な指針](03-part2-frontend.md#section-6-8) — **必修** / 5分
- [6.9 アクセシビリティ (a11y) ― 全ての人に届けるUI](03-part2-frontend.md#section-6-9) — **必修** / 25分
- [7.1 状態の3分類](03-part2-frontend.md#section-7-1) — **必修** / 5分
- [7.4 サーバ状態の特殊性](03-part2-frontend.md#section-7-4) — **必修** / 5分
- [7.5 TanStack Query (React Query) ― サーバ状態管理の代表例](03-part2-frontend.md#section-7-5) — **必修** / 10分
- [7.6 楽観的更新 (Optimistic Update)](03-part2-frontend.md#section-7-6) — **必修** / 10分
- [7.7 リアクティブな状態とフォーム](03-part2-frontend.md#section-7-7) — **必修** / 10分
- [8.1 バンドラの基本原理](03-part2-frontend.md#section-8-1) — **必修** / 5分
- [8.4 Vite ― 開発体験の革新](03-part2-frontend.md#section-8-4) — **必修** / 10分
- [8.5 ツリーシェイキング](03-part2-frontend.md#section-8-5) — **必修** / 5分
- [8.6 コード分割 (Code Splitting)](03-part2-frontend.md#section-8-6) — **必修** / 5分
- [9.1 CSR (Client-Side Rendering)](03-part2-frontend.md#section-9-1) — **必修** / 5分
- [9.2 SSR (Server-Side Rendering)](03-part2-frontend.md#section-9-2) — **必修** / 5分
- [9.3 SSG (Static Site Generation)](03-part2-frontend.md#section-9-3) — **必修** / 5分
- [9.7 戦略の選択基準](03-part2-frontend.md#section-9-7) — **必修** / 5分

### 3. バックエンド基礎

ランタイム、フレームワーク、API、認証の中核を学ぶ。

**このステージ:** 25節 / 3時間30分

- [10.1 並行性モデルの3パターン](04-part3-backend.md#section-10-1) — **必修** / 10分
- [10.2 Node.js ― イベントループの代表](04-part3-backend.md#section-10-2) — **必修** / 5分
- [10.9 ランタイム選択の判断軸 (まとめ)](04-part3-backend.md#section-10-9) — **必修** / 5分
- [11.1 「ミドルウェア」というアイディア](04-part3-backend.md#section-11-1) — **必修** / 5分
- [11.6 ミドルウェアの仕組み ― Onion vs Chain](04-part3-backend.md#section-11-6) — **必修** / 10分
- [11.7 依存性注入 (DI) とテスタビリティ](04-part3-backend.md#section-11-7) — **必修** / 10分
- [11.8 フレームワーク選択の指針](04-part3-backend.md#section-11-8) — **必修** / 5分
- [12.1 RESTの設計思想 ― Roy Fielding の博士論文を読み返す](04-part3-backend.md#section-12-1) — **必修** / 5分
- [12.3 リソース指向設計の実践](04-part3-backend.md#section-12-3) — **必修** / 5分
- [12.4 ページネーション、フィルタ、ソート](04-part3-backend.md#section-12-4) — **必修** / 5分
- [12.5 エラーレスポンスの設計](04-part3-backend.md#section-12-5) — **必修** / 5分
- [12.6 OpenAPI ― API設計の標準仕様](04-part3-backend.md#section-12-6) — **必修** / 10分
- [12.12 API方式選択の指針](04-part3-backend.md#section-12-12) — **必修** / 5分
- [13.1 パスワード認証の基礎](04-part3-backend.md#section-13-1) — **必修** / 10分
- [13.2 セッション vs トークン ― 状態管理の対立](04-part3-backend.md#section-13-2) — **必修** / 5分
- [13.3 セッション認証の実装](04-part3-backend.md#section-13-3) — **必修** / 10分
- [13.4 JWT (JSON Web Token) の構造と注意点](04-part3-backend.md#section-13-4) — **必修** / 10分
- [13.5 リフレッシュトークン](04-part3-backend.md#section-13-5) — **必修** / 5分
- [13.6 CSRF 対策](04-part3-backend.md#section-13-6) — **必修** / 10分
- [13.7 OAuth 2.0 ― 第三者認可](04-part3-backend.md#section-13-7) — **必修** / 10分
- [13.8 OIDC (OpenID Connect) ― OAuth の上に立つ認証](04-part3-backend.md#section-13-8) — **必修** / 10分
- [13.10 認可モデル ― RBAC、ABAC、ReBAC](04-part3-backend.md#section-13-10) — **必修** / 10分
- [13.11 認可ロジックを「中央集権」にする](04-part3-backend.md#section-13-11) — **必修** / 10分
- [13.12 セキュリティの基本原則 (まとめ)](04-part3-backend.md#section-13-12) — **必修** / 5分
- [13.20 PKCE ― OAuth/OIDC のクライアント側保護](04-part3-backend.md#section-13-20) — **必修** / 30分

### 4. データ基礎

データモデル、整合性、検索、非同期処理の基礎を学ぶ。

**このステージ:** 27節 / 3時間15分

- [14.1 リレーショナルモデルの考え方](05-part4-data.md#section-14-1) — **必修** / 5分
- [14.2 正規化と非正規化の判断](05-part4-data.md#section-14-2) — **必修** / 10分
- [14.3 インデックスの内部構造](05-part4-data.md#section-14-3) — **必修** / 10分
- [14.4 実行計画 (EXPLAIN) の読み方](05-part4-data.md#section-14-4) — **必修** / 10分
- [14.5 N+1 問題](05-part4-data.md#section-14-5) — **必修** / 10分
- [14.6 ACIDとトランザクション](05-part4-data.md#section-14-6) — **必修** / 5分
- [14.7 トランザクション分離レベル](05-part4-data.md#section-14-7) — **必修** / 10分
- [14.8 MVCC ― スナップショットによる並行制御](05-part4-data.md#section-14-8) — **必修** / 10分
- [14.9 ロック ― 楽観 vs 悲観](05-part4-data.md#section-14-9) — **必修** / 10分
- [14.10 デッドロック](05-part4-data.md#section-14-10) — **必修** / 5分
- [14.11 ORM の光と影](05-part4-data.md#section-14-11) — **必修** / 10分
- [14.12 マイグレーション戦略](05-part4-data.md#section-14-12) — **必修** / 5分
- [15.1 NoSQL の4分類](05-part4-data.md#section-15-1) — **必修** / 5分
- [15.2 Redis ― 最も使われるKVS](05-part4-data.md#section-15-2) — **必修** / 15分
- [15.5 CAP 定理と PACELC](05-part4-data.md#section-15-5) — **必修** / 5分
- [15.6 結果整合性 (Eventual Consistency)](05-part4-data.md#section-15-6) — **必修** / 5分
- [15.8 PostgreSQL でどこまで戦えるか](05-part4-data.md#section-15-8) — **必修** / 5分
- [16.1 転置インデックスの原理](05-part4-data.md#section-16-1) — **必修** / 5分
- [16.2 アナライザとトークン化](05-part4-data.md#section-16-2) — **必修** / 5分
- [16.3 関連度スコアリング ― TF-IDF と BM25](05-part4-data.md#section-16-3) — **必修** / 5分
- [16.7 PostgreSQL の全文検索](05-part4-data.md#section-16-7) — **必修** / 5分
- [16.9 検索エンジン選択の指針](05-part4-data.md#section-16-9) — **必修** / 5分
- [17.1 同期 vs 非同期 ― いつ非同期にすべきか](05-part4-data.md#section-17-1) — **必修** / 5分
- [17.2 メッセージキューの基本](05-part4-data.md#section-17-2) — **必修** / 10分
- [17.6 ジョブキュー ― Web アプリでの定番](05-part4-data.md#section-17-6) — **必修** / 5分
- [17.7 Pub/Sub パターンと Fan-out](05-part4-data.md#section-17-7) — **必修** / 5分
- [17.11 Outbox パターン ― 信頼性の高いイベント発行](05-part4-data.md#section-17-11) — **必修** / 10分

### 5. インフラと運用

本番環境を構築し、変更し、観測する基礎を学ぶ。

**このステージ:** 29節 / 3時間10分

- [18.1 プロセスとスレッド](06-part5-infrastructure.md#section-18-1) — **必修** / 5分
- [18.2 ファイルディスクリプタ ― 全ては「ファイル」](06-part5-infrastructure.md#section-18-2) — **必修** / 5分
- [18.5 ネットワークスタック](06-part5-infrastructure.md#section-18-5) — **必修** / 5分
- [18.6 TCP のフロー制御と輻輳制御](06-part5-infrastructure.md#section-18-6) — **必修** / 5分
- [18.7 ロードバランサ ― L4 vs L7](06-part5-infrastructure.md#section-18-7) — **必修** / 5分
- [18.8 リバースプロキシとしての nginx](06-part5-infrastructure.md#section-18-8) — **必修** / 10分
- [18.9 トラブルシュート用コマンド集](06-part5-infrastructure.md#section-18-9) — **必修** / 10分
- [19.1 コンテナの仕組み](06-part5-infrastructure.md#section-19-1) — **必修** / 5分
- [19.2 Dockerfile のベストプラクティス](06-part5-infrastructure.md#section-19-2) — **必修** / 10分
- [19.3 .dockerignore の重要性](06-part5-infrastructure.md#section-19-3) — **必修** / 5分
- [19.4 docker-compose ― ローカル開発](06-part5-infrastructure.md#section-19-4) — **必修** / 10分
- [20.1 クラウドの3層モデル](06-part5-infrastructure.md#section-20-1) — **必修** / 5分
- [20.2 AWSの主要サービス](06-part5-infrastructure.md#section-20-2) — **必修** / 5分
- [20.5 サーバレスの台頭](06-part5-infrastructure.md#section-20-5) — **必修** / 5分
- [20.7 IaC (Infrastructure as Code)](06-part5-infrastructure.md#section-20-7) — **必修** / 5分
- [20.11 CIDR と VPC 設計 ― ネットワークの基礎を固める](06-part5-infrastructure.md#section-20-11) — **必修** / 10分
- [20.13 Twelve-Factor App ― クラウド時代の設計指針](06-part5-infrastructure.md#section-20-13) — **必修** / 10分
- [21.1 CI/CD の意味](06-part5-infrastructure.md#section-21-1) — **必修** / 5分
- [21.2 GitHub Actions](06-part5-infrastructure.md#section-21-2) — **必修** / 15分
- [21.4 デプロイ戦略 ― それぞれの実装と使い分け](06-part5-infrastructure.md#section-21-4) — **必修** / 5分
- [21.5 ロールバック戦略](06-part5-infrastructure.md#section-21-5) — **必修** / 5分
- [21.7 セマンティックバージョニングと変更ログ](06-part5-infrastructure.md#section-21-7) — **必修** / 5分
- [22.1 Monitoring と Observability の違い](06-part5-infrastructure.md#section-22-1) — **必修** / 5分
- [22.2 Three Pillars of Observability](06-part5-infrastructure.md#section-22-2) — **必修** / 5分
- [22.3 構造化ログ (Structured Logging)](06-part5-infrastructure.md#section-22-3) — **必修** / 5分
- [22.4 ログレベル](06-part5-infrastructure.md#section-22-4) — **必修** / 5分
- [22.6 メトリクス](06-part5-infrastructure.md#section-22-6) — **必修** / 10分
- [22.7 SLI / SLO / SLA](06-part5-infrastructure.md#section-22-7) — **必修** / 5分
- [22.9 アラート設計](06-part5-infrastructure.md#section-22-9) — **必修** / 5分

### 6. 品質と非機能要件

安全性、性能、テスト、耐障害性の共通原則を学ぶ。

**このステージ:** 38節 / 4時間15分

- [23.1 OWASP Top 10 (2021)](07-part6-quality.md#section-23-1) — **必修** / 5分
- [23.2 SQLインジェクション](07-part6-quality.md#section-23-2) — **必修** / 5分
- [23.3 XSS (Cross-Site Scripting)](07-part6-quality.md#section-23-3) — **必修** / 10分
- [23.4 CSRF (再掲)](07-part6-quality.md#section-23-4) — **必修** / 5分
- [23.5 SSRF (Server-Side Request Forgery)](07-part6-quality.md#section-23-5) — **必修** / 10分
- [23.6 認証関連の脆弱性](07-part6-quality.md#section-23-6) — **必修** / 10分
- [23.7 IDOR (Insecure Direct Object References)](07-part6-quality.md#section-23-7) — **必修** / 5分
- [23.8 オープンリダイレクト](07-part6-quality.md#section-23-8) — **必修** / 5分
- [23.9 シークレット管理](07-part6-quality.md#section-23-9) — **必修** / 5分
- [23.10 依存パッケージの脆弱性](07-part6-quality.md#section-23-10) — **必修** / 5分
- [23.11 セキュアヘッダ](07-part6-quality.md#section-23-11) — **必修** / 5分
- [23.12 ログとモニタリング](07-part6-quality.md#section-23-12) — **必修** / 5分
- [23.13 セキュリティの文化](07-part6-quality.md#section-23-13) — **必修** / 5分
- [24.1 Core Web Vitals](07-part6-quality.md#section-24-1) — **必修** / 5分
- [24.2 フロントエンド最適化](07-part6-quality.md#section-24-2) — **必修** / 5分
- [24.3 ネットワーク最適化](07-part6-quality.md#section-24-3) — **必修** / 5分
- [24.4 バックエンド最適化](07-part6-quality.md#section-24-4) — **必修** / 5分
- [24.5 キャッシュ戦略](07-part6-quality.md#section-24-5) — **必修** / 10分
- [24.6 アルゴリズムとデータ構造](07-part6-quality.md#section-24-6) — **必修** / 5分
- [24.7 プロファイリング](07-part6-quality.md#section-24-7) — **必修** / 5分
- [24.8 負荷テスト](07-part6-quality.md#section-24-8) — **必修** / 5分
- [25.1 テストピラミッド vs テストトロフィー](07-part6-quality.md#section-25-1) — **必修** / 5分
- [25.2 Unit テスト](07-part6-quality.md#section-25-2) — **必修** / 5分
- [25.3 Integration テスト](07-part6-quality.md#section-25-3) — **必修** / 10分
- [25.4 E2E テスト](07-part6-quality.md#section-25-4) — **必修** / 5分
- [25.5 コンポーネントテスト](07-part6-quality.md#section-25-5) — **必修** / 5分
- [25.6 Mock と Stub と Fake](07-part6-quality.md#section-25-6) — **必修** / 5分
- [25.10 何をテストすべきか](07-part6-quality.md#section-25-10) — **必修** / 5分
- [26.1 スケールアップ vs スケールアウト](07-part6-quality.md#section-26-1) — **必修** / 10分
- [26.3 マイクロサービス vs モノリス](07-part6-quality.md#section-26-3) — **必修** / 10分
- [26.5 イベント駆動とサービス間通信](07-part6-quality.md#section-26-5) — **必修** / 5分
- [26.6 サーキットブレーカ](07-part6-quality.md#section-26-6) — **必修** / 5分
- [26.7 リトライとバックオフ](07-part6-quality.md#section-26-7) — **必修** / 10分
- [26.8 Bulkhead (隔壁) パターン](07-part6-quality.md#section-26-8) — **必修** / 5分
- [26.9 タイムアウト戦略 ― レイヤごとの設定指針](07-part6-quality.md#section-26-9) — **必修** / 10分
- [26.10 冪等性とリトライ ― 「もう一度」を安全にする](07-part6-quality.md#section-26-10) — **必修** / 15分
- [26.11 バックプレッシャー ― 過負荷の連鎖を防ぐ](07-part6-quality.md#section-26-11) — **必修** / 15分
- [26.14 設計時の判断ポイント](07-part6-quality.md#section-26-14) — **必修** / 5分

### 7. 設計と実践

設計、レガシー対応、AI機能、総合判断を統合する。

**このステージ:** 31節 / 3時間45分

- [27.1 ドメイン駆動設計 (DDD) の基本](08-part7-practice.md#section-27-1) — **必修** / 5分
- [27.2 Value Object の実例](08-part7-practice.md#section-27-2) — **必修** / 10分
- [27.3 Aggregate と整合性境界](08-part7-practice.md#section-27-3) — **必修** / 10分
- [27.7 SOLID 原則](08-part7-practice.md#section-27-7) — **必修** / 5分
- [27.8 アンチパターンを認識する](08-part7-practice.md#section-27-8) — **必修** / 5分
- [27.9 設計の判断軸](08-part7-practice.md#section-27-9) — **必修** / 5分
- [27.10 Ubiquitous Language ― ドメインを表現する共通言語](08-part7-practice.md#section-27-10) — **必修** / 15分
- [28.1 レガシーコードの定義](08-part7-practice.md#section-28-1) — **必修** / 5分
- [28.2 レガシーを継承したらまずやること](08-part7-practice.md#section-28-2) — **必修** / 5分
- [28.3 Characterization Test](08-part7-practice.md#section-28-3) — **必修** / 5分
- [28.4 ストラングラーフィグパターン (Strangler Fig)](08-part7-practice.md#section-28-4) — **必修** / 5分
- [28.6 リファクタリングカタログ](08-part7-practice.md#section-28-6) — **必修** / 5分
- [28.7 デッドコードの掃除](08-part7-practice.md#section-28-7) — **必修** / 5分
- [28.9 ドキュメントとオンボーディング](08-part7-practice.md#section-28-9) — **必修** / 5分
- [28.11 ADR (Architecture Decision Record) ― 「なぜそう設計したか」を残す](08-part7-practice.md#section-28-11) — **必修** / 10分
- [28.12 コードレビューのベストプラクティス](08-part7-practice.md#section-28-12) — **必修** / 10分
- [29.1 LLM を組み込んだアプリの基本構造](08-part7-practice.md#section-29-1) — **必修** / 5分
- [29.2 ストリーミング応答](08-part7-practice.md#section-29-2) — **必修** / 5分
- [29.3 RAG (Retrieval-Augmented Generation)](08-part7-practice.md#section-29-3) — **必修** / 10分
- [29.4 Function Calling / Tool Use](08-part7-practice.md#section-29-4) — **必修** / 10分
- [29.6 プロンプトインジェクション](08-part7-practice.md#section-29-6) — **必修** / 5分
- [29.7 コスト管理とキャッシング](08-part7-practice.md#section-29-7) — **必修** / 5分
- [29.8 AI コーディング支援との付き合い方](08-part7-practice.md#section-29-8) — **必修** / 5分
- [29.10 AI 時代の Web 開発者像](08-part7-practice.md#section-29-10) — **必修** / 5分
- [30.1 要件定義](08-part7-practice.md#section-30-1) — **必修** / 5分
- [30.2 技術選定](08-part7-practice.md#section-30-2) — **必修** / 10分
- [30.3 データモデル](08-part7-practice.md#section-30-3) — **必修** / 15分
- [30.4 認可設計](08-part7-practice.md#section-30-4) — **必修** / 10分
- [30.5 API 設計](08-part7-practice.md#section-30-5) — **必修** / 15分
- [30.9 セキュリティ対策チェック](08-part7-practice.md#section-30-9) — **必修** / 5分
- [30.12 「最初の本番稼働日」までの優先順位](08-part7-practice.md#section-30-12) — **必修** / 5分

<a id="route-frontend"></a>
## フロントエンド強化

**想定読者:** UI実装だけでなく、ブラウザ、状態、性能、API連携まで理解したいフロントエンド開発者

**到達目標:** ブラウザ内部から本番運用までをつなぎ、フレームワーク依存ではない設計・診断能力を得る。

**開始方法:** 下記の途中参加チェックを説明できる場合は「JavaScriptとブラウザ」から開始できる。

**ルート全体:** 157節 / 23時間10分

### 途中参加チェック

次の節の要点を自分の言葉で説明できれば、前半を復習扱いにして開始できます。

- [2.1 HTTPメッセージの構造](02-part1-foundations.md#section-2-1) — **必修** / 5分
- [2.2 メソッドの意味論](02-part1-foundations.md#section-2-2) — **必修** / 5分
- [2.3 ステータスコード](02-part1-foundations.md#section-2-3) — **必修** / 10分
- [2.4 ヘッダ ― HTTPの真の主役](02-part1-foundations.md#section-2-4) — **必修** / 5分
- [3.1 URI/URL/URN](02-part1-foundations.md#section-3-1) — **必修** / 10分
- [3.2 DNS ― 名前を住所に変える](02-part1-foundations.md#section-3-2) — **必修** / 10分
- [3.3 TLS/SSL ― 通信を暗号化する](02-part1-foundations.md#section-3-3) — **必修** / 15分
- [4.1 ブラウザのレンダリングパイプライン](02-part1-foundations.md#section-4-1) — **必修** / 10分
- [4.3 DOMの中身](02-part1-foundations.md#section-4-3) — **必修** / 10分
- [4.5 JavaScriptランタイムとイベントループ](02-part1-foundations.md#section-4-5) — **必修** / 10分
- [11.1 「ミドルウェア」というアイディア](04-part3-backend.md#section-11-1) — **必修** / 5分

### 1. 通信とブラウザの前提

UIの背後にあるHTTP、TLS、DOM、レンダリングを理解する。

**このステージ:** 25節 / 2時間55分

- [1.1 Webの誕生と設計思想](02-part1-foundations.md#section-1-1) — **必修** / 5分
- [1.2 静的Webから動的Webへ ― 4つの時代](02-part1-foundations.md#section-1-2) — **必修** / 5分
- [1.3 クライアント/サーバモデルとステートレス性](02-part1-foundations.md#section-1-3) — **必修** / 5分
- [1.4 「Webアプリケーション」とは何か](02-part1-foundations.md#section-1-4) — **必修** / 5分
- [1.5 本書の使い方](02-part1-foundations.md#section-1-5) — **必修** / 5分
- [1.6 本書が扱う読者層](02-part1-foundations.md#section-1-6) — **必修** / 5分
- [1.7 本書が扱う範囲と扱わない範囲](02-part1-foundations.md#section-1-7) — **必修** / 5分
- [1.8 コード例について](02-part1-foundations.md#section-1-8) — **必修** / 5分
- [1.9 読み始める前に](02-part1-foundations.md#section-1-9) — **必修** / 5分
- [2.1 HTTPメッセージの構造](02-part1-foundations.md#section-2-1) — **必修** / 5分
- [2.2 メソッドの意味論](02-part1-foundations.md#section-2-2) — **必修** / 5分
- [2.3 ステータスコード](02-part1-foundations.md#section-2-3) — **必修** / 10分
- [2.4 ヘッダ ― HTTPの真の主役](02-part1-foundations.md#section-2-4) — **必修** / 5分
- [2.5 Keep-Aliveとコネクション再利用](02-part1-foundations.md#section-2-5) — **必修** / 5分
- [2.9 デバッグの実践技法](02-part1-foundations.md#section-2-9) — **必修** / 5分
- [3.1 URI/URL/URN](02-part1-foundations.md#section-3-1) — **必修** / 10分
- [3.2 DNS ― 名前を住所に変える](02-part1-foundations.md#section-3-2) — **必修** / 10分
- [3.3 TLS/SSL ― 通信を暗号化する](02-part1-foundations.md#section-3-3) — **必修** / 15分
- [3.5 ブラウザがURLを叩いてからHTMLを受け取るまで (まとめ)](02-part1-foundations.md#section-3-5) — **必修** / 5分
- [4.1 ブラウザのレンダリングパイプライン](02-part1-foundations.md#section-4-1) — **必修** / 10分
- [4.2 リフローとリペイントを抑える](02-part1-foundations.md#section-4-2) — **必修** / 5分
- [4.3 DOMの中身](02-part1-foundations.md#section-4-3) — **必修** / 10分
- [4.4 CSSの仕組み](02-part1-foundations.md#section-4-4) — **必修** / 10分
- [4.5 JavaScriptランタイムとイベントループ](02-part1-foundations.md#section-4-5) — **必修** / 10分
- [4.6 モジュールシステムの進化](02-part1-foundations.md#section-4-6) — **必修** / 10分

### 2. JavaScriptとTypeScript

非同期処理、型、エラー処理を実装判断へ結び付ける。

**このステージ:** 6節 / 1時間5分

- [5.1 変数とスコープ ― `var`、`let`、`const`](03-part2-frontend.md#section-5-1) — **必修** / 5分
- [5.2 値型と参照型、等価性](03-part2-frontend.md#section-5-2) — **必修** / 10分
- [5.3 関数 ― First-class Citizen](03-part2-frontend.md#section-5-3) — **必修** / 10分
- [5.4 非同期処理の進化](03-part2-frontend.md#section-5-4) — **必修** / 10分
- [5.7 TypeScript ― 型システムの設計思想](03-part2-frontend.md#section-5-7) — **必修** / 20分
- [5.9 エラー処理の設計](03-part2-frontend.md#section-5-9) — **必修** / 10分

### 3. UIフレームワークとアクセシビリティ

Reactを軸に、他方式とWeb標準を比較する。

**このステージ:** 9節 / 1時間45分

- [6.1 Reactの登場と「単方向データフロー」](03-part2-frontend.md#section-6-1) — **必修** / 5分
- [6.2 仮想DOMの正体](03-part2-frontend.md#section-6-2) — **必修** / 5分
- [6.4 Hooks の仕組み ― なぜ呼び出し順序が重要なのか](03-part2-frontend.md#section-6-4) — **必修** / 5分
- [6.8 フレームワーク選択の現実的な指針](03-part2-frontend.md#section-6-8) — **必修** / 5分
- [6.9 アクセシビリティ (a11y) ― 全ての人に届けるUI](03-part2-frontend.md#section-6-9) — **必修** / 25分
- [6.5 Vue ― リアクティビティを中核に](03-part2-frontend.md#section-6-5) — **実務選択** / 5分
- [6.6 Svelte ― コンパイル時の最適化](03-part2-frontend.md#section-6-6) — **実務選択** / 5分
- [6.10 Web Components ― フレームワーク非依存の標準](03-part2-frontend.md#section-6-10) — **実務選択** / 25分
- [6.11 フォーカス管理 ― モーダル、動的更新、ルート遷移](03-part2-frontend.md#section-6-11) — **実務選択** / 25分

### 4. 状態・ビルド・レンダリング

アプリケーション構成と配信方式を選べるようにする。

**このステージ:** 26節 / 4時間10分

- [7.1 状態の3分類](03-part2-frontend.md#section-7-1) — **必修** / 5分
- [7.4 サーバ状態の特殊性](03-part2-frontend.md#section-7-4) — **必修** / 5分
- [7.5 TanStack Query (React Query) ― サーバ状態管理の代表例](03-part2-frontend.md#section-7-5) — **必修** / 10分
- [7.6 楽観的更新 (Optimistic Update)](03-part2-frontend.md#section-7-6) — **必修** / 10分
- [7.7 リアクティブな状態とフォーム](03-part2-frontend.md#section-7-7) — **必修** / 10分
- [8.1 バンドラの基本原理](03-part2-frontend.md#section-8-1) — **必修** / 5分
- [8.4 Vite ― 開発体験の革新](03-part2-frontend.md#section-8-4) — **必修** / 10分
- [8.5 ツリーシェイキング](03-part2-frontend.md#section-8-5) — **必修** / 5分
- [8.6 コード分割 (Code Splitting)](03-part2-frontend.md#section-8-6) — **必修** / 5分
- [9.1 CSR (Client-Side Rendering)](03-part2-frontend.md#section-9-1) — **必修** / 5分
- [9.2 SSR (Server-Side Rendering)](03-part2-frontend.md#section-9-2) — **必修** / 5分
- [9.3 SSG (Static Site Generation)](03-part2-frontend.md#section-9-3) — **必修** / 5分
- [9.7 戦略の選択基準](03-part2-frontend.md#section-9-7) — **必修** / 5分
- [7.2 Flux と Redux ― 単方向データフローの徹底](03-part2-frontend.md#section-7-2) — **実務選択** / 5分
- [7.3 軽量状態管理 ― Zustand と Jotai](03-part2-frontend.md#section-7-3) — **実務選択** / 10分
- [7.8 スタイリング戦略 ― CSS の設計思想の変遷](03-part2-frontend.md#section-7-8) — **実務選択** / 25分
- [7.9 フォームのアクセシビリティ ― 名前、エラー通知、送信の結果](03-part2-frontend.md#section-7-9) — **実務選択** / 25分
- [8.2 Webpack ― 成熟した汎用バンドラ](03-part2-frontend.md#section-8-2) — **実務選択** / 5分
- [8.3 esbuild と SWC ― ネイティブ実装の衝撃](03-part2-frontend.md#section-8-3) — **実務選択** / 5分
- [8.7 HMR (Hot Module Replacement)](03-part2-frontend.md#section-8-7) — **実務選択** / 5分
- [9.4 ISR (Incremental Static Regeneration)](03-part2-frontend.md#section-9-4) — **実務選択** / 5分
- [9.5 Streaming SSR](03-part2-frontend.md#section-9-5) — **実務選択** / 5分
- [9.8 同じ Todo アプリを CSR / SSR / SSG で実装比較](03-part2-frontend.md#section-9-8) — **実務選択** / 10分
- [9.9 Astro ― コンテンツ中心のWebに最適化](03-part2-frontend.md#section-9-9) — **実務選択** / 5分
- [9.10 PWA (Progressive Web Apps) ― Webをアプリ化する](03-part2-frontend.md#section-9-10) — **実務選択** / 40分
- [9.12 Storybook ― コンポーネント駆動開発の中核](03-part2-frontend.md#section-9-12) — **実務選択** / 20分

### 5. API・認証・データ連携

フロントエンド境界で必要な契約、認証、データ整合性を理解する。

**このステージ:** 40節 / 6時間50分

- [12.1 RESTの設計思想 ― Roy Fielding の博士論文を読み返す](04-part3-backend.md#section-12-1) — **必修** / 5分
- [12.3 リソース指向設計の実践](04-part3-backend.md#section-12-3) — **必修** / 5分
- [12.4 ページネーション、フィルタ、ソート](04-part3-backend.md#section-12-4) — **必修** / 5分
- [12.5 エラーレスポンスの設計](04-part3-backend.md#section-12-5) — **必修** / 5分
- [12.6 OpenAPI ― API設計の標準仕様](04-part3-backend.md#section-12-6) — **必修** / 10分
- [12.12 API方式選択の指針](04-part3-backend.md#section-12-12) — **必修** / 5分
- [13.1 パスワード認証の基礎](04-part3-backend.md#section-13-1) — **必修** / 10分
- [13.2 セッション vs トークン ― 状態管理の対立](04-part3-backend.md#section-13-2) — **必修** / 5分
- [13.3 セッション認証の実装](04-part3-backend.md#section-13-3) — **必修** / 10分
- [13.4 JWT (JSON Web Token) の構造と注意点](04-part3-backend.md#section-13-4) — **必修** / 10分
- [13.5 リフレッシュトークン](04-part3-backend.md#section-13-5) — **必修** / 5分
- [13.6 CSRF 対策](04-part3-backend.md#section-13-6) — **必修** / 10分
- [13.7 OAuth 2.0 ― 第三者認可](04-part3-backend.md#section-13-7) — **必修** / 10分
- [13.8 OIDC (OpenID Connect) ― OAuth の上に立つ認証](04-part3-backend.md#section-13-8) — **必修** / 10分
- [13.10 認可モデル ― RBAC、ABAC、ReBAC](04-part3-backend.md#section-13-10) — **必修** / 10分
- [13.11 認可ロジックを「中央集権」にする](04-part3-backend.md#section-13-11) — **必修** / 10分
- [13.12 セキュリティの基本原則 (まとめ)](04-part3-backend.md#section-13-12) — **必修** / 5分
- [13.20 PKCE ― OAuth/OIDC のクライアント側保護](04-part3-backend.md#section-13-20) — **必修** / 30分
- [14.1 リレーショナルモデルの考え方](05-part4-data.md#section-14-1) — **必修** / 5分
- [14.2 正規化と非正規化の判断](05-part4-data.md#section-14-2) — **必修** / 10分
- [14.3 インデックスの内部構造](05-part4-data.md#section-14-3) — **必修** / 10分
- [14.4 実行計画 (EXPLAIN) の読み方](05-part4-data.md#section-14-4) — **必修** / 10分
- [14.5 N+1 問題](05-part4-data.md#section-14-5) — **必修** / 10分
- [14.6 ACIDとトランザクション](05-part4-data.md#section-14-6) — **必修** / 5分
- [14.7 トランザクション分離レベル](05-part4-data.md#section-14-7) — **必修** / 10分
- [14.8 MVCC ― スナップショットによる並行制御](05-part4-data.md#section-14-8) — **必修** / 10分
- [14.9 ロック ― 楽観 vs 悲観](05-part4-data.md#section-14-9) — **必修** / 10分
- [14.10 デッドロック](05-part4-data.md#section-14-10) — **必修** / 5分
- [14.11 ORM の光と影](05-part4-data.md#section-14-11) — **必修** / 10分
- [14.12 マイグレーション戦略](05-part4-data.md#section-14-12) — **必修** / 5分
- [12.13 ファイルアップロードの転送方式 ― multipart と presigned URL](04-part3-backend.md#section-12-13) — **実務選択** / 25分
- [12.14 大容量アップロードと再開可能プロトコル](04-part3-backend.md#section-12-14) — **実務選択** / 25分
- [14.23 UTC、タイムゾーン、DST、カレンダー日](05-part4-data.md#section-14-23) — **実務選択** / 25分
- [14.24 DB日時型、定期実行、ユーザー表示](05-part4-data.md#section-14-24) — **実務選択** / 25分
- [15.2 Redis ― 最も使われるKVS](05-part4-data.md#section-15-2) — **必修** / 15分
- [16.7 PostgreSQL の全文検索](05-part4-data.md#section-16-7) — **必修** / 5分
- [17.1 同期 vs 非同期 ― いつ非同期にすべきか](05-part4-data.md#section-17-1) — **必修** / 5分
- [17.2 メッセージキューの基本](05-part4-data.md#section-17-2) — **必修** / 10分
- [17.6 ジョブキュー ― Web アプリでの定番](05-part4-data.md#section-17-6) — **必修** / 5分
- [17.11 Outbox パターン ― 信頼性の高いイベント発行](05-part4-data.md#section-17-11) — **必修** / 10分

### 6. 品質と本番運用

リリース、観測、セキュリティ、性能、テスト、総合判断を身につける。

**このステージ:** 51節 / 6時間25分

- [21.1 CI/CD の意味](06-part5-infrastructure.md#section-21-1) — **必修** / 5分
- [21.2 GitHub Actions](06-part5-infrastructure.md#section-21-2) — **必修** / 15分
- [21.4 デプロイ戦略 ― それぞれの実装と使い分け](06-part5-infrastructure.md#section-21-4) — **必修** / 5分
- [21.5 ロールバック戦略](06-part5-infrastructure.md#section-21-5) — **必修** / 5分
- [21.7 セマンティックバージョニングと変更ログ](06-part5-infrastructure.md#section-21-7) — **必修** / 5分
- [22.1 Monitoring と Observability の違い](06-part5-infrastructure.md#section-22-1) — **必修** / 5分
- [22.2 Three Pillars of Observability](06-part5-infrastructure.md#section-22-2) — **必修** / 5分
- [22.3 構造化ログ (Structured Logging)](06-part5-infrastructure.md#section-22-3) — **必修** / 5分
- [22.4 ログレベル](06-part5-infrastructure.md#section-22-4) — **必修** / 5分
- [22.6 メトリクス](06-part5-infrastructure.md#section-22-6) — **必修** / 10分
- [22.7 SLI / SLO / SLA](06-part5-infrastructure.md#section-22-7) — **必修** / 5分
- [22.9 アラート設計](06-part5-infrastructure.md#section-22-9) — **必修** / 5分
- [23.1 OWASP Top 10 (2021)](07-part6-quality.md#section-23-1) — **必修** / 5分
- [23.2 SQLインジェクション](07-part6-quality.md#section-23-2) — **必修** / 5分
- [23.3 XSS (Cross-Site Scripting)](07-part6-quality.md#section-23-3) — **必修** / 10分
- [23.4 CSRF (再掲)](07-part6-quality.md#section-23-4) — **必修** / 5分
- [23.5 SSRF (Server-Side Request Forgery)](07-part6-quality.md#section-23-5) — **必修** / 10分
- [23.6 認証関連の脆弱性](07-part6-quality.md#section-23-6) — **必修** / 10分
- [23.7 IDOR (Insecure Direct Object References)](07-part6-quality.md#section-23-7) — **必修** / 5分
- [23.8 オープンリダイレクト](07-part6-quality.md#section-23-8) — **必修** / 5分
- [23.9 シークレット管理](07-part6-quality.md#section-23-9) — **必修** / 5分
- [23.10 依存パッケージの脆弱性](07-part6-quality.md#section-23-10) — **必修** / 5分
- [23.11 セキュアヘッダ](07-part6-quality.md#section-23-11) — **必修** / 5分
- [23.12 ログとモニタリング](07-part6-quality.md#section-23-12) — **必修** / 5分
- [23.13 セキュリティの文化](07-part6-quality.md#section-23-13) — **必修** / 5分
- [24.1 Core Web Vitals](07-part6-quality.md#section-24-1) — **必修** / 5分
- [24.2 フロントエンド最適化](07-part6-quality.md#section-24-2) — **必修** / 5分
- [24.3 ネットワーク最適化](07-part6-quality.md#section-24-3) — **必修** / 5分
- [24.4 バックエンド最適化](07-part6-quality.md#section-24-4) — **必修** / 5分
- [24.5 キャッシュ戦略](07-part6-quality.md#section-24-5) — **必修** / 10分
- [24.6 アルゴリズムとデータ構造](07-part6-quality.md#section-24-6) — **必修** / 5分
- [24.7 プロファイリング](07-part6-quality.md#section-24-7) — **必修** / 5分
- [24.8 負荷テスト](07-part6-quality.md#section-24-8) — **必修** / 5分
- [25.1 テストピラミッド vs テストトロフィー](07-part6-quality.md#section-25-1) — **必修** / 5分
- [25.2 Unit テスト](07-part6-quality.md#section-25-2) — **必修** / 5分
- [25.3 Integration テスト](07-part6-quality.md#section-25-3) — **必修** / 10分
- [25.4 E2E テスト](07-part6-quality.md#section-25-4) — **必修** / 5分
- [25.5 コンポーネントテスト](07-part6-quality.md#section-25-5) — **必修** / 5分
- [25.6 Mock と Stub と Fake](07-part6-quality.md#section-25-6) — **必修** / 5分
- [25.10 何をテストすべきか](07-part6-quality.md#section-25-10) — **必修** / 5分
- [30.1 要件定義](08-part7-practice.md#section-30-1) — **必修** / 5分
- [30.2 技術選定](08-part7-practice.md#section-30-2) — **必修** / 10分
- [30.3 データモデル](08-part7-practice.md#section-30-3) — **必修** / 15分
- [30.4 認可設計](08-part7-practice.md#section-30-4) — **必修** / 10分
- [30.5 API 設計](08-part7-practice.md#section-30-5) — **必修** / 15分
- [30.9 セキュリティ対策チェック](08-part7-practice.md#section-30-9) — **必修** / 5分
- [30.12 「最初の本番稼働日」までの優先順位](08-part7-practice.md#section-30-12) — **必修** / 5分
- [23.26 アップロードされたファイルの検証 ― MIME偽装、サイズ制限、スキャン](07-part6-quality.md#section-23-26) — **実務選択** / 25分
- [25.11 アクセシビリティの検証 ― 自動チェック、キーボード走査、読み上げ確認](07-part6-quality.md#section-25-11) — **実務選択** / 25分
- [30.15 ファイル・Webhook・メール・外部API連携の本番運用チェックリスト](08-part7-practice.md#section-30-15) — **実務選択** / 15分
- [30.16 アクセシビリティ・個人データ・決済・濫用対策のチェックリストと免責](08-part7-practice.md#section-30-16) — **実務選択** / 15分

<a id="route-backend-db"></a>
## バックエンド・DB強化

**想定読者:** API、認証、RDB、非同期処理を中心に本番設計力を高めたいバックエンド開発者

**到達目標:** リクエスト処理からデータ整合性、障害対応までを一貫して設計できるようにする。

**開始方法:** 下記の途中参加チェックを説明できる場合は「ランタイムとAPI」から開始できる。

**ルート全体:** 255節 / 42時間20分

### 途中参加チェック

次の節の要点を自分の言葉で説明できれば、前半を復習扱いにして開始できます。

- [2.1 HTTPメッセージの構造](02-part1-foundations.md#section-2-1) — **必修** / 5分
- [2.2 メソッドの意味論](02-part1-foundations.md#section-2-2) — **必修** / 5分
- [2.3 ステータスコード](02-part1-foundations.md#section-2-3) — **必修** / 10分
- [2.4 ヘッダ ― HTTPの真の主役](02-part1-foundations.md#section-2-4) — **必修** / 5分
- [2.5 Keep-Aliveとコネクション再利用](02-part1-foundations.md#section-2-5) — **必修** / 5分
- [3.1 URI/URL/URN](02-part1-foundations.md#section-3-1) — **必修** / 10分
- [3.2 DNS ― 名前を住所に変える](02-part1-foundations.md#section-3-2) — **必修** / 10分
- [3.3 TLS/SSL ― 通信を暗号化する](02-part1-foundations.md#section-3-3) — **必修** / 15分
- [4.5 JavaScriptランタイムとイベントループ](02-part1-foundations.md#section-4-5) — **必修** / 10分
- [5.3 関数 ― First-class Citizen](03-part2-frontend.md#section-5-3) — **必修** / 10分
- [5.4 非同期処理の進化](03-part2-frontend.md#section-5-4) — **必修** / 10分
- [5.9 エラー処理の設計](03-part2-frontend.md#section-5-9) — **必修** / 10分

### 1. Webと実行モデルの前提

通信、暗号化、イベントループ、非同期処理を確認する。

**このステージ:** 31節 / 4時間

- [1.1 Webの誕生と設計思想](02-part1-foundations.md#section-1-1) — **必修** / 5分
- [1.2 静的Webから動的Webへ ― 4つの時代](02-part1-foundations.md#section-1-2) — **必修** / 5分
- [1.3 クライアント/サーバモデルとステートレス性](02-part1-foundations.md#section-1-3) — **必修** / 5分
- [1.4 「Webアプリケーション」とは何か](02-part1-foundations.md#section-1-4) — **必修** / 5分
- [1.5 本書の使い方](02-part1-foundations.md#section-1-5) — **必修** / 5分
- [1.6 本書が扱う読者層](02-part1-foundations.md#section-1-6) — **必修** / 5分
- [1.7 本書が扱う範囲と扱わない範囲](02-part1-foundations.md#section-1-7) — **必修** / 5分
- [1.8 コード例について](02-part1-foundations.md#section-1-8) — **必修** / 5分
- [1.9 読み始める前に](02-part1-foundations.md#section-1-9) — **必修** / 5分
- [2.1 HTTPメッセージの構造](02-part1-foundations.md#section-2-1) — **必修** / 5分
- [2.2 メソッドの意味論](02-part1-foundations.md#section-2-2) — **必修** / 5分
- [2.3 ステータスコード](02-part1-foundations.md#section-2-3) — **必修** / 10分
- [2.4 ヘッダ ― HTTPの真の主役](02-part1-foundations.md#section-2-4) — **必修** / 5分
- [2.5 Keep-Aliveとコネクション再利用](02-part1-foundations.md#section-2-5) — **必修** / 5分
- [2.9 デバッグの実践技法](02-part1-foundations.md#section-2-9) — **必修** / 5分
- [3.1 URI/URL/URN](02-part1-foundations.md#section-3-1) — **必修** / 10分
- [3.2 DNS ― 名前を住所に変える](02-part1-foundations.md#section-3-2) — **必修** / 10分
- [3.3 TLS/SSL ― 通信を暗号化する](02-part1-foundations.md#section-3-3) — **必修** / 15分
- [3.5 ブラウザがURLを叩いてからHTMLを受け取るまで (まとめ)](02-part1-foundations.md#section-3-5) — **必修** / 5分
- [4.1 ブラウザのレンダリングパイプライン](02-part1-foundations.md#section-4-1) — **必修** / 10分
- [4.2 リフローとリペイントを抑える](02-part1-foundations.md#section-4-2) — **必修** / 5分
- [4.3 DOMの中身](02-part1-foundations.md#section-4-3) — **必修** / 10分
- [4.4 CSSの仕組み](02-part1-foundations.md#section-4-4) — **必修** / 10分
- [4.5 JavaScriptランタイムとイベントループ](02-part1-foundations.md#section-4-5) — **必修** / 10分
- [4.6 モジュールシステムの進化](02-part1-foundations.md#section-4-6) — **必修** / 10分
- [5.1 変数とスコープ ― `var`、`let`、`const`](03-part2-frontend.md#section-5-1) — **必修** / 5分
- [5.2 値型と参照型、等価性](03-part2-frontend.md#section-5-2) — **必修** / 10分
- [5.3 関数 ― First-class Citizen](03-part2-frontend.md#section-5-3) — **必修** / 10分
- [5.4 非同期処理の進化](03-part2-frontend.md#section-5-4) — **必修** / 10分
- [5.7 TypeScript ― 型システムの設計思想](03-part2-frontend.md#section-5-7) — **必修** / 20分
- [5.9 エラー処理の設計](03-part2-frontend.md#section-5-9) — **必修** / 10分

### 2. ランタイム・フレームワーク・API・認証

サーバ実装の主要な境界と選択肢を学ぶ。

**このステージ:** 42節 / 9時間15分

- [10.1 並行性モデルの3パターン](04-part3-backend.md#section-10-1) — **必修** / 10分
- [10.2 Node.js ― イベントループの代表](04-part3-backend.md#section-10-2) — **必修** / 5分
- [10.9 ランタイム選択の判断軸 (まとめ)](04-part3-backend.md#section-10-9) — **必修** / 5分
- [11.1 「ミドルウェア」というアイディア](04-part3-backend.md#section-11-1) — **必修** / 5分
- [11.6 ミドルウェアの仕組み ― Onion vs Chain](04-part3-backend.md#section-11-6) — **必修** / 10分
- [11.7 依存性注入 (DI) とテスタビリティ](04-part3-backend.md#section-11-7) — **必修** / 10分
- [11.8 フレームワーク選択の指針](04-part3-backend.md#section-11-8) — **必修** / 5分
- [12.1 RESTの設計思想 ― Roy Fielding の博士論文を読み返す](04-part3-backend.md#section-12-1) — **必修** / 5分
- [12.3 リソース指向設計の実践](04-part3-backend.md#section-12-3) — **必修** / 5分
- [12.4 ページネーション、フィルタ、ソート](04-part3-backend.md#section-12-4) — **必修** / 5分
- [12.5 エラーレスポンスの設計](04-part3-backend.md#section-12-5) — **必修** / 5分
- [12.6 OpenAPI ― API設計の標準仕様](04-part3-backend.md#section-12-6) — **必修** / 10分
- [12.12 API方式選択の指針](04-part3-backend.md#section-12-12) — **必修** / 5分
- [13.1 パスワード認証の基礎](04-part3-backend.md#section-13-1) — **必修** / 10分
- [13.2 セッション vs トークン ― 状態管理の対立](04-part3-backend.md#section-13-2) — **必修** / 5分
- [13.3 セッション認証の実装](04-part3-backend.md#section-13-3) — **必修** / 10分
- [13.4 JWT (JSON Web Token) の構造と注意点](04-part3-backend.md#section-13-4) — **必修** / 10分
- [13.5 リフレッシュトークン](04-part3-backend.md#section-13-5) — **必修** / 5分
- [13.6 CSRF 対策](04-part3-backend.md#section-13-6) — **必修** / 10分
- [13.7 OAuth 2.0 ― 第三者認可](04-part3-backend.md#section-13-7) — **必修** / 10分
- [13.8 OIDC (OpenID Connect) ― OAuth の上に立つ認証](04-part3-backend.md#section-13-8) — **必修** / 10分
- [13.10 認可モデル ― RBAC、ABAC、ReBAC](04-part3-backend.md#section-13-10) — **必修** / 10分
- [13.11 認可ロジックを「中央集権」にする](04-part3-backend.md#section-13-11) — **必修** / 10分
- [13.12 セキュリティの基本原則 (まとめ)](04-part3-backend.md#section-13-12) — **必修** / 5分
- [13.20 PKCE ― OAuth/OIDC のクライアント側保護](04-part3-backend.md#section-13-20) — **必修** / 30分
- [11.3 Fastify ― パフォーマンス志向の現代版](04-part3-backend.md#section-11-3) — **実務選択** / 10分
- [11.4 Hono ― エッジとマルチランタイム](04-part3-backend.md#section-11-4) — **実務選択** / 5分
- [11.5 NestJS ― エンタープライズ志向](04-part3-backend.md#section-11-5) — **実務選択** / 10分
- [12.7 GraphQL ― クライアント主導のクエリ](04-part3-backend.md#section-12-7) — **実務選択** / 15分
- [12.8 gRPC ― バイナリ高速通信](04-part3-backend.md#section-12-8) — **実務選択** / 5分
- [12.9 tRPC ― TypeScript ネイティブ](04-part3-backend.md#section-12-9) — **実務選択** / 10分
- [12.10 WebSocket ― 全二重リアルタイム通信](04-part3-backend.md#section-12-10) — **実務選択** / 10分
- [12.11 SSE (Server-Sent Events) ― シンプルな単方向プッシュ](04-part3-backend.md#section-12-11) — **実務選択** / 10分
- [12.13 ファイルアップロードの転送方式 ― multipart と presigned URL](04-part3-backend.md#section-12-13) — **実務選択** / 25分
- [12.14 大容量アップロードと再開可能プロトコル](04-part3-backend.md#section-12-14) — **実務選択** / 25分
- [12.15 Webhook の設計 ― イベント契約と署名](04-part3-backend.md#section-12-15) — **実務選択** / 25分
- [13.9 パスキー (WebAuthn) ― パスワードレスの未来](04-part3-backend.md#section-13-9) — **実務選択** / 10分
- [13.18 SAML ― エンタープライズSSOの実質標準](04-part3-backend.md#section-13-18) — **実務選択** / 1時間5分
- [13.19 IAM の全体像 ― CIAM と EIAM の使い分け](04-part3-backend.md#section-13-19) — **実務選択** / 40分
- [13.21 MFA と TOTP ― 多要素認証の実装](04-part3-backend.md#section-13-21) — **実務選択** / 30分
- [13.24 マルチテナントの認可とテナント境界](04-part3-backend.md#section-13-24) — **実務選択** / 25分
- [13.25 認証エンドポイントの濫用 ― Credential Stuffing とアカウント列挙](04-part3-backend.md#section-13-25) — **実務選択** / 25分

### 3. データ・検索・メッセージング

整合性、性能、検索、非同期連携を設計する。

**このステージ:** 53節 / 10時間55分

- [14.1 リレーショナルモデルの考え方](05-part4-data.md#section-14-1) — **必修** / 5分
- [14.2 正規化と非正規化の判断](05-part4-data.md#section-14-2) — **必修** / 10分
- [14.3 インデックスの内部構造](05-part4-data.md#section-14-3) — **必修** / 10分
- [14.4 実行計画 (EXPLAIN) の読み方](05-part4-data.md#section-14-4) — **必修** / 10分
- [14.5 N+1 問題](05-part4-data.md#section-14-5) — **必修** / 10分
- [14.6 ACIDとトランザクション](05-part4-data.md#section-14-6) — **必修** / 5分
- [14.7 トランザクション分離レベル](05-part4-data.md#section-14-7) — **必修** / 10分
- [14.8 MVCC ― スナップショットによる並行制御](05-part4-data.md#section-14-8) — **必修** / 10分
- [14.9 ロック ― 楽観 vs 悲観](05-part4-data.md#section-14-9) — **必修** / 10分
- [14.10 デッドロック](05-part4-data.md#section-14-10) — **必修** / 5分
- [14.11 ORM の光と影](05-part4-data.md#section-14-11) — **必修** / 10分
- [14.12 マイグレーション戦略](05-part4-data.md#section-14-12) — **必修** / 5分
- [15.1 NoSQL の4分類](05-part4-data.md#section-15-1) — **必修** / 5分
- [15.2 Redis ― 最も使われるKVS](05-part4-data.md#section-15-2) — **必修** / 15分
- [15.5 CAP 定理と PACELC](05-part4-data.md#section-15-5) — **必修** / 5分
- [15.6 結果整合性 (Eventual Consistency)](05-part4-data.md#section-15-6) — **必修** / 5分
- [15.8 PostgreSQL でどこまで戦えるか](05-part4-data.md#section-15-8) — **必修** / 5分
- [16.1 転置インデックスの原理](05-part4-data.md#section-16-1) — **必修** / 5分
- [16.2 アナライザとトークン化](05-part4-data.md#section-16-2) — **必修** / 5分
- [16.3 関連度スコアリング ― TF-IDF と BM25](05-part4-data.md#section-16-3) — **必修** / 5分
- [16.7 PostgreSQL の全文検索](05-part4-data.md#section-16-7) — **必修** / 5分
- [16.9 検索エンジン選択の指針](05-part4-data.md#section-16-9) — **必修** / 5分
- [17.1 同期 vs 非同期 ― いつ非同期にすべきか](05-part4-data.md#section-17-1) — **必修** / 5分
- [17.2 メッセージキューの基本](05-part4-data.md#section-17-2) — **必修** / 10分
- [17.6 ジョブキュー ― Web アプリでの定番](05-part4-data.md#section-17-6) — **必修** / 5分
- [17.7 Pub/Sub パターンと Fan-out](05-part4-data.md#section-17-7) — **必修** / 5分
- [17.11 Outbox パターン ― 信頼性の高いイベント発行](05-part4-data.md#section-17-11) — **必修** / 10分
- [14.13 スロークエリを10倍速くする実演](05-part4-data.md#section-14-13) — **実務選択** / 10分
- [14.15 Schema Evolution ― データ契約をどう進化させるか](05-part4-data.md#section-14-15) — **実務選択** / 15分
- [14.17 Materialized View ― 高速集計の事前計算](05-part4-data.md#section-14-17) — **実務選択** / 15分
- [14.18 VACUUM の詳細 ― PostgreSQL 運用の死活問題](05-part4-data.md#section-14-18) — **実務選択** / 20分
- [14.19 Connection Pooler ― DB接続管理の必須インフラ](05-part4-data.md#section-14-19) — **実務選択** / 15分
- [14.20 テナント分離モデルと Row-Level Security](05-part4-data.md#section-14-20) — **実務選択** / 25分
- [14.21 テナント別設定・暗号鍵・データ移行](05-part4-data.md#section-14-21) — **実務選択** / 20分
- [14.22 noisy neighbor とリソース分離](05-part4-data.md#section-14-22) — **実務選択** / 20分
- [14.23 UTC、タイムゾーン、DST、カレンダー日](05-part4-data.md#section-14-23) — **実務選択** / 25分
- [14.24 DB日時型、定期実行、ユーザー表示](05-part4-data.md#section-14-24) — **実務選択** / 25分
- [14.25 個人データの収集と保存 ― 何を持ち、どこに置き、どこへ漏れるか](05-part4-data.md#section-14-25) — **実務選択** / 25分
- [14.26 保持期間、削除、エクスポート ― 個人データの終わり方](05-part4-data.md#section-14-26) — **実務選択** / 25分
- [15.3 MongoDB ― ドキュメント DB](05-part4-data.md#section-15-3) — **実務選択** / 10分
- [15.4 DynamoDB ― クラウドネイティブ KV](05-part4-data.md#section-15-4) — **実務選択** / 10分
- [15.9 時系列データベース ― メトリクスとイベントの定石](05-part4-data.md#section-15-9) — **実務選択** / 15分
- [16.4 Elasticsearch / OpenSearch](05-part4-data.md#section-16-4) — **実務選択** / 10分
- [16.8 ベクトル検索 ― LLM時代の検索](05-part4-data.md#section-16-8) — **実務選択** / 10分
- [17.3 RabbitMQ ― 伝統的メッセージブローカー](05-part4-data.md#section-17-3) — **実務選択** / 5分
- [17.4 Kafka ― 高スループット分散ストリーミング](05-part4-data.md#section-17-4) — **実務選択** / 10分
- [17.5 AWS SQS / SNS ― マネージドの安心感](05-part4-data.md#section-17-5) — **実務選択** / 5分
- [17.10 Saga パターン ― 分散トランザクション](05-part4-data.md#section-17-10) — **実務選択** / 25分
- [17.12 CDC (Change Data Capture) ― DBの変更をイベント化する](05-part4-data.md#section-17-12) — **実務選択** / 20分
- [17.13 Webhook 受信の実務 ― 再送、順序逆転、冪等性](05-part4-data.md#section-17-13) — **実務選択** / 25分
- [17.14 メール送信の実務 ― 配送経路、バウンス、DKIM/SPF/DMARC](05-part4-data.md#section-17-14) — **実務選択** / 25分
- [17.15 外部API連携の実務 ― 時間予算、リトライ、Circuit Breaker](05-part4-data.md#section-17-15) — **実務選択** / 25分
- [17.16 決済連携の実務 ― 二重課金、返金、突合](05-part4-data.md#section-17-16) — **実務選択** / 25分

### 4. 本番運用と耐障害性

インフラ、デプロイ、観測、セキュリティ、性能、テスト、回復性を接続する。

**このステージ:** 85節 / 10時間30分

- [18.1 プロセスとスレッド](06-part5-infrastructure.md#section-18-1) — **必修** / 5分
- [18.2 ファイルディスクリプタ ― 全ては「ファイル」](06-part5-infrastructure.md#section-18-2) — **必修** / 5分
- [18.5 ネットワークスタック](06-part5-infrastructure.md#section-18-5) — **必修** / 5分
- [18.6 TCP のフロー制御と輻輳制御](06-part5-infrastructure.md#section-18-6) — **必修** / 5分
- [18.7 ロードバランサ ― L4 vs L7](06-part5-infrastructure.md#section-18-7) — **必修** / 5分
- [18.8 リバースプロキシとしての nginx](06-part5-infrastructure.md#section-18-8) — **必修** / 10分
- [18.9 トラブルシュート用コマンド集](06-part5-infrastructure.md#section-18-9) — **必修** / 10分
- [19.1 コンテナの仕組み](06-part5-infrastructure.md#section-19-1) — **必修** / 5分
- [19.2 Dockerfile のベストプラクティス](06-part5-infrastructure.md#section-19-2) — **必修** / 10分
- [19.3 .dockerignore の重要性](06-part5-infrastructure.md#section-19-3) — **必修** / 5分
- [19.4 docker-compose ― ローカル開発](06-part5-infrastructure.md#section-19-4) — **必修** / 10分
- [20.1 クラウドの3層モデル](06-part5-infrastructure.md#section-20-1) — **必修** / 5分
- [20.2 AWSの主要サービス](06-part5-infrastructure.md#section-20-2) — **必修** / 5分
- [20.5 サーバレスの台頭](06-part5-infrastructure.md#section-20-5) — **必修** / 5分
- [20.7 IaC (Infrastructure as Code)](06-part5-infrastructure.md#section-20-7) — **必修** / 5分
- [20.11 CIDR と VPC 設計 ― ネットワークの基礎を固める](06-part5-infrastructure.md#section-20-11) — **必修** / 10分
- [20.13 Twelve-Factor App ― クラウド時代の設計指針](06-part5-infrastructure.md#section-20-13) — **必修** / 10分
- [21.1 CI/CD の意味](06-part5-infrastructure.md#section-21-1) — **必修** / 5分
- [21.2 GitHub Actions](06-part5-infrastructure.md#section-21-2) — **必修** / 15分
- [21.4 デプロイ戦略 ― それぞれの実装と使い分け](06-part5-infrastructure.md#section-21-4) — **必修** / 5分
- [21.5 ロールバック戦略](06-part5-infrastructure.md#section-21-5) — **必修** / 5分
- [21.7 セマンティックバージョニングと変更ログ](06-part5-infrastructure.md#section-21-7) — **必修** / 5分
- [22.1 Monitoring と Observability の違い](06-part5-infrastructure.md#section-22-1) — **必修** / 5分
- [22.2 Three Pillars of Observability](06-part5-infrastructure.md#section-22-2) — **必修** / 5分
- [22.3 構造化ログ (Structured Logging)](06-part5-infrastructure.md#section-22-3) — **必修** / 5分
- [22.4 ログレベル](06-part5-infrastructure.md#section-22-4) — **必修** / 5分
- [22.6 メトリクス](06-part5-infrastructure.md#section-22-6) — **必修** / 10分
- [22.7 SLI / SLO / SLA](06-part5-infrastructure.md#section-22-7) — **必修** / 5分
- [22.9 アラート設計](06-part5-infrastructure.md#section-22-9) — **必修** / 5分
- [23.1 OWASP Top 10 (2021)](07-part6-quality.md#section-23-1) — **必修** / 5分
- [23.2 SQLインジェクション](07-part6-quality.md#section-23-2) — **必修** / 5分
- [23.3 XSS (Cross-Site Scripting)](07-part6-quality.md#section-23-3) — **必修** / 10分
- [23.4 CSRF (再掲)](07-part6-quality.md#section-23-4) — **必修** / 5分
- [23.5 SSRF (Server-Side Request Forgery)](07-part6-quality.md#section-23-5) — **必修** / 10分
- [23.6 認証関連の脆弱性](07-part6-quality.md#section-23-6) — **必修** / 10分
- [23.7 IDOR (Insecure Direct Object References)](07-part6-quality.md#section-23-7) — **必修** / 5分
- [23.8 オープンリダイレクト](07-part6-quality.md#section-23-8) — **必修** / 5分
- [23.9 シークレット管理](07-part6-quality.md#section-23-9) — **必修** / 5分
- [23.10 依存パッケージの脆弱性](07-part6-quality.md#section-23-10) — **必修** / 5分
- [23.11 セキュアヘッダ](07-part6-quality.md#section-23-11) — **必修** / 5分
- [23.12 ログとモニタリング](07-part6-quality.md#section-23-12) — **必修** / 5分
- [23.13 セキュリティの文化](07-part6-quality.md#section-23-13) — **必修** / 5分
- [24.1 Core Web Vitals](07-part6-quality.md#section-24-1) — **必修** / 5分
- [24.2 フロントエンド最適化](07-part6-quality.md#section-24-2) — **必修** / 5分
- [24.3 ネットワーク最適化](07-part6-quality.md#section-24-3) — **必修** / 5分
- [24.4 バックエンド最適化](07-part6-quality.md#section-24-4) — **必修** / 5分
- [24.5 キャッシュ戦略](07-part6-quality.md#section-24-5) — **必修** / 10分
- [24.6 アルゴリズムとデータ構造](07-part6-quality.md#section-24-6) — **必修** / 5分
- [24.7 プロファイリング](07-part6-quality.md#section-24-7) — **必修** / 5分
- [24.8 負荷テスト](07-part6-quality.md#section-24-8) — **必修** / 5分
- [25.1 テストピラミッド vs テストトロフィー](07-part6-quality.md#section-25-1) — **必修** / 5分
- [25.2 Unit テスト](07-part6-quality.md#section-25-2) — **必修** / 5分
- [25.3 Integration テスト](07-part6-quality.md#section-25-3) — **必修** / 10分
- [25.4 E2E テスト](07-part6-quality.md#section-25-4) — **必修** / 5分
- [25.5 コンポーネントテスト](07-part6-quality.md#section-25-5) — **必修** / 5分
- [25.6 Mock と Stub と Fake](07-part6-quality.md#section-25-6) — **必修** / 5分
- [25.10 何をテストすべきか](07-part6-quality.md#section-25-10) — **必修** / 5分
- [26.1 スケールアップ vs スケールアウト](07-part6-quality.md#section-26-1) — **必修** / 10分
- [26.3 マイクロサービス vs モノリス](07-part6-quality.md#section-26-3) — **必修** / 10分
- [26.5 イベント駆動とサービス間通信](07-part6-quality.md#section-26-5) — **必修** / 5分
- [26.6 サーキットブレーカ](07-part6-quality.md#section-26-6) — **必修** / 5分
- [26.7 リトライとバックオフ](07-part6-quality.md#section-26-7) — **必修** / 10分
- [26.8 Bulkhead (隔壁) パターン](07-part6-quality.md#section-26-8) — **必修** / 5分
- [26.9 タイムアウト戦略 ― レイヤごとの設定指針](07-part6-quality.md#section-26-9) — **必修** / 10分
- [26.10 冪等性とリトライ ― 「もう一度」を安全にする](07-part6-quality.md#section-26-10) — **必修** / 15分
- [26.11 バックプレッシャー ― 過負荷の連鎖を防ぐ](07-part6-quality.md#section-26-11) — **必修** / 15分
- [26.14 設計時の判断ポイント](07-part6-quality.md#section-26-14) — **必修** / 5分
- [19.5 Kubernetes ― 大規模なオーケストレーション](06-part5-infrastructure.md#section-19-5) — **実務選択** / 5分
- [19.6 Kubernetes の YAML](06-part5-infrastructure.md#section-19-6) — **実務選択** / 20分
- [19.7 Probes ― Liveness と Readiness](06-part5-infrastructure.md#section-19-7) — **実務選択** / 5分
- [19.8 ConfigMap と Secret](06-part5-infrastructure.md#section-19-8) — **実務選択** / 5分
- [19.9 マネージド Kubernetes と代替](06-part5-infrastructure.md#section-19-9) — **実務選択** / 5分
- [19.10 Ingress Controller の比較 ― クラスタへの入り口](06-part5-infrastructure.md#section-19-10) — **実務選択** / 25分
- [20.8 Terraform の実例](06-part5-infrastructure.md#section-20-8) — **実務選択** / 10分
- [20.10 GitOps ― 宣言的な運用](06-part5-infrastructure.md#section-20-10) — **実務選択** / 5分
- [21.3 マトリクスビルド ― 複数環境で同時にテスト](06-part5-infrastructure.md#section-21-3) — **実務選択** / 5分
- [21.6 デプロイ頻度と DORA メトリクス](06-part5-infrastructure.md#section-21-6) — **実務選択** / 5分
- [22.5 集中ログ管理](06-part5-infrastructure.md#section-22-5) — **実務選択** / 5分
- [22.8 分散トレース ― マイクロサービスを追う](06-part5-infrastructure.md#section-22-8) — **実務選択** / 10分
- [22.10 オンコールとポストモーテム](06-part5-infrastructure.md#section-22-10) — **実務選択** / 5分
- [23.26 アップロードされたファイルの検証 ― MIME偽装、サイズ制限、スキャン](07-part6-quality.md#section-23-26) — **実務選択** / 25分
- [23.27 自動化された脅威 ― bot、スパム、レート制限の設計](07-part6-quality.md#section-23-27) — **実務選択** / 25分
- [26.2 データベースのスケール](07-part6-quality.md#section-26-2) — **実務選択** / 10分
- [26.4 サービス分割の単位 ― Bounded Context](07-part6-quality.md#section-26-4) — **実務選択** / 5分
- [26.13 ディザスタリカバリ (DR) ― 「最悪の事態」への備え](07-part6-quality.md#section-26-13) — **実務選択** / 10分

### 5. 設計・改善・総合演習

ドメイン設計、移行、横断機能の判断を統合する。

**このステージ:** 44節 / 7時間40分

- [27.1 ドメイン駆動設計 (DDD) の基本](08-part7-practice.md#section-27-1) — **必修** / 5分
- [27.2 Value Object の実例](08-part7-practice.md#section-27-2) — **必修** / 10分
- [27.3 Aggregate と整合性境界](08-part7-practice.md#section-27-3) — **必修** / 10分
- [27.7 SOLID 原則](08-part7-practice.md#section-27-7) — **必修** / 5分
- [27.8 アンチパターンを認識する](08-part7-practice.md#section-27-8) — **必修** / 5分
- [27.9 設計の判断軸](08-part7-practice.md#section-27-9) — **必修** / 5分
- [27.10 Ubiquitous Language ― ドメインを表現する共通言語](08-part7-practice.md#section-27-10) — **必修** / 15分
- [28.1 レガシーコードの定義](08-part7-practice.md#section-28-1) — **必修** / 5分
- [28.2 レガシーを継承したらまずやること](08-part7-practice.md#section-28-2) — **必修** / 5分
- [28.3 Characterization Test](08-part7-practice.md#section-28-3) — **必修** / 5分
- [28.4 ストラングラーフィグパターン (Strangler Fig)](08-part7-practice.md#section-28-4) — **必修** / 5分
- [28.6 リファクタリングカタログ](08-part7-practice.md#section-28-6) — **必修** / 5分
- [28.7 デッドコードの掃除](08-part7-practice.md#section-28-7) — **必修** / 5分
- [28.9 ドキュメントとオンボーディング](08-part7-practice.md#section-28-9) — **必修** / 5分
- [28.11 ADR (Architecture Decision Record) ― 「なぜそう設計したか」を残す](08-part7-practice.md#section-28-11) — **必修** / 10分
- [28.12 コードレビューのベストプラクティス](08-part7-practice.md#section-28-12) — **必修** / 10分
- [30.1 要件定義](08-part7-practice.md#section-30-1) — **必修** / 5分
- [30.2 技術選定](08-part7-practice.md#section-30-2) — **必修** / 10分
- [30.3 データモデル](08-part7-practice.md#section-30-3) — **必修** / 15分
- [30.4 認可設計](08-part7-practice.md#section-30-4) — **必修** / 10分
- [30.5 API 設計](08-part7-practice.md#section-30-5) — **必修** / 15分
- [30.9 セキュリティ対策チェック](08-part7-practice.md#section-30-9) — **必修** / 5分
- [30.12 「最初の本番稼働日」までの優先順位](08-part7-practice.md#section-30-12) — **必修** / 5分
- [27.4 Repository パターン](08-part7-practice.md#section-27-4) — **実務選択** / 10分
- [27.5 Clean Architecture と Hexagonal](08-part7-practice.md#section-27-5) — **実務選択** / 15分
- [27.6 CRUD vs DDD ― 比較例](08-part7-practice.md#section-27-6) — **実務選択** / 15分
- [27.11 C4 モデル ― アーキテクチャ図の標準](08-part7-practice.md#section-27-11) — **実務選択** / 15分
- [27.12 Conway's Law ― 組織構造とソフトウェア構造の一致](08-part7-practice.md#section-27-12) — **実務選択** / 10分
- [27.13 問題定義とユーザーストーリー](08-part7-practice.md#section-27-13) — **実務選択** / 20分
- [27.14 ユースケース、状態遷移、業務ルール](08-part7-practice.md#section-27-14) — **実務選択** / 25分
- [27.15 受け入れ条件と Example Mapping](08-part7-practice.md#section-27-15) — **実務選択** / 25分
- [27.16 API契約とスキーマ駆動の仕様化](08-part7-practice.md#section-27-16) — **実務選択** / 20分
- [27.17 非機能要件の定量化](08-part7-practice.md#section-27-17) — **実務選択** / 20分
- [27.18 金額と通貨の表現 ― 最小単位、丸め、配分](08-part7-practice.md#section-27-18) — **実務選択** / 25分
- [28.5 Branch by Abstraction](08-part7-practice.md#section-28-5) — **実務選択** / 5分
- [28.8 マイグレーション戦略 ― 言語・フレームワーク移行](08-part7-practice.md#section-28-8) — **実務選択** / 5分
- [28.13 Trunk-Based Development ― 短命ブランチ戦略](08-part7-practice.md#section-28-13) — **実務選択** / 10分
- [30.6 非同期処理](08-part7-practice.md#section-30-6) — **実務選択** / 5分
- [30.7 検索](08-part7-practice.md#section-30-7) — **実務選択** / 5分
- [30.10 可観測性](08-part7-practice.md#section-30-10) — **実務選択** / 5分
- [30.11 デプロイとリリース戦略](08-part7-practice.md#section-30-11) — **実務選択** / 5分
- [30.14 マルチテナントと日時の設計チェックリスト](08-part7-practice.md#section-30-14) — **実務選択** / 15分
- [30.15 ファイル・Webhook・メール・外部API連携の本番運用チェックリスト](08-part7-practice.md#section-30-15) — **実務選択** / 15分
- [30.16 アクセシビリティ・個人データ・決済・濫用対策のチェックリストと免責](08-part7-practice.md#section-30-16) — **実務選択** / 15分

<a id="route-infra-sre"></a>
## インフラ・SRE強化

**想定読者:** クラウド、デリバリー、可観測性、信頼性を体系的に学びたい開発者・SRE

**到達目標:** アプリケーションの前提を理解した上で、運用可能で回復可能なシステムを設計する。

**開始方法:** 下記の途中参加チェックを説明できる場合は「Linux・コンテナ・クラウド」から開始できる。

**ルート全体:** 154節 / 20時間

### 途中参加チェック

次の節の要点を自分の言葉で説明できれば、前半を復習扱いにして開始できます。

- [2.1 HTTPメッセージの構造](02-part1-foundations.md#section-2-1) — **必修** / 5分
- [2.4 ヘッダ ― HTTPの真の主役](02-part1-foundations.md#section-2-4) — **必修** / 5分
- [2.5 Keep-Aliveとコネクション再利用](02-part1-foundations.md#section-2-5) — **必修** / 5分
- [3.2 DNS ― 名前を住所に変える](02-part1-foundations.md#section-3-2) — **必修** / 10分
- [3.3 TLS/SSL ― 通信を暗号化する](02-part1-foundations.md#section-3-3) — **必修** / 15分
- [10.1 並行性モデルの3パターン](04-part3-backend.md#section-10-1) — **必修** / 10分
- [10.2 Node.js ― イベントループの代表](04-part3-backend.md#section-10-2) — **必修** / 5分
- [14.6 ACIDとトランザクション](05-part4-data.md#section-14-6) — **必修** / 5分
- [14.7 トランザクション分離レベル](05-part4-data.md#section-14-7) — **必修** / 10分
- [14.8 MVCC ― スナップショットによる並行制御](05-part4-data.md#section-14-8) — **必修** / 10分
- [14.9 ロック ― 楽観 vs 悲観](05-part4-data.md#section-14-9) — **必修** / 10分
- [14.10 デッドロック](05-part4-data.md#section-14-10) — **必修** / 5分
- [17.1 同期 vs 非同期 ― いつ非同期にすべきか](05-part4-data.md#section-17-1) — **必修** / 5分
- [17.2 メッセージキューの基本](05-part4-data.md#section-17-2) — **必修** / 10分

### 1. 運用対象の前提

通信、実行モデル、DB整合性、非同期処理を確認する。

**このステージ:** 34節 / 4時間30分

- [1.1 Webの誕生と設計思想](02-part1-foundations.md#section-1-1) — **必修** / 5分
- [1.2 静的Webから動的Webへ ― 4つの時代](02-part1-foundations.md#section-1-2) — **必修** / 5分
- [1.3 クライアント/サーバモデルとステートレス性](02-part1-foundations.md#section-1-3) — **必修** / 5分
- [1.4 「Webアプリケーション」とは何か](02-part1-foundations.md#section-1-4) — **必修** / 5分
- [1.5 本書の使い方](02-part1-foundations.md#section-1-5) — **必修** / 5分
- [1.6 本書が扱う読者層](02-part1-foundations.md#section-1-6) — **必修** / 5分
- [1.7 本書が扱う範囲と扱わない範囲](02-part1-foundations.md#section-1-7) — **必修** / 5分
- [1.8 コード例について](02-part1-foundations.md#section-1-8) — **必修** / 5分
- [1.9 読み始める前に](02-part1-foundations.md#section-1-9) — **必修** / 5分
- [2.1 HTTPメッセージの構造](02-part1-foundations.md#section-2-1) — **必修** / 5分
- [2.2 メソッドの意味論](02-part1-foundations.md#section-2-2) — **必修** / 5分
- [2.3 ステータスコード](02-part1-foundations.md#section-2-3) — **必修** / 10分
- [2.4 ヘッダ ― HTTPの真の主役](02-part1-foundations.md#section-2-4) — **必修** / 5分
- [2.5 Keep-Aliveとコネクション再利用](02-part1-foundations.md#section-2-5) — **必修** / 5分
- [2.9 デバッグの実践技法](02-part1-foundations.md#section-2-9) — **必修** / 5分
- [3.1 URI/URL/URN](02-part1-foundations.md#section-3-1) — **必修** / 10分
- [3.2 DNS ― 名前を住所に変える](02-part1-foundations.md#section-3-2) — **必修** / 10分
- [3.3 TLS/SSL ― 通信を暗号化する](02-part1-foundations.md#section-3-3) — **必修** / 15分
- [3.5 ブラウザがURLを叩いてからHTMLを受け取るまで (まとめ)](02-part1-foundations.md#section-3-5) — **必修** / 5分
- [10.1 並行性モデルの3パターン](04-part3-backend.md#section-10-1) — **必修** / 10分
- [10.2 Node.js ― イベントループの代表](04-part3-backend.md#section-10-2) — **必修** / 5分
- [14.6 ACIDとトランザクション](05-part4-data.md#section-14-6) — **必修** / 5分
- [14.7 トランザクション分離レベル](05-part4-data.md#section-14-7) — **必修** / 10分
- [14.8 MVCC ― スナップショットによる並行制御](05-part4-data.md#section-14-8) — **必修** / 10分
- [14.9 ロック ― 楽観 vs 悲観](05-part4-data.md#section-14-9) — **必修** / 10分
- [14.10 デッドロック](05-part4-data.md#section-14-10) — **必修** / 5分
- [14.22 noisy neighbor とリソース分離](05-part4-data.md#section-14-22) — **実務選択** / 20分
- [14.25 個人データの収集と保存 ― 何を持ち、どこに置き、どこへ漏れるか](05-part4-data.md#section-14-25) — **実務選択** / 25分
- [15.2 Redis ― 最も使われるKVS](05-part4-data.md#section-15-2) — **必修** / 15分
- [17.1 同期 vs 非同期 ― いつ非同期にすべきか](05-part4-data.md#section-17-1) — **必修** / 5分
- [17.2 メッセージキューの基本](05-part4-data.md#section-17-2) — **必修** / 10分
- [17.6 ジョブキュー ― Web アプリでの定番](05-part4-data.md#section-17-6) — **必修** / 5分
- [17.7 Pub/Sub パターンと Fan-out](05-part4-data.md#section-17-7) — **必修** / 5分
- [17.11 Outbox パターン ― 信頼性の高いイベント発行](05-part4-data.md#section-17-11) — **必修** / 10分

### 2. Linux・コンテナ・クラウド

プロセス、ネットワーク、コンテナ、クラウド資源を理解する。

**このステージ:** 30節 / 3時間45分

- [18.1 プロセスとスレッド](06-part5-infrastructure.md#section-18-1) — **必修** / 5分
- [18.2 ファイルディスクリプタ ― 全ては「ファイル」](06-part5-infrastructure.md#section-18-2) — **必修** / 5分
- [18.5 ネットワークスタック](06-part5-infrastructure.md#section-18-5) — **必修** / 5分
- [18.6 TCP のフロー制御と輻輳制御](06-part5-infrastructure.md#section-18-6) — **必修** / 5分
- [18.7 ロードバランサ ― L4 vs L7](06-part5-infrastructure.md#section-18-7) — **必修** / 5分
- [18.8 リバースプロキシとしての nginx](06-part5-infrastructure.md#section-18-8) — **必修** / 10分
- [18.9 トラブルシュート用コマンド集](06-part5-infrastructure.md#section-18-9) — **必修** / 10分
- [19.1 コンテナの仕組み](06-part5-infrastructure.md#section-19-1) — **必修** / 5分
- [19.2 Dockerfile のベストプラクティス](06-part5-infrastructure.md#section-19-2) — **必修** / 10分
- [19.3 .dockerignore の重要性](06-part5-infrastructure.md#section-19-3) — **必修** / 5分
- [19.4 docker-compose ― ローカル開発](06-part5-infrastructure.md#section-19-4) — **必修** / 10分
- [20.1 クラウドの3層モデル](06-part5-infrastructure.md#section-20-1) — **必修** / 5分
- [20.2 AWSの主要サービス](06-part5-infrastructure.md#section-20-2) — **必修** / 5分
- [20.5 サーバレスの台頭](06-part5-infrastructure.md#section-20-5) — **必修** / 5分
- [20.7 IaC (Infrastructure as Code)](06-part5-infrastructure.md#section-20-7) — **必修** / 5分
- [20.11 CIDR と VPC 設計 ― ネットワークの基礎を固める](06-part5-infrastructure.md#section-20-11) — **必修** / 10分
- [20.13 Twelve-Factor App ― クラウド時代の設計指針](06-part5-infrastructure.md#section-20-13) — **必修** / 10分
- [18.3 シグナル ― プロセス間通信の基礎](06-part5-infrastructure.md#section-18-3) — **実務選択** / 5分
- [18.4 cgroups と namespace ― コンテナの正体](06-part5-infrastructure.md#section-18-4) — **実務選択** / 5分
- [19.5 Kubernetes ― 大規模なオーケストレーション](06-part5-infrastructure.md#section-19-5) — **実務選択** / 5分
- [19.6 Kubernetes の YAML](06-part5-infrastructure.md#section-19-6) — **実務選択** / 20分
- [19.7 Probes ― Liveness と Readiness](06-part5-infrastructure.md#section-19-7) — **実務選択** / 5分
- [19.8 ConfigMap と Secret](06-part5-infrastructure.md#section-19-8) — **実務選択** / 5分
- [19.9 マネージド Kubernetes と代替](06-part5-infrastructure.md#section-19-9) — **実務選択** / 5分
- [19.10 Ingress Controller の比較 ― クラスタへの入り口](06-part5-infrastructure.md#section-19-10) — **実務選択** / 25分
- [20.3 GCP / Azure の対応関係](06-part5-infrastructure.md#section-20-3) — **実務選択** / 5分
- [20.4 マルチクラウドとベンダーロックイン](06-part5-infrastructure.md#section-20-4) — **実務選択** / 5分
- [20.8 Terraform の実例](06-part5-infrastructure.md#section-20-8) — **実務選択** / 10分
- [20.10 GitOps ― 宣言的な運用](06-part5-infrastructure.md#section-20-10) — **実務選択** / 5分
- [20.12 API Gateway パターン ― マイクロサービスの入り口](06-part5-infrastructure.md#section-20-12) — **実務選択** / 10分

### 3. デリバリーと可観測性

安全な変更と診断可能性を設計する。

**このステージ:** 17節 / 1時間45分

- [21.1 CI/CD の意味](06-part5-infrastructure.md#section-21-1) — **必修** / 5分
- [21.2 GitHub Actions](06-part5-infrastructure.md#section-21-2) — **必修** / 15分
- [21.4 デプロイ戦略 ― それぞれの実装と使い分け](06-part5-infrastructure.md#section-21-4) — **必修** / 5分
- [21.5 ロールバック戦略](06-part5-infrastructure.md#section-21-5) — **必修** / 5分
- [21.7 セマンティックバージョニングと変更ログ](06-part5-infrastructure.md#section-21-7) — **必修** / 5分
- [22.1 Monitoring と Observability の違い](06-part5-infrastructure.md#section-22-1) — **必修** / 5分
- [22.2 Three Pillars of Observability](06-part5-infrastructure.md#section-22-2) — **必修** / 5分
- [22.3 構造化ログ (Structured Logging)](06-part5-infrastructure.md#section-22-3) — **必修** / 5分
- [22.4 ログレベル](06-part5-infrastructure.md#section-22-4) — **必修** / 5分
- [22.6 メトリクス](06-part5-infrastructure.md#section-22-6) — **必修** / 10分
- [22.7 SLI / SLO / SLA](06-part5-infrastructure.md#section-22-7) — **必修** / 5分
- [22.9 アラート設計](06-part5-infrastructure.md#section-22-9) — **必修** / 5分
- [21.3 マトリクスビルド ― 複数環境で同時にテスト](06-part5-infrastructure.md#section-21-3) — **実務選択** / 5分
- [21.6 デプロイ頻度と DORA メトリクス](06-part5-infrastructure.md#section-21-6) — **実務選択** / 5分
- [22.5 集中ログ管理](06-part5-infrastructure.md#section-22-5) — **実務選択** / 5分
- [22.8 分散トレース ― マイクロサービスを追う](06-part5-infrastructure.md#section-22-8) — **実務選択** / 10分
- [22.10 オンコールとポストモーテム](06-part5-infrastructure.md#section-22-10) — **実務選択** / 5分

### 4. セキュリティ・性能・テスト・信頼性

非機能要件をSLOと障害モードへ結び付ける。

**このステージ:** 50節 / 6時間40分

- [23.1 OWASP Top 10 (2021)](07-part6-quality.md#section-23-1) — **必修** / 5分
- [23.2 SQLインジェクション](07-part6-quality.md#section-23-2) — **必修** / 5分
- [23.3 XSS (Cross-Site Scripting)](07-part6-quality.md#section-23-3) — **必修** / 10分
- [23.4 CSRF (再掲)](07-part6-quality.md#section-23-4) — **必修** / 5分
- [23.5 SSRF (Server-Side Request Forgery)](07-part6-quality.md#section-23-5) — **必修** / 10分
- [23.6 認証関連の脆弱性](07-part6-quality.md#section-23-6) — **必修** / 10分
- [23.7 IDOR (Insecure Direct Object References)](07-part6-quality.md#section-23-7) — **必修** / 5分
- [23.8 オープンリダイレクト](07-part6-quality.md#section-23-8) — **必修** / 5分
- [23.9 シークレット管理](07-part6-quality.md#section-23-9) — **必修** / 5分
- [23.10 依存パッケージの脆弱性](07-part6-quality.md#section-23-10) — **必修** / 5分
- [23.11 セキュアヘッダ](07-part6-quality.md#section-23-11) — **必修** / 5分
- [23.12 ログとモニタリング](07-part6-quality.md#section-23-12) — **必修** / 5分
- [23.13 セキュリティの文化](07-part6-quality.md#section-23-13) — **必修** / 5分
- [24.1 Core Web Vitals](07-part6-quality.md#section-24-1) — **必修** / 5分
- [24.2 フロントエンド最適化](07-part6-quality.md#section-24-2) — **必修** / 5分
- [24.3 ネットワーク最適化](07-part6-quality.md#section-24-3) — **必修** / 5分
- [24.4 バックエンド最適化](07-part6-quality.md#section-24-4) — **必修** / 5分
- [24.5 キャッシュ戦略](07-part6-quality.md#section-24-5) — **必修** / 10分
- [24.6 アルゴリズムとデータ構造](07-part6-quality.md#section-24-6) — **必修** / 5分
- [24.7 プロファイリング](07-part6-quality.md#section-24-7) — **必修** / 5分
- [24.8 負荷テスト](07-part6-quality.md#section-24-8) — **必修** / 5分
- [25.1 テストピラミッド vs テストトロフィー](07-part6-quality.md#section-25-1) — **必修** / 5分
- [25.2 Unit テスト](07-part6-quality.md#section-25-2) — **必修** / 5分
- [25.3 Integration テスト](07-part6-quality.md#section-25-3) — **必修** / 10分
- [25.4 E2E テスト](07-part6-quality.md#section-25-4) — **必修** / 5分
- [25.5 コンポーネントテスト](07-part6-quality.md#section-25-5) — **必修** / 5分
- [25.6 Mock と Stub と Fake](07-part6-quality.md#section-25-6) — **必修** / 5分
- [25.10 何をテストすべきか](07-part6-quality.md#section-25-10) — **必修** / 5分
- [26.1 スケールアップ vs スケールアウト](07-part6-quality.md#section-26-1) — **必修** / 10分
- [26.3 マイクロサービス vs モノリス](07-part6-quality.md#section-26-3) — **必修** / 10分
- [26.5 イベント駆動とサービス間通信](07-part6-quality.md#section-26-5) — **必修** / 5分
- [26.6 サーキットブレーカ](07-part6-quality.md#section-26-6) — **必修** / 5分
- [26.7 リトライとバックオフ](07-part6-quality.md#section-26-7) — **必修** / 10分
- [26.8 Bulkhead (隔壁) パターン](07-part6-quality.md#section-26-8) — **必修** / 5分
- [26.9 タイムアウト戦略 ― レイヤごとの設定指針](07-part6-quality.md#section-26-9) — **必修** / 10分
- [26.10 冪等性とリトライ ― 「もう一度」を安全にする](07-part6-quality.md#section-26-10) — **必修** / 15分
- [26.11 バックプレッシャー ― 過負荷の連鎖を防ぐ](07-part6-quality.md#section-26-11) — **必修** / 15分
- [26.14 設計時の判断ポイント](07-part6-quality.md#section-26-14) — **必修** / 5分
- [17.15 外部API連携の実務 ― 時間予算、リトライ、Circuit Breaker](05-part4-data.md#section-17-15) — **実務選択** / 25分
- [23.17 HSTS の詳細 ― HTTPS 強制の正しい使い方](07-part6-quality.md#section-23-17) — **実務選択** / 10分
- [23.19 TLS 1.3 ハンドシェイクの詳細](07-part6-quality.md#section-23-19) — **実務選択** / 10分
- [23.20 Certificate Transparency (CT)](07-part6-quality.md#section-23-20) — **実務選択** / 10分
- [23.23 Subresource Integrity (SRI)](07-part6-quality.md#section-23-23) — **実務選択** / 5分
- [23.26 アップロードされたファイルの検証 ― MIME偽装、サイズ制限、スキャン](07-part6-quality.md#section-23-26) — **実務選択** / 25分
- [23.27 自動化された脅威 ― bot、スパム、レート制限の設計](07-part6-quality.md#section-23-27) — **実務選択** / 25分
- [25.7 Property-Based Testing](07-part6-quality.md#section-25-7) — **実務選択** / 5分
- [25.9 視覚回帰テスト](07-part6-quality.md#section-25-9) — **実務選択** / 5分
- [26.2 データベースのスケール](07-part6-quality.md#section-26-2) — **実務選択** / 10分
- [26.4 サービス分割の単位 ― Bounded Context](07-part6-quality.md#section-26-4) — **実務選択** / 5分
- [26.13 ディザスタリカバリ (DR) ― 「最悪の事態」への備え](07-part6-quality.md#section-26-13) — **実務選択** / 10分

### 5. 運用設計とリリース判断

ADR、レビュー、規制、可観測性、リリース判断を統合する。

**このステージ:** 23節 / 3時間20分

- [28.1 レガシーコードの定義](08-part7-practice.md#section-28-1) — **必修** / 5分
- [28.2 レガシーを継承したらまずやること](08-part7-practice.md#section-28-2) — **必修** / 5分
- [28.3 Characterization Test](08-part7-practice.md#section-28-3) — **必修** / 5分
- [28.4 ストラングラーフィグパターン (Strangler Fig)](08-part7-practice.md#section-28-4) — **必修** / 5分
- [28.6 リファクタリングカタログ](08-part7-practice.md#section-28-6) — **必修** / 5分
- [28.7 デッドコードの掃除](08-part7-practice.md#section-28-7) — **必修** / 5分
- [28.9 ドキュメントとオンボーディング](08-part7-practice.md#section-28-9) — **必修** / 5分
- [28.11 ADR (Architecture Decision Record) ― 「なぜそう設計したか」を残す](08-part7-practice.md#section-28-11) — **必修** / 10分
- [28.12 コードレビューのベストプラクティス](08-part7-practice.md#section-28-12) — **必修** / 10分
- [30.1 要件定義](08-part7-practice.md#section-30-1) — **必修** / 5分
- [30.2 技術選定](08-part7-practice.md#section-30-2) — **必修** / 10分
- [30.3 データモデル](08-part7-practice.md#section-30-3) — **必修** / 15分
- [30.4 認可設計](08-part7-practice.md#section-30-4) — **必修** / 10分
- [30.5 API 設計](08-part7-practice.md#section-30-5) — **必修** / 15分
- [30.9 セキュリティ対策チェック](08-part7-practice.md#section-30-9) — **必修** / 5分
- [30.12 「最初の本番稼働日」までの優先順位](08-part7-practice.md#section-30-12) — **必修** / 5分
- [28.13 Trunk-Based Development ― 短命ブランチ戦略](08-part7-practice.md#section-28-13) — **実務選択** / 10分
- [28.14 Web に関わる主要規制 ― GDPR、CCPA、SOC 2、HIPAA、APPI](08-part7-practice.md#section-28-14) — **実務選択** / 15分
- [30.10 可観測性](08-part7-practice.md#section-30-10) — **実務選択** / 5分
- [30.11 デプロイとリリース戦略](08-part7-practice.md#section-30-11) — **実務選択** / 5分
- [30.14 マルチテナントと日時の設計チェックリスト](08-part7-practice.md#section-30-14) — **実務選択** / 15分
- [30.15 ファイル・Webhook・メール・外部API連携の本番運用チェックリスト](08-part7-practice.md#section-30-15) — **実務選択** / 15分
- [30.16 アクセシビリティ・個人データ・決済・濫用対策のチェックリストと免責](08-part7-practice.md#section-30-16) — **実務選択** / 15分

<a id="route-security"></a>
## セキュリティ強化

**想定読者:** アプリケーション、認証、インフラ、サプライチェーンを横断して防御設計を学びたい開発者

**到達目標:** 脅威モデル、境界、検証、運用をつなぎ、危険な簡略化を見抜けるようにする。

**開始方法:** 下記の途中参加チェックを説明できる場合は「API・認証・データ境界」から開始できる。

**ルート全体:** 210節 / 33時間55分

### 途中参加チェック

次の節の要点を自分の言葉で説明できれば、前半を復習扱いにして開始できます。

- [2.1 HTTPメッセージの構造](02-part1-foundations.md#section-2-1) — **必修** / 5分
- [2.2 メソッドの意味論](02-part1-foundations.md#section-2-2) — **必修** / 5分
- [2.3 ステータスコード](02-part1-foundations.md#section-2-3) — **必修** / 10分
- [2.4 ヘッダ ― HTTPの真の主役](02-part1-foundations.md#section-2-4) — **必修** / 5分
- [3.1 URI/URL/URN](02-part1-foundations.md#section-3-1) — **必修** / 10分
- [3.2 DNS ― 名前を住所に変える](02-part1-foundations.md#section-3-2) — **必修** / 10分
- [3.3 TLS/SSL ― 通信を暗号化する](02-part1-foundations.md#section-3-3) — **必修** / 15分
- [4.5 JavaScriptランタイムとイベントループ](02-part1-foundations.md#section-4-5) — **必修** / 10分
- [5.4 非同期処理の進化](03-part2-frontend.md#section-5-4) — **必修** / 10分
- [12.3 リソース指向設計の実践](04-part3-backend.md#section-12-3) — **必修** / 5分
- [12.5 エラーレスポンスの設計](04-part3-backend.md#section-12-5) — **必修** / 5分
- [12.6 OpenAPI ― API設計の標準仕様](04-part3-backend.md#section-12-6) — **必修** / 10分
- [13.1 パスワード認証の基礎](04-part3-backend.md#section-13-1) — **必修** / 10分
- [13.2 セッション vs トークン ― 状態管理の対立](04-part3-backend.md#section-13-2) — **必修** / 5分
- [13.3 セッション認証の実装](04-part3-backend.md#section-13-3) — **必修** / 10分
- [13.4 JWT (JSON Web Token) の構造と注意点](04-part3-backend.md#section-13-4) — **必修** / 10分
- [13.6 CSRF 対策](04-part3-backend.md#section-13-6) — **必修** / 10分

### 1. Webセキュリティの前提

通信、ブラウザ、非同期処理、エラー処理の基礎を確認する。

**このステージ:** 31節 / 4時間

- [1.1 Webの誕生と設計思想](02-part1-foundations.md#section-1-1) — **必修** / 5分
- [1.2 静的Webから動的Webへ ― 4つの時代](02-part1-foundations.md#section-1-2) — **必修** / 5分
- [1.3 クライアント/サーバモデルとステートレス性](02-part1-foundations.md#section-1-3) — **必修** / 5分
- [1.4 「Webアプリケーション」とは何か](02-part1-foundations.md#section-1-4) — **必修** / 5分
- [1.5 本書の使い方](02-part1-foundations.md#section-1-5) — **必修** / 5分
- [1.6 本書が扱う読者層](02-part1-foundations.md#section-1-6) — **必修** / 5分
- [1.7 本書が扱う範囲と扱わない範囲](02-part1-foundations.md#section-1-7) — **必修** / 5分
- [1.8 コード例について](02-part1-foundations.md#section-1-8) — **必修** / 5分
- [1.9 読み始める前に](02-part1-foundations.md#section-1-9) — **必修** / 5分
- [2.1 HTTPメッセージの構造](02-part1-foundations.md#section-2-1) — **必修** / 5分
- [2.2 メソッドの意味論](02-part1-foundations.md#section-2-2) — **必修** / 5分
- [2.3 ステータスコード](02-part1-foundations.md#section-2-3) — **必修** / 10分
- [2.4 ヘッダ ― HTTPの真の主役](02-part1-foundations.md#section-2-4) — **必修** / 5分
- [2.5 Keep-Aliveとコネクション再利用](02-part1-foundations.md#section-2-5) — **必修** / 5分
- [2.9 デバッグの実践技法](02-part1-foundations.md#section-2-9) — **必修** / 5分
- [3.1 URI/URL/URN](02-part1-foundations.md#section-3-1) — **必修** / 10分
- [3.2 DNS ― 名前を住所に変える](02-part1-foundations.md#section-3-2) — **必修** / 10分
- [3.3 TLS/SSL ― 通信を暗号化する](02-part1-foundations.md#section-3-3) — **必修** / 15分
- [3.5 ブラウザがURLを叩いてからHTMLを受け取るまで (まとめ)](02-part1-foundations.md#section-3-5) — **必修** / 5分
- [4.1 ブラウザのレンダリングパイプライン](02-part1-foundations.md#section-4-1) — **必修** / 10分
- [4.2 リフローとリペイントを抑える](02-part1-foundations.md#section-4-2) — **必修** / 5分
- [4.3 DOMの中身](02-part1-foundations.md#section-4-3) — **必修** / 10分
- [4.4 CSSの仕組み](02-part1-foundations.md#section-4-4) — **必修** / 10分
- [4.5 JavaScriptランタイムとイベントループ](02-part1-foundations.md#section-4-5) — **必修** / 10分
- [4.6 モジュールシステムの進化](02-part1-foundations.md#section-4-6) — **必修** / 10分
- [5.1 変数とスコープ ― `var`、`let`、`const`](03-part2-frontend.md#section-5-1) — **必修** / 5分
- [5.2 値型と参照型、等価性](03-part2-frontend.md#section-5-2) — **必修** / 10分
- [5.3 関数 ― First-class Citizen](03-part2-frontend.md#section-5-3) — **必修** / 10分
- [5.4 非同期処理の進化](03-part2-frontend.md#section-5-4) — **必修** / 10分
- [5.7 TypeScript ― 型システムの設計思想](03-part2-frontend.md#section-5-7) — **必修** / 20分
- [5.9 エラー処理の設計](03-part2-frontend.md#section-5-9) — **必修** / 10分

### 2. API・認証・データ境界

認証、認可、入力、トランザクション、移行の境界を設計する。

**このステージ:** 46節 / 10時間50分

- [12.1 RESTの設計思想 ― Roy Fielding の博士論文を読み返す](04-part3-backend.md#section-12-1) — **必修** / 5分
- [12.3 リソース指向設計の実践](04-part3-backend.md#section-12-3) — **必修** / 5分
- [12.4 ページネーション、フィルタ、ソート](04-part3-backend.md#section-12-4) — **必修** / 5分
- [12.5 エラーレスポンスの設計](04-part3-backend.md#section-12-5) — **必修** / 5分
- [12.6 OpenAPI ― API設計の標準仕様](04-part3-backend.md#section-12-6) — **必修** / 10分
- [12.12 API方式選択の指針](04-part3-backend.md#section-12-12) — **必修** / 5分
- [13.1 パスワード認証の基礎](04-part3-backend.md#section-13-1) — **必修** / 10分
- [13.2 セッション vs トークン ― 状態管理の対立](04-part3-backend.md#section-13-2) — **必修** / 5分
- [13.3 セッション認証の実装](04-part3-backend.md#section-13-3) — **必修** / 10分
- [13.4 JWT (JSON Web Token) の構造と注意点](04-part3-backend.md#section-13-4) — **必修** / 10分
- [13.5 リフレッシュトークン](04-part3-backend.md#section-13-5) — **必修** / 5分
- [13.6 CSRF 対策](04-part3-backend.md#section-13-6) — **必修** / 10分
- [13.7 OAuth 2.0 ― 第三者認可](04-part3-backend.md#section-13-7) — **必修** / 10分
- [13.8 OIDC (OpenID Connect) ― OAuth の上に立つ認証](04-part3-backend.md#section-13-8) — **必修** / 10分
- [13.10 認可モデル ― RBAC、ABAC、ReBAC](04-part3-backend.md#section-13-10) — **必修** / 10分
- [13.11 認可ロジックを「中央集権」にする](04-part3-backend.md#section-13-11) — **必修** / 10分
- [13.12 セキュリティの基本原則 (まとめ)](04-part3-backend.md#section-13-12) — **必修** / 5分
- [13.20 PKCE ― OAuth/OIDC のクライアント側保護](04-part3-backend.md#section-13-20) — **必修** / 30分
- [14.1 リレーショナルモデルの考え方](05-part4-data.md#section-14-1) — **必修** / 5分
- [14.2 正規化と非正規化の判断](05-part4-data.md#section-14-2) — **必修** / 10分
- [14.3 インデックスの内部構造](05-part4-data.md#section-14-3) — **必修** / 10分
- [14.4 実行計画 (EXPLAIN) の読み方](05-part4-data.md#section-14-4) — **必修** / 10分
- [14.5 N+1 問題](05-part4-data.md#section-14-5) — **必修** / 10分
- [14.6 ACIDとトランザクション](05-part4-data.md#section-14-6) — **必修** / 5分
- [14.7 トランザクション分離レベル](05-part4-data.md#section-14-7) — **必修** / 10分
- [14.8 MVCC ― スナップショットによる並行制御](05-part4-data.md#section-14-8) — **必修** / 10分
- [14.9 ロック ― 楽観 vs 悲観](05-part4-data.md#section-14-9) — **必修** / 10分
- [14.10 デッドロック](05-part4-data.md#section-14-10) — **必修** / 5分
- [14.11 ORM の光と影](05-part4-data.md#section-14-11) — **必修** / 10分
- [14.12 マイグレーション戦略](05-part4-data.md#section-14-12) — **必修** / 5分
- [12.7 GraphQL ― クライアント主導のクエリ](04-part3-backend.md#section-12-7) — **実務選択** / 15分
- [12.10 WebSocket ― 全二重リアルタイム通信](04-part3-backend.md#section-12-10) — **実務選択** / 10分
- [12.11 SSE (Server-Sent Events) ― シンプルな単方向プッシュ](04-part3-backend.md#section-12-11) — **実務選択** / 10分
- [12.13 ファイルアップロードの転送方式 ― multipart と presigned URL](04-part3-backend.md#section-12-13) — **実務選択** / 25分
- [12.15 Webhook の設計 ― イベント契約と署名](04-part3-backend.md#section-12-15) — **実務選択** / 25分
- [13.9 パスキー (WebAuthn) ― パスワードレスの未来](04-part3-backend.md#section-13-9) — **実務選択** / 10分
- [13.18 SAML ― エンタープライズSSOの実質標準](04-part3-backend.md#section-13-18) — **実務選択** / 1時間5分
- [13.19 IAM の全体像 ― CIAM と EIAM の使い分け](04-part3-backend.md#section-13-19) — **実務選択** / 40分
- [13.21 MFA と TOTP ― 多要素認証の実装](04-part3-backend.md#section-13-21) — **実務選択** / 30分
- [13.24 マルチテナントの認可とテナント境界](04-part3-backend.md#section-13-24) — **実務選択** / 25分
- [13.25 認証エンドポイントの濫用 ― Credential Stuffing とアカウント列挙](04-part3-backend.md#section-13-25) — **実務選択** / 25分
- [14.15 Schema Evolution ― データ契約をどう進化させるか](05-part4-data.md#section-14-15) — **実務選択** / 15分
- [14.20 テナント分離モデルと Row-Level Security](05-part4-data.md#section-14-20) — **実務選択** / 25分
- [14.21 テナント別設定・暗号鍵・データ移行](05-part4-data.md#section-14-21) — **実務選択** / 20分
- [14.25 個人データの収集と保存 ― 何を持ち、どこに置き、どこへ漏れるか](05-part4-data.md#section-14-25) — **実務選択** / 25分
- [14.26 保持期間、削除、エクスポート ― 個人データの終わり方](05-part4-data.md#section-14-26) — **実務選択** / 25分

### 3. 分散処理と運用境界

メッセージ、ネットワーク、秘密情報、デプロイ、観測の失敗を理解する。

**このステージ:** 59節 / 8時間40分

- [17.1 同期 vs 非同期 ― いつ非同期にすべきか](05-part4-data.md#section-17-1) — **必修** / 5分
- [17.2 メッセージキューの基本](05-part4-data.md#section-17-2) — **必修** / 10分
- [17.6 ジョブキュー ― Web アプリでの定番](05-part4-data.md#section-17-6) — **必修** / 5分
- [17.7 Pub/Sub パターンと Fan-out](05-part4-data.md#section-17-7) — **必修** / 5分
- [17.11 Outbox パターン ― 信頼性の高いイベント発行](05-part4-data.md#section-17-11) — **必修** / 10分
- [18.1 プロセスとスレッド](06-part5-infrastructure.md#section-18-1) — **必修** / 5分
- [18.2 ファイルディスクリプタ ― 全ては「ファイル」](06-part5-infrastructure.md#section-18-2) — **必修** / 5分
- [18.5 ネットワークスタック](06-part5-infrastructure.md#section-18-5) — **必修** / 5分
- [18.6 TCP のフロー制御と輻輳制御](06-part5-infrastructure.md#section-18-6) — **必修** / 5分
- [18.7 ロードバランサ ― L4 vs L7](06-part5-infrastructure.md#section-18-7) — **必修** / 5分
- [18.8 リバースプロキシとしての nginx](06-part5-infrastructure.md#section-18-8) — **必修** / 10分
- [18.9 トラブルシュート用コマンド集](06-part5-infrastructure.md#section-18-9) — **必修** / 10分
- [19.1 コンテナの仕組み](06-part5-infrastructure.md#section-19-1) — **必修** / 5分
- [19.2 Dockerfile のベストプラクティス](06-part5-infrastructure.md#section-19-2) — **必修** / 10分
- [19.3 .dockerignore の重要性](06-part5-infrastructure.md#section-19-3) — **必修** / 5分
- [19.4 docker-compose ― ローカル開発](06-part5-infrastructure.md#section-19-4) — **必修** / 10分
- [20.1 クラウドの3層モデル](06-part5-infrastructure.md#section-20-1) — **必修** / 5分
- [20.2 AWSの主要サービス](06-part5-infrastructure.md#section-20-2) — **必修** / 5分
- [20.5 サーバレスの台頭](06-part5-infrastructure.md#section-20-5) — **必修** / 5分
- [20.7 IaC (Infrastructure as Code)](06-part5-infrastructure.md#section-20-7) — **必修** / 5分
- [20.11 CIDR と VPC 設計 ― ネットワークの基礎を固める](06-part5-infrastructure.md#section-20-11) — **必修** / 10分
- [20.13 Twelve-Factor App ― クラウド時代の設計指針](06-part5-infrastructure.md#section-20-13) — **必修** / 10分
- [21.1 CI/CD の意味](06-part5-infrastructure.md#section-21-1) — **必修** / 5分
- [21.2 GitHub Actions](06-part5-infrastructure.md#section-21-2) — **必修** / 15分
- [21.4 デプロイ戦略 ― それぞれの実装と使い分け](06-part5-infrastructure.md#section-21-4) — **必修** / 5分
- [21.5 ロールバック戦略](06-part5-infrastructure.md#section-21-5) — **必修** / 5分
- [21.7 セマンティックバージョニングと変更ログ](06-part5-infrastructure.md#section-21-7) — **必修** / 5分
- [22.1 Monitoring と Observability の違い](06-part5-infrastructure.md#section-22-1) — **必修** / 5分
- [22.2 Three Pillars of Observability](06-part5-infrastructure.md#section-22-2) — **必修** / 5分
- [22.3 構造化ログ (Structured Logging)](06-part5-infrastructure.md#section-22-3) — **必修** / 5分
- [22.4 ログレベル](06-part5-infrastructure.md#section-22-4) — **必修** / 5分
- [22.6 メトリクス](06-part5-infrastructure.md#section-22-6) — **必修** / 10分
- [22.7 SLI / SLO / SLA](06-part5-infrastructure.md#section-22-7) — **必修** / 5分
- [22.9 アラート設計](06-part5-infrastructure.md#section-22-9) — **必修** / 5分
- [17.3 RabbitMQ ― 伝統的メッセージブローカー](05-part4-data.md#section-17-3) — **実務選択** / 5分
- [17.4 Kafka ― 高スループット分散ストリーミング](05-part4-data.md#section-17-4) — **実務選択** / 10分
- [17.5 AWS SQS / SNS ― マネージドの安心感](05-part4-data.md#section-17-5) — **実務選択** / 5分
- [17.10 Saga パターン ― 分散トランザクション](05-part4-data.md#section-17-10) — **実務選択** / 25分
- [17.12 CDC (Change Data Capture) ― DBの変更をイベント化する](05-part4-data.md#section-17-12) — **実務選択** / 20分
- [17.13 Webhook 受信の実務 ― 再送、順序逆転、冪等性](05-part4-data.md#section-17-13) — **実務選択** / 25分
- [17.14 メール送信の実務 ― 配送経路、バウンス、DKIM/SPF/DMARC](05-part4-data.md#section-17-14) — **実務選択** / 25分
- [17.15 外部API連携の実務 ― 時間予算、リトライ、Circuit Breaker](05-part4-data.md#section-17-15) — **実務選択** / 25分
- [17.16 決済連携の実務 ― 二重課金、返金、突合](05-part4-data.md#section-17-16) — **実務選択** / 25分
- [18.3 シグナル ― プロセス間通信の基礎](06-part5-infrastructure.md#section-18-3) — **実務選択** / 5分
- [18.4 cgroups と namespace ― コンテナの正体](06-part5-infrastructure.md#section-18-4) — **実務選択** / 5分
- [19.5 Kubernetes ― 大規模なオーケストレーション](06-part5-infrastructure.md#section-19-5) — **実務選択** / 5分
- [19.6 Kubernetes の YAML](06-part5-infrastructure.md#section-19-6) — **実務選択** / 20分
- [19.7 Probes ― Liveness と Readiness](06-part5-infrastructure.md#section-19-7) — **実務選択** / 5分
- [19.8 ConfigMap と Secret](06-part5-infrastructure.md#section-19-8) — **実務選択** / 5分
- [19.9 マネージド Kubernetes と代替](06-part5-infrastructure.md#section-19-9) — **実務選択** / 5分
- [19.10 Ingress Controller の比較 ― クラスタへの入り口](06-part5-infrastructure.md#section-19-10) — **実務選択** / 25分
- [20.8 Terraform の実例](06-part5-infrastructure.md#section-20-8) — **実務選択** / 10分
- [20.10 GitOps ― 宣言的な運用](06-part5-infrastructure.md#section-20-10) — **実務選択** / 5分
- [20.12 API Gateway パターン ― マイクロサービスの入り口](06-part5-infrastructure.md#section-20-12) — **実務選択** / 10分
- [21.3 マトリクスビルド ― 複数環境で同時にテスト](06-part5-infrastructure.md#section-21-3) — **実務選択** / 5分
- [21.6 デプロイ頻度と DORA メトリクス](06-part5-infrastructure.md#section-21-6) — **実務選択** / 5分
- [22.5 集中ログ管理](06-part5-infrastructure.md#section-22-5) — **実務選択** / 5分
- [22.8 分散トレース ― マイクロサービスを追う](06-part5-infrastructure.md#section-22-8) — **実務選択** / 10分
- [22.10 オンコールとポストモーテム](06-part5-infrastructure.md#section-22-10) — **実務選択** / 5分

### 4. 攻撃・防御・暗号

主要なWeb脆弱性と防御機構を体系化する。

**このステージ:** 24節 / 3時間30分

- [23.1 OWASP Top 10 (2021)](07-part6-quality.md#section-23-1) — **必修** / 5分
- [23.2 SQLインジェクション](07-part6-quality.md#section-23-2) — **必修** / 5分
- [23.3 XSS (Cross-Site Scripting)](07-part6-quality.md#section-23-3) — **必修** / 10分
- [23.4 CSRF (再掲)](07-part6-quality.md#section-23-4) — **必修** / 5分
- [23.5 SSRF (Server-Side Request Forgery)](07-part6-quality.md#section-23-5) — **必修** / 10分
- [23.6 認証関連の脆弱性](07-part6-quality.md#section-23-6) — **必修** / 10分
- [23.7 IDOR (Insecure Direct Object References)](07-part6-quality.md#section-23-7) — **必修** / 5分
- [23.8 オープンリダイレクト](07-part6-quality.md#section-23-8) — **必修** / 5分
- [23.9 シークレット管理](07-part6-quality.md#section-23-9) — **必修** / 5分
- [23.10 依存パッケージの脆弱性](07-part6-quality.md#section-23-10) — **必修** / 5分
- [23.11 セキュアヘッダ](07-part6-quality.md#section-23-11) — **必修** / 5分
- [23.12 ログとモニタリング](07-part6-quality.md#section-23-12) — **必修** / 5分
- [23.13 セキュリティの文化](07-part6-quality.md#section-23-13) — **必修** / 5分
- [23.17 HSTS の詳細 ― HTTPS 強制の正しい使い方](07-part6-quality.md#section-23-17) — **実務選択** / 10分
- [23.18 ChaCha20-Poly1305 ― AES に並ぶモバイル向け暗号](07-part6-quality.md#section-23-18) — **発展** / 5分
- [23.19 TLS 1.3 ハンドシェイクの詳細](07-part6-quality.md#section-23-19) — **実務選択** / 10分
- [23.20 Certificate Transparency (CT)](07-part6-quality.md#section-23-20) — **実務選択** / 10分
- [23.21 Post-Quantum Cryptography ― 量子コンピュータ時代の備え](07-part6-quality.md#section-23-21) — **展望** / 10分
- [23.22 WebAuthn Attestation ― 「本当に正規の認証器か」を検証](07-part6-quality.md#section-23-22) — **発展** / 15分
- [23.23 Subresource Integrity (SRI)](07-part6-quality.md#section-23-23) — **実務選択** / 5分
- [23.24 COOP / COEP / CORP ― クロスオリジンの新世代制限](07-part6-quality.md#section-23-24) — **発展** / 10分
- [23.25 CSP Trusted Types ― XSS 防御の最終形](07-part6-quality.md#section-23-25) — **発展** / 5分
- [23.26 アップロードされたファイルの検証 ― MIME偽装、サイズ制限、スキャン](07-part6-quality.md#section-23-26) — **実務選択** / 25分
- [23.27 自動化された脅威 ― bot、スパム、レート制限の設計](07-part6-quality.md#section-23-27) — **実務選択** / 25分

### 5. 検証・回復・ガバナンス

テスト、耐障害性、レビュー、規制、横断機能を安全に運用する。

**このステージ:** 50節 / 6時間55分

- [25.1 テストピラミッド vs テストトロフィー](07-part6-quality.md#section-25-1) — **必修** / 5分
- [25.2 Unit テスト](07-part6-quality.md#section-25-2) — **必修** / 5分
- [25.3 Integration テスト](07-part6-quality.md#section-25-3) — **必修** / 10分
- [25.4 E2E テスト](07-part6-quality.md#section-25-4) — **必修** / 5分
- [25.5 コンポーネントテスト](07-part6-quality.md#section-25-5) — **必修** / 5分
- [25.6 Mock と Stub と Fake](07-part6-quality.md#section-25-6) — **必修** / 5分
- [25.10 何をテストすべきか](07-part6-quality.md#section-25-10) — **必修** / 5分
- [26.1 スケールアップ vs スケールアウト](07-part6-quality.md#section-26-1) — **必修** / 10分
- [26.3 マイクロサービス vs モノリス](07-part6-quality.md#section-26-3) — **必修** / 10分
- [26.5 イベント駆動とサービス間通信](07-part6-quality.md#section-26-5) — **必修** / 5分
- [26.6 サーキットブレーカ](07-part6-quality.md#section-26-6) — **必修** / 5分
- [26.7 リトライとバックオフ](07-part6-quality.md#section-26-7) — **必修** / 10分
- [26.8 Bulkhead (隔壁) パターン](07-part6-quality.md#section-26-8) — **必修** / 5分
- [26.9 タイムアウト戦略 ― レイヤごとの設定指針](07-part6-quality.md#section-26-9) — **必修** / 10分
- [26.10 冪等性とリトライ ― 「もう一度」を安全にする](07-part6-quality.md#section-26-10) — **必修** / 15分
- [26.11 バックプレッシャー ― 過負荷の連鎖を防ぐ](07-part6-quality.md#section-26-11) — **必修** / 15分
- [26.14 設計時の判断ポイント](07-part6-quality.md#section-26-14) — **必修** / 5分
- [28.1 レガシーコードの定義](08-part7-practice.md#section-28-1) — **必修** / 5分
- [28.2 レガシーを継承したらまずやること](08-part7-practice.md#section-28-2) — **必修** / 5分
- [28.3 Characterization Test](08-part7-practice.md#section-28-3) — **必修** / 5分
- [28.4 ストラングラーフィグパターン (Strangler Fig)](08-part7-practice.md#section-28-4) — **必修** / 5分
- [28.6 リファクタリングカタログ](08-part7-practice.md#section-28-6) — **必修** / 5分
- [28.7 デッドコードの掃除](08-part7-practice.md#section-28-7) — **必修** / 5分
- [28.9 ドキュメントとオンボーディング](08-part7-practice.md#section-28-9) — **必修** / 5分
- [28.11 ADR (Architecture Decision Record) ― 「なぜそう設計したか」を残す](08-part7-practice.md#section-28-11) — **必修** / 10分
- [28.12 コードレビューのベストプラクティス](08-part7-practice.md#section-28-12) — **必修** / 10分
- [30.1 要件定義](08-part7-practice.md#section-30-1) — **必修** / 5分
- [30.2 技術選定](08-part7-practice.md#section-30-2) — **必修** / 10分
- [30.3 データモデル](08-part7-practice.md#section-30-3) — **必修** / 15分
- [30.4 認可設計](08-part7-practice.md#section-30-4) — **必修** / 10分
- [30.5 API 設計](08-part7-practice.md#section-30-5) — **必修** / 15分
- [30.9 セキュリティ対策チェック](08-part7-practice.md#section-30-9) — **必修** / 5分
- [30.12 「最初の本番稼働日」までの優先順位](08-part7-practice.md#section-30-12) — **必修** / 5分
- [25.7 Property-Based Testing](07-part6-quality.md#section-25-7) — **実務選択** / 5分
- [25.9 視覚回帰テスト](07-part6-quality.md#section-25-9) — **実務選択** / 5分
- [25.11 アクセシビリティの検証 ― 自動チェック、キーボード走査、読み上げ確認](07-part6-quality.md#section-25-11) — **実務選択** / 25分
- [26.2 データベースのスケール](07-part6-quality.md#section-26-2) — **実務選択** / 10分
- [26.4 サービス分割の単位 ― Bounded Context](07-part6-quality.md#section-26-4) — **実務選択** / 5分
- [26.13 ディザスタリカバリ (DR) ― 「最悪の事態」への備え](07-part6-quality.md#section-26-13) — **実務選択** / 10分
- [28.5 Branch by Abstraction](08-part7-practice.md#section-28-5) — **実務選択** / 5分
- [28.8 マイグレーション戦略 ― 言語・フレームワーク移行](08-part7-practice.md#section-28-8) — **実務選択** / 5分
- [28.13 Trunk-Based Development ― 短命ブランチ戦略](08-part7-practice.md#section-28-13) — **実務選択** / 10分
- [28.14 Web に関わる主要規制 ― GDPR、CCPA、SOC 2、HIPAA、APPI](08-part7-practice.md#section-28-14) — **実務選択** / 15分
- [30.6 非同期処理](08-part7-practice.md#section-30-6) — **実務選択** / 5分
- [30.8 課金 (Stripe 連携)](08-part7-practice.md#section-30-8) — **実務選択** / 10分
- [30.10 可観測性](08-part7-practice.md#section-30-10) — **実務選択** / 5分
- [30.11 デプロイとリリース戦略](08-part7-practice.md#section-30-11) — **実務選択** / 5分
- [30.14 マルチテナントと日時の設計チェックリスト](08-part7-practice.md#section-30-14) — **実務選択** / 15分
- [30.15 ファイル・Webhook・メール・外部API連携の本番運用チェックリスト](08-part7-practice.md#section-30-15) — **実務選択** / 15分
- [30.16 アクセシビリティ・個人データ・決済・濫用対策のチェックリストと免責](08-part7-practice.md#section-30-16) — **実務選択** / 15分

<a id="route-tech-lead"></a>
## テックリード・設計強化

**想定読者:** 技術選定、設計判断、チーム運営、移行計画を担うテックリード候補

**到達目標:** 全領域の共通語彙を持ち、局所最適ではなく制約・運用・組織を含めて判断できるようにする。

**開始方法:** 下記の途中参加チェックを説明できる場合は「技術選定とデータ戦略」から開始できる。説明できない項目がある場合は、その節を含む章を「全領域の共通基盤」で読んでから進む。

**ルート全体:** 310節 / 50時間25分

### 途中参加チェック

次の節の要点を自分の言葉で説明できれば、前半を復習扱いにして開始できます。

- [1.3 クライアント/サーバモデルとステートレス性](02-part1-foundations.md#section-1-3) — **必修** / 5分
- [2.1 HTTPメッセージの構造](02-part1-foundations.md#section-2-1) — **必修** / 5分
- [2.2 メソッドの意味論](02-part1-foundations.md#section-2-2) — **必修** / 5分
- [2.3 ステータスコード](02-part1-foundations.md#section-2-3) — **必修** / 10分
- [2.4 ヘッダ ― HTTPの真の主役](02-part1-foundations.md#section-2-4) — **必修** / 5分
- [2.5 Keep-Aliveとコネクション再利用](02-part1-foundations.md#section-2-5) — **必修** / 5分
- [4.5 JavaScriptランタイムとイベントループ](02-part1-foundations.md#section-4-5) — **必修** / 10分
- [5.4 非同期処理の進化](03-part2-frontend.md#section-5-4) — **必修** / 10分
- [12.3 リソース指向設計の実践](04-part3-backend.md#section-12-3) — **必修** / 5分
- [12.5 エラーレスポンスの設計](04-part3-backend.md#section-12-5) — **必修** / 5分
- [12.6 OpenAPI ― API設計の標準仕様](04-part3-backend.md#section-12-6) — **必修** / 10分
- [14.1 リレーショナルモデルの考え方](05-part4-data.md#section-14-1) — **必修** / 5分
- [14.2 正規化と非正規化の判断](05-part4-data.md#section-14-2) — **必修** / 10分
- [14.6 ACIDとトランザクション](05-part4-data.md#section-14-6) — **必修** / 5分
- [14.7 トランザクション分離レベル](05-part4-data.md#section-14-7) — **必修** / 10分
- [14.8 MVCC ― スナップショットによる並行制御](05-part4-data.md#section-14-8) — **必修** / 10分
- [14.9 ロック ― 楽観 vs 悲観](05-part4-data.md#section-14-9) — **必修** / 10分
- [14.12 マイグレーション戦略](05-part4-data.md#section-14-12) — **必修** / 5分
- [21.1 CI/CD の意味](06-part5-infrastructure.md#section-21-1) — **必修** / 5分
- [22.1 Monitoring と Observability の違い](06-part5-infrastructure.md#section-22-1) — **必修** / 5分

### 1. 全領域の共通基盤

全30章の必修節を通読し、チーム間の共通語彙を得る。

**このステージ:** 199節 / 24時間5分

- [1.1 Webの誕生と設計思想](02-part1-foundations.md#section-1-1) — **必修** / 5分
- [1.2 静的Webから動的Webへ ― 4つの時代](02-part1-foundations.md#section-1-2) — **必修** / 5分
- [1.3 クライアント/サーバモデルとステートレス性](02-part1-foundations.md#section-1-3) — **必修** / 5分
- [1.4 「Webアプリケーション」とは何か](02-part1-foundations.md#section-1-4) — **必修** / 5分
- [1.5 本書の使い方](02-part1-foundations.md#section-1-5) — **必修** / 5分
- [1.6 本書が扱う読者層](02-part1-foundations.md#section-1-6) — **必修** / 5分
- [1.7 本書が扱う範囲と扱わない範囲](02-part1-foundations.md#section-1-7) — **必修** / 5分
- [1.8 コード例について](02-part1-foundations.md#section-1-8) — **必修** / 5分
- [1.9 読み始める前に](02-part1-foundations.md#section-1-9) — **必修** / 5分
- [2.1 HTTPメッセージの構造](02-part1-foundations.md#section-2-1) — **必修** / 5分
- [2.2 メソッドの意味論](02-part1-foundations.md#section-2-2) — **必修** / 5分
- [2.3 ステータスコード](02-part1-foundations.md#section-2-3) — **必修** / 10分
- [2.4 ヘッダ ― HTTPの真の主役](02-part1-foundations.md#section-2-4) — **必修** / 5分
- [2.5 Keep-Aliveとコネクション再利用](02-part1-foundations.md#section-2-5) — **必修** / 5分
- [2.9 デバッグの実践技法](02-part1-foundations.md#section-2-9) — **必修** / 5分
- [3.1 URI/URL/URN](02-part1-foundations.md#section-3-1) — **必修** / 10分
- [3.2 DNS ― 名前を住所に変える](02-part1-foundations.md#section-3-2) — **必修** / 10分
- [3.3 TLS/SSL ― 通信を暗号化する](02-part1-foundations.md#section-3-3) — **必修** / 15分
- [3.5 ブラウザがURLを叩いてからHTMLを受け取るまで (まとめ)](02-part1-foundations.md#section-3-5) — **必修** / 5分
- [4.1 ブラウザのレンダリングパイプライン](02-part1-foundations.md#section-4-1) — **必修** / 10分
- [4.2 リフローとリペイントを抑える](02-part1-foundations.md#section-4-2) — **必修** / 5分
- [4.3 DOMの中身](02-part1-foundations.md#section-4-3) — **必修** / 10分
- [4.4 CSSの仕組み](02-part1-foundations.md#section-4-4) — **必修** / 10分
- [4.5 JavaScriptランタイムとイベントループ](02-part1-foundations.md#section-4-5) — **必修** / 10分
- [4.6 モジュールシステムの進化](02-part1-foundations.md#section-4-6) — **必修** / 10分
- [5.1 変数とスコープ ― `var`、`let`、`const`](03-part2-frontend.md#section-5-1) — **必修** / 5分
- [5.2 値型と参照型、等価性](03-part2-frontend.md#section-5-2) — **必修** / 10分
- [5.3 関数 ― First-class Citizen](03-part2-frontend.md#section-5-3) — **必修** / 10分
- [5.4 非同期処理の進化](03-part2-frontend.md#section-5-4) — **必修** / 10分
- [5.7 TypeScript ― 型システムの設計思想](03-part2-frontend.md#section-5-7) — **必修** / 20分
- [5.9 エラー処理の設計](03-part2-frontend.md#section-5-9) — **必修** / 10分
- [6.1 Reactの登場と「単方向データフロー」](03-part2-frontend.md#section-6-1) — **必修** / 5分
- [6.2 仮想DOMの正体](03-part2-frontend.md#section-6-2) — **必修** / 5分
- [6.4 Hooks の仕組み ― なぜ呼び出し順序が重要なのか](03-part2-frontend.md#section-6-4) — **必修** / 5分
- [6.8 フレームワーク選択の現実的な指針](03-part2-frontend.md#section-6-8) — **必修** / 5分
- [6.9 アクセシビリティ (a11y) ― 全ての人に届けるUI](03-part2-frontend.md#section-6-9) — **必修** / 25分
- [7.1 状態の3分類](03-part2-frontend.md#section-7-1) — **必修** / 5分
- [7.4 サーバ状態の特殊性](03-part2-frontend.md#section-7-4) — **必修** / 5分
- [7.5 TanStack Query (React Query) ― サーバ状態管理の代表例](03-part2-frontend.md#section-7-5) — **必修** / 10分
- [7.6 楽観的更新 (Optimistic Update)](03-part2-frontend.md#section-7-6) — **必修** / 10分
- [7.7 リアクティブな状態とフォーム](03-part2-frontend.md#section-7-7) — **必修** / 10分
- [8.1 バンドラの基本原理](03-part2-frontend.md#section-8-1) — **必修** / 5分
- [8.4 Vite ― 開発体験の革新](03-part2-frontend.md#section-8-4) — **必修** / 10分
- [8.5 ツリーシェイキング](03-part2-frontend.md#section-8-5) — **必修** / 5分
- [8.6 コード分割 (Code Splitting)](03-part2-frontend.md#section-8-6) — **必修** / 5分
- [9.1 CSR (Client-Side Rendering)](03-part2-frontend.md#section-9-1) — **必修** / 5分
- [9.2 SSR (Server-Side Rendering)](03-part2-frontend.md#section-9-2) — **必修** / 5分
- [9.3 SSG (Static Site Generation)](03-part2-frontend.md#section-9-3) — **必修** / 5分
- [9.7 戦略の選択基準](03-part2-frontend.md#section-9-7) — **必修** / 5分
- [10.1 並行性モデルの3パターン](04-part3-backend.md#section-10-1) — **必修** / 10分
- [10.2 Node.js ― イベントループの代表](04-part3-backend.md#section-10-2) — **必修** / 5分
- [10.9 ランタイム選択の判断軸 (まとめ)](04-part3-backend.md#section-10-9) — **必修** / 5分
- [11.1 「ミドルウェア」というアイディア](04-part3-backend.md#section-11-1) — **必修** / 5分
- [11.6 ミドルウェアの仕組み ― Onion vs Chain](04-part3-backend.md#section-11-6) — **必修** / 10分
- [11.7 依存性注入 (DI) とテスタビリティ](04-part3-backend.md#section-11-7) — **必修** / 10分
- [11.8 フレームワーク選択の指針](04-part3-backend.md#section-11-8) — **必修** / 5分
- [12.1 RESTの設計思想 ― Roy Fielding の博士論文を読み返す](04-part3-backend.md#section-12-1) — **必修** / 5分
- [12.3 リソース指向設計の実践](04-part3-backend.md#section-12-3) — **必修** / 5分
- [12.4 ページネーション、フィルタ、ソート](04-part3-backend.md#section-12-4) — **必修** / 5分
- [12.5 エラーレスポンスの設計](04-part3-backend.md#section-12-5) — **必修** / 5分
- [12.6 OpenAPI ― API設計の標準仕様](04-part3-backend.md#section-12-6) — **必修** / 10分
- [12.12 API方式選択の指針](04-part3-backend.md#section-12-12) — **必修** / 5分
- [13.1 パスワード認証の基礎](04-part3-backend.md#section-13-1) — **必修** / 10分
- [13.2 セッション vs トークン ― 状態管理の対立](04-part3-backend.md#section-13-2) — **必修** / 5分
- [13.3 セッション認証の実装](04-part3-backend.md#section-13-3) — **必修** / 10分
- [13.4 JWT (JSON Web Token) の構造と注意点](04-part3-backend.md#section-13-4) — **必修** / 10分
- [13.5 リフレッシュトークン](04-part3-backend.md#section-13-5) — **必修** / 5分
- [13.6 CSRF 対策](04-part3-backend.md#section-13-6) — **必修** / 10分
- [13.7 OAuth 2.0 ― 第三者認可](04-part3-backend.md#section-13-7) — **必修** / 10分
- [13.8 OIDC (OpenID Connect) ― OAuth の上に立つ認証](04-part3-backend.md#section-13-8) — **必修** / 10分
- [13.10 認可モデル ― RBAC、ABAC、ReBAC](04-part3-backend.md#section-13-10) — **必修** / 10分
- [13.11 認可ロジックを「中央集権」にする](04-part3-backend.md#section-13-11) — **必修** / 10分
- [13.12 セキュリティの基本原則 (まとめ)](04-part3-backend.md#section-13-12) — **必修** / 5分
- [13.20 PKCE ― OAuth/OIDC のクライアント側保護](04-part3-backend.md#section-13-20) — **必修** / 30分
- [14.1 リレーショナルモデルの考え方](05-part4-data.md#section-14-1) — **必修** / 5分
- [14.2 正規化と非正規化の判断](05-part4-data.md#section-14-2) — **必修** / 10分
- [14.3 インデックスの内部構造](05-part4-data.md#section-14-3) — **必修** / 10分
- [14.4 実行計画 (EXPLAIN) の読み方](05-part4-data.md#section-14-4) — **必修** / 10分
- [14.5 N+1 問題](05-part4-data.md#section-14-5) — **必修** / 10分
- [14.6 ACIDとトランザクション](05-part4-data.md#section-14-6) — **必修** / 5分
- [14.7 トランザクション分離レベル](05-part4-data.md#section-14-7) — **必修** / 10分
- [14.8 MVCC ― スナップショットによる並行制御](05-part4-data.md#section-14-8) — **必修** / 10分
- [14.9 ロック ― 楽観 vs 悲観](05-part4-data.md#section-14-9) — **必修** / 10分
- [14.10 デッドロック](05-part4-data.md#section-14-10) — **必修** / 5分
- [14.11 ORM の光と影](05-part4-data.md#section-14-11) — **必修** / 10分
- [14.12 マイグレーション戦略](05-part4-data.md#section-14-12) — **必修** / 5分
- [15.1 NoSQL の4分類](05-part4-data.md#section-15-1) — **必修** / 5分
- [15.2 Redis ― 最も使われるKVS](05-part4-data.md#section-15-2) — **必修** / 15分
- [15.5 CAP 定理と PACELC](05-part4-data.md#section-15-5) — **必修** / 5分
- [15.6 結果整合性 (Eventual Consistency)](05-part4-data.md#section-15-6) — **必修** / 5分
- [15.8 PostgreSQL でどこまで戦えるか](05-part4-data.md#section-15-8) — **必修** / 5分
- [16.1 転置インデックスの原理](05-part4-data.md#section-16-1) — **必修** / 5分
- [16.2 アナライザとトークン化](05-part4-data.md#section-16-2) — **必修** / 5分
- [16.3 関連度スコアリング ― TF-IDF と BM25](05-part4-data.md#section-16-3) — **必修** / 5分
- [16.7 PostgreSQL の全文検索](05-part4-data.md#section-16-7) — **必修** / 5分
- [16.9 検索エンジン選択の指針](05-part4-data.md#section-16-9) — **必修** / 5分
- [17.1 同期 vs 非同期 ― いつ非同期にすべきか](05-part4-data.md#section-17-1) — **必修** / 5分
- [17.2 メッセージキューの基本](05-part4-data.md#section-17-2) — **必修** / 10分
- [17.6 ジョブキュー ― Web アプリでの定番](05-part4-data.md#section-17-6) — **必修** / 5分
- [17.7 Pub/Sub パターンと Fan-out](05-part4-data.md#section-17-7) — **必修** / 5分
- [17.11 Outbox パターン ― 信頼性の高いイベント発行](05-part4-data.md#section-17-11) — **必修** / 10分
- [18.1 プロセスとスレッド](06-part5-infrastructure.md#section-18-1) — **必修** / 5分
- [18.2 ファイルディスクリプタ ― 全ては「ファイル」](06-part5-infrastructure.md#section-18-2) — **必修** / 5分
- [18.5 ネットワークスタック](06-part5-infrastructure.md#section-18-5) — **必修** / 5分
- [18.6 TCP のフロー制御と輻輳制御](06-part5-infrastructure.md#section-18-6) — **必修** / 5分
- [18.7 ロードバランサ ― L4 vs L7](06-part5-infrastructure.md#section-18-7) — **必修** / 5分
- [18.8 リバースプロキシとしての nginx](06-part5-infrastructure.md#section-18-8) — **必修** / 10分
- [18.9 トラブルシュート用コマンド集](06-part5-infrastructure.md#section-18-9) — **必修** / 10分
- [19.1 コンテナの仕組み](06-part5-infrastructure.md#section-19-1) — **必修** / 5分
- [19.2 Dockerfile のベストプラクティス](06-part5-infrastructure.md#section-19-2) — **必修** / 10分
- [19.3 .dockerignore の重要性](06-part5-infrastructure.md#section-19-3) — **必修** / 5分
- [19.4 docker-compose ― ローカル開発](06-part5-infrastructure.md#section-19-4) — **必修** / 10分
- [20.1 クラウドの3層モデル](06-part5-infrastructure.md#section-20-1) — **必修** / 5分
- [20.2 AWSの主要サービス](06-part5-infrastructure.md#section-20-2) — **必修** / 5分
- [20.5 サーバレスの台頭](06-part5-infrastructure.md#section-20-5) — **必修** / 5分
- [20.7 IaC (Infrastructure as Code)](06-part5-infrastructure.md#section-20-7) — **必修** / 5分
- [20.11 CIDR と VPC 設計 ― ネットワークの基礎を固める](06-part5-infrastructure.md#section-20-11) — **必修** / 10分
- [20.13 Twelve-Factor App ― クラウド時代の設計指針](06-part5-infrastructure.md#section-20-13) — **必修** / 10分
- [21.1 CI/CD の意味](06-part5-infrastructure.md#section-21-1) — **必修** / 5分
- [21.2 GitHub Actions](06-part5-infrastructure.md#section-21-2) — **必修** / 15分
- [21.4 デプロイ戦略 ― それぞれの実装と使い分け](06-part5-infrastructure.md#section-21-4) — **必修** / 5分
- [21.5 ロールバック戦略](06-part5-infrastructure.md#section-21-5) — **必修** / 5分
- [21.7 セマンティックバージョニングと変更ログ](06-part5-infrastructure.md#section-21-7) — **必修** / 5分
- [22.1 Monitoring と Observability の違い](06-part5-infrastructure.md#section-22-1) — **必修** / 5分
- [22.2 Three Pillars of Observability](06-part5-infrastructure.md#section-22-2) — **必修** / 5分
- [22.3 構造化ログ (Structured Logging)](06-part5-infrastructure.md#section-22-3) — **必修** / 5分
- [22.4 ログレベル](06-part5-infrastructure.md#section-22-4) — **必修** / 5分
- [22.6 メトリクス](06-part5-infrastructure.md#section-22-6) — **必修** / 10分
- [22.7 SLI / SLO / SLA](06-part5-infrastructure.md#section-22-7) — **必修** / 5分
- [22.9 アラート設計](06-part5-infrastructure.md#section-22-9) — **必修** / 5分
- [23.1 OWASP Top 10 (2021)](07-part6-quality.md#section-23-1) — **必修** / 5分
- [23.2 SQLインジェクション](07-part6-quality.md#section-23-2) — **必修** / 5分
- [23.3 XSS (Cross-Site Scripting)](07-part6-quality.md#section-23-3) — **必修** / 10分
- [23.4 CSRF (再掲)](07-part6-quality.md#section-23-4) — **必修** / 5分
- [23.5 SSRF (Server-Side Request Forgery)](07-part6-quality.md#section-23-5) — **必修** / 10分
- [23.6 認証関連の脆弱性](07-part6-quality.md#section-23-6) — **必修** / 10分
- [23.7 IDOR (Insecure Direct Object References)](07-part6-quality.md#section-23-7) — **必修** / 5分
- [23.8 オープンリダイレクト](07-part6-quality.md#section-23-8) — **必修** / 5分
- [23.9 シークレット管理](07-part6-quality.md#section-23-9) — **必修** / 5分
- [23.10 依存パッケージの脆弱性](07-part6-quality.md#section-23-10) — **必修** / 5分
- [23.11 セキュアヘッダ](07-part6-quality.md#section-23-11) — **必修** / 5分
- [23.12 ログとモニタリング](07-part6-quality.md#section-23-12) — **必修** / 5分
- [23.13 セキュリティの文化](07-part6-quality.md#section-23-13) — **必修** / 5分
- [24.1 Core Web Vitals](07-part6-quality.md#section-24-1) — **必修** / 5分
- [24.2 フロントエンド最適化](07-part6-quality.md#section-24-2) — **必修** / 5分
- [24.3 ネットワーク最適化](07-part6-quality.md#section-24-3) — **必修** / 5分
- [24.4 バックエンド最適化](07-part6-quality.md#section-24-4) — **必修** / 5分
- [24.5 キャッシュ戦略](07-part6-quality.md#section-24-5) — **必修** / 10分
- [24.6 アルゴリズムとデータ構造](07-part6-quality.md#section-24-6) — **必修** / 5分
- [24.7 プロファイリング](07-part6-quality.md#section-24-7) — **必修** / 5分
- [24.8 負荷テスト](07-part6-quality.md#section-24-8) — **必修** / 5分
- [25.1 テストピラミッド vs テストトロフィー](07-part6-quality.md#section-25-1) — **必修** / 5分
- [25.2 Unit テスト](07-part6-quality.md#section-25-2) — **必修** / 5分
- [25.3 Integration テスト](07-part6-quality.md#section-25-3) — **必修** / 10分
- [25.4 E2E テスト](07-part6-quality.md#section-25-4) — **必修** / 5分
- [25.5 コンポーネントテスト](07-part6-quality.md#section-25-5) — **必修** / 5分
- [25.6 Mock と Stub と Fake](07-part6-quality.md#section-25-6) — **必修** / 5分
- [25.10 何をテストすべきか](07-part6-quality.md#section-25-10) — **必修** / 5分
- [26.1 スケールアップ vs スケールアウト](07-part6-quality.md#section-26-1) — **必修** / 10分
- [26.3 マイクロサービス vs モノリス](07-part6-quality.md#section-26-3) — **必修** / 10分
- [26.5 イベント駆動とサービス間通信](07-part6-quality.md#section-26-5) — **必修** / 5分
- [26.6 サーキットブレーカ](07-part6-quality.md#section-26-6) — **必修** / 5分
- [26.7 リトライとバックオフ](07-part6-quality.md#section-26-7) — **必修** / 10分
- [26.8 Bulkhead (隔壁) パターン](07-part6-quality.md#section-26-8) — **必修** / 5分
- [26.9 タイムアウト戦略 ― レイヤごとの設定指針](07-part6-quality.md#section-26-9) — **必修** / 10分
- [26.10 冪等性とリトライ ― 「もう一度」を安全にする](07-part6-quality.md#section-26-10) — **必修** / 15分
- [26.11 バックプレッシャー ― 過負荷の連鎖を防ぐ](07-part6-quality.md#section-26-11) — **必修** / 15分
- [26.14 設計時の判断ポイント](07-part6-quality.md#section-26-14) — **必修** / 5分
- [27.1 ドメイン駆動設計 (DDD) の基本](08-part7-practice.md#section-27-1) — **必修** / 5分
- [27.2 Value Object の実例](08-part7-practice.md#section-27-2) — **必修** / 10分
- [27.3 Aggregate と整合性境界](08-part7-practice.md#section-27-3) — **必修** / 10分
- [27.7 SOLID 原則](08-part7-practice.md#section-27-7) — **必修** / 5分
- [27.8 アンチパターンを認識する](08-part7-practice.md#section-27-8) — **必修** / 5分
- [27.9 設計の判断軸](08-part7-practice.md#section-27-9) — **必修** / 5分
- [27.10 Ubiquitous Language ― ドメインを表現する共通言語](08-part7-practice.md#section-27-10) — **必修** / 15分
- [28.1 レガシーコードの定義](08-part7-practice.md#section-28-1) — **必修** / 5分
- [28.2 レガシーを継承したらまずやること](08-part7-practice.md#section-28-2) — **必修** / 5分
- [28.3 Characterization Test](08-part7-practice.md#section-28-3) — **必修** / 5分
- [28.4 ストラングラーフィグパターン (Strangler Fig)](08-part7-practice.md#section-28-4) — **必修** / 5分
- [28.6 リファクタリングカタログ](08-part7-practice.md#section-28-6) — **必修** / 5分
- [28.7 デッドコードの掃除](08-part7-practice.md#section-28-7) — **必修** / 5分
- [28.9 ドキュメントとオンボーディング](08-part7-practice.md#section-28-9) — **必修** / 5分
- [28.11 ADR (Architecture Decision Record) ― 「なぜそう設計したか」を残す](08-part7-practice.md#section-28-11) — **必修** / 10分
- [28.12 コードレビューのベストプラクティス](08-part7-practice.md#section-28-12) — **必修** / 10分
- [29.1 LLM を組み込んだアプリの基本構造](08-part7-practice.md#section-29-1) — **必修** / 5分
- [29.2 ストリーミング応答](08-part7-practice.md#section-29-2) — **必修** / 5分
- [29.3 RAG (Retrieval-Augmented Generation)](08-part7-practice.md#section-29-3) — **必修** / 10分
- [29.4 Function Calling / Tool Use](08-part7-practice.md#section-29-4) — **必修** / 10分
- [29.6 プロンプトインジェクション](08-part7-practice.md#section-29-6) — **必修** / 5分
- [29.7 コスト管理とキャッシング](08-part7-practice.md#section-29-7) — **必修** / 5分
- [29.8 AI コーディング支援との付き合い方](08-part7-practice.md#section-29-8) — **必修** / 5分
- [29.10 AI 時代の Web 開発者像](08-part7-practice.md#section-29-10) — **必修** / 5分
- [30.1 要件定義](08-part7-practice.md#section-30-1) — **必修** / 5分
- [30.2 技術選定](08-part7-practice.md#section-30-2) — **必修** / 10分
- [30.3 データモデル](08-part7-practice.md#section-30-3) — **必修** / 15分
- [30.4 認可設計](08-part7-practice.md#section-30-4) — **必修** / 10分
- [30.5 API 設計](08-part7-practice.md#section-30-5) — **必修** / 15分
- [30.9 セキュリティ対策チェック](08-part7-practice.md#section-30-9) — **必修** / 5分
- [30.12 「最初の本番稼働日」までの優先順位](08-part7-practice.md#section-30-12) — **必修** / 5分

### 2. 技術選定とデータ戦略

実装方式、API、認証、データストア、検索、非同期処理の選択肢を比較する。

**このステージ:** 63節 / 16時間55分

- [6.5 Vue ― リアクティビティを中核に](03-part2-frontend.md#section-6-5) — **実務選択** / 5分
- [6.6 Svelte ― コンパイル時の最適化](03-part2-frontend.md#section-6-6) — **実務選択** / 5分
- [6.10 Web Components ― フレームワーク非依存の標準](03-part2-frontend.md#section-6-10) — **実務選択** / 25分
- [6.11 フォーカス管理 ― モーダル、動的更新、ルート遷移](03-part2-frontend.md#section-6-11) — **実務選択** / 25分
- [7.2 Flux と Redux ― 単方向データフローの徹底](03-part2-frontend.md#section-7-2) — **実務選択** / 5分
- [7.3 軽量状態管理 ― Zustand と Jotai](03-part2-frontend.md#section-7-3) — **実務選択** / 10分
- [7.8 スタイリング戦略 ― CSS の設計思想の変遷](03-part2-frontend.md#section-7-8) — **実務選択** / 25分
- [7.9 フォームのアクセシビリティ ― 名前、エラー通知、送信の結果](03-part2-frontend.md#section-7-9) — **実務選択** / 25分
- [9.4 ISR (Incremental Static Regeneration)](03-part2-frontend.md#section-9-4) — **実務選択** / 5分
- [9.5 Streaming SSR](03-part2-frontend.md#section-9-5) — **実務選択** / 5分
- [9.12 Storybook ― コンポーネント駆動開発の中核](03-part2-frontend.md#section-9-12) — **実務選択** / 20分
- [10.3 Deno と Bun ― Node.js への挑戦](04-part3-backend.md#section-10-3) — **実務選択** / 10分
- [10.4 Go ― シンプルで速い](04-part3-backend.md#section-10-4) — **実務選択** / 10分
- [10.5 Rust ― ゼロコスト抽象とメモリ安全](04-part3-backend.md#section-10-5) — **実務選択** / 10分
- [10.6 Python ― データとAIの覇者](04-part3-backend.md#section-10-6) — **実務選択** / 10分
- [10.7 Ruby ― 表現力と Rails](04-part3-backend.md#section-10-7) — **実務選択** / 5分
- [11.3 Fastify ― パフォーマンス志向の現代版](04-part3-backend.md#section-11-3) — **実務選択** / 10分
- [11.4 Hono ― エッジとマルチランタイム](04-part3-backend.md#section-11-4) — **実務選択** / 5分
- [11.5 NestJS ― エンタープライズ志向](04-part3-backend.md#section-11-5) — **実務選択** / 10分
- [12.2 Richardson Maturity Model](04-part3-backend.md#section-12-2) — **実務選択** / 5分
- [12.7 GraphQL ― クライアント主導のクエリ](04-part3-backend.md#section-12-7) — **実務選択** / 15分
- [12.8 gRPC ― バイナリ高速通信](04-part3-backend.md#section-12-8) — **実務選択** / 5分
- [12.9 tRPC ― TypeScript ネイティブ](04-part3-backend.md#section-12-9) — **実務選択** / 10分
- [12.10 WebSocket ― 全二重リアルタイム通信](04-part3-backend.md#section-12-10) — **実務選択** / 10分
- [12.11 SSE (Server-Sent Events) ― シンプルな単方向プッシュ](04-part3-backend.md#section-12-11) — **実務選択** / 10分
- [12.13 ファイルアップロードの転送方式 ― multipart と presigned URL](04-part3-backend.md#section-12-13) — **実務選択** / 25分
- [12.15 Webhook の設計 ― イベント契約と署名](04-part3-backend.md#section-12-15) — **実務選択** / 25分
- [13.9 パスキー (WebAuthn) ― パスワードレスの未来](04-part3-backend.md#section-13-9) — **実務選択** / 10分
- [13.18 SAML ― エンタープライズSSOの実質標準](04-part3-backend.md#section-13-18) — **実務選択** / 1時間5分
- [13.19 IAM の全体像 ― CIAM と EIAM の使い分け](04-part3-backend.md#section-13-19) — **実務選択** / 40分
- [13.21 MFA と TOTP ― 多要素認証の実装](04-part3-backend.md#section-13-21) — **実務選択** / 30分
- [13.24 マルチテナントの認可とテナント境界](04-part3-backend.md#section-13-24) — **実務選択** / 25分
- [13.25 認証エンドポイントの濫用 ― Credential Stuffing とアカウント列挙](04-part3-backend.md#section-13-25) — **実務選択** / 25分
- [14.14 OLTP と OLAP ― 役割の異なる2つのデータベース](05-part4-data.md#section-14-14) — **実務選択** / 10分
- [14.15 Schema Evolution ― データ契約をどう進化させるか](05-part4-data.md#section-14-15) — **実務選択** / 15分
- [14.17 Materialized View ― 高速集計の事前計算](05-part4-data.md#section-14-17) — **実務選択** / 15分
- [14.18 VACUUM の詳細 ― PostgreSQL 運用の死活問題](05-part4-data.md#section-14-18) — **実務選択** / 20分
- [14.19 Connection Pooler ― DB接続管理の必須インフラ](05-part4-data.md#section-14-19) — **実務選択** / 15分
- [14.20 テナント分離モデルと Row-Level Security](05-part4-data.md#section-14-20) — **実務選択** / 25分
- [14.21 テナント別設定・暗号鍵・データ移行](05-part4-data.md#section-14-21) — **実務選択** / 20分
- [14.22 noisy neighbor とリソース分離](05-part4-data.md#section-14-22) — **実務選択** / 20分
- [14.23 UTC、タイムゾーン、DST、カレンダー日](05-part4-data.md#section-14-23) — **実務選択** / 25分
- [14.24 DB日時型、定期実行、ユーザー表示](05-part4-data.md#section-14-24) — **実務選択** / 25分
- [14.25 個人データの収集と保存 ― 何を持ち、どこに置き、どこへ漏れるか](05-part4-data.md#section-14-25) — **実務選択** / 25分
- [14.26 保持期間、削除、エクスポート ― 個人データの終わり方](05-part4-data.md#section-14-26) — **実務選択** / 25分
- [15.3 MongoDB ― ドキュメント DB](05-part4-data.md#section-15-3) — **実務選択** / 10分
- [15.4 DynamoDB ― クラウドネイティブ KV](05-part4-data.md#section-15-4) — **実務選択** / 10分
- [15.7 Neo4j ― グラフDB](05-part4-data.md#section-15-7) — **実務選択** / 5分
- [15.9 時系列データベース ― メトリクスとイベントの定石](05-part4-data.md#section-15-9) — **実務選択** / 15分
- [15.10 地理空間データと PostGIS](05-part4-data.md#section-15-10) — **実務選択** / 15分
- [16.4 Elasticsearch / OpenSearch](05-part4-data.md#section-16-4) — **実務選択** / 10分
- [16.5 ファセット検索](05-part4-data.md#section-16-5) — **実務選択** / 5分
- [16.6 Meilisearch / Typesense ― 軽量・高速](05-part4-data.md#section-16-6) — **実務選択** / 5分
- [16.8 ベクトル検索 ― LLM時代の検索](05-part4-data.md#section-16-8) — **実務選択** / 10分
- [17.3 RabbitMQ ― 伝統的メッセージブローカー](05-part4-data.md#section-17-3) — **実務選択** / 5分
- [17.4 Kafka ― 高スループット分散ストリーミング](05-part4-data.md#section-17-4) — **実務選択** / 10分
- [17.5 AWS SQS / SNS ― マネージドの安心感](05-part4-data.md#section-17-5) — **実務選択** / 5分
- [17.10 Saga パターン ― 分散トランザクション](05-part4-data.md#section-17-10) — **実務選択** / 25分
- [17.12 CDC (Change Data Capture) ― DBの変更をイベント化する](05-part4-data.md#section-17-12) — **実務選択** / 20分
- [17.13 Webhook 受信の実務 ― 再送、順序逆転、冪等性](05-part4-data.md#section-17-13) — **実務選択** / 25分
- [17.14 メール送信の実務 ― 配送経路、バウンス、DKIM/SPF/DMARC](05-part4-data.md#section-17-14) — **実務選択** / 25分
- [17.15 外部API連携の実務 ― 時間予算、リトライ、Circuit Breaker](05-part4-data.md#section-17-15) — **実務選択** / 25分
- [17.16 決済連携の実務 ― 二重課金、返金、突合](05-part4-data.md#section-17-16) — **実務選択** / 25分

### 3. プラットフォームと変更管理

クラウド、Kubernetes、デリバリー、観測、信頼性の選択肢を判断する。

**このステージ:** 22節 / 3時間50分

- [19.5 Kubernetes ― 大規模なオーケストレーション](06-part5-infrastructure.md#section-19-5) — **実務選択** / 5分
- [19.6 Kubernetes の YAML](06-part5-infrastructure.md#section-19-6) — **実務選択** / 20分
- [19.7 Probes ― Liveness と Readiness](06-part5-infrastructure.md#section-19-7) — **実務選択** / 5分
- [19.8 ConfigMap と Secret](06-part5-infrastructure.md#section-19-8) — **実務選択** / 5分
- [19.9 マネージド Kubernetes と代替](06-part5-infrastructure.md#section-19-9) — **実務選択** / 5分
- [19.10 Ingress Controller の比較 ― クラスタへの入り口](06-part5-infrastructure.md#section-19-10) — **実務選択** / 25分
- [20.3 GCP / Azure の対応関係](06-part5-infrastructure.md#section-20-3) — **実務選択** / 5分
- [20.4 マルチクラウドとベンダーロックイン](06-part5-infrastructure.md#section-20-4) — **実務選択** / 5分
- [20.8 Terraform の実例](06-part5-infrastructure.md#section-20-8) — **実務選択** / 10分
- [20.10 GitOps ― 宣言的な運用](06-part5-infrastructure.md#section-20-10) — **実務選択** / 5分
- [20.12 API Gateway パターン ― マイクロサービスの入り口](06-part5-infrastructure.md#section-20-12) — **実務選択** / 10分
- [21.3 マトリクスビルド ― 複数環境で同時にテスト](06-part5-infrastructure.md#section-21-3) — **実務選択** / 5分
- [21.6 デプロイ頻度と DORA メトリクス](06-part5-infrastructure.md#section-21-6) — **実務選択** / 5分
- [22.5 集中ログ管理](06-part5-infrastructure.md#section-22-5) — **実務選択** / 5分
- [22.8 分散トレース ― マイクロサービスを追う](06-part5-infrastructure.md#section-22-8) — **実務選択** / 10分
- [22.10 オンコールとポストモーテム](06-part5-infrastructure.md#section-22-10) — **実務選択** / 5分
- [23.26 アップロードされたファイルの検証 ― MIME偽装、サイズ制限、スキャン](07-part6-quality.md#section-23-26) — **実務選択** / 25分
- [23.27 自動化された脅威 ― bot、スパム、レート制限の設計](07-part6-quality.md#section-23-27) — **実務選択** / 25分
- [25.11 アクセシビリティの検証 ― 自動チェック、キーボード走査、読み上げ確認](07-part6-quality.md#section-25-11) — **実務選択** / 25分
- [26.2 データベースのスケール](07-part6-quality.md#section-26-2) — **実務選択** / 10分
- [26.4 サービス分割の単位 ― Bounded Context](07-part6-quality.md#section-26-4) — **実務選択** / 5分
- [26.13 ディザスタリカバリ (DR) ― 「最悪の事態」への備え](07-part6-quality.md#section-26-13) — **実務選択** / 10分

### 4. 設計・組織・移行

境界、図、組織構造、移行、レビュー、規制を扱う。

**このステージ:** 16節 / 4時間

- [27.4 Repository パターン](08-part7-practice.md#section-27-4) — **実務選択** / 10分
- [27.5 Clean Architecture と Hexagonal](08-part7-practice.md#section-27-5) — **実務選択** / 15分
- [27.6 CRUD vs DDD ― 比較例](08-part7-practice.md#section-27-6) — **実務選択** / 15分
- [27.11 C4 モデル ― アーキテクチャ図の標準](08-part7-practice.md#section-27-11) — **実務選択** / 15分
- [27.12 Conway's Law ― 組織構造とソフトウェア構造の一致](08-part7-practice.md#section-27-12) — **実務選択** / 10分
- [27.13 問題定義とユーザーストーリー](08-part7-practice.md#section-27-13) — **実務選択** / 20分
- [27.14 ユースケース、状態遷移、業務ルール](08-part7-practice.md#section-27-14) — **実務選択** / 25分
- [27.15 受け入れ条件と Example Mapping](08-part7-practice.md#section-27-15) — **実務選択** / 25分
- [27.16 API契約とスキーマ駆動の仕様化](08-part7-practice.md#section-27-16) — **実務選択** / 20分
- [27.17 非機能要件の定量化](08-part7-practice.md#section-27-17) — **実務選択** / 20分
- [27.18 金額と通貨の表現 ― 最小単位、丸め、配分](08-part7-practice.md#section-27-18) — **実務選択** / 25分
- [28.5 Branch by Abstraction](08-part7-practice.md#section-28-5) — **実務選択** / 5分
- [28.8 マイグレーション戦略 ― 言語・フレームワーク移行](08-part7-practice.md#section-28-8) — **実務選択** / 5分
- [28.10 「コードベースは庭」というメンタリティ](08-part7-practice.md#section-28-10) — **実務選択** / 5分
- [28.13 Trunk-Based Development ― 短命ブランチ戦略](08-part7-practice.md#section-28-13) — **実務選択** / 10分
- [28.14 Web に関わる主要規制 ― GDPR、CCPA、SOC 2、HIPAA、APPI](08-part7-practice.md#section-28-14) — **実務選択** / 15分

### 5. AIと業務機能の判断

AI機能と横断業務機能を、コスト・安全性・運用を含めて判断する。

**このステージ:** 10節 / 1時間35分

- [29.9 ベクトルDBエコシステム](08-part7-practice.md#section-29-9) — **実務選択** / 5分
- [29.11 Structured Outputs ― 構造化された LLM 出力](08-part7-practice.md#section-29-11) — **実務選択** / 15分
- [30.6 非同期処理](08-part7-practice.md#section-30-6) — **実務選択** / 5分
- [30.7 検索](08-part7-practice.md#section-30-7) — **実務選択** / 5分
- [30.8 課金 (Stripe 連携)](08-part7-practice.md#section-30-8) — **実務選択** / 10分
- [30.10 可観測性](08-part7-practice.md#section-30-10) — **実務選択** / 5分
- [30.11 デプロイとリリース戦略](08-part7-practice.md#section-30-11) — **実務選択** / 5分
- [30.14 マルチテナントと日時の設計チェックリスト](08-part7-practice.md#section-30-14) — **実務選択** / 15分
- [30.15 ファイル・Webhook・メール・外部API連携の本番運用チェックリスト](08-part7-practice.md#section-30-15) — **実務選択** / 15分
- [30.16 アクセシビリティ・個人データ・決済・濫用対策のチェックリストと免責](08-part7-practice.md#section-30-16) — **実務選択** / 15分

## 編集ルール

1. ルートの正本は `config/learning-paths.json` です。
2. 節の分類と推定時間は `config/learning-levels.json` を参照します。
3. 節の追加・改名・削除時は両マニフェストを確認します。
4. `npm run generate:learning-paths:check` は生成差分、存在しない節、重複した節、空ステージを検出します。
5. 目次や前付けから本ファイルへのリンクを維持します。
