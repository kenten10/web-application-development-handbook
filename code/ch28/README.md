# 第28章 大規模リファクタリングとレガシー対応 — コード教材

## 前提環境

- Node.js 24.18.0 LTS
- pnpm 11.15.1
- TypeScript 6.0.3

## 共通コマンド

```bash
pnpm install
pnpm --filter @handbook/ch28 run lint
pnpm --filter @handbook/ch28 run typecheck
pnpm --filter @handbook/ch28 run test
pnpm --filter @handbook/ch28 run build
```

> `solution` は要件一覧ではなく、実行・観察できる模範実装でなければなりません。`referenceArtifact` や `model answer scaffold` は検証エラーになります。

## 課題一覧

| 課題 | 開始地点 | 模範解答 | 難易度 | 推定時間 | 必要サービス |
|---|---|---|---:|---:|---|
| 28.1 課題28.1: Characterization Test 自動生成 (★★★) | `characterization-test.ts` | `characterization-test.solution.ts` | ★★★ | 150分 | なし |
| 28.2 課題28.2: Strangler Fig パターン実装 (★★★) | `strangler-fig.ts` | `strangler-fig.solution.ts` | ★★★ | 150分 | なし |
| 28.3 課題28.3: ADR ジェネレータ (★★) | `adr-gen.ts` | `adr-gen.solution.ts` | ★★ | 90分 | なし |
| 28.4 課題28.4: PII スキャナ + 削除キット (★★) | `pii-scanner.ts` | `pii-scanner.solution.ts` | ★★ | 90分 | なし |

## 課題詳細

### 28.1 課題28.1: Characterization Test 自動生成 (★★★)

**目的**: 仕様書のないレガシー関数に対して、「現在の振る舞い」を観測してテストを自動生成。

**難易度**: ★★★

**推定時間**: 150分 (記録データ構造の設計に25分、生成器と整形器の実装に60分、例外ケースと生成テストの実行検証に45分、記録形式の限界の観察に20分。)

**必要サービス**: なし

**前提**

- 28.3 Characterization Test を読み、仕様化ではなく現状追認であるという位置づけを確認する
- 28.1 レガシーコードの定義 を読み、テストの無いコードへ手を入れる危険を把握する
- node:test の `assert.deepEqual` と `assert.throws` を使ったテストを書ける

**完成条件 (自己採点用チェックリスト)**

- [ ] `generateCharacterizationTests({ fn, inputGenerator, numCases })` が numCases 件のケース配列を返す
- [ ] 対象関数が例外を投げた入力では、返り値の代わりに `{ throws: 'メッセージ' }` として記録される
- [ ] 記録したケースから node:test 形式のテストソース文字列を生成できる
- [ ] 同じ入力列に対して2回生成すると同一のアサーションが得られる (乱数を固定できる)
- [ ] 対象関数の挙動を1箇所変えると、生成済みテストが少なくとも1件失敗する

**期待出力**

- 戻り値が `{ input: [2], output: 4 }` と `{ input: [-1], output: { throws: 'negative' } }` のような要素を含む配列になる
- `renderNodeAssertions('./legacy.js', 'legacyCalculate', cases)` が `import test from 'node:test';` で始まり、ケース数と同数の `test('characterization N', ...)` 行を持つ文字列を返す
- 生成したテストを実行すると 100 ケースすべて pass し、対象関数を変更すると失敗件数が表示される
- `pnpm --filter @handbook/ch28 run test` の `characterization captures values and throws` が pass する

**観察項目**

- undefined、NaN、Date、循環参照を返す関数を対象にすると生成コードが壊れることを確認し、JSON ベースの記録形式の限界を把握する
- `inputGenerator` の分布を変えたときに到達する分岐がどれだけ増えるかを、対象関数へ標準エラー出力を仕込んで数える
- 明らかに誤った出力を1件見つけ、それも固定されてしまうことを確認して現状追認の意味を読み取る

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch28 run test` を実行し、`characterization captures values and throws` が pass することを確認する
2. `renderNodeAssertions` の出力をファイルへ書き出し、`pnpm --filter @handbook/ch28 exec tsx --test characterization.generated.test.ts` で全件 pass することを確認する
3. 対象のレガシー関数の演算子を1つ変えてから同じ生成テストを再実行し、1件以上 fail することで検知能力を採点する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 入力を生成する、実行して結果を記録する、記録をテストソースへ整形する、の3段に分け、記録のデータ構造を先に決める。
2. 構造: 戻り値と例外を同じ配列へ入れるため、output を「値」または `{ throws: message }` の判別可能なユニオンにする。整形時は入力と期待値を `JSON.stringify` で埋め込む。
3. 実装の要点: 実行結果はそのまま保持せず `structuredClone` で固定する。対象関数が同じオブジェクトを使い回して後から書き換える場合、参照のままだと記録が後で変化する。

**本番利用時の警告**

- 生成テストは正しい仕様ではなく現在の挙動を固定するため、既存のバグごとロックする。修正すべき挙動を見つけた場合はテスト側を更新する判断を差分の説明に必ず残す。
- 本番ログから採取した実データを入力生成に流用すると、個人情報がテストコードとしてリポジトリへ焼き付く。実データを使う場合は生成前にマスキングする。

**導線**

- 開始地点: `characterization-test.ts`
- 模範解答: `characterization-test.solution.ts`

### 28.2 課題28.2: Strangler Fig パターン実装 (★★★)

**目的**: 「旧システムを段階的に新システムに置き換える」を、ルーティングレイヤで実装。

**難易度**: ★★★

**推定時間**: 150分 (ルーティング規則の設計に25分、最長一致と canary の実装に55分、決定的テストと収束確認に50分、フォールバック方針の検討に20分。)

**必要サービス**: なし

**前提**

- 28.4 ストラングラーフィグパターン (Strangler Fig) を読み、旧システムを残したまま経路を切り替える手順を確認する
- 28.5 Branch by Abstraction を読み、経路切り替えと抽象化差し替えの使い分けを判断できるようにする
- URL のパス前置一致と `new URL(path, base)` の解決規則を理解している

**完成条件 (自己採点用チェックリスト)**

- [ ] `new StranglerRouter({ legacy, modern, routes })` がパスごとに legacy / modern / split を判定して転送先を返す
- [ ] `/api` が legacy、`/api/users` が modern のとき `/api/users/1` が最長一致で modern へ向かう
- [ ] split のルートで canaryPercent の割合だけ modern へ振り分けられる
- [ ] 乱数生成器を外部から注入でき、固定値を与えると振り分けが決定的になる
- [ ] `progress()` が legacy と modern の件数、および modernPercent を返す

**期待出力**

- `router.route('/api/users/1')` が `{ target: 'modern', url: 'http://new/api/users/1' }` の形のオブジェクトを返す
- `random: () => 0.1` を注入して canaryPercent 50 のルートを呼ぶと target が modern になる
- 複数回ルーティングした後の `progress()` が legacy、modern、modernPercent の3キーを持ち、modernPercent が 0 から 100 の数値になる
- `pnpm --filter @handbook/ch28 run test` の `strangler routes longest prefix and canary` が pass する

**観察項目**

- ルート定義の記述順を入れ替えても結果が変わらないことを確認し、最長一致ソートが順序依存を消していることを読み取る
- canaryPercent を 0、10、50、100 と上げながら1000回ルーティングし、modernPercent が設定値へ収束することを出力で確認する
- どのルートにも一致しないパスが legacy へ落ちることを確認し、移行中のデフォルト値が安全側に倒れていることを把握する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch28 run test` を実行し、`strangler routes longest prefix and canary` が pass することを確認する
2. `random` に固定値を注入した状態で同じパスを100回ルーティングし、`progress().modernPercent` が期待値と一致することをスクリプトで確認する
3. modern 側が停止した想定でのフォールバック方針 (そのままエラーを返すか legacy へ戻すか) を決め、その挙動を検証するテストを1件追加する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: ルータを「どちらへ送るかの判定」と「転送先URLの生成」に分け、判定は純粋関数として単体テストできる形にする。
2. 構造: routes を path の長さの降順にソートしてから `startsWith` で最初に一致したルールを採用する。split の場合は注入された乱数と canaryPercent を比較して target を決める。
3. 実装の要点: `Math.random` を直接呼ぶとテストが確率的になる。`options.random ?? Math.random` の形で差し替え可能にし、テストでは固定値を渡す。

**本番利用時の警告**

- この実装は転送先の死活監視、タイムアウト、リトライ、セッションの固定を持たない。実際に切り替える場合は canary 中の差分を検知するメトリクスとロールバック手順を先に用意する。
- パス前置一致だけで振り分けると `/api/users-export` のような意図しないパスまで新側へ流れる。本番では区切り文字を含めた一致条件にする。

**導線**

- 開始地点: `strangler-fig.ts`
- 模範解答: `strangler-fig.solution.ts`

### 28.3 課題28.3: ADR ジェネレータ (★★)

**目的**: 「なぜそう設計したか」を残す ADR (Architecture Decision Record) を CLI で生成。

**難易度**: ★★

**推定時間**: 90分 (テンプレートと採番規則の設計に20分、生成と supersede の実装に40分、一時ディレクトリでのテストに20分、CLI 引数まわりの調整に10分。)

**必要サービス**: なし

**前提**

- 28.11 ADR (Architecture Decision Record) ― 「なぜそう設計したか」を残す を読み、Status と Superseded の意味を確認する
- `node:fs/promises` の mkdir / readdir / readFile / writeFile を扱える
- 書き込み先の `docs/adr/` を用意するか、`mkdtemp` による一時ディレクトリで試す準備をする

**完成条件 (自己採点用チェックリスト)**

- [ ] 新規作成が `0007-use-postgres-over-mongodb-for-primary-db.md` のように4桁ゼロ埋め連番と slug から成るファイル名を作る
- [ ] 生成ファイルが `# 番号. タイトル` 見出しと Date、Status、Context、Decision、Consequences、Alternatives Considered の各節を含む
- [ ] supersede 実行で新しいADRが作られ、旧ADRの Status 行が `Superseded by 0008` の形に書き換わる
- [ ] 既存ファイルが無いディレクトリでも 0001 から採番が始まり、ディレクトリが無ければ作成される
- [ ] タイトルの大文字・空白・記号が slug で小文字ハイフン区切りへ正規化される

**期待出力**

- 空ディレクトリで1回目に `0001-first-decision.md`、2回目に `0002-new-decision.md` が作られる
- supersede 後に `0001-first-decision.md` の Status 行が `Status: Superseded by 0002` になる
- 新規ADRの Status デフォルト値が `Accepted`、Date が `YYYY-MM-DD` の10文字になる
- `pnpm --filter @handbook/ch28 run test` の `ADR creation and superseding` が pass する

**観察項目**

- 日本語や記号だけのタイトルを渡すと slug が空になりデフォルト名へ落ちることを確認し、多言語タイトルの扱いを決める
- 同じ番号で始まるファイルを人為的に2つ置き、`Math.max` ベースの採番がどう振る舞うかを確認する
- Status 行の置換に使う正規表現から複数行フラグを外すと置換が効かなくなることを比較して確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch28 run test` を実行し、`ADR creation and superseding` が pass することを確認する
2. 自作の `adr-gen.ts` に `process.argv` を読む CLI 入口を足し、`pnpm --filter @handbook/ch28 exec tsx adr-gen.ts new "Use Postgres over MongoDB"` で生成ファイル名が標準出力へ出ることを確認する (模範解答は関数のみを export し CLI 部分は読者の実装範囲)
3. `ls docs/adr` の並び順が採番順と一致し、`grep -n '^Status:' docs/adr/*.md` の結果で Superseded 行がちょうど1件増えていることを確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 次の番号を決める、本文を組み立てる、ファイルへ書く、旧ADRの Status を書き換える、の4つを別関数に分け、引数解釈は最後に薄く被せる。
2. 構造: readdir の結果から `/^([0-9]+)/` で番号を取り出し `Math.max(0, ...) + 1` を次番号とする。ファイル名は `String(number).padStart(4, '0')` と slug の連結で作る。
3. 実装の要点: Status の書き換えは `text.replace(/^Status:.*$/m, ...)` のように m フラグを付ける。付け忘れると先頭行しか一致せず、Status 行が更新されない。

**本番利用時の警告**

- 採番は readdir と書き込みの間に排他が無く、並行作業やブランチ間で番号が衝突する。実運用ではレビュー時に番号重複を検査する仕組みを併用する。
- ADR の Context に顧客名、契約金額、未公表の障害情報を書いたまま社外へリポジトリを共有すると、そのまま漏えいになる。公開範囲を決めてから書く。

**導線**

- 開始地点: `adr-gen.ts`
- 模範解答: `adr-gen.solution.ts`

### 28.4 課題28.4: PII スキャナ + 削除キット (★★)

**目的**: GDPR 対応の基本「個人情報の検出 + ユーザー単位の削除」を実装。

**難易度**: ★★

**推定時間**: 90分 (ルールと行番号計算の実装に35分、マスクとファイル入出力に25分、削除キットのスタブテストに20分、誤検出と取りこぼしの観察に10分。)

**必要サービス**: なし

**前提**

- 28.14 Web に関わる主要規制 ― GDPR、CCPA、SOC 2、HIPAA、APPI を読み、削除権と対象データの範囲を確認する
- 正規表現の g フラグと `lastIndex`、`matchAll` の挙動を理解している
- メール・電話番号・カード番号を含むダミーのログファイルを用意する

**完成条件 (自己採点用チェックリスト)**

- [ ] `addRule({ name, pattern })` で追加した各ルールについて `scanText` が行番号と列番号付きの findings を返す
- [ ] findings が line 昇順、同一行内では column 昇順に整列している
- [ ] `maskText` が検出箇所をルール名の大文字を含む `[REDACTED-EMAIL]` のような文字列へ置換する
- [ ] `scanFile` と `maskFile` が実ファイルを読み書きし、入力ファイルを破壊せず別パスへ出力する
- [ ] `DataEraser.deleteAllForUser(userId, { tables })` がテーブル名をキーとする削除件数のオブジェクトを返す

**期待出力**

- `scanText('x a@b.com')` が `[{ line: 1, column: 3, rule: 'email', match: 'a@b.com' }]` の形を返す
- `maskText('a@b.com')` が `[REDACTED-EMAIL]` を返す
- `deleteAllForUser('u', { tables: ['a','b'] })` が `{ a: 1, b: 1 }` のような件数マップを返し、tables の数だけ削除が呼ばれる
- `pnpm --filter @handbook/ch28 run test` の `PII scanner masks and erases` が pass する

**観察項目**

- g フラグ付きの同一 RegExp を使い回して `test` を2回呼び、`lastIndex` が残って2回目が false になる現象を再現する
- カード番号ルールを4桁区切り限定にすると、区切り無しの16桁を取りこぼすことを確認する
- マスク後のファイルを再スキャンし、findings が0件になることを確認する
- tables から1つ外して削除を実行し、そのテーブルにデータが残ることを戻り値の件数で確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch28 run test` を実行し、`PII scanner masks and erases` が pass することを確認する
2. ダミーログに対し scanFile、maskFile、再度 scanFile の順で実行し、最後の findings が空配列であることを確認する
3. `DataEraser` へ呼び出しを記録するスタブを渡し、tables の件数と `deleteWhere` の呼び出し回数が一致することで削除漏れが無いことを採点する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 検出ルールをデータとして外へ出し、スキャナ本体はルールを回すだけにする。行番号は先に改行位置の配列を作ってから二分探索や線形探索で求める。
2. 構造: `matchAll` で得た `index` を改行位置配列と突き合わせて line と column を計算し、`{ line, column, rule, match }` を集めて最後にソートする。マスクは同じルール配列で `replace` を回す。
3. 実装の要点: ルールの RegExp に g フラグが無い場合、`matchAll` は例外になり `replace` は1件しか置換しない。`new RegExp(rule.pattern.source, flags + 'g')` のように g を補ってから使う。

**本番利用時の警告**

- 正規表現ベースの検出は取りこぼしと誤検出が必ず残る。これを唯一のGDPR対応根拠にすると、削除漏れのまま対応済みと報告することになる。本番ではデータカタログで保有場所を管理する。
- 本物のログや本番DBに対して maskFile や deleteAllForUser を試さない。削除は取り消せず、バックアップ、レプリカ、監査ログ、外部SaaSへ渡した複製は消えない。
- 検出したPIIの全文を findings としてコンソールやCIログへ出すと、それ自体が二次的な漏えい経路になる。実運用では位置とルール名だけを記録する。

**導線**

- 開始地点: `pii-scanner.ts`
- 模範解答: `pii-scanner.solution.ts`

## 評価方法

1. starterから開始し、本文の要件と課題詳細の完成条件を満たす。
2. 期待出力・観察項目を記録する。
3. 完成条件のチェックリストで自己採点し、未達項目を残す。
4. solutionとの差分を説明する。
5. `pnpm --filter @handbook/ch28 run test` を実行する。

## 安全上の注意

- 脆弱性・ネットワーク・OS・コンテナの演習は、localhostまたは隔離環境だけで実行してください。
- 教材用の簡略実装をそのまま本番へ投入しないでください。
- 各課題の「本番利用時の警告」を読まずに、演習コードを製品コードへ流用しないでください。

## 配布対象外

`node_modules/`、`dist/`、`coverage/`、一時DB、秘密情報、計測生成物は配布対象外です。
