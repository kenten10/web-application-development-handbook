# 第5章 JavaScriptとTypeScriptの中核機構 — コード教材

## 前提環境

- Node.js 24.18.0 LTS
- pnpm 11.15.1
- TypeScript 6.0.3

## 共通コマンド

```bash
pnpm install
pnpm --filter @handbook/ch05 run lint
pnpm --filter @handbook/ch05 run typecheck
pnpm --filter @handbook/ch05 run test
pnpm --filter @handbook/ch05 run build
```

> `solution` は要件一覧ではなく、実行・観察できる模範実装でなければなりません。`referenceArtifact` や `model answer scaffold` は検証エラーになります。

## 課題一覧

| 課題 | 開始地点 | 模範解答 | 難易度 | 推定時間 | 必要サービス |
|---|---|---|---:|---:|---|
| 5.1 課題5.1: Promise を自作する (★★★) | `my-promise.ts` | `my-promise.solution.ts` | ★★★ | 150分 | なし |
| 5.2 課題5.2: Generator から async/await を再発明 (★★★) | `run-async.ts` | `run-async.solution.ts` | ★★★ | 150分 | なし |
| 5.3 課題5.3: TypeScript 型レベルプログラミング (★★★) | `type-gymnastics.ts` | `type-gymnastics.solution.ts` | ★★★ | 150分 | なし |
| 5.4 課題5.4: イベントエミッタを型安全に (★★) | `typed-emitter.ts` | `typed-emitter.solution.ts` | ★★ | 90分 | なし |
| 5.5 課題5.5: Intl API で実用的な国際化ユーティリティ (★★) | `i18n-utils.ts` | `i18n-utils.solution.ts` | ★★ | 90分 | なし |

## 課題詳細

### 5.1 課題5.1: Promise を自作する (★★★)

**目的**: Promise が「単なる値」ではなく「状態を持つステートマシン」であることを内部から理解する。

**難易度**: ★★★

**推定時間**: 150分 (状態遷移と then/catch/finally の実装に50分、静的メソッド5種の追加に50分、マイクロタスク順序の検証とテスト追記に50分)

**必要サービス**: なし

**前提**

- 5.5 自作 Promise の実装 を読み、pending/fulfilled/rejected の状態遷移とハンドラ登録の流れを追っておく
- 5.4 非同期処理の進化 を読み、同期コード・マイクロタスク・タイマの実行順を予測できる状態にしておく
- `pnpm install` 済みで `pnpm --filter @handbook/ch05 run test` が現状で完走することを確認しておく
- TypeScript のジェネリッククラスと private フィールドを読み書きできる

**完成条件 (自己採点用チェックリスト)**

- [ ] `code/ch05/my-promise.ts` に `MyPromise` クラスを実装し、`then` / `catch` / `finally` がいずれも新しい `MyPromise` を返す
- [ ] 静的メソッド `resolve` / `reject` / `all` / `allSettled` / `race` の5つが実装され、`all` は入力と同じ順序の配列で解決する
- [ ] 解決済みインスタンスに後から登録した `.then` も同期実行されず、`queueMicrotask` 経由で1ティック後に走る
- [ ] `then` を持つオブジェクト (thenable) を resolve へ渡すと同化され、自分自身を resolve すると TypeError で reject される
- [ ] `solutions.test.ts` の import を自分の実装へ向け替えた状態で `pnpm --filter @handbook/ch05 run test` が全件パスする

**期待出力**

- テスト `MyPromise chains and schedules handlers as microtasks` と `MyPromise combinators and finally work` の2件が pass と表示される
- 同期側の push を後から `unshift` した順序記録が `['sync', 'then']` になり、値は 42 になる
- `MyPromise.allSettled([1, MyPromise.reject('x')])` が2要素の配列を返し、2件目の `status` が `rejected` になる
- `await` に自作インスタンスを渡すとネイティブ側が `then` を呼び、`PromiseLike<T>` として解決値が取り出せる

**観察項目**

- resolve 済みの `MyPromise` に `.then` を登録した直後へ `console.log('sync')` を置き、ハンドラが必ず後に出ることを出力順で確認する
- `queueMicrotask` を `setTimeout(fn, 0)` に差し替えて再実行し、どのテストの順序アサーションが崩れるかを記録する
- `race` に即解決と5ms後解決の2つを渡し、遅い側が後から settle しても結果が上書きされないことを確認する
- 同じコードをネイティブ Promise で書き、拒否を放置したときのプロセス終了コードと警告表示の差を比べる

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch05 run test` を実行し、MyPromise 関連の2テストが fail 0 でパスすれば合格
2. `pnpm --filter @handbook/ch05 run typecheck` を実行し、`implements PromiseLike<T>` を満たしたままエラー0件なら合格
3. `solutions.test.ts` に自己 resolve が TypeError になるケースを1件追加し、再実行して新テストも通れば合格

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: まず「値」ではなく「状態」を持たせる。pending のあいだに来た `then` のコールバックを配列へ溜め、settle した瞬間にまとめて流す設計から始める
2. 構造: `state`、`value`、`reason`、`handlers` の4フィールドと、内部関数 `flush()` を用意する。`then` は新しい MyPromise を作り、その resolve/reject を handlers のエントリへ一緒に格納する
3. 実装の要点: resolve に渡された値が object または function なら `value.then` を取り出し、function なら `then.call(value, resolve, reject)` で同化する。ここを飛ばすと `all` にネイティブ Promise を混ぜたテストが落ちる

**本番利用時の警告**

- この MyPromise は未処理拒否の検知、`any` の AggregateError、サブクラス化 (Symbol.species) を持たない。本番コードでネイティブ Promise の代わりに使うと拒否が黙って消える
- handlers 配列に上限がなく、pending のまま大量に `then` を張るとメモリを解放できない。長寿命のイベント配線には使わない

**導線**

- 開始地点: `my-promise.ts`
- 模範解答: `my-promise.solution.ts`

### 5.2 課題5.2: Generator から async/await を再発明 (★★★)

**目的**: async/await が Generator のシンタックスシュガーであることを実装で確認する。

**難易度**: ★★★

**推定時間**: 150分 (next/value の往復ドライバ実装に40分、エラー経路と throw 対応に50分、async/await 版との挙動比較と観察記録に60分)

**必要サービス**: なし

**前提**

- 5.6 イテレータとジェネレータ を読み、`next()` が返す `{ value, done }` と `throw()` の動作を把握しておく
- 5.4 非同期処理の進化 を読み、async 関数が Promise を返すことと await の一時停止を説明できる状態にする
- `pnpm --filter @handbook/ch05 run test` が実行できる環境を用意する

**完成条件 (自己採点用チェックリスト)**

- [ ] `code/ch05/run-async.ts` に `runAsync(generator)` を実装し、戻り値が Promise になる
- [ ] yield された値が Promise のときは解決値を、Promise 以外のときはその値をそのまま `next(value)` へ渡す
- [ ] yield した Promise が reject したとき `generator.throw(error)` を呼び、ジェネレータ内の try/catch で捕捉できる
- [ ] ジェネレータ内で捕捉されなかったエラーは `runAsync` の戻り Promise の reject として外へ伝わる
- [ ] `done: true` になった時点で `value` を解決値として返し、以降 `next` を呼ばない

**期待出力**

- テスト `runAsync propagates resolved values and errors` が pass する
- `yield Promise.resolve(20)` と `yield Promise.resolve(22)` を持つジェネレータの実行結果が 42 になる
- `yield Promise.reject(new Error('boom'))` を含むジェネレータでは、戻り Promise が `/boom/` にマッチするエラーで reject する
- 同じ処理を async/await で書き直した版と、出力される値と実行順が完全に一致する

**観察項目**

- `next()` の呼び出しごとに `console.log(value, done)` を仕込み、yield 1回につき next が1回進むことを確認する
- yield に非 Promise の値 (数値やオブジェクト) を渡し、そのまま次の next へ流れることを確認する
- ジェネレータ内を try/catch で囲み、`generator.throw` 経由の例外が catch 節へ入って処理が続くことを確認する
- 2つの独立した fetch を順に yield した場合の総所要時間を計り、逐次実行であって並行実行ではないことを確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch05 run test` を実行し、runAsync のテストが pass すれば合格
2. `pnpm --filter @handbook/ch05 run typecheck` でエラー0件なら、`Generator<Yieldable<unknown>, T, unknown>` のシグネチャが成立している
3. 自作ジェネレータで `try { yield Promise.reject(new Error('x')) } catch (e) { return 'caught' }` を書き、戻り値が `'caught'` になれば throw 経路の実装が正しい

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: ドライバは再帰的なループになる。`next()` の結果を見て、done なら resolve、そうでなければ value を待ってから自分自身をもう一度呼ぶ、という一段階だけを先に書く
2. 構造: 内部関数 `step(input)` と `fail(error)` の2本に分け、`Promise.resolve(value).then(step, fail)` で次の一歩をつなぐ。`fail` の中では `generator.throw(error)` の結果を再び同じ経路へ流す
3. 実装の要点: `generator.throw()` 自体が例外を投げる場合 (ジェネレータ側で捕捉されなかった場合) がある。ここを try/catch で包んで外側 Promise の reject に変換しないと、未処理拒否になる

**本番利用時の警告**

- このドライバは逐次実行専用で、キャンセルもタイムアウトも持たない。解決しない Promise を yield するとジェネレータが永久に停止し、参照が残ったままリークする
- 実務では async/await を使う。トランスパイル済みコードの挙動確認や学習目的以外で自作ドライバを運用コードへ入れると、スタックトレースが読めなくなる

**導線**

- 開始地点: `run-async.ts`
- 模範解答: `run-async.solution.ts`

### 5.3 課題5.3: TypeScript 型レベルプログラミング (★★★)

**目的**: TypeScript の型システムが「コンパイル時のプログラミング言語」として動くことを体感する。

**難易度**: ★★★

**推定時間**: 150分 (Length/Head/Tail/Concat の実装に30分、Reverse と DeepReadonly の再帰化に40分、PathOf と CamelCase に50分、アサーション追加と再帰深度の観察に30分)

**必要サービス**: なし

**前提**

- 5.7 TypeScript ― 型システムの設計思想 を読み、条件型・`infer`・テンプレートリテラル型の書き方を把握しておく
- タプル型とスプレッド構文 (`[infer H, ...infer R]`) の読み方を理解している
- `pnpm --filter @handbook/ch05 run typecheck` が実行できる状態にしておく

**完成条件 (自己採点用チェックリスト)**

- [ ] `code/ch05/type-gymnastics.ts` に `Length` / `Head` / `Tail` / `Reverse` / `Concat` / `DeepReadonly` / `PathOf` / `CamelCase` の8つを型定義だけで書く
- [ ] 8つの型に実行時コード (関数・変数) を一切追加していない
- [ ] `Equal<A, B>` と `Assert<T extends true>` を自分でも定義し、各型に少なくとも1件ずつコンパイル時アサーションを置く
- [ ] `pnpm --filter @handbook/ch05 run typecheck` がエラー0件で完了する
- [ ] わざと誤った期待値 (例: `Assert<Equal<Length<[1,2,3]>, 4>>`) を書くと typecheck が失敗することを一度確認して元に戻す

**期待出力**

- `pnpm --filter @handbook/ch05 run typecheck` が何も出力せず終了コード0で終わる
- エディタのホバーで `CamelCase<"hello_world_foo">` が `"helloWorldFoo"` と展開表示される
- `PathOf<{ a: { b: { c: 1 } } }>` が `"a"`、`"a.b"`、`"a.b.c"` の3つからなるユニオンとして表示される
- `Reverse<[1, 2, 3]>` が `[3, 2, 1]` に、`Concat<[1, 2], [3, 4]>` が `[1, 2, 3, 4]` に展開される

**観察項目**

- `Reverse` をアキュムレータ引数なしの素朴な再帰で書き、要素数を増やしたときに `Type instantiation is excessively deep` が出る境界を確認する
- エディタのホバー表示で、型が途中で `...` に省略される長さを観察し、可読性のための named type の必要性を記録する
- `DeepReadonly` を配列や関数型へ適用し、意図せず関数のプロパティまで readonly 化されないかを確認する
- `PathOf` を optional プロパティを含む型へ適用し、`keyof` の抽出結果が変わることを確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch05 run typecheck` を実行し、エラー0件なら8つの型定義とアサーションが成立している
2. `Assert<Equal<CamelCase<"a_b_c">, "aBC">>` のように誤った期待値を1行足して typecheck を再実行し、エラーが1件出れば検証機構が機能している
3. この課題は `code/ch05/solutions.test.ts` の対象外なので、実行時テストではなく typecheck の結果で合否を判定する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 8つを難しい順にやらない。`Length` はタプルの `['length']` を読むだけ、`Head` と `Tail` は `infer` 1回で書ける。ここで条件型の型を掴んでから再帰型へ進む
2. 構造: `Reverse` は第2引数にアキュムレータ `Acc extends readonly unknown[] = []` を持たせた末尾再帰型にする。`CamelCase` は `S extends \`${infer H}_${infer T}\`` でスネークケースを分解し、`Capitalize<>` と組み合わせる
3. 実装の要点: `PathOf` はマップ型で各キーについて「そのキー自身」と「そのキー + ドット + 子のパス」を作りユニオン化する。子が object でないときに再帰を止めないと無限展開でコンパイルが止まる

**本番利用時の警告**

- 型レベルの保証はコンパイル時にしか働かない。API レスポンスやフォーム入力に `PathOf` や `DeepReadonly` を掛けても実行時の値は検証されないため、境界では zod などのランタイム検証を併用する
- 深い再帰型はコンパイル時間とエディタ補完の応答を悪化させる。共有ライブラリの公開型でこの手法を多用すると、利用側プロジェクト全体のビルドが遅くなる

**導線**

- 開始地点: `type-gymnastics.ts`
- 模範解答: `type-gymnastics.solution.ts`

### 5.4 課題5.4: イベントエミッタを型安全に (★★)

**目的**: TypeScript の Generics と Mapped Type を活用して、イベント名と引数の型が完全に一致するエミッタを作る。

**難易度**: ★★

**推定時間**: 90分 (Map と Set によるリスナー管理の実装に30分、on/off/once/emit の型付けに40分、故意の型エラー確認とテスト実行に20分)

**必要サービス**: なし

**前提**

- 5.7 TypeScript ― 型システムの設計思想 を読み、ジェネリクスとマップ型 (`Record<PropertyKey, unknown>` の制約) を扱えるようにする
- 5.3 関数 ― First-class Citizen を読み、コールバックをコレクションへ保持する書き方を把握しておく
- `pnpm --filter @handbook/ch05 run test` と `run typecheck` が実行できる状態にしておく

**完成条件 (自己採点用チェックリスト)**

- [ ] `code/ch05/typed-emitter.ts` に `TypedEmitter<Events extends Record<PropertyKey, unknown>>` を実装し、`on` / `off` / `once` / `emit` の4メソッドを持つ
- [ ] `on(name, listener)` が解除関数を返し、その関数を呼ぶと以後 emit されても呼ばれない
- [ ] `once` で登録したリスナーは1回目の emit だけで実行され、2回目以降は呼ばれない
- [ ] イベント名ごとに payload の型が推論され、`emitter.emit('user:login', { wrong: 'shape' })` と `emitter.emit('unknown:event', {})` がいずれも typecheck でエラーになる
- [ ] `solutions.test.ts` の import を自分の実装へ向けた状態で `pnpm --filter @handbook/ch05 run test` が全件パスする

**期待出力**

- テスト `TypedEmitter supports on/off/once` が pass する
- `on` と `once` を登録し `emit('tick', 2)`、`emit('tick', 3)`、解除、`emit('tick', 4)` と進めたとき、記録配列が `[2, 20, 3]` になる
- 誤ったイベント名で emit したときの typecheck エラーが、`Argument of type ...` としてイベント名リテラルを含む形で表示される
- 登録していないイベントへ emit しても例外にならず、何も起きずに戻る

**観察項目**

- リスナーの保持を配列から `Set` へ変えて、同じ関数を2回 on したときの呼び出し回数の違いを確認する
- emit の途中でリスナー内から `off` を呼び、反復中のコレクション変更が残りのリスナー実行へ与える影響を確認する
- リスナーが例外を投げた場合に emit の呼び出し元まで伝播し、後続リスナーが実行されないことを確認する
- `once` の実装を「ラッパ関数を登録して中で off する」形にしたとき、返す解除関数がラッパではなく元の関数でも効くかを確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch05 run test` を実行し、TypedEmitter のテストが pass すれば合格
2. `pnpm --filter @handbook/ch05 run typecheck` を実行し、エラー0件なら型付けは成立している
3. `emitter.emit('unknown:event', {})` を一時的に書いて typecheck を再実行し、エラーが出ることを確認してから削除する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 型より先に素の実装を通す。イベント名をキー、リスナーの集合を値とする Map を1つ持つところから始め、そのあとで型引数 `Events` を被せる
2. 構造: `Listener<T> = (payload: T) => void` を定義し、内部保持は `Map<keyof Events, Set<Listener<unknown>>>` にする。公開メソッドの引数は `K extends keyof Events` と `Events[K]` で結びつける
3. 実装の要点: `once` はラッパ関数を登録し、その中で本体を呼んだあと自分自身を off する。返す解除関数は本体ではなくラッパを外す必要があり、ここを間違えると once が解除できないリスナーとして残る

**本番利用時の警告**

- リスナーへの強参照を Set に保持し続けるため、コンポーネント破棄時に解除関数を呼ばないとクロージャごとリークする。React などでは必ず cleanup で off を呼ぶ
- リスナーの例外を捕捉していないため、1つのリスナーが throw すると emit 元まで伝播し、後続リスナーが実行されない。本番では Node の EventEmitter (captureRejections) や DOM の EventTarget を使う

**導線**

- 開始地点: `typed-emitter.ts`
- 模範解答: `typed-emitter.solution.ts`

### 5.5 課題5.5: Intl API で実用的な国際化ユーティリティ (★★)

**目的**: ライブラリに頼らず、ブラウザ標準の Intl API だけで多言語アプリの基本機能を作る。

**難易度**: ★★

**推定時間**: 90分 (6関数のラッパ実装に35分、plural のカテゴリ分岐と置換に25分、複数ロケールでの出力比較と ICU 確認に30分)

**必要サービス**: なし

**前提**

- 5.11 国際化 (i18n) ― 多言語対応の現実 を読み、ロケール識別子と CLDR の複数形カテゴリを把握しておく
- Node.js が full-icu 付き (`process.versions.icu` が表示される) であることを確認しておく
- `pnpm --filter @handbook/ch05 run test` が実行できる状態にしておく

**完成条件 (自己採点用チェックリスト)**

- [ ] `code/ch05/i18n-utils.ts` に `formatNumber` / `formatCurrency` / `formatDate` / `formatRelativeTime` / `plural` / `formatList` の6関数を実装する
- [ ] 6関数すべてが `Intl` のコンストラクタだけを使い、外部の i18n ライブラリへ依存していない
- [ ] `plural` が `Intl.PluralRules` の select 結果でメッセージを選び、`{n}` をロケール書式の数値へ置換する
- [ ] `plural` は value が 0 かつ `zero` メッセージが与えられたときだけ zero を選び、無ければ `other` へ落ちる
- [ ] `solutions.test.ts` の import を自分の実装へ向けた状態で `pnpm --filter @handbook/ch05 run test` が全件パスする

**期待出力**

- テスト `Intl helpers produce locale-aware values` が pass する
- `formatCurrency(1500, 'JPY', 'ja-JP')` の戻り値に `1,500` が含まれ、`formatCurrency(1500, 'USD', 'en-US')` は小数2桁の `$1,500.00` になる
- `plural(0, 'en-US', { zero: 'no apples', one: '1 apple', other: '{n} apples' })` が `no apples`、`plural(5, ...)` が `5 apples` を返す
- `formatList(['Apple', 'Banana', 'Cherry'], 'en-US', 'conjunction')` が `Apple, Banana, and Cherry`、`ja-JP` では読点区切りになる

**観察項目**

- `formatRelativeTime(-3, 'day', 'ja-JP')` と `formatRelativeTime(-1, 'day', 'ja-JP')` を比べ、`numeric: 'auto'` が「昨日」のような語へ切り替わる境界を確認する
- `formatCurrency` の出力を1文字ずつコードポイント表示し、通貨記号と数値の間に非分割スペースが入るロケールがあることを確認する
- `ru-RU` や `ar-EG` など one/few/many を持つロケールで `plural` を呼び、`en-US` の one/other とカテゴリ数が違うことを確認する
- `Intl.NumberFormat.supportedLocalesOf` の戻り値を見て、実行環境が実際に対応しているロケールを確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch05 run test` を実行し、Intl ヘルパのテストが pass すれば合格
2. `node -e "console.log(new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(1500))"` を実行し、期待どおりの通貨表記が出れば ICU データは十分
3. `node -p "Intl.PluralRules.prototype.resolvedOptions.call(new Intl.PluralRules('ru-RU')).pluralCategories"` で対象ロケールのカテゴリ一覧を出し、自作 `plural` の分岐が網羅しているか照合する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 6関数すべてが「対応する Intl コンストラクタを1つ選び、options を渡して format を呼ぶ」だけの薄いラッパになる。まず素直に1対1で対応付ける
2. 構造: `formatDate` は `dateStyle`、`formatRelativeTime` は `Intl.RelativeTimeFormat` の `numeric` オプション、`formatList` は `Intl.ListFormat` の `type` を使う。`plural` だけが `Intl.PluralRules` の select と自前のメッセージ選択の2段構えになる
3. 実装の要点: `plural` の `zero` は CLDR の正式カテゴリとして en-US には存在しない。value が 0 のときだけ明示的に `messages.zero` を優先し、そのうえで `{n}` を `Intl.NumberFormat` で整形した文字列へ置換する

**本番利用時の警告**

- Intl の出力文字列は ICU のバージョンで変わる。整形済み文字列に完全一致のスナップショットテストを掛けると、Node やブラウザの更新で本番前に落ちる。テストは部分一致か `formatToParts` で書く
- 表示用の丸めを金額計算へ流用しない。`Intl.NumberFormat` は表示桁で丸めるだけで、決済金額の計算には最小通貨単位の整数演算が必要になる

**導線**

- 開始地点: `i18n-utils.ts`
- 模範解答: `i18n-utils.solution.ts`

## 評価方法

1. starterから開始し、本文の要件と課題詳細の完成条件を満たす。
2. 期待出力・観察項目を記録する。
3. 完成条件のチェックリストで自己採点し、未達項目を残す。
4. solutionとの差分を説明する。
5. `pnpm --filter @handbook/ch05 run test` を実行する。

## 安全上の注意

- 脆弱性・ネットワーク・OS・コンテナの演習は、localhostまたは隔離環境だけで実行してください。
- 教材用の簡略実装をそのまま本番へ投入しないでください。
- 各課題の「本番利用時の警告」を読まずに、演習コードを製品コードへ流用しないでください。

## 配布対象外

`node_modules/`、`dist/`、`coverage/`、一時DB、秘密情報、計測生成物は配布対象外です。
