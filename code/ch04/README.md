# 第4章 HTML/CSS/JavaScriptの設計思想 — コード教材

## 前提環境

- Node.js 24.18.0 LTS
- pnpm 11.15.1
- TypeScript 6.0.3

## 共通コマンド

```bash
pnpm install
pnpm --filter @handbook/ch04 run lint
pnpm --filter @handbook/ch04 run typecheck
pnpm --filter @handbook/ch04 run test
pnpm --filter @handbook/ch04 run build
```

> `solution` は要件一覧ではなく、実行・観察できる模範実装でなければなりません。`referenceArtifact` や `model answer scaffold` は検証エラーになります。

## 課題一覧

| 課題 | 開始地点 | 模範解答 | 難易度 | 推定時間 | 必要サービス |
|---|---|---|---:|---:|---|
| 4.1 課題4.1: レンダリングパイプラインを計測する (★) | `render-bench/starter/README.md`<br>`starter.md` | `render-bench/index.solution.html`<br>`render-bench/solution/README.md`<br>`solution.md` | ★ | 45分 | Chrome |
| 4.2 課題4.2: 純粋なDOM APIでTodoアプリ (★★) | `todo-vanilla/starter/index.html`<br>`todo-vanilla/starter/app.ts`<br>`todo-vanilla/starter/README.md` | `todo-vanilla/solution/index.html`<br>`todo-vanilla/solution/app.ts`<br>`todo-vanilla/solution/README.md` | ★★ | 90分 | なし |
| 4.3 課題4.3: 最小限のイベントループを自作 (★★★) | `event-loop/event-loop.ts` | `event-loop/event-loop.solution.ts` | ★★★ | 150分 | なし |
| 4.4 課題4.4: CSS の Cascade を解析するツール (★★) | `css-specificity.ts` | `css-specificity.solution.ts` | ★★ | 90分 | なし |
| 4.5 課題4.5: ESM と CommonJS の混在問題を再現 (★) | `esm-vs-cjs/starter/main.sh` | `esm-vs-cjs/solution/main.sh`<br>`esm-vs-cjs/solution.md` | ★ | 45分 | なし |

## 課題詳細

### 4.1 課題4.1: レンダリングパイプラインを計測する (★)

**目的**: 「リフロー」「リペイント」が実際にいつ起きているかを計測で確認する。

**難易度**: ★

**推定時間**: 45分 (3方式の実行と数値記録に15分、Performanceパネルでの回数計測に20分、原因の記述に10分)

**必要サービス**: Chrome

**前提**

- 4.1 ブラウザのレンダリングパイプライン と 4.2 リフローとリペイントを抑える を読み、Layout・Paint・Composite を区別できる
- Chrome の DevTools の Performance タブで記録・停止・区間選択ができる
- `code/ch04/render-bench/starter/index.html` をローカルの HTTP サーバで配信し、ブラウザで開ける

**完成条件 (自己採点用チェックリスト)**

- [ ] Bad / Better / Best の3方式をそれぞれ実行し、画面の output に表示される所要ミリ秒を記録している
- [ ] Performance の記録から Recalculate Style と Layout の発生回数を3方式それぞれについて数えている
- [ ] Best と Bad の所要時間の倍率を計算している
- [ ] Bad が遅い理由を、style書き込みと `offsetLeft` 読み取りの交互実行による強制同期レイアウトとして説明している
- [ ] 測定に使った端末・ブラウザ版・要素数 (1000) を記録に残している

**期待出力**

- ページ読み込み時に `#stage` へ1000個の `.item` 要素が生成される
- ボタン押下後に output へ `bad: NN.NN ms` の形式で方式名と経過時間が表示される
- Performance のメインスレッド上で、Bad では Layout が多数並び、Best では Composite Layers 中心のフレームになる
- Best は `requestAnimationFrame` のコールバック内で実行されるため、計測終了が次フレームまでずれる

**観察項目**

- Bad の実行中に Performance の Summary で Rendering の占有時間が跳ね上がることを確認する
- Better では `display: none` の間の変更がレイアウトを起こさず、再表示時に1回だけ計算されることを確認する
- Best では transform を使うためレイアウトが走らず、`will-change: transform` によりレイヤが分離されていることを Layers パネルで確認する
- 同じ操作を DevTools を閉じた状態で行い、計測オーバーヘッドで絶対値が変わることを確認する

**テスト方法 (自己採点手順)**

1. `python3 -m http.server --directory code/ch04/render-bench 8000` を起動し、http://localhost:8000/index.solution.html を開いて3つのボタンすべてで output にミリ秒が表示されれば計測が成立している
2. Performance を記録した状態で Bad を実行し、Layout イベントが1件以上記録されていれば計測点が正しい
3. 記録表が `code/ch04/solution.md` の4列 (方式、JavaScript区間、Layout回数、Paint回数) を3方式分埋めていれば合格とする
4. 倍率を単一の固定値で結論づけず、端末名とブラウザ版を併記していることを自己チェックする

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 先に何を数えるかを決める。JavaScript の実行時間と、ブラウザがレイアウトへ使った時間は別物なので、`performance.measure` の値と Performance パネルの値を混ぜない。
2. 構造: Bad は `el.style.left` の書き込み直後に `el.offsetLeft` を読むことで強制同期レイアウトを起こしている。Better は `stage.style.display='none'` で一時的に描画木から外す。Best は `requestAnimationFrame` の中で transform だけを変える。
3. 実装の要点: Best の計測は非同期になるため、終了マークを `requestAnimationFrame` のコールバック内で打たないと 0 ms に近い誤った値が出る。3方式の間で要素を作り直し、初期状態を揃えてから比較する。

**本番利用時の警告**

- 得られたミリ秒は端末・ブラウザ版・拡張機能・DevToolsの有無で数倍変わる。「transform は N 倍速い」と固定倍率で社内へ共有しない
- `will-change: transform` を広い範囲の要素へ付けるとレイヤが増えてGPUメモリを消費し、かえって遅くなる。本番では対象を限定する

**導線**

- 開始地点: `render-bench/starter/README.md`、`starter.md`
- 模範解答: `render-bench/index.solution.html`、`render-bench/solution/README.md`、`solution.md`

### 4.2 課題4.2: 純粋なDOM APIでTodoアプリ (★★)

**目的**: フレームワークなしでも、設計次第で読みやすく保守しやすいUIが書けることを確認する。

**難易度**: ★★

**推定時間**: 90分 (状態と描画の分離の設計に20分、追加削除完了とフィルタの実装に35分、localStorageとキーボード操作に20分、アクセシビリティ確認に15分)

**必要サービス**: なし

**前提**

- 4.3 DOMの中身 と 4.7 実装例: 純粋なDOM APIでTodoアプリを作る を読み、状態と描画を分ける構成を把握している
- TypeScript を tsc でコンパイルし、ブラウザからESモジュールとして読み込める
- `code/ch04/todo-vanilla/starter/index.html` と `starter/app.ts` を開始点にできる

**完成条件 (自己採点用チェックリスト)**

- [ ] 追加・削除・完了切替の3操作が動き、localStorage に保存されてリロード後も復元される
- [ ] All / Active / Completed の3フィルタが切り替わり、選択中のボタンに `aria-pressed="true"` が付く
- [ ] Enter で追加、Esc で入力欄クリア、Cmd/Ctrl+Enter で全件完了のキーボード操作が動く
- [ ] 未完了件数が `aria-live="polite"` の領域に表示され、操作のたびに更新される
- [ ] 状態が配列として1か所に保持され、DOMを状態の保管場所にしていない
- [ ] チェックボックスと削除ボタンに、対象のTodo文言を含む `aria-label` が付いている

**期待出力**

- 入力して Enter を押すと `#todo-list` に li が1件追加され、`#status` が `N件が未完了` に更新される
- 完了にすると li に `completed` クラスが付き、テキストに打ち消し線が入る
- Active フィルタでは完了済みの li が一覧から消え、Completed では逆になる
- リロード後も localStorage のキー `handbook-ch04-todos` から同じ一覧が復元される
- localStorage の値が壊れていても例外で停止せず、空リストとして起動する

**観察項目**

- Elements パネルで1件追加したときにDOMのどの範囲が更新されるかを見て、全件再構築か差分更新かを判断する
- Application パネルの Local Storage で `handbook-ch04-todos` のJSONを直接編集し、状態の単一の情報源がどこにあるかを確かめる
- キーボードだけで追加・完了・削除まで到達できるか、Tab のフォーカス順を確認する
- 削除後に入力欄へフォーカスが戻ることを確認し、フォーカス管理がない場合の操作の止まり方と比べる

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch04 run test` を実行し、第4章のテストと教材ファイル検証が通ることを確認する
2. `rm -rf /tmp/ch04 && tsc -p code/ch04/tsconfig.json --outDir /tmp/ch04` でコンパイルし、`cp code/ch04/todo-vanilla/solution/index.html /tmp/ch04/todo-vanilla/solution/` の後に `/tmp/ch04` でHTTPサーバを起動して開き、追加・完了・削除・フィルタの4操作が動けば合格とする
3. DevTools のコンソールで `localStorage.setItem('handbook-ch04-todos', 'not json')` を実行してから再読み込みし、画面が白くならず空リストで起動することを確認する
4. マウスを使わずキーボードのみで1件追加してから全件完了まで操作できることを確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 状態 (Todoの配列とフィルタ) を先に決め、状態を変える関数と状態から画面を作る関数に分ける。イベントハンドラは状態を変えて再描画を呼ぶだけにする。
2. 構造: 描画は `list.replaceChildren(...)` へ要素配列を渡す形にすると、差分計算を持たずに表示の一貫性を保てる。要素は `document.createElement` で作り、文字は `textContent` へ入れる。保存は `localStorage.setItem(key, JSON.stringify(todos))` で足りる。
3. 実装の要点: localStorage のJSONは他のタブや手動編集で壊れうるため、`JSON.parse` を try で囲み、配列でなければ空配列へ落とす。文字列を `innerHTML` へ入れると入力がHTMLとして解釈されるので `textContent` を使う。

**本番利用時の警告**

- Todoの文字列を `innerHTML` で挿入する実装にすると、入力がそのままスクリプトとして実行される保存型XSSになる。`textContent` を使い、フレームワーク導入後も同じ原則を守る
- localStorage は同一オリジンのどのスクリプトからも読める平文の保存領域で、暗号化も容量保証もない。認証トークンや個人情報を置かない
- この実装は差分更新を持たず全件を再構築するため、数千件規模では操作のたびに再描画コストが線形に増える

**導線**

- 開始地点: `todo-vanilla/starter/index.html`、`todo-vanilla/starter/app.ts`、`todo-vanilla/starter/README.md`
- 模範解答: `todo-vanilla/solution/index.html`、`todo-vanilla/solution/app.ts`、`todo-vanilla/solution/README.md`

### 4.3 課題4.3: 最小限のイベントループを自作 (★★★)

**目的**: JavaScript のイベントループ・マイクロタスク・マクロタスクを実装して、挙動を完全に理解する。

**難易度**: ★★★

**推定時間**: 150分 (キュー構成の設計に25分、run() のチェックポイント実装に45分、タイマーとrAFの追加に35分、期待順序の検証と本物との比較に45分)

**必要サービス**: なし

**前提**

- 4.5 JavaScriptランタイムとイベントループ を読み、タスクとマイクロタスクのチェックポイントを説明できる
- Promise と `queueMicrotask` の実行順序を実際のNode.jsで確認した経験がある
- `code/ch04/event-loop/event-loop.ts` を開始点に TypeScript のクラスを書ける

**完成条件 (自己採点用チェックリスト)**

- [ ] MiniEventLoop クラスが addMicrotask / addMacrotask / setTimeout / requestAnimationFrame の4つの登録APIを持つ
- [ ] `run()` がキューが空になるまで回り、マクロタスクを1件処理するたびにマイクロタスクキューを空にする
- [ ] 本文の例で `3. initial micro` → `1. macro` → `2. micro from macro` の順に出力される
- [ ] マクロタスクの実行中に追加されたマイクロタスクが、次のマクロタスクより先に実行される
- [ ] setTimeout が遅延の小さい順に発火し、同じ遅延なら登録順を保つ
- [ ] タスクを無限に追加し続けるコードで停止するよう、実行ステップ数の上限を持つ

**期待出力**

- 本文のテストコードの出力が `3. initial micro` `1. macro` `2. micro from macro` の3行になる
- 20ms と 10ms の順で setTimeout を登録しても、10ms 側が先に実行される
- requestAnimationFrame へ登録した関数が、そのフレームのマクロタスク処理後にまとめて実行される
- 上限を超えるタスク追加で `event loop exceeded maxSteps` の例外が投げられる
- 負の遅延や非有限の遅延を渡すと例外になる

**観察項目**

- 同じ順序の実験を本物のNode.js (`setTimeout` と `queueMicrotask`) で書いて出力を比べ、自作ループが実挙動と一致しているか確認する
- マイクロタスクの排出を1件ずつに変えると出力順がどう崩れるかを試し、チェックポイントの意味を確認する
- requestAnimationFrame の処理をマイクロタスク排出の前に置くと順序が変わることを確認する
- 仮想時刻を進める位置を変えると、タイマーの発火順が変わることを確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch04 run test` を実行し、`mini event loop drains initial and nested microtasks at checkpoints` がパスすることを確認する
2. `tsx code/ch04/event-loop/event-loop.solution.ts` を実行し、`3. initial micro` `1. macro` `2. micro from macro` の3行がこの順で出れば合格とする
3. 自分の実装で本文のテストコードを走らせ、出力順が3行とも一致することを確認する
4. タスクを無限に追加するケースを試し、プロセスが固まらず例外で終了することを確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: キューを何本持つか、どのタイミングでマイクロタスクを空にするかを先に紙に書く。実装より先に、期待する出力順を数パターン列挙しておく。
2. 構造: マイクロタスク・マクロタスク・アニメーションフレーム・タイマーの4本の配列を持つ。`run()` は最初にマイクロタスクを空にし、以後は「期限の来たタイマーをマクロタスクへ移す」「マクロタスクを1件実行」「マイクロタスクを空にする」を繰り返す。
3. 実装の要点: 落とし穴はマイクロタスクの排出条件で、`while (queue.length)` にしないと実行中に追加された分が同じチェックポイントで処理されない。`for` で長さを固定してはいけない。タイマーは期限と登録順の2キーで安定ソートする。

**本番利用時の警告**

- この実装は仮想時刻で動くため、実時間のI/O完了、Node.jsのフェーズ (timers / poll / check)、`process.nextTick` の優先順位を再現しない。実行順の議論をこのモデルだけで結論づけない
- 本物のイベントループの代替として業務コードのスケジューラへ転用すると、I/Oの飢餓や優先度逆転を招く。学習用のモデルにとどめる

**導線**

- 開始地点: `event-loop/event-loop.ts`
- 模範解答: `event-loop/event-loop.solution.ts`

### 4.4 課題4.4: CSS の Cascade を解析するツール (★★)

**目的**: CSS の「カスケード」が複雑な選択子ルールで成り立っていることを実装で理解する。

**難易度**: ★★

**推定時間**: 90分 (カウント関数の実装に35分、:is / :not / :where の再帰処理に25分、比較とソートに15分、境界ケースの検証に15分)

**必要サービス**: なし

**前提**

- 4.4 CSSの仕組み を読み、詳細度が inline / id / class / type の4つ組で比較されることを説明できる
- 正規表現でセレクタ文字列からトークンを抜き出せる
- `code/ch04/css-specificity.ts` を開始点に TypeScript の関数を書ける

**完成条件 (自己採点用チェックリスト)**

- [ ] `calculateSpecificity(selector)` が inline / id / class / type の4カウンタを返す
- [ ] `#header .nav li:hover a` に対して id=1、class=2、type=2 を返す
- [ ] 属性セレクタと疑似クラスを class と同じ桁で数え、疑似要素を type と同じ桁で数える
- [ ] 全称セレクタ `*` と結合子 (`>` `+` `~`) を詳細度へ加算しない
- [ ] 2つの詳細度を比較する関数と、セレクタ配列を優先度の降順に並べる関数を提供する
- [ ] `!important` を検出し、比較時に他のどの桁よりも優先する

**期待出力**

- `calculateSpecificity('#header .nav li:hover a')` が `{ inline: 0, id: 1, class: 2, type: 2, important: false }` を返す
- `calculateSpecificity(':where(#ignored) article')` が id=0、type=1 を返す (`:where` は詳細度0)
- `:is(.a, #b)` は引数のうち最も強い `#b` を採用し、`.a` 単独より強くなる
- `sortSelectors(['p', '.x', '#id'])` が `['#id', '.x', 'p']` を返す
- コマンドラインでセレクタを渡すと、セレクタ文字列と4つ組が1行で出力される

**観察項目**

- DevTools の Styles パネルで打ち消されたルールに取り消し線が付く様子を見て、自分の計算結果と一致するか確認する
- `:not(.a)` と `:where(.a)` を比べ、前者は引数の詳細度を持ち後者は0になることを確認する
- 同じ詳細度のルールを2つ書き、後に書かれた方が勝つことを確認して、詳細度だけでは適用が決まらないと理解する
- インラインスタイルと `!important` を組み合わせ、優先順位の最上位がどこにあるかを実際のブラウザで確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch04 run test` を実行し、`CSS specificity matches the chapter example` と `:where has zero specificity and :is uses the strongest argument` の2件がパスすることを確認する
2. `tsx code/ch04/css-specificity.solution.ts '#header .nav li:hover a'` を実行し、id=1・class=2・type=2 の4つ組が表示されれば合格とする
3. 自分の実装へ `*`、`div > p`、`a::before`、`[data-x]` の4つを入力し、順に type=0、type=2、type=2でclass=0、class=1 になることを確認する
4. 比較関数へ同じ詳細度を2つ渡して 0 が返り、ソートが安定していることを確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 数える前に消す方が楽になる。強い順に id、class相当、type相当とマッチさせ、マッチした部分をセレクタ文字列から削っていくと二重計上を防げる。
2. 構造: `:where(...)` は中身ごと削除し、`:is(...)` `:not(...)` `:has(...)` は引数をカンマで分割して再帰的に計算し最大値を足す。疑似要素は `::` の2文字で先に判定し、残った `:` を疑似クラスとして扱う。
3. 実装の要点: 詰まりやすいのは疑似要素と疑似クラスの取り違えで、`::before` を先に取り除かないと class 側へ数えてしまう。比較は important・inline・id・class・type の順に並べた配列を先頭から見て、最初に差が出た桁で決める。

**本番利用時の警告**

- この実装は正規表現によるセレクタ解析であり、CSSの完全な文法 (エスケープ、ネスト、条件付きルール) を扱わない。実際のスタイル適用の根拠として使うとDevToolsの表示とずれる
- 詳細度の競合を `!important` で解決する運用は、後から上書きする手段が無くなり保守を難しくする。詳細度を上げずに済む構造を選ぶ

**導線**

- 開始地点: `css-specificity.ts`
- 模範解答: `css-specificity.solution.ts`

### 4.5 課題4.5: ESM と CommonJS の混在問題を再現 (★)

**目的**: Node.js の require / import の違いを実演し、なぜ問題が起きるか理解する。

**難易度**: ★

**推定時間**: 45分 (一時ディレクトリと2パッケージの用意に15分、4通りの組み合わせの実行に15分、エラー種別の記録と説明に15分)

**必要サービス**: なし

**前提**

- 4.6 モジュールシステムの進化 を読み、CommonJSの実行時解決とESMの静的解析の違いを説明できる
- Node.js 24 系が入っており、`node <ファイル>` で `.js` `.mjs` `.cjs` を実行できる
- `package.json` の `type` フィールドが拡張子の解釈を変えることを知っている

**完成条件 (自己採点用チェックリスト)**

- [ ] `"type": "module"` のディレクトリと `"type": "commonjs"` のディレクトリを別々に用意して比較している
- [ ] ESM から import した場合が成功し、ESM 内でグローバル `require` を呼ぶと失敗することを実行結果で示している
- [ ] CJS から require した場合が成功し、`.cjs` の中で静的 import を書くと構文エラーになることを示している
- [ ] ESM から CJS を default import すると `module.exports` 全体が渡ることを確認している
- [ ] 4つ以上の組み合わせについて、成功か失敗かとエラーの種類 (ReferenceError か SyntaxError か) を記録している

**期待出力**

- ESM の `import value, { foo } from './value.js'` が `esm default esm named` の1行を出力する
- ESM 内で `require('./value.js')` を実行すると `ReferenceError: require is not defined in ES module scope` が出て非0で終了する
- `.cjs` 内の静的 import は `SyntaxError: Cannot use import statement outside a module` になる
- ESM から `.cjs` を default import すると `module.exports` のオブジェクトが渡り、そのプロパティを参照できる
- スクリプトは失敗ケースでも停止せず `exit=N (expected failure for this case)` を出して次のケースへ進む

**観察項目**

- エラー種別が実行時の ReferenceError と解析時の SyntaxError に分かれることを見て、ESMの解決が実行前に行われることを確認する
- CJS の名前付きエクスポートをESMから named import できる場合とできない場合を試し、Node.jsの静的解析による推測に依存すると分かる
- `package.json` から `type` を削除して同じスクリプトを動かし、`MODULE_TYPELESS_PACKAGE_JSON` の警告が出たうえで ES module として解釈されることを確認する。Node.js は import/export の有無から構文を判定するようになったため、`type` を消しても CommonJS へは倒れない。CommonJS を明示するには `"type": "commonjs"` を書くか、拡張子を `.cjs` にする
- ESM 内では `__dirname` と `require` が未定義であることを確認し、`import.meta.url` での代替を試す

**テスト方法 (自己採点手順)**

1. `bash code/ch04/esm-vs-cjs/solution/main.sh` を実行し、5つのケースが順に走って成功ケースの出力と失敗ケースの `exit=` 表示が出れば再現できている
2. 出力に `ReferenceError: require is not defined` と `Cannot use import statement outside a module` の両方が含まれることを確認する
3. `pnpm --filter @handbook/ch04 run test` を実行し、第4章の教材ファイル検証が通ることを確認する
4. 自分の記録が本文の3つの問い (CJSがimportを使う、ESMがrequireを使う、`module.exports = { foo }` と `export const foo` の互換性) すべてに答えていれば合格とする

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 再現は一時ディレクトリで行う。既存プロジェクトの `package.json` を書き換えると他の課題まで壊れるので、`mktemp -d` で作った場所へ小さな2つのパッケージを置く。
2. 構造: esm 側に `{"type":"module"}`、cjs 側に `{"type":"commonjs"}` を書き、両方に同じ意味のモジュールを `export const` と `module.exports` で用意する。呼び出し側を4通り作り、`node` で順に実行する。
3. 実装の要点: 失敗するケースがあるためスクリプトを `set -e` のままにすると途中で止まる。各実行をラッパー関数で包み、非0終了でも終了コードを表示して次のケースへ進むようにする。ESMからCJSを読むときは named import ではなく default import から始めると挙動が安定する。

**本番利用時の警告**

- Node.jsのバージョンによってCJSとESMの相互運用の挙動 (ESMをrequireできるか、named exportの推測精度) が変わる。ここで観察した結果を全バージョン共通の仕様として扱わない
- 拡張子や `type` を明示せず暗黙の判定に頼ったまま公開パッケージを配ると、利用側の環境でだけ壊れる。配布時は `exports` フィールドで入口を明示する

**導線**

- 開始地点: `esm-vs-cjs/starter/main.sh`
- 模範解答: `esm-vs-cjs/solution/main.sh`、`esm-vs-cjs/solution.md`

## 評価方法

1. starterから開始し、本文の要件と課題詳細の完成条件を満たす。
2. 期待出力・観察項目を記録する。
3. 完成条件のチェックリストで自己採点し、未達項目を残す。
4. solutionとの差分を説明する。
5. `pnpm --filter @handbook/ch04 run test` を実行する。

## 安全上の注意

- 脆弱性・ネットワーク・OS・コンテナの演習は、localhostまたは隔離環境だけで実行してください。
- 教材用の簡略実装をそのまま本番へ投入しないでください。
- 各課題の「本番利用時の警告」を読まずに、演習コードを製品コードへ流用しないでください。

## 配布対象外

`node_modules/`、`dist/`、`coverage/`、一時DB、秘密情報、計測生成物は配布対象外です。
