# 作業レポート

このディレクトリは、本書の制作過程で作成した**issue単位の作業レポート**と、その根拠となる**検証結果データ**を置く場所である。

- 本文の正本は、リポジトリ直下の `00-front-matter.md`〜`10-index.md` にある。
- 方針・運用の正本は、リポジトリ直下の `README.md`、`RELEASE_POLICY.md`、`CI.md`、`CLEAN_ENVIRONMENT.md` などにある。
- このディレクトリの文書は**記録であり、正本ではない**。作成時点の事実を残すためのものなので、後から本文や方針が変わっても遡って書き換えない。食い違いが生じた場合は、リポジトリ直下の正本が優先する。
- リリースゲートの判定そのものは `RELEASE_v1.0.0_EVIDENCE.md` にあり、その各行がここのレポートを根拠として参照している。

パスの書き方の約束: このディレクトリのレポート内で本文中に書くファイルパスは、**リポジトリルートからの相対パス**（例: `config/release.json`、`reports/data/...`）で記す。Markdownのリンク先だけは、実際に解決できるようファイルからの相対パス（例: `../README.md`）で書く。

## 1. レポート一覧

| ファイル | 対応issue | 内容 |
|---|---|---|
| `KEN48_EXERCISE_REVISION_REPORT.md` | KEN-48 | 章末演習を、読者が自分で採点できる到達基準つきの教材へ改訂した記録 |
| `KEN49_REQUIREMENTS_SPEC_REPORT.md` | KEN-49 | 要件定義・仕様化・受け入れ条件の工程を本文へ追加した記録 |
| `KEN50_MULTITENANT_DATETIME_REPORT.md` | KEN-50 | マルチテナントSaaSのテナント分離と日時設計を既存章へ横断的に補完した記録 |
| `KEN51_INTEGRATION_REPORT.md` | KEN-51 | ファイル・Webhook・メール・外部API連携という「システムの外側との境界」を補完した記録 |
| `KEN52_A11Y_PRIVACY_PAYMENT_ABUSE_REPORT.md` | KEN-52 | アクセシビリティ・個人データ・決済・abuse対策の4領域を9章へ補完した記録 |
| `KEN54_SOLUTION_IMPLEMENTATION_PART_V_REPORT.md` | KEN-54 | 第20〜24章の25演習について、プレースホルダーを実行可能な模範解答へ置換した記録 |
| `KEN54_SOLUTION_IMPLEMENTATION_PART_VI_REPORT.md` | KEN-54 | 第25〜30章の残り24演習を模範解答へ置換し、全演習の解答を揃えた記録 |
| `KEN56_CLEAN_ENVIRONMENT_FINAL_AUDIT_REPORT.md` | KEN-56 | 配布物だけを展開したクリーン環境での再検証と、固定ツールチェーン・ブラウザ・外部サービスが未到達である旨の監査結果 |
| `KEN58_STYLE_GUIDE_REPORT.md` | KEN-58 | 表記・用語・コード・図表のスタイルガイドと、その機械検査（`scripts/validate-style.mjs`）を整備した記録 |
| `KEN59_EDITORIAL_REPORT.md` | KEN-59 | 全文の編集校正とリンク検査の実施結果。指摘の分類・処理方針・見送り理由をまとめたもの |
| `KEN59_FULL_READ_LOG.md` | KEN-59 | 上記の一次記録。全7部・30章を全行通読した章別の所見（行番号と原文の引用つき） |
| `KEN60_BETA_REVIEW_PLAN_REPORT.md` | KEN-60 | ベータレビューの対象・役割分離・質問票・重大度・個人情報方針を設計した記録 |
| `KEN61_BETA_REVIEW_RESULT_REPORT.md` | KEN-61 | ベータレビューの実施結果。代行実施であることの限界の明示を含む |
| `KEN62_RELEASE_POLICY_REPORT.md` | KEN-62 | 公開形式・ライセンス・版管理・更新方針の確定と、静的サイト生成パイプラインを実装した記録 |
| `KEN63_RELEASE_REPORT.md` | KEN-63 | v1.0リリースチェックリストの完了と正式版公開までの作業記録。判定そのものは `RELEASE_v1.0.0_EVIDENCE.md` にある |
| `KEN66_BROWSER_VERIFICATION_REPORT.md` | KEN-66 | KEN-56で保留したブラウザ演習6件を、実Chrome + DevTools Protocol で全件確認した記録 |
| `KEN70_GITHUB_CI_REPORT.md` | KEN-70 | GitHub Actionsの成功証跡と必須チェックの設定作業と、プラン制限により未適用となった経緯 |
| `KEN71_NARRATIVE_FLOW_PART_I_REPORT.md` | KEN-71 | 第I部（第1〜4章）の知識接続の再編集記録 |
| `KEN71_NARRATIVE_FLOW_PART_II_REPORT.md` | KEN-71 | 第II部（第5〜9章）の知識接続の再編集記録 |
| `KEN71_NARRATIVE_FLOW_PART_III_REPORT.md` | KEN-71 | 第III部（第10〜13章）の知識接続の再編集記録 |
| `KEN71_NARRATIVE_FLOW_PART_IV_REPORT.md` | KEN-71 | 第IV部（第14〜17章）の知識接続の再編集記録 |
| `KEN71_NARRATIVE_FLOW_PART_V_REPORT.md` | KEN-71 | 第V部（第18〜22章）の知識接続の再編集記録 |
| `KEN71_NARRATIVE_FLOW_PART_VI_REPORT.md` | KEN-71 | 第VI部（第23〜26章）の知識接続の再編集記録 |
| `KEN71_NARRATIVE_FLOW_PART_VII_REPORT.md` | KEN-71 | 第VII部（第27〜30章）の再編集と、全30章を通したナラティブの仕上げ記録 |

## 2. `reports/data/` の検証結果データ

レポート本文の根拠となる、機械可読な検証結果と検証コマンドの生出力である。いずれも**取得時点の記録**であり、再生成して上書きするものではない。

| ファイル | 対応issue | 内容 |
|---|---|---|
| `clean-environment-results-ken56-final.csv` | KEN-56 | クリーン環境検証の演習別結果（132行）。演習ID、章、区分、互換環境での判定、固定環境での判定、証跡、残作業、安全上の注意 |
| `clean-environment-results-ken56-final.json` | KEN-56 | 同じ結果の機械可読な正本。実行環境（Node、TypeScript、OpenSSL、pnpm、Docker、ブラウザ）と区分別の集計を含む |
| `ken56-browser-smoke-results-final.json` | KEN-56 | ブラウザ演習6件のスモーク結果。環境の管理制限により全件 `blocked`。KEN-66 の結果に置き換わっている |
| `ken56-final-chapter-results.csv` | KEN-56 | 第1〜30章の章別の typecheck / build / test の終了コード、所要ミリ秒、生成JSファイル数、テスト件数 |
| `ken66-browser-verification-results.json` | KEN-66 | 実Chrome + CDP によるブラウザ演習6件の検証結果。演習ごとの verdict / port / 所要秒 / エラー件数 / Web Vitals / チェック66項目 / スクリーンショット。`.verification/ken66/verify.mjs` が出力する |
| `ken71-part3-test-report.txt` | KEN-71 | 第III部の改訂時に実行した検証・テストコマンドの生出力（TAP形式を含む） |
| `ken71-part3-validation-report.txt` | KEN-71 | 同じ回の検証結果のサマリ（narrative flow、回帰テスト、各種 `--check`、workspace、CI） |
| `test-report-ken56-final.txt` | KEN-56 | KEN-56 最終検証のサマリ。互換環境の版、成功した検査、未実行として残った項目 |
| `validation-report-ken56-final.txt` | KEN-56 | 同じ回の `validate-handbook` の出力（当時の警告27件を含む） |

## 3. 再生成されるファイル

`reports/data/ken66-browser-verification-results.json` だけは、`.verification/ken66/run-ken66.sh` を再実行すると上書きされる。それ以外のファイルは手作業で作成したものであり、再生成の手段はない。
