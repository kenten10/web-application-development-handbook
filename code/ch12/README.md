# 第12章 API設計 — コード教材

## 前提環境

- Node.js 24.18.0 LTS
- pnpm 11.15.1
- TypeScript 6.0.3

## 共通コマンド

```bash
pnpm install
pnpm --filter @handbook/ch12 run lint
pnpm --filter @handbook/ch12 run typecheck
pnpm --filter @handbook/ch12 run test
pnpm --filter @handbook/ch12 run build
```

> `solution` は要件一覧ではなく、実行・観察できる模範実装でなければなりません。`referenceArtifact` や `model answer scaffold` は検証エラーになります。

## 課題一覧

| 課題 | 開始地点 | 模範解答 | 難易度 | 推定時間 | 必要サービス |
|---|---|---|---:|---:|---|
| 12.1 課題12.1: OpenAPI からサーバスタブを生成 (★★) | `openapi-codegen/starter/main.ts` | `openapi-codegen/solution/main.ts` | ★★ | 90分 | なし |
| 12.2 課題12.2: GraphQL Resolver の N+1 を解決 ― DataLoader 自作 (★★★) | `dataloader.ts` | `dataloader.solution.ts` | ★★★ | 150分 | なし |
| 12.3 課題12.3: 型安全 RPC (tRPC 風) を自作 (★★★) | `typed-rpc/starter/main.ts` | `typed-rpc/solution/main.ts` | ★★★ | 150分 | localhost |
| 12.4 課題12.4: WebSocket でリアルタイム pub/sub (★★) | `websocket-chat/starter/main.ts` | `websocket-chat/solution/main.ts` | ★★ | 90分 | なし |
| 12.5 課題12.5: SSE でサーバプッシュ通知 (★) | `sse-push/starter/main.sh` | `sse-push/solution/main.sh`<br>`sse-push/solution/server.mjs` | ★ | 45分 | なし |
| 12.6 課題12.6: 再開可能アップロードの中断を再現して直す (★★★) | `resumable-upload/starter/main.ts` | `resumable-upload/solution/main.ts`<br>`resumable-upload/solution/report.ts` | ★★★ | 150分 | なし |

## 課題詳細

### 12.1 課題12.1: OpenAPI からサーバスタブを生成 (★★)

**目的**: OpenAPI 仕様を読み込んで、TypeScript のサーバスケルトンを自動生成する仕組みを作る。

**難易度**: ★★

**推定時間**: 90分 (スキーマ変換関数の実装35分、操作ごとの出力組み立て30分、$refとoptionalの対応および生成物の確認25分)

**必要サービス**: なし

**前提**

- 12.6 OpenAPI ― API設計の標準仕様 を読み、paths、components、$ref の構造を確認する
- 12.3 リソース指向設計の実践 を読み、パスとリソースの対応を把握する
- Zod のスキーマ表記 (z.object、z.coerce.number など) を読める
- Node.js の fs でファイルを読み、標準出力へ文字列を書ける

**完成条件 (自己採点用チェックリスト)**

- [ ] OpenAPI ドキュメントを読み込み、components.schemas の各定義を Zod のスキーマ定数と型エイリアスへ変換して出力する
- [ ] path とメソッドの組ごとに Params 用スキーマを出力し、required でないパラメータには optional を付ける
- [ ] requestBody を持つ操作は Body 用スキーマも出力する
- [ ] 生成される関数が export async function の形で、本体が未実装を示す例外を投げる
- [ ] $ref が指すスキーマ名へ解決され、参照先が z.unknown() へフォールバックしない
- [ ] string / integer / number / boolean / array / object のいずれの type でも対応する式を出力する

**期待出力**

- 生成物の先頭行が zod の import 文になる
- User スキーマから UserSchema の定義と User 型エイリアスの2行が出力される
- getUser 操作から getUserParamsSchema と getUser 関数が出力される
- 未実装の本体が `GET /users/{id} is not implemented` の形式のメッセージで例外を投げる

**観察項目**

- required に含まれないプロパティへ optional が付くことを生成物で確認する
- パスパラメータの integer が z.coerce.number().int() へ変換される理由 (URLからは常に文字列で届く) を確認する
- operationId を消したとき、メソッド名とパスから識別子が組み立てられることを見る
- 同じスキーマを2つの操作で参照し、$ref が重複定義ではなく共有名として出力されることを確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch12 run test` を実行し、テスト `OpenAPI generator emits Zod schemas and typed handler` がパスすることを確認する
2. JSON構文の OpenAPI ファイルを用意し `pnpm --filter @handbook/ch12 exec tsx openapi-codegen/solution/main.ts 入力ファイル` を実行して、標準出力に Zod 定義と関数が並べば合格
3. 第2引数に出力先を渡して .ts を生成し、`grep -c 'z.object' 出力ファイル` が1以上を返すことを確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 生成器は「スキーマから文字列を作る再帰関数」を1つ決めれば骨格が固まる。まず type が string だけの版で出力を確認し、そこへ object と array を足す。
2. 構造: schemaExpression(schema) を $ref、プリミティブ、array、object の順に分岐させる。操作名は operationId があればそれ、無ければメソッドとパスから記号を除いてキャメルケース化する。出力は行の配列へ push して最後に連結する。
3. 実装の要点: $ref の値は `#/components/schemas/User` の形なので、スラッシュで分割した末尾だけを取ってスキーマ名へ変換する。この解決を忘れると全ての参照が z.unknown() に落ち、生成コードは通るのに検証が効かない。

**本番利用時の警告**

- 生成したスタブは認証・認可・レート制限・共通エラー形式を一切含まない。仕様に書かれた型だけを信じて公開すると、入力検証は通るが権限のない操作が実行される。
- この例は依存を持たないためJSON構文のYAMLしか読めず、アンカーや複数ドキュメントを含む実仕様書では失敗する。本番では実績のあるYAMLパーサとコード生成ツールを使う。
- 仕様と実装のずれを検知する仕組みが無いため、仕様更新後に再生成しない限り古い検証が残り続ける。CIで生成物の差分を検査する必要がある。

**導線**

- 開始地点: `openapi-codegen/starter/main.ts`
- 模範解答: `openapi-codegen/solution/main.ts`

### 12.2 課題12.2: GraphQL Resolver の N+1 を解決 ― DataLoader 自作 (★★★)

**目的**: GraphQL の最大の罠「N+1 問題」を、DataLoader パターンで解決する。

**難易度**: ★★★

**推定時間**: 150分 (バッチキューとマイクロタスク予約の実装50分、キャッシュとloadManyの追加40分、N+1再現と失敗系テストの作成60分)

**必要サービス**: なし

**前提**

- 12.7 GraphQL ― クライアント主導のクエリ を読み、Resolver がフィールド単位で呼ばれることを確認する
- JavaScript のマイクロタスク (queueMicrotask と Promise の解決順) を説明できる
- Promise を外から解決する (resolve と reject を保持する) 書き方ができる
- Map によるキャッシュと配列によるキュー操作を書ける

**完成条件 (自己採点用チェックリスト)**

- [ ] load(key) が Promise を返し、同一マイクロタスク内の複数呼び出しが1回のバッチ関数呼び出しにまとまる
- [ ] 同じキーで2回 load してもバッチへ渡されるキーは1件だけになる
- [ ] loadMany(keys) が配列を返し、内部では同じバッチへ合流する
- [ ] clear(key) と clearAll() でキャッシュを破棄でき、次の load で再びバッチが走る
- [ ] バッチ関数の戻り値の件数がキー件数と異なる場合に例外を投げる
- [ ] バッチ関数が失敗したとき待機中の全 Promise が reject され、失敗キーがキャッシュに残らない

**期待出力**

- load(1)、load(2)、load(1) を同時に発行すると結果は3件だが、バッチ関数の呼び出し履歴はキー2件の1回だけになる
- clear(1) の後に load(1) すると、バッチ呼び出し履歴が2回になる
- 件数不一致のとき `Batch loader returned N values for M keys` の形式の例外が出る
- N+1 の再現側でクエリ回数が 1+N から 1+1 へ減る

**観察項目**

- N+1 再現コードでSQL相当の呼び出し回数をカウントし、11回から2回へ減ることを数値で確認する
- queueMicrotask を setTimeout へ置き換え、バッチ境界が広がって別リクエスト分まで混ざりうることを確認する
- キャッシュを有効にしたまま更新処理を挟み、古い値が返ることを再現する
- バッチ関数が返す配列の順序を入れ替え、キー順に対応付けないと結果が入れ替わることを見る

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch12 run test` を実行し、テスト `DataLoader batches within a tick, caches, and clears` がパスすることを確認する
2. バッチ関数の受け取ったキーを記録するテストを自分で追加し、10件の load が1回のバッチにまとまることを確認する
3. バッチ関数を意図的に reject させ、待機中の全 load が reject し、その後の load で再度バッチが走ることを確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 呼ばれた瞬間には実行せず、いったんキューへ積むのが核。積んだ後にマイクロタスクを1つだけ予約し、そのタイミングで溜まったキーをまとめて渡す。
2. 構造: キューは key と resolve と reject を持つ要素の配列にする。load の中で new Promise を作って resolve と reject をキューへ入れ、初回だけ queueMicrotask で dispatch を予約する。キャッシュは値ではなく Promise を保持する Map にする。
3. 実装の要点: dispatch の先頭でキューを空配列へ差し替え、予約フラグを戻すこと。忘れるとバッチ実行中に来た load が同じ配列へ混ざり二重解決になる。失敗時はキャッシュからキーを削除しないと、以後ずっと失敗した Promise が返る。

**本番利用時の警告**

- DataLoader のキャッシュはリクエスト単位で捨てる前提の設計であり、アプリ全体で1インスタンスを共有すると別ユーザーの認可済みデータをそのまま返す情報漏洩になる。
- バッチはキー件数の上限を持たないため、1クエリから数万件のキーが集まるとIN句が巨大化してDBを圧迫する。本番では最大バッチサイズと同時実行数を制限する。

**導線**

- 開始地点: `dataloader.ts`
- 模範解答: `dataloader.solution.ts`

### 12.3 課題12.3: 型安全 RPC (tRPC 風) を自作 (★★★)

**目的**: tRPC の魔法「スキーマ言語なしでサーバとクライアントが型共有」の仕組みを実装する。

**難易度**: ★★★

**推定時間**: 150分 (スキーマと型推論の設計40分、HTTPサーバとProxyクライアントの実装50分、検証失敗と型エラーの確認40分、curlでの手動確認20分)

**必要サービス**: localhost

**前提**

- 12.9 tRPC ― TypeScript ネイティブ を読み、スキーマ定義から型が伝播する仕組みを確認する
- 12.1 RESTの設計思想 ― Roy Fielding の博士論文を読み返す を読み、RPCとリソース指向の違いを言えるようにする
- TypeScript の条件型 (infer) とマップ型を読み書きできる
- Proxy と fetch でHTTP呼び出しを組み立てられる

**完成条件 (自己採点用チェックリスト)**

- [ ] input、output、handler を持つ procedure を定義でき、input と output に検証関数を渡せる
- [ ] サーバがポートを listen し、POST でパス名を手続き名として該当 handler を実行する
- [ ] createClient の戻り値から `client.getUser({ id: '7' })` のように型付きで呼べる
- [ ] 入力が型に合わない場合、サーバが 400 と error キーのJSONを返す
- [ ] 未定義の手続き名やGETメソッドは 404 を返す
- [ ] 誤った型の引数を書くと typecheck がエラーになる

**期待出力**

- `client.getUser({ id: '7' })` が id と name を持つオブジェクトを返す
- 型不一致の入力ではクライアント側で Expected string を含むエラーが throw される
- 成功応答に content-type: application/json が付く
- エラー時の本文が error キー1つを持つJSONになる

**観察項目**

- curl で同じエンドポイントを叩き、RPCが普通のHTTP POSTの上に乗っているだけであることを確認する
- output スキーマの検証を外し、handler が返した余計なフィールドがそのまま外部へ出ることを確認する
- エディタ上で client の補完を出し、router の型から手続き名と引数が推論されることを見る
- 存在しない手続き名を呼んだときのステータスと、入力検証失敗のステータスの違いを確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch12 run test` を実行し、テスト `typed RPC validates input and output over HTTP` がパスすることを確認する
2. `pnpm --filter @handbook/ch12 run typecheck` を実行し、型エラーが0件であることを確認する
3. サーバ起動中に `curl -s -X POST -H 'content-type: application/json' --data '{}' http://127.0.0.1:PORT/getUser` を実行し、400 と error を含むJSONが返れば合格

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: サーバ側はURLのパス名を手続き名として router から引くだけで足りる。難しいのは型の受け渡しなので、スキーマ型から入力型を取り出す条件型を先に決めると全体が固まる。
2. 構造: Schema<T> を parse(value: unknown): T を持つ形で定義し、Infer<S> を `S extends Schema<infer T> ? T : never` で書く。クライアントは Proxy の get トラップで手続き名を拾い、fetch へ流す。
3. 実装の要点: handler の戻り値も output の parse に通すこと。入力だけ検証して出力を素通しにすると、内部の余計なフィールドが外部へ漏れる。応答が ok でないときは本文の error を読み直して throw する。

**本番利用時の警告**

- この最小RPCは認証、CSRF対策、レート制限、リクエストサイズ上限を持たない。そのまま公開すると誰でも全手続きを呼び出せる。
- エラーメッセージに検証器の内部文言をそのまま返しているため、公開すると内部のフィールド名や構造が推測される。本番ではエラーコードへ丸める。
- 手続き名をパスからそのままオブジェクトのキーとして引くため、プロトタイプ由来のプロパティへ到達しうる。router を Object.create(null) で作るか、手続き名の許可リストで弾く。

**導線**

- 開始地点: `typed-rpc/starter/main.ts`
- 模範解答: `typed-rpc/solution/main.ts`

### 12.4 課題12.4: WebSocket でリアルタイム pub/sub (★★)

**目的**: WebSocket の生 API でチャット風アプリを作る。ハートビート・再接続・型安全メッセージング。

**難易度**: ★★

**推定時間**: 90分 (メッセージ型と検証の実装25分、フレーム符号化と復号30分、ルーム配信と再接続遅延20分、境界条件のテスト15分)

**必要サービス**: なし

**前提**

- 12.10 WebSocket ― 全二重リアルタイム通信 を読み、HTTP Upgrade とフレーム構造を確認する
- 2.4 ヘッダ ― HTTPの真の主役 を読み、Upgrade と Connection ヘッダの役割を把握する
- Node.js の Buffer でビット演算とXORを扱える
- 判別可能なユニオン型でメッセージを定義できる

**完成条件 (自己採点用チェックリスト)**

- [ ] メッセージ検証関数が join / leave / message / ping / pong の5種を判別し、必須フィールドが欠けた入力で TypeError を投げる
- [ ] テキストフレーム生成関数がFIN付きテキストフレーム (先頭バイト 0x81) を返し、126バイト以上のペイロードを明示的に拒否する
- [ ] クライアントフレーム復号関数がマスクビットを確認し、4バイトのマスクキーでXORを解いて文字列を返す
- [ ] ルーム管理の join が入室通知を配信し、戻り値の関数を呼ぶと退室通知が飛ぶ
- [ ] 同じルームへの publish が全メンバーへ届き、別ルームには届かない
- [ ] 再接続待ち時間が指数的に増え、上限10000ミリ秒で頭打ちになる

**期待出力**

- 文字列 hi のフレームの16進表現が 81026869 になる
- マスク済みクライアントフレームを復号すると元の文字列が返る
- 1人が join したルームで publish すると、その購読者が join と message の2件を受け取る
- 再接続待ち時間が attempt 3 で 2000 になる

**観察項目**

- 生成したフレームの先頭2バイトを16進で見て、FINビット、opcode 1、マスク無しの構成を確認する
- クライアントからサーバへのフレームだけがマスクされる仕様を、マスクビットを落としたフレームが拒否されることで確認する
- ルームのメンバー数を退室前後で比べ、最後の1人が抜けたときにルーム自体が消えることを見る
- 再接続待ち時間を attempt 0 から 10 まで出力し、上限に達する回数を数える

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch12 run test` を実行し、テスト `WebSocket educational primitives frame text and publish by room` がパスすることを確認する
2. 126バイト以上の文字列をフレーム生成関数へ渡し、`Educational frame encoder supports payloads under 126 bytes` の例外が出れば境界処理は合格
3. マスクなしのフレームを復号関数へ渡し、`Invalid educational client frame` が投げられることを確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 配信の仕組みとフレームの符号化を分けて考える。ルームは「ルーム名からメンバーの送信関数への二段Map」で表せ、購読解除は join の戻り値の関数で行うと後始末を忘れにくい。
2. 構造: テキストフレームは先頭バイトが 0x81 (FIN と opcode 1)、2バイト目が長さ。クライアント側フレームは長さの最上位ビットがマスクフラグで、続く4バイトがマスクキー。復号は payload[i] = data[6 + i] とマスク[i % 4] のXOR。
3. 実装の要点: ペイロード長が126以上になると長さフィールドが2バイトまたは8バイトの拡張形式へ変わる。教材実装では126未満に限定して明示的に例外を投げないと、長いメッセージで壊れたフレームを送ってしまう。

**本番利用時の警告**

- この教材実装は Sec-WebSocket-Accept のハンドシェイク検証、Origin検証、認証、フラグメント化フレーム、close frame の処理を持たない。そのまま公開すると任意のサイトから接続され、ルームのメッセージを読まれる。
- ペイロード長と接続数に上限が無く、ping/pong によるアイドル接続の切断も未実装のため、接続を張り続けるだけでメモリとファイルディスクリプタを消費させられる。本番では実績のあるWebSocketライブラリで上限とタイムアウトを設定する。
- 履歴100件をプロセスのメモリに持つ実装は再起動と水平スケールで消える。複数インスタンスへ広げるにはRedisなど外部のpub/subと永続化が要る。

**導線**

- 開始地点: `websocket-chat/starter/main.ts`
- 模範解答: `websocket-chat/solution/main.ts`

### 12.5 課題12.5: SSE でサーバプッシュ通知 (★)

**目的**: WebSocket より軽量な SSE で「サーバから一方向プッシュ」を実装。

**難易度**: ★

**推定時間**: 45分 (SSEサーバの実装20分、Last-Event-IDによる採番15分、curlとブラウザでの確認10分)

**必要サービス**: なし

**前提**

- 12.11 SSE (Server-Sent Events) ― シンプルな単方向プッシュ を読み、イベントストリームの行形式を確認する
- `curl --no-buffer` でストリーミング応答を読める
- Node.js の http.createServer でヘッダを書いてから本文を追記できる
- bash でバックグラウンド起動したサーバのポートを受け取り、trap で後始末できる

**完成条件 (自己採点用チェックリスト)**

- [ ] `/events` が content-type: text/event-stream と cache-control: no-cache を付けて 200 を返す
- [ ] `/events` 以外のパスは 404 を返す
- [ ] stock-update、user-online、notification の3種を event 行で送り分ける
- [ ] 各イベントに id 行を付け、Last-Event-ID ヘッダの値の次から採番する
- [ ] data 行が1行のJSONで、イベント間が空行で区切られる
- [ ] サーバ起動時に待ち受けポート番号が標準出力へ1行出る

**期待出力**

- Last-Event-ID に 40 を指定して要求すると最初のイベントのIDが 41 になる
- 応答本文に event: stock-update、event: user-online、event: notification の3行が現れる
- data 行に symbol と price を含むJSONが1行で入る
- 1イベントが id 行、event 行、data 行の3行と空行1つで構成される

**観察項目**

- `curl -N` の出力を見て、イベントの区切りが空行1つであることを確認する
- Last-Event-ID の値を変えて再要求し、採番が続きから始まることを確認する
- ブラウザの EventSource で接続し、サーバが接続を閉じた後に自動再接続が起きることを DevTools の Network タブで見る
- content-type を text/plain に変えると EventSource が受け付けないことを確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch12 run test` を実行する。テストスクリプトが sse-push/solution/main.sh を実行するため、SSE応答の検査も同時に走る
2. `bash code/ch12/sse-push/solution/main.sh` を単独実行し、id: 41 と3種の event 行がすべて見つかれば合格 (1つでも欠けると grep が失敗して非0終了する)
3. `curl -N -H 'Last-Event-ID: 0' http://127.0.0.1:PORT/events` を実行し、id: 1 から始まる3イベントが表示されることを確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: SSEは特別なプロトコルではなく、text/event-stream を宣言したHTTP応答へ行を書き足していくだけ。まず固定の3イベントを書いて終了する版を作り、そこへID採番を足す。
2. 構造: ヘッダは content-type: text/event-stream、cache-control: no-cache、connection: keep-alive の3つ。1イベントは id 行、event 行、data 行に空行1つを続ける形式で、再開位置は last-event-id ヘッダから取る。
3. 実装の要点: 行の区切りは改行1つ、イベントの終端は空行1つ (つまり改行2つ)。ここを1つ間違えると、接続は成功するのにクライアントはイベントを1つも受け取れない。

**本番利用時の警告**

- この実装は3件送って接続を閉じるだけで、イベントの永続化も切断中に発生した分の再送も持たない。欠落が許されない用途ではIDに紐づくイベントストアと再送が要る。
- 接続を保持するSSEは1接続でソケットを1つ占有する。上限を設けないと同時接続数でファイルディスクリプタを使い切る。プロキシのアイドルタイムアウトによる切断も前提に、ハートビートのコメント行を送る設計が必要になる。

**導線**

- 開始地点: `sse-push/starter/main.sh`
- 模範解答: `sse-push/solution/main.sh`、`sse-push/solution/server.mjs`

### 12.6 課題12.6: 再開可能アップロードの中断を再現して直す (★★★)

**目的**: 署名条件の欠落、オフセットを持たないサーバ、条件なしの追記、中断セッションの放置という4件を固定条件で再現し、修正実装では再現しなくなることを機械的に確かめる。

**難易度**: ★★★

**推定時間**: 150分 (FakeStorage と許可証の実装30分、headSession と patchChunk の実装40分、collectExpired と runFindings の判定設計40分、切断位置と検査を外した観察40分)

**必要サービス**: なし

**前提**

- 12.13 ファイルアップロードの転送方式 ― multipart と presigned URL を読み、署名条件に入れた項目だけが強制されることを確認する
- 12.14 大容量アップロードと再開可能プロトコル を読み、HEAD で受信済みオフセットを返す仕組みと PATCH の条件付き書き込みを押さえる
- 23.26 アップロードされたファイルの検証 を読み、受理と内容検査が別の段階であることを確認する
- `code/ch12` で pnpm install 済みで、`pnpm --filter @handbook/ch12 run typecheck` が通る状態にする

**完成条件 (自己採点用チェックリスト)**

- [ ] `issueGrant` が発行する許可証に上限バイト数が含まれ、`FakeStorage` が超過書き込みを拒否する
- [ ] `headSession` が保存済みバイト列の実長からオフセットを返し、`restart` の後も同じ値を返す
- [ ] `patchChunk` が `offset !== received` のとき書き込まずに ConflictError を投げる
- [ ] `collectExpired` が期限切れセッションと確保済みバイト列の両方を消し、件数と回収バイト数を返す
- [ ] `runFindings` が期待値を直書きせず、naive と fixed の戻り値とストレージ状態の差から判定する
- [ ] `pnpm --filter @handbook/ch12 exec tsx resumable-upload/starter/report.ts` が6行の要約を出力する

**期待出力**

- 1行目に `naive server: 4/4 failures reproduced` が出る
- U1 の行が `naive stored=31457280 / fixed stored=4194304 (declared=5242880)` になる
- U2 の行が `naive resent=12582912 / fixed resent=4194304 (minimum=4194304)` になる
- U3 の行が `naive stored=12582912 / fixed stored=8388608 (sent=8388608)` になる
- 最終行が `fixed server: 0/4 failures remaining` になり、U4 の fixed 側が `retained=0/0B` になる

**観察項目**

- `FIXTURES.resume.cutAfterBytes` を 4MiB へ変え、fixed 側の再送量が切断位置に連動して変わり、naive 側は毎回全量のままであることを確認する
- `patchChunk` のオフセット一致検査を外し、U3 だけが再現に戻ることを確認する
- `headSession` を保存長ではなくメモリ上の値から返すよう変え、再開時にオフセット不一致の ConflictError になって再開できなくなることを確認する
- `issueGrant` の maxBytes と `patchChunk` の宣言長検査を両方外すと U1 だけが再現に戻り、片方だけでは戻らないことを確認する
- `collectExpired` を空実装へ戻し、U4 だけが再現に戻ることを確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch12 exec tsx resumable-upload/solution/report.ts` を実行し、6行の要約が出力されることを確認する
2. `pnpm --filter @handbook/ch12 run test` を実行し、resumable upload のテストが pass することを確認する
3. 自分の `resumable-upload/starter/report.ts` を実行し、solution と同じ出力になるかで自己採点する
4. `pnpm --filter @handbook/ch12 run typecheck` が 0 エラーで終わることを確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 先に `headSession` を通す。残る3つの修正はすべて「サーバが受信済みオフセットを正しく答えられる」ことの上に載るため、ここが誤っていると原因の切り分けができなくなる。
2. 構造: サーバの状態を2種類に分ける。セッションの台帳 (総バイト数、期限、上限) と、実際に書き込まれたバイト列である。オフセットは後者の長さから毎回導き、台帳には持たせない。この分け方にすると、再起動でオフセットが失われるという誤りが構造として起きなくなる。
3. 実装の要点: `patchChunk` では、オフセットの一致検査、総バイト数の超過検査、追記とオフセット更新の原子性の3つを順に置く。追記してから台帳を更新する二段構えにすると、その間で落ちたときに二重書き込みが起きる。書き込み先の実長をそのまま真実として扱えば、更新という操作自体が要らなくなる。

**本番利用時の警告**

- この実装はメモリ上の `FakeStorage` を使っており、実際のオブジェクトストレージの整合性モデル、パート数の上限、課金体系を再現していない。本番では利用するストレージの分割アップロードAPIとライフサイクル規則を確認する。
- `FlakyLink` は決まった位置で切れるだけで、部分的な書き込み、遅延、順序の入れ替えといった実際のネットワーク障害の多くを模していない。本番では想定する最大サイズで実回線を切る試験を別に行う。
- この課題は転送の完全性だけを扱い、内容の安全性は扱わない。受理したバイト列は 23.26 の検証を通すまで配信してはならない。

**導線**

- 開始地点: `resumable-upload/starter/main.ts`
- 模範解答: `resumable-upload/solution/main.ts`、`resumable-upload/solution/report.ts`

## 評価方法

1. starterから開始し、本文の要件と課題詳細の完成条件を満たす。
2. 期待出力・観察項目を記録する。
3. 完成条件のチェックリストで自己採点し、未達項目を残す。
4. solutionとの差分を説明する。
5. `pnpm --filter @handbook/ch12 run test` を実行する。

## 安全上の注意

- 脆弱性・ネットワーク・OS・コンテナの演習は、localhostまたは隔離環境だけで実行してください。
- 教材用の簡略実装をそのまま本番へ投入しないでください。
- 各課題の「本番利用時の警告」を読まずに、演習コードを製品コードへ流用しないでください。

## 配布対象外

`node_modules/`、`dist/`、`coverage/`、一時DB、秘密情報、計測生成物は配布対象外です。
