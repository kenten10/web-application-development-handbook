# 第8章 ビルドツールとモジュールバンドラ — コード教材

## 前提環境

- Node.js 24.18.0 LTS
- pnpm 11.15.1
- TypeScript 6.0.3

## 共通コマンド

```bash
pnpm install
pnpm --filter @handbook/ch08 run lint
pnpm --filter @handbook/ch08 run typecheck
pnpm --filter @handbook/ch08 run test
pnpm --filter @handbook/ch08 run build
```

> `solution` は要件一覧ではなく、実行・観察できる模範実装でなければなりません。`referenceArtifact` や `model answer scaffold` は検証エラーになります。

## 課題一覧

| 課題 | 開始地点 | 模範解答 | 難易度 | 推定時間 | 必要サービス |
|---|---|---|---:|---:|---|
| 8.1 課題8.1: 最小バンドラを書く (★★★) | `my-bundler/starter/main.sh` | `my-bundler/solution/main.sh` | ★★★ | 150分 | なし |
| 8.2 課題8.2: ツリーシェイキングを観察する (★★) | `tree-shaking/starter/main.sh` | `tree-shaking/solution/main.sh` | ★★ | 90分 | なし |
| 8.3 課題8.3: 簡易 HMR を実装 (★★★) | `mini-hmr/starter/main.ts` | `mini-hmr/solution/main.ts` | ★★★ | 150分 | なし |
| 8.4 課題8.4: コード分割を実装 (★★) | `code-splitting/starter/main.ts` | `code-splitting/solution/main.ts` | ★★ | 90分 | なし |

## 課題詳細

### 8.1 課題8.1: 最小バンドラを書く (★★★)

**目的**: バンドラの本質は「依存グラフを辿って1ファイルにまとめる」こと。これを自作する。

**難易度**: ★★★

**推定時間**: 150分 (依存グラフ構築に45分、モジュール ID 割り当てと出力テンプレート生成に55分、実行確認と循環・重複依存の検証に50分)

**必要サービス**: なし

**前提**

- 8.1 バンドラの基本原理 を読み、依存グラフの構築とモジュール関数への包み込みという2工程を把握しておく
- 4.6 モジュールシステムの進化 を読み、ESM の import と CommonJS の require の違いを説明できる状態にする
- Node.js の `fs` と `path` でファイルを再帰的に読める
- `pnpm --filter @handbook/ch08 run test` が実行できる状態にしておく

**完成条件 (自己採点用チェックリスト)**

- [ ] エントリファイルのパスと出力パスを引数に取るバンドラを書き、`code/ch08/my-bundler/starter/main.sh` から実行できる
- [ ] `import { a } from './b.js'` 形式を解析して依存を再帰的に辿り、同じファイルを2度登録しない
- [ ] 各モジュールへ 0 から始まる整数 ID を振り、依存関係を ID の参照へ書き換える
- [ ] 出力が `require` 関数とモジュールキャッシュを含む単一ファイルになり、エントリの ID から実行が始まる
- [ ] 生成した bundle を `node` で直接実行して期待値が出力される
- [ ] `solutions.test.ts` の import を自分の実装へ向けた状態で `pnpm --filter @handbook/ch08 run test` が全件パスする

**期待出力**

- テスト `minimal bundler builds dependency graph and executable bundle` が pass する
- エントリ1つと依存1つの構成で、バンドル結果のモジュール数が 2 になる
- `bash code/ch08/my-bundler/solution/main.sh` の実行で `bundle-result=42` が標準出力に出る
- 出力ファイルを `node dist/bundle.js` で実行しても、ブラウザで読み込んでも同じ結果になる

**観察項目**

- 生成された bundle を開き、元の `import` 文が `const { add } = require(1);` のような呼び出しへ置き換わっていることを確認する
- 同じモジュールを2箇所から import する構成を作り、モジュール ID が重複せず require キャッシュで2回目の評価が省かれることを確認する
- 循環 import を持つファイルを与え、キャッシュへ空の `module.exports` を先に登録する順序が結果に効くことを確認する
- `export default` や名前空間 import を含むファイルを与え、正規表現ベースの解析が対応できず壊れる境界を記録する

**テスト方法 (自己採点手順)**

1. `bash code/ch08/my-bundler/solution/main.sh` を実行し、`bundle-result=42` が出て終了コードが0なら模範解答の環境は正常
2. `pnpm --filter @handbook/ch08 run test` を実行し、バンドラのテストが pass すれば合格
3. 自作バンドラの出力を `node` で実行し、バンドル前のソースを直接 `node` で実行した結果と標準出力が一致すれば合格

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 処理を「グラフを作る」と「文字列を組み立てる」の2段に完全に分ける。先に依存グラフを配列として作り、正しい ID が振られていることを確認してから出力生成へ進む
2. 構造: `buildGraph(entry)` で `{ id, file, source, dependencies }` の配列を作り、訪問済みファイルは `Map<絶対パス, id>` で管理する。出力は IIFE の中に `require` とキャッシュを置き、モジュール本体を `id: (require, module, exports) => { ... }` の形で並べる
3. 実装の要点: 訪問中のファイルの ID は、依存を辿る前に Map へ登録しておく。あとから登録すると循環 import で無限再帰する。相対指定の解決では拡張子なし、`.js` 付き、`index.js` の3候補を順に試す

**本番利用時の警告**

- 正規表現ベースの import 解析は文字列リテラルやコメント内の import も拾い、動的 import や `export *` を扱えない。実プロジェクトへ向けると壊れた出力を無言で生成するため、本番では acorn などの正式なパーサを使う
- この出力は source map を持たないため、バンドル後のスタックトレースが元のファイル位置と対応しない。本番ビルドで source map を省くと障害調査ができなくなる

**導線**

- 開始地点: `my-bundler/starter/main.sh`
- 模範解答: `my-bundler/solution/main.sh`

### 8.2 課題8.2: ツリーシェイキングを観察する (★★)

**目的**: 「使わないコードが消える」とはどういうことか、実物を見る。

**難易度**: ★★

**推定時間**: 90分 (実験用モジュールと入口の作成に20分、除去処理と grep 判定の実装に35分、CJS 比較と副作用ケースの観察、回答の記述に35分)

**必要サービス**: なし

**前提**

- 8.5 ツリーシェイキング を読み、静的解析可能な ESM が前提であることを把握しておく
- 8.3 esbuild と SWC ― ネイティブ実装の衝撃 を読み、比較対象となるツールの立ち位置を確認しておく
- `bash` と `node` が使え、`code/ch08/tree-shaking/solution/main.sh` を実行できる

**完成条件 (自己採点用チェックリスト)**

- [ ] 複数の export を持つモジュールを用意し、そのうち1つだけを named import する入口ファイルを作る
- [ ] 未使用 export が出力から消えることを、`grep` による存在確認で二値判定している
- [ ] 除去前後のバイト数を計測し、削減バイト数を記録している
- [ ] 生成物を `node` で実行して、残した関数の結果が正しいこと (例: 期待値 42) を確認している
- [ ] ESM と CJS の差、副作用コードが消えない理由、`"sideEffects": false` の役割の3点について、観察に基づく回答をメモに書いている

**期待出力**

- `before=`、`after=`、`removed=` の3つの数値を含む1行が出力され、removed が正の値になる
- `tree-shaken-result=42` が標準出力に出る
- 出力ファイルに対する `grep -q 'unusedLargeFeature'` が不一致 (終了コード1) になる
- テスト `tree shaker removes unused exported functions` が pass する

**観察項目**

- 未使用関数の中から `console.log` などの副作用を呼び出す形へ書き換え、除去の判断が変わるかを確認する
- 同じモジュールを `module.exports` 形式 (CJS) へ書き換え、静的解析で使用箇所を特定できなくなる様子を確認する
- `npx --yes esbuild src/index.js --bundle --outfile=out/esbuild.js --minify` をネットワークが使える環境で実行し、自作除去と実ツールの出力サイズを比べる
- エントリ側の import を `import * as lib from './library.js'` へ変え、名前空間 import でシェイクされにくくなることを確認する

**テスト方法 (自己採点手順)**

1. `bash code/ch08/tree-shaking/solution/main.sh` を実行し、`tree-shaken-result=42` が出て終了コードが0なら模範解答は正常に動いている
2. `pnpm --filter @handbook/ch08 run test` を実行し、tree shaker のテストが pass すれば合格
3. 自作版の出力に対して `grep -c 'unusedLargeFeature'` を実行し、結果が 0 なら未使用 export の除去に成功している

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 「消えるかどうか」を目視ではなく判定可能な形にする。出力に対する grep の終了コードと、除去前後のバイト数の2つを最初に決めておくと、以降の実験がすべて自動判定になる
2. 構造: 簡易版は `export function name(...) { ... }` にマッチする正規表現でブロックを取り、使用名の集合に含まれなければ空文字へ置換し、含まれれば `export ` だけを外す方針で書ける
3. 実装の要点: この単純な正規表現はネストした波括弧を含む関数本体を正しく取れない。実験用モジュールは1階層の本体に留め、限界に当たった時点で本物のバンドラの AST 解析が必要になる理由を記録する

**本番利用時の警告**

- この簡易シェイカは正規表現で関数ブロックを削るため、文字列やコメントに含まれる波括弧で誤爆し、必要なコードを消したまま気付かない出力を作る。本番ビルドでは必ず実ツールの出力を検証する
- `"sideEffects": false` を実態と異なるパッケージへ設定すると、CSS の import や polyfill が本番ビルドからだけ消え、開発環境では再現しない不具合になる

**導線**

- 開始地点: `tree-shaking/starter/main.sh`
- 模範解答: `tree-shaking/solution/main.sh`

### 8.3 課題8.3: 簡易 HMR を実装 (★★★)

**目的**: HMR の核は「モジュールを差し替え、依存元に再評価させる」だけ。これを自作する。

**難易度**: ★★★

**推定時間**: 150分 (モジュール配信サーバの実装に40分、SSE による更新通知とクライアントスクリプトに55分、差し替え計測とキャッシュ・後始末の検証に55分)

**必要サービス**: なし

**前提**

- 8.7 HMR (Hot Module Replacement) を読み、モジュールの差し替えと状態保持の関係を把握しておく
- 8.4 Vite ― 開発体験の革新 を読み、開発サーバがブラウザへ直接 ESM を配る仕組みを確認しておく
- Node.js の `http` と `fs.watch` でサーバとファイル監視を書ける
- `pnpm --filter @handbook/ch08 run test` が実行できる状態にしておく

**完成条件 (自己採点用チェックリスト)**

- [ ] `code/ch08/mini-hmr/starter/main.ts` に HTTP サーバを実装し、`/module.js` で対象モジュールのソースを `text/javascript` として配信する
- [ ] 更新通知用のエンドポイント (`/events` の Server-Sent Events もしくは WebSocket) を持ち、接続中のクライアントを集合で管理する
- [ ] `fs.watch` でファイル変更を検知し、接続中の全クライアントへ更新メッセージを送る
- [ ] クライアントスクリプトが `import(url + '?t=' + timestamp)` で新しいモジュールを取り込み、`location.reload` を一切呼ばない
- [ ] サーバの `close()` で監視とリスナーを解放し、テスト実行後にプロセスが残らない
- [ ] `solutions.test.ts` の import を自分の実装へ向けた状態で `pnpm --filter @handbook/ch08 run test` が全件パスする

**期待出力**

- テスト `HMR server serves module and client avoids full reload` が pass する
- `http://127.0.0.1:<port>/module.js` を fetch すると、監視対象ファイルの中身がそのまま返る
- クライアントスクリプトの文字列に `EventSource` が含まれ、`location.reload` が含まれない
- ファイル保存のたびにブラウザのコンソールへ `hmr-ms` と所要ミリ秒が出力される

**観察項目**

- `hmr-ms` の値とページ全体をリロードしたときの読み込み時間を比べ、差し替えの方が短いことを実測で確認する
- 動的 import のクエリ文字列 (`?t=`) を外して保存し、モジュールキャッシュが効いて古いコードが実行され続けることを確認する
- 更新前のモジュールが持っていたカウンタなどの状態が、差し替え後にリセットされることを確認して状態保持の難しさを記録する
- レスポンスヘッダの `Cache-Control: no-store` を外し、ブラウザキャッシュによって更新が届かなくなる様子を Network タブで確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch08 run test` を実行し、HMR のテストが pass すれば合格
2. 監視対象の小さなモジュールを1つ用意し、`pnpm --filter @handbook/ch08 exec tsx mini-hmr/solution/main.ts <モジュールのパス>` で起動して、表示された URL をブラウザで開ける
3. 開いたページを見たままエディタでモジュールを保存し、リロードなしで描画が変わり `hmr-ms` がコンソールへ出れば合格
4. サーバを Ctrl+C で止めたあと `lsof -i :3001` などで待ち受けが残っていなければ、後始末が正しい

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 配信・通知・差し替えの3つを混ぜない。まず `/module.js` を返すだけのサーバを立て、ブラウザから読めることを確認してから通知経路を足す
2. 構造: 通知は WebSocket でなくても Server-Sent Events で足りる。`text/event-stream` のレスポンスを開いたまま `Set<ServerResponse>` に保持し、変更時に `data: {json}` を書き込む。クライアント側は `EventSource` の onmessage で動的 import する
3. 実装の要点: 動的 import は URL 単位でキャッシュされるため、必ず `?t=` にタイムスタンプを付けて別 URL にする。加えて `fs.watch` は1回の保存で複数回発火する環境があるので、短時間の重複通知を無視する処理が要る

**本番利用時の警告**

- この開発サーバはパスの検証を持たず、監視対象以外のファイルを返す実装へ広げるとディレクトリトラバーサルでソースや秘密情報を配信してしまう。必ず localhost バインドのまま開発時だけ使う
- モジュールを差し替えても古いモジュールのクロージャやイベントリスナーは解放されない。本番ビルドに HMR ランタイムを含めると、メモリリークと二重登録を抱えたコードを配布することになる

**導線**

- 開始地点: `mini-hmr/starter/main.ts`
- 模範解答: `mini-hmr/solution/main.ts`

### 8.4 課題8.4: コード分割を実装 (★★)

**目的**: 動的 import がどう動くか、bundler がどう分割するかを観察する。

**難易度**: ★★

**推定時間**: 90分 (ローダとキャッシュの実装に30分、重いモジュールの動的 import 化と計測に35分、Network タブ観察と失敗系の確認に25分)

**必要サービス**: なし

**前提**

- 8.6 コード分割 (Code Splitting) を読み、動的 import がチャンク境界になる理由を把握しておく
- 5.4 非同期処理の進化 を読み、同じ Promise を共有して二重実行を避ける書き方を確認しておく
- `pnpm --filter @handbook/ch08 run test` が実行できる状態にしておく

**完成条件 (自己採点用チェックリスト)**

- [ ] `code/ch08/code-splitting/starter/main.ts` にルートごとの動的 import を登録するローダを実装する
- [ ] 同じルートを同時に2回要求してもチャンクの読み込みが1回で済み、2回目以降はキャッシュ済みの Promise を返す
- [ ] 未登録のルートを要求したとき、ルート名を含むエラーを投げる
- [ ] 読み込みにかかったミリ秒を計測して結果へ含める
- [ ] 重いモジュール (例: 大きな配列を持つ admin ルート) を静的 import から動的 import へ切り替え、初期に読み込むコード量が減ったことを計測している
- [ ] `solutions.test.ts` の import を自分の実装へ向けた状態で `pnpm --filter @handbook/ch08 run test` が全件パスする

**期待出力**

- テスト `code splitting loader loads once and caches chunk` が pass する
- 同じルートへ同時2件のリクエストを出したとき、ローダ関数の呼び出し回数が 1 になる
- `navigate('/admin')` の戻り値に `Admin chunk` と `loaded in <数値> ms` が含まれる
- 初回の読み込みミリ秒より、2回目の呼び出しのミリ秒が明確に小さくなる

**観察項目**

- キャッシュを外した版に変え、同時2件のリクエストでローダが2回呼ばれることを確認する
- ブラウザ向けにビルドした場合の Network タブで、初期ロードのファイル一覧に admin 相当のチャンクが含まれず、操作後に別リクエストとして現れることを確認する
- `await import()` を条件分岐の中に置いた場合と最上位に置いた場合で、初期バンドルに含まれる内容が変わることを確認する
- 動的 import 中にネットワークを切り、失敗した Promise がキャッシュへ残るとリトライできなくなる問題を再現する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch08 run test` を実行し、コード分割のテストが pass すれば合格
2. `pnpm --filter @handbook/ch08 run typecheck` を実行し、`RouteModule` と `RouteLoader` の型でエラー0件なら合格
3. 存在しないルートで `navigate('/nope')` を呼び、`Unknown route: /nope` を含むエラーが投げられれば合格
4. ブラウザの Network タブでチャンクが操作時に初めて要求され、初期 HTML の読み込み時には現れなければ分割が効いている

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 分割の単位を先に決める。ルート単位が最も分かりやすい。まずルート名からローダ関数を引く素の Map を作り、キャッシュは後から足す
2. 構造: `createRouteLoader(routes)` が `Map<string, Promise<RouteModule>>` を閉じ込めた関数を返す形にする。ローダの戻り値ではなく Promise 自体をキャッシュすると、同時要求の重複が自然に消える
3. 実装の要点: 失敗した Promise をキャッシュに残すと、一時的なネットワークエラーで永久にそのルートが開けなくなる。catch でキャッシュから削除する処理を入れるかどうかを意識的に決める

**本番利用時の警告**

- 動的 import に失敗した場合のリトライとフォールバック UI が無いと、デプロイでハッシュ付きチャンク名が変わった瞬間に、開きっぱなしの古いタブから新しいチャンクを取得できず画面が壊れる
- 細かく分割しすぎるとリクエスト数と往復遅延が増え、分割前より遅くなる。分割は必ず実測 (初期転送量と操作までの時間) で効果を確認してから採用する

**導線**

- 開始地点: `code-splitting/starter/main.ts`
- 模範解答: `code-splitting/solution/main.ts`

## 評価方法

1. starterから開始し、本文の要件と課題詳細の完成条件を満たす。
2. 期待出力・観察項目を記録する。
3. 完成条件のチェックリストで自己採点し、未達項目を残す。
4. solutionとの差分を説明する。
5. `pnpm --filter @handbook/ch08 run test` を実行する。

## 安全上の注意

- 脆弱性・ネットワーク・OS・コンテナの演習は、localhostまたは隔離環境だけで実行してください。
- 教材用の簡略実装をそのまま本番へ投入しないでください。
- 各課題の「本番利用時の警告」を読まずに、演習コードを製品コードへ流用しないでください。

## 配布対象外

`node_modules/`、`dist/`、`coverage/`、一時DB、秘密情報、計測生成物は配布対象外です。
