# v1.1以降のバックログ

正式版v1.0（KEN-63）から分離した積み残しの一覧である。v1.0の公開を妨げないことを確認したうえで次版へ送った項目だけを載せる。v1.0を止める条件は [`BETA_REVIEW_PLAN.md`](./BETA_REVIEW_PLAN.md) 第9節のrelease blocker（RB-01〜RB-11）であり、その判定結果は [`RELEASE_v1.0.0_EVIDENCE.md`](./RELEASE_v1.0.0_EVIDENCE.md) にある。

本文の指摘の機械可読な正本は [`beta-review-findings.json`](./beta-review-findings.json) である。本ファイルはそこから棚卸しした結果を、次版の作業単位へ束ね直したものである。件数の正本はJSON側であり、本ファイルはJSONの `ken61Bucket` が `next-version` かつ `duplicateOf` が空の321件を対象とする。

## 1. 全体像

| 出所 | 件数 | 分類 | 追跡先 |
|---|---:|---|---|
| ベータレビューの次版候補（KEN-61） | 321 | B-01〜B-08の8テーマ | 本ファイル第2節 |
| GitHub Actions実行枠とbranch protection（KEN-70） | 4条件 | 環境・運用 | Linear **KEN-733** |
| 人間の読者によるベータレビュー | 1件 | 検証手法 | 本ファイル第3節 B-09 |
| starter契約の未展開分 | 110演習 | 教材整備 | 本ファイル第3節 B-10 |
| 静的サイトの公開配信 | 1件 | 公開形式 | 本ファイル第3節 B-11、Linear **KEN-733** 手順8 |

v1.0のリリースゲートに対する影響は全項目で「なし」である。根拠は各項目の「v1.0への影響」欄に記す。

## 2. ベータレビュー次版候補321件のテーマ分類

321件を原因のまとまり（`cluster`）から8テーマへ束ねた。テーマの境界は「1つの作業単位として同じ判断基準で処理できるか」で決めている。想定する版種別は [`RELEASE_POLICY.md`](./RELEASE_POLICY.md) 第3節の定義に従う。

| ID | テーマ | 件数 | 主な `cluster` | 想定版種別 | v1.0への影響 |
|---|---|---:|---|---|---|
| B-01 | 一次資料と仕様参照の補強 | 48 | `missing-primary-source`、`citation-format-unexplained`、`outdated-spec-version` | MINOR | なし。主張自体は正しく、出典の粗さにとどまる |
| B-02 | 説明の厚みと技術的正確性 | 68 | `explanation-insufficient`、`missing-topic`、`decision-criteria-missing`、`inaccurate-technical-claim` | MINOR（事実誤りの訂正分はPATCH） | なし。記述の骨子は正しく、読者が誤った実装へ導かれる指摘はUrgent/Highとして解消済み |
| B-03 | 本番との差分・安全側の断り書き | 33 | `missing-production-caveat`、`sample-contradicts-own-principle` | MINOR | なし。実行して被害が生じる記述はRB-07の突き合わせでHighへ引き上げて解消済み |
| B-04 | 演習の完成条件・期待出力・自己採点 | 45 | `incomplete-exercise-criteria`、`expected-output-not-reproducible`、`criteria-vs-solution-mismatch` | MINOR | なし。`pnpm run validate:exercises` は成功し、未完成solutionは0件 |
| B-05 | サンプルコードの欠陥と陳腐化 | 46 | `sample-code-defect`、`undefined-identifier-in-sample-code`、`outdated-library-api` | PATCH（依存の更新を伴う分はMINOR） | なし。全30章の `lint`・`typecheck`・`test`・`build` は成功する |
| B-06 | 必修範囲の自己完結性と学習レベル | 46 | `undefined-term-in-required-section`、`required-section-depends-on-nonrequired`、`learning-level-misclassification` | MINOR | なし。RB-02・RB-08はいずれも成立しない |
| B-07 | 索引・表記・体裁 | 26 | `index-metadata-misplaced`、`internal-numbering-inconsistency`、`japanese-text-defect` | PATCH | なし。`validate:handbook` / `validate:style` / `validate:links` はいずれもERROR 0・WARN 0 |
| B-08 | クリーン環境と証跡定義の粒度 | 9 | `clean-env-category-mismatch`、`browser-manual-evidence-path`、`bootstrap-version-gate` | MINOR | なし。RB-06・RB-09の停止条件には当たらない（証跡の定義を細かくする提案である） |

合計321件。

### 2.1 章別の偏り

指摘が集中する章から着手する。上位は第13章26件、第14章23件、第26章22件、第20章21件、第19章20件、第23章20件、第22章16件、横断15件、第17章15件、第4章14件である。

第13章（認証・認可）、第23章（セキュリティ）、第19章・第20章（コンテナ・クラウド）は [`config/release.json`](./config/release.json) の `reviewCycle` で `fast` または `medium` に分類しており、見直し周期の到来と次版の修正をまとめて処理できる。

### 2.2 対応の優先順位

1. **B-05のうち `sample-code-defect` 系** — 読者が写経して動かない箇所であり、学習の手が止まる。PATCH（v1.0.1）で先行して処理する。
2. **B-07** — `ERRATA.md` へ登録して追跡し、PATCHで本文へ反映する。
3. **B-04・B-06** — 演習と必修範囲の自己完結性に関わる。v1.1（MINOR）でまとめて処理する。
4. **B-01・B-02・B-03** — 記述の充実であり、章別の見直し周期に合わせて分割投入する。
5. **B-08** — 証跡定義の粒度は検査スクリプト側の変更を伴うため、B-04と同じ版で処理する。

## 3. ベータレビュー以外の積み残し

| ID | 項目 | 出所 | 内容 | v1.0への影響 | 追跡先 |
|---|---|---|---|---|---|
| B-09 | 人間の読者によるベータレビュー | KEN-61 | v1.0のベータレビューは、本文を事前に読んでいない独立エージェント13体による代行実施である。実利用の文脈、学習動機と離脱、支援技術の実使用、長期的な定着、所要時間の実測は代行できていない | なし。RB-01〜RB-11はいずれも代行実施の結果で判定でき、成立しない | 本ファイル |
| B-10 | starter契約の残り110演習への展開 | KEN-61 | starterからsolutionへの契約検査（`apply:starter-contracts`）を全演習へ広げる | なし。`validate:exercises` は全143演習で成功する | 本ファイル |
| B-11 | 静的サイトの公開配信 | KEN-63 | v1.0.0時点ではリポジトリが非公開かつ無料プランのため、GitHub Pagesの配信を止めていた。**解消済み**（第3.2節） | なし。公開形式の正本はGitリポジトリであり、生成物の固定はタグとmanifestのsha256で行う | Linear **KEN-733** 手順8 |
| B-12 | GitHub Actions上のCI成功証跡 | KEN-70 | v1.0.0時点ではアカウントの課金設定（支払い失敗／spending limit）によりジョブが起動せず、必須ジョブの成功証跡を取得できていなかった。**解消済み**（第3.2節） | **あり（第3.1節）** | Linear **KEN-733** |
| B-13 | `main` のbranch protection / ruleset | KEN-70 | v1.0.0時点では無料プランの非公開リポジトリのためrulesetもclassic branch protectionも403で設定できなかった。適用する定義は [`.github/rulesets/main-required-ci.json`](.github/rulesets/main-required-ci.json) に固定済み。**解消済み**（第3.2節） | なし。必須チェックの定義自体は正本として存在し、`pnpm run validate:ci` が名称の実在を検査する | Linear **KEN-733** |
| B-14 | extended CIのGitHub Actions上での実行結果 | KEN-70 | v1.0.0時点では `workflow_dispatch` で起動したものの、B-12と同じ理由でジョブが失敗していた。**解消済み**（第3.2節） | なし | Linear **KEN-733** |
| B-15 | 推定所要時間の実測 | KEN-61 | 通読時間は実測ではなく分量からの換算値である。RB-08の停止条件（実測が推定の2倍を超える章が3章以上）には当たらない | なし | 本ファイル、B-09と同時に処理する |

### 3.1 B-12の扱い

B-12（GitHub Actions上のCI成功証跡）は、KEN-63のリリースゲート「全必須コードのCIとクリーン環境実行が成功」の一部を構成する。GitHub Actions上での成功は**取得できていない**。

v1.0の公開を止めない理由は次のとおりである。

1. 停止条件の正本はrelease blockerであり、RB-03・RB-04・RB-05・RB-09のいずれも「特定のコマンドが非ゼロ終了する」ことを条件としている。実行基盤をGitHub Actionsに限定していない。
2. CIが実行するコマンドはすべてローカルで終了コード0を確認しており、クリーンなクローンでの `pnpm install --frozen-lockfile` から `pnpm run check:handbook` までを再現している。証跡は [`RELEASE_v1.0.0_EVIDENCE.md`](./RELEASE_v1.0.0_EVIDENCE.md) にある。
3. 失敗の原因はworkflow定義でも原稿でもなく、GitHubアカウントの課金設定である。切り分けの根拠は [`reports/KEN70_GITHUB_CI_REPORT.md`](./reports/KEN70_GITHUB_CI_REPORT.md) 第3.2節にある。

この扱いは [`CHANGELOG.md`](./CHANGELOG.md) と [`RELEASE_v1.0.0_EVIDENCE.md`](./RELEASE_v1.0.0_EVIDENCE.md) にも記載する。KEN-733の完了をもってB-12・B-13・B-14を閉じる。

第3.1節は v1.0.0 を公開した時点の判断の記録であり、そのまま残す。以下の第3.2節が、その後に制約が解けた事実を記す。

### 3.2 B-11〜B-14の解消

2026-08-30、リポジトリを **public** へ切り替えた。これによりB-11・B-12・B-13・B-14の前提だった3つの制約（非公開リポジトリでのActions課金枠、無料プランでのruleset不可、無料プランの非公開リポジトリでのPages不可）がいずれも解消し、4項目とも実施できた。

| ID | 解消の内容 |
|---|---|
| B-12 | `main` の必須ゲートが成功した。33ジョブ（`Manuscript and configuration`、`PostgreSQL and Redis service containers`、ch01〜ch30の30ジョブ、`Required CI gate`）がすべて success、所要 約3分13秒。run: <https://github.com/kenten10/web-application-development-handbook/actions/runs/33315058697> |
| B-14 | extended CI が success（19秒）。run: <https://github.com/kenten10/web-application-development-handbook/actions/runs/33315062824> |
| B-13 | `.github/rulesets/main-required-ci.json` を適用した。ruleset id `21860256`、`enforcement: active`、対象 `~DEFAULT_BRANCH`、ルール4件（`deletion` / `non_fast_forward` / `pull_request` / `required_status_checks`）。設定内容は [`CI.md`](./CI.md) 第8.1節にある |
| B-11 | GitHub Pages の配信を開始した。公開URLは <https://kenten10.github.io/web-application-development-handbook/> である。run: <https://github.com/kenten10/web-application-development-handbook/actions/runs/33315090807> |

これらは [`RELEASE_v1.0.0_EVIDENCE.md`](./RELEASE_v1.0.0_EVIDENCE.md) 第5節の未達項目 U1・U2・U3 に対応する。同ファイルは v1.0.0 のタグ時点の判定記録であるため書き換えず、解消の事実は本節と [`CHANGELOG.md`](./CHANGELOG.md) の `## [Unreleased]` に記録する。版番号は上げない。本文・演習・サンプルコード・検証基準はいずれも変わっていないためである。

## 4. KEN-733との対応

Linear の **KEN-733**「[v1.1/ユーザー実行] GitHub Actions実行枠とbranch protectionを有効化する」が、本ファイルのB-11・B-12・B-13・B-14を担当する。

| 本ファイル | KEN-733の完了条件 | KEN-733の手順 |
|---|---|---|
| B-12 | PR上で全必須ジョブが成功 | 手順2 |
| B-12 | `main` 上でも `Required CI gate` が成功 | 手順4・5 |
| B-14 | extended CIの実行結果を記録 | 手順3 |
| B-13 | rulesetが適用され、`gh api` の読み出しで確認できる | 手順6・7 |
| B-11 | （完了条件外の付帯作業） | 手順8 |

KEN-733の前提にある「PR #1 がOPEN」はKEN-63で解消した。PR #1 のコミットは `main` へ取り込み済みであり、KEN-733の手順4は不要になった。

上表の完了条件は、第3.2節のとおりすべて満たしている。`main` 上での `Required CI gate` の成功、extended CIの実行結果、rulesetの適用、Pagesの配信のいずれも確認済みである。残るのは、Pull Request上で必須ジョブが成功することの確認（手順2）だけである。

B-01〜B-10とB-15はLinearへ未登録である。v1.1の計画時に、第2.2節の優先順位に従ってissueへ分割する。

## 5. このファイルの更新

- 次版候補の件数と分類の正本は [`beta-review-findings.json`](./beta-review-findings.json) である。指摘を処理したら、まずJSON側の `ken61Bucket` と状態を更新する。
- v1.1のissueを起票したら、第2節・第3節の該当行へissue番号を追記する。
- 本文へ反映した項目は [`CHANGELOG.md`](./CHANGELOG.md) の該当版へ移し、正誤に当たるものは [`ERRATA.md`](./ERRATA.md) へIDを登録する。
