# KEN-51 ファイル・Webhook・メール・外部API連携を補完する — 実施レポート

## 目的

本書は、システムの内側 (HTTP、API契約、DB、キュー、セキュリティ) を厚く扱う一方で、**システムの外側との境界**をまとまった形では扱っていなかった。第30章の 30.13「業務機能パターン集」に決済・ファイル・メール・通知の急所が並んでいるが、そこはSaaS題材の中の survey であり、転送方式の選択、署名の設計、配送保証の宣言、失敗の受け取り方といった判断は、各技術章のどこにも置かれていなかった。

KEN-51 では、issue が挙げた6項目を第12章 (API設計)・第17章 (イベント駆動)・第23章 (セキュリティ) へ横断的に統合し、4領域それぞれの失敗を実際に再現できる演習と、本番運用チェックリストを第30章へ追加する。

## 横断配置の設計判断

### 章番号は振り直さず、既存章へ節として統合した

書名・目次・学習経路・索引・`code/ch01`〜`code/ch30`・検証スクリプトのすべてに「30章」が埋め込まれている。KEN-49 / KEN-50 と同じく、新規章は作らず既存章へ節として足した。

### なぜ「単一章ではなく4章へ分散」か

issue の完了条件が「API・セキュリティ・非同期処理章へ統合」であり、扱う6項目は性質の異なる3つの層に属する。

| issue の扱う内容 | 配置 | 章を選んだ理由 |
|---|---|---|
| multipart と presigned URL | 12.13（新設・API設計） | 「バイト列をどの経路で運ぶか」は、12.1〜12.12 で作ってきた**契約の選択肢**そのものである。12.12 の方式選択の指針の直後に置くと、JSONの往復では収まらない契約として自然につながる |
| 大容量・再開可能アップロード | 12.14（新設・API設計） | 12.13 の署名付きURLが前提にしている「1回のリクエストが最後まで通る」を崩す話であり、直後に置くのが最短。tus の `PATCH` はHTTPの語彙で書かれた契約であり、API章の内容である |
| Webhook 署名 (送信側の契約) | 12.15（新設・API設計） | 「自分が発行するイベントの封筒・署名・再送方針・保証しないことの宣言」は公開APIの契約書に書く内容であり、12.6 の OpenAPI と同じ層に属する |
| MIME 偽装、サイズ制限、ウイルススキャン | 23.26（新設・セキュリティ） | 23.2〜23.8 はすべて「クライアントが送ってきた値を信じた」に帰着する。アップロードはその値が数MBのバイト列になっただけであり、受理・処理・配信の3段階という脅威モデルはセキュリティ章の枠組みで扱うのが正しい |
| Webhook 再送、順序逆転、冪等性 (受信側) | 17.13（新設・非同期処理） | 受信側は「制御できない発行者からの、順不同・重複あり・欠落ありのメッセージ購読」であり、17.2 のキュー消費者と同じ設計問題を持つ。17.11 の Outbox の直後に置くと、「内側の保証」と「外側に保証がないこと」が対になる |
| メール送信、バウンス、DKIM/SPF/DMARC | 17.14（新設・非同期処理） | 送信APIの 200 は「預かった」であり、結果は後から配送イベントとして非同期に返る。バウンス処理は 17.13 の Webhook 受信をそのまま使う。第V部のインフラ章ではなく非同期章に置くのは、問題の中心がDNSレコードではなく**遅れて返る結果の扱い**だからである |
| 外部API のタイムアウト、リトライ、Circuit Breaker | 17.15（新設・非同期処理） | 26.6〜26.11 のパターンそのものではなく、それを「自分が直せない相手」へ適用するときの具体に絞った。メール送信も相手への再取得も結局は外部API呼び出しであり、17.13・17.14 の直後が最短の接続になる |
| 本番運用チェックリスト | 30.15（新設・総合演習） | チェックリストは特定技術の説明ではなく、機能横断で効く判断の洗い出しである。30.14（KEN-50 の「内側を貫く前提」）と対になる「外側との境界」として置いた |

### 既存記述との重複を避けた方法

- **30.13.2〜30.13.4 は残したまま**、新設節へ接続した。30.13 は SaaS 題材における survey（S3 presigned の実装例、TUS の1行紹介、SPF/DKIM/DMARC のレコード例、バウンス Webhook の実装例）であり、新設節はその**判断の根拠**（何に署名しているのか、なぜ整合が要るのか、なぜ受理と処理を分けるのか）を扱う。同じコードを再掲していない。
- **第26章の耐障害性パターンは再説明していない。** 17.15 は「相手ごとにブレーカを分ける」「4xx を失敗として数えない」「half-open は1本」「時間予算を上から配る」「縮退の型を機能ごとに決める」という、26.6/26.7/26.9/26.10/26.11 に無い判断だけを扱い、パターンの定義は相互参照で済ませた。
- **第2章の HTTP セマンティクスとの重複回避。** 12.14 の末尾に「ダウンロードの再開は `Range` で足りる（RFC 9110 §14）。アップロードに状態が要るのは、まだ完成していないものを扱うからだ」という非対称性の指摘を置き、Range の説明そのものは第2章に委ねた。
- **13.24（テナント境界）との接続。** 12.13 の POST policy の `starts-with` による接頭辞固定、23.26 の保存キー接頭辞を、いずれも 13.24 への参照としてつないだ。

### 学習レベルはすべて「実務選択」

新設8節はすべて `practical` とした。必修を増やすと `beta-review-scope.json` の `requiredSectionCount`（199）、章別 `requiredMinutes`、選定しきい値の分位点、章の tier が一斉にずれる。内容としても、外部連携は担当領域によって必要な深さが変わる。結果として必修は **199節・24時間5分のまま変わっていない**。

## 追加した節・小節の一覧

| 節 | 学習レベル | 推定時間 | 行数 | 文字数 | 主な小節 |
|---|---|---:|---:|---:|---|
| 12.13 ファイルアップロードの転送方式 ― multipart と presigned URL | 実務選択 | 25分 | 208 | 8,325 | 3つの経路／multipart の中身と `filename` の扱い／presigned URL は何に署名しているか／POST policy と `content-length-range`／事前申告と完了通知の状態機械／CORS／配信URL／つまずく箇所 |
| 12.14 大容量アップロードと再開可能プロトコル | 実務選択 | 25分 | 119 | 5,169 | 分割と再開の違い／分割アップロードの後始末とチャンクサイズ／tus の最小要件とオフセット条件／再開できなくなる5パターン／完全性／Range との非対称性／つまずく箇所 |
| 12.15 Webhook の設計 ― イベント契約と署名 | 実務選択 | 25分 | 125 | 4,749 | イベント封筒／保証しないことの宣言／署名対象とヘッダ、鍵ローテーション／再送方針を数字で公表／送信先URLの SSRF／版の進め方／つまずく箇所 |
| 17.13 Webhook 受信の実務 ― 再送、順序逆転、冪等性 | 実務選択 | 25分 | 172 | 6,477 | 受理と処理を分ける／署名検証の3つの罠／冪等性の鍵と一意制約／順序逆転への3つの対処／突合／4xx と 5xx の返し分け／観測指標／つまずく箇所 |
| 17.14 メール送信の実務 ― 配送経路、バウンス、DKIM/SPF/DMARC | 実務選択 | 25分 | 117 | 5,514 | 2つの From と整合／SPF・DKIM・DMARC の役割分担／`p=none` からの段階導入／バウンスと苦情の3系統／冪等キーを送信前に確保／到達率の実務／非同期化／つまずく箇所 |
| 17.15 外部API連携の実務 ― 時間予算、リトライ、Circuit Breaker | 実務選択 | 25分 | 148 | 5,484 | 時間予算を上から配る／3種のタイムアウト／リトライしてよい条件と予算・ジッタ／ブレーカを相手ごとに置く／縮退の4つの型／相手の変化の検出／相手ごとの指標／つまずく箇所 |
| 23.26 アップロードされたファイルの検証 ― MIME偽装、サイズ制限、スキャン | 実務選択 | 25分 | 163 | 6,852 | 受理・処理・配信の3段階／申告された種別3つの不信／マジックバイトと限界／層ごとのサイズ制限と圧縮爆弾／隔離実行／スキャンの位置づけと検疫／配信時の防御／保存名とパス／つまずく箇所 |
| 30.15 ファイル・Webhook・メール・外部API連携の本番運用チェックリスト | 実務選択 | 15分 | 124 | 4,728 | A. ファイル(4群25項目)／B. Webhook(2群18項目)／C. メール(13項目)／D. 外部API(14項目)／E. 横断(5項目)／使い方 |
| 課題12.6 の本文（12.16 内） | — | — | 102 | 5,115 | 題材、4つの実装要件、誤りの表、評価基準、期待出力 |
| 課題17.5 の本文（17.16 内） | — | — | 104 | 4,730 | 同上 |
| 課題17.6 の本文（17.16 内） | — | — | 105 | 5,029 | 同上 |
| 課題23.9 の本文（23.27 内） | — | — | 102 | 5,001 | 同上 |
| 合計 | — | 190分 | 1,589 | 67,173 | — |

各節はコード例（TypeScript、SQL、DNS、HTTPヘッダ、JSON）、表、ASCII図、実務での落とし穴、一次資料への出典を備えている。行数あたりの推定時間は既存節と同水準に揃えた。

### 章番号・節番号

- 章数は 30 のまま。新規章は作っていない。
- 実装課題の節番号を4件だけ移動した（12.13 → 12.16、17.13 → 17.16、23.26 → 23.27、30.15 → 30.16）。他章の節番号は変更していない。
- 節数は **397 → 405**。
- 実装課題節の推定時間を演習追加分だけ調整した（12.16: 270→420分、17.16: 280→580分、23.27: 300→450分、30.16: 85分のまま）。

### 見出しの重複回避

- 新設7節の `#### つまずく箇所` にはすべて識別子を付けた（`― ファイル転送方式`、`― 大容量アップロード`、`― Webhook の設計`、`― Webhook の受信`、`― メール配送`、`― 外部API連携`、`― アップロードの検証`）。
- 30.15 の `#### 使い方` が 30.14 の同名見出しと衝突して `ANCHOR_DUPLICATE` が1件増えたため、`#### 使い方 ― 外部連携チェックリスト` へ変更して 27 件へ戻した。KEN-50 の 30.14 側は変更していない。

## 追加した演習

| 番号 | タイトル | 難易度 | 推定時間 | 環境区分 | starter | solution |
|---|---|---|---:|---|---|---|
| 12.6 | 課題12.6: 再開可能アップロードの中断を再現して直す (★★★) | ★★★ | 150分 | local-automated | `code/ch12/resumable-upload/starter/main.ts`（実行入口 `starter/report.ts`） | `code/ch12/resumable-upload/solution/main.ts`、`solution/report.ts` |
| 17.5 | 課題17.5: Webhook 配送の失敗を再現して冪等・順序耐性にする (★★★) | ★★★ | 150分 | local-automated | `code/ch17/webhook-delivery/starter/main.ts` | `code/ch17/webhook-delivery/solution/main.ts`、`solution/report.ts` |
| 17.6 | 課題17.6: 外部API連携の障害を再現して耐える (★★★) | ★★★ | 150分 | local-automated | `code/ch17/external-api/starter/main.ts` | `code/ch17/external-api/solution/main.ts`、`solution/report.ts` |
| 23.9 | 課題23.9: アップロードファイルの受け入れ判定を破って塞ぐ (★★★) | ★★★ | 150分 | local-automated | `code/ch23/upload-validation/starter/main.ts` | `code/ch23/upload-validation/solution/main.ts`、`solution/report.ts` |

4件とも `local-automated` にした。外部サービス（S3、SMTP、実在のWebhook送信元）を必須にすると `clean-environment-plan.json` の `environmentDependent` が増え、`validate-beta-review.mjs` の選定基準 C3 と必須検証演習 E1 に該当して `beta-review-scope.json` と KEN-60 の計画文書を書き換える必要が生じる。学習目的（署名条件・オフセット条件・一意制約・版番号・時間予算・ブレーカ状態遷移・実体からの種別判定）はいずれもプロセス内で同じ精度で観察できる。

### 課題12.6 が再現するもの

`FakeStorage`（メモリ上のバイト列）と `Link`（決まった位置で切れる回線・応答を落とす位置）を使い、`naive` サーバと `fixed` サーバへ同じ探索を当てる。

| 番号 | 誤り | 再現される事象 |
|---|---|---|
| U1 `signed-size-ignored` | 上限を許可証の条件に入れず、台帳に控えるだけ | 申告 5MiB の許可証で 30MiB が書き込まれる |
| U2 `resume-restart` | 受信済みオフセットをプロセスメモリに持つ | 再起動後に再開できず、12MiB を送り直す |
| U3 `duplicate-chunk` | 追記にオフセット条件がない | 応答の取りこぼしによる再送で同じ範囲が二重に書かれる |
| U4 `orphan-session` | 中断セッションを回収しない | 3件・12MiB が残り続ける |

実行結果:

```
naive server: 4/4 failures reproduced
  U1 signed-size-ignored: naive stored=31457280 / fixed stored=4194304 (declared=5242880)
  U2 resume-restart: naive resent=12582912 / fixed resent=4194304 (minimum=4194304)
  U3 duplicate-chunk: naive stored=12582912 / fixed stored=8388608 (sent=8388608)
  U4 orphan-session: naive retained=3/12582912B / fixed retained=0/0B (collected=3/12582912B)
fixed server: 0/4 failures remaining
```

U3 の宣言長を実送信量より大きく（16MiB / 8MiB）取ってあるのは、長さの上限で偶然止まるのではなく**オフセット条件そのもの**が二重書き込みを止めていることを見るためである。

### 課題17.5 が再現するもの

送信側と受信側を同一プロセスに置き、`naive` 受信側と `guarded` 受信側へ同じ配送を当てる。

| 番号 | 誤り | 再現される事象 |
|---|---|---|
| W1 `parsed-body-signature` | パースし直した文字列で署名を検証し、署名も鍵も先頭1つしか見ない | 本番の送信側（整形あり）の正当な通知が拒否される |
| W2 `duplicate-delivery` | 「読んでから書く」で重複を判定する | 並行到着した同一イベントが2回適用され、課金回数が2になる |
| W3 `out-of-order` | 到着順をそのまま適用する | 後から届いた古い版で `active` が `past_due` に戻る |
| W4 `dropped-event` | 突合を持たない | 欠落した1件が永久に反映されない |

W1 の「開発環境では通って本番で落ちる」を再現するため、送信側は `pretty` 引数で整形の有無を切り替える。整形なし（開発環境相当）では `naive` の再シリアライズが偶然一致し、整形あり（本番相当）で一致しなくなる。

実行結果:

```
naive receiver: 4/4 failures reproduced
  W1 parsed-body-signature: naive accepted=false / guarded accepted=true
  W2 duplicate-delivery: naive charges=2 / guarded charges=1
  W3 out-of-order: naive status=past_due / guarded status=active
  W4 dropped-event: naive missing=1 / guarded missing=0 (after reconcile)
guarded receiver: 0/4 failures remaining
```

### 課題17.6 が再現するもの

`VirtualClock`（仮想時刻）と `FakeProvider`（固定の振る舞いを返す外部サービス）を使う。実時間の待機を一切行わないため、30秒のハングや指数バックオフの観察が一瞬で終わる。

| 番号 | 誤り | 再現される事象 |
|---|---|---|
| E1 `no-timeout` | タイムアウトを設定しない | 30秒応答しない相手に上流の予算（3秒）を使い切られる |
| E2 `retry-storm` | 予算とジッタなしで再試行する | 総呼び出しが64回に膨らむ |
| E3 `no-breaker` | 恒久障害でも呼び出し続ける | 12要求すべてが相手を待つ |
| E4 `duplicate-mail` | 冪等キーを送信後に書き、バウンスを無視する | 抑制済み宛先へ送信し、リトライで二重に届く |

実行結果:

```
naive integration: 4/4 failures reproduced
  E1 no-timeout: naive elapsed=30000ms / resilient elapsed=1200ms (budget=1200ms)
  E2 retry-storm: naive calls=64 / resilient calls=6 (limit=6)
  E3 no-breaker: naive upstream-waits=12 / resilient upstream-waits=3 (short-circuited=9, state=open)
  E4 duplicate-mail: naive delivered=3 suppressed-hits=1 / resilient delivered=1 suppressed-hits=0
resilient integration: 0/4 failures remaining
```

### 課題23.9 が再現するもの

無害なバイト列だけを検体として使う（実在のマルウェア・エクスプロイトは含まない。プロセス外へも書き出さない）。

| 番号 | 検体 | `naive` で起きること |
|---|---|---|
| V1 `magic-mismatch` | `image/png` を申告した GIF ヘッダ + HTML | 画像として受理され、`image/png` で配信される |
| V2 `double-extension` | `logo.pdf.svg` という名前の SVG | 名前の先頭一致で PDF とみなされる |
| V3 `zip-bomb` | 圧縮比 512 の擬似アーカイブ | 宣言された展開後サイズを信じ、256MiB まで展開する |
| V4 `sniffable-delivery` | 正当な PNG | `nosniff` も `Content-Disposition` も付かずに配信される |

実行結果:

```
naive gate: 4/4 weaknesses reproduced
  V1 magic-mismatch: naive accepted as image/png / strict rejected: declared type mismatch
  V2 double-extension: naive accepted as application/pdf / strict rejected: unsupported type
  V3 zip-bomb: naive expanded=268435456 / strict expanded=20971520 aborted=compression ratio
  V4 sniffable-delivery: naive missing=[x-content-type-options, content-disposition, content-security-policy, cross-origin-resource-policy] / strict missing=[]
strict gate: 0/4 weaknesses remaining (benign png still accepted)
```

最終行の `benign png still accepted` は、`strictGate` が過剰な拒否をしていないことの確認である。

### 演習カードの必須フィールド

KEN-48 で定義された全項目を4件に揃えた（目的、難易度、推定時間、推定時間の内訳、前提4件、完成条件6件、期待出力5件、観察項目5件、テスト方法4件、段階的ヒント3段、本番利用時の警告3件、starter/solution の導線）。`validate:exercises` が欠落・定型文・導線不一致・★数不一致を検出しないことを確認している。

**観察項目は、実際にコードを書き換えて挙動を確認し、記載どおりの結果になることを検証した。** 検証で記載と食い違った項目は、実測結果に合わせて書き直している。

| 書き換え | 実測結果 |
|---|---|
| `patchChunk` のオフセット一致検査を外す | U3 だけが再現に戻る（fixed 1/4） |
| `collectExpired` を空実装へ戻す | U4 だけが再現に戻る（fixed 1/4） |
| `issueGrant` の maxBytes と `patchChunk` の宣言長検査を**両方**外す | U1 だけが再現に戻る（片方だけでは戻らない = 上限を層で置く意味） |
| `headSession` をメモリ由来へ変える | 再開時に `ConflictError` になり、再開そのものが失敗する |
| `verifySignature` をパース後の文字列に変える | W1 だけが再現に戻る（guarded 1/4） |
| 重複判定を「読んでから書く」へ + 版番号比較を外す | W2 と W3 の2件が再現に戻る（重複が2層で止まっていた） |
| `reconcile` の呼び出しを外す | W4 だけが再現に戻る |
| `Sender.build` の整形を常に有効にする | naive 側は W2〜W4 を観測できなくなる（charges=0、status=none） |
| `expandArchive` の中断判定を外す | V3 だけが再現に戻る |
| `maxRatio` を 1000 へ上げる | V3 の中断理由が `compression ratio` から `expanded size limit` へ変わる |
| `SIGNATURES` から PNG を外す | 正当な PNG まで拒否される（over-blocking） |
| `deliveryHeaders` から nosniff を外す | V4 だけが再現に戻る |
| `MailSender` の抑制照合を外す | E4 が再現に戻る（delivered=2、suppressed-hits=1） |
| `retryBudgetLimit` を 30 へ上げる | E2 の総呼び出しが 31 まで伸びる |

### 章テストへの追加

- `code/ch12/solutions.test.ts` へ2件追加（4件 → 6件）: 4件の再現と解消、オフセット不一致時に書き込まないこと。
- `code/ch17/solutions.test.ts` へ4件追加（4件 → 8件）: Webhook の4件、鍵ローテーションと古いタイムスタンプ、外部API の4件、ブレーカが 4xx を数えず half-open から復帰すること。
- `code/ch23/solutions.test.ts` へ3件追加（8件 → 11件）: 4件の再現と解消、展開の中断が宣言値に依存しないこと、配信ヘッダ。

## 追加した本番運用チェックリスト

**場所**: 30.15 ファイル・Webhook・メール・外部API連携の本番運用チェックリスト（`08-part7-practice.md`）

**項目数**: 合計 **75項目 / 5区分・10グループ**

| 区分 | グループ | 項目数 |
|---|---|---:|
| A. ファイルアップロードとオブジェクトストレージ | A-1 転送方式 / A-2 大容量と中断 / A-3 内容の検証 / A-4 配信 | 25 |
| B. Webhook | B-1 送信側 / B-2 受信側 | 18 |
| C. メール配送 | ― | 13 |
| D. 外部API連携 | ― | 14 |
| E. 横断 | ― | 5 |

各項目には参照節を併記し、判断に必要な本文へ直接戻れるようにした。使い方として、30.16 の実装課題の前と本番稼働の直前に2回使うこと、および課題12.6 が A-1/A-2 を、課題23.9 が A-3/A-4 を、課題17.5 が B-2 を、課題17.6 が C と D を実際に再現することを明記した。KEN-50 が 30.14 に置いた「内側を貫く前提」のチェックリストと同形式・同じ使い方であり、30.14 が内側、30.15 が外側という対になっている。

## 変更・新規作成したファイル

### 本文・参照

| ファイル | 種別 | 内容 |
|---|---|---|
| `04-part3-backend.md` | 変更 | 12.13〜12.15 新設、実装課題を 12.16 へ、課題12.6 追加、第12章の導入文を更新 |
| `05-part4-data.md` | 変更 | 17.13〜17.15 新設、実装課題を 17.16 へ、課題17.5・17.6 追加、第17章の導入文を更新 |
| `07-part6-quality.md` | 変更 | 23.26 新設、実装課題を 23.27 へ、課題23.9 追加、第23章の導入文を更新 |
| `08-part7-practice.md` | 変更 | 30.15 新設、実装課題を 30.16 へ、第30章の導入文と第VII部の総括を更新、30.14 への参照を調整 |
| `09-references.md` | 変更 | 一次資料11件を追加（後述） |
| `01-toc.md` / `10-index.md` | 生成 | `generate:handbook` で再生成 |
| `LEARNING_LEVELS.md` / `LEARNING_PATHS.md` / `CODE_EXERCISES.md` / `CHAPTER_TEMPLATE.md` | 生成 | 各生成スクリプトで再生成 |
| `NARRATIVE_ARCHITECTURE.md` | 変更 | 第IV部・第VI部の要約と、第12・17・23・30章の因果の鎖に外部連携を追記 |
| `README.md` | 変更 | 節数 397→405、演習 135→139、演習カード 139→143（追記のみ、既存記述は削除なし） |
| `CONTRIBUTING.md` | 変更 | クリーン環境区分の件数 135→139 |
| `CLEAN_ENVIRONMENT.md` | 変更 | ローカル自動 105→109、全演習件数 135→139 |

### 正本（config）

| ファイル | 内容 |
|---|---|
| `config/learning-levels.json` | 12.13〜12.15、17.13〜17.15、23.26、30.15 を追加。旧 12.13→12.16（420分）、17.13→17.16（580分）、23.26→23.27（450分）、30.15→30.16 へ改番。397節→405節 |
| `config/chapter-guides.json` | 第12・17・23・30章の到達目標、中核概念、最小実装・演習節、典型的な失敗、診断、判断、評価基準、一次資料を更新 |
| `config/learning-paths.json` | backend-db・frontend・security・infra-sre・tech-lead の該当ステージへ新設節を追加。**各ルートの章集合は変えていない**（`routeAppearances` を不変に保つため）。標準通読は必修のみの構成のため変更なし |
| `config/exercises.json` | 課題12.6・17.5・17.6・23.9 を schemaVersion 2 の全必須フィールド付きで追加（135→139演習） |
| `config/clean-environment-plan.json` | 4件を `local-automated` として追加。件数 135→139、local-automated 105→109 |
| `config/narrative-flow.json` | 第17章 13→16、第23章 26→27、第30章 15→16 へ `minimumBridgeCount` を更新（第12章の扱いは後述） |
| `narrative-flow.json`（リポジトリ直下の同内容コピー） | 上と同じ更新 |

### 検証スクリプト・照合対象

| ファイル | 変更 |
|---|---|
| `scripts/validate-clean-environment.mjs` | 演習正本と台帳、カテゴリ集計の件数 135 → 139 |
| `scripts/validate-clean-environment.test.mjs` | 件数 135 → 139、local-automated 105 → 109 |
| `scripts/apply-learning-levels.test.mjs` | 節数 397 → 405、全分類合計 192時間10分 → 205時間20分 |
| `scripts/validate-handbook.test.mjs` | 節数・学習メタデータ 397 → 405 |
| `beta-review-scope.json` | 第17章に `C4` と理由を追加、第17・23・30章の `metrics.minimumBridgeCount` を正本と一致させた（詳細は後述） |

`package.json` は編集していない（新しいスクリプトを追加していない）。`LICENSE` / `LICENSE-TEXT` / `LICENSING.md` / `RELEASE_POLICY.md` / `CHANGELOG.md` / `ERRATA.md` / `config/release.json` / `.github/` / `scripts/build-site.mjs` / `scripts/validate-release-policy.mjs`（KEN-62 の成果物）も編集していない。`config/release.json` の判定規則への追記も不要だった（`validate:release-policy` が ERROR 0 / WARN 0 のまま通っている）。

### コード

| ファイル | 種別 | 行数 |
|---|---|---:|
| `code/ch12/resumable-upload/README.md` | 新規 | — |
| `code/ch12/resumable-upload/starter/main.ts` / `starter/report.ts` | 新規 | 363 / 4 |
| `code/ch12/resumable-upload/solution/main.ts` / `solution/report.ts` | 新規 | 399 / 4 |
| `code/ch17/webhook-delivery/README.md` | 新規 | — |
| `code/ch17/webhook-delivery/starter/main.ts` / `starter/report.ts` | 新規 | 384 / 4 |
| `code/ch17/webhook-delivery/solution/main.ts` / `solution/report.ts` | 新規 | 423 / 4 |
| `code/ch17/external-api/README.md` | 新規 | — |
| `code/ch17/external-api/starter/main.ts` / `starter/report.ts` | 新規 | 384 / 4 |
| `code/ch17/external-api/solution/main.ts` / `solution/report.ts` | 新規 | 429 / 4 |
| `code/ch23/upload-validation/README.md` | 新規 | — |
| `code/ch23/upload-validation/starter/main.ts` / `starter/report.ts` | 新規 | 298 / 4 |
| `code/ch23/upload-validation/solution/main.ts` / `solution/report.ts` | 新規 | 359 / 4 |
| `code/ch12/solutions.test.ts` / `code/ch17/solutions.test.ts` / `code/ch23/solutions.test.ts` | 変更 | テスト計9件追加 |
| `code/ch12/README.md` / `code/ch17/README.md` / `code/ch23/README.md` | 生成 | `generate:exercise-catalog` |

コード合計 3,071行（starter / solution / report）。

## 追加した一次資料

`09-references.md` へ、既存の形式と並び順に合わせて次を追加した。

**RFC・公式仕様**

- [RFC 3464] An Extensible Message Format for Delivery Status Notifications（バウンス通知の形式）
- [RFC 5965] An Extensible Format for Email Feedback Reports（ARF）
- [RFC 6376] DomainKeys Identified Mail (DKIM) Signatures
- [RFC 7208] Sender Policy Framework (SPF) for Authorizing Use of Domains in Email, Version 1
- [RFC 7489] Domain-based Message Authentication, Reporting, and Conformance (DMARC)
- [RFC 7578] Returning Values from Forms: multipart/form-data
- [RFC 8058] Signaling One-Click Functionality for List Email Headers

**オンラインリソース・標準**

- [OWASP File Upload] File Upload Cheat Sheet
- [Standard Webhooks] Standard Webhooks Specification
- [tus 1.0.0] tus resumable upload protocol 1.0.0

既存の [RFC 9110]（HTTP Semantics、Range と冪等性）と [Nygard, 2018]（Release It! 第2版、Circuit Breaker と Bulkhead）は本文から新たに参照した。過度な断定を避けるため、Standard Webhooks は「仕様として広く合意されたものではないが、複数の事業者が近い形を採っているため受信側の実装を使い回しやすい」、パート数・パートサイズの制約は「よく使われるS3互換のAPIでは」、ARC は「主に転送する側が実装するもので、送信側のアプリケーションが直接扱うことは少ない」といった条件付きの記述にしている。

## 実行した検証

```
pnpm run validate:exercises        → 終了コード0
pnpm run validate:narrative-flow   → 終了コード0
pnpm run validate:beta-review      → 終了コード0
pnpm run validate:release-policy   → 終了コード0
pnpm run validate:handbook         → 終了コード0
pnpm run check:handbook            → 終了コード0
```

`check:handbook` の内訳（すべて成功）:

| 検査 | 結果 |
|---|---|
| `apply:learning-levels:check` | 405節で差分なし |
| `generate:learning-paths:check` | 6ルートで差分なし |
| `apply:chapter-guides:check` | 30章で差分なし |
| `apply:exercise-rubrics:check` | 演習カード143件で差分なし |
| `generate:exercise-catalog:check` | 31ファイルで差分なし |
| `generate:handbook:check` | 目次・アンカー・索引で差分なし |
| `test:handbook` | 全97テスト成功、失敗0 |
| `validate:clean-environment` / `test:clean-environment` | 139演習、local-automated 109 / local-tls 7 / external-service 17 / browser-manual 6 |
| `validate:exercises` | 演習139件、観察課題4件、演習カード143 / 見出し143 |
| `validate:narrative-flow` | 30章すべて completed |
| `validate:beta-review` | 章30（core 15 / exercise-only 5 / sampled 10）、演習37（4530分）、必修節199 — **作業前と完全に同一** |
| `validate:release-policy` | ERROR 0 / WARN 0 |
| `validate:handbook` | **ERROR 0 / WARN 27** |

### ERROR / WARN 件数

- 作業前: **ERROR 0 / WARN 27**（すべて既存の `ANCHOR_DUPLICATE`）
- 作業後: **ERROR 0 / WARN 27**
- **増減なし。** 一度は 30.15 の `#### 使い方` が 30.14 の同名見出しと衝突して 28 件へ増えたため、見出しに識別子を付けて 27 件へ戻した。作業前後の警告一覧を照合し、内容が同一（行番号のみ移動）であることを確認済みである。

### 章のコード教材の個別検証

```
pnpm --filter @handbook/ch12 run typecheck / test   → エラー0 / 6件成功
pnpm --filter @handbook/ch17 run typecheck / test   → エラー0 / 8件成功
pnpm --filter @handbook/ch23 run typecheck / test   → エラー0 / 11件成功
node scripts/validate-exercises.mjs --chapter ch12 / ch17 / ch23  → いずれも成功
pnpm --filter @handbook/ch12 exec tsx resumable-upload/solution/report.ts   → 4/4 → 0/4
pnpm --filter @handbook/ch17 exec tsx webhook-delivery/solution/report.ts   → 4/4 → 0/4
pnpm --filter @handbook/ch17 exec tsx external-api/solution/report.ts       → 4/4 → 0/4
pnpm --filter @handbook/ch23 exec tsx upload-validation/solution/report.ts  → 4/4 → 0/4
pnpm run build:site / build:site:check                                      → 再生成後に成功
```

starter 側も4件すべて型検査を通り、`report.ts` が例外なく実行できる（未実装のため 0/0 を出力する）ことを確認している。

`pnpm run validate:workspace` は本作業環境の Node.js が v26 のため作業前から失敗する（本書の固定版は 24.18.0）。この失敗は本変更とは無関係である。

## 完了条件の達成根拠

### 1. API・セキュリティ・非同期処理章へ統合

- **API章（第12章）**: 12.13〜12.15 を新設し、転送方式の3つの経路、`multipart/form-data` の構造と `filename` の危険、presigned URL が何に署名しているか、POST policy による範囲指定、事前申告と完了通知の状態機械、分割アップロードと tus、Webhook の封筒・署名・鍵ローテーション・再送方針の公表・SSRF・版の進め方を扱った。章の導入文と `NARRATIVE_ARCHITECTURE.md` の第12章の鎖も更新している。
- **セキュリティ章（第23章）**: 23.26 を新設し、受理・処理・配信の3段階の脅威モデル、申告された種別3つを信用しない理由、マジックバイトの限界（ポリグロット、SVG）、層ごとのサイズ制限と圧縮爆弾、パーサの隔離実行、スキャンにできないこと、検疫の状態機械、配信時のヘッダとオリジン分離、保存名とパスの扱いを扱った。
- **非同期処理章（第17章）**: 17.13〜17.15 を新設し、Webhook 受信の受理と処理の分離・署名検証の3つの罠・一意制約による冪等性・順序逆転への3つの対処・突合・状態コードの返し分け、メールの2つの From と SPF/DKIM/DMARC の整合・段階導入・バウンスと苦情・冪等キーの確保順序、外部APIの時間予算・リトライ条件と予算とジッタ・ブレーカの4つの決めごと・縮退の4つの型・相手ごとの指標を扱った。
- 各節は `NARRATIVE_EDITING_GUIDE.md` の方針どおり、前節で残った問題を受け取る接続文（`handbook:narrative-bridge`）から始まる。相互参照で 12.6 / 13.14 / 13.15 / 13.24 / 17.2 / 17.3 / 17.4 / 17.6 / 22.2 / 22.5 / 23.3 / 23.5 / 23.9 / 23.10 / 23.24 / 26.6 / 26.7 / 26.8 / 26.9 / 26.10 / 26.11 / 30.13 とつないでおり、既存記述の再説明はしていない。

### 2. 失敗を前提にした演習を追加

- 4件とも「**失敗を実際に再現 → 対策 → 再現しなくなることを検証**」という KEN-50 の課題13.7 / 14.6 と同じ構造を持つ。いずれも `runFindings` が同じ探索を2つの実装へ当て、`4/4 reproduced` → `0/4 remaining` を機械的に出力する。
- ネットワーク断（U2）、タイムアウト（E1）、重複配送（W2）、順序逆転（W3）、署名検証失敗（W1）、欠落（W4）、リトライ嵐（E2）、恒久障害（E3）、二重送信とバウンス無視（E4）、MIME 偽装（V1・V2）、圧縮爆弾（V3）、配信ヘッダ不足（V4）、上限の未強制（U1）、二重書き込み（U3）、中断セッションの滞留（U4）を、いずれも**外部サービスに接続せずローカルで模擬**している。判定は固定の `FIXTURES` に基づき、現在時刻・プロセスのタイムゾーン・ネットワーク・乱数に依存しない（乱数を使う箇所は注入した固定列を使う）。
- `config/exercises.json` へ schemaVersion 2 の必須フィールドをすべて揃えて登録し、starter / solution は既存の複数ファイル型の命名規約（`exercise/starter/`、`exercise/solution/`、`exercise/README.md`）に従って作成した。章テスト計9件で再現と解消の両方を自動検証している。

### 3. 本番運用チェックリストを作成

- 30.15 に、ファイル25項目・Webhook 18項目・メール13項目・外部API 14項目・横断5項目の計75項目を置いた。issue が挙げた6項目すべてに対応する確認項目がある。
- 各項目には参照節を併記し、判断に必要な本文へ戻れるようにした。使い方（実装前と本番直前の2回、演習との対応）も明記している。
- チェックリストの項目は 12.13〜12.15・17.13〜17.15・23.26 で扱った内容と対応しており、本文にない判断を要求していない。

## 積み残し・判断の記録

### `beta-review-scope.json` と `minimumBridgeCount` の扱い（重要）

`validate:beta-review` は `config/narrative-flow.json` の `minimumBridgeCount` を正本として、その全30章の**第75パーセンタイル**を選定基準 C4 のしきい値にする。新設節の分だけ接続文が増えるため、この値の更新は C4 の該当章、ひいては章の tier に波及しうる。**更新前に影響を全パターン計算した。**

作業前のしきい値は **14**。実際の接続文数は 第12章 13→16、第17章 13→16、第23章 26→27、第30章 15→16 に増えた。

| 更新案 | しきい値 | 影響 |
|---|---:|---|
| 4章すべてを実数へ更新 | **15** | ch20・ch29 が C4 を失い、**ch12 が C4 を獲得して sampled → core へ昇格**。E2 により演習 12.2 が必須検証演習に加わり、`BETA_REVIEW_SCENARIOS.md`（KEN-60 の成果物）に `12.2` の記載を足す必要が生じ、RL-EXEC のトラック・工数、RL-READ の記録対象章、RL-SPEC の各ドメインの章集合と基準時間、`routeStageCoverage`、`totals` が連鎖して変わる |
| ch12 を 13 のまま据え置き、他3章を実数へ更新 | **14** | しきい値も C4 の該当章も不変。ch17 が C4 を獲得するが**もともと core** のため tier は動かない。scope 側の更新は3章の `metrics.minimumBridgeCount` と ch17 の `matchedCriteria` / `reasons` のみ |

**後者を採用した。** 理由は3つある。

1. `scripts/validate-narrative-flow.mjs` は `bridgeCount < minimumBridgeCount` をエラーとする。この値は**下限（回帰ガード）**であって実数の記録ではないため、13 のまま据え置いても検査は正しく機能し、基準を緩めることにもならない。
2. ch12 を core へ昇格させることは、ベータレビューの対象範囲を広げるという KEN-60 の設計判断の変更であり、KEN-51（本文の補完）の権限外である。
3. KEN-60 の成果物である `BETA_REVIEW_SCENARIOS.md` を書き換えずに済む。

**`scripts/validate-beta-review.mjs` の基準は一切変更していない。** 結果として `validate:beta-review` の出力（章30、core 15 / exercise-only 5 / sampled 10、演習37・4530分、必修節199）は作業前と完全に一致している。

なお、演習を4件追加しても E2 の選出は変わらない。ch17 は E1 に難易度3の演習（17.1）を持つため E2 の対象外、ch23 の E2 候補は id の数値順で先頭の 23.5 のままであり、ch12 は sampled のため E2 を持たない。新設演習はすべて `local-automated` のため `environmentDependent` も増えず、C3 と E1 に該当しない。

**今後の課題**: 第12章の実際の接続文数（16本）と宣言値（13本）に差が残る。ベータレビューの対象章を見直す機会（KEN-60 の収束後）に、`minimumBridgeCount` を実数へ揃え、ch12 を core へ昇格させるかどうかを判断するのが望ましい。

### 読了負荷

| 章 | 作業前（必修 / 全体） | 作業後（必修 / 全体） |
|---|---|---|
| 第12章 | 35分 / 6時間 | 35分 / 9時間45分 |
| 第17章 | 35分 / 6時間30分 | 35分 / 12時間45分 |
| 第23章 | 1時間20分 / 9時間10分 | 1時間20分 / 12時間5分 |
| 第30章 | 1時間5分 / 4時間45分 | 1時間5分 / 5時間 |
| 全分類合計 | 192時間10分 | 205時間20分（+13時間10分、+6.9%） |

必修のみの初回通読（199節・24時間5分）は変わっていない。WS4（KEN-32）の「新規内容が全体の読了負荷を過度に増やしていない」に照らし、初回通読の負荷は不変で、選択的に読む範囲だけが増えた形である。増加分13時間10分のうち、本文は190分、残る10時間は演習4件（合計10時間）である。第17章が 6時間30分 → 12時間45分 と大きく増えたが、内訳は新設3節75分と実装課題節5時間であり、3節はいずれも独立して読めるうえ、backend-db・security・infra-sre・tech-lead の各ルートのステージへ個別に配置してあるため、ルート単位では必要な節だけを選べる。

### 今後の候補

- **実サービスを使う発展課題**: 4件とも `local-automated` のため、S3 互換ストレージの分割アップロード、実際の SMTP と DMARC レポート、実在の Webhook 送信元との疎通は扱っていない。`external-service` 区分の発展課題として追加する余地があるが、追加すると `beta-review-scope.json` の必須検証演習が増えるため、KEN-60 側の収束後に判断するのが安全である。
- **17.14 の ARC**: 転送時の評価引き継ぎは「主に転送する側が実装する」という1段落にとどめた。メーリングリストを自前運用する読者向けには不足しており、将来版で扱うかを判断する必要がある。
- **23.26 の画像再エンコード**: 「再エンコードする」と方針を書いたが、具体的な実装（どのライブラリを、どのようなサンドボックスで）は扱っていない。ランタイム依存が強いため本書の方針としては妥当だが、演習化の余地はある。
- **12.14 の並列再開**: tus の連結（concatenation）拡張は名前だけの言及にとどめた。分割アップロードとの使い分けを実装で示す発展課題は将来版の候補とする。

### 文体について

本文は既存章と同じ常体（だ・である調）で執筆した。新設8節・演習本文4件・演習カード4件・演習コードのコメントを機械的に走査し、**敬体の文末（です・ます・ません・でしょう・ください・ましょう・でした・ました）が0件**であることを確認している。README や CONTRIBUTING などの運用文書は敬体のため、そちらの追記は敬体に合わせた。日本語の表記（濁点・半濁点・長音）も原文どおり保っている。
