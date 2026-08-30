# KEN-62 公開形式・ライセンス・版管理・更新方針を確定する — 実施レポート

## 目的

v1.0を公開するには、「どの形式で配るか」「どの条件で使ってよいか」「版がどう進むか」「いつ見直すか」「どこまで動作を保証するか」を、読者が読める形と機械が検証できる形の両方で確定させる必要がある。これらが未確定であることは `BETA_REVIEW_PLAN.md` のRB-10（Blocker、例外承認不可）に該当し、KEN-63のリリースゲート「ライセンス、版番号、CHANGELOG、正誤報告先が公開済み」を止める。

本タスクでは、方針を文書として定めるだけでなく、静的サイト生成パイプラインを実装し、方針と実体の一致を `pnpm run check:handbook` と同じ入口で検証できるようにした。

## 設計判断

### 正本を `config/release.json` に一本化した

本書は既存の各領域で「機械可読な正本 + 生成物または説明文書」という構造を採っている（`config/learning-levels.json`、`config/chapter-guides.json`、`config/clean-environment-plan.json`、`beta-review-scope.json`）。公開方針だけをMarkdownの散文に閉じ込めると、README・前付け・ライセンス文書・CHANGELOGの4か所が独立にずれる。

そこで、公開形式、ライセンス判定規則、版管理規則、章別の見直し周期、サポート範囲、固定成果物、リリースゲート対応を `config/release.json` に集約し、`RELEASE_POLICY.md`・`LICENSING.md`・`ERRATA.md`・`README.md`・`00-front-matter.md` は正本を人が読む形で説明する文書と位置づけた。`scripts/validate-release-policy.mjs` が両者の一致を検証する。

### 章数・演習数をハードコードしていない

見直し周期の網羅性は `config/chapter-guides.json` の章キー集合から実行時に導出して検証する。章が増減すれば検証が自動的に追随し、`config/release.json` の更新漏れを検出する。WS4で節・演習が増え続けても影響を受けない。

### 静的サイト生成に外部依存を追加しなかった

`scripts/build-site.mjs` はNode.jsの標準ライブラリだけで動く。Markdownパーサ、静的サイトジェネレータ、テンプレートエンジンのいずれも追加していない。理由は3点ある。

1. 本書は「依存を固定して再現可能に検証する」ことを教材として繰り返し主張している。生成基盤だけが未固定の依存を抱えるのは一貫しない。
2. 静的サイトジェネレータはメジャー更新のたびに設定と出力が変わる。第20章・第21章で見直し周期を半期と判定した領域と同じ変化速度を、本書の公開基盤へ持ち込みたくない。
3. 本書のMarkdownは `CONTRIBUTING.md` で書式を統一しており、汎用パーサが必要とする網羅性を必要としない。実際、本文2.0MBを解析して問題が出た記法はなかった。

将来、数式や複雑な図版の要求が出た場合に限り依存の追加を検討する旨を `RELEASE_POLICY.md` 第1.1節へ明記した。

### 本文とコードで異なるライセンスにした

本文はCC BY-NC-SA 4.0、サンプルコードはMITとした。本文は著者の解説そのものであり、営利目的の再販や改変版の非公開化を防ぐため非営利・継承条件を課す。一方サンプルコードは読者が自分の業務へ持ち帰るためのものであり、そこにコピーレフト条件が付くと学習成果を実務へ適用できない。

判定順序は「先頭一致優先」とし、`code/**` を `*.md` より先に置いた。この結果 `code/chXX/README.md` はMITになる。コード教材の説明文はコードと同じ条件で持ち帰れるほうが実用的である。この帰結は `LICENSING.md` 第2節へ明示した。

### PDF・EPUBを「作れないから出さない」ではなく「保証できないから出さない」と定義した

v1.0のスコープ外である理由と、将来提供する場合の判断基準・派生元（HTML）・正本の不変性を `config/release.json` の `distribution.outOfScope` と `RELEASE_POLICY.md` 第1.5節へ記録した。検証は両形式に理由と将来方針が揃っていることを確認する。

## 確定した方針

### 公開形式

| 形式 | 位置づけ | 成果物 | 固定方法 |
|---|---|---|---|
| GitHubリポジトリ | 正本 | Markdown本文と `code/chXX/` | gitタグ `v1.0.0` |
| 静的Webサイト（GitHub Pages） | 生成物 | `dist/site/` 配下のHTML | `pnpm run build:site` の出力とrelease manifestのsha256 |

PDFとEPUBはv1.0では提供しない。

### ライセンス

| 区分 | SPDX識別子 | 全文 | 対象 |
|---|---|---|---|
| 本文 | `CC-BY-NC-SA-4.0` | `LICENSE-TEXT` | 本文Markdown、図表、文章、生成HTML |
| コード | `MIT` | `LICENSE` | サンプルコード、スクリプト、設定、CI定義 |

判定規則18件を `config/release.json` の `licensing.rules` に定義し、`LICENSING.md` の対応表と順序込みで一致させた。判定対象787ファイル（コード742、本文43、告知2）のうち、規則に一致しないファイルは0件である。

### 版管理

Semantic Versioning 2.0.0を採用し、本文とサンプルコードを1つの版番号で管理する。両者は同じリポジトリで同時に検証されるため、別々の版番号を持たせない。

| 段階 | 本文 | コード |
|---|---|---|
| MAJOR | 部・章の追加削除統合分割、章節番号の付け替え、対象読者・前提知識の変更、標準ルートの再定義 | Node.js/pnpmのメジャー更新、既存演習の非互換な変更、章ディレクトリ・package名の変更 |
| MINOR | 既存章への節追加、説明・図表・一次資料の追加、学習レベルと推定時間の見直し、学習ルートの追加 | 演習・模範解答の追加、依存のMINOR更新、検証スクリプト・CIジョブの追加 |
| PATCH | 誤字脱字・用語表記・リンク切れ、骨子を変えない事実誤りの訂正、ERRATA登録項目の本文反映 | サンプルコードのバグ修正、依存のPATCH更新とセキュリティ修正 |

判断に迷う場合の基準は「節を読み直す必要があるか」とした。読み直しが必要ならMINOR以上、手元の版を機械的に読み替えれば済むならPATCHとする。版番号は `config/release.json`、`package.json`、`CHANGELOG.md` の3か所で一致させ、検証で強制する。

### 章別の見直し周期

技術の変化速度で4段階に分類し、全30章へ割り当てた。「同様に」で省略した章はない。

| 区分 | 周期 | 章数 | 章番号 |
|---|---:|---:|---|
| 四半期 | 3か月 | 1 | 29 |
| 半期 | 6か月 | 9 | 6, 7, 8, 9, 16, 20, 21, 23, 30 |
| 年次 | 12か月 | 12 | 3, 4, 5, 10, 12, 13, 15, 17, 19, 22, 24, 25 |
| 隔年 | 24か月 | 8 | 1, 2, 11, 14, 18, 26, 27, 28 |

章ごとに「変化を駆動する要素」と「その周期にした判断理由」を `config/release.json` へ記録し、`RELEASE_POLICY.md` 第5.2節の表として展開した。周期を待たずに見直すトリガー（Node.js LTSの切り替え、pnpm/TypeScriptのメジャー更新、CVSS 7.0以上の脆弱性公表、一次資料の非推奨化・移動、ERRATAへのBlocker/Major登録）と、見直し時に確認する4点（一次資料の生存、固定バージョンの妥当性、演習の再現性、展望節の陳腐化）も定義した。

### サンプルコードのサポート範囲

- **対象バージョン**: Node.js 24.18.0（`>=24.18.0 <25`）、pnpm 11.15.1（`>=11.15.1 <12`）、TypeScript 6.0.3（`6.0.x`）。`package.json` の `engines` と `.node-version` との一致を検証する。
- **対象環境**: devcontainerとLinux (x86_64) を保証、macOSとWindows + WSL2を努力目標、WSL2を使わないWindowsネイティブを対象外とした。「保証」で再現しない不具合は正誤報告の対象、「努力目標」は再現条件が特定できた場合に限り対応、「対象外」は受け付けない。
- **保証する範囲**: 固定ツールチェーンでの `check:workspace` と `check:handbook` の成功、各章の `lint`・`typecheck`・`test`・`build` の成功、starterからsolutionへの導線の検証。
- **保証しない範囲**: ブラウザ手動・外部サービス演習の自動再現（RB-06と同じ扱い）、クラウド事業者の無料枠・料金・コンソールUI、固定していないバージョン組み合わせ、長時間ベンチマークの絶対値。
- **本番利用不可の教育用実装**: 第6・11・13・23・25・30章の該当実装について、省略した保証を具体的に列挙した。挙げた章が `config/chapter-guides.json` に存在することを検証する。
- **サポート期間**: 最新のMINOR系列のみ。旧MINOR系列へPATCHを提供しない。

## 実装した静的サイト生成パイプライン

### 構成

```text
config/release.json (site.pages / site.copies)
        ↓
scripts/build-site.mjs   ← Node.js標準ライブラリのみ
        ↓
dist/site/
├── index.html                  グループ別のページ一覧
├── style.css                   共通スタイル（light/dark対応、日本語本文向け行間）
├── LICENSE.txt / LICENSE-TEXT.txt   ライセンス全文の複製
├── 00-front-matter.html 〜 10-index.html      本文・目次・索引
├── LEARNING_*.html / CHAPTER_TEMPLATE.html   学習ガイド
├── RELEASE_POLICY.html / LICENSING.html / CHANGELOG.html / ERRATA.html ほか運用文書
└── release-manifest.json       入力・出力のsha256、版番号、ツールチェーン
```

### 対応した記法

見出し、段落、水平線、順序なし・順序付きリスト（ネスト対応）、GFM表（整列指定を含む）、引用ブロック（入れ子のリスト・段落を再帰処理）、フェンス付きコードブロック（言語名を `data-lang` として保持）、インラインコード、強調、太字、取り消し線、リンク、画像、自動リンク、行末2スペースの強制改行。

本書固有の2要素も扱う。

- `<a id="chapter-1"></a>` 形式のアンカーはHTMLの実アンカーとして保持する。目次と索引からの章・節リンクがそのまま機能する。
- `<!-- handbook:learning ... -->` などの生成メタデータはHTMLコメントとして保持し、表示しない。

上記以外の生のHTMLはエスケープする。本文が意図しないマークアップを注入できないようにするためである。

Markdown間の相対リンクは対応するHTMLへ書き換える。サイトに含めないリポジトリ内パス（`code/chXX/README.md` など33件）は相対パスのまま残し、件数をmanifestと標準出力へ記録する。`config/release.json` の `site.repoLinkBase` にリポジトリのblob URLを設定すると、これらはリポジトリのURLへ書き換わる。公開先リポジトリはKEN-70で確定するため、現時点では空にしてある。

### 決定性

生成時刻、乱数、実行環境に依存する値を出力へ含めない。版番号と公開日は `config/release.json` から読む。

```bash
$ node scripts/build-site.mjs --check
Deterministic build: ok
Existing artifacts match: dist/site
Pages: 31
Version: 1.0.0 (2026-08-30)
```

`--check` は一時ディレクトリへ2回生成してmanifestを比較し、さらに `dist/site/` が存在する場合はその内容とも比較する。不一致なら終了コード1を返す。

### 実行結果

```bash
$ node scripts/build-site.mjs
Static site: dist/site
Pages: 31
Version: 1.0.0 (2026-08-30)
Inputs: 30
Site build completed.
```

生成量は2.6MB、最大ページは `04-part3-backend.html`（372KB）である。実行時間は0.15秒、`--check`（2回生成 + 比較）でも0.31秒であり、CIの必須ゲートへ載せても支障のない速度に収まった。

`dist/site/release-manifest.json` は入力30件・出力31件のsha256、版番号、公開日、状態、ツールチェーンの宣言値、本文とコードのSPDX識別子、解決できなかったリンク一覧を含む。

### 配信

`.github/workflows/pages.yml` を追加した。

- Pull Requestでは生成と決定性検証だけを行い、配信しない。
- `main` へのpushでPages artifactをアップロードし、配信ジョブが公開する。
- 既定の `permissions` は `contents: read`。配信ジョブだけに `pages: write` と `id-token: write` を与える。
- `actions/checkout` では `persist-credentials: false` を指定する。
- 使用するactionはすべて完全なcommit SHAへ固定する。`validate-release-policy.mjs` が固定漏れを検出する。

必須ゲート（`ci.yml`）へは含めていない。公開の失敗が原稿検証の結果を巻き込まないようにするためである。`config/ci-plan.json`（並行編集対象のため未変更）が参照する2つのworkflowには影響しない。

## 変更・新規作成したファイル

### 新規作成（方針・ライセンス）

| ファイル | 内容 |
|---|---|
| `config/release.json` | 公開形式、ライセンス判定規則、版管理、章別見直し周期、サポート範囲、固定成果物、リリースゲート対応の正本 |
| `RELEASE_POLICY.md` | 上記を人が読む形で説明する方針文書（9節） |
| `LICENSING.md` | ファイル単位のライセンス対応表（判定規則18件、判定順序、対象外パス） |
| `LICENSE` | MIT License（サンプルコード・スクリプト・設定・CI定義） |
| `LICENSE-TEXT` | CC BY-NC-SA 4.0の適用条件、非営利判断基準、保証否認、別途許諾の窓口 |
| `CHANGELOG.md` | Keep a Changelog 1.1.0形式。`[Unreleased]` と `[1.0.0] - 2026-08-30`、運用ルール7項目 |
| `ERRATA.md` | 正誤表、記入規則、重大度定義、状態遷移、報告方法、受付から反映までの7手順 |

### 新規作成（実装・検証）

| ファイル | 内容 |
|---|---|
| `scripts/build-site.mjs` | Markdown → HTML 静的サイト生成。外部依存なし。`--check` で決定性検証 |
| `scripts/validate-release-policy.mjs` | 方針と実体の一致検証。40種類以上のエラーコード |
| `scripts/validate-release-policy.test.mjs` | 回帰テスト25件 |
| `.github/workflows/pages.yml` | GitHub Pagesの生成と配信 |
| `.github/ISSUE_TEMPLATE/errata-report.yml` | 正誤報告フォーム |
| `.github/ISSUE_TEMPLATE/revision-proposal.yml` | 改訂・利用の提案フォーム |
| `.github/ISSUE_TEMPLATE/config.yml` | 空Issueの禁止と参照先リンク |

### 変更

| ファイル | 変更内容 |
|---|---|
| `README.md` | 「公開・利用条件」節を新設（公開形式、ライセンス、版管理と更新、サポート範囲、正誤報告と改訂の提案）。「静的サイトの生成」節を追加。構成一覧と正本一覧へ新規文書を追記。検証コマンドへ `validate:release-policy` を追加 |
| `00-front-matter.md` | 「公開・利用条件」節を新設（常体で記述） |
| `package.json` | `validate:release-policy`、`test:release-policy`、`build:site`、`build:site:check` を追加。`check:handbook` と `test:handbook` のチェーンへ組み込み |
| `CONTRIBUTING.md` | 「1.9 公開・ライセンス・版管理」を追加（正本の所在、3か所の版番号一致、生成物の扱い） |
| `CI.md` | 「5. 公開サイトのworkflow」を追加。ローカル確認コマンドへ2件追記 |

既存の `config/*.json`、本文Markdown（`02`〜`08`）、`01-toc.md`、`10-index.md`、`09-references.md`、学習系文書、`code/` 配下、他エージェントが担当するスクリプトは変更していない。

## 実行した検証

すべて `pnpm` 経由で実行した。ローカルのNode.jsは26.7.0であり、pnpmが `Unsupported engine` の警告を出すが、検証ロジック自体はNode.js 24でも同じ結果になる（構文・API依存なし）。

| コマンド | 結果 | ERROR | WARN |
|---|---|---:|---:|
| `pnpm run validate:release-policy` | 終了コード0 | 0 | 0 |
| `pnpm run test:release-policy` | 25件すべてpass | 0 | 0 |
| `pnpm run validate:handbook` | 終了コード0 | 0 | 27 |
| `pnpm run check:handbook` | 終了コード0 | **0** | **27** |
| `pnpm run validate:ci` | 終了コード0 | 0 | 0 |
| `node scripts/build-site.mjs` | 終了コード0 | 0 | 1（要約行） |
| `node scripts/build-site.mjs --check` | 終了コード0 | 0 | 1（要約行） |

`check:handbook` のWARN 27件はすべて `validate:handbook` が以前から報告している `ANCHOR_DUPLICATE`（`#コード集の使い方`、`#採用判断`、ADRの `#context` など、同名の小見出しが複数章に存在する）であり、本タスクで増減していない。`validate:release-policy` はERROR 0件・WARN 0件である。

#### 並行作業による一時的な失敗について

上表は本タスクの成果物が出そろった時点（2026-08-30 09:24）の結果である。その後、WS4（KEN-50/51/52）の並行作業が第13章・第14章・第30章へ節を追加したため、再実行すると `check:handbook` はチェーンの1段目 `apply:learning-levels:check` で「Learning metadata is out of date」と表示して停止し、`validate:handbook` は `TOC_SECTION_MISSING` / `TOC_SECTION_TITLE` を10件報告する。

内訳は 13.24〜13.25、14.20〜14.25、30.14〜30.15 の追加に対して `config/learning-levels.json` と `01-toc.md` が未追随であることによるもので、いずれも本タスクが触れていないファイルである（両ファイルとも編集禁止対象）。本タスクの追加分に起因するERRORは0件であり、再実行時も `validate:release-policy` はERROR 0件・WARN 0件で成功する。

WS4が `apply:learning-levels` と `generate:handbook` を実行して正本を追随させれば、チェーン全体が再び緑になる。KEN-63のリリース判定時には、その状態で `check:handbook` を実行して証跡を残す必要がある。

`build:site:check` も同じ理由で、本文Markdownが編集された直後に実行すると `dist/site` の生成物が入力と一致せず失敗する。これは仕様どおりの検出であり、`pnpm run build:site` を再実行すれば解消する。並行編集が収まった状態で再生成し、`Deterministic build: ok` と `Existing artifacts match: dist/site` を確認済みである。

`build-site.mjs` のWARN 1件は「サイトへ含めないリポジトリ内パスへのリンク33件」の要約であり、`site.repoLinkBase` を設定すれば解消する。ページ生成の失敗ではない。

### `validate:release-policy` の検証内容

```text
Release policy validation
- version: 1.0.0 (2026-08-30, pending)
- distribution formats: git-repository, static-site
- site pages: 27 (+2 copies)
- licensed files: code=742, text=43, notice=2
- review cycles: 30/30 chapters
- changelog releases: 1
- errata entries: 0
- errors: 0
- warnings: 0
```

検証項目は次のとおりである。

1. 必須ファイル（ライセンス2件、方針文書3件、生成スクリプト、workflow、issueテンプレート3件）の存在
2. `config/release.json`・`package.json`・`CHANGELOG.md` の版番号一致と公開日一致
3. CHANGELOGの `[Unreleased]` 見出しの存在、版見出しの書式、分類名が6種類に限定されていること
4. ライセンス判定規則に一致しないファイルが0件であること（`node_modules`、`.git`、`dist` などは対象外）
5. `LICENSING.md` の対応表が正本と順序・パターン・区分まで一致すること
6. `LICENSE` に "MIT License"、`LICENSE-TEXT` にSPDX識別子とリーガルコードURLがあること
7. `config/chapter-guides.json` の全章に見直し周期・駆動要素・判断理由があり、`RELEASE_POLICY.md` の表に対応行があること
8. サポート範囲の対象バージョンが `package.json` の `engines`・`packageManager`・`.node-version` と一致すること
9. 本番利用不可として挙げた章が実在すること、対象外環境が定義されていること
10. `ERRATA.md` の列が正本と一致し、状態・重大度・受付テンプレートの説明があり、各行の対象版がCHANGELOGに存在すること
11. `README.md` と `00-front-matter.md` の「公開・利用条件」節に必須7語（`CC BY-NC-SA 4.0`、`MIT`、`1.0.0`、`LICENSING.md`、`RELEASE_POLICY.md`、`CHANGELOG.md`、`ERRATA.md`）があること
12. 公開形式に固定方法があり、スコープ外形式に理由と将来方針があること
13. サイト生成対象が実在し、出力先が重複せず、固定成果物のMarkdownがすべてサイトに含まれること
14. Pages workflowの権限、`persist-credentials: false`、生成・決定性検証の実行、actionの完全SHA固定
15. issueテンプレートの必須項目、重大度の選択肢、個人情報を含めない確認項目
16. `releaseGateMapping` の各blocker IDが `BETA_REVIEW_PLAN.md` に実在すること

### `test:release-policy` の内容

25件のテストは、リポジトリ全体での成功確認に加え、最小構成のfixtureを一時ディレクトリへ複製して意図的に壊し、期待するエラーコードが出ることを確認する。

- 版番号・公開日のずれ（`VERSION_MISMATCH_CHANGELOG`、`RELEASE_DATE_MISMATCH`、`VERSION_MISMATCH_PACKAGE`）
- 判定規則に一致しないファイルの追加（`LICENSE_RULE_UNMATCHED`）
- `LICENSING.md` の表と正本のずれ（`LICENSING_TABLE_PATTERN`）
- SPDX識別子の欠落（`LICENSE_TEXT_INVALID`）
- 見直し周期の欠落と文書との不一致（`REVIEW_CYCLE_MISSING`、`REVIEW_CYCLE_DOC_MISSING`）
- README・前付けの利用条件の欠落（`DISCLOSURE_TOKEN_MISSING`、`DISCLOSURE_HEADING_MISSING`）
- 正誤表の列変更と未公開版の参照（`ERRATA_COLUMNS_MISMATCH`、`ERRATA_VERSION_UNKNOWN`）
- workflowのSHA固定漏れと権限拡大（`PAGES_ACTION_NOT_PINNED`、`PAGES_PERMISSIONS`）
- issueテンプレートの必須項目欠落（`ERRATA_TEMPLATE_FIELD`）

加えて、生成物の性質を直接検証する。全ページにライセンス表示・版番号・`lang="ja"` があること、本文の章・節アンカーが保持されること、目次のMarkdownリンクがHTMLへ書き換わっていること、生成が決定的であることを確認する。

## 完了条件の達成根拠

### 1. READMEと前付けに公開・利用条件が記載

`README.md` に「## 公開・利用条件」節（公開形式の表、ライセンス、版管理と更新、サンプルコードのサポート範囲、正誤報告と改訂の提案の5小節）、`00-front-matter.md` に「### 公開・利用条件」節を新設した。

記載の網羅は文言の目視ではなく機械検証で担保している。両ファイルの当該節に、`CC BY-NC-SA 4.0`、`MIT`、`1.0.0`、`LICENSING.md`、`RELEASE_POLICY.md`、`CHANGELOG.md`、`ERRATA.md` の7語がすべて含まれることを `validate:release-policy` が確認する。1語でも欠けると `check:handbook` が失敗する。

README（敬体）と前付け（常体、本文の文体）で文体は変えたが、必須の事実は同一である。

### 2. v1.0の固定成果物を再現可能

- **版情報の正本**: `config/release.json` の `version`・`releaseDate`・`state`。`package.json` と `CHANGELOG.md` との一致を検証する。
- **固定成果物の一覧**: `config/release.json` の `fixedArtifacts`（Markdown正本11件、方針文書7件、生成HTML、再現マニフェスト、検証ログ4種）。列挙したファイルの実在を検証する。
- **再現手順**: `corepack prepare` → `pnpm install --frozen-lockfile` → `check:handbook` → `build:site` → `build:site:check`。
- **再現の確認**: 実際に生成し、`--check` が「Deterministic build: ok」「Existing artifacts match: dist/site」を返すことを確認した。manifest（sha256 `b82610f5…`）は入力30件・出力31件のsha256を含み、同じコミットからは実行環境・実行時刻によらず一致する。

`dist/` はgit管理対象外であるため、固定は「gitタグ + release manifestのsha256」の組で行う。この方針とタグ付け手順7段階を `RELEASE_POLICY.md` 第7節へ定義した。

### 3. 正誤報告と改訂の受付方法がある

`.github/ISSUE_TEMPLATE/errata-report.yml`（正誤報告）と `.github/ISSUE_TEMPLATE/revision-proposal.yml`（改訂・利用の提案）を作成し、`config.yml` で空Issueを禁止して既知の誤り・方針文書へ誘導する。

正誤報告テンプレートは、対象版、種類、対象箇所（節番号 + 位置）、誤、正、根拠、重大度、実施環境、バージョン情報を収集する。氏名・メールアドレス・所属は収集せず、含めていないことをチェックボックスで確認させる（`BETA_REVIEW_PLAN.md` 第10節の個人情報方針と同じ扱い）。

受付から `ERRATA.md` 反映までの手順は7段階（受付 → 再現確認 → 判定 → 修正 → 検証 → 反映 → リリース）で定義し、Blockerは30日以内、Majorは次のPATCH、Minorは次のMINORまでという期限を置いた。ERRATA IDの書式、対象箇所の粒度（ファイル名+行番号を使わない理由を含む）、状態遷移、却下行を削除しない規則も定めた。

## `BETA_REVIEW_PLAN.md` のrelease blockerとの対応

| ID | 停止条件 | 本タスクとの関係 | 判定 |
|---|---|---|---|
| RB-01 | 未解消のBlocker/Major指摘が残っている | 対象外（KEN-61の範囲） | — |
| RB-02 | 必須検証章の通読記録が欠けている | 対象外（KEN-61の範囲） | — |
| RB-03 | 必須検証演習が未実施または失敗 | 対象外（KEN-61の範囲） | — |
| RB-04 | 原稿整合性検証が失敗する | `validate:release-policy` を `check:handbook` チェーンへ組み込んだ。公開条件の破損が原稿検証と同じゲートで止まる | `check:handbook` 終了コード0、ERROR 0件 |
| RB-05 | 演習定義または模範解答の検証が失敗する | 未変更。`validate:exercises` は成功のまま | 影響なし |
| RB-06 | ブラウザ手動・外部サービス演習の証跡が自動テストで代替されている | サポート範囲の「動作を保証しない範囲」として同じ基準を明記し、`config/clean-environment-plan.json` の `requiredEvidence` を参照先に指定した | `BETA_REVIEW_PLAN.md` と矛盾なし |
| RB-07 | 本番環境で実行すると被害が生じる記述が残っている | サポート範囲第6.5節で、第6・11・13・23・25・30章の教育用実装が本番利用不可であることと省略した保証を明示。章の実在を検証 | 記述側の判定はKEN-61の技術校閲 |
| RB-08 | 推定所要時間が実測から大きく乖離している | 例外承認時に乖離章と実測値をCHANGELOGへ記載する運用を `CHANGELOG.md` 運用ルール6へ定義した | 運用の受け皿を用意済み |
| RB-09 | クリーン環境の初期構築が完走しない | 未変更。固定成果物の検証ログとして `bootstrap-clean-environment.sh` を登録 | 影響なし |
| **RB-10** | **公開・利用条件が未確定である** | **本タスクの主対象。ライセンス2件、版番号3か所一致、CHANGELOG、ERRATA、正誤報告先、README・前付けの記載をすべて用意し、機械検証を追加した** | **`validate:release-policy` 終了コード0、ERROR 0件** |
| RB-11 | 個人情報方針に反する収集または保存 | issueテンプレートで氏名・メール・所属・外部サービスIDを収集せず、確認チェックボックスを必須にした。テンプレートに当該記載があることを検証 | `BETA_REVIEW_PLAN.md` 第10.2節と一致 |

RB-10の判定方法は `BETA_REVIEW_PLAN.md` で「`README.md` と `00-front-matter.md` の記載を確認します（KEN-62の成果物）」と定義されている。本タスクではこの目視確認を `validate:release-policy` の `DISCLOSURE_*` 検査へ機械化し、`check:handbook` から自動実行されるようにした。

## KEN-63のリリースゲートとの対応

KEN-63のゲート「ライセンス、版番号、CHANGELOG、正誤報告先が公開済み」は、次の4点がすべて満たされたときに成立する。判定はすべて `pnpm run validate:release-policy` で機械化した。

1. `LICENSE` と `LICENSE-TEXT` が存在し、`LICENSING.md` の対応表が全ファイルを網羅している → 787ファイル中、未分類0件
2. `config/release.json`、`package.json`、`CHANGELOG.md` の版番号が一致している → すべて `1.0.0`
3. `CHANGELOG.md` の最新版見出しが公開する版と一致している → `## [1.0.0] - 2026-08-30`
4. `ERRATA.md` と正誤報告テンプレートが存在し、`README.md` と `00-front-matter.md` から到達できる → 相対リンク検査（`validate:handbook`）で担保

KEN-63の作業「v1.0タグまたは固定版を作成」「配布成果物を生成」「公開ページとREADMEを更新」に対しては、`RELEASE_POLICY.md` 第7.4節へタグ付け手順を7段階で定義した。`config/release.json` の `state` を `pending` から `released` へ切り替える箇所も含めてある。

`releaseGateMapping` に定義したblocker IDが `BETA_REVIEW_PLAN.md` に実在することも検証しているため、ベータレビュー計画側でIDが変わった場合は検証が失敗して気づける。

## 積み残し・ブロッカー

### 1. Pages用actionのcommit SHAはKEN-70で再確認が必要

`actions/upload-pages-artifact@56afc609e74202658d3ffba0e8f6dda462b719fa`（v3.0.1）と `actions/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e`（v4.0.5）を固定した。ネットワーク非接続の環境で作業したため、この2つのSHAが現在の最新タグに対応するかを実際のGitHubで確認していない。workflowへ「KEN-70でSHAを確認して再固定する」旨のコメントを入れてある。`ci.yml` と共通の3つのaction（checkout、setup-node、cache）は既存workflowと同じSHAを使っているため確認済みである。

### 2. 公開先リポジトリURLが未確定

`config/release.json` の `site.repoLinkBase` を空にしてある。KEN-70でリポジトリを決定したらblob URL（`https://github.com/<owner>/<repo>/blob/main`）を設定する。設定すると、サイトに含めない33件のリポジトリ内パスへのリンクがリポジトリのURLへ書き換わる。issueテンプレートの `config.yml` とテンプレート本文では、リポジトリに依存しない相対リンク（`../../blob/main/...`）を使っているため、リポジトリが決まればそのまま動く。

公開URLが確定したら `README.md` へ記載する（`RELEASE_POLICY.md` 第7.4節の手順7）。

### 3. `pnpm-lock.yaml` と `--frozen-lockfile`

再現手順に `pnpm install --frozen-lockfile` を含めたが、`CI.md` 第4節のとおり、現時点のCIは `--no-frozen-lockfile` を使っている。lockfileの生成・固定はKEN-65/KEN-70の範囲であり、本タスクでは方針の記述にとどめた。

### 4. `config/ci-plan.json` へPages workflowを登録していない

`config/ci-plan.json` は並行編集対象のため変更していない。Pages workflowは必須ゲートに含めない設計なので `validate:ci` の検査対象外でよいが、`policy` へ登録して `validate-ci.mjs` 側でもSHA固定を検査する構成にする余地はある。現状は `validate-release-policy.mjs` が同等の検査を行っている。

### 5. `ANCHOR_DUPLICATE` 警告27件

`validate:handbook` の既存警告であり、本タスクの範囲外である。静的サイト側では、見出しのslug IDに重複時の連番（`-1`、`-2`）を自動付与しているため、生成HTMLでID衝突は起きない。ただし、同名見出しへのアンカーリンクは先頭の見出しへ解決される。本文側で見出しを一意にするか、明示アンカーを追加するのが根本対応であり、v1.1以降の候補とする。

### 6. PDF・EPUBの提供

v1.0のスコープ外とし、将来の判断基準を記述した。読者からの要望が集まった段階で、静的サイトのHTMLからの派生として検討する。
