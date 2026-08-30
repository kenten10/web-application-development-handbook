# KEN-49 要件定義・仕様化・受け入れ条件の実務章を追加 — 実施レポート

## 目的

本書は技術の実装方法を扱う一方で、その手前にある「何を作り、どうなったら完成か」を決める工程を扱っていなかった。第27章はドメインモデリングを扱うが、モデルへ写すべき不変条件も共通語彙も、要望が問題定義・ユースケース・受け入れ条件・API契約・定量化された非機能要件へ変換されていなければ決まらない。KEN-49では、この変換工程を本文へ追加し、実装前の判断と実装後の検証が1本でつながる演習を用意する。

## 統合先の設計判断

### 新規章を作らず、第27章へ節として統合した

本書は「30章」であることが書名、目次、学習経路、索引、`code/ch01`〜`code/ch30`、各種検証スクリプトに埋め込まれている。issue の完了条件も「第27〜30章または前段に自然に統合」であるため、新規章は作らず、既存の第27章へ5つの節を追加した。

### なぜ第27章か

- 第27章の課題設定は「業務ルールがUI、API、DBへ散らばる状態を避け、変更理由と一貫性境界がコード構造に表れるようにする」である。要件定義と仕様化は、その一貫性境界を決めるための入力を作る工程であり、同じ問題の上流にある。
- 27.10 のユビキタス言語と Event Storming は語彙の獲得を扱うが、語彙が現れる場である問題定義とユースケースは扱っていなかった。27.3 の Aggregate が守る不変条件も、業務ルール表を経由せずに登場していた。追加した節は、この2つの空白を埋める。
- 第30章（総合演習）の 30.1 要件定義は結論だけを列挙している。その結論に至る工程を第27章へ置き、30.1 から参照する構成にした。

### なぜ 27.12 の直後か

節番号を振り直す範囲を最小にするためである。第27章では 27.10〜27.12（Ubiquitous Language、C4、Conway's Law）が後から追記されており、実装課題の直前へ概念節を足す前例がある。同じ位置へ追加すると、番号が動くのは実装課題の節1つ（27.13 → 27.18）だけで済む。

27.1 の前へ挿入する案は、時系列としては自然だが 27.1〜27.13 のすべてが動く。とくに 27.10 は `beta-review-scope.json`（KEN-60、並行作業中）の必修節一覧に含まれており、番号が変わると別作業の正本と衝突する。番号の自然さより、正本間の整合を優先した。

### 6項目の配置

| issue の扱う内容 | 配置 |
|---|---|
| 問題定義とユーザーストーリー | 27.13（新設） |
| ユースケース、状態遷移、業務ルール | 27.14（新設） |
| 受け入れ条件と Example Mapping | 27.15（新設） |
| API契約とスキーマ駆動 | 27.16（新設） |
| 非機能要件の定量化 | 27.17（新設） |
| 曖昧な要件を実装可能な仕様へ変換する演習 | 27.18 の課題27.5（新設） |

API契約は第12章（12.4 ページネーション、12.5 エラーレスポンス、12.6 OpenAPI）と重複しうる。27.16 では記法とツール連携を扱わず、「要件から契約へ落とすときに何を決め、何を決めないか」「互換性ポリシー」「スキーマを唯一の正本にする方法」に絞り、記法は第12章を参照する形にした。非機能要件も同様に、22.7 のSLI/SLO、24.1 のCore Web Vitals、24.8 の負荷テストへつなぐ位置づけとし、指標の定義自体は再説明していない。

### 第30章への接続

30.1 要件定義へ2か所の接続文を追加した。

- 冒頭に、この一覧が 27.13〜27.17 の工程を通した結果の要約であること、非機能要件はこの形のままでは検証できず 27.17 の5項目へ展開する必要があることを明記した。
- 末尾に、API契約の互換性ポリシーを公開前に決める旨（27.16 参照）を追加した。

## 追加した節・小節の一覧

| 節 | 学習レベル | 推定時間 | 行数 | 文字数 | 主な小節 |
|---|---|---:|---:|---:|---|
| 27.13 問題定義とユーザーストーリー | 実務選択 | 20分 | 134 | 4,543 | 要望を問題へ戻す／問題定義シート／ユーザーストーリーの形式と3C／INVEST／ストーリーの分割軸／つまずく箇所 |
| 27.14 ユースケース、状態遷移、業務ルール | 実務選択 | 25分 | 166 | 6,088 | ストーリーとユースケースの役割分担／ユースケース記述の最小形／状態を遷移表で固定する／業務ルールの3分類／ルールに識別子を振る／つまずく箇所 |
| 27.15 受け入れ条件と Example Mapping | 実務選択 | 25分 | 175 | 5,940 | 受け入れ条件が満たすべき性質／Given/When/Then の書き方／Example Mapping の進め方／例から自動テストへ写す／Definition of Done との違い／つまずく箇所 |
| 27.16 API契約とスキーマ駆動の仕様化 | 実務選択 | 20分 | 197 | 7,815 | 仕様化フェーズで契約が決めること／受け入れ条件から契約を導く／スキーマ駆動の3方式／スキーマを唯一の正本にする／互換性ポリシー／つまずく箇所 |
| 27.17 非機能要件の定量化 | 実務選択 | 20分 | 161 | 5,389 | 検証できない非機能要件の形／品質特性を抜け漏れチェックに使う／目標値の根拠を積む／容量要件を数へ落とす／受け入れテスト化／つまずく箇所 |
| 課題27.5 の本文（27.18 内） | — | — | 120 | 5,379 | 題材、4つの実装要件、期待出力 |
| 合計 | — | 110分 | 953 | 35,154 | — |

各節は、コード例（TypeScript、YAML、JSON、Gherkin）、表、ASCII図、実務での落とし穴、一次資料への出典を備えている。既存節（27.10 は93行/15分、27.11 は109行/15分）と比べ、行数あたりの推定時間は同水準に揃えた。

### 章番号・節番号

- 章数は30のまま。新規章は作っていない。
- 第27章の実装課題は 27.13 → 27.18 へ移動した。これに伴い `config/learning-levels.json`、`config/chapter-guides.json`、目次、アンカー、本文中の参照を更新した。他章の節番号は変更していない。
- 節数は 385 → 390 になった。

### 学習レベルを「実務選択」に統一した理由

新設5節はいずれも `practical`（実務選択）とした。`beta-review-scope.json`（KEN-60、別エージェントが並行編集中で本作業では変更禁止）は、`config/learning-levels.json` から必修節の一覧と合計時間を再計算して照合する。必修節を増やすと、章別の `requiredSections`／`requiredMinutes`、全体の `requiredSectionCount`（199）、選定しきい値の分位点、章の tier 判定が一斉にずれ、並行作業中の正本と衝突する。内容としても、要件定義の実務工程は担当領域に応じて深さが変わるため、実務選択が妥当と判断した。結果として必修は199節・24時間5分のまま変わっていない。

## 追加した演習

| 番号 | タイトル | 難易度 | 推定時間 | 環境区分 | starter | solution |
|---|---|---|---:|---|---|---|
| 27.5 | 課題27.5: 曖昧な要望を検証可能な仕様へ変換する (★★★) | ★★★ | 150分 | local-automated | `code/ch27/spec-to-tests/starter/main.ts`（実行入口 `starter/report.ts`） | `code/ch27/spec-to-tests/solution/main.ts`、`code/ch27/spec-to-tests/solution/report.ts` |

### 題材

「プロジェクトに同僚を招待できるようにしてほしい」という1行の要望だけを与え、小規模なWeb機能（プロジェクトへのメンバー招待）を仕様化させる。組織・プロジェクト・招待・ロールという、本書が第30章で扱うSaaSと同じ題材から最小の1機能を切り出している。

### 実装前の判断と実装後の検証をつなぐ構造

読者が実装するのは次の4つで、いずれも同じ1つの仕様データを参照する。

1. `buildInvitationSpec()` — ストーリー、業務ルール（BR-01〜BR-05）、遷移表（4状態 × 3事象 = 12マス）、例（E-01〜E-13）、API契約（10エントリ・6ステータス）、非機能要件を1つの値として返す。27.13〜27.17 の各工程の出力が、そのままフィールドに対応する。
2. `createInvitationService()` — 遷移表と業務ルールに従う実装。
3. `runAcceptanceChecks(spec, factory)` — 期待値をテストコードへ直書きせず、`spec.examples` だけを読んで実行・判定する。
4. `auditSpec(spec, report)` — 例の紐づかない業務ルール、遷移表の空欄、一度も観測されない契約ステータス、契約にないのに返されたステータスを検出する。

この構造により、仕様に書いたのに誰も検証していない項目が機械的に検出される。章テストには、仕様と検証の1対1対応を確かめるミューテーション検査も入れた（`ttlDays` を7から14へ変えると、期限に関わる E-01・E-08・E-09 の3件だけが落ちる）。

実行結果:

```
spec audit: rules=5 covered=5 / transitions=12 filled=12 / statuses=6 exercised=6
acceptance: 13/13 passed
```

### 章テストへの追加

`code/ch27/solutions.test.ts` へ3件を追加した（章テストは4件 → 7件）。

- `spec drives acceptance checks` — 全例が通り、監査の4指標がすべて0件であること
- `breaking one rule fails only its examples` — 導出ルールを壊すと、対応する例だけが落ちること
- `transition table has no empty cell` — 遷移表12マスに空欄がないこと

## 変更・新規作成したファイル

### 本文・参照

| ファイル | 種別 | 内容 |
|---|---|---|
| `08-part7-practice.md` | 変更 | 27.13〜27.17 を新設、実装課題を 27.18 へ移動、課題27.5 を追加、第27章の導入文と章末統合文を更新、30.1 へ接続文を2か所追加 |
| `09-references.md` | 変更 | 一次資料14件を追加（後述） |
| `01-toc.md` | 生成 | `generate:handbook` で再生成 |
| `10-index.md` | 生成 | `generate:handbook` で再生成。索引語20件が新設節を指す |
| `LEARNING_LEVELS.md` | 生成 | `apply:learning-levels` で再生成 |
| `LEARNING_PATHS.md` | 生成 | `generate:learning-paths` で再生成 |
| `CODE_EXERCISES.md` | 生成 | `generate:exercise-catalog` で再生成 |
| `code/ch27/README.md` | 生成 | `generate:exercise-catalog` で再生成 |
| `NARRATIVE_ARCHITECTURE.md` | 変更 | 第VII部と第27章の因果の鎖に仕様化を追記 |
| `README.md` | 変更 | 節数385→390、演習132→133、課題136→137 |
| `CONTRIBUTING.md` | 変更 | クリーン環境区分の件数132→133 |
| `CLEAN_ENVIRONMENT.md` | 変更 | ローカル自動102→103、全演習件数132→133 |

### 正本（config）

| ファイル | 内容 |
|---|---|
| `config/learning-levels.json` | 27.13〜27.17 を追加、旧 27.13 を 27.18 へ改番（250分→330分）。385節→390節 |
| `config/chapter-guides.json` | 第27章の到達目標、中核概念（27.14・27.15 を追加）、最小実装・演習節（27.18 へ）、典型的な失敗、診断、判断、評価基準、一次資料を更新 |
| `config/learning-paths.json` | バックエンド・DB強化とテックリード・設計強化の「設計」ステージへ 27.13〜27.17 を追加。標準通読は必修のみの構成を維持するため変更せず |
| `config/exercises.json` | 課題27.5 を schemaVersion 2 の全必須フィールド付きで追加（132→133演習） |
| `config/clean-environment-plan.json` | 課題27.5 を `local-automated` として追加。件数 132→133、local-automated 102→103 |

### コード

| ファイル | 種別 |
|---|---|
| `code/ch27/spec-to-tests/README.md` | 新規 |
| `code/ch27/spec-to-tests/starter/main.ts` | 新規（開始地点） |
| `code/ch27/spec-to-tests/starter/report.ts` | 新規（実行入口） |
| `code/ch27/spec-to-tests/solution/main.ts` | 新規（模範解答） |
| `code/ch27/spec-to-tests/solution/report.ts` | 新規（実行入口） |
| `code/ch27/solutions.test.ts` | 変更（テスト3件追加） |

### 検証スクリプト

演習が1件増えたため、件数を固定していた箇所を更新した。

| ファイル | 変更 |
|---|---|
| `scripts/validate-clean-environment.mjs` | 演習正本と台帳の件数 132 → 133 |
| `scripts/validate-clean-environment.test.mjs` | 件数 132 → 133、local-automated 102 → 103 |
| `scripts/apply-learning-levels.test.mjs` | 節数 385 → 390、全分類合計 184時間35分 → 187時間45分 |
| `scripts/validate-handbook.test.mjs` | 節数・学習メタデータ 385 → 390 |

`package.json` は変更していない（新しいスクリプトを追加していないため）。

## 追加した一次資料

`09-references.md` へ、本文で引用した順に次を追加した。既存の引用形式と著者姓のアルファベット順に合わせている。

**書籍**

- [Adzic, 2011] Specification by Example
- [Cockburn, 2000] Writing Effective Use Cases
- [Cohn, 2004] User Stories Applied

**論文・技術レポート**

- [Business Rules Group, 2003] Business Rules Manifesto v2.0
- [Jeffries, 2001] Essential XP: Card, Conversation, Confirmation
- [North, 2006] Introducing BDD
- [Wake, 2003] INVEST in Good Stories, and SMART Tasks
- [Wynne, 2015] Introducing Example Mapping

**RFC・公式仕様**

- [ISO/IEC 25010:2023] SQuaRE 製品品質モデル（9つの品質特性）
- [JSON Schema, 2020] JSON Schema 2020-12
- [OMG, 2017] UML 2.5.1（状態機械）
- [RFC 9457] Problem Details for HTTP APIs（RFC 7807 を置き換え）

**オンラインリソース・標準**

- [Cucumber Gherkin Reference] Gherkin Reference
- [Robinson, 2006] Consumer-Driven Contracts

既存の [OpenAPI, 2021]、[Beyer et al., 2016]、[Evans, 2003] は本文から追加で参照している。断定を避けるため、ISO/IEC 25010 は「2023年の改訂版では9つの品質特性を挙げている」、スキーマ駆動の3方式は「排他ではない」「判断軸は契約の読者と並行作業の要否」といった条件付きの記述にしている。

## 実行した検証

```
pnpm run validate:exercises        → 終了コード0
pnpm run validate:narrative-flow   → 終了コード0
pnpm run validate:handbook         → 終了コード0
pnpm run check:handbook            → 終了コード0
```

`check:handbook` の内訳（すべて成功）:

| 検査 | 結果 |
|---|---|
| `apply:learning-levels:check` | 390節で差分なし |
| `generate:learning-paths:check` | 6ルートで差分なし（標準通読は199節・24時間5分を維持） |
| `apply:chapter-guides:check` | 30章で差分なし |
| `apply:exercise-rubrics:check` | 演習カード137件で差分なし |
| `generate:exercise-catalog:check` | 31ファイルで差分なし |
| `generate:handbook:check` | 目次・アンカー・索引で差分なし |
| `test:handbook` | 75テスト成功、失敗0 |
| `validate:clean-environment` / `test:clean-environment` | 133演習、local-automated 103 / local-tls 7 / external-service 17 / browser-manual 6 |
| `validate:exercises` | 演習133件、観察課題4件、演習カード137 / 見出し137 |
| `validate:narrative-flow` | 30章すべて completed |
| `validate:beta-review` | 章30（core 15 / exercise-only 5 / sampled 10）、演習37、必修節199 — KEN-48時点と同一 |
| `validate:handbook` | **ERROR 0 / WARN 27** |

`validate:handbook` の WARN 27件は、いずれも作業前から存在する `ANCHOR_DUPLICATE`（`#コード集の使い方` など、章ごとに同じ見出しを持つことによる自動アンカー重複）で、件数・内容とも作業前と完全に一致する。新設節では、既存の第4階層見出しと衝突しない見出し名を選び、警告を1件も増やしていない。

第27章のコード教材の個別検証:

```
node scripts/validate-exercises.mjs --chapter ch27   → 演習5件、starter 5、solution 6 で成功
tsc --noEmit -p code/ch27/tsconfig.json              → エラー0
tsx --test code/ch27/solutions.test.ts               → 7件成功、失敗0
tsx code/ch27/spec-to-tests/solution/report.ts       → audit 全項目充足、acceptance 13/13
```

`pnpm run validate:workspace` は本作業環境の Node.js が v26 のため作業前から失敗する（本書の固定版は 24.18.0）。この失敗は本変更とは無関係である。

## 完了条件の達成根拠

### 1. 第27〜30章または前段に自然に統合

- 新規章を作らず、第27章へ 27.13〜27.17 の5節と課題27.5 を追加した。章数は30のまま、`code/ch01`〜`code/ch30` の構成も不変である。
- 各節は `NARRATIVE_EDITING_GUIDE.md` の方針どおり、前節で残った問題を受け取る接続文（`handbook:narrative-bridge`）から始まる。27.13 は 27.12 の組織論から「そもそも何を作るかの合意」へ、27.17 は 27.18 の実装課題へつながる。第27章の narrative-bridge は13件から18件へ増えた。
- 章の導入文と章末の統合文を書き換え、前半のモデリングと後半の仕様化が1つの章として説明できる形にした。
- 第30章 30.1 から 27.13〜27.17 と 27.16 を参照し、総合演習の要件定義がこの工程の出力であることを明示した。

### 2. 小規模なWeb機能を仕様化する演習がある

- 課題27.5 は「プロジェクトへのメンバー招待」という小規模なWeb機能を、1行の要望から仕様化する演習である。
- `config/exercises.json` に schemaVersion 2 の必須フィールドをすべて揃えて登録した（目的、難易度、推定時間、推定時間の内訳、前提5件、完成条件6件、期待出力5件、観察項目5件、テスト方法4件、段階的ヒント3段、本番利用時の警告3件、starter/solution の導線）。`validate:exercises` が欠落・定型文・導線不一致を検出しないことを確認済みである。
- starter / solution は既存の複数ファイル型の命名規約（`exercise/starter/` と `exercise/solution/` と `exercise/README.md`）に従って作成し、章READMEは `generate:exercise-catalog` で再生成した。

### 3. 実装前の判断と実装後の検証がつながっている

- 本文側: 27.14 の遷移表とルール表が 27.15 の例になり、例が 27.16 の契約ステータス表になり、27.17 で非機能要件が測定条件付きの数値になる。各段でルールID（BR-xx）とNFR-IDを引き継ぎ、テスト名へIDを含める書き方を示した。
- 演習側: 仕様データ（`buildInvitationSpec`）、実装（`createInvitationService`）、受け入れテスト（`runAcceptanceChecks`）が同じ1つの仕様を参照する構造にした。期待値をテストコードへ直書きすることを完成条件で禁止している。
- 検証の網羅性そのものを検査する `auditSpec` を用意し、「仕様に書いたのに誰も検証していない項目」（例の紐づかないルール、遷移表の空欄、観測されない契約ステータス、契約にないステータス）を機械的に検出できるようにした。
- 章テストのミューテーション検査により、仕様と検証の対応が1対1であること自体を自動で確認できる。

## 積み残し・判断の記録

### `config/narrative-flow.json` の `minimumBridgeCount` は変更していない

第27章の実際の接続文は13件から18件へ増えたが、マニフェストの `minimumBridgeCount` は13のまま据え置いた。この値は下限であり、`validate:narrative-flow` は「実際の件数 ≥ 下限」を検査するため整合は取れている。

据え置いた理由は、この値が `scripts/validate-beta-review.mjs` の選定基準 C4 の入力にもなっているためである。全30章の `minimumBridgeCount` の第75パーセンタイルは14で、第27章を14以上へ上げると C4 に一致し、既存の C1 と合わせて2条件成立となり、第27章の tier が `sampled` から `core` へ変わる。その結果、`beta-review-scope.json`（KEN-60、別エージェントが並行編集中で本作業では変更禁止）の章エントリ、必須検証演習、役割別工数、集計値が一斉に不整合になる。KEN-60 側の作業が収束した後、下限を18へ引き上げるかどうかを別途判断するのが安全である。

### 第27章の読了負荷

第27章の推定時間は 6時間10分 から 9時間20分 へ増えた（必修は55分のまま、実務選択が5時間15分から8時間25分へ）。内訳は新設5節110分と、演習1件追加に伴う実装課題節の80分である。全分類合計は 184時間35分 から 187時間45分（+3時間10分、+1.7%）で、必修のみの初回通読（199節・24時間5分）は変わらない。WS4（KEN-32）の「新規内容が全体の読了負荷を過度に増やしていない」に照らし、初回通読の負荷は不変、選択的に読む範囲のみ増えた形になっている。

### 文体について

本文は既存の第VII部と同じ常体（だ・である調）で執筆した。README や CONTRIBUTING などの運用文書は敬体だが、本文Markdownは全編が常体であるため、そちらに合わせている。

### 今後の候補

- 課題27.5 の契約には認証・認可の失敗（401 / 403）とレート制限（429）を含めていない。演習カードの「本番利用時の警告」に明記したが、第13章と接続する発展課題として拡張の余地がある。
- 27.16 で自作した最小スキーマ検証は、JSON Schema 2020-12 の一部しか表現できない。ツールを使う判断（生成物を正本にするか）を扱う発展資料は将来版の候補とする。
