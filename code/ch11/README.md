# 第11章 Webフレームワーク設計論 — コード教材

## 前提環境

- Node.js 24.18.0 LTS
- pnpm 11.15.1
- TypeScript 6.0.3

## 共通コマンド

```bash
pnpm install
pnpm --filter @handbook/ch11 run lint
pnpm --filter @handbook/ch11 run typecheck
pnpm --filter @handbook/ch11 run test
pnpm --filter @handbook/ch11 run build
```

> `solution` は要件一覧ではなく、実行・観察できる模範実装でなければなりません。`referenceArtifact` や `model answer scaffold` は検証エラーになります。

## 課題一覧

| 課題 | 開始地点 | 模範解答 | 難易度 | 推定時間 | 必要サービス |
|---|---|---|---:|---:|---|
| 11.1 課題11.1: Express風APIの最小サブセットを持つフレームワーク (★★★) | `mini-express.ts` | `mini-express.solution.ts` | ★★★ | 150分 | なし |
| 11.2 課題11.2: ミドルウェアパターンの比較実装 (★★) | `middleware-patterns.ts` | `middleware-patterns.solution.ts` | ★★ | 90分 | なし |
| 11.3 課題11.3: DI コンテナを自作 (★★★) | `di-container.ts` | `di-container.solution.ts` | ★★★ | 150分 | なし |
| 11.4 課題11.4: ルーティングの Trie ベース実装 (★★) | `trie-router.ts` | `trie-router.solution.ts` | ★★ | 90分 | なし |

## 課題詳細

### 11.1 課題11.1: Express風APIの最小サブセットを持つフレームワーク (★★★)

**目的**: 本書 11.2 のミニ Express を拡張して、実プロダクトで使える完成度にする。

**難易度**: ★★★

**推定時間**: 150分 (ルータとミドルウェア統合の実装60分、ボディパースとエラー処理40分、静的配信と非同期例外の自動キャッチ30分、テストと手動確認20分)

**必要サービス**: なし

**前提**

- 11.2 100行で作る Express 風フレームワーク を読み、ルータ・ミドルウェア・レスポンス送出の責務分担を確認する
- 2.8 実装例: Node.jsで生のHTTPサーバを書く を読み、http.createServer のリクエストとレスポンスを扱えるようにする
- 課題11.2 と 課題11.4 を先に終え、runOnion と TrieRouter を利用できる状態にする
- TypeScript の async 関数と for await ... of でリクエストストリームを読める

**完成条件 (自己採点用チェックリスト)**

- [ ] `app.get(path, handler)` と `app.post(path, handler)` でルートを登録でき、`/users/:id` の値が params から取れる
- [ ] `app.use(middleware)` で登録したミドルウェアが登録順に実行され、next() の後の処理も走る
- [ ] content-type が application/json のPOSTでボディがパースされ、ハンドラから参照できる
- [ ] 未登録パスへの要求が 404 と error キーを持つJSONを返す
- [ ] ハンドラが投げた例外がエラーハンドラへ渡り、レスポンスが 500 と error キーのJSONになる
- [ ] listen(0) が実際に割り当てられたポート番号と close() を返す

**期待出力**

- `GET /users/7` が 200 と id に 7 を持つJSONを返し、content-type が application/json; charset=utf-8 になる
- ミドルウェアで設定したカスタムヘッダ (例 x-middleware) がレスポンスに現れる
- `POST /echo` にJSONを送ると同じJSONがそのまま返る
- 存在しないパスは HTTP 404 を返す

**観察項目**

- ミドルウェアの `await next()` の前後にログを置き、外側から内側、内側から外側の順に出力されることを確認する
- ハンドラの戻り値が文字列・Buffer・オブジェクトの場合で content-type の付き方が変わることを見る
- ボディサイズ上限を小さくして大きなJSONを送り、body_too_large が例外経路へ流れることを確認する
- 同じミドルウェアで next() を2回呼び、二重呼び出しが検出されることを見る

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch11 run test` を実行し、テスト `MiniExpress handles middleware, JSON body, routes, and 404` がパスすることを確認する
2. `pnpm --filter @handbook/ch11 run typecheck` を実行し、型エラーが0件であることを確認する
3. サーバを起動して `curl -i -X POST -H 'content-type: application/json' --data '{}' http://127.0.0.1:PORT/echo` を実行し、200 とJSONが返れば合格
4. `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:PORT/missing` が 404 を返すことを確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 1リクエストにつき1つのコンテキストオブジェクトを作り、ルータもミドルウェアも「コンテキストを書き換える関数」に統一する。そうするとレスポンス送出を1か所へまとめられる。
2. 構造: ミドルウェア列の末尾にルーティング用の関数を足し、runOnion を1回呼ぶ構成にする。ボディパースは for await でチャンクを集めて JSON.parse する。ポート待ちは once(server, 'listening') を使う。
3. 実装の要点: レスポンスを書くのは res.writableEnded が false のときだけにする。エラーハンドラと通常経路の双方が書き込むと ERR_STREAM_WRITE_AFTER_END になる。ボディ読み取りには必ずバイト数上限を設ける。

**本番利用時の警告**

- この自作フレームワークは HEAD/OPTIONS、Expect: 100-continue、圧縮、Keep-Alive調整、リクエストタイムアウトを実装していない。そのまま公開すると仕様非準拠とハングした接続の滞留を招く。
- 静的ファイル配信を足すときはパス正規化を必ず行う。`..` を含むパスをそのまま結合すると、ディレクトリトラバーサルで公開ディレクトリ外のファイルが読み出される。
- エラー時に例外オブジェクトをそのままJSONへ入れると、スタックトレースと内部パスが外部へ漏れる。本番ではrequest IDだけ返し、詳細はログ側に残す。

**導線**

- 開始地点: `mini-express.ts`
- 模範解答: `mini-express.solution.ts`

### 11.2 課題11.2: ミドルウェアパターンの比較実装 (★★)

**目的**: Onion(Koa 風) と Chain(Express 風) の違いを実装で理解する。

**難易度**: ★★

**推定時間**: 90分 (Chain版とOnion版の実装40分、実行順ログの比較と計測ミドルウェア追加30分、二重呼び出しなど失敗系の確認20分)

**必要サービス**: なし

**前提**

- 11.6 ミドルウェアの仕組み ― Onion vs Chain を読み、2方式の実行順の違いを確認する
- 11.1 「ミドルウェア」というアイディア を読み、横断関心事をどこへ置くかの前提を持つ
- async/await と Promise の解決順を追える
- Node.js 24 系と tsx で TypeScript を直接実行できる

**完成条件 (自己採点用チェックリスト)**

- [ ] runChain(middlewares, context) と runOnion(middlewares, context) の2関数を実装する
- [ ] Chain版は同期の next()、Onion版は await next() を受け取る型定義になっている
- [ ] Onion版の実行ログが 1 before / 2 before / 2 after / 1 after の順になる
- [ ] 同じミドルウェア内で next() を2回呼ぶと `next() called more than once` が投げられる
- [ ] 所要時間計測ミドルウェアを Onion で書き、await next() の直後に下流全体の経過時間が取れる

**期待出力**

- Chain の実行ログが a-before / b / a-after の3要素配列になる
- Onion の実行ログが a-before / b-before / b-after / a-after の4要素配列になる
- middleware-patterns.solution.ts を直接実行すると chainLog と onionLog を含むオブジェクトが1回出力される

**観察項目**

- Chain版で next() の後に非同期処理を置き、下流の完了を待たずに実行されてしまうことを確認する
- 計測ミドルウェアを Chain と Onion の両方で書き、Chain では下流の非同期完了時刻を取れないことを見る
- 二重呼び出し検出を外して next() を2回呼び、下流が2度実行されることを再現する
- ミドルウェアの登録順を入れ替え、ログの入れ子構造が対応して変わることを見る

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch11 run test` を実行し、テスト `chain and onion execution orders are observable` がパスすることを確認する
2. `pnpm --filter @handbook/ch11 exec tsx middleware-patterns.solution.ts` を実行し、chainLog が3要素、onionLog が4要素で出力されれば合格
3. 下流で50ms待つハンドラを置いた計測ミドルウェアを Onion に追加し、記録値が50ms以上になることを確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: どちらの方式も「i番目を呼ぶ関数」を再帰的に組み立てるだけで書ける。違いは next() が Promise を返して待てるかどうかだけ、という点に注目する。
2. 構造: dispatch(i) を定義し、i番目のミドルウェアへ `() => dispatch(i + 1)` を渡す。Onion版は dispatch を async にして await する。呼び出し済みの位置を変数へ記録しておく。
3. 実装の要点: 二重呼び出しの検出は「今回の位置が記録済み位置以下なら throw」の1行で足りる。これが無いと next() を2回呼んだミドルウェアが下流を2度実行し、レスポンスを二重送信する。

**本番利用時の警告**

- この最小実装は例外がどのミドルウェアで発生したかを記録しない。そのまま運用に載せると障害時の切り分けができないため、本番ではrequest IDと各段の開始・終了・例外をログに残す。
- Onion 方式は await next() の後にも処理が続くため、レスポンス送出後の後処理で失敗しても利用者へは伝わらない。後処理の例外を握り潰さない設計が要る。

**導線**

- 開始地点: `middleware-patterns.ts`
- 模範解答: `middleware-patterns.solution.ts`

### 11.3 課題11.3: DI コンテナを自作 (★★★)

**目的**: NestJS や Angular で使われる DI コンテナの中身を実装する。

**難易度**: ★★★

**推定時間**: 150分 (Container本体の実装50分、provider3種とスコープの追加40分、循環依存検出とモック差し替えのテスト40分、型パラメータの整理20分)

**必要サービス**: なし

**前提**

- 11.7 依存性注入 (DI) とテスタビリティ を読み、生成と利用を分離する目的を確認する
- 11.5 NestJS ― エンタープライズ志向 を読み、provider、token、scope の語彙を把握する
- TypeScript のクラス、static プロパティ、ジェネリクスを読み書きできる
- Map を使ったレジストリと再帰的な解決処理を書ける

**完成条件 (自己採点用チェックリスト)**

- [ ] `container.bind(Klass)` で登録し `container.get(Klass)` でインスタンスを取得できる
- [ ] 依存を宣言したクラスがコンストラクタ引数として自動注入される
- [ ] 同じトークンを2回 get すると同一インスタンスが返る
- [ ] useValue / useFactory / useClass の3種類の provider を受け付ける
- [ ] 循環依存を検出し、解決経路を矢印で連結した `Circular dependency:` の例外を投げる
- [ ] 未登録トークンの get で `No provider for ...` を投げる

**期待出力**

- 依存先のメソッド呼び出し結果 (例 Alice を含む配列) が注入先から取得できる
- `container.get(Service) === container.get(Service)` が true になる
- 循環依存を作ると、解決経路を含む例外メッセージが表示される
- 未登録トークンでは例外メッセージにトークン名が含まれる

**観察項目**

- clear() の前後で get が返すインスタンスを比較し、シングルトンキャッシュの寿命を確認する
- useValue でモックへ差し替え、本体コードを変えずにテストが通ることを見る
- 解決中トークンの一覧を出力し、深い依存グラフでの解決順を追う
- 依存宣言を書き忘れたクラスを get したときのエラー文言が原因特定に足りるかを評価する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch11 run test` を実行し、テスト `DI container resolves explicit dependencies and detects cycles` がパスすることを確認する
2. 互いを依存に持つ2クラスを登録して get を呼び、Circular dependency の例外が投げられれば合格
3. `pnpm --filter @handbook/ch11 run typecheck` を実行し、bind と get の型パラメータが崩れていないことを確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: コンテナは「トークンから生成方法へのMap」と「トークンから生成済み値へのMap」の2枚で表せる。まず値を返すだけの provider を通し、その後にクラス生成を足す。
2. 構造: provider を useValue / useFactory / useClass の判別可能なユニオンにし、get の中で in 演算子で分岐する。依存一覧は static inject か deps から取り、map した結果を new へ展開する。
3. 実装の要点: TypeScript は emitDecoratorMetadata 無しでは実行時にコンストラクタ引数の型を取れないため、依存は static inject などで明示する。解決中トークンは finally で必ず取り除かないと、例外後に偽の循環依存が報告される。

**本番利用時の警告**

- このコンテナは全バインディングを暗黙にシングルトンとして保持する。リクエストごとの状態を持つクラスを登録すると、利用者間でデータが混ざり別ユーザーの情報が見える。
- 文字列トークンでの束縛はタイプミスを実行時まで検出できない。DIで依存を隠すほど、起動時に落ちるべき設定ミスがリクエスト時の500へ変わる。

**導線**

- 開始地点: `di-container.ts`
- 模範解答: `di-container.solution.ts`

### 11.4 課題11.4: ルーティングの Trie ベース実装 (★★)

**目的**: ルートを登録順に線形探索する実装と、パスセグメントをTrie/Radix Treeで共有する実装を比較する。探索量は実装により、前者は最悪時に登録ルート数、後者は主にパス長・分岐数に依存する。

**難易度**: ★★

**推定時間**: 90分 (Trie構築とmatchの実装40分、ワイルドカードとバックトラックの対応25分、1000ルートのベンチ作成と比較25分)

**必要サービス**: なし

**前提**

- 11.2 100行で作る Express 風フレームワーク の正規表現ベースのルーティングを読む
- 11.4 Hono ― エッジとマルチランタイム を読み、高速ルータが何を前提に速いのかを確認する
- Map と再帰関数でツリー構造を構築・探索できる
- performance.now() で処理時間を計測できる

**完成条件 (自己採点用チェックリスト)**

- [ ] `router.add(method, pattern, handler)` で `/users/:id/posts/:postId` のようなパターンを登録できる
- [ ] `router.match('GET', '/users/42/posts/9')` が handler と id=42、postId=9 のパラメータを返す
- [ ] `/assets/*path` のワイルドカードが残りのパス全体を1つのパラメータへ入れる
- [ ] ワイルドカードを末尾以外に置くと `Wildcard must be the final segment` を投げる
- [ ] 1000ルート登録・10000回ルックアップのベンチで、線形走査版と所要時間を比較した数値が出る
- [ ] 未登録のメソッドやパスでは null が返る

**期待出力**

- マッチ結果が handler と params の2つを持ち、params のキーがパターンの :名前 と一致する
- `/assets/js/app.js` のマッチで path パラメータが js/app.js になる
- ベンチ出力で、登録ルート数を増やしたときTrie版のルックアップ時間の伸びが線形走査版より緩いことが読み取れる
- パーセントエンコードされたセグメントがデコード済みでパラメータに入る

**観察項目**

- 登録ルート数を10、100、1000と増やし、線形走査版が線形に遅くなるのに対しTrie版がほぼ横ばいであることを確認する
- `/users/new` と `/users/:id` を同時に登録し、静的セグメントが優先されることを見る
- バックトラックが起きるパターン (`/a/:b/c` と `/a/x/:d`) を登録し、探索が別枝へ戻る様子をログで追う
- 末尾スラッシュや連続スラッシュを与えたときのセグメント分割結果を確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch11 run test` を実行し、テスト `Trie router extracts parameters and wildcard` がパスすることを確認する
2. 1000ルートを登録するスクリプトを書き、performance.now() でTrie版と線形走査版の10000回ルックアップを測って両方の数値が出れば合格
3. `router.add('GET', '/a/*x/b', handler)` を呼び、Wildcard must be the final segment の例外が出ることを確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: パスを / で分割したセグメント列を木の階層に対応させる。各ノードに「静的な子のMap」「パラメータの子」「ワイルドカードの子」の3種の出口を持たせればよい。
2. 構造: ノードは staticChildren、parameter、wildcard、handlers の4フィールドで表し、handlers はメソッド名をキーにする。match は再帰関数にして、静的一致、パラメータ一致、ワイルドカードの順に試す。
3. 実装の要点: 静的一致を先に試して失敗したらパラメータへ戻る、というバックトラックを実装しないと、`/users/new` と `/users/:id` を同時登録したときに片方が到達不能になる。パラメータ値には decodeURIComponent を掛ける。

**本番利用時の警告**

- このルータはパス長やセグメント数の上限を持たないため、極端に深いパスで再帰が深くなりスタックを消費する。公開前にURL長とセグメント数を入口で制限する。
- ワイルドカードで受けた値をそのままファイルパスへ結合すると、`../` を含む入力でディレクトリトラバーサルが成立する。静的配信に使うなら正規化と配信ルート外の拒否を必ず入れる。

**導線**

- 開始地点: `trie-router.ts`
- 模範解答: `trie-router.solution.ts`

## 評価方法

1. starterから開始し、本文の要件と課題詳細の完成条件を満たす。
2. 期待出力・観察項目を記録する。
3. 完成条件のチェックリストで自己採点し、未達項目を残す。
4. solutionとの差分を説明する。
5. `pnpm --filter @handbook/ch11 run test` を実行する。

## 安全上の注意

- 脆弱性・ネットワーク・OS・コンテナの演習は、localhostまたは隔離環境だけで実行してください。
- 教材用の簡略実装をそのまま本番へ投入しないでください。
- 各課題の「本番利用時の警告」を読まずに、演習コードを製品コードへ流用しないでください。

## 配布対象外

`node_modules/`、`dist/`、`coverage/`、一時DB、秘密情報、計測生成物は配布対象外です。
