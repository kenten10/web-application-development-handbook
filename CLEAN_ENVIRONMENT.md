# クリーン環境検証ガイド

本書のコード教材を、新規環境から同じ手順で再現するための検証基準です。演習定義の正本は `config/exercises.json`、環境・手動確認区分の正本は `config/clean-environment-plan.json` です。

## 保証環境

- Node.js 24.18.0以上の24.x
- pnpm 11.15.1
- TypeScript 6.0.3
- PostgreSQL 18
- Redis 8
- Chromium、OpenSSL

最も再現性が高い方法は `.devcontainer/` を使用することです。devcontainerはPostgreSQLとRedisを同時に起動し、教材サーバ用ポートを転送します。

```bash
# Dev Container内、または同等のNode.js 24環境
bash scripts/bootstrap-clean-environment.sh
```

このスクリプトは次を実行します。

1. Node.js・pnpmの固定バージョン確認
2. `pnpm install` と `pnpm-lock.yaml` の生成確認
3. `pnpm install --frozen-lockfile`
4. 自己署名localhost証明書の生成
5. 原稿・演習・workspace・CIの全検証
6. 全30章のlint・typecheck・test・build
7. ビルド成果物 (`code/chXX/dist`) の削除

### 実行前に確認すること

- **Node.jsは24.18.0以上24.x系であること。** スクリプトは1行目のバージョン検査で停止し、それ以降は何も実行しません。25以降を使っている場合は、`mise use node@24.18.0` や `nvm install 24.18.0` のようにバージョン管理ツールで24系を用意し、`node --version` が24.xを返す状態で実行してください。
- **Node.js 25以降ではcorepackが同梱されません。** 24系へ切り替えれば問題ありませんが、やむを得ず25以降の環境で `corepack` を使う場合は `npm install -g corepack@latest` が必要です。
- 手順7が要る理由は、手順6の `build` が各章へ `dist/` を作り、それが残っていると演習カードの自己採点手順 `pnpm --filter @handbook/chXX run test` が `FORBIDDEN_ARTIFACT` で失敗するためです。自分で `pnpm run build` を実行したあとも、`pnpm run clean:artifacts` で同じ後始末をしてください。
- **このスクリプトはリポジトリ内へ書き込みます。** `node_modules/`、`pnpm-lock.yaml`、`.verification/certs/localhost-key.pem`、`.verification/certs/localhost-cert.pem` が作られます。読み取り専用のチェックアウトや、変更を残したくない作業ツリーでは実行しないでください。
- ブラウザ手動区分の演習では、静的ファイルをHTTPで配信する手段が要ります。Service Worker は `file://` では動かないためです。`npx http-server <dir> -p 8080` か `python3 -m http.server 8080` を使います。どちらも devcontainer に含まれています。

## 検証区分

| 区分 | 件数 | 完了証跡 |
|---|---:|---|
| ローカル自動 | 113 | 型検査、ビルド、章テスト、README期待出力 |
| localhost TLS | 7 | 上記に加え、OpenSSL接続と証明書境界 |
| ブラウザ手動 | 6 | Chromium操作、Performance、Service Worker、Web Vitals |
| 外部サービス | 17 | 隔離サービスへの実接続ログ、README期待出力 |

ブラウザ手動・外部サービス項目をローカル自動テストの成功だけで完了扱いにしてはいけません。全143演習の必要証跡は `config/clean-environment-plan.json` に記録されています。

区分は「検証の厳しさ」を表すものであり、「その演習が実サービスへ接続する」という意味ではありません。自作実装で外部ミドルウェアの挙動を再現する演習も、誤りが本番運用の判断に直結するため、自動テスト以外の証跡を必ず1件以上求める区分へ置いています。各演習が実際に必要とするソフトウェアは同ファイルの `services` を、そこで残す証跡は `requiredEvidence` を参照してください。

KEN-61 のベータレビューで、17件の演習の `services` が `config/exercises.json` と食い違い、接続しないサービスへの「実サービス接続ログ」を求めていたことが判明しました。証跡が原理的に取得できず release blocker RB-06 を判定できない状態だったため、`services` を演習カードの正本へ合わせ、`requiredEvidence` を演習が実際に生む証跡へ差し替えています。区分そのものは変更していないため、必須検証演習37件と必須検証章15章の範囲は縮んでいません。

## ポート

教材が利用する代表ポートは次です。並列実行時は `PORT` または `PORT_BASE` で変更します。

- HTTP: 3000、3001、4001、4002、8080
- HTTPS: 3443、3444
- PostgreSQL: 5432
- Redis: 6379

サーバは原則として `127.0.0.1` または `localhost` にbindします。`0.0.0.0` が必要なコンテナ演習は、devcontainer内部または隔離ネットワークだけで実行します。

## 環境変数

主な変数は `DATABASE_URL`、`REDIS_URL`、`PORT`、`PORT_BASE`、`TLS_KEY`、`TLS_CERT`、`MIGRATIONS_DIR`、`CONCURRENCY`、`REQUESTS` です。秘密情報をリポジトリへ保存せず、検証用値だけを使用します。

## 外部依存の扱い

- PostgreSQL・Redisはdevcontainerのserviceを使う。
- Kafka・Kubernetes・AWSは拡張検証とし、ローカルエミュレータまたは専用検証環境を使う。
- セキュリティ演習は公開ネットワークへ送信せず、localhost・テストデータ・注入可能なresolverへ限定する。
- Docker/Kubernetes演習は個人環境の本番クラスタや共有クラウドアカウントで実行しない。

## 2026年7月30日の互換検証

外部DNSとDockerが使えないサンドボックスで、Node.js 22.16.0・TypeScript 5.8.3による互換検証を実施しました。

- 全30章の型検査・ビルド: 30/30成功
- コンパイル済み解答テスト: 122件成功
- 生成JavaScript: 282ファイル
- シェル構文: 68ファイル成功
- 全132演習の厳格solution検査: 成功
- 原稿・目次・索引・コード参照: エラー0件
- localhost TLS 1.2 / 1.3: 接続成功

固定版Node.js 24・pnpm 11、ブラウザ操作、Dockerおよび外部サービスの最終証跡は未取得です。詳細は `reports/KEN56_CLEAN_ENVIRONMENT_FINAL_AUDIT_REPORT.md` を参照してください。
