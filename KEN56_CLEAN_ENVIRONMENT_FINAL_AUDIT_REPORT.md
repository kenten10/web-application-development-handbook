# KEN-56 クリーン環境検証 最終監査レポート

## 結論

全132演習の模範解答完成後に、新しい作業ディレクトリへ配布ZIPだけを展開して再検証した。利用可能な互換環境では、全30章の型検査・ビルド、122件の解答テスト、68件のシェル構文、原稿・演習・workspace・CIの静的検証が成功した。

一方、固定版Node.js 24.18.0・pnpm 11.15.1は外部DNS制限により導入できず、Dockerも利用できなかった。Chromiumは存在したが、ローカルHTTPおよび`file:`への画面遷移が環境管理者によって遮断された。このためKEN-56の完了条件である、実ブラウザと実外部サービスを含む全必修演習の確認には未到達である。

KEN-56は **In Progressを維持する**。

## 互換クリーン環境で成功した項目

- 配布ZIPの整合性検査: 成功
- 全132演習の厳格solution検査: 成功
- 章別typecheck/build: 30/30成功
- コンパイル済み解答テスト: 122件成功
- 生成JavaScript: 282ファイル
- シェル構文: 68ファイル成功
- 検証基盤回帰テスト: 43/43成功（既存40件 + クリーン環境台帳3件）
- 原稿・目次・索引・コード参照: エラー0件
- workspace構造検査: 30章、警告0件
- CI静的検査: 警告0件
- localhost HTTPSサーバ: 200応答
- TLS 1.2: ECDHE-RSA-AES128-GCM-SHA256で接続成功
- TLS 1.3: TLS_AES_256_GCM_SHA384で接続成功
- URL trace: DNS・TCP・TLS・TTFB・本文受信を計測

実行環境はNode.js 22.16.0、TypeScript 5.8.3、OpenSSL 3.5.5である。第7章のZodは、外部レジストリへ接続できないため検証専用の最小互換層を使用した。互換層と`node_modules`、`dist`は成果物へ含めていない。

## 演習区分

| 区分 | 件数 | 現在の証跡 | 残作業 |
|---|---:|---|---|
| ローカル自動 | 102 | 型検査・ビルド・章テスト成功 | 固定Node/pnpmで再実行 |
| localhost TLS | 7 | 自動テストとTLS 1.2/1.3接続成功 | 固定Node/pnpmで再実行 |
| ブラウザ手動 | 6 | 静的検査・ビルド成功、Chromium起動 | 管理制限のないブラウザで操作確認 |
| 外部サービス | 17 | ローカルシミュレータ・自動テスト成功 | PostgreSQL、Redis、Kafka、Docker、Kubernetes、AWSで実確認 |

全演習の個別記録は `clean-environment-results-ken56-final.csv` と `config/clean-environment-plan.json` に保存した。

## 検出・修正した検証上の問題

### 1. 実行時静的資産

TypeScriptの`tsc`はHTML、CSS、Service Worker、manifest、`.mjs`を`dist`へコピーしない。コンパイル済みテストを直接実行する際、第8章と第9章で実行時資産が不足した。検証手順では非TypeScript資産を`dist`へstageしてからテストし、配布前に`dist`を削除する手順を明記した。

### 2. 生成物を含む状態での検証

`dist`は配布禁止物であり、生成後に厳格演習検査を実行すると意図どおり失敗する。最終検証順序を「厳格検査→build/test→dist削除→再度厳格検査」に固定した。

### 3. 検証テストの並列実行

検証基盤テストを単一の`node --test scripts/*.test.mjs`で並列実行すると、生成系テスト間の一時的な競合が発生した。公式のpnpmスクリプトは各検証を順番に実行するため影響しない。監査では`--test-concurrency=1`で40/40成功を確認した。

## 追加した再現環境

- `.devcontainer/Dockerfile`
- `.devcontainer/docker-compose.yml`
- `.devcontainer/devcontainer.json`
- `scripts/bootstrap-clean-environment.sh`
- `config/clean-environment-plan.json`
- `scripts/validate-clean-environment.mjs`
- `scripts/validate-clean-environment.test.mjs`
- `CLEAN_ENVIRONMENT.md`

Dev ContainerはNode.js 24.18.0、pnpm 11.15.1、PostgreSQL 18、Redis 8、Chromium、OpenSSLを準備する。`bash scripts/bootstrap-clean-environment.sh`でlockfile生成、frozen install、全検証を実行する。

## 完了に必要な残作業

1. 外部ネットワークへ接続できる環境で`pnpm install`を行い、`pnpm-lock.yaml`を生成する。
2. 同じ環境で`pnpm install --frozen-lockfile`を成功させる。
3. Node.js 24.18.0・pnpm 11.15.1・TypeScript 6.0.3で全30章を再実行する。
4. 管理制限のないChromiumで6件のブラウザ演習を操作確認する。
5. devcontainerでPostgreSQL・Redisを確認し、隔離環境でKafka・Kubernetes・AWS・Docker演習の証跡を残す。
6. GitHub-hosted runnerで必須CIの成功証跡を取得する。

## Linear判断

KEN-54のブロッカーは解消済みである。KEN-56は環境依存の実確認が残るためDoneへ移動しない。再現用devcontainerと検証台帳を整備したため、外部ネットワークとDockerを利用できる環境へ持ち出せば、残作業を同一コマンドで再開できる。
