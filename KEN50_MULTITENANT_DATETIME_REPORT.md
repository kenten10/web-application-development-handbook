# KEN-50 マルチテナントSaaSと日時設計を補完する — 実施レポート

## 目的

本書はSaaSを題材にしながら、複数の顧客企業が1つのアプリケーションと1つのデータベースを共有するときに必要な判断を、まとまった形では扱っていなかった。第30章にテナント分離戦略とRLSの断片はあるが、境界がどの経路から破れるか、破れたときに何が起きるか、データベース側でどう宣言するかは書かれていない。日時も同様で、第5章の国際化と第14章のDB章の間に、瞬間・ローカル日時・カレンダー日を区別する話が入る場所がなかった。

KEN-50では、この2つを既存章へ横断的に統合し、テナント漏洩と日時バグをそれぞれ実際に再現できる演習と、実装前に使う設計チェックリストを追加する。

## 横断配置の設計判断

### 章番号は振り直さず、既存章へ節として統合した

書名・目次・学習経路・索引・`code/ch01`〜`code/ch30`・検証スクリプトのすべてに「30章」が埋め込まれているため、新規章は作らない。KEN-49 と同じ方針である。

### なぜ「単一章ではなく3章へ分散」か

issue の完了条件が「データ編・認証編・総合演習へ横断的に反映」であり、扱う5項目は性質の異なる3つの層に属する。

| issue の扱う内容 | 配置 | 章を選んだ理由 |
|---|---|---|
| tenant境界、認可 | 13.24（新設・認証編） | 13.10 の認可モデルと 13.11 の中央集権化のすぐ後に、「権限判定の前にどのテナントかを決める」次元を足すのが最短の接続。境界の破れ方は 23.7 のIDORと同じ形をしており、認可の話として読むのが自然 |
| Row-Level Security | 14.20（新設・データ編） | RLSはPostgreSQLの機能であり、所有者バイパスと接続プールの相互作用（14.19 の直後）が本題。認証編に置くと、SQLとプーラの話が章の文脈から浮く |
| tenant別設定・暗号鍵・データ移行 | 14.21（新設・データ編） | 保存先の設計、鍵と行の対応、移行手順はいずれもデータ層の話。14.12 のマイグレーションの延長線上にある |
| noisy neighbor とリソース分離 | 14.22（新設・データ編） | 症状の中心が共有DBの資源（接続・IO・ロック・VACUUM）であり、14.18・14.19 の直後に置くと観測手段がそのまま使える。26.8 の Bulkhead と 26.11 のバックプレッシャーへは相互参照でつないだ |
| UTC、タイムゾーン、DST、カレンダー日 | 14.23（新設・データ編） | 「その行は誰のものか」の次に「その行はいつのものか」を置く構成。DBの型（14.24）へ直結する概念節であり、第5章の i18n から分離しておくほうが参照しやすい |
| DB日時型、定期実行、ユーザー表示 | 14.24（新設・データ編） | `timestamptz` と `AT TIME ZONE` はRDB章の内容。定期実行は 17.6 のジョブキューへ、表示は 5.11・9.2・24.5 へ相互参照した |
| 設計チェックリスト | 30.14（新設・総合演習） | チェックリストは特定の技術の説明ではなく、機能横断で効く判断の洗い出しである。第30章は「個別の判断を1つの製品へ統合する」章であり、30.1〜30.13 のどの節にも属さない前提を確認する場所として最も適切 |

演習は「認証編に漏洩、データ編に日時」と分けた。境界の破れ方は認可の理解が前提であり、日時はDBの型と定期実行が前提だからである。総合演習には演習を足さず、チェックリストという形で両方を回収した。

### 既存記述との重複を避けた方法

- 30.3 のマルチテナント分離戦略（Shared DB 採用の記述）と 30.4 の RLS の最小例は**残したまま**、その直後に「この最小形はどこで効かなくなるか」と「境界の破れ方と正当な越境は 13.24」への接続文を足した。30.4 の SQL は3か所（所有者接続、`WITH CHECK` なし、`SET LOCAL` でない）で効かなくなるが、その指摘だけを 30.4 に置き、対処は 14.20 に集約している。
- 13.10 の認可モデルと 13.11 の中央集権化は再説明せず、13.24 では「ロールを見る前にテナント文脈を確定させる」という順序の話に絞った。
- 14.19 の Connection Pooler は再説明せず、14.20 の `SET LOCAL` の節から参照している。
- 5.11 の国際化、24.5 のキャッシュ、26.7/26.8/26.11 の耐障害性パターン、28.14 の規制対応は、いずれも参照のみで再説明していない。

### なぜ節を実装課題の直前へ置いたか

KEN-49 と同じ理由である。第13章・第14章・第30章のいずれも、番号が動くのは実装課題の節1つだけで済む（13.24 → 13.25、14.20 → 14.25、30.14 → 30.15）。これらはいずれも必修ではないため、`beta-review-scope.json` の必修節一覧（199節）に影響しない。

### 学習レベルはすべて「実務選択」

新設7節はすべて `practical` とした。必修を増やすと `beta-review-scope.json` の `requiredSectionCount`（199）、章別 `requiredMinutes`、選定しきい値の分位点、章の tier が一斉にずれる。内容としても、マルチテナントと日時は担当領域によって必要な深さが変わるため、実務選択が妥当である。結果として必修は199節・24時間5分のまま変わっていない。

## 追加した節・小節の一覧

| 節 | 学習レベル | 推定時間 | 行数 | 文字数 | 主な小節 |
|---|---|---:|---:|---:|---|
| 13.24 マルチテナントの認可とテナント境界 | 実務選択 | 25分 | 168 | 6,557 | テナント識別子をどこから受け取るか／3段階の判定／破れる典型経路8種／型で強制する／正当な越境／外側にもう一枚／つまずく箇所 |
| 14.20 テナント分離モデルと Row-Level Security | 実務選択 | 25分 | 208 | 7,837 | 3つの分離モデル／RLSの基本／効かなくなる4条件／PERMISSIVE と RESTRICTIVE／性能への影響／ポリシーをテストする／つまずく箇所 |
| 14.21 テナント別設定・暗号鍵・データ移行 | 実務選択 | 20分 | 180 | 6,285 | 設定の解決順序／エンベロープ暗号化とBYOK／暗号消去／テナント単位のデータ移行／解約時の段階／つまずく箇所 |
| 14.22 noisy neighbor とリソース分離 | 実務選択 | 20分 | 155 | 5,591 | 現象と症状／テナント別の観測／対策を層で分ける／公平キュー／公平性とスループット／つまずく箇所 |
| 14.23 UTC、タイムゾーン、DST、カレンダー日 | 実務選択 | 25分 | 160 | 6,934 | 3種類の時間／タイムゾーンはオフセットではない／DSTの3つの落とし穴／カレンダー日／JavaScriptでの扱い／つまずく箇所 |
| 14.24 DB日時型、定期実行、ユーザー表示 | 実務選択 | 25分 | 188 | 7,398 | PostgreSQLの日時型／期間の加算とインデックス／他のデータストア／定期実行／ユーザー表示／つまずく箇所 |
| 30.14 マルチテナントと日時の設計チェックリスト | 実務選択 | 15分 | 116 | 3,869 | A. マルチテナント設計（6群31項目）／B. 日時設計（6群27項目）／使い方 |
| 課題13.7 の本文（13.25 内） | — | — | 110 | 5,155 | 題材、4つの実装要件、経路の表、評価基準、期待出力 |
| 課題14.6 の本文（14.25 内） | — | — | 101 | 4,587 | 題材、4つの実装要件、誤りの表、評価基準、期待出力 |
| 合計 | — | 155分 | 1,386 | 54,213 | — |

各節は、コード例（TypeScript、SQL、JSON）、表、ASCII図、実務での落とし穴、一次資料への出典を備えている。既存節（14.19 は112行/15分、14.18 は138行/20分）と比べ、行数あたりの推定時間は同水準に揃えた。

### 章番号・節番号

- 章数は30のまま。新規章は作っていない。
- 実装課題の節番号を3件だけ移動した（13.24 → 13.25、14.20 → 14.25、30.14 → 30.15）。他章の節番号は変更していない。
- 節数は 390 → 397 になった。
- 実装課題節の推定時間は、演習1件増に比例して調整した（13.25: 300→350分、14.25: 300→360分、30.15: 85分のまま）。

### 見出しの重複回避

新設5節が同じ `#### つまずく箇所` を持つと `ANCHOR_DUPLICATE` 警告が4件増えるため、すべてに識別子を付けた（`つまずく箇所 ― テナント境界`、`― テナント分離モデル`、`― テナント別の設定と鍵と移行`、`― リソース分離`、`― タイムゾーンとDST`、`― 日時型と定期実行`）。結果として警告は増えていない。

## 追加した演習

| 番号 | タイトル | 難易度 | 推定時間 | 環境区分 | starter | solution |
|---|---|---|---:|---|---|---|
| 13.7 | 課題13.7: テナント境界の漏洩を再現して塞ぐ (★★★) | ★★★ | 150分 | local-automated | `code/ch13/tenant-isolation/starter/main.ts`（実行入口 `starter/report.ts`） | `code/ch13/tenant-isolation/solution/main.ts`、`solution/report.ts` |
| 14.6 | 課題14.6: 日時バグを再現して直す (★★★) | ★★★ | 150分 | local-automated | `code/ch14/datetime-pitfalls/starter/main.ts`（実行入口 `starter/report.ts`） | `code/ch14/datetime-pitfalls/solution/main.ts`、`solution/report.ts` |

どちらも外部サービスを使わない `local-automated` にした。理由は2つある。第一に、PostgreSQL を必須にすると `clean-environment-plan.json` の `environmentDependent` が増え、`validate-beta-review.mjs` の選定基準 E1 に該当して `beta-review-scope.json` と `BETA_REVIEW_SCENARIOS.md`（KEN-60 の成果物）を書き換える必要が生じる。第二に、RLS の学習目的は `USING` と `WITH CHECK` の役割の違い、所有者バイパス、接続文脈の残留という3点の理解であり、これらはポリシー層を自作すれば同じ精度で観察できる。実際のSQLは 14.20 に置き、実行結果（`.verification/ken67/logs/30.1-rls.out` に既存）と対応づけている。

### 課題13.7 が再現するもの

境界の抜けた `createUnsafeApi` に対して、テナントB の立場から4経路を試す。

| 経路 | 抜けている検査 | 再現される事象 |
|---|---|---|
| L1 `direct-id-read` | 主キー取得で所有テナントを見ていない | テナントA のタスクを読める |
| L2 `search-index` | 全文検索の索引を先に引く | テナントA のタスクが検索結果に混じる |
| L3 `parent-reassign` | 移動先プロジェクトを検査していない | 自テナントのタスクを他テナントへ移せる |
| L4 `cache-key` | キャッシュキーにテナントがない | 先に温めた他テナントの一覧が返る |

同じ `probeLeaks` を、`USING` / `WITH CHECK` を持つポリシー層つき実装へ差し替えると 0/4 になる。加えて、`FORCE ROW LEVEL SECURITY` を模した `force` フラグの有無で所有者接続が素通りすること、`SET LOCAL` 相当がないときに接続の使い回しで前テナントの文脈が残ることを再現する。

実行結果:

```
unguarded api: 4/4 leaks reproduced
  L1 direct-id-read: leaked=true (read tsk_a1 of ten_a)
  L2 search-index: leaked=true (foreign hits=1)
  L3 parent-reassign: leaked=true (moved into prj_a1 of ten_a)
  L4 cache-key: leaked=true (foreign rows=2)
guarded api: 0/4 leaks reproduced
  L1 direct-id-read: leaked=false (not found)
  L2 search-index: leaked=false (foreign hits=0)
  L3 parent-reassign: leaked=false (NotFoundError)
  L4 cache-key: leaked=false (foreign rows=0)
owner bypass: without force=true / with force=false
session pool: without SET LOCAL=true / with SET LOCAL=false
```

### 課題14.6 が再現するもの

固定の日時（`FIXTURES`）に基づき、素朴な実装で4件の誤りを再現する。

| 番号 | 誤り | 再現される事象 |
|---|---|---|
| D1 `dst-skipped-run` | 初回の瞬間に24時間を足し続ける | `America/New_York` のDST開始日以降、現地の実行時刻が1時間ずれ続ける |
| D2 `calendar-day-as-instant` | 締切日をUTCの00:00とみなす | `Asia/Tokyo` の利用者が、締切日の当日の朝から期限切れになる |
| D3 `add-24h-vs-add-1-day` | 「翌日の同じ時刻」を24時間加算で表す | DST終了日に壁時計が1時間戻る |
| D4 `daily-bucket-boundary` | UTCの日境界で集計する | 利用者の「その日」と件数が一致しない |

修正実装では4件とも再現しなくなる。D1 だけは切り替え日の1件が残るが、これは「存在しない時刻を切り替え後へ送る」という明示した解決規則によるものであり、誤りではない旨を評価基準に書いている。

実行結果:

```
naive implementation: 4/4 bugs reproduced
  D1 dst-skipped-run: naive drift days=3 / fixed drift days=1
  D2 calendar-day-as-instant: naive overdue=true / fixed overdue=false
  D3 add-24h-vs-add-1-day: naive local=2026-11-01 19:00 / fixed local=2026-11-01 20:00
  D4 daily-bucket-boundary: naive count=3 / fixed count=4
fixed implementation: 0/4 bugs remaining
```

`TZ=UTC` / `TZ=Asia/Tokyo` / `TZ=America/New_York` / `TZ=Pacific/Kiritimati` の4通りで実行し、出力が一致することを確認済みである。

### 演習カードの必須フィールド

KEN-48 で定義された全項目を両方に揃えた（目的、難易度、推定時間、推定時間の内訳、前提4〜5件、完成条件6〜7件、期待出力5件、観察項目5件、テスト方法4件、段階的ヒント3段、本番利用時の警告3件、starter/solution の導線）。`validate:exercises` が欠落・定型文・導線不一致・★数不一致を検出しないことを確認している。

観察項目は、実際にコードを書き換えて挙動を確認し、記載どおりの結果になることを検証した。

| 書き換え | 実測結果 |
|---|---|
| キャッシュキーからテナントを外す | L4 だけが `leaked=true` に戻る |
| moveTask の移動先 `visible` 検査だけを外す | 4件とも `leaked=false` のまま（`assertWritable` が止める） |
| 上記に加えて `assertWritable` も外す | L3 だけが `leaked=true` に戻る |
| `force=false` かつ `owner=true` | 4件すべてが `leaked=true` に戻る |

### 章テストへの追加

- `code/ch13/solutions.test.ts` へ3件追加（6件 → 9件）: 漏洩の再現と解消、`WITH CHECK` による書き込み拒否、所有者バイパスと接続使い回しの観測。
- `code/ch14/solutions.test.ts` へ2件追加（4件 → 6件）: 存在しない時刻と二度ある時刻の解決、4つの日時バグの再現と解消。

## 追加した設計チェックリスト

**場所**: 30.14 マルチテナントと日時の設計チェックリスト（`08-part7-practice.md`）

**項目数**: 合計58項目 / 12グループ

| 区分 | グループ | 項目数 |
|---|---|---:|
| A. マルチテナント設計 | A-1 境界の定義 / A-2 認可 / A-3 データ層の防御 / A-4 設定・鍵・移行 / A-5 リソース分離 / A-6 運用 | 31 |
| B. 日時設計 | B-1 保存 / B-2 計算 / B-3 実行環境 / B-4 定期実行 / B-5 表示と契約 / B-6 検証 | 27 |

各項目には参照節を併記し、判断に必要な本文へ直接戻れるようにした。使い方として、30.15 の実装課題の前後に2回使うこと（1回目は設計判断の抜け、2回目は「決めたが実装されていない項目」の発見）と、課題13.7 が A-2/A-3 を、課題14.6 が B-2/B-4 を実際に再現することを明記した。

## 変更・新規作成したファイル

### 本文・参照

| ファイル | 種別 | 内容 |
|---|---|---|
| `04-part3-backend.md` | 変更 | 13.24 新設、実装課題を 13.25 へ、課題13.7 追加、第13章の導入文を更新 |
| `05-part4-data.md` | 変更 | 14.20〜14.24 新設、実装課題を 14.25 へ、課題14.6 追加、第14章の導入文と第15章への接続文を更新、一次資料の引用9か所を追加 |
| `08-part7-practice.md` | 変更 | 30.14 新設、実装課題を 30.15 へ、第30章の導入文と第VII部の総括を更新、30.3・30.4 へ接続文を追加 |
| `09-references.md` | 変更 | 一次資料11件を追加（後述） |
| `01-toc.md` | 生成 | `generate:handbook` で再生成 |
| `10-index.md` | 生成 | `generate:handbook` で再生成。索引語22件が新設節を指す |
| `LEARNING_LEVELS.md` | 生成 | `apply:learning-levels` で再生成 |
| `LEARNING_PATHS.md` | 生成 | `generate:learning-paths` で再生成 |
| `CODE_EXERCISES.md` | 生成 | `generate:exercise-catalog` で再生成 |
| `CHAPTER_TEMPLATE.md` | 生成 | `apply:chapter-guides` で再生成（参照可能節 390 → 397） |
| `NARRATIVE_ARCHITECTURE.md` | 変更 | 第IV部、第13章・第14章・第30章の因果の鎖にテナント境界と日時を追記 |
| `README.md` | 変更 | 節数 390→397、演習 133→135、課題 137→139（追記のみ、他の記述は変更なし） |
| `CONTRIBUTING.md` | 変更 | クリーン環境区分の件数 133→135 |
| `CLEAN_ENVIRONMENT.md` | 変更 | ローカル自動 103→105、全演習件数 133→135 |

### 正本（config）

| ファイル | 内容 |
|---|---|
| `config/learning-levels.json` | 13.24、14.20〜14.24、30.14 を追加。旧 13.24→13.25（350分）、14.20→14.25（360分）、30.14→30.15 へ改番。390節→397節 |
| `config/chapter-guides.json` | 第13章・第14章・第30章の到達目標、中核概念、最小実装・演習節、典型的な失敗、診断、判断、評価基準、一次資料を更新 |
| `config/learning-paths.json` | backend-db・security・tech-lead・infra-sre・frontend の該当ステージへ新設節を追加。標準通読は必修のみの構成のため変更なし。各ルートの章集合は変わっていない |
| `config/exercises.json` | 課題13.7・課題14.6 を schemaVersion 2 の全必須フィールド付きで追加（133→135演習） |
| `config/clean-environment-plan.json` | 2件を `local-automated` として追加。件数 133→135、local-automated 103→105 |
| `config/narrative-flow.json` | 第13章 24→25、第14章 20→25、第30章 14→15 へ `minimumBridgeCount` を更新（実際の接続文数と一致） |
| `narrative-flow.json`（リポジトリ直下の同内容コピー） | 上と同じ更新 |

### 検証スクリプト・照合対象

| ファイル | 変更 |
|---|---|
| `scripts/validate-clean-environment.mjs` | 演習正本と台帳、カテゴリ集計の件数 133 → 135 |
| `scripts/validate-clean-environment.test.mjs` | 件数 133 → 135、local-automated 103 → 105 |
| `scripts/apply-learning-levels.test.mjs` | 節数 390 → 397、全分類合計 187時間45分 → 192時間10分 |
| `scripts/validate-handbook.test.mjs` | 節数・学習メタデータ 390 → 397 |
| `beta-review-scope.json` | 第13章・第14章・第30章の `metrics.minimumBridgeCount` を正本と一致させた（詳細は後述） |

`package.json` は変更していない（新しいスクリプトを追加していないため）。

### コード

| ファイル | 種別 |
|---|---|
| `code/ch13/tenant-isolation/README.md` | 新規 |
| `code/ch13/tenant-isolation/starter/main.ts` | 新規（開始地点） |
| `code/ch13/tenant-isolation/starter/report.ts` | 新規（実行入口） |
| `code/ch13/tenant-isolation/solution/main.ts` | 新規（模範解答） |
| `code/ch13/tenant-isolation/solution/report.ts` | 新規（実行入口） |
| `code/ch13/solutions.test.ts` | 変更（テスト3件追加） |
| `code/ch14/datetime-pitfalls/README.md` | 新規 |
| `code/ch14/datetime-pitfalls/starter/main.ts` | 新規（開始地点） |
| `code/ch14/datetime-pitfalls/starter/report.ts` | 新規（実行入口） |
| `code/ch14/datetime-pitfalls/solution/main.ts` | 新規（模範解答） |
| `code/ch14/datetime-pitfalls/solution/report.ts` | 新規（実行入口） |
| `code/ch14/solutions.test.ts` | 変更（テスト2件追加） |
| `code/ch13/README.md`、`code/ch14/README.md` | 生成（`generate:exercise-catalog`） |

## 追加した一次資料

`09-references.md` へ、既存の形式と並び順に合わせて次を追加した。

**RFC・公式仕様**

- [ECMA-402] ECMAScript Internationalization API Specification（`Intl.DateTimeFormat` の `timeZone`）
- [NIST SP 800-57 Part 1, 2020] Recommendation for Key Management: Part 1 – General (Rev. 5)
- [RFC 3339] Date and Time on the Internet: Timestamps
- [RFC 6557] Procedures for Maintaining the Time Zone Database
- [RFC 9557] Date and Time on the Internet: Timestamps with Additional Information

**オンラインリソース・標準**

- [AWS SaaS Lens, 2024] SaaS Lens — AWS Well-Architected Framework（サイロ・プール・ブリッジの語彙）
- [IANA Time Zone Database] Time Zone Database
- [PostgreSQL Date/Time Types] Date/Time Types
- [PostgreSQL Row Security Policies] Row Security Policies
- [TC39 Temporal] Temporal proposal
- [Unicode CLDR] Common Locale Data Repository

本文からは9か所で明示的に引用している。断定を避けるため、`Temporal` は「標準化が進んでいる」「実装状況は処理系ごとに異なるため、採用前に対象ランタイムでの利用可否とポリフィルの要否を確認する」、3引数の `date_trunc` は「PostgreSQL 16 で追加された。対象バージョンによっては `AT TIME ZONE` を使う形に統一しておくほうが移植しやすい」、cron のDST時の挙動は「実装ごとに異なるため、切り替え日の挙動を確認せずに使わない」といった条件付きの記述にしている。

## 実行した検証

```
pnpm run validate:exercises        → 終了コード0
pnpm run validate:narrative-flow   → 終了コード0
pnpm run validate:beta-review      → 終了コード0
pnpm run validate:handbook         → 終了コード0
pnpm run check:handbook            → 終了コード0
```

`check:handbook` の内訳（すべて成功）:

| 検査 | 結果 |
|---|---|
| `apply:learning-levels:check` | 397節で差分なし |
| `generate:learning-paths:check` | 6ルートで差分なし（標準通読は199節・24時間5分を維持） |
| `apply:chapter-guides:check` | 30章で差分なし |
| `apply:exercise-rubrics:check` | 演習カード139件で差分なし |
| `generate:exercise-catalog:check` | 31ファイルで差分なし |
| `generate:handbook:check` | 目次・アンカー・索引で差分なし |
| `test:handbook` | 全テスト成功、失敗0 |
| `validate:clean-environment` / `test:clean-environment` | 135演習、local-automated 105 / local-tls 7 / external-service 17 / browser-manual 6 |
| `validate:exercises` | 演習135件、観察課題4件、演習カード139 / 見出し139 |
| `validate:narrative-flow` | 30章すべて completed |
| `validate:beta-review` | 章30（core 15 / exercise-only 5 / sampled 10）、演習37（4530分）、必修節199 — 作業前と完全に同一 |
| `validate:release-policy` | ERROR 0 / WARN 0 |
| `validate:handbook` | **ERROR 0 / WARN 27** |

### WARN 件数

- 作業前: **ERROR 0 / WARN 27**（すべて既存の `ANCHOR_DUPLICATE`）
- 作業後: **ERROR 0 / WARN 27**
- **増減なし。** 一度は新設5節の `#### つまずく箇所` が同一ファイル内で重複して WARN が31件へ増えたため、見出しに識別子を付けて27件へ戻した。作業前後の警告一覧を照合し、内容が同一（行番号のみ移動）であることを確認済みである。

### 章のコード教材の個別検証

```
node scripts/validate-exercises.mjs --chapter ch13   → 演習7件、starter 7、solution 9 で成功
node scripts/validate-exercises.mjs --chapter ch14   → 演習6件、starter 6、solution 7 で成功
tsc --noEmit -p code/ch13/tsconfig.json              → エラー0
tsc --noEmit -p code/ch14/tsconfig.json              → エラー0
tsx --test code/ch13/solutions.test.ts               → 9件成功、失敗0
tsx --test code/ch14/solutions.test.ts               → 6件成功、失敗0
pnpm --filter @handbook/ch13 exec tsx tenant-isolation/solution/report.ts   → 4/4 → 0/4
pnpm --filter @handbook/ch14 exec tsx datetime-pitfalls/solution/report.ts  → 4/4 → 0/4
```

starter 側も型検査を通り、`report.ts` が例外なく実行できる（未実装のため 0/0 を出力する）ことを確認している。

`pnpm run validate:workspace` は本作業環境の Node.js が v26 のため作業前から失敗する（本書の固定版は 24.18.0）。この失敗は本変更とは無関係である。

## 完了条件の達成根拠

### 1. データ編・認証編・総合演習へ横断的に反映

- **認証編（第13章）**: 13.24 を新設し、テナント識別子の信頼できる出どころ、認証・所属・権限の3段階、境界が破れる8経路、型による強制、正当な越境（代理ログイン・テナント間共有・横断運用）の権限化を扱った。章の導入文にもテナント境界を追記し、`NARRATIVE_ARCHITECTURE.md` の第13章の鎖を更新した。
- **データ編（第14章）**: 14.20〜14.24 を新設し、分離モデルの選択、RLSの宣言と効かなくなる4条件、テナント別設定・暗号鍵・移行、noisy neighbor、日時の3区分とDB型・定期実行・表示を扱った。章の導入文と第15章への接続文も更新している。
- **総合演習（第30章）**: 30.14 を新設し、両テーマの設計チェックリストを置いた。加えて 30.3（分離戦略とデータモデルの日時項目）と 30.4（RLSの最小例が効かなくなる3か所）へ接続文を追加し、既存の記述を新設節へつないだ。
- 各節は `NARRATIVE_EDITING_GUIDE.md` の方針どおり、前節で残った問題を受け取る接続文（`handbook:narrative-bridge`）から始まる。第13章の接続文は24→25、第14章は20→25、第30章は14→15へ増えた。

### 2. tenant漏洩と日時バグを再現する演習がある

- 課題13.7 は、4つの経路でテナント境界が実際に破れることを `probeLeaks` が検出し（4/4）、ポリシー層を通すと同じ探索が 0/4 になることを示す。さらに、所有者バイパス（`FORCE` 相当の有無）と接続の使い回し（`SET LOCAL` 相当の有無）という、対策があっても無効化される2条件も再現する。
- 課題14.6 は、DST境界での実行漏れ、カレンダー日と瞬間の混同、24時間加算とカレンダー加算の取り違え、日境界のずれという4件を再現し、修正後に0件になることを示す。issue が挙げた3種類（DST境界・タイムゾーン取り違え・カレンダー日と瞬間の混同）をすべて含む。
- 両方とも判定は固定の入力（`FIXTURES`）に基づき、現在時刻・プロセスのタイムゾーン・外部サービスに依存しない。章テストで再現と解消の両方を自動検証している。
- `config/exercises.json` へ schemaVersion 2 の必須フィールドをすべて揃えて登録し、starter / solution は既存の複数ファイル型の命名規約（`exercise/starter/`、`exercise/solution/`、`exercise/README.md`）に従って作成した。

### 3. 設計チェックリストを追加

- 30.14 に、マルチテナント設計31項目（6群）と日時設計27項目（6群）の計58項目を置いた。issue が求める「マルチテナント設計と日時設計の両方」を満たす。
- 各項目には参照節を併記し、判断に必要な本文へ戻れるようにした。使い方（実装前と実装後の2回、演習との対応）も明記している。
- チェックリストの項目は、13.24 と 14.20〜14.24 で扱った内容と1対1で対応しており、本文にない判断を要求していない。

## 積み残し・判断の記録

### `beta-review-scope.json` の更新内容と判断

`validate:beta-review` は `config/narrative-flow.json` の `minimumBridgeCount` を正本として `beta-review-scope.json` の `metrics.minimumBridgeCount` と照合する。接続文が増えたため正本を 24→25 / 20→25 / 14→15 へ更新し、スコープ側の該当メトリクスのみを同じ値へ合わせた。`scripts/validate-beta-review.mjs` の基準は一切変更していない。

更新前に、この変更が選定基準へ波及しないことを確認している。

- 選定基準 C4 のしきい値は全30章の `minimumBridgeCount` の第75パーセンタイルで決まる。更新前後とも **14** で変わらず、C4 に該当する章の集合も変わらない。
- 新設節はすべて `practical` のため、`requiredSections` / `requiredMinutes` は不変（199節・24時間5分）。
- 新設演習は `local-automated` のため `environmentDependent` が増えず、選定基準 C3 と必須検証演習 E1 に該当しない。E2 は「その章に難易度3の E1 演習があれば選出しない」規則で、第13章（13.6）・第14章（14.2）・第30章（30.1）はいずれも該当するため、E2 の選出結果も変わらない。
- 結果として、`validate:beta-review` の出力（章30、core 15 / exercise-only 5 / sampled 10、演習37・4530分、必修節199）は作業前と完全に一致している。

`BETA_REVIEW_PLAN.md` / `BETA_REVIEW_SCENARIOS.md` / `BETA_REVIEW_TEMPLATES.md` は変更していない。必須検証章・必須検証演習が変わっていないため、これらの文書との相互参照検査も通っている。

### `dist/site` の再生成

作業中に別エージェントが `scripts/build-site.mjs` と `build:site` / `build:site:check` を `package.json` へ追加した。本文を変更したため `build:site:check` が「生成物が現在の入力と一致しません」で失敗したので、`pnpm run build:site` を1回実行して再生成した（`dist/` は `.gitignore` 対象の生成物）。再実行後は `build:site:check` も成功する。`package.json` は読み直したうえで変更していない。

### 第13章・第14章・第30章の読了負荷

| 章 | 作業前（必修 / 全体） | 作業後（必修 / 全体） |
|---|---|---|
| 第13章 | 2時間5分 / 13時間5分 | 2時間5分 / 14時間20分 |
| 第14章 | 1時間40分 / 8時間25分 | 1時間40分 / 11時間20分 |
| 第30章 | 1時間5分 / 4時間30分 | 1時間5分 / 4時間45分 |
| 全分類合計 | 187時間45分 | 192時間10分（+4時間25分、+2.4%） |

必修のみの初回通読（199節・24時間5分）は変わっていない。WS4（KEN-32）の「新規内容が全体の読了負荷を過度に増やしていない」に照らし、初回通読の負荷は不変、選択的に読む範囲だけが増えた形である。第14章は 8時間25分 → 11時間20分 と大きく増えたが、内訳は新設5節115分と実装課題節60分であり、5節はいずれも独立して読めるうえ、backend-db・tech-lead・security ルートのステージへ個別に配置してあるため、ルート単位では必要な節だけを選べる。

### 今後の候補

- 課題13.7 のポリシー層はプロセス内にあり、実際のRLSのようにデータストア側で宣言してはいない。PostgreSQL を使う `external-service` 区分の発展課題として、`.verification/ken67/logs/30.1-rls.out` の手順を演習化する余地がある。ただし追加すると `beta-review-scope.json` の必須検証演習が増えるため、KEN-60 側の収束後に判断するのが安全である。
- 14.23 の日時ユーティリティは分単位までしか扱わず、`Temporal` を前提にしていない。対象ランタイムで `Temporal` が使えるようになった時点で、本文のコード例を差し替えるか、両方を併記するかを判断する必要がある。
- 14.22 の公平キューは単純なラウンドロビンで、プラン別の重み付けとテナントごとの同時実行上限は本文の説明だけにとどめた。26.11 のバックプレッシャーと合わせた発展課題は将来版の候補とする。

### 文体について

本文は既存章と同じ常体（だ・である調）で執筆した。新設7節と演習2件の本文を機械的に走査し、敬体の文末（です・ます・ません・でしょう）が0件であることを確認している。README や CONTRIBUTING などの運用文書は敬体のため、そちらの追記は敬体に合わせた。
