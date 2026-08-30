# 第25章 テスト戦略 — コード教材

## 前提環境

- Node.js 24.18.0 LTS
- pnpm 11.15.1
- TypeScript 6.0.3

## 共通コマンド

```bash
pnpm install
pnpm --filter @handbook/ch25 run lint
pnpm --filter @handbook/ch25 run typecheck
pnpm --filter @handbook/ch25 run test
pnpm --filter @handbook/ch25 run build
```

> `solution` は要件一覧ではなく、実行・観察できる模範実装でなければなりません。`referenceArtifact` や `model answer scaffold` は検証エラーになります。

## 課題一覧

| 課題 | 開始地点 | 模範解答 | 難易度 | 推定時間 | 必要サービス |
|---|---|---|---:|---:|---|
| 25.1 課題25.1: ミニテストランナー自作 (★★) | `mini-test.ts` | `mini-test.solution.ts` | ★★ | 90分 | なし |
| 25.2 課題25.2: Mock / Stub / Spy 実装 (★★) | `mock-stub-spy.ts` | `mock-stub-spy.solution.ts` | ★★ | 90分 | なし |
| 25.3 課題25.3: Property-Based Testing フレームワーク (★★★) | `property-test.ts` | `property-test.solution.ts` | ★★★ | 150分 | なし |
| 25.4 課題25.4: Mutation Testing ツール (★★★) | `mutation-test.ts` | `mutation-test.solution.ts` | ★★★ | 150分 | なし |

## 課題詳細

### 25.1 課題25.1: ミニテストランナー自作 (★★)

**目的**: jest / vitest 風の基本機能 (describe、it、expect) を実装。

**難易度**: ★★

**推定時間**: 90分 (describe と it の登録機構の実装25分、expect のマッチャ4種の実装30分、run の出力と終了コード15分、実行順序と例外隔離の観察20分)

**必要サービス**: なし

**前提**

- 25.2 Unit テスト を読み、テストの構造 (配置・実行・検証) を説明できる
- 25.1 テストピラミッド vs テストトロフィー を読み、この演習が対象とする層を確認する
- node:util の isDeepStrictEqual による深い等価比較を知っている
- async 関数を順番に await するループを書ける

**完成条件 (自己採点用チェックリスト)**

- [ ] describe() のネストで名前が親から子へ連結され、it() の登録名が階層を含む文字列になる
- [ ] expect(x).toBe(y) が Object.is による同一性で判定し、不一致時に期待値と実値を含むメッセージで throw する
- [ ] expect(fn).toThrow() が例外を投げない関数に対して失敗する
- [ ] toEqual() が深い等価比較で配列やオブジェクトの中身を比較する
- [ ] run() が {passed, failed} を返し、成功に ✓、失敗に ✗ を付けて1行ずつ出力する
- [ ] failed が0でないとき process.exitCode が非ゼロになる

**期待出力**

- 1件成功1件失敗のスイートで run() が {passed:1, failed:1} を返す
- コンソールに ✓ Math > adds two numbers と ✗ Math > throws ... : メッセージ の形式で1テスト1行が出る
- reset() の後は登録済みテストが0件になり、run() が {passed:0, failed:0} を返す

**観察項目**

- describe のコールバックが登録時に即座に実行され、it のコールバックは run() まで実行されないという2段階を、console.log を両方に入れて実行順で確認する
- テスト内で throw された Error の message がそのまま結果表示に使われることを確認し、アサーション関数が「失敗の説明を作る役」でもあることを読み取る
- 1件が失敗しても後続が実行されることを確認し、テストランナーが例外を隔離している境界を特定する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch25 exec tsx --test --test-name-pattern="mini test runner" solutions.test.ts` を実行し、passすれば合格
2. `pnpm --filter @handbook/ch25 run test` で章の4件がすべてpassすることを確認する
3. 自作ランナーで失敗テストを含むファイルを実行し、`echo $?` が0以外を返せば終了コードの要件を満たしていると判定する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: テストの「登録」と「実行」を分ける。describe と it は配列へ積むだけ、run が積まれたものを順に呼ぶ、という2フェーズ構成が全体の骨格になる
2. 構造: モジュールスコープの tests 配列と suite 名スタックを持ち、describe は名前を push してコールバックを呼び、finally で pop する。expect は actual を閉じ込めたオブジェクトを返し、toBe / toEqual / toThrow / toBeTruthy をメソッドとして生やす
3. 実装の要点: describe のコールバックが throw したときに suite スタックが壊れないよう、pop は必ず finally で行う。it が async の場合に備え、run のループでは await test.fn() として同期・非同期の両方を受ける

**本番利用時の警告**

- このランナーはテストを1件ずつ直列実行し、ファイル単位の分離もタイムアウトも持たない。無限ループや解決しない Promise を含むテストが1件あると全体が永久に終わらず、CIのジョブを占有する
- モジュールスコープの配列に登録する設計のため、複数のテストファイルを同一プロセスで読み込むと状態が混ざる。reset() を呼び忘れた並行実行では結果が非決定的になる
- 本番のプロジェクトでは、並行実行、ウォッチモード、カバレッジ計測、スナップショット、flaky 検出、レポータ連携を備えた vitest や node:test を使う。自作ランナーは仕組みの理解用であり、これらの欠落がテスト運用の失敗として跳ね返る

**導線**

- 開始地点: `mini-test.ts`
- 模範解答: `mini-test.solution.ts`

### 25.2 課題25.2: Mock / Stub / Spy 実装 (★★)

**目的**: jest.fn() / sinon.stub() 風の機能。

**難易度**: ★★

**推定時間**: 90分 (mock の記録と戻り値制御の実装30分、stub の Proxy 実装15分、spyOn と restore の実装25分、テスト間汚染の再現と確認20分)

**必要サービス**: なし

**前提**

- 25.6 Mock と Stub と Fake を読み、3者の目的の違いを言い分けられる
- TypeScript のジェネリクスと Parameters / ReturnType 型を使える
- Object.defineProperties と Proxy の基本的な使い方を知っている
- code/ch25 で `pnpm --filter @handbook/ch25 run test` が実行できる

**完成条件 (自己採点用チェックリスト)**

- [ ] mock() が返す関数を呼ぶと calls に引数配列が追加され、callCount が呼び出し回数と一致する
- [ ] mockReturnValueOnce を2回連ねた後に mockReturnValue を設定すると、1回目と2回目だけ once の値、3回目以降はデフォルト値が返る
- [ ] mockImplementation で渡した関数が引数を受け取って実行される
- [ ] reset() で calls と once と実装とデフォルト値がすべて初期化される
- [ ] stub() が未定義のメソッドへアクセスしたときに No stub implementation for という例外を投げる
- [ ] spyOn(obj, 'method') が元の実装を呼びつつ callCount を数え、restore() で元のメソッドに戻る

**期待出力**

- fn(2) と fn(3) を呼んだあと calls が [[2],[3]] という二重配列になる
- mockReturnValueOnce(1) の後に mockReturnValue(0) を設定した mock は 1, 0, 0, 0 の順に返す
- spyOn した後に restore() すると、対象オブジェクトのメソッドが元の関数と同一参照に戻る

**観察項目**

- calls を getter として公開した場合と配列を直接代入した場合で、テスト側が参照するタイミングによって見える内容が変わるかを確認する
- spyOn が元の実装を bind してから差し替えていることを確認し、bind を外すと this が失われるケースを再現する
- stub がアクセス時に例外を投げる設計と、undefined を返す設計を比べ、テストの失敗メッセージがどちらで分かりやすくなるかを記録する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch25 exec tsx --test --test-name-pattern="mock/stub/spy" solutions.test.ts` を実行し、passすれば合格
2. `pnpm --filter @handbook/ch25 run test` で章の4件がすべてpassすることを確認する
3. 自作実装で spyOn したあと restore() を呼び、元のメソッドの戻り値が復元されていれば後始末が正しいと判定する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 3つの機能は「呼び出しの記録」「戻り値の差し替え」「既存オブジェクトへの差し込み」に分解できる。まず記録だけの関数を作り、そこへ差し替えの層を重ねる
2. 構造: mock はクロージャに calls 配列と once キューと implementation と fallback を持ち、呼び出し時に once.shift() を優先する。calls と callCount は Object.defineProperties の getter で公開し、mockReturnValue 系は自身を返してチェーン可能にする
3. 実装の要点: spyOn は元のメソッドを保存し、mock().mockImplementation(original.bind(target)) を代入する。restore() で元の参照を戻すが、callCount を実値で公開すると差し替え後の更新が反映されないので getter にする

**本番利用時の警告**

- spyOn は対象オブジェクトのプロパティを書き換えるため、restore() を呼ばずにテストが終わると以降のテストへ汚染が残る。afterEach での復元を仕組みとして持たないこの実装は、テスト間の独立性を保証しない
- stub は Proxy で未実装メソッドを例外にするだけで、型と実サービスの契約が一致している保証はない。実装側のシグネチャが変わってもテストは通り続けるため、契約テストや型レベルの検証を併用しないと「テストは緑だが本番が壊れる」状態になる
- 呼び出し記録は引数の参照をそのまま保持するので、呼び出し後に引数オブジェクトを変更すると過去の記録も変わる。可変オブジェクトを渡すコードのアサーションでは、この参照共有が誤った合格判定を生む

**導線**

- 開始地点: `mock-stub-spy.ts`
- 模範解答: `mock-stub-spy.solution.ts`

### 25.3 課題25.3: Property-Based Testing フレームワーク (★★★)

**目的**: fast-check / Hypothesis 風のフレームワークを実装。

**難易度**: ★★★

**推定時間**: 150分 (Arbitrary インタフェースと4種のジェネレータ実装45分、シード付き乱数と forAll ループの実装30分、shrink の実装40分、反例の縮小効果の比較と記録35分)

**必要サービス**: なし

**前提**

- 25.7 Property-Based Testing を読み、例示ベースとの違いと不変条件の立て方を説明できる
- ジェネレータ関数 (function*) と Iterable を扱える
- 線形合同法などで再現可能な擬似乱数を実装できる
- TypeScript の条件型で record のシェイプから値の型を導出する書き方に触れたことがある

**完成条件 (自己採点用チェックリスト)**

- [ ] Arbitrary が sample(random) と shrink(value) の2メソッドを持つ共通の形になっている
- [ ] integer と string と array と record の4種のジェネレータが用意され、それぞれ範囲や長さの上限を引数で指定できる
- [ ] forAll がデフォルトで1000ケースを生成し、seed を指定すると同じ反例が再現する
- [ ] 性質が偽になったとき Property failed after N cases; counterexample= を含むメッセージで例外を投げる
- [ ] shrink により反例が縮小され、array(integer()) で長さ2未満を主張したときの反例が最小規模になる
- [ ] 性質が全ケースで成立した場合は例外を投げず、実行ケース数を返す

**期待出力**

- 成功時の戻り値が {cases: 実行件数} というオブジェクトになる
- 失敗時の例外メッセージに、何ケース目で失敗したかと、shrink 後の反例のJSON表現が含まれる
- 同じ seed と同じ性質なら、実行のたびに同一の反例が得られる

**観察項目**

- seed を固定した場合と変えた場合で反例が変わるかを比較し、再現性が乱数源の制御によって成り立っていることを確認する
- shrink を無効化した場合の反例 (大きな配列や大きな整数) と、有効時の反例を並べ、デバッグしやすさの差を記録する
- record の shrink が空実装であることを確認し、複合値の縮小が単純な合成にならない理由を考える

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch25 exec tsx --test --test-name-pattern="property testing" solutions.test.ts` を実行し、passすれば合格
2. `pnpm --filter @handbook/ch25 run test` で章の4件がすべてpassすることを確認する
3. 自作実装で forAll(array(integer(0,10)), xs => xs.length < 2, {cases:100}) を実行し、counterexample を含む例外が投げられれば反例検出が働いていると判定する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 「値を作る」と「値を縮める」を1つのインタフェースにまとめるのが設計の核。まず integer だけで sample と shrink を作り、forAll のループを通してから他の型へ広げる
2. 構造: Arbitrary<T> を sample: (random) => T と shrink: (value) => Iterable<T> の2メソッドで定義する。乱数は seededRandom で線形合同法を実装して注入し、forAll は失敗時に shrink の候補を順に試して、まだ失敗する最小の候補を保持する
3. 実装の要点: shrink はジェネレータで「より単純な候補」を降順に yield する。整数なら 0 へ向けて半分ずつ、配列なら空配列と前半のスライス。縮小候補が元と同じ値を返すと無限ループになるため、必ず単調に小さくなる系列にする

**本番利用時の警告**

- この実装は shrink を1パスの貪欲探索でしか行わず、record の shrink は空である。複合構造の反例は縮まらないため、実務では fast-check のような多段の縮小と統合的な生成器を持つライブラリを使う
- 線形合同法の擬似乱数は分布の質が低く、探索が特定の値域に偏る。1000ケース通ったことは性質の証明ではなく、この生成器が到達できた範囲に反例がなかったという弱い証拠にすぎない
- forAll は失敗を例外として投げるだけで、失敗時の seed をメッセージに含めない。CIで見つかった反例をローカルで再現する手段がないと、property テストは flaky なテストとして無効化される運命をたどるため、本番運用では seed の記録と再実行の仕組みが必須になる

**導線**

- 開始地点: `property-test.ts`
- 模範解答: `property-test.solution.ts`

### 25.4 課題25.4: Mutation Testing ツール (★★★)

**目的**: コードに意図的に変異 (mutation) を加え、テストがそれを検出できるか測る。低検出率 → テストが甘い。

**難易度**: ★★★

**推定時間**: 150分 (変異オペレータの定義と生成の実装40分、スコア集計の実装25分、弱いテストを用意してカバレッジとの差を比較45分、生存変異の読み取りと記録40分)

**必要サービス**: なし

**前提**

- 25.8 Mutation Testing を読み、カバレッジ率と mutation score が測る対象の違いを説明できる
- 25.10 何をテストすべきか を読み、生存した変異が示す意味を解釈できる
- 正規表現の matchAll でマッチ位置 (index) を取り出せる
- 非同期の判定関数を await しながらループで回せる

**完成条件 (自己採点用チェックリスト)**

- [ ] generateMutations() が true と false の反転、>= から >、<= から <、=== から !==、&& から二重パイプ、二重パイプから && の変異を生成する
- [ ] 同じ演算子が複数箇所に現れる場合、出現ごとに別々の変異が1件ずつ作られる
- [ ] 各変異が description と source の2キーを持ち、source が元コードの当該1箇所だけを置換した文字列になる
- [ ] mutationScore() が total と killed と survived と score を返す
- [ ] 変異が0件のとき score が1になる
- [ ] テストで検出できなかった変異が survived 配列に description 付きで残る

**期待出力**

- 'if (a >= b && true) return 1' に対して3件以上の変異が生成される
- mutationScore の戻り値が {total, killed, survived, score} の4キーを持ち、score が killed/total の小数になる
- 生存した変異は description (例: >=→>) で、どの演算子がどう置き換わったかが読める

**観察項目**

- 全行を実行するがアサーションが弱いテストを用意し、カバレッジ100%でも mutation score が低くなることを実際の数値で確認する
- 生存した変異のコード片を読み、その分岐条件を検証しているアサーションが本当に存在しないことを確かめる
- 境界値 (>= と >) の変異が生存する場合、テストデータに境界そのものの値が含まれていないことを確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch25 exec tsx --test --test-name-pattern="mutation generator" solutions.test.ts` を実行し、passすれば合格
2. `pnpm --filter @handbook/ch25 run test` で章の4件がすべてpassすることを確認する
3. 自作実装で 'return x === 1' に対して mutationScore を取り、total が1、survived が1件になる判定関数を渡せば集計が正しいと判定する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 変異の「生成」と「殺せたかの判定」を分離する。生成は純関数にでき、判定はテスト実行という副作用を伴うので、判定を関数として外から注入する形にする
2. 構造: 演算子ごとに 正規表現・置換文字列・説明 の3つ組を配列で持ち、matchAll で全出現位置を取り、slice で前後を挟んで1箇所だけ置換した文字列を作る。mutationScore は各変異を survives 関数へ渡し、true が返ったものを survived に積む
3. 実装の要点: matchAll のグローバル正規表現は lastIndex を共有するため、同じ正規表現オブジェクトを使い回すループでは取りこぼしが起きる。また二重パイプと && の相互変換は、両方を適用すると元に戻る「等価変異」を生むので、置換は必ず1箇所ずつ行う

**本番利用時の警告**

- この実装は AST ではなく正規表現でソース文字列を書き換えるため、文字列リテラルやコメントの中の記号まで変異させる。本文が求める AST パースによる変異とは精度が異なり、実コードに適用すると構文エラーの変異 (そもそも殺されて当然のもの) で score が水増しされる
- 変異ごとにテスト全体を再実行する設計は、変異数 × テスト時間だけかかる。中規模のプロジェクトでそのままCIに載せると数時間規模になるため、本番では Stryker のように差分実行・並列化・タイムアウト付きの実装を使う
- mutation score は目標値にすると簡単に歪む指標である。等価変異 (意味が変わらない変異) は原理的に殺せず、100%を目指すと無意味なアサーションを追加する動機になる。低い score を「テストが弱い箇所の発見器」として使うにとどめる

**導線**

- 開始地点: `mutation-test.ts`
- 模範解答: `mutation-test.solution.ts`

## 評価方法

1. starterから開始し、本文の要件と課題詳細の完成条件を満たす。
2. 期待出力・観察項目を記録する。
3. 完成条件のチェックリストで自己採点し、未達項目を残す。
4. solutionとの差分を説明する。
5. `pnpm --filter @handbook/ch25 run test` を実行する。

## 安全上の注意

- 脆弱性・ネットワーク・OS・コンテナの演習は、localhostまたは隔離環境だけで実行してください。
- 教材用の簡略実装をそのまま本番へ投入しないでください。
- 各課題の「本番利用時の警告」を読まずに、演習コードを製品コードへ流用しないでください。

## 配布対象外

`node_modules/`、`dist/`、`coverage/`、一時DB、秘密情報、計測生成物は配布対象外です。
