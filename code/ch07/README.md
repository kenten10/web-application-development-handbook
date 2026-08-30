# 第7章 状態管理とデータフェッチング — コード教材

## 前提環境

- Node.js 24.18.0 LTS
- pnpm 11.15.1
- TypeScript 6.0.3

## 共通コマンド

```bash
pnpm install
pnpm --filter @handbook/ch07 run lint
pnpm --filter @handbook/ch07 run typecheck
pnpm --filter @handbook/ch07 run test
pnpm --filter @handbook/ch07 run build
```

> `solution` は要件一覧ではなく、実行・観察できる模範実装でなければなりません。`referenceArtifact` や `model answer scaffold` は検証エラーになります。

## 課題一覧

| 課題 | 開始地点 | 模範解答 | 難易度 | 推定時間 | 必要サービス |
|---|---|---|---:|---:|---|
| 7.1 課題7.1: Redux を自作する (★★) | `redux.ts` | `redux.solution.ts` | ★★ | 90分 | なし |
| 7.2 課題7.2: TanStack Query 風キャッシュ (★★★) | `query-cache.ts` | `query-cache.solution.ts` | ★★★ | 150分 | なし |
| 7.3 課題7.3: 楽観的更新の実装 (★★) | `optimistic/starter/README.md`<br>`optimistic/starter/optimistic-update.ts` | `optimistic/solution/README.md`<br>`optimistic/solution/optimistic-update.ts` | ★★ | 90分 | なし |
| 7.4 課題7.4: フォームの reactive validation (★★) | `form-validation.ts` | `form-validation.solution.ts` | ★★ | 90分 | なし |

## 課題詳細

### 7.1 課題7.1: Redux を自作する (★★)

**目的**: Redux の核は実は数十行で書ける。これを自作することで、Reducer・Action・Store の役割を完全に理解する。

**難易度**: ★★

**推定時間**: 90分 (createStore の骨格実装に25分、subscribe と解除関数、再入防止に35分、テスト実行と破壊的更新の観察に30分)

**必要サービス**: なし

**前提**

- 7.2 Flux と Redux ― 単方向データフローの徹底 を読み、action、reducer、store の役割分担を説明できる状態にする
- 7.1 状態の3分類 を読み、共有状態としてストアに置くべきものの範囲を把握しておく
- `pnpm --filter @handbook/ch07 run test` が実行できる状態にしておく

**完成条件 (自己採点用チェックリスト)**

- [ ] `code/ch07/redux.ts` に `createStore(reducer, initialState)` を実装し、`getState` / `dispatch` / `subscribe` を持つオブジェクトを返す
- [ ] `dispatch` が reducer の戻り値で状態を置き換え、その後で登録済みリスナーを全件呼ぶ
- [ ] `subscribe` が解除関数を返し、解除後の dispatch ではそのリスナーが呼ばれない
- [ ] reducer の実行中に dispatch されたら例外を投げ、再入を防いでいる
- [ ] `solutions.test.ts` の import を自分の実装へ向けた状態で `pnpm --filter @handbook/ch07 run test` が全件パスする

**期待出力**

- テスト `Redux store notifies subscribers and unsubscribe works` が pass する
- `inc`、`set(10)`、解除、`inc` の順に dispatch したとき、リスナーが記録した配列が `[1, 10]` になり、最終 `getState()` が 11 になる
- reducer 内から dispatch すると `Reducers may not dispatch actions` のようなエラーが throw される
- 同じリスナーの解除関数を2回呼んでも例外にならず、2回目は何もしない

**観察項目**

- リスナー集合を反復中にコピーせず直接回す実装に変え、リスナー内で subscribe や解除を行ったときに反復が壊れることを確認する
- reducer が state を破壊的に変更する版へ書き換え、`getState()` の参照が変わらないために変更検知ができなくなることを確認する
- dispatch を1000回連続で呼び、リスナー数に比例して通知コストが増えることを計測する
- `replaceReducer` で reducer を差し替え、既存の state を保ったまま挙動だけ変わることを確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch07 run test` を実行し、Redux ストアのテストが pass すれば合格
2. `pnpm --filter @handbook/ch07 run typecheck` を実行し、`Store<State, A>` のジェネリクスでエラー0件なら合格
3. reducer の中から `store.dispatch` を呼ぶコードを一時的に書き、例外が投げられることを確認してから削除する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: createStore の中身はクロージャ変数3つ (現在の state、現在の reducer、リスナー集合) だけで足りる。まず getState と dispatch を通し、subscribe は後から足す
2. 構造: リスナーは `Set<() => void>` で保持し、subscribe は `active` フラグ付きの解除関数を返す。dispatch では `[...listeners]` のコピーを回してから通知する
3. 実装の要点: 再入防止は `dispatching` フラグ1つで実現する。フラグの解除を `finally` に置かないと、reducer が例外を投げたあとストアが二度と dispatch を受け付けなくなる

**本番利用時の警告**

- この実装は Redux DevTools 連携、ミドルウェア、非同期アクションを持たない。ログや API 呼び出しを reducer へ書き足すと純粋性が壊れ、状態の再現ができなくなる
- state を破壊的に変更しても検知できないため、reducer が誤って引数を書き換えると UI が更新されないバグになる。本番では immer などの不変性の保証を伴う仕組みを使う

**導線**

- 開始地点: `redux.ts`
- 模範解答: `redux.solution.ts`

### 7.2 課題7.2: TanStack Query 風キャッシュ (★★★)

**目的**: サーバ状態管理の中核「重複リクエスト排除、キャッシュ、再検証、エラー処理」を自作する。

**難易度**: ★★★

**推定時間**: 150分 (エントリ構造とキーシリアライズの設計に35分、dedupe と staleTime 判定に45分、invalidate と GC の実装に40分、時刻注入による境界検証に30分)

**必要サービス**: なし

**前提**

- 7.4 サーバ状態の特殊性 を読み、staleTime と gcTime が別の概念であることを説明できる状態にする
- 7.5 TanStack Query (React Query) ― サーバ状態管理の代表例 を読み、queryKey と無効化の考え方を把握しておく
- 5.4 非同期処理の進化 を読み、複数の await が同じ Promise を共有する挙動を理解しておく
- `pnpm --filter @handbook/ch07 run test` が実行できる状態にしておく

**完成条件 (自己採点用チェックリスト)**

- [ ] `code/ch07/query-cache.ts` に `QueryCache` クラスを実装し、`fetch(key, fetcher, options)` が同じ queryKey の in-flight Promise を共有する
- [ ] queryKey のシリアライズがキーの順序に依存せず、`['user', 1]` のような配列とネストしたオブジェクトを安定して同じ文字列へ落とす
- [ ] `staleTime` 内の再取得ではフェッチャを呼ばずキャッシュ値を返す
- [ ] `invalidate(prefix)` がプレフィクス一致するエントリを stale にし、次の fetch で再取得が走る
- [ ] `collectGarbage()` が `gcTime` を超えて未使用のエントリだけを削除し、削除件数を返す
- [ ] `solutions.test.ts` の import を自分の実装へ向けた状態で `pnpm --filter @handbook/ch07 run test` が全件パスする

**期待出力**

- テスト `QueryCache deduplicates in-flight requests and respects staleTime` が pass する
- 同じキーで3本同時に fetch しても、フェッチャの呼び出し回数が 1 のままで、3つの戻り値が等しくなる
- staleTime 100 の設定で時刻を 50 へ進めても呼び出し回数が 1 のままで、`invalidate` 後の fetch で 2 に増える
- `inspect(key)` が `updatedAt`、`lastUsedAt`、`stale`、`inFlight` を含むエントリを返す

**観察項目**

- 現在時刻を注入可能にした `now()` を差し替え、実時間を待たずに staleTime と gcTime の境界を跨いだときの挙動を観察する
- in-flight の共有を外して毎回新しい Promise を作る版に変え、同時3リクエストでフェッチャ呼び出しが3回に増えることを確認する
- フェッチャが reject したときに `inFlight` が確実に undefined へ戻るかを `inspect` で確認し、次回 fetch がリトライされることを見る
- キーを `['user', { id: 1, sort: 'asc' }]` と `['user', { sort: 'asc', id: 1 }]` の2通りで渡し、シリアライズ結果が一致することを確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch07 run test` を実行し、QueryCache のテストが pass すれば合格
2. `pnpm --filter @handbook/ch07 run typecheck` を実行し、`fetch<T>` の戻り値型でエラー0件なら合格
3. 時刻関数を進めてから `collectGarbage()` を呼び、gcTime を超えたエントリ数と同じ値が返れば GC の判定が正しい

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: キャッシュの1エントリに何を持たせるかを先に決める。データ、最終更新時刻、最終利用時刻、stale フラグ、進行中の Promise の5つが揃えば、残りは分岐を書くだけになる
2. 構造: `Map<string, Entry>` と、キーを安定文字列へ落とす `stableSerialize` を用意する。fetch は「進行中があれば返す」「新鮮なら返す」「それ以外は取得する」の3分岐にする
3. 実装の要点: in-flight の Promise は成功時も失敗時も必ず `entry.inFlight = undefined` へ戻す。then の第2引数 (またはエラー経路) でこれを忘れると、1度失敗したキーが永久に再取得できなくなる

**本番利用時の警告**

- このキャッシュは購読者数に基づく参照カウントを持たず、`collectGarbage` を呼ぶまでメモリを保持し続ける。長時間稼働する画面にそのまま載せるとヒープが増え続ける
- レスポンスをキー単位でそのまま保持するため、ユーザー固有データを共通キーでキャッシュするとログアウト後や別ユーザーへ内容が漏れる。本番ではキーに認証主体を含め、ログアウト時に全消去する

**導線**

- 開始地点: `query-cache.ts`
- 模範解答: `query-cache.solution.ts`

### 7.3 課題7.3: 楽観的更新の実装 (★★)

**目的**: 「サーバの応答を待たずに UI を更新し、失敗時にロールバック」のパターンを実装する。

**難易度**: ★★

**推定時間**: 90分 (確定状態と未確定列の分離設計に25分、mutate と recompute の実装に35分、失敗モックでの連続操作検証と通知に30分)

**必要サービス**: なし

**前提**

- 7.6 楽観的更新 (Optimistic Update) を読み、確定状態と未確定操作を分けて持つ理由を説明できる状態にする
- 7.4 サーバ状態の特殊性 を読み、サーバが正本であることとロールバックの位置づけを確認しておく
- `pnpm --filter @handbook/ch07 run test` が実行できる状態にしておく

**完成条件 (自己採点用チェックリスト)**

- [ ] `code/ch07/optimistic/starter/optimistic-update.ts` に `OptimisticStore` を実装し、確定状態と未確定操作列を別々に保持する
- [ ] `mutate(update, send)` が送信完了を待たずに `getState()` の値を更新する
- [ ] 送信が失敗したとき、その操作だけを未確定列から除いて再計算し、成功済みの他操作の結果を巻き戻さない
- [ ] `mutate` の戻り値が成功時 `{ ok: true }`、失敗時 `{ ok: false, error }` になる
- [ ] `onError` で登録したリスナーが失敗時に呼ばれ、トーストなどの通知に使える
- [ ] 30% の確率で失敗するモックを使い、連続操作後も確定状態と表示が矛盾しない

**期待出力**

- テスト `OptimisticStore rolls back only failed operation` が pass する
- +1 と +10 の2操作を同時に走らせた直後、`getState().count` が 11 になる
- +10 が成功し +1 が失敗したあと、`getState().count` が 10 に落ち着く
- 失敗した `mutate` の戻り値が `{ ok: false }` で、`error.message` にサーバ拒否の理由が入る

**観察項目**

- `getPendingCount()` を操作の前後でログし、送信中は増え、成功でも失敗でも減ることを確認する
- 確定状態ではなく表示用の状態を直接書き換える実装へ変え、失敗が2件重なったときに値がずれることを再現する
- 失敗と成功が入れ替わる順序 (先に出した操作が後で失敗する) を作り、後続操作の結果が保たれることを確認する
- `subscribe` の通知回数を数え、1回の mutate で楽観適用と確定反映の2回通知が飛ぶことを確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch07 run test` を実行し、OptimisticStore のテストが pass すれば合格
2. `pnpm --filter @handbook/ch07 run typecheck` を実行し、`Updater<T>` と `MutationResult` の型でエラー0件なら合格
3. `flakyServer(1)` のように必ず失敗するモックで mutate を呼び、`getState()` が呼び出し前の値へ完全に戻れば合格
4. `flakyServer(0.3)` で20回連続操作し、`onError` の発火回数と最終状態の差分が一致すれば整合性が保たれている

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 巻き戻しを「逆操作」で実装しない。確定状態を1つ持ち、未確定の更新関数を配列で持って、毎回先頭から畳み込んで表示用の状態を作る方式にすると失敗時の処理が削除だけで済む
2. 構造: 各操作に連番 id を振り、`pending: { id, update }[]` として保持する。成功時は確定状態へ update を適用してから配列から除去、失敗時は適用せず除去し、どちらの場合も `recompute()` で表示状態を作り直す
3. 実装の要点: 失敗した操作を配列から除く前に確定状態を書き換えないこと。順序を誤ると、後から成功した操作の結果が失敗操作の巻き戻しに巻き込まれて消える

**本番利用時の警告**

- 楽観的更新はユーザーに「成功した」という誤った印象を与える。決済、在庫引き当て、権限変更のように取り消しが利かない操作へ適用すると、ロールバックしても業務上の不整合が残る
- この実装はリトライ、順序保証、オフライン時のキュー永続化を持たない。タブを閉じると未確定操作は消えるため、本番では冪等キー付きの再送とサーバ側の整合性チェックが必要になる

**導線**

- 開始地点: `optimistic/starter/README.md`、`optimistic/starter/optimistic-update.ts`
- 模範解答: `optimistic/solution/README.md`、`optimistic/solution/optimistic-update.ts`

### 7.4 課題7.4: フォームの reactive validation (★★)

**目的**: Zod ベースのフォーム検証を実装する。React Hook Form の核を理解する。

**難易度**: ★★

**推定時間**: 90分 (状態設計と setValue/touchField の実装に30分、submit と reset、購読通知に35分、模範解答との挙動突き合わせに25分)

**必要サービス**: なし

**前提**

- 7.7 リアクティブな状態とフォーム を読み、入力中の値と送信済み状態を分ける理由を把握しておく
- zod のスキーマ定義と `safeParse` の戻り値 (`success` と `error.issues`) を読める
- `code/ch07/form-validation.ts` の TODO コメントに目を通し、実装すべきメソッドを把握する
- `pnpm --filter @handbook/ch07 run typecheck` が実行できる状態にしておく

**完成条件 (自己採点用チェックリスト)**

- [ ] `code/ch07/form-validation.ts` の `FormController` に `setValue` / `touchField` / `submit` / `reset` / `validateField` / `validateAll` を実装する
- [ ] `touchField`(blur 相当) を呼んだフィールドだけにエラーが表示され、未 touch のフィールドにはエラーが出ない
- [ ] `submit` が全フィールドを touched にしてから全体検証し、`isValid` が false のときは `onSubmit` を呼ばない
- [ ] `submit` 中は `isSubmitting` が true になり、`onSubmit` の完了後 (例外時も含め) に false へ戻る
- [ ] `subscribe` したリスナーが値の変更・touch・送信状態の変化ごとに呼ばれる
- [ ] `reset()` で values が initialValues に戻り、errors と touched が空になる

**期待出力**

- `email` に `invalid` を入れて touch すると `errors.email` に `有効なメールアドレスを入力` が入る
- `password` を `ValidPass8`、`age` を 25、`email` を正しい形式にすると `getState().isValid` が true になる
- `age` に 17 を入れて touch すると `18歳以上` のメッセージが `errors.age` へ入る
- 全項目が妥当な状態で `submit()` すると `onSubmit` が1回だけ呼ばれ、渡される値が `z.infer` された型として補完される

**観察項目**

- `safeParse` の `error.issues` を丸ごと出力し、`path[0]` でフィールドを特定する仕組みと、同一フィールドに複数 issue が並ぶ場合の先頭採用を確認する
- 未 touch のフィールドにもエラーを出す実装へ一時的に変え、入力開始直後から赤字が並ぶ体験の悪さを確認する
- `isValid` の計算だけ全体検証で行い、表示エラーは touched のみに限定する二重構造になっていることを `getState()` で確認する
- `onSubmit` が例外を投げるケースを作り、`isSubmitting` が finally で false に戻ることを確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch07 exec tsx form-validation.solution.ts` を実行し、模範解答が Test 1 から Test 3 までの状態遷移ログを出すことを先に確認する
2. `pnpm --filter @handbook/ch07 run typecheck` を実行し、`FormController<FormData>` の型推論でエラー0件なら合格
3. 自作実装へ同じ操作列 (不正な email を入れて touch、修正、password と age を入力、submit) を流し、模範解答と同じ errors と isValid の推移になれば合格
4. この課題は `code/ch07/solutions.test.ts` の対象外なので、typecheck と実行ログの一致で判定する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 検証の単位を先に決める。zod はオブジェクト全体を1回で検証するので、フィールド単位のエラーは「全体検証の結果から該当 path の issue を抜き出す」形にすると実装が1本化できる
2. 構造: 内部状態は `values`、`errors`、`touched: Set<keyof T>`、`isSubmitting`、`isValid` の5つ。`validateField` は `schema.safeParse(values)` の `issues` から `issue.path[0] === field` の先頭を取り、無ければ該当エラーを delete する
3. 実装の要点: `isValid` は touched に関係なく常に全体検証の結果で更新する。表示するエラーだけを touched で絞る。ここを一緒くたにすると、未入力のまま送信ボタンが活性化する不具合になる

**本番利用時の警告**

- クライアント側の検証は UX のためのものでセキュリティ境界ではない。同じスキーマをサーバ側でも実行しないと、DevTools から直接 API を叩かれた時点で不正な値が保存される
- `errors` にサーバ由来のメッセージをそのまま流し込む実装へ拡張すると、DB エラー文などの内部情報が画面に露出する。表示するメッセージは必ず自前の辞書へマップする

**導線**

- 開始地点: `form-validation.ts`
- 模範解答: `form-validation.solution.ts`

## 評価方法

1. starterから開始し、本文の要件と課題詳細の完成条件を満たす。
2. 期待出力・観察項目を記録する。
3. 完成条件のチェックリストで自己採点し、未達項目を残す。
4. solutionとの差分を説明する。
5. `pnpm --filter @handbook/ch07 run test` を実行する。

## 安全上の注意

- 脆弱性・ネットワーク・OS・コンテナの演習は、localhostまたは隔離環境だけで実行してください。
- 教材用の簡略実装をそのまま本番へ投入しないでください。
- 各課題の「本番利用時の警告」を読まずに、演習コードを製品コードへ流用しないでください。

## 配布対象外

`node_modules/`、`dist/`、`coverage/`、一時DB、秘密情報、計測生成物は配布対象外です。
