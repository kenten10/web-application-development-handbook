# KEN-70 作業レポート — GitHub Actionsの成功証跡と必須チェック

対象issue: [KEN-70 [ユーザー実行] GitHub Actionsの成功証跡と必須チェックを設定する](https://linear.app/kenten/issue/KEN-70/)
親issue: KEN-56 / 先行: KEN-65（完了） / 後続: KEN-63
作業日: 2026-08-30

## 0. 結論

やったこと。

- 作業ツリーをgit管理下へ置き、秘密情報を除外したうえで **非公開リポジトリ** `kenten10/web-application-development-handbook` を作成してpushした。
- KEN-62から引き継いだ4項目（Pages用actionのSHA確認、`repoLinkBase`、`ci-plan.json`へのPages登録、`--frozen-lockfile`）をすべて処理した。
- Pull Request [#1](https://github.com/kenten10/web-application-development-handbook/pull/1) を作成し、`ci.yml`・`pages.yml`・`extended-ci.yml` を実行した。
- 失敗時に章番号と失敗タスクが識別できることを、意図的な失敗を作って確認し、元へ戻した。
- rulesetの定義を `.github/rulesets/main-required-ci.json` へ正本として固定した。

できなかったこと。原因はいずれもGitHubアカウントのプラン・課金設定であり、workflowや原稿の不備ではない。

| 未達 | 原因 | GitHubの応答 |
|---|---|---|
| PR・mainでのCI成功 | 非公開リポジトリのActions実行枠 | `The job was not started because recent account payments have failed or your spending limit needs to be increased.` |
| rulesetの適用 | 無料プランの非公開リポジトリ | `403 Upgrade to GitHub Pro or make this repository public to enable this feature.` |
| PRのmainへのマージ | 実行環境の権限制御でコマンドが拒否された | （後述） |

いずれも「リポジトリを公開する」または「GitHub Proへ切り替える」で解消する。リポジトリを公開する判断は本タスクの承認範囲外のため実施していない。

## 1. 秘密情報・不要ファイルの混入チェック

push前に、作業ツリー全体を対象として次を実施した。

### 1.1 調べた内容と結果

| 調査 | 方法 | 結果 |
|---|---|---|
| 秘密鍵 | `grep -rIl "BEGIN .*PRIVATE KEY"` | 1件（`.verification/certs/localhost-key.pem`） |
| 高シグネチャのトークン | `grep -rInE "gh[pousr]_[A-Za-z0-9]{20,}\|sk-[A-Za-z0-9]{20,}\|AKIA[0-9A-Z]{16}\|xox[baprs]-…"` | 0件 |
| `.env` 系 | `find . -name ".env*"` | 0件 |
| 個人を特定する絶対パス | `grep -rIl "/Users/kensukeyoshida"` | 0件 |
| `.DS_Store` / `*.sqlite` / `*.db` / `*.tsbuildinfo` | `find` | 0件 |
| `node_modules` | `find -name node_modules` | ルート + 全30章。`.gitignore`で除外済み |
| 巨大ファイル | staged全件のサイズ確認 | 最大は `beta-review-findings.json` 907KB、次点 `config/exercises.json` 786KB。いずれも正本データで妥当 |

### 1.2 `localhost-key.pem` の扱い

**リポジトリへ含めないと判断した。** `.gitignore` へ `.verification/certs/` を追加して除外した。

判断の根拠は次の4点である。

1. **秘密鍵である。** 検証用・使い捨てであっても、秘密鍵をリポジトリへ入れると「秘密鍵をコミットしてよい」という前例が本書の成果物そのものに残る。本書はWebアプリケーション開発の解説書であり、読者がこのリポジトリを手本にする。
2. **再生成できる。** `scripts/bootstrap-clean-environment.sh` が実行時に生成する。ch03の演習カード（`code/ch03/cert-gen.solution.sh`、および `openssl req -x509 …` の1行）も同じものを生成する手順を持つ。リポジトリに無くても読者の再現性は落ちない。
3. **すでに失効している。** `notAfter=Aug 27 01:23:48 2026 GMT` であり、本作業日（8月30日）時点で期限切れである。残す価値がない。
4. **除外しても検証が壊れない。** クリーンなクローンで `pnpm run check:handbook` が終了コード0で通ることを確認した（`.verification/ken70/logs/03-clean-clone-simulation.out`）。

`CLEAN_ENVIRONMENT.md` には既に「このスクリプトはリポジトリ内へ書き込みます。`.verification/certs/localhost-key.pem`、`localhost-cert.pem` が作られます」と記述されており、生成物であることは文書側でも一貫している。証明書（公開側）`localhost-cert.pem` も、秘密鍵と対で意味を持つため同時に除外した。

### 1.3 `.gitignore` の整備

既存の除外はそのまま残し、2点を追加した。

```gitignore
# 検証で生成する自己署名証明書。秘密鍵をリポジトリへ入れない。
# scripts/bootstrap-clean-environment.sh が実行時に再生成する。
.verification/certs/

# 検証ログは証跡として残すため、上の *.log の除外対象から戻す。
!.verification/**/*.log
```

2つ目は逆方向の確認から出た。`*.log` の除外により `.verification/ken68/logs/kind-create.log`（KEN-68のkindクラスタ生成ログ）が落ちていた。証跡なので打ち消した。

**コミットすべきファイルが誤って除外されていないか**も確認した。`pnpm-lock.yaml` は除外対象に入っていない（`*.yaml` を除外する行は無い）。`git ls-files pnpm-lock.yaml` で追跡されていることを確認済みである。

### 1.4 生成物

`dist/`（3.3MB、`dist/site/` の生成HTML）と `node_modules/`（44MB）は `.gitignore` で除外されている。`dist/site` はCIの `pages.yml` が毎回生成し直すため、リポジトリへ入れる必要がない。

### 1.5 コミットされた内容

766ファイル。`git diff --cached` に対して `certs/`・`node_modules`・`/dist/`・`.env`・`.DS_Store`・`key.pem` のいずれもマッチしないことを確認してからコミットした。

`.verification/ken70/logs/` へ新規に置いたログについても、`uname -a` が出力したホスト名（`<local-host>` へ置換）と pnpm が出力した絶対パス（`<repo>` へ置換）を伏せた。最終確認として `grep -rIl "MacBook\|kensukeyoshida\|Kensuke" .verification/ken70/logs/` が0件であることを確認した。

## 2. リポジトリ

**URL: https://github.com/kenten10/web-application-development-handbook**

privateであることを2つの方法で確認した。証跡は `.verification/ken70/logs/02-repo-visibility.out`。

```bash
$ gh repo view kenten10/web-application-development-handbook --json isPrivate,visibility,url
{"isPrivate":true,"url":"https://github.com/kenten10/web-application-development-handbook","visibility":"PRIVATE"}

$ gh api repos/kenten10/web-application-development-handbook --jq '{full_name, private, visibility, has_pages}'
{"full_name":"kenten10/web-application-development-handbook","has_pages":false,"private":true,"visibility":"private"}
```

初期ブランチは `main`。`user.name` / `user.email` は既存のグローバル設定（`Kensuke Yoshida` / `44917261+kenten10@users.noreply.github.com`）をそのまま使った。新たな設定は行っていない。

## 3. Pull Request

**URL: https://github.com/kenten10/web-application-development-handbook/pull/1**

ブランチ `ken-70/github-actions-gate`。コミット3件。

| コミット | 内容 |
|---|---|
| `2ea01fc` | KEN-62引き継ぎ4項目、Pages配信の制御、ruleset定義、CI.mdの追記 |
| `f43460c` | PR実行・extended CI手動実行・workflow構文検査の証跡 |
| （本レポート） | 作業レポートとCI.md第8.1節 |

### 3.1 PR上のジョブ結果

**必須ジョブは1つも成功していない。** ジョブが起動しなかったためである。

| ジョブ | 結果 | run URL |
|---|---|---|
| Manuscript and configuration | failure（起動せず） | https://github.com/kenten10/web-application-development-handbook/actions/runs/33306365938 |
| `${{ matrix.chapter }}` / lint · typecheck · test · build | skipped | 同上 |
| PostgreSQL and Redis service containers | skipped | 同上 |
| **Required CI gate** | **failure（起動せず）** | 同上 |
| Build static site（pages.yml） | failure（起動せず） | https://github.com/kenten10/web-application-development-handbook/actions/runs/33306365936 |
| Deploy to GitHub Pages | skipped（意図どおり） | 同上 |

すべてのfailureジョブが同一のannotationを持つ。

```
failure: The job was not started because recent account payments have failed
or your spending limit needs to be increased.
Please check the 'Billing & plans' section in your settings
```

これは **ジョブの実行が始まる前** に返る。steps配列は空である（`gh api …/actions/jobs/99243524481 --jq '.steps'` が `[]`）。つまりcheckoutすら実行されていない。原稿・コード・workflow定義の問題ではない。

証跡: `.verification/ken70/logs/09-pr-run-billing-failure.out`、`05-first-main-run-billing-failure.out`。

### 3.2 切り分け

本環境固有の要因と、リポジトリ側の要因を分けて確認した。

| 確認 | 方法 | 結果 |
|---|---|---|
| workflowの構文 | `gh workflow list --all` | 3件ともactiveで一覧に出る。GitHubが解析できている |
| `ci.yml` の解析 | `gh workflow view ci.yml` | ジョブ構成が読める |
| `extended-ci.yml` の解析 | `gh workflow view extended-ci.yml` | 同上 |
| `pages.yml` の解析 | `gh workflow view pages.yml` | 同上。`vars.PAGES_ENABLED` を追加した版でも解析できる |
| lockfileの整合 | クリーンなクローンで `pnpm install --frozen-lockfile` | `Already up to date`、終了コード0 |
| 原稿・設定の検証 | クリーンなクローンで `pnpm run check:handbook` | 終了コード0 |

ローカルのNode.jsは v26.7.0 であり、保証対象の 24.18.0 と異なる。pnpmは全workspaceに対して `[WARN] Unsupported engine` を出すが、これは警告であって検証の失敗ではない。CIは `.node-version`（`24.18.0`）で `actions/setup-node` を通すため、この差は再現しない。

証跡: `.verification/ken70/logs/10-workflow-syntax-check.out`、`03-clean-clone-simulation.out`。

### 3.3 マージ

**PR #1 はマージできていない。** `gh pr merge 1 --merge` が本作業環境の権限制御で拒否された。GitHubの応答ではない。迂回は試みていない。

したがって、`main` 上での `Required CI gate` の成功確認も未実施である。`main` にはPR前の初期コミット `a1e0b05` だけがある。

マージは次の1コマンドで完了する。

```bash
gh pr merge 1 --merge --repo kenten10/web-application-development-handbook
```

## 4. extended CI

`workflow_dispatch` で手動実行した。

- run URL: https://github.com/kenten10/web-application-development-handbook/actions/runs/33306404904
- 結果: failure。2ジョブとも同じ課金設定のannotationで起動しなかった

| ジョブ | 結果 |
|---|---|
| Manual and external-service inventory | failure（起動せず） |
| Linux, Docker and shell syntax | failure（起動せず） |

代替として、同じスクリプトをローカルで実行した。

```
$ node scripts/ci-extended-checks.mjs inventory
Manual/external-service exercises: 3
- 2.4: OpenSSL/TLS — 課題2.4: HTTP/1.1 vs HTTP/2 の体感ベンチマーク (★★★)
- 3.3: OpenSSL/TLS — 課題3.3: 自己署名証明書でHTTPSサーバを立てる (★★)
- 3.4: OpenSSL/TLS — 課題3.4: TLS handshake を可視化 (★★★)
exit=0

$ node scripts/ci-extended-checks.mjs shell-syntax
Shell syntax passed: 34
exit=0
```

Linux・Docker環境の記録に相当する情報も採取した（Darwin 25.6.0 arm64 / Docker 29.7.2）。ただしこれはmacOSでの実行であり、workflowが記録するUbuntu 24.04の値ではない。

証跡: `.verification/ken70/logs/11-extended-ci-dispatch.out`。

## 5. 失敗時に章番号と失敗タスクが識別できることの確認

### 5.1 確認方法

意図的に1章だけ失敗する状態を作り、CIのmatrixジョブが実行するのと同一のコマンドを走らせて出力を確認し、確認後に元へ戻した。

1. 変更前に `node scripts/ci-chapter.mjs ch07` が4タスクとも成功することを確認した。
2. `code/ch07/redux.solution.ts` の末尾へ型エラーを1行加えた。

```ts
const ken70Deliberate: number = "KEN-70";
```

3. 同じコマンドを実行した。
4. 追加行を取り除き、`git status --short code/ch07` が空であること、`node scripts/ci-chapter.mjs ch07` が再び `[ch07] 4 task(s) passed.` を返すことを確認した。生成された `code/ch07/dist` は `node scripts/clean-build-artifacts.mjs` で除去した。

### 5.2 結果

手順3の出力（抜粋）。

```
::group::ch07 / lint
Exercise validation passed
::endgroup::
::group::ch07 / typecheck
redux.solution.ts(52,7): error TS2322: Type 'string' is not assignable to type 'number'.
Exit status 2
::endgroup::
::group::ch07 / test
ℹ tests 3  ℹ pass 3  ℹ fail 0
::endgroup::
::group::ch07 / build
redux.solution.ts(52,7): error TS2322: Type 'string' is not assignable to type 'number'.
Exit status 2
::endgroup::
::error title=ch07 / typecheck failed::exit=2
::error title=ch07 / build failed::exit=2
[ch07] 2 task(s) failed.
```

識別できる根拠は4つある。

| 手段 | 出力 | どこに出るか |
|---|---|---|
| ジョブ名 | `ch07 / lint · typecheck · test · build` | ジョブ一覧、PRのチェック欄 |
| ログのグループ | `::group::ch07 / typecheck` | ジョブログ（折りたたみ可能） |
| annotation | `::error title=ch07 / typecheck failed::exit=2` | PRのチェック欄、ジョブSummary |
| 集約 | `[ch07] 2 task(s) failed.` | ジョブログ末尾 |

`lint` と `test` は失敗せず最後まで走った。章内でタスクを打ち切らないため、1回の実行で失敗タスクをすべて把握できる。`ci.yml` の `fail-fast: false` により、章をまたいでも同じことが成り立つ。

`::error title=…::` は GitHub Actions のworkflow commandであり、GitHubがこれをannotationとして解釈する。ローカル実行で同じ文字列が出ている以上、Actionsが起動さえすればPRのチェック欄に表示される。

証跡: `.verification/ken70/logs/07-failure-identification-demo.out`（実行前・失敗時・復元後の全出力）。

## 6. `main` 上の `Required CI gate`

**未確認。** 理由は2つある。

1. PR #1 をマージできていない（3.3）。
2. マージできたとしても、`main` へのpushで起動するジョブは同じ課金設定で失敗する。実際、初期コミット `a1e0b05` のpushで起動した `main` の run は同じannotationで失敗している（run 33305824229）。

課金設定が解消したあとの確認手順は次のとおりである。

```bash
gh pr merge 1 --merge --repo kenten10/web-application-development-handbook
gh run list --workflow ci.yml --branch main --limit 1
gh run view <run-id> --json jobs --jq '.jobs[] | select(.name=="Required CI gate") | {name, conclusion}'
```

## 7. ruleset / branch protection

### 7.1 設定できなかった

rulesetとclassic branch protectionの両方を試み、どちらもGitHubが403を返した。

```
$ gh api --method POST repos/kenten10/web-application-development-handbook/rulesets \
    --input .github/rulesets/main-required-ci.json
{"message":"Upgrade to GitHub Pro or make this repository public to enable this feature.",
 "documentation_url":"https://docs.github.com/rest/repos/rules#create-a-repository-ruleset",
 "status":"403"}

$ gh api --method PUT repos/kenten10/web-application-development-handbook/branches/main/protection \
    --input <payload>
{"message":"Upgrade to GitHub Pro or make this repository public to enable this feature.",
 "documentation_url":"https://docs.github.com/rest/branches/branch-protection#update-branch-protection",
 "status":"403"}
```

読み出しAPIも同じ403を返すため、「設定が反映されていることを読み出して確認する」ところまで到達していない。

無料プランでbranch protectionを使えるのは公開リポジトリだけである。本タスクではリポジトリを公開しない前提で承認を得ているため、公開への変更は行っていない。

証跡: `.verification/ken70/logs/13-ruleset-attempt.out`。

### 7.2 設定内容は正本として固定した

`.github/rulesets/main-required-ci.json` を追加した。プランの条件を満たした時点で1コマンドで適用できる。

```json
{
  "name": "main required CI",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "bypass_actors": [
    { "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "always" }
  ],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "pull_request", "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false,
        "allowed_merge_methods": ["merge", "squash", "rebase"] } },
    { "type": "required_status_checks", "parameters": {
        "strict_required_status_checks_policy": true,
        "do_not_enforce_on_create": false,
        "required_status_checks": [ { "context": "Required CI gate" } ] } }
  ]
}
```

設計上の判断を3つ記す。

- **必須チェックは `Required CI gate` の1つだけにした。** このジョブが `handbook`・`chapter`（30章）・`service-containers` の結果を集約する。matrixの章数が変わってもrulesetを触らなくてよい。
- **必要承認数を0にした。** 単著のリポジトリで1にすると、自分のPull Requestを承認できず何もマージできなくなる。人数が増えた時点で引き上げる。
- **`bypass_actors` はRepository admin（`actor_id: 5`）だけにした。** 今回のようにActionsが動かない障害時に、管理者が `gh pr merge --admin` で明示的に迂回できるようにするためである。

`config/ci-plan.json` の `policy.requiredStatusCheck` を正本とし、`scripts/validate-ci.mjs` が同名のジョブが `ci.yml` に存在することを検査する。ジョブ名を変えるとrulesetの必須チェックが永久に保留になるため、両者がずれたらCIが落ちる。

### 7.3 スクリーンショットの代替

issueの完了条件は「branch protection/rulesetの設定画面スクリーンショットを添付」である。**本作業はCLI環境で行っており、スクリーンショットを取得できない。** 代替として `gh api` の要求と応答を全文 `.verification/ken70/logs/13-ruleset-attempt.out` へ記録した。

現時点では設定が存在しないため、記録は403応答である。設定後は次を実行して出力を証跡へ追加する。

```bash
gh api repos/kenten10/web-application-development-handbook/rulesets --jq '.[] | {id, name, enforcement}'
gh api repos/kenten10/web-application-development-handbook/rulesets/<id>
```

## 8. `pnpm install --frozen-lockfile`

**使われている。** `.github/workflows/ci.yml` の2箇所（`handbook` ジョブと `chapter` ジョブ）を `--no-frozen-lockfile` から変更した。

```yaml
      - name: Install workspace dependencies
        run: pnpm install --frozen-lockfile --prefer-offline
```

### 8.1 lockfileの整合確認

`pnpm-lock.yaml` はKEN-65（8月20日）に生成されたものである。その後の多数のissueで `package.json` の scripts が追加されているが、**依存関係は変わっていない**（追加はすべて `node scripts/*.mjs` を呼ぶスクリプトであり、パッケージの追加を伴わない）。

2通りで確認した。

```bash
# 1. 作業ツリーで
$ pnpm install --frozen-lockfile --lockfile-only
Scope: all 31 workspace projects
Already up to date

# 2. コミット済み内容だけのクリーンなクローンで
$ git clone <repo> /tmp/clone-test && cd /tmp/clone-test
$ pnpm install --frozen-lockfile
Done in 1.9s using pnpm v11.15.1
INSTALL_EXIT=0
$ pnpm run check:handbook
CHECK_EXIT=0
```

lockfileが `package.json` と食い違っていれば `--frozen-lockfile` は `ERR_PNPM_OUTDATED_LOCKFILE` で失敗する。成功しているので整合している。

### 8.2 検査の自動化

`config/ci-plan.json` へ `policy.frozenLockfile: true` を追加し、`scripts/validate-ci.mjs` が次を検査するようにした。

- `pnpm-lock.yaml` が存在すること
- 必須workflowの `pnpm install` がすべて `--frozen-lockfile` を伴うこと
- 必須workflowに `--no-frozen-lockfile` が残っていないこと

回帰テストを2件追加した（`non-frozen lockfile install is detected`、`missing lockfile is detected`）。将来 `--no-frozen-lockfile` へ戻されたらCIが落ちる。

証跡: `.verification/ken70/logs/03-clean-clone-simulation.out`。

## 9. KEN-62から引き継いだ4項目

### 9.1 Pages用actionのcommit SHA

**5つのactionすべてについて、tagが指すcommit SHAをGitHubのAPIで実際に確認した。すべて一致した。修正は不要だった。**

| action | 固定tag | 固定SHA | tagの実SHA | 判定 | 最新release |
|---|---|---|---|---|---|
| `actions/checkout` | v7.0.1 | `3d3c42e5…ba90b1` | 同一 | OK | v7.0.1 |
| `actions/setup-node` | v7.0.0 | `82076278…fe5020` | 同一 | OK | v7.0.0 |
| `actions/cache` | v5.0.5 | `27d5ce7f…3ab90386fccae` | 同一 | OK | v6.1.0 |
| `actions/upload-pages-artifact` | v3.0.1 | `56afc609…b719fa` | 同一 | OK | v5.0.0 |
| `actions/deploy-pages` | v4.0.5 | `d6db9016…c0c03e` | 同一 | OK | v5.0.0 |

KEN-62がネットワーク非接続で固定した2つのSHAは正しかった。workflowのコメントを「KEN-70でSHAを確認して再固定する」から「KEN-70でtagが指すcommit SHAを確認済み」へ書き換えた。

`actions/cache`・`upload-pages-artifact`・`deploy-pages` にはより新しいメジャー版がある。本タスクの範囲は「固定したSHAが実在するかの確認」であり、更新は挙動変更を伴うため行っていない。更新はv1.1以降の候補とする。

証跡: `.verification/ken70/logs/00-action-sha-verification.out`。

### 9.2 `site.repoLinkBase`

`config/release.json` へ確定したリポジトリURLを設定した。

```json
"repoLinkBase": "https://github.com/kenten10/web-application-development-handbook/blob/main",
```

`pnpm run build:site` を再実行し、「サイトへ含めないリポジトリ内パスへのリンク33件」のWARNが解消したことを確認した。`pnpm run build:site:check` も通る（決定性維持）。`pnpm run validate:release-policy` は ERROR 0 / WARN 0。

### 9.3 `config/ci-plan.json` へPages workflowを登録

`policy` へ次を追加した。

```json
"pagesWorkflow": ".github/workflows/pages.yml",
"pagesWorkflowRequired": false,
"pagesWorkflowNote": "公開の失敗が原稿検証の結果を巻き込まないよう、必須ゲートへは含めない。…",
"frozenLockfile": true,
"repository": "kenten10/web-application-development-handbook",
"protectedBranch": "main",
"requiredStatusCheck": "Required CI gate"
```

`scripts/validate-ci.mjs` の検査を拡張した。

- action固定SHAの検査対象を、正規表現 `actions/(checkout|setup-node|cache)` から任意の `owner/repo` へ広げた。既知のactionは期待SHAとの一致を、未知のactionは40桁hexであることを検査する。
- 既知SHAの表へ `actions/upload-pages-artifact` と `actions/deploy-pages` を追加した。
- `pages.yml` を検査対象workflowへ加えた（`permissions: contents: read`、必須action4件の存在、SHA固定）。
- `pagesWorkflowRequired: false` のとき、必須workflowが `build-site.mjs` を実行していないこと、および配信が `vars.PAGES_ENABLED == 'true'` で制御されていることを検査する。
- `requiredStatusCheck` と同名のジョブが `ci.yml` に存在することを検査する。

`scripts/validate-ci.test.mjs` へ回帰テストを6件追加した（合計12件、全件成功）。

- `unpinned pages action is detected`
- `missing pages workflow is detected`
- `ungated pages deployment is detected`
- `non-frozen lockfile install is detected`
- `missing lockfile is detected`
- `missing required status check job is detected`

`pnpm run validate:ci` の出力に、検査対象workflowとlockfile方針、必須チェック名を表示するようにした。

```
CI chapters: 30
Required tasks: lint, typecheck, test, build
Service containers: postgres, redis
Workflows: ci.yml, extended-ci.yml, pages.yml
Frozen lockfile: yes
Required status check: Required CI gate
CI validation passed: 0 warning(s)
```

### 9.4 Pagesの扱い

**`main` で配信ジョブを実行させない判断をした。**

理由。非公開リポジトリの無料プランではGitHub Pagesを利用できない。Pagesを有効化しないまま `actions/deploy-pages` を動かすとPages APIで失敗し、原稿の検証結果と関係のない赤い実行履歴が `main` に残り続ける。「常に赤いworkflow」は、本当の失敗を見落とす原因になる。

止め方は **配信ステップの実行条件** であって、検査の削除ではない。

| ジョブ・step | 実行条件 |
|---|---|
| Build static site（生成 + `--check` 決定性検証） | 常に実行する |
| Upload Pages artifact | `github.event_name != 'pull_request'` かつ `vars.PAGES_ENABLED == 'true'` |
| Deploy to GitHub Pages | 同上 |

生成と決定性検証はPull Requestでも `main` でも常に走る。サイト生成の退行はPRの時点で検出できる。ジョブを必須から外したのでも、検査基準を緩めたのでもない。

公開へ切り替えたときの手順を `CI.md` 第5.2節へ記録した。

1. リポジトリをpublicへ変更する。
2. Settings > Pages で Source を GitHub Actions にする。
3. `gh variable set PAGES_ENABLED --body true --repo kenten10/web-application-development-handbook`
4. `main` で `Handbook Pages` を手動実行し、`Deploy to GitHub Pages` の成功と公開URLを確認する。
5. 公開URLを `README.md` と `RELEASE_POLICY.md` 第1.4節へ記載する。
6. `config/release.json` の `site.repoLinkBase` が公開後のURLと一致していることを確認する。

同じ内容を `RELEASE_POLICY.md` 第1.4節へも記録した。

**構文検査は実施した。**

```
$ gh workflow list --all
Handbook CI            active  345821342
Handbook Extended CI   active  345821343
Handbook Pages         active  345821344

$ gh workflow view pages.yml
Handbook Pages - pages.yml
ID: 345821344
```

GitHubがworkflowを解析できた場合にだけworkflowは一覧へ現れる。`vars.PAGES_ENABLED` を追加した版でも `active` で一覧に出ており、式を含めて解析できている。あわせて `validate:ci` と `validate:release-policy` が `pages.yml` の構造（permissions、SHA固定、必須step）を検査している。

証跡: `.verification/ken70/logs/10-workflow-syntax-check.out`。

## 10. 変更・新規作成したファイル

### 新規作成

| ファイル | 内容 |
|---|---|
| `.github/rulesets/main-required-ci.json` | `main` のruleset定義の正本 |
| `reports/KEN70_GITHUB_CI_REPORT.md` | 本レポート |
| `.verification/ken70/logs/00-action-sha-verification.out` | action固定SHAの実在確認 |
| `.verification/ken70/logs/00-baseline-check-handbook.out` | 着手前の `check:handbook`（退行判定の基準） |
| `.verification/ken70/logs/01-repo-create.out` | リポジトリ作成 |
| `.verification/ken70/logs/02-repo-visibility.out` | privateであることの確認 |
| `.verification/ken70/logs/03-clean-clone-simulation.out` | クリーンなクローンでの `--frozen-lockfile` と `check:handbook` |
| `.verification/ken70/logs/04-push-main.out` | `main` のpush |
| `.verification/ken70/logs/05-first-main-run-billing-failure.out` | `main` の初回run（課金設定で起動せず） |
| `.verification/ken70/logs/06-check-handbook-after-changes.out` | 変更後の `check:handbook` 全出力 |
| `.verification/ken70/logs/07-failure-identification-demo.out` | 失敗時の識別確認（実行前・失敗時・復元後） |
| `.verification/ken70/logs/08-pr-create.out` | PR作成 |
| `.verification/ken70/logs/09-pr-run-billing-failure.out` | PRのrun結果とannotation |
| `.verification/ken70/logs/10-workflow-syntax-check.out` | workflow構文検査 |
| `.verification/ken70/logs/11-extended-ci-dispatch.out` | extended CIの手動実行とローカル代替 |
| `.verification/ken70/logs/13-ruleset-attempt.out` | ruleset / branch protectionの設定試行 |
| `.verification/ken70/logs/14-final-validation.out` | 最終検証（6コマンド） |
| `.verification/ken70/logs/15-final-check-handbook.out` | レポート作成後の `check:handbook` 全出力 |

### 変更

| ファイル | 変更内容 |
|---|---|
| `.gitignore` | `.verification/certs/` を除外。`.verification/**/*.log` の除外を打ち消し |
| `.github/workflows/ci.yml` | `--no-frozen-lockfile` → `--frozen-lockfile`（2箇所） |
| `.github/workflows/pages.yml` | 配信を `vars.PAGES_ENABLED == 'true'` で制御。SHA確認済みの旨へコメント更新 |
| `config/ci-plan.json` | `policy` へ7項目を追加（pages workflow、lockfile方針、必須チェック名ほか） |
| `config/release.json` | `site.repoLinkBase` を確定URLへ設定。注記を更新 |
| `scripts/validate-ci.mjs` | pages workflow検査、任意actionのSHA固定検査、lockfile方針検査、必須チェック名の実在検査 |
| `scripts/validate-ci.test.mjs` | 回帰テスト6件追加（6件 → 12件） |
| `CI.md` | 第4節を全面改稿。第5.1〜5.3節を新設。第7・8・9節を新設 |
| `RELEASE_POLICY.md` | 第1.4節へリポジトリ確定と配信を止めている理由を追記 |
| `README.md` | 公開形式の表へリポジトリ名。CI節へlockfileとrulesetを追記 |

## 11. 実行した検証コマンドと結果

### 11.1 issueが指定した4コマンド

| コマンド | 終了コード | ERROR | WARN |
|---|---|---|---|
| `pnpm run validate:ci` | 0 | 0 | 0 |
| `pnpm run validate:release-policy` | 0 | 0 | 0 |
| `pnpm run validate:handbook` | 0 | 0 | 0 |
| `pnpm run check:handbook` | 0 | 0 | 0 |

`check:handbook` は7つのバリデータを連鎖実行する。その全出力に対して、`ERROR` で始まる行が0件、`WARN:` で始まる行が0件、`- errors: 0` が7件、`- warnings: 0` が7件であることを確認した。

### 11.2 あわせて確認したもの

| コマンド | 結果 |
|---|---|
| `pnpm run validate:style` | 終了コード0、ERROR 0 / WARN 0 |
| `pnpm run validate:links` | 終了コード0、ERROR 0 / WARN 0 |
| `pnpm run test:ci` | 12件中12件成功、fail 0 |
| `pnpm run build:site` / `build:site:check` | 終了コード0、決定性維持 |
| `node scripts/ci-chapter.mjs ch07` | `[ch07] 4 task(s) passed.` |
| `node scripts/ci-extended-checks.mjs inventory` | 終了コード0 |
| `node scripts/ci-extended-checks.mjs shell-syntax` | `Shell syntax passed: 34` |
| `pnpm install --frozen-lockfile`（クリーンなクローン） | 終了コード0 |
| `pnpm run check:handbook`（クリーンなクローン） | 終了コード0 |

**退行はない。** 着手前のベースライン（`00-baseline-check-handbook.out`、`check:handbook` 終了コード0）と同じ状態を保っている。KEN-59・KEN-61が達成したERROR 0 / WARN 0を崩していない。

なお、ローカルのNode.jsが v26.7.0 であるため、pnpmは全workspaceに対して `[WARN] Unsupported engine: wanted: {"node":">=24.18.0 <25"}` を出す。これは本環境固有であり、バリデータのWARN件数には含まれない。CIは `.node-version` により 24.18.0 で実行される。

証跡: `.verification/ken70/logs/14-final-validation.out`。

## 12. 完了条件8つの達成状況

| # | 完了条件 | 状況 | 根拠 |
|---|---|---|---|
| 1 | PR URLを本タスクへ記録 | **達成** | https://github.com/kenten10/web-application-development-handbook/pull/1。本レポート第3節 |
| 2 | PR上で全必須ジョブが成功 | **未達** | ジョブが起動しない。原因はアカウントの課金設定で、workflow・原稿の不備ではない。切り分けの根拠は第3.2節。同じ検査をローカルで実行し全件成功（第11節） |
| 3 | 失敗時に章番号と失敗タスクが識別できることを確認 | **達成** | 意図的な失敗を作って `::error title=ch07 / typecheck failed::exit=2` と `[ch07] 2 task(s) failed.` を確認し、元へ戻した。第5節、`07-failure-identification-demo.out` |
| 4 | main上でも `Required CI gate` が成功 | **未達** | PRをマージできておらず（環境の権限制御）、マージできても#2と同じ理由で起動しない。第6節 |
| 5 | extended CIの実行結果を記録 | **達成（結果はfailure）** | run URL とannotationを記録。ローカルでの代替実行結果も記録。第4節 |
| 6 | `pnpm install --frozen-lockfile` が使用されている | **達成** | `ci.yml` の2箇所を変更。lockfileの整合をクリーンなクローンで確認。`validate:ci` が退行を検査する。第8節 |
| 7 | branch protection/rulesetの設定画面スクリーンショットを添付 | **未達（代替を記録）** | 無料プランの非公開リポジトリでは403。CLI環境のためスクリーンショットは取得できない。**代替として `gh api` の要求と応答を全文記録した**（`13-ruleset-attempt.out`）。適用する定義は `.github/rulesets/main-required-ci.json` に固定。第7節 |
| 8 | Actions run URLを添付 | **達成** | main push: `/actions/runs/33305824229`、`/actions/runs/33305824248`。PR: `/actions/runs/33306365938`、`/actions/runs/33306365936`。extended: `/actions/runs/33306404904` |

達成4件、未達4件。未達4件のうち3件（#2・#4・#7）は同じ根――GitHubアカウントのプランと課金設定――に帰着する。残る1件（#4の前半）は本作業環境の権限制御である。

## 13. 積み残し・ブロッカー

### 13.1 GitHub Actionsの実行枠（最優先）

非公開リポジトリでのActions実行が課金設定で止まっている。

```
The job was not started because recent account payments have failed
or your spending limit needs to be increased.
```

対処。Settings > Billing & plans で支払い方法とspending limitを確認する。あるいはリポジトリを公開すれば、GitHub-hosted runnerの実行時間は無料になる。

解消後にやること。

```bash
gh pr merge 1 --merge --repo kenten10/web-application-development-handbook
gh run list --workflow ci.yml --branch main --limit 1
gh workflow run extended-ci.yml --ref main
```

`Required CI gate` の成功を確認し、run URLを本issueへ記録する。

### 13.2 rulesetの適用

無料プランの非公開リポジトリでは設定できない。リポジトリを公開するかGitHub Proへ切り替えたあと、次で適用する。

```bash
gh api --method POST repos/kenten10/web-application-development-handbook/rulesets \
  --input .github/rulesets/main-required-ci.json
gh api repos/kenten10/web-application-development-handbook/rulesets/<id>
```

読み出したJSONを `.verification/ken70/logs/` へ追加する。

### 13.3 PR #1 のマージ

`gh pr merge` が本作業環境の権限制御で拒否された。迂回は行っていない。ユーザーまたは別の実行環境からマージする必要がある。

### 13.4 GitHub Pagesの公開

リポジトリが非公開である間は配信できない。手順は `CI.md` 第5.2節にある。KEN-63（v1.0公開）で、リポジトリの公開範囲を決めるタイミングと合わせて実施するのが自然である。

### 13.5 KEN-63へ引き継ぐこと

- 公開URLが確定したら `README.md` と `RELEASE_POLICY.md` 第1.4節へ記載する（`RELEASE_POLICY.md` 第7.4節のタグ付け手順7）。
- `config/release.json` の `state` を `pending` から `released` へ切り替える。
- タグ `v1.0.0` の作成とRelease公開は本タスクの範囲外としたため、未実施である。

### 13.6 actionのメジャー版更新

`actions/cache`（固定 v5.0.5 / 最新 v6.1.0）、`actions/upload-pages-artifact`（v3.0.1 / v5.0.0）、`actions/deploy-pages`（v4.0.5 / v5.0.0）に新しいメジャー版がある。固定SHAは正しいため本タスクでは更新していない。挙動変更を伴うため、CIが実際に動く状態になってから1つずつ更新するのが安全である。v1.1以降の候補とする。
