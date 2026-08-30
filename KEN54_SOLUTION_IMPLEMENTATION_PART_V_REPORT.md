# KEN-54 模範解答実装レポート — 第5バッチ（第20〜24章）

## 概要

第20〜24章の25演習について、要件メモ・`referenceArtifact`・`model answer scaffold`だけだったsolutionを、実行・観察・自己検証できる模範解答へ置換した。

- 対象演習: 25
- 厳格solution検査: 25/25成功
- 全132演習の実装済み: 108
- 残り未完成: 24
- 完成率: 81.8%

## 第20章 クラウドとIaC

- desired stateと実状態の差分を表示し、plan/apply/state保存を行うミニIaC
- ファイル欠落・内容差分・型差分を検出するdrift detector
- EC2・RDS・S3の静的料金表による月額見積もり
- AES-256-GCM暗号化、ローテーション、grace期間、監査ログを備えたSecretStore

## 第21章 CI/CDとDevOps

- 状態保存、ヘルスチェック、切替、停止を行うBlue-Green controller
- トラフィック比率、エラー率監視、自動rollback、promotionを扱うCanary controller
- Node.js/Pythonプロジェクトを検出するGitHub Actions workflow generator
- 観測期間のエラー率で旧版へ戻すDeploymentPipeline

## 第22章 オブザーバビリティ

- レベル制御、child logger、AsyncLocalStorage、Error直列化を備えたJSON logger
- Counter/Gauge/Histogram/labelsと`/metrics`を備えたPrometheus風registry
- span親子関係、traceparent、active span、samplingを扱うTracer
- error budget、burn rate、multi-window alertを計算するSLOTracker

## 第23章 セキュリティ

- SQL文字列連結の脆弱性とparameterized queryの差を隔離データで再現
- HTML escapeと許可タグ方式sanitizer
- HMAC付きDouble-Submit CSRF tokenとSameSite cookie
- private/link-local/localhost/DNS rebindingを拒否するSSRFGuard
- Token BucketとSliding Window rate limiter
- CSP/HSTS等を生成するsecurity headers middleware
- package-lockと簡易advisory DBを照合するdependency scanner
- inclusion proofを生成・検証するMerkle Tree

セキュリティ演習は、公開ネットワークや実サービスへの攻撃を行わず、ローカルデータ・注入可能なresolver・純粋関数で境界を検証する。

## 第24章 パフォーマンス

- concurrency、request count/duration、p50/p90/p99、status codeを集計するHTTP load tester
- self/total samplesとflamegraph形式を出力するSamplingProfiler
- LRU/LFU cacheとhit-rate benchmark
- AsyncLocalStorageによるN+1 monitorと重複keyをbatchするMiniDataLoader
- LCP/CLS/INPをPerformanceObserverで計測する単一HTML

## 検証結果

- 第20〜24章 typecheck: 5/5成功
- 第20〜24章 build: 5/5成功
- 生成JavaScript: 52ファイル
- 解答用自動テスト: 25/25成功
- shell構文検査: 3/3成功
- 第20〜24章 厳格solution検査: 25/25成功
- 全体回帰テスト: 40/40成功
- 学習レベル、学習ルート、章ガイド、演習一覧、目次・索引の生成差分: なし
- workspace構造検査: 30章、警告0件
- CI静的検査: 警告0件
- 原稿検証: エラー0件、既知の重複アンカー候補27件

## 実行環境の境界

互換実行はNode.js 22.16.0・TypeScript 5.8.3で行った。固定版Node.js 24.18.0・pnpm 11.15.1・TypeScript 6.0.3、実ブラウザでのWeb Vitals操作、GitHub-hosted runner上の実workflowはKEN-56で最終確認する。

## 次の対象

第25〜30章に残る24演習を実装する。
