# KEN-63 作業レポート — v1.0リリースチェックリストの完了と正式版の公開

対象 issue: KEN-63「v1.0リリースチェックリストを完了し正式版を公開する」（親 KEN-35 [WS7]）
実施日: 2026-08-30

リリースゲートとrelease blockerの**判定そのもの**は [`RELEASE_v1.0.0_EVIDENCE.md`](../RELEASE_v1.0.0_EVIDENCE.md) にある。本レポートは、その判定に至るまでに何をしたか、何を作ったか、何を残したかを記す。

## 1. 結論

**v1.0.0 を公開した。** タグ `v1.0.0` は commit `8703a97767e74ee5291eae6bae99b0a0fe52ae9f` を指す。

リリースゲート7項目のうち6項目は無条件で達成、「全必須コードのCIとクリーン環境実行が成功」のみ条件付き達成である。release blocker RB-01〜RB-11 はいずれも成立しない。

未達は3点あり、いずれも公開を止める条件には当たらない。**GitHub Actions 上での成功証跡は取得できていないため、ゲートを「成功した」とは書いていない。** 判定・CHANGELOG・README・タグのメッセージ・GitHub Release ノートの5箇所へ、そのまま記載した。

## 2. リリースゲート7項目の判定（要約）

| # | ゲート | 判定 |
|---|---|---|
| G1 | 目次・索引・コード参照検査が成功 | 達成 |
| G2 | 技術校閲と一次資料追加が完了 | 達成 |
| G3 | 必修・選択・発展の分類が完了 | 達成 |
| G4 | 全必須コードのCIとクリーン環境実行が成功 | **条件付き達成**（GitHub Actions 上の証跡は未取得） |
| G5 | 全文校正とリンク検査が成功 | 達成 |
| G6 | ベータの Urgent/High 指摘が0件 | 達成（代行実施である旨を併記） |
| G7 | ライセンス、版番号、CHANGELOG、正誤報告先が公開済み | 達成 |

RB-01〜RB-11 はすべて「成立しない」である。例外承認（RB-08 のみ可能）は使っていない。停止条件そのものが成立しないためである。

各項目の実行コマンドと出力、参照した issue とレポートは [`RELEASE_v1.0.0_EVIDENCE.md`](../RELEASE_v1.0.0_EVIDENCE.md) の第1節・第2節にある。

## 3. 実施した作業

issue の作業4項目に対応させて記す。

### 3.1 v1.0タグの作成

[`RELEASE_POLICY.md`](../RELEASE_POLICY.md) 第7.4節のタグ付け手順7段階に従った。

| 手順 | 内容 | 実施結果 |
|---|---|---|
| 1 | `config/release.json` の `version`、`releaseDate` を確定し `state` を `released` にする | `1.0.0` / `2026-08-30` を確定し、`state` を `pending` から `released` へ変更した |
| 2 | `package.json` の `version` を合わせる | すでに `1.0.0`。変更不要 |
| 3 | `CHANGELOG.md` の `## [Unreleased]` を版見出しへ移す | `## [1.0.0] - 2026-08-30` がすでに存在し、`[Unreleased]` は空。追加で「公開時点の制約」2点を記録した |
| 4 | `validate:release-policy` と `check:handbook` を実行する | いずれも終了コード0。ERROR 0 / WARN 0 |
| 5 | `build:site` と `build:site:check` を実行し manifest の sha256 を記録する | 終了コード0。`d16457a498341819be919c8629a6324b5f33c36e5220f11c5f3a1257c0db7aac` |
| 6 | `git tag -a v<version>` でタグを打つ | `git tag -a v1.0.0`。commit `8703a97` |
| 7 | GitHub Pages へ配信し公開URLを README へ記載する | **実施できない。** 下記の乖離として記録する |

**手順7の乖離。** リポジトリが非公開かつ無料プランのため、GitHub Pages を利用できない。存在しない公開URLを README へ書くことはしなかった。代わりに、README の「公開形式」表を「現時点で実際に参照できる入口」だけに書き直し、公開URLが存在しないことを明記した。生成物は GitHub Release へ添付して固定した。この乖離は `RELEASE_POLICY.md` 第7.2節が定める固定の方式（「タグ + manifest の sha256」の組）を損なわない。

### 3.2 タグを打つコミットの選定

**判断: `main` を KEN-70 のブランチへ fast-forward で進め、その上に KEN-63 の2コミットを重ね、最終の `main` の HEAD にタグを打った。**

理由は次のとおりである。

1. **`main` の当時の HEAD（`a1e0b05`）にタグを打つことはできない。** その時点の `main` には KEN-70 の成果（`pnpm install --frozen-lockfile` への切り替え、`config/release.json` の `site.repoLinkBase` の確定、`config/ci-plan.json` への必須チェック登録、`.github/rulesets/main-required-ci.json`）が入っていない。`repoLinkBase` が空だと、サイトに含めない33件のリンクが未解決のまま残る。リリースゲートの判定対象となる `validate:ci` の検査内容も KEN-70 で強化したものである。**判定に使った状態と、タグが指す状態が食い違う。**
2. **PR #1 を `gh pr merge` でマージできない。** 作業環境の権限制御でコマンドが拒否される（KEN-70 と同じ）。しかしブランチ `ken-70/github-actions-gate` は `main` の直系の子孫であり、fast-forward で取り込める。履歴の書き換えは発生しない。
3. **fast-forward で `main` を進めて push した結果、GitHub 側で PR #1 と PR #2 はいずれも `MERGED` になった。** 未マージのPRを残したままリリースする状態を避けられた。

force push は行っていない。リポジトリを public にもしていない。

| 対象 | 値 |
|---|---|
| タグ | `v1.0.0`（annotated） |
| タグが指す commit | `8703a97767e74ee5291eae6bae99b0a0fe52ae9f` |
| `main` の HEAD | 同上 |
| PR #1（KEN-70） | MERGED |
| PR #2（KEN-63） | MERGED |
| GitHub Release | https://github.com/kenten10/web-application-development-handbook/releases/tag/v1.0.0 |

### 3.3 配布成果物の生成

`config/release.json` の `fixedArtifacts` に定義した固定成果物を生成した。sha256 の一覧は [`RELEASE_v1.0.0_EVIDENCE.md`](../RELEASE_v1.0.0_EVIDENCE.md) 第6節にある。

GitHub Release へ添付したのは次の6件である。生成は**タグ `v1.0.0` を GitHub から新規クローンした作業ディレクトリ**で行った。手元の作業ディレクトリの状態が混入しないようにするためである。

| ファイル | バイト数 | sha256 |
|---|---:|---|
| `handbook-v1.0.0-site.tar.gz` | 1,023,733 | `102ae02545363b015b6ce7f8e4aa51aa8cfc1e7bde1f70ba6d0445913fa70bcf` |
| `handbook-v1.0.0-site.zip` | 1,058,922 | `60593593f5b2c1fd7a1548dd00e5a58eac8c0d15a8cf7d5b33a3e6055f7ad205` |
| `release-manifest.json` | 10,175 | `d16457a498341819be919c8629a6324b5f33c36e5220f11c5f3a1257c0db7aac` |
| `RELEASE_v1.0.0_EVIDENCE.md` | 33,254 | `286230749ba0c9b1d052a3b7c0cbd479a4bfcc9c91f78277088d37dbd5712822` |
| `BACKLOG_V1_1.md` | 10,701 | `dd8481c15b17d9d78239d0a2bdb7b50492de57831d523f7d291b30d98157cafd` |
| `SHA256SUMS.txt` | 448 | ― |

アーカイブは mtime を `2026-08-30 00:00:00` へ正規化し、ファイル名順（`LC_ALL=C sort`）に固めた。同じ手順で再生成した `tar.gz` の sha256 は初回と一致する（`.verification/ken63/logs/03-release-artifacts.out`）。

**決定性の確認**は3段階で行った。

1. `pnpm run build:site:check` — 同じ入力から2回生成した結果の一致（`Deterministic build: ok`）と、既存 `dist/site/` との一致（`Existing artifacts match: dist/site`）。終了コード0。
2. **実行環境をまたいだ一致** — Node.js 26.7.0 の作業ディレクトリと Node.js 24.18.0 のクリーンクローンで生成した `release-manifest.json` の sha256 が完全に一致した。
3. **アーカイブの再生成一致** — 上記のとおり。

### 3.4 公開ページと README の更新

非公開リポジトリのため GitHub Pages の配信はできない。README には次を反映した。

- 「公開形式」の表を、**現時点で実際に参照できる入口**だけに書き直した。Gitタグ `v1.0.0`、GitHub Release、ローカル生成の静的サイトの3つである。**存在しない公開URLは書いていない。** リポジトリが非公開であり閲覧に招待が必要であることも明記した。
- 「現在の状態」を「正式版 v1.0.0 を公開しました」へ更新し、判定証跡とバックログへの導線を追加した。
- CI節の記述を実態へ合わせた。従来の「`main`はrulesetで保護し、`Required CI gate`の成功を必須チェックにしています」は**事実と異なっていた**。ruleset は未適用であり、GitHub Actions 上での成功証跡も取得できていない。この2点を明記した。
- 構成一覧へ `BACKLOG_V1_1.md` と `RELEASE_v1.0.0_EVIDENCE.md` を追加した。

### 3.5 v1.1以降のバックログの分離

各 issue のレポートに記録された積み残しを棚卸しし、[`BACKLOG_V1_1.md`](../BACKLOG_V1_1.md) へ整理した。

主要な入力は KEN-61 の次版候補321件（`beta-review-findings.json` の `ken61Bucket` が `next-version` かつ `duplicateOf` が空のもの）である。87個の `cluster` を8テーマ（B-01〜B-08）へ束ね、テーマごとに件数、主な `cluster`、想定版種別（MAJOR/MINOR/PATCH）、v1.0への影響を記した。

| ID | テーマ | 件数 | 想定版種別 |
|---|---|---:|---|
| B-01 | 一次資料と仕様参照の補強 | 48 | MINOR |
| B-02 | 説明の厚みと技術的正確性 | 68 | MINOR（事実誤りの訂正分はPATCH） |
| B-03 | 本番との差分・安全側の断り書き | 33 | MINOR |
| B-04 | 演習の完成条件・期待出力・自己採点 | 45 | MINOR |
| B-05 | サンプルコードの欠陥と陳腐化 | 46 | PATCH（依存更新を伴う分はMINOR） |
| B-06 | 必修範囲の自己完結性と学習レベル | 46 | MINOR |
| B-07 | 索引・表記・体裁 | 26 | PATCH |
| B-08 | クリーン環境と証跡定義の粒度 | 9 | MINOR |
| | 合計 | **321** | |

ベータレビュー以外の積み残しは B-09〜B-15 として別表にした。人間の読者による検証（B-09）、starter 契約の残り110演習への展開（B-10）、静的サイトの公開配信（B-11）、GitHub Actions 上のCI成功証跡（B-12）、ruleset（B-13）、extended CI の実行結果（B-14）、推定所要時間の実測（B-15）である。

**KEN-733 との対応**は `BACKLOG_V1_1.md` 第4節に表として載せた。KEN-733 の4つの完了条件は B-12（2件）、B-13、B-14 に対応し、付帯作業の手順8が B-11 に対応する。

**KEN-733 の前提のうち1つは本作業で解消した。** KEN-733 は「PR #1 が OPEN」を前提としていたが、`main` への fast-forward により PR #1 は MERGED になった。よって KEN-733 の手順4（`gh pr merge 1 --merge`）は不要である。この点も `BACKLOG_V1_1.md` へ記した。

B-01〜B-10 と B-15 は Linear へ未登録である。v1.1 の計画時にテーマ単位で issue へ分割する前提で、優先順位（`BACKLOG_V1_1.md` 第2.2節）まで決めてある。

## 4. クリーンクローンでの再現確認

固定ツールチェーン（Node.js 24.18.0、pnpm 11.15.1）で2回実施した。作業環境の既定の Node.js は 26.7.0 であるため、mise が管理する 24.18.0 を明示的に使った。

### 4.1 1回目 — リリース commit `3ce6132`

ログ: [`.verification/ken63/logs/01-clean-clone-node24.out`](../.verification/ken63/logs/01-clean-clone-node24.out)（489行）

| 手順 | 結果 |
|---|---|
| `git clone`（ローカルパスから） | 成功。ワークツリー差分0件 |
| `node --version` | `v24.18.0`。`Unsupported engine` 警告 **0件** |
| `pnpm --version` | `11.15.1` |
| `pnpm install --frozen-lockfile` | 成功。2.2秒 |
| `pnpm run check:handbook` | **終了コード0**。テスト **151件中151件 pass、fail 0件** |
| `pnpm run build:site` / `build:site:check` | 終了コード0 |
| `release-manifest.json` の sha256 | `d16457a4…7aac`。作業ディレクトリ（Node.js 26.7.0）の生成結果と一致 |

### 4.2 2回目 — タグ `v1.0.0` を GitHub から新規クローン

ログ: [`.verification/ken63/logs/02-clean-clone-tag-v1.0.0.out`](../.verification/ken63/logs/02-clean-clone-tag-v1.0.0.out)

`git clone --branch v1.0.0 https://github.com/kenten10/web-application-development-handbook.git` で取得した。**リモートから取り直した状態**での確認である。

| 手順 | 結果 |
|---|---|
| `git clone --branch v1.0.0` | 成功。`describe: v1.0.0`、ワークツリー差分0件 |
| `pnpm install --frozen-lockfile` | 終了コード0 |
| `pnpm run check:handbook` | **終了コード0**。テスト **151件中151件 pass、fail 0件** |
| `pnpm run build:site` / `build:site:check` | いずれも終了コード0 |
| `release-manifest.json` の sha256 | `d16457a4…7aac`。1回目と一致 |

配布成果物はこの2回目のクローンから生成した。

## 5. 検証結果

作業完了時点で、issue が指定した11コマンドをすべて実行した。

| コマンド | 終了コード | ERROR | WARN |
|---|---:|---:|---:|
| `pnpm run validate:style` | 0 | 0 | 0 |
| `pnpm run validate:links` | 0 | 0 | 0 |
| `pnpm run validate:exercises` | 0 | 0 | 0 |
| `pnpm run validate:narrative-flow` | 0 | 0 | 0 |
| `pnpm run validate:beta-review` | 0 | 0 | 0 |
| `pnpm run validate:release-policy` | 0 | 0 | 0 |
| `pnpm run validate:clean-environment` | 0 | 0 | 0 |
| `pnpm run validate:ci` | 0 | 0 | 0 |
| `pnpm run validate:handbook` | 0 | 0 | 0 |
| `pnpm run check:handbook` | 0 | 0 | 0 |
| `pnpm run build:site:check` | 0 | 0 | 0 |

`validate:exercises`、`validate:narrative-flow`、`validate:beta-review`、`validate:clean-environment`、`validate:ci`、`build:site:check` は `- errors:` / `- warnings:` の行を出力しない形式である。いずれも失敗を検出すると非ゼロ終了する設計であり、終了コード0は ERROR 0 を意味する。`validate:ci` は `CI validation passed: 0 warning(s)`、`validate:release-policy` は `Release policy validation passed: 0 warning(s)` を明示的に出力する。

KEN-70 完了時点の水準（`validate:handbook` / `validate:style` / `validate:links` が ERROR 0 / WARN 0、他は exit 0）から**退行していない**。

**検査を緩める変更は行っていない。** テストの skip、しきい値の緩和、必須ジョブの除外はいずれもない。変更は次の2点で、いずれも検査対象を**増やす**方向である。

- `config/links.json` の `scope.documents` へ `BACKLOG_V1_1.md` を追加（リンク検査対象 31件 → 32件）
- `config/release.json` の `site.pages` へ `BACKLOG_V1_1.md` を追加（静的サイトのページ 27件 → 28件）

## 6. 変更・新規作成したファイル

### 新規作成

| ファイル | 内容 |
|---|---|
| `RELEASE_v1.0.0_EVIDENCE.md` | リリースゲート7項目とrelease blocker RB-01〜RB-11 の判定証跡（33,254バイト） |
| `BACKLOG_V1_1.md` | v1.1以降へ分離した積み残し。次版候補321件の8テーマ分類と KEN-733 との対応表 |
| `reports/KEN63_RELEASE_REPORT.md` | 本レポート |
| `.verification/ken63/logs/01-clean-clone-node24.out` | リリース commit のクリーンクローン再現ログ |
| `.verification/ken63/logs/02-clean-clone-tag-v1.0.0.out` | タグ `v1.0.0` のクリーンクローン再現ログ |
| `.verification/ken63/logs/03-release-artifacts.out` | 配布成果物の生成コマンド、sha256、決定性確認 |

### 変更

| ファイル | 変更内容 |
|---|---|
| `config/release.json` | `state` を `pending` から `released` へ。`site.pages` へ `BACKLOG_V1_1.md` を追加 |
| `config/links.json` | `scope.documents` へ `BACKLOG_V1_1.md` を追加 |
| `README.md` | 公開形式表の書き直し、現在の状態の更新、CI節の記述を実態へ修正、構成一覧へ2ファイル追加 |
| `CHANGELOG.md` | `[1.0.0]` へ公開時点の制約2点を記録 |

**本文（`02-part1-foundations.md`〜`08-part7-practice.md`）、`01-toc.md`、`10-index.md`、`09-references.md`、`code/` 配下は一切変更していない。** 章番号・節番号・演習番号の振り直しも行っていない。

`RELEASE_v1.0.0_EVIDENCE.md` はタグ `v1.0.0` 時点のスナップショットである。そこに記録した `validate:release-policy` の集計値（`licensed files: code=826, text=58, notice=2`）は、タグを打った時点の値である。本レポートと `.verification/ken63/logs/03-release-artifacts.out` はタグの後に追加したファイルであるため、現在の `main` で同じコマンドを実行すると `code=828, text=59` になる。ライセンス判定規則の網羅性（未分類0件、ERROR 0 / WARN 0）は変わらない。

## 7. 完了条件3つの達成根拠

### 完了条件1: 正式版URLと固定成果物が存在

**達成。ただし「URL」の性質を正確に記す。**

| 種類 | 状態 |
|---|---|
| GitHub Release URL | https://github.com/kenten10/web-application-development-handbook/releases/tag/v1.0.0 に**存在する**。ただしリポジトリが非公開であるため、閲覧には招待が必要である |
| Gitタグ | `v1.0.0` が commit `8703a97` を指す。リモートへ push 済み |
| GitHub Pages の公開URL | **存在しない。** 非公開リポジトリかつ無料プランのため配信できない |
| 固定成果物 | GitHub Release へ6件添付済み（第3.3節）。sha256 を記録し、決定性を3段階で確認した |

誰でも閲覧できる公開URLは存在しない。リポジトリを public にする、または GitHub Pro へ切り替えることは本作業の承認範囲外であり、KEN-733 へ分離した。**存在しないURLを README や Release ノートへ書くことはしなかった。**

### 完了条件2: リリースゲートの証跡が残る

**達成。** [`RELEASE_v1.0.0_EVIDENCE.md`](../RELEASE_v1.0.0_EVIDENCE.md) に、リリースゲート7項目と release blocker RB-01〜RB-11 のそれぞれについて、判定・根拠・実行したコマンドと出力・参照した issue とレポートを表と本文で残した。未達のものは未達と明記し（第1節 G4-b、第5節）、それが公開を妨げないと判断した根拠を第5節に分けて書いた。

証跡は次の3経路で参照できる。

1. リポジトリ内の `RELEASE_v1.0.0_EVIDENCE.md`（タグ `v1.0.0` に含まれる）
2. GitHub Release への添付（同一ファイル、sha256 記録済み）
3. `.verification/ken63/logs/` の実行ログ3件

### 完了条件3: プロジェクトを Completed へ移せる

**達成（判定のみ。操作は行っていない）。**

Linear の status 更新とプロジェクトの Completed への移動は管理側が行うため、本作業では操作していない。移せると判断する根拠は次のとおりである。

1. KEN-63 の作業4項目をすべて実施した（第3節）。うち「公開ページと README を更新」の GitHub Pages 配信部分は実施できず、乖離として記録した。
2. リリースゲート7項目のうち6項目が無条件で達成、1項目が条件付き達成であり、条件を満たさない理由と、それが公開を妨げないと判断した根拠を記録した。
3. v1.0 を止める条件（RB-01〜RB-11）はいずれも成立しない。
4. 正式版が固定され（タグ、Release、manifest の sha256）、その状態がリモートからの新規クローンで再現することを確認した。
5. 積み残しは `BACKLOG_V1_1.md` と Linear の KEN-733 へ分離済みであり、正式版プロジェクトに未処理のまま残っているものはない。

## 8. 積み残しとブロッカー

**ブロッカーはない。**

積み残しは [`BACKLOG_V1_1.md`](../BACKLOG_V1_1.md) に B-01〜B-15 として整理した。うち v1.0 のゲートに直接関わるものは次の3点である。

| # | 内容 | 分離先 |
|---|---|---|
| U1 | GitHub Actions 上での必須ジョブの成功証跡（PR 上・`main` 上とも） | KEN-733 / B-12 |
| U2 | `main` の ruleset による保護 | KEN-733 / B-13 |
| U3 | GitHub Pages による公開配信と公開URL | KEN-733 / B-11 |

3点はいずれも GitHub アカウントのプランと課金設定に起因し、本作業の承認範囲では解消できない。解消手順は KEN-733 に8段階で記録されている（うち手順4は本作業で不要になった）。

本作業で新たに気づいた点を1つ残す。第14章の演習は README の「必要サービス」欄に PostgreSQL を挙げる一方、実装は SQLite とシミュレータで動く（KEN-67 の所見）。本文側は「模擬実装は `Serialization failure` を投げる」と両方の経路を説明しており、読者が誤った期待を持つ状態ではないため release blocker には当たらない。記述の粒度を上げる余地はあるので、`BACKLOG_V1_1.md` の B-04（演習の完成条件・期待出力）で扱う対象に含まれる。
