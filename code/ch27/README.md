# 第27章 設計とドメインモデリング — コード教材

## 前提環境

- Node.js 24.18.0 LTS
- pnpm 11.15.1
- TypeScript 6.0.3

## 共通コマンド

```bash
pnpm install
pnpm --filter @handbook/ch27 run lint
pnpm --filter @handbook/ch27 run typecheck
pnpm --filter @handbook/ch27 run test
pnpm --filter @handbook/ch27 run build
```

> `solution` は要件一覧ではなく、実行・観察できる模範実装でなければなりません。`referenceArtifact` や `model answer scaffold` は検証エラーになります。

## 課題一覧

| 課題 | 開始地点 | 模範解答 | 難易度 | 推定時間 | 必要サービス |
|---|---|---|---:|---:|---|
| 27.1 課題27.1: Value Object と不変条件 (★★) | `value-objects.ts` | `value-objects.solution.ts` | ★★ | 90分 | なし |
| 27.2 課題27.2: Repository パターン (in-memory + interface) (★★) | `repository.ts` | `repository.solution.ts` | ★★ | 90分 | なし |
| 27.3 課題27.3: Aggregate と Domain Event (★★★) | `aggregate.ts` | `aggregate.solution.ts` | ★★★ | 150分 | なし |
| 27.4 課題27.4: Clean Architecture (Use Case 中心) (★★★) | `clean-arch/starter/main.ts` | `clean-arch/solution/main.ts` | ★★★ | 150分 | なし |
| 27.5 課題27.5: 曖昧な要望を検証可能な仕様へ変換する (★★★) | `spec-to-tests/starter/main.ts` | `spec-to-tests/solution/main.ts`<br>`spec-to-tests/solution/report.ts` | ★★★ | 150分 | なし |

## 課題詳細

### 27.1 課題27.1: Value Object と不変条件 (★★)

**目的**: 「ありえない状態を型で防ぐ」を実装。

**難易度**: ★★

**推定時間**: 90分 (4つのVOの実装に45分、失敗系アサーションの追加とテスト実行に30分、ハッシュコストの計測と観察記録に15分。)

**必要サービス**: なし

**前提**

- 27.2 Value Object の実例 を読み、識別子ではなく値で等価性が決まる型の役割を確認する
- 27.7 SOLID 原則 の単一責任を読み、検証ロジックを呼び出し側ではなくVO内へ寄せる理由を押さえる
- node:crypto の randomBytes / pbkdf2Sync / timingSafeEqual をTypeScriptから呼べる
- `code/ch27` で pnpm install 済みで、`pnpm --filter @handbook/ch27 run typecheck` が通る状態にする

**完成条件 (自己採点用チェックリスト)**

- [ ] `Email.create(' A@EXAMPLE.COM ')` が `a@example.com` へ trim と小文字化され、`Email.create('bad')` が throw する
- [ ] `Money.create(100,'JPY').add(Money.create(50,'JPY')).amount` が 150 になり、通貨違いの add と負数・非整数の生成が throw する
- [ ] `Password.create('Weak1')` が throw し、`Password.create('Strong-Pass-123!')` の `verify('Strong-Pass-123!')` が true を返す
- [ ] Password インスタンスを `JSON.stringify` しても平文パスワードが出力に含まれない
- [ ] UserId 相当の型が UUID v4 形式でない文字列を拒否する
- [ ] 4つのVOがすべて private constructor と static create を持ち、生成後にフィールドを再代入できない

**期待出力**

- `Email.create(' A@EXAMPLE.COM ').value` が `a@example.com` という正規化済み文字列を返す
- 不正入力では `Invalid email` / `Invalid amount` / `Currency mismatch` / `Weak password` のいずれかの Error メッセージが投げられる
- Password は salt と digest の Buffer だけを保持し、出力してもハッシュ済みバイト列しか見えない
- `pnpm --filter @handbook/ch27 run test` の `value objects enforce invariants` が pass と表示される

**観察項目**

- pbkdf2Sync の反復回数を 50_000 から 1_000 へ下げて `Password.create` の所要時間を計測し、コストパラメータが総当たり耐性と応答時間のトレードオフであることを確認する
- `Money.add` が新しいインスタンスを返し、加算前の Money の amount が変化しないことを add 前後の出力で確認する
- Email の正規表現を `/@/` のような素朴な判定へ置き換え、通ってしまう入力 (`a@b`、空白入り、複数@) を列挙する
- `verify` の比較を `equals` ではなく `timingSafeEqual` で行う理由を、digest 長が固定されている点と合わせて確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch27 run test` を実行し、`value objects enforce invariants` を含む4テストが pass することを確認する
2. `pnpm --filter @handbook/ch27 exec tsx value-objects.solution.ts` を実行し、例外なく終了する (このモジュールは export のみで標準出力を持たない) ことを確認する
3. solutions.test.ts の import 先を自分の `value-objects.ts` へ向けたコピーを作り、同じアサーションが通るかで自己採点する
4. `pnpm --filter @handbook/ch27 run typecheck` が 0 エラーで終わることを確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 4つの不変条件を「入力を正規化してから検証する」順序で並べ直し、コンストラクタを private にして static create だけを外へ出す方針から始める。
2. 構造: Email は trim と toLowerCase の後に正規表現判定、Money は amount と currency を readonly で保持し add は新インスタンスを返す、Password は randomBytes の salt と pbkdf2Sync の digest を保持する構成にする。
3. 実装の要点: `verify` は `pbkdf2Sync(value, this.salt, 50_000, 32, 'sha256')` の結果を `timingSafeEqual` で比較する。長さの異なる Buffer を渡すと timingSafeEqual 自体が例外を投げるため、digest 長は固定する。

**本番利用時の警告**

- この Password は pbkdf2 50,000回・SHA-256 固定で、パラメータのバージョニングもログイン試行制限も持たない。本番では Argon2id や bcrypt のように後からコストを上げられる実装とレート制限を併用する。
- Email の簡易正規表現は RFC 5322 を満たさず到達性も確認しない。そのまま登録フローに使うと存在しないアドレスでアカウントが作られる。本番では確認メールによる検証を必須にする。

**導線**

- 開始地点: `value-objects.ts`
- 模範解答: `value-objects.solution.ts`

### 27.2 課題27.2: Repository パターン (in-memory + interface) (★★)

**目的**: ドメイン層から DB の詳細を隠す。

**難易度**: ★★

**推定時間**: 90分 (interface と in-memory 実装で30分、複製セマンティクスのテスト追加に35分、2つ目の実装での差し替え確認に25分。)

**必要サービス**: なし

**前提**

- 27.4 Repository パターン を読み、ドメイン層が interface だけを知る依存方向を確認する
- 課題27.1 で作った Value Object を再利用できる状態にし、UserId を識別子として扱えるようにする
- TypeScript の branded type (`string & { readonly __brand: 'UserId' }`) と `structuredClone` の挙動を理解している

**完成条件 (自己採点用チェックリスト)**

- [ ] `UserRepository` interface が findById / save / delete の3メソッドだけを宣言し、SQL やテーブル名の語を含まない
- [ ] `InMemoryUserRepository` が UserRepository を implements し、Map だけで永続化を代替する
- [ ] `findById` で取得した User のフィールドを書き換えても、次の `findById` の結果が変わらない
- [ ] 存在しないIDの `findById` が例外ではなく `null` を返す
- [ ] `delete` 実行後の `findById` が `null` を返す

**期待出力**

- `await repo.findById(userId('u1'))` が保存済みなら `{ id, name, version }` を持つオブジェクト、未保存なら `null` を返す
- 取得した User の name を 'B' に書き換えた後も、再取得した name が 'A' のままである
- `pnpm --filter @handbook/ch27 run test` の `repository clones entities` が pass する

**観察項目**

- `structuredClone` を外して参照をそのまま返す実装に変え、呼び出し側の書き換えがストアへ漏れることをテストの失敗として確認する
- UserId を素の string に変えると任意の文字列を findById へ渡せてしまうことを、typecheck の結果の差で確認する
- InMemory 実装を別実装へ差し替えたとき、変更が生成箇所の1行だけに収まることを差分で確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch27 run test` を実行し、`repository clones entities` が pass することを確認する
2. `pnpm --filter @handbook/ch27 run typecheck` を実行し、`userId()` を通さない生の文字列を findById へ渡したコードが型エラーになることを確認する
3. 同じ interface を実装した2つ目のクラス (例: JSONファイル保存版) を書き、生成箇所だけ差し替えて既存アサーションが全件通るかで差し替え可能性を採点する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 先にドメイン層が知ってよい語彙を決める。interface のシグネチャに SQL、テーブル名、コネクションが現れない形を書き出してから実装に移る。
2. 構造: `Map<UserId, User>` を private フィールドに持ち、findById / save / delete をすべて async にする。IDは branded type にし、`userId(v: string)` のような生成関数を1つだけ公開する。
3. 実装の要点: `save` と `findById` の両方で `structuredClone` を通す。片方だけだと、呼び出し側が保持した参照からストア内のオブジェクトが書き換わる。

**本番利用時の警告**

- in-memory 実装はプロセス再起動で全件消え、複数プロセス間でも共有されない。SQL 実装へ置き換える際はトランザクション境界と version 列による楽観ロックを別途設計する必要がある。
- `structuredClone` は関数やクラスインスタンスを複製できず例外になる。Entity にメソッドを持たせる設計へ進む場合、この複製戦略はそのまま流用できない。

**導線**

- 開始地点: `repository.ts`
- 模範解答: `repository.solution.ts`

### 27.3 課題27.3: Aggregate と Domain Event (★★★)

**目的**: 「整合性境界」と「イベント発火」を実装。

**難易度**: ★★★

**推定時間**: 150分 (状態遷移表の作成に20分、Aggregate とイベント発火の実装に60分、不正遷移の失敗系テスト追加に45分、境界破りの観察記録に25分。)

**必要サービス**: なし

**前提**

- 27.3 Aggregate と整合性境界 を読み、Aggregate Root 経由でしか内部を変更させない理由を確認する
- 27.1 ドメイン駆動設計 (DDD) の基本 のドメインイベントの説明を読み、状態変化と通知の関係を把握する
- 課題27.1 の `Money` が動作し、`code/ch27/value-objects.solution.ts` から import できる

**完成条件 (自己採点用チェックリスト)**

- [ ] `Order.create({ customerId: 'c1' })` が id を採番し、customerId が空なら throw する
- [ ] `addItem` が quantity 0 以下を拒否し、submit 済みの Order への追加が throw する
- [ ] 空の Order に対する `submit()` が throw し、item が1件以上あれば成功する
- [ ] `submit()` 後の1回目の `pullEvents()` が type `OrderSubmitted` のイベントを1件返し、2回目は空配列を返す
- [ ] `total()` が 単価 × 数量 の合計を Money で返し、通貨の異なる item を混ぜると throw する

**期待出力**

- price 100・quantity 2 の item 1件で `order.total().amount` が 200 を返す
- `pullEvents()` の要素が `{ type: 'OrderSubmitted', occurredAt, payload: { orderId, customerId, total } }` の形になる
- submit 済み Order への `addItem` が `Order already submitted` の Error を投げる
- `pnpm --filter @handbook/ch27 run test` の `aggregate enforces boundary and emits event` が pass する

**観察項目**

- items 配列を public にして外部から push できるようにすると、submit 済みという不変条件が破れることを試して確認する
- `pullEvents` を内部配列をクリアしない getter に変え、同じイベントが2回配信されうることを出力回数で確認する
- 本文の遷移 draft から submitted、paid、shipped、delivered のうち模範解答が submitted までしか実装していない点を確認し、残りの遷移表を自分で書き出す
- イベント push を状態更新の前に移すと、検証失敗時にもイベントが残ることを確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch27 run test` を実行し、`aggregate enforces boundary and emits event` が pass することを確認する
2. paid / shipped / delivered まで遷移を拡張し、delivered から submit を呼ぶと throw するテストを自分で追加して pass させる
3. `pullEvents()` を続けて2回呼び、1回目が1件・2回目が0件であることを出力して目視確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: まず現在状態と操作の組み合わせに対する次状態または例外を表にし、その表をそのままガード条件へ写す。
2. 構造: Order は private constructor と static create、内部に items 配列、events 配列、状態フラグを持つ。addItem はガード後に push、submit は検証、状態更新、events への追加の順で行う。
3. 実装の要点: `pullEvents()` は `const out = [...this.events]; this.events.length = 0; return out;` のようにコピーを返してから内部を空にする。内部配列をそのまま返すと呼び出し側の手元で中身が消える。

**本番利用時の警告**

- イベントは配列に溜めるだけで永続化もリトライもしないため、プロセスが落ちれば消える。本番では Aggregate の保存とイベント発行を同一トランザクションに入れる transactional outbox が必要になる。
- `total()` は単価 × 数量をその場で計算し、税・割引・丸め規則を持たない。金額を扱う本番実装では通貨ごとの最小単位と丸め方針を明示しないと請求額がずれる。

**導線**

- 開始地点: `aggregate.ts`
- 模範解答: `aggregate.solution.ts`

### 27.4 課題27.4: Clean Architecture (Use Case 中心) (★★★)

**目的**: 同じ機能を「Service / Use Case / Repository / Controller」の4層で実装。

**難易度**: ★★★

**推定時間**: 150分 (4層の分割設計に30分、Use Case と Controller の実装に60分、ステータス写像の失敗系テストに40分、差し替え確認と観察に20分。)

**必要サービス**: なし

**前提**

- 27.5 Clean Architecture と Hexagonal を読み、依存が外側から内側への一方向であることを確認する
- 課題27.2 の Repository interface を完成させ、Use Case が実装ではなく interface を受け取る形を作れる
- `code/ch27/clean-arch/starter/main.ts` を開き、solution 側の `buildApplication` と同じ公開形を目標に据える

**完成条件 (自己採点用チェックリスト)**

- [ ] Domain / UseCase / Repository / Controller の4区分が分かれ、Use Case が具体的な Repository 実装を import していない
- [ ] `TaskController.create` が title が文字列でない body に 400、trim 後が空の title に 422、正常時に 201 を返す
- [ ] `TaskController.complete` が存在するIDに 200、存在しないIDに 404 を返す
- [ ] `buildApplication()` が Repository と Use Case と Controller を組み立てる唯一の合成箇所になっている
- [ ] Use Case のコンストラクタが interface 型の依存だけを受け取り、内部で実装クラスを new しない

**期待出力**

- `await app.controller.create({ title: ' task ' })` が `{ status: 201, body: { id, title: 'task', completed: false } }` を返す
- `await app.controller.complete('missing')` が `{ status: 404, body: { error: 'task not found' } }` を返す
- `pnpm --filter @handbook/ch27 run test` の `clean architecture controller maps errors` が pass する

**観察項目**

- Use Case が投げる Error が Controller で 400 / 422 / 404 へ翻訳される箇所を追い、内側の層に HTTP の語が出ていないことを確認する
- InMemoryTaskRepository を別実装へ差し替え、変更が `buildApplication` の中だけで済むことを差分で確認する
- Controller から Use Case を飛ばして Repository を直接呼ぶ版を書き、抜け落ちる検証 (title の trim、存在確認) を数える

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch27 run test` を実行し、`clean architecture controller maps errors` が pass することを確認する
2. `pnpm --filter @handbook/ch27 exec tsx clean-arch/solution/main.ts` を実行し、例外なく終了する (このモジュールは export のみで標準出力を持たない) ことを確認する
3. 自作の `clean-arch/starter/main.ts` から `buildApplication` を import する小さなスクリプトを書き、create、complete、存在しないIDの complete で 201 / 200 / 404 が順に出ることを確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 先に依存の矢印だけを描く。Controller から UseCase、UseCase から Domain、Infra から interface の向きで、内側が外側のファイル名を知らない状態を保つ。
2. 構造: TaskRepository interface (save / find / list)、CreateTaskUseCase と CompleteTaskUseCase (コンストラクタで repo を受け取る)、status と body を返す TaskController、そして buildApplication の4段構成にする。
3. 実装の要点: 入力の型不正 (title が文字列でない) は Controller で 400、ドメイン検証の失敗 (trim 後が空) は catch して 422 と、判定箇所を分ける。まとめて扱うと両方が 400 に潰れる。

**本番利用時の警告**

- この Controller は HTTP フレームワークを持たず、認証・CSRF 対策・レート制限・ボディサイズ制限を一切行わない。実際に公開する場合は Use Case の外側にこれらを必ず追加する。
- Error のメッセージをそのまま body へ返しているため、本番では内部実装の情報が利用者へ漏れる。公開APIではエラーコードへ写して返す。

**導線**

- 開始地点: `clean-arch/starter/main.ts`
- 模範解答: `clean-arch/solution/main.ts`

### 27.5 課題27.5: 曖昧な要望を検証可能な仕様へ変換する (★★★)

**目的**: 1行の曖昧な要望を、業務ルール、状態遷移、受け入れ条件、API契約、非機能要件まで機械可読な仕様へ落とし、その仕様から受け入れテストを生成して実装を採点する。

**難易度**: ★★★

**推定時間**: 150分 (仕様データ構造の設計と本文の表の転記に35分、招待サービスの実装に40分、受け入れ実行器と監査の実装に45分、観察項目の書き換え比較に30分。)

**必要サービス**: なし

**前提**

- 27.13 問題定義とユーザーストーリー を読み、要望を問題定義とストーリーへ戻す5つの問いを確認する
- 27.14 ユースケース、状態遷移、業務ルール を読み、遷移表の欄を空けないという方針と業務ルールの3分類を押さえる
- 27.15 受け入れ条件と Example Mapping を読み、境界と失敗を含む例の出し方を確認する
- 27.16 と 27.17 を読み、ルールをステータスコードへ写す表と、非機能要件の5項目を手元に用意する
- `code/ch27` で pnpm install 済みで、`pnpm --filter @handbook/ch27 run typecheck` が通る状態にする

**完成条件 (自己採点用チェックリスト)**

- [ ] `buildInvitationSpec()` が story、rules、transitions、examples、contract、nfr の6つをすべて返す
- [ ] 遷移表が4状態 × 3事象の12マスをすべて埋め、欄を1つ削ると型エラーになる
- [ ] examples が BR-01 から BR-05 のすべてに1件以上紐づき、上限ちょうど・期限ちょうどの境界例を含む
- [ ] `runAcceptanceChecks` が期待値をコードへ直書きせず、`spec.examples` だけを読んで判定する
- [ ] `auditSpec` が、例の紐づかないルール・遷移表の空欄・一度も観測されない契約ステータスの3つを検出する
- [ ] `pnpm --filter @handbook/ch27 exec tsx spec-to-tests/starter/report.ts` が acceptance 13/13 passed を出力する

**期待出力**

- `spec audit: rules=5 covered=5 / transitions=12 filled=12 / statuses=6 exercised=6` が1行目に出る
- `acceptance: 13/13 passed` が2行目に出て、失敗した例の行が続かない
- `service.invite()` の2回目が status 200 と1回目と同じ招待IDを返し、通知の予約件数は1のままである
- 有効期限ちょうどの時刻での受諾が status 410 と error `invitation_expired` を返す
- `pnpm --filter @handbook/ch27 run test` の `spec drives acceptance checks` が pass と表示される

**観察項目**

- `ttlDays` を7から14へ変えて受け入れテストを実行し、失敗する例が E-01・E-08・E-09 の3件だけに限定されることを確認する。仕様と検証が1対1で対応していれば、壊れた箇所が特定できる
- examples から BR-05 の参照を外して `auditSpec` を実行し、`uncoveredRules` に BR-05 が現れることを確認する
- 遷移表の `revoked.accept` を `noop` へ変え、E-10 だけが落ちることを確認する。表の1マスがどの例に対応しているかを追う
- 期限切れを保存された状態にする実装へ書き換え、期限到来時にバッチが動かない場合に `effectiveState` の結果がどうずれるかを比較する
- contract から 404 の行を削除して `auditSpec` を実行し、`undeclaredStatuses` に 404 が現れることを確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch27 exec tsx spec-to-tests/solution/report.ts` を実行し、audit 行と acceptance 行の2行だけが出力されることを確認する
2. `pnpm --filter @handbook/ch27 run test` を実行し、`spec drives acceptance checks`、`breaking one rule fails only its examples`、`transition table has no empty cell` の3つが pass することを確認する
3. 自分の `spec-to-tests/starter/report.ts` を実行し、solution と同じ2行が出るかで自己採点する
4. `pnpm --filter @handbook/ch27 run typecheck` が 0 エラーで終わることを確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 先に仕様データの形だけを決める。story、rules、transitions、examples、contract、nfr の6つを空配列で並べ、実装より前に「どの工程の出力がどのフィールドに入るか」を確定させる。
2. 構造: examples は given (準備の手順列)、when (1手の操作)、then (期待値) の3部に分け、given と when を同じ Step 型で表す。こうすると実行器は Step を1種類だけ解釈すればよく、例を足すたびにコードを変えずに済む。
3. 実装の要点: `runAcceptanceChecks` は例ごとに新しいサービスを作る必要があるため、インスタンスではなく生成関数 `(options) => InvitationService` を受け取る。時刻は `now: () => Date` として注入し、`advance` ステップで可変のミリ秒を進める。`Date.now()` を直接呼ぶと期限の境界例を再現できない。

**本番利用時の警告**

- この実装はメモリ上のMapだけで永続化を代替し、同時実行制御を持たない。実際には「メンバー数50名」の検査と招待の作成が別トランザクションになると上限を超えるため、本番では集約単位のロックまたは一意制約で守る必要がある。
- 契約に認証・認可の失敗 (401 / 403) とレート制限 (429) を含めていない。公開APIとして出す場合、これらを契約へ加えないとクライアントは未知の応答を受け取ることになる。
- 受け入れテストは仕様データの正しさを検証しない。仕様そのものが誤っていれば、実装と検証がそろって誤ったまま緑になる。仕様の妥当性は Example Mapping の場で依頼者と確認する工程が担う。

**導線**

- 開始地点: `spec-to-tests/starter/main.ts`
- 模範解答: `spec-to-tests/solution/main.ts`、`spec-to-tests/solution/report.ts`

## 評価方法

1. starterから開始し、本文の要件と課題詳細の完成条件を満たす。
2. 期待出力・観察項目を記録する。
3. 完成条件のチェックリストで自己採点し、未達項目を残す。
4. solutionとの差分を説明する。
5. `pnpm --filter @handbook/ch27 run test` を実行する。

## 安全上の注意

- 脆弱性・ネットワーク・OS・コンテナの演習は、localhostまたは隔離環境だけで実行してください。
- 教材用の簡略実装をそのまま本番へ投入しないでください。
- 各課題の「本番利用時の警告」を読まずに、演習コードを製品コードへ流用しないでください。

## 配布対象外

`node_modules/`、`dist/`、`coverage/`、一時DB、秘密情報、計測生成物は配布対象外です。
