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

Node.jsとpnpmは`.node-version`および`packageManager`から固定する。CIはCorepackでpnpm 11.15.1を有効化した後、`pnpm store path`で保存先を解決し、完全なcommit SHAへ固定した`actions/cache`でpnpm storeをキャッシュする。

依存関係のインストールは`pnpm install --frozen-lockfile --prefer-offline`で行う。KEN-65のクリーン環境確認で生成した`pnpm-lock.yaml`をリポジトリへ固定してあるため、lockfileと`package.json`が食い違った場合はインストールの時点で失敗する。CIが暗黙にlockfileを書き換えることはない。

`config/ci-plan.json`の`policy.frozenLockfile`が`true`のとき、`scripts/validate-ci.mjs`は次を検査する。

- `pnpm-lock.yaml`が存在すること
- 必須workflowの`pnpm install`がすべて`--frozen-lockfile`を伴うこと
- 必須workflowに`--no-frozen-lockfile`が残っていないこと

lockfileを更新した場合は、`pnpm install --frozen-lockfile`がローカルで成功することを確認してからpushする。

## 5. 公開サイトのworkflow

`.github/workflows/pages.yml` は、Pull Request、`main`へのpush、手動実行で起動する。

- Pull Requestでは静的サイトの生成と決定性検証だけを行い、配信はしない。生成の失敗をPRの時点で検出するためである。
- `main`への反映時に `dist/site` をPages artifactへアップロードし、配信ジョブが公開する。
- 既定の`permissions`は`contents: read`とし、配信ジョブだけに`pages: write`と`id-token: write`を与える。
- 使用するactionは完全なcommit SHAへ固定する。`scripts/validate-release-policy.mjs` と `scripts/validate-ci.mjs` の双方が固定漏れを検出する。

このworkflowは必須ゲートへ含めない。公開の失敗が原稿の検証結果を巻き込まないようにするためである。

### 5.1 配信の制御

正本のリポジトリ `kenten10/web-application-development-handbook` はpublicであり、GitHub Pagesを利用できる。配信は有効になっており、公開URLは <https://kenten10.github.io/web-application-development-handbook/> である。

配信ジョブは、Pagesを有効化していないリポジトリで実行すると `actions/deploy-pages` がPages APIで失敗し、原稿の検証とは無関係な赤い実行履歴が `main` に残る。フォークや複製先でそうならないよう、配信はrepository variable `PAGES_ENABLED` を明示的に `true` にしたときだけ動く定義にしてある。正本のリポジトリでは、この変数を `true` に設定済みである。

| ジョブ・step | 実行条件 |
|---|---|
| Build static site | 常に実行する（生成と決定性検証） |
| Upload Pages artifact | `github.event_name != 'pull_request'` かつ `vars.PAGES_ENABLED == 'true'` |
| Deploy to GitHub Pages | 同上 |

生成と決定性検証は常に動く。したがって、仮に配信を止めてもサイト生成の退行はPull Requestの時点で検出できる。`PAGES_ENABLED` は「必要な検査を外す」スイッチではなく「配信だけを切り替える」スイッチである。

### 5.2 配信を有効にする手順

正本のリポジトリでは次の手順を実施済みである。フォークや移管先で配信を立ち上げるときも同じ順序で行う。

1. リポジトリをpublicにする。
2. Settings > Pages で Source を **GitHub Actions** にする。
3. repository variableを追加する。

```bash
gh variable set PAGES_ENABLED --body true --repo kenten10/web-application-development-handbook
```

4. `main`で `Handbook Pages` を実行し、`Deploy to GitHub Pages` の成功と公開URLを確認する。
5. 公開URLを `README.md` と `RELEASE_POLICY.md` 第1.4節へ記載する。
6. `config/release.json` の `site.repoLinkBase` が公開後のURLと一致していることを確認する。

配信を止めるときは `gh variable delete PAGES_ENABLED` でよい。workflowの定義を変更する必要はない。

### 5.3 workflow定義の構文検査

Actionsを実行しないまま定義だけを変更したときも、workflowが壊れていないことは確認する。

```bash
gh workflow view "Handbook Pages" --repo kenten10/web-application-development-handbook
node -e "const {readFileSync}=require('node:fs');const s=readFileSync('.github/workflows/pages.yml','utf8');if(!/^jobs:/m.test(s))process.exit(1)"
pnpm run validate:ci
pnpm run validate:release-policy
```

`gh workflow view` はGitHubがworkflowを解析できた場合にだけ成功する。解析に失敗したworkflowはworkflow一覧へ現れない。

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

## 7. 失敗箇所の特定

必須ゲートが落ちたとき、どの章のどのタスクが落ちたかを次の3か所から特定できる。

1. **ジョブ名** — matrixのジョブ名は `ch07 / lint · typecheck · test · build` の形式である。章番号がジョブ一覧にそのまま出る。
2. **ログのグループ** — `scripts/ci-chapter.mjs` はタスクごとに `::group::ch07 / lint` を出力する。展開すれば失敗したコマンドの出力だけを読める。
3. **annotation** — 失敗したタスクごとに `::error title=ch07 / lint failed::exit=1` を出力する。GitHubはこれをPull Requestのチェック欄とジョブのSummaryへ表示する。最後に `[ch07] 1 task(s) failed.` を出力する。

`fail-fast: false` を指定しているため、1章が落ちても残りの29章は最後まで走る。1回の実行で失敗章をすべて把握できる。

ローカルで同じ出力を再現できる。

```bash
node scripts/ci-chapter.mjs ch07          # 4タスクを実行する
node scripts/ci-chapter.mjs ch07 lint     # タスクを絞る
```

## 8. 必須チェックとruleset

`main` はrulesetで保護する。必須ステータスチェックは `Required CI gate` の1つだけとする。この1ジョブが `handbook`、`chapter`（30章）、`service-containers` の結果を集約するため、matrixの章数が変わってもrulesetを変更しなくてよい。

設定はGitHub CLIから行う。

```bash
gh api --method POST repos/kenten10/web-application-development-handbook/rulesets \
  --input .github/rulesets/main-required-ci.json
```

現在の設定はいつでも読み出せる。

```bash
gh api repos/kenten10/web-application-development-handbook/rulesets
gh api repos/kenten10/web-application-development-handbook/rulesets/<id>
```

ruleset定義の正本は [`.github/rulesets/main-required-ci.json`](.github/rulesets/main-required-ci.json) に置く。含めるルールは次のとおりである。

| ルール | 内容 |
|---|---|
| `deletion` | `main` の削除を禁止する |
| `non_fast_forward` | force pushを禁止する |
| `pull_request` | `main` への直接pushを禁止し、Pull Requestを必須にする。単著のため必要承認数は0とする |
| `required_status_checks` | `Required CI gate` の成功を必須にする。`strict_required_status_checks_policy` を有効にし、最新の `main` を取り込んだ状態で検査する |

必要承認数を1にすると、単著のリポジトリでは自分のPull Requestを承認できず何もマージできなくなる。人数が増えた時点で1へ引き上げる。

`bypass_actors` にはRepository admin（`actor_id: 5`）だけを登録する。Actionsを実行できない障害時に、リポジトリ管理者が `gh pr merge --admin` で明示的に迂回できるようにするためである。迂回した場合は理由をPull Requestへ記録する。

`config/ci-plan.json` の `policy.requiredStatusCheck` が正本であり、`scripts/validate-ci.mjs` は同名のジョブが `ci.yml` に存在することを検査する。ジョブ名を変えるとrulesetの必須チェックが永久に保留になるため、両者を必ず一致させる。

### 8.1 適用済みのruleset

rulesetは適用済みである。id は `21860256`、`enforcement` は `active`、対象は `~DEFAULT_BRANCH`（`main`）で、上の表の4ルールがそのまま入っている。`bypass_actors` はRepository admin（`actor_id: 5`）の `always` だけである。必須ステータスチェックは `Required CI gate` の1つで、`strict_required_status_checks_policy` は有効である。

適用は `.github/rulesets/main-required-ci.json` を入力にした `gh api --method POST` の1回だけで、GitHubのUIでの手作業は挟んでいない。現在の設定はいつでも読み出して定義と突き合わせられる。

```bash
gh api repos/kenten10/web-application-development-handbook/rulesets --jq '.[] | {id, name, enforcement}'
gh api repos/kenten10/web-application-development-handbook/rulesets/21860256
```

無料プランでrulesetとbranch protectionを使えるのは公開リポジトリだけである。非公開のまま適用しようとすると、rulesets APIもbranch protection APIも `403 Upgrade to GitHub Pro or make this repository public to enable this feature.` を返す。v1.0.0の公開時点はこの状態であり、その経緯は [`reports/KEN70_GITHUB_CI_REPORT.md`](./reports/KEN70_GITHUB_CI_REPORT.md) に記録がある。リポジトリを非公開へ戻す場合は、rulesetによる保護を失うことを織り込む必要がある。

## 9. Actionsの実行枠

リポジトリはpublicであり、GitHub-hosted runnerの標準ランナーは無料枠で動く。実行時間の課金枠を気にする必要はない。`main` の必須ゲートは33ジョブ（`Manuscript and configuration`、`PostgreSQL and Redis service containers`、ch01〜ch30の30ジョブ、`Required CI gate`）が約3分で完走する。

非公開リポジトリではActionsの実行時間に課金枠が必要になる。枠を使い切っているか支払い設定に問題があると、ジョブは開始されずに次のannotationを残して失敗する。

```
The job was not started because recent account payments have failed
or your spending limit needs to be increased.
```

これはworkflowの定義の誤りではない。この症状が出たときは Settings > Billing & plans で支払い方法とspending limitを確認する。v1.0.0の公開時点はこの状態であり、経緯は [`reports/KEN70_GITHUB_CI_REPORT.md`](./reports/KEN70_GITHUB_CI_REPORT.md) にある。

Actionsを実行できない場合でも、ローカル検証は同じ内容を実行できる。

```bash
pnpm install --frozen-lockfile
pnpm run check:handbook
pnpm run validate:ci
node scripts/ci-chapter.mjs ch01
```

必須ゲートに載せている検査を緩めて回避しないこと。実行できない期間は、ローカルでの実行ログを証跡として残す。
