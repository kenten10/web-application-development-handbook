# CI運用ガイド

## 1. 必須ゲート

`.github/workflows/ci.yml` は、Pull Request、`main`へのpush、手動実行で起動する。

1. 原稿・生成物・workspace・CI設定を検証する。演習検証では未完成solutionも拒否する。
2. 30章をmatrix化し、各章で`lint`、`typecheck`、`test`、`build`を実行する。`build`前に`dist`を削除し、終了後にJavaScript成果物が存在しなければ失敗とする。
3. PostgreSQL 18とRedis 8のservice containerを起動し、接続可能性を確認する。
4. `Required CI gate`が全必須ジョブの成功を集約する。

matrixは`fail-fast: false`、`max-parallel: 6`で実行する。1章の失敗で他章を停止せず、ジョブ名とGitHub Actions annotationから失敗章・失敗タスクを特定できる。

## 2. 拡張検証

`.github/workflows/extended-ci.yml` は毎週および手動で実行する。

- Linux・Docker実行環境の記録
- 全shell演習の`bash -n`
- Kafka、Kubernetes、AWS、OpenSSL/TLS等を必要とする手動・外部サービス演習の台帳確認

長時間ベンチマークやクラウド資格情報を必要とする演習はPR必須ゲートへ含めない。ただし`config/ci-plan.json`と演習マニフェストに理由を残し、黙ってskipしない。

## 3. セキュリティ

- `GITHUB_TOKEN`は`contents: read`だけを許可する。
- `actions/checkout`、`actions/setup-node`、`actions/cache`は完全なcommit SHAへ固定し、すべての出現箇所を自動検査する。
- checkoutでは`persist-credentials: false`を指定する。
- Pull Requestではリポジトリのsecretを前提にしない。
- service containerはUbuntu runnerに限定する。

## 4. 依存関係

Node.jsとpnpmは`.node-version`および`packageManager`から固定する。CIはCorepackでpnpm 11.15.1を有効化した後、`pnpm store path`で保存先を解決し、完全なcommit SHAへ固定した`actions/cache`でpnpm storeをキャッシュする。現在の配布物にはlockfile生成済み環境が含まれないため、CIでは`--no-frozen-lockfile`を使用する。`pnpm-lock.yaml`はKEN-56のNode.js 24クリーン環境確認で生成・固定し、その後`--frozen-lockfile`へ切り替える。

## 5. 公開サイトのworkflow

`.github/workflows/pages.yml` は、Pull Request、`main`へのpush、手動実行で起動する。

- Pull Requestでは静的サイトの生成と決定性検証だけを行い、配信はしない。生成の失敗をPRの時点で検出するためである。
- `main`への反映時に `dist/site` をPages artifactへアップロードし、配信ジョブが公開する。
- 既定の`permissions`は`contents: read`とし、配信ジョブだけに`pages: write`と`id-token: write`を与える。
- 使用するactionは完全なcommit SHAへ固定する。`scripts/validate-release-policy.mjs` が固定漏れを検出する。

このworkflowは必須ゲートへ含めない。公開の失敗が原稿の検証結果を巻き込まないようにするためである。Pagesの有効化とbranch protectionの設定はKEN-70で行う。

## 6. ローカル確認

```bash
pnpm run validate:ci
pnpm run test:ci
node scripts/ci-chapter.mjs ch07 --dry-run
node scripts/ci-extended-checks.mjs inventory
node scripts/ci-extended-checks.mjs shell-syntax
pnpm run validate:release-policy
pnpm run build:site:check
```
