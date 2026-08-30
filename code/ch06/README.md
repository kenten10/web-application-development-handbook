# 第6章 フロントエンドフレームワーク — コード教材

## 前提環境

- Node.js 24.18.0 LTS
- pnpm 11.15.1
- TypeScript 6.0.3

## 共通コマンド

```bash
pnpm install
pnpm --filter @handbook/ch06 run lint
pnpm --filter @handbook/ch06 run typecheck
pnpm --filter @handbook/ch06 run test
pnpm --filter @handbook/ch06 run build
```

> `solution` は要件一覧ではなく、実行・観察できる模範実装でなければなりません。`referenceArtifact` や `model answer scaffold` は検証エラーになります。

## 課題一覧

| 課題 | 開始地点 | 模範解答 | 難易度 | 推定時間 | 必要サービス |
|---|---|---|---:|---:|---|
| 6.1 課題6.1: 100行ミニReact + Hooks (★★★) | `mini-react/mini-react.ts` | `mini-react/mini-react.solution.ts` | ★★★ | 150分 | なし |
| 6.2 課題6.2: Signals ベースのリアクティブシステム (★★★) | `signals.ts` | `signals.solution.ts` | ★★★ | 150分 | なし |
| 6.3 課題6.3: Diff アルゴリズム (VDOM Reconciler)(★★★) | `vdom-diff.ts` | `vdom-diff.solution.ts` | ★★★ | 150分 | なし |
| 6.4 課題6.4: Web Components で型安全な Counter (★★) | `web-component-counter/starter/main.html` | `web-component-counter/solution/main.html` | ★★ | 90分 | なし |
| 6.5 課題6.5: フレームワーク比較ベンチマーク (★) | `benchmark/starter/main.sh` | `benchmark/solution/main.sh` | ★ | 45分 | localhost |
| 6.6 課題6.6: フォーカスとエラー通知の欠落を再現して塞ぐ (★★★) | `a11y-focus/starter/main.ts` | `a11y-focus/solution/main.ts`<br>`a11y-focus/solution/report.ts` | ★★★ | 150分 | なし |

## 課題詳細

### 6.1 課題6.1: 100行ミニReact + Hooks (★★★)

**目的**: 6.3 でミニ React の核を示したが、本課題ではそれにuseState、useEffect、useMemo、useRefを追加する。

**難易度**: ★★★

**推定時間**: 150分 (ランタイムと useState のスロット管理に45分、useEffect のクリーンアップと依存比較に50分、useMemo/useRef の追加とテスト・観察に55分)

**必要サービス**: なし

**前提**

- 6.3 100行で作るミニReact を読み、createElement とレンダリングループの骨格を把握しておく
- 6.4 Hooks の仕組み ― なぜ呼び出し順序が重要なのか を読み、フック状態が呼び出し順の配列で管理される理由を説明できる状態にする
- 5.3 関数 ― First-class Citizen を読み、クロージャで状態を閉じ込める書き方に慣れておく
- `pnpm --filter @handbook/ch06 run test` が実行できる状態にしておく

**完成条件 (自己採点用チェックリスト)**

- [ ] `code/ch06/mini-react/mini-react.ts` に `createMiniReact(component)` と `useState` / `useEffect` / `useMemo` / `useRef` を実装する
- [ ] フック状態を呼び出し順のインデックス配列で保持し、`render()` を繰り返しても各フックが自分のスロットを取り戻す
- [ ] `useRef` が返すオブジェクトが再レンダリング後も同一参照で、`current` の増分が積み上がる
- [ ] `useEffect` は依存配列が変化したときだけ再実行され、再実行の前に前回のクリーンアップが呼ばれる
- [ ] `dispose()` で登録済みエフェクトのクリーンアップがすべて実行される
- [ ] `solutions.test.ts` の import を自分の実装へ向けた状態で `pnpm --filter @handbook/ch06 run test` が全件パスする

**期待出力**

- テスト `mini React keeps hook order and runs effect cleanup` が pass する
- 初回 `render()` の戻り値が `{ count: 0, doubled: 0, renders: 1 }` になる
- setState 後にマイクロタスクを1回待ってから `render()` すると `{ count: 1, doubled: 2, renders: 3 }` が返る
- エフェクトのログが `effect:0`、`cleanup:0`、`effect:1` の順に並び、`dispose()` 後の最後の要素が `cleanup:1` になる

**観察項目**

- `useState` を `if` の中に入れて条件によって呼ばれないようにし、フック添字がずれて別スロットの値が返ることを実際に観察する
- setState をマイクロタスクでまとめる処理を同期実行へ変え、`renders` の回数がどう増えるかを比較する
- `useMemo` の依存配列を `[]` に固定し、count が変わっても doubled が更新されなくなることを確認する
- 同じ値で setState を呼んだときに再レンダリングが走るかどうかを、`renders` の増分で確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch06 run test` を実行し、mini React のテストが pass すれば合格
2. `pnpm --filter @handbook/ch06 run typecheck` を実行し、フックの戻り値型 (`[T, (next: T) => void]` など) でエラー0件なら合格
3. コンポーネント内で `useState` を2つに増やし、`render()` を3回呼んでも両方の値が独立に保たれれば、スロット管理が正しい

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: フックは「現在レンダリング中のコンポーネントを指すグローバル変数」と「そのコンポーネントが持つ状態配列」の2つだけで成立する。まず useState 1本に絞って、render のたびに添字を0へ戻す仕組みを作る
2. 構造: ランタイムを `MiniReactRuntime` クラスにして、`hooks: unknown[]`、`cursor: number`、`render()`、`dispose()` を持たせる。`useEffect` は依存配列とクリーンアップ関数を同じスロットへ格納し、`depsChanged(before, after)` で比較する
3. 実装の要点: setState はその場で再レンダリングせず `queueMicrotask` で1回にまとめる。同期再帰させると、レンダリング中の setState で無限ループになる

**本番利用時の警告**

- このミニ実装は DOM への差分適用、イベント委譲、エラーバウンダリ、並行レンダリングを持たない。実 UI へ載せると更新の取りこぼしとエフェクトの二重実行が起きる
- フック状態をモジュールスコープのグローバル変数で持つため、複数コンポーネントを同時にレンダリングすると状態が混線する。本番では React の公式実装を使う

**導線**

- 開始地点: `mini-react/mini-react.ts`
- 模範解答: `mini-react/mini-react.solution.ts`

### 6.2 課題6.2: Signals ベースのリアクティブシステム (★★★)

**目的**: SolidJS や Vue 3 の Composition API で使われる Signals を自作する。React の VDOM とは異なる「直接的な反応」のアプローチを実装。

**難易度**: ★★★

**推定時間**: 150分 (signal と effect の依存追跡に50分、computed のキャッシュ実装に40分、同値スキップと循環検出、観察記録に60分)

**必要サービス**: なし

**前提**

- 6.7 Signals ― リアクティビティの新潮流 を読み、依存の自動追跡と push 型更新の考え方を把握しておく
- 6.5 Vue ― リアクティビティを中核に を読み、getter 経由の依存収集という発想に触れておく
- `Set` と `Map` を使った双方向の参照管理をコードで書ける
- `pnpm --filter @handbook/ch06 run test` が実行できる状態にしておく

**完成条件 (自己採点用チェックリスト)**

- [ ] `code/ch06/signals.ts` に `createSignal` / `computed` / `effect` を実装し、`createSignal` は getter と setter のタプルを返す
- [ ] effect 内で読んだ signal が自動的に依存として登録され、依存の明示宣言が不要になる
- [ ] `Object.is` で同値と判定された set では effect が再実行されない
- [ ] `effect()` の戻り値の dispose 関数を呼ぶと、以後どの signal を更新しても再実行されない
- [ ] effect の実行中に自分が読む signal を set する直接循環を検出し、`cycle` を含むメッセージの例外を投げる
- [ ] `solutions.test.ts` の import を自分の実装へ向けた状態で `pnpm --filter @handbook/ch06 run test` が全件パスする

**期待出力**

- テスト `signals track dependencies and skip equal values` と `signals reject direct cycles` の2件が pass する
- count を 1 で初期化し 1 へ set、その後 2 へ set、dispose 後に 3 へ set した場合、effect が記録した配列が `[2, 4]` になる
- 循環を作る effect を登録すると `/cycle/i` にマッチするエラーが throw される
- computed は依存が変わるまで再計算されず、複数回読んでもキャッシュ済みの値が返る

**観察項目**

- 「現在実行中の effect」を保持するグローバル変数を effect の入口と出口で console.log し、ネストした effect で退避と復帰が起きることを確認する
- effect の再実行前に古い依存集合をクリアする処理を外し、条件分岐で読む signal を切り替えたときに不要な依存が残り続けることを確認する
- computed のキャッシュを外して素の関数にし、同じ effect 内で2回読んだときの計算回数の差を数える
- 1つの signal に10個の effect を張り、set 1回で何回の再実行が発生するかを数えてバッチ処理の必要性を確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch06 run test` を実行し、signals の2テストが pass すれば合格
2. `pnpm --filter @handbook/ch06 run typecheck` を実行し、`Signal<T>` のタプル型でエラー0件なら合格
3. 条件分岐で読む signal を切り替える effect を書き、切り替え後に旧依存を更新しても再実行されなければ依存の再収集が正しい

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 依存追跡の本体は「signal の getter が呼ばれた瞬間に、いま走っている effect を自分の購読者集合へ足す」という一行に集約される。まずグローバル変数1つと Set 1つで最小構成を作る
2. 構造: effect を `ReactiveEffect` クラスにして `deps: Set<Set<Subscriber>>`、`run()`、`dispose()` を持たせる。run の冒頭で旧依存を全て解除してから自分を activeEffect に設定し、finally で元へ戻す
3. 実装の要点: 循環検出は `running` フラグ1つで足りる。run 中にもう一度 run が呼ばれたら throw する。フラグの解除を finally に置かないと、例外時に effect が永久に実行不能になる

**本番利用時の警告**

- effect の再実行時に旧依存を解除しないと、購読者集合が単調増加してメモリリークになる。長寿命の画面ではこの実装のまま使わない
- バッチ処理とスケジューラを持たないため、set を連続で呼ぶと effect が呼び出し回数分だけ同期実行される。大量更新のあるリストに適用すると UI が固まる

**導線**

- 開始地点: `signals.ts`
- 模範解答: `signals.solution.ts`

### 6.3 課題6.3: Diff アルゴリズム (VDOM Reconciler)(★★★)

**目的**: React の根幹である「2つの VDOM ツリーを比較して、最小の DOM 操作を導く」アルゴリズムを実装する。

**難易度**: ★★★

**推定時間**: 150分 (ノード単位の4分岐実装に40分、key 付き子の照合と MOVE 生成に60分、props 差分とパッチ件数の観察に50分)

**必要サービス**: なし

**前提**

- 6.2 仮想DOMの正体 を読み、差分計算と DOM 操作の分離という前提を把握しておく
- 6.3 100行で作るミニReact を読み、VNode の構造 (type、props、children、key) に慣れておく
- TypeScript の判別可能ユニオン型 (`{ type: 'MOVE'; ... }` の形) を読み書きできる
- `pnpm --filter @handbook/ch06 run test` が実行できる状態にしておく

**完成条件 (自己採点用チェックリスト)**

- [ ] `code/ch06/vdom-diff.ts` の `diff(oldNode, newNode, path)` が DOM を直接操作せず `Patch[]` を返す
- [ ] `CREATE` / `REMOVE` / `REPLACE` / `TEXT` / `PROPS` / `MOVE` の6種のパッチ型を判別可能ユニオンとして定義する
- [ ] type が異なるノードで `REPLACE`、文字列の差分で `TEXT`、props の差分で set と remove を持つ `PROPS` が出る
- [ ] key 付きの子を並び替えたとき `MOVE` が出て、`REPLACE` が0件になる
- [ ] 変更のないサブツリーに対してパッチが1件も出ない
- [ ] `solutions.test.ts` の import を自分の実装へ向けた状態で `pnpm --filter @handbook/ch06 run test` が全件パスする

**期待出力**

- テスト `VDOM diff updates only changed nodes and emits keyed moves` が pass する
- key が a、b の2要素リストを b、a へ並び替え、b のテキストだけ変えたとき、`MOVE` が2件、`TEXT` が1件、`REPLACE` が0件になる
- パッチの `path` が `0`、`0.1` のようなドット区切りのツリー座標で出力される
- `PROPS` パッチは新規・変更されたキーを `set` に、消えたキーを `remove` の配列に持つ

**観察項目**

- key を外して同じ並び替えを diff にかけ、MOVE が消えて全要素の TEXT や REPLACE に化けることを確認する
- 1000要素のリストのうち1要素だけを書き換えた入力を作り、返るパッチ件数が1〜2件に収まることを `patches.length` で確認する
- 子の追加・削除・並び替えを同時に含む入力を与え、REMOVE の path が旧インデックス基準であることを確認する
- props の値をオブジェクトにして毎回新しい参照を渡し、`Object.is` 比較では毎回 PROPS パッチが出てしまうことを確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch06 run test` を実行し、VDOM diff のテストが pass すれば合格
2. `pnpm --filter @handbook/ch06 run typecheck` を実行し、`Patch` ユニオンの網羅性でエラー0件なら合格
3. 同一の VNode ツリーを old と new に渡して `diff` を呼び、返る配列が空 (`length === 0`) なら無駄なパッチが出ていない

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 先に「同じ位置の2ノードを比べる」1段だけを書く。undefined 同士、文字列同士、type 違い、type 同じ、の4分岐を潰してから子の照合へ進む
2. 構造: 子の照合は key をキーにした `Map` を旧配列から作り、新配列を走査して一致を引く。key の無い子には `#index:${i}`、テキストには `#text:${i}` のような合成キーを割り当てると分岐が1本化できる
3. 実装の要点: MOVE を出すのは実キーを持つ子だけにする。合成キーの子まで MOVE 対象にすると、単なる挿入で全要素が移動扱いになりパッチが爆発する

**本番利用時の警告**

- この diff はパッチ列を返すだけで適用器を含まない。パッチの path をそのまま DOM へ適用する場合、MOVE と REMOVE の適用順を誤ると参照する子インデックスがずれてツリーが壊れる
- props を `Object.is` で浅く比較するため、毎回生成されるオブジェクトやインライン関数を props に渡すと差分が常に発生する。本番のリコンサイラのように優先度制御や中断も行わないため、大規模ツリーではメインスレッドを長時間占有する

**導線**

- 開始地点: `vdom-diff.ts`
- 模範解答: `vdom-diff.solution.ts`

### 6.4 課題6.4: Web Components で型安全な Counter (★★)

**目的**: 標準 Web Components で再利用可能なコンポーネントを作る。HTML 側でも、別フレームワーク側でも使える。

**難易度**: ★★

**推定時間**: 90分 (カスタム要素と Shadow DOM の骨組みに30分、属性・プロパティ・イベントの往復実装に40分、a11y 確認と模範解答との比較に20分)

**必要サービス**: なし

**前提**

- 6.10 Web Components ― フレームワーク非依存の標準 を読み、カスタム要素のライフサイクルコールバックを把握しておく
- 6.9 アクセシビリティ (a11y) ― 全ての人に届けるUI を読み、`aria-label` とキーボード操作の要件を確認しておく
- 静的ファイルを HTTP で配信する手段 (`python3 -m http.server` など) が使える

**完成条件 (自己採点用チェックリスト)**

- [ ] `code/ch06/web-component-counter/starter/main.html` に `class MyCounter extends HTMLElement` を実装し、`customElements.define('my-counter', MyCounter)` で登録する
- [ ] `static observedAttributes = ['initial', 'step']` を宣言し、`<my-counter initial="10" step="2">` が初期表示 10、増加ボタン1回で 12 になる
- [ ] `attachShadow({ mode: 'open' })` の中に `<style>` を置き、ページ側の `button { }` ルールが内部ボタンへ届かない
- [ ] `value` の getter と setter を定義し、`counter.value = 50` で表示が 50 へ更新される
- [ ] 値が実際に変わったときだけ `CustomEvent('change', { detail: { value }, bubbles: true })` を発火し、同じ値の代入では発火しない
- [ ] 増減ボタンに `aria-label` を付け、Tab でフォーカスして Enter または Space で値を変更できる

**期待出力**

- `<my-counter initial="10" step="2">` が 10 を表示し、増加ボタン1回で 12、減少ボタン1回で 10 に戻る
- change イベントの `event.detail.value` に新しい数値が入り、ページ側の `<output>` が同じ値へ更新される
- 属性を持たない `<my-counter>` は initial 0、step 1 として描画される
- DevTools の Elements で要素の下に `#shadow-root (open)` が現れ、その中に style と3つの子要素が並ぶ

**観察項目**

- DevTools の Elements パネルで shadow root を開き、ページ側に書いた `button { background: red }` が内部ボタンへ適用されないことを確認する
- コンソールで `document.querySelector('my-counter').setAttribute('step', '5')` を実行し、attributeChangedCallback が呼ばれて次のクリックから増分が変わることを確認する
- `counter.value = counter.value` を実行し、change イベントのリスナーが発火しないことをログで確認する
- 要素を `remove()` してから再度 `append` し、connectedCallback が再実行されて初期化が走ることを確認する
- `initial="abc"` のような非数値属性を与え、`Number.isFinite` の検証でフォールバック値になることを確認する

**テスト方法 (自己採点手順)**

1. `python3 -m http.server 8080 --directory code/ch06/web-component-counter/solution` を起動し、`http://localhost:8080/main.html` で模範解答の挙動を先に確認してから自作版と比較する
2. 自作版を同じ手順で開き、ブラウザのコンソールで `document.querySelector('my-counter').value = 50` を実行して表示が 50 になり change が1回だけ発火すれば合格
3. キーボードだけで操作し、Tab でボタンにフォーカスが移り Enter または Space で値が step 分だけ増減すれば a11y 要件を満たす

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 属性 (HTML から与える文字列) とプロパティ (JavaScript から与える値) は別物として設計する。まず属性を読んで描画するところまでを作り、プロパティ経由の更新は後から足す
2. 構造: constructor で `attachShadow` して `innerHTML` にテンプレートを流し込み、`root.querySelector('[part=value]')` などの参照を private フィールドへ保持する。値の更新は setter に集約し、setter の中から描画とイベント発火を行う
3. 実装の要点: constructor では属性をまだ読まない。DOM パーサが属性を設定する前に呼ばれる場合があるため、`initial` と `step` の読み取りは connectedCallback で行う。ここを間違えると initial が常に 0 になる

**本番利用時の警告**

- Shadow DOM はスタイルの隔離であってセキュリティ境界ではない。テンプレートを `innerHTML` で組み立てる実装のまま、外部由来の文字列を差し込むよう拡張すると XSS になる。属性値は必ず数値へ変換・検証してから使う
- この実装は form-associated custom elements (ElementInternals) と SSR 時の描画を扱わない。そのまま業務フォームへ載せるとフォーム送信に値が含まれず、サーバ側で欠落する

**導線**

- 開始地点: `web-component-counter/starter/main.html`
- 模範解答: `web-component-counter/solution/main.html`

### 6.5 課題6.5: フレームワーク比較ベンチマーク (★)

**目的**: 「同じUI」を3通りで実装し、コード行数・パフォーマンスを比較する。

**難易度**: ★

**推定時間**: 45分 (既存スクリプトの読解と実行に10分、条件を揃えた自作計測の追加に20分、3回実行と行数計測・比較メモ作成に15分)

**必要サービス**: localhost

**前提**

- 課題6.1 と課題6.2 を終え、ミニReact と Signals の実装が手元で動く状態にしておく
- 6.8 フレームワーク選択の現実的な指針 を読み、比較軸が性能だけではないことを確認しておく
- `bash` と `wc` が使え、`code/ch06/benchmark/solution/main.sh` を実行できる

**完成条件 (自己採点用チェックリスト)**

- [ ] `code/ch06/benchmark/starter/main.sh` を書き換え、少なくとも3方式の所要時間をそれぞれ1行で出力する
- [ ] 3方式で同じ作業量 (同じ要素数・同じ更新回数) を測っており、その条件をスクリプト内のコメントに明記している
- [ ] 同じスクリプトを3回以上実行し、最速値と中央値を記録している
- [ ] `wc -l` で各実装のコード行数を数え、実行時間と行数を並べた比較メモを作っている
- [ ] どの方式がどの条件で有利かを、計測値を根拠に3文以上で書き出している

**期待出力**

- `mutable-array`、`immutable-copy`、`signal-style` のように、方式名・ミリ秒・結果値を含む行が3行出力される
- 毎回配列全体をコピーする方式は、繰り返し回数を他方式より大幅に減らしてもなお所要時間が最も長くなる
- 同じスクリプトを続けて2回実行すると、2回目の方が速い値になる回がある
- 終了コードが0で、途中でエラー出力が出ない

**観察項目**

- 1回目と2回目以降の実行時間を比べ、JIT のウォームアップと GC が測定値に混ざることを確認する
- 繰り返し回数を10倍にして、時間が線形に伸びる方式とそれ以上に伸びる方式を切り分ける
- Node 上の計測には DOM 更新コストが含まれないことを確認し、ブラウザでの再計測が別途必要な理由をメモに残す
- コード行数の少なさと実行速度が一致しないケースを見つけ、どちらを優先すべきかを条件付きで整理する

**テスト方法 (自己採点手順)**

1. `bash code/ch06/benchmark/solution/main.sh` を実行し、3方式の行がミリ秒付きで出力されれば実行環境は正常
2. 自作版を `bash code/ch06/benchmark/starter/main.sh` で実行し、3行の計測結果が出て `echo $?` が 0 なら合格
3. `wc -l code/ch06/mini-react/mini-react.solution.ts code/ch06/signals.solution.ts` で行数を取得し、比較表の行数欄が実測値で埋まっていれば合格

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 先に「何を揃えるか」を決める。要素数、更新回数、測定の開始と終了位置を3方式で同一にしないと、あとの数値がすべて比較不能になる
2. 構造: 計測は `performance.now()` で開始と終了を挟み、`toFixed(2)` でミリ秒を出力する。方式名を固定幅で `padEnd` すると、3行の出力がそのまま比較表になる
3. 実装の要点: 1回だけの測定値は使わない。同じ関数を3回以上回して中央値を取る。ウォームアップ用に捨てる1回を先頭に入れると、JIT の影響が数値から抜ける

**本番利用時の警告**

- この計測は単一プロセスの Node 上で行われ、GC、JIT ウォームアップ、CPU 周波数変動を制御していない。この数値だけを根拠に本番の最適化を決めると、効果のない箇所を書き換えることになる
- 3方式の勝敗をそのままフレームワーク選定の根拠にしない。実アプリの差はDOM更新量、バンドルサイズ、チームの習熟度で決まるため、ブラウザ上での再計測と非機能要件の確認が必要になる

**導線**

- 開始地点: `benchmark/starter/main.sh`
- 模範解答: `benchmark/solution/main.sh`

### 6.6 課題6.6: フォーカスとエラー通知の欠落を再現して塞ぐ (★★★)

**目的**: モーダルのフォーカス移動・閉じ込め・復帰の欠落と、送信エラーが支援技術へ届かない状態の4件を、ブラウザを使わずに再現し、実装を差し替えると1件も残らず、かつ正しい入力が素通りし続けることを機械的に確かめる。

**難易度**: ★★★

**推定時間**: 150分 (tabbables と文書モデルの読解30分、fixedDialog の4動作40分、fixedForm の3経路40分、runFindings と観察40分)

**必要サービス**: なし

**前提**

- 6.11 フォーカス管理 を読み、モーダルの4つの動作と inert と aria-hidden の違いを確認する
- 7.9 フォームのアクセシビリティ を読み、エラーが載る3つの経路を押さえる
- 6.9 アクセシビリティ (a11y) を読み、アクセシブルな名前とセマンティックHTMLの役割を確認する
- `code/ch06` で pnpm install 済みで、`pnpm --filter @handbook/ch06 run typecheck` が通る状態にする

**完成条件 (自己採点用チェックリスト)**

- [ ] `tabbables` が hidden と inert の配下、disabled、負の tabindex をいずれも Tab 順序から外す
- [ ] `fixedDialog.open` が開く前のフォーカス位置を記憶し、ダイアログ内へ移し、背後を inert にする
- [ ] `fixedDialog.close` が記憶した位置へ戻し、戻り先が消えている場合は見出しへ移す
- [ ] `fixedForm.submit` がフィールド単位・エラーサマリ・フォーカス移動の3経路をすべて用意する
- [ ] 正しい入力での送信が成功し、成功の通知が1件だけライブリージョンへ入る
- [ ] `pnpm --filter @handbook/ch06 exec tsx a11y-focus/starter/report.ts` が6行の要約を出力する

**期待出力**

- 1行目に `naive ui: 4/4 barriers reproduced` が出る
- A1 の行が `naive focus=del-2 inside-dialog=false / fixed focus=confirm inside-dialog=true` になる
- A2 の行が `naive escaped=6 first=del-3 / fixed escaped=0 first=none` になる
- A3 の行が `naive after-close=(body) / fixed after-close=page-title` になる
- 最終行が `fixed ui: 0/4 barriers remaining (valid submit still announced)` になる

**観察項目**

- `fixedDialog.open` から inert の設定を外し、A2 だけが再現に戻る (fixed escaped=5) ことを確認する
- `naiveDialog.open` へ inert だけを足し、A2 は解消するが A1 が残る (naive 3/4、escaped=0) ことを確認する
- `naiveDialog.open` へフォーカス移動だけを足し、A1 は解消するが A2 が残る (naive 3/4、escaped=5) ことを確認する
- `focusAfterDelete` の deleteItem の呼び出しを外し、A3 の fixed が after-close=del-2 になることを確認する
- `fixedForm` のフォーカス移動先を error-summary から submit に変え、A4 だけが再現に戻ることを確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch06 exec tsx a11y-focus/solution/report.ts` を実行し、6行の要約が出力されることを確認する
2. `pnpm --filter @handbook/ch06 run test` を実行し、a11y-focus の4件のテストが pass することを確認する
3. 自分の `a11y-focus/starter/report.ts` を実行し、solution と同じ出力になるかで自己採点する
4. `pnpm --filter @handbook/ch06 run typecheck` が 0 エラーで終わることを確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 判定の入口を tabbables に一本化する。到達できるかどうかも、閉じ込められているかどうかも、フォーカスの復帰先が使えるかどうかも、すべて同じ集合から導けるようにすると、どこか1か所だけ古い判断が残るという誤りが起きなくなる。
2. 構造: モーダルの4つの動作を、開くときの3つと閉じるときの1つに分けて考える。開くときは「記憶する」「移す」「外を止める」の順で、閉じるときは「隠す」「外の停止を解く」「戻す」の順である。閉じ込めを属性で表現できていれば、Tab の処理そのものは全体を巡回するだけで済む。
3. 実装の要点: フォームは、エラーの文字列が支援技術へ届く経路を3つ用意する。入力欄からは aria-describedby で、まとめからは件数を含む見出しとリンクで、そして通知はサマリへフォーカスを移すことで行う。3つ目が無いと、送信ボタンにフォーカスがある利用者には何も起きていないように見える。

**本番利用時の警告**

- この文書モデルは実ブラウザの一部を模したものにすぎない。フォーカス可能な要素の集合、inert の効果、支援技術の読み上げ位置は実装によって異なる。25.11 のキーボード走査と支援技術での確認を必ず併用する。
- ここでの「読み上げに届いた」判定は、名前・説明・ライブリージョン・フォーカス先の内容という4経路の文字列一致にすぎない。実際に理解できる文言かどうかは別に確認する。
- アクセシビリティの適合水準を外部へ表明するかどうかは、技術的な判断だけでは決まらない。法務およびアクセシビリティの専門家に確認する (25.11、30.16)。

**導線**

- 開始地点: `a11y-focus/starter/main.ts`
- 模範解答: `a11y-focus/solution/main.ts`、`a11y-focus/solution/report.ts`

## 評価方法

1. starterから開始し、本文の要件と課題詳細の完成条件を満たす。
2. 期待出力・観察項目を記録する。
3. 完成条件のチェックリストで自己採点し、未達項目を残す。
4. solutionとの差分を説明する。
5. `pnpm --filter @handbook/ch06 run test` を実行する。

## 安全上の注意

- 脆弱性・ネットワーク・OS・コンテナの演習は、localhostまたは隔離環境だけで実行してください。
- 教材用の簡略実装をそのまま本番へ投入しないでください。
- 各課題の「本番利用時の警告」を読まずに、演習コードを製品コードへ流用しないでください。

## 配布対象外

`node_modules/`、`dist/`、`coverage/`、一時DB、秘密情報、計測生成物は配布対象外です。
