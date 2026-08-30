# 第2章 HTTPプロトコル徹底解剖 — コード教材

## 前提環境

- Node.js 24.18.0 LTS
- pnpm 11.15.1
- TypeScript 6.0.3

## 共通コマンド

```bash
pnpm install
pnpm --filter @handbook/ch02 run lint
pnpm --filter @handbook/ch02 run typecheck
pnpm --filter @handbook/ch02 run test
pnpm --filter @handbook/ch02 run build
```

> `solution` は要件一覧ではなく、実行・観察できる模範実装でなければなりません。`referenceArtifact` や `model answer scaffold` は検証エラーになります。

## 課題一覧

| 課題 | 開始地点 | 模範解答 | 難易度 | 推定時間 | 必要サービス |
|---|---|---|---:|---:|---|
| 2.1 課題2.1: 生のソケットでHTTPリクエストを送る (★★) | `raw-http-client.ts` | `raw-http-client.solution.ts` | ★★ | 90分 | なし |
| 2.2 課題2.2: 最小HTTPサーバを自作 (★★) | `raw-http-server.ts` | `raw-http-server.solution.ts` | ★★ | 90分 | localhost |
| 2.3 課題2.3: HTTP のメソッドとステータスコードを正しく使う (★) | `blog-api/starter/README.md` | `blog-api/solution.ts`<br>`blog-api/solution/README.md` | ★ | 45分 | なし |
| 2.4 課題2.4: HTTP/1.1 vs HTTP/2 の体感ベンチマーク (★★★) | `benchmark/starter/README.md` | `benchmark/solution/server.ts`<br>`benchmark/solution/client.ts`<br>`benchmark/solution/README.md` | ★★★ | 150分 | OpenSSL/TLS |
| 2.5 課題2.5: パフォーマンスのアンチパターンを再現する (★★) | `antipatterns/starter/main.sh` | `antipatterns/solution/main.sh`<br>`antipatterns/solution/benchmark.mjs` | ★★ | 90分 | なし |

## 課題詳細

### 2.1 課題2.1: 生のソケットでHTTPリクエストを送る (★★)

**目的**: HTTPは「TCPの上で動くテキストプロトコル」であることを実感する。

**難易度**: ★★

**推定時間**: 90分 (解析関数の実装に35分、ソケット接続と受信バッファ結合に25分、chunkedと異常系の追加に20分、観察記録に10分)

**必要サービス**: なし

**前提**

- 2.1 HTTPメッセージの構造 を読み、リクエストライン・ヘッダ・空行・ボディの並びを書き出せる
- Node.js の net モジュールで `net.createConnection` を使いTCPソケットを開ける
- Buffer の `indexOf` と `subarray` でバイト列を切り出せる

**完成条件 (自己採点用チェックリスト)**

- [ ] `code/ch02/raw-http-client.ts` に http / https モジュールを import せず、net だけで実装している
- [ ] レスポンス解析関数が `statusCode` を数値、`headers` を Map、`body` を Buffer として返す
- [ ] `Content-Length` の値を読み、ボディをその長さで切り詰めている (余分なバイトが続いていても捨てる)
- [ ] ヘッダ名を小文字化して格納し、同名ヘッダが複数来た場合は `, ` で連結している
- [ ] example.com の `/` に対して 200 のステータス行とHTMLボディを取得できる
- [ ] ヘッダ境界が現れないバイト列や不正な Content-Length で例外を投げる

**期待出力**

- 標準出力の1行目が `HTTP/1.1 200 OK` の形式で、続けて `content-type: text/html; charset=UTF-8` などのヘッダ行が並ぶ
- ヘッダの後に空行を挟み、`<!doctype html>` で始まるボディが出力される
- `content-length` ヘッダの数値と、出力されたボディのバイト数が一致する
- 存在しないパスを指定すると `HTTP/1.1 404 Not Found` のステータス行が返る

**観察項目**

- `Connection: close` を送るとサーバ側から切断され `end` イベントが来ることを確認し、Keep-Alive では終端が来ないことと対比する
- `data` イベントごとに受信バイト数をログへ出し、ヘッダとボディが1回のイベントで届くとは限らないことを確認する
- `Accept-Encoding: identity` を外すと `content-encoding: gzip` が返り、ボディがそのままでは読めなくなることを確認する
- chunked を返すサーバでは `content-length` が無く、本文に16進のチャンクサイズ行が挟まることを生バイトで確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch02 run test` を実行し、`raw HTTP response parser separates status, headers, and body` がパスすることを確認する
2. `rm -rf /tmp/ch02 && tsc -p code/ch02/tsconfig.json --outDir /tmp/ch02 && node /tmp/ch02/raw-http-client.js example.com /` を実行し、ステータス行・ヘッダ・HTMLボディの3ブロックが順に出れば合格とする
3. ヘッダ境界のないバイト列を解析関数へ渡し、無言で不正な結果を返さず例外になることを確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: ソケットから届くバイトを貯める処理と、貯まったバッファを解析する処理を別の関数に分ける。先に解析関数だけを固定文字列でテストすると切り分けが楽になる。
2. 構造: `net.createConnection` で接続し、`connect` イベントでリクエスト行とヘッダを `\r\n` 区切りで書く。`data` イベントで Buffer を配列へ push し、`end` で `Buffer.concat` してから `raw.indexOf('\r\n\r\n')` でヘッダ境界を探す。
3. 実装の要点: ヘッダ部は `latin1` で文字列化し、ボディは Buffer のまま扱うと文字化けを避けられる。`content-length` を読んだら `body.subarray(0, length)` で切り詰める。シグネチャは `parseHttpResponse(raw: Buffer): HttpResponse` の形になる。

**本番利用時の警告**

- この自作パーサはヘッダ行数・ヘッダ長・ボディ長の上限を持たないため、そのまま公開サービスへ組み込むとメモリ枯渇によるDoSを受ける。本番では実装済みのHTTPクライアントを使う
- TLS、証明書検証、リダイレクト追跡、圧縮の解凍を一切行わないため https のURLへは接続できず、平文で送った内容は経路上で読まれる

**導線**

- 開始地点: `raw-http-client.ts`
- 模範解答: `raw-http-client.solution.ts`

### 2.2 課題2.2: 最小HTTPサーバを自作 (★★)

**目的**: HTTP サーバの仕事は「ソケットからリクエストを読み、レスポンスを書く」だけだと体感する。

**難易度**: ★★

**推定時間**: 90分 (リクエスト解析の実装に30分、ルーティングとシリアライズに25分、400と404およびボディ分割到着の対応に20分、curlでの動作確認に15分)

**必要サービス**: localhost

**前提**

- 課題2.1 のレスポンス解析、または 2.1 HTTPメッセージの構造 の読了
- 2.3 ステータスコード を読み、200 / 400 / 404 の使い分けを説明できる
- `net.createServer` でTCPサーバを listen し、curl から接続できる環境がある

**完成条件 (自己採点用チェックリスト)**

- [ ] `net.createServer()` だけでサーバを構成し、http モジュールを使っていない
- [ ] `GET /` が `Hello, World!`、`GET /echo/test` が `test`、`POST /echo` がリクエストボディをそのまま返す
- [ ] 未定義のパスで 404、リクエストラインやヘッダが不正なときに 400 を返す
- [ ] すべてのレスポンスに正しいバイト数の `Content-Length` と `Connection: close` を付けている
- [ ] `Content-Length` 分のボディが届くまでレスポンスを返さず、データの分割到着に耐える

**期待出力**

- `curl -i http://127.0.0.1:3000/` が `HTTP/1.1 200 OK` と `Content-Length: 13` を返し、本文が `Hello, World!` になる
- `curl -i http://127.0.0.1:3000/echo/test` の本文が4バイトの `test` になる
- `curl -i -X POST -d 'hello' http://127.0.0.1:3000/echo` の本文が `hello` になる
- `curl -i http://127.0.0.1:3000/none` が `HTTP/1.1 404 Not Found` を返す
- リクエストラインが不正なバイト列に対して `HTTP/1.1 400 Bad Request` が返る

**観察項目**

- `curl -v` の出力で、レスポンス後にサーバ側から接続が閉じられていることを確認し、Keep-Alive の場合との違いを見る
- `Content-Length` をわざと1バイト減らすとcurlが本文を途中で切ることを確認し、ヘッダが本文の解釈を支配していると分かる
- ヘッダ終端の空行を送らずに接続を保持すると、サーバが応答を保留したままになることを確認し、タイムアウト設計が必要な理由を見る
- `/echo/%E3%81%82` のようなパーセントエンコード済みパスを叩き、デコードの有無で出力が変わることを確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch02 run test` を実行し、`raw server handles GET and POST echo routes` がパスすることを確認する
2. サーバ起動後に `curl -i http://127.0.0.1:3000/ && curl -i http://127.0.0.1:3000/echo/test && curl -i -X POST -d 'hello' http://127.0.0.1:3000/echo` を実行し、3件とも 200 と期待どおりの本文なら合格とする
3. `printf 'BAD\r\n\r\n' > /tmp/bad-request.txt` を作り `nc 127.0.0.1 3000 < /tmp/bad-request.txt` を実行して `HTTP/1.1 400 Bad Request` が返ることを確認する
4. `curl -i http://127.0.0.1:3000/none` が 404 を返すことを確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: サーバの仕事を「バイトを貯める」「リクエストへ解析する」「経路を選ぶ」「レスポンスをシリアライズする」の4段に分ける。経路はまず `GET /` の1本だけ通す。
2. 構造: `net.createServer((socket) => ...)` の `data` イベントで Buffer を貯め、`\r\n\r\n` が現れたらリクエストラインとヘッダを解析する。解析結果から `route()` で `{ status, reason, body }` を作り、`serializeResponse()` でヘッダ付き Buffer に変換して `socket.end()` する。
3. 実装の要点: 詰まりやすいのはボディ未着の扱いで、解析関数から `null` を返して次の `data` を待つのが要点になる。`Content-Length` の値と、受信済みバイト数 (`raw.length - boundary - 4`) を比べて判定する。

**本番利用時の警告**

- この自作サーバはリクエスト行長・ヘッダ数・ボディサイズの上限がなく、接続を占有する Slowloris 型の攻撃やメモリ枯渇に無防備である。公開インタフェースで listen せず `127.0.0.1` に限定する
- 受け取ったパスやボディをそのまま返すため、ブラウザから開けば Content-Type 次第で反射型XSSの土台になる。実運用ではエスケープと Content-Type の固定が必須になる

**導線**

- 開始地点: `raw-http-server.ts`
- 模範解答: `raw-http-server.solution.ts`

### 2.3 課題2.3: HTTP のメソッドとステータスコードを正しく使う (★)

**目的**: REST API としての正しいメソッド・ステータスコードの使い分けを身につける。

**難易度**: ★

**推定時間**: 45分 (ルーティングとハンドラの実装に20分、ステータスとLocationの調整に10分、curlによる冪等性の確認に10分、失敗系の追加に5分)

**必要サービス**: なし

**前提**

- 2.2 メソッドの意味論 と 2.3 ステータスコード を読み、安全性と冪等性の違いを説明できる
- `code/ch02/blog-api/starter/README.md` を読み、6つのエンドポイント仕様を把握している
- `node:http` の createServer とリクエストボディのストリーム読み取りができる

**完成条件 (自己採点用チェックリスト)**

- [ ] GET /posts が 200 とJSON配列、GET /posts/:id が存在時 200・不在時 404 を返す
- [ ] POST /posts が 201 と `Location: /posts/<新ID>` を返し、title か body が欠けた入力では 400 を返す
- [ ] PUT /posts/:id が全置換で 200、PATCH /posts/:id が部分更新で 200、いずれも不在IDで 404 を返す
- [ ] DELETE /posts/:id が 204 を返し、レスポンス本文が0バイトである
- [ ] 同じ本文でPOSTを2回実行すると別IDの記事が2件でき、同じ本文でPUTを2回実行しても結果が変わらないことを確認している

**期待出力**

- POST のレスポンスが `HTTP/1.1 201 Created` と `Location: /posts/2` の形式のヘッダを含む
- 作成された本文が `{"id":2,"title":"New","body":"Text"}` のように id / title / body の3キーを持つJSONになる
- DELETE のレスポンスが `HTTP/1.1 204 No Content` で、本文が空になる
- 不正なJSONを送ると 400 と `{"error":...}` 形式のJSONが返る
- JSONレスポンスには `Content-Type: application/json; charset=utf-8` が付く

**観察項目**

- POSTを3回叩き `Location` のIDが単調増加すること、つまりPOSTが冪等でないことを確認する
- 同じ本文でPUTを2回叩き、レスポンスのJSONが完全に一致すること、つまりPUTが冪等であることを確認する
- 存在しないIDへのPUTが 404 になり、201 で新規作成しない設計であることを確認し、仕様上のupsert可否と比べる
- DELETE成功後に同じIDをGETすると 404 になり、状態遷移がステータスコードに現れることを確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch02 run test` を実行し、`blog API returns REST status codes and Location` がパスすることを確認する
2. サーバ起動後に `curl -i -X POST http://127.0.0.1:3001/posts -H 'content-type: application/json' -d '{"title":"New","body":"Text"}'` を実行し、201 と Location ヘッダの両方が出れば合格とする
3. `curl -i -X DELETE http://127.0.0.1:3001/posts/1` の後に `curl -i http://127.0.0.1:3001/posts/1` を実行し、204 の次に 404 が返ることを確認する
4. `curl -i -X POST http://127.0.0.1:3001/posts -H 'content-type: application/json' -d '{"title":""}'` が 400 を返すことを確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: ルーティングを先に表として書き出し、メソッドとパス形状 (`/posts` か `/posts/:id` か) の2軸で分岐を作る。ステータスコードは分岐の出口ごとに1つ決めておく。
2. 構造: `new URL(request.url, 'http://localhost')` で pathname を取り、`/^\/posts\/(\d+)$/` でIDを抜く。保存先は `Map<number, Post>` にし、`nextId` を単調増加のカウンタで持つ。
3. 実装の要点: 204 は本文を書いてはいけないため `response.writeHead(204)` の直後に `response.end()` だけを呼ぶ。PATCH は欠けたキーを既存値で埋め、PUT は欠けたキーを 400 にする、という扱いの差が両者の分かれ目になる。

**本番利用時の警告**

- 保存先がプロセス内の Map なので再起動で全件消え、複数プロセスへ増やすと内容が食い違う。永続化と排他制御は第14章以降の題材になる
- 認証・認可・レート制限・CSRF対策が一切ないため、この状態で公開すると誰でも記事を削除できる

**導線**

- 開始地点: `blog-api/starter/README.md`
- 模範解答: `blog-api/solution.ts`、`blog-api/solution/README.md`

### 2.4 課題2.4: HTTP/1.1 vs HTTP/2 の体感ベンチマーク (★★★)

**目的**: 「HTTP/2 はなぜ速いのか」を実測で理解する。

**難易度**: ★★★

**推定時間**: 150分 (証明書生成とサーバ起動に20分、2種のクライアント実装に50分、条件を変えた反復計測に50分、tcpdump観察と記録に30分)

**必要サービス**: OpenSSL/TLS

**前提**

- 2.5 Keep-Aliveとコネクション再利用 と 2.6 HTTP/2 ― バイナリ多重化 を読み、ヘッドオブラインブロッキングの発生箇所を説明できる
- openssl が PATH にあり、`openssl req -x509` で自己署名証明書を作れる
- `node:http2` と `node:https` の非同期APIを Promise でまとめられる

**完成条件 (自己採点用チェックリスト)**

- [ ] `certs/localhost-key.pem` と `certs/localhost-cert.pem` を生成し、`allowHTTP1: true` のTLSサーバを1つだけ起動している
- [ ] サーバが `/asset/<数字>` に対して1024バイトの固定ペイロードを返し、それ以外は 404 を返す
- [ ] 同一サーバに対しHTTP/1.1 (最大6ソケット) とHTTP/2 (1セッション多重化) の両方で100件を取得し、所要ミリ秒を出力している
- [ ] ウォームアップ後に3回以上計測し、単発値ではなく中央値または分布を記録している
- [ ] 測定条件 (COUNT、maxSockets、CPU、ネットワーク遅延、TLSセッション再利用の有無) を記録に残している

**期待出力**

- クライアントが `console.table` で protocol / requests / ms の3列を持つ2行の表を出力する
- 表の後に、結果が測定条件に依存する旨の1行が出力される
- サーバ起動時に `benchmark server: https://127.0.0.1:3444` が表示される
- 100件の取得ではHTTP/2側が小さい値になることが多いが、ループバックでは差が数ミリ秒まで縮むこともある

**観察項目**

- HTTP/1.1側の `maxSockets` を 1 / 6 / 20 と変えて再測定し、並列度が結果を支配することを確認する
- `tcpdump -i lo0 port 3444` などでパケットを見て、HTTP/1.1が複数のTCP接続を張るのに対しHTTP/2が1接続で済むことを確認する
- ペイロードを1KBから100KBへ増やし、多重化の利得が帯域律速で消えることを確認する
- ループバックは遅延がほぼ0のため、外部ホストや遅延注入を加えると差が拡大することを確認する

**テスト方法 (自己採点手順)**

1. `openssl req -x509 -newkey rsa:2048 -nodes -days 1 -keyout certs/localhost-key.pem -out certs/localhost-cert.pem -subj '/CN=localhost' -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1'` を実行し、2ファイルが生成されれば準備完了とする
2. `rm -rf /tmp/ch02 && tsc -p code/ch02/tsconfig.json --outDir /tmp/ch02 && node /tmp/ch02/benchmark/solution/server.js` でサーバを起動し、別ターミナルで `node /tmp/ch02/benchmark/solution/client.js` が2行の表を出せば計測が成立している
3. `COUNT=10` と `COUNT=200` で実行し、リクエスト数の増加に伴ってHTTP/1.1側の増え方が急になることを確認する
4. 記録に3回以上の測定値が残り、単一回の結果でHTTP/2の優位を結論づけていなければ合格とする

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 比較の妥当性はサーバを1つにすることで決まる。`allowHTTP1: true` の同じTLSサーバへ、クライアント側だけプロトコルを変えて接続する構成にする。
2. 構造: HTTP/1.1側は `new https.Agent({ keepAlive: true, maxSockets: 6 })` を使い、HTTP/2側は `http2.connect(origin)` で1セッションを作り `session.request({ ':path': ... })` を100本並べる。両方とも `Promise.all` で完了を待ち `performance.now()` の差を取る。
3. 実装の要点: 自己署名証明書のため両クライアントで `rejectUnauthorized: false` が必要になる。またレスポンスを読み捨てないと `end` が来ないので、HTTP/1.1側は `response.resume()`、HTTP/2側は `request.on('data', () => {})` を必ず入れる。

**本番利用時の警告**

- `rejectUnauthorized: false` は証明書検証そのものを無効にし、中間者攻撃を検出できなくする。localhost の計測専用にとどめ、アプリケーションのコードへ持ち込まない
- 生成した鍵と証明書はリポジトリへコミットしない。`-days 1` のような短命の証明書を都度作り捨てる
- 同じ手順を第三者のホストへ向けると負荷試験にあたる。許可のない対象へ100並列のリクエストを送らない

**導線**

- 開始地点: `benchmark/starter/README.md`
- 模範解答: `benchmark/solution/server.ts`、`benchmark/solution/client.ts`、`benchmark/solution/README.md`

### 2.5 課題2.5: パフォーマンスのアンチパターンを再現する (★★)

**目的**: 「やってはいけない HTTP」のパターンを実装し、なぜ遅いか測定する。

**難易度**: ★★

**推定時間**: 90分 (計測用サーバと3経路の実装に30分、6条件の計測関数に25分、COUNTを変えた反復に20分、原因との対応付けの記述に15分)

**必要サービス**: なし

**前提**

- 2.4 ヘッダ ― HTTPの真の主役 を読み、`Accept-Encoding` と `Content-Encoding` の役割を説明できる
- 2.5 Keep-Aliveとコネクション再利用 を読み、TCP接続確立のコストを見積もれる
- `node:http` の Agent と `performance.now()` で経過時間を測れる

**完成条件 (自己採点用チェックリスト)**

- [ ] ローカルHTTPサーバを1つ立て、`/small` `/bundle` `/json` の3経路で比較用のレスポンスを返している
- [ ] 小さなリクエストを100回送る場合と1回にまとめる場合の所要時間を、同一プロセス内で計測している
- [ ] Keep-Aliveなしとありを同じ回数で計測している
- [ ] `Accept-Encoding: gzip` の有無で同じ大きなJSONを取得し、所要時間と転送バイト数の両方を記録している
- [ ] 各アンチパターンの超過時間を、接続確立回数・リクエスト数・転送バイト数のどれで説明できるか書いている

**期待出力**

- `console.table` に label と ms の2列で6行 (小さなリクエスト、まとめて1回、Keep-Aliveなし、Keep-Aliveあり、gzipなし、gzipあり) が出力される
- 表の後に `plain JSON=NNNNNN bytes, gzip=NNNN bytes` の1行が出て、gzip後が1桁以上小さくなる
- まとめて1回の値は、小さなリクエスト100回より一桁小さいミリ秒になる
- Keep-Aliveなしはあり側より遅く、その差は接続回数に比例して広がる

**観察項目**

- COUNT を 10 / 100 / 500 と変え、超過時間がリクエスト数に対しておおむね線形に伸びることを確認する
- Keep-Aliveなしの計測中に `netstat -an` の出力を見て、TIME_WAIT 状態のソケットが増えることを確認する
- gzipあり・なしで ms の差が小さいのに転送バイト数が大きく減る場合を見て、ループバックでは帯域が支配要因でないと理解する
- サーバとクライアントが同一プロセスであることを踏まえ、実ネットワークでは各差分がRTTの分だけ拡大すると見積もる

**テスト方法 (自己採点手順)**

1. `COUNT=100 bash code/ch02/antipatterns/solution/main.sh` を実行し、6行の表と `plain JSON=... gzip=...` の行が出れば計測が成立している
2. 表の `one bundled request` が `100 small requests` より小さい値になっていれば、リクエスト数削減の効果を再現できている
3. `COUNT=10` と `COUNT=200` で同じスクリプトを実行し、Keep-Alive有無の差が回数に応じて広がることを確認する
4. 各行の差をミリ秒で書き出し、原因 (接続確立、往復回数、転送量) と対応付けた表が完成していれば合格とする

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 3つのアンチパターンを別スクリプトに分けず、1つのサーバと1つの計測関数で回すと条件が揃う。まず `measure(label, fn)` の形の計測関数を作る。
2. 構造: 経路は `/small` (256バイト)、`/bundle` (256バイト×COUNT)、`/json` (`accept-encoding` に応じて gzip 済みか生かを返す) の3つで足りる。クライアント側は `new http.Agent({ keepAlive: true })` を渡す場合と `agent: false` の場合を切り替える。
3. 実装の要点: gzip比較は事前に `gzipSync(json)` した Buffer を持っておき、`content-encoding: gzip` を付けるかどうかだけを切り替える。`content-length` を実際に返す本文の長さへ合わせないと、クライアントが受信完了を待ち続ける。

**本番利用時の警告**

- ループバック上の計測は接続確立コストとRTTを過小評価する。ここで得た数値をそのまま本番の改善見込みとして提示しない
- 同じ負荷スクリプトを第三者のサーバへ向けるとDoSにあたる。計測対象は自分が起動したローカルサーバに限定する

**導線**

- 開始地点: `antipatterns/starter/main.sh`
- 模範解答: `antipatterns/solution/main.sh`、`antipatterns/solution/benchmark.mjs`

## 評価方法

1. starterから開始し、本文の要件と課題詳細の完成条件を満たす。
2. 期待出力・観察項目を記録する。
3. 完成条件のチェックリストで自己採点し、未達項目を残す。
4. solutionとの差分を説明する。
5. `pnpm --filter @handbook/ch02 run test` を実行する。

## 安全上の注意

- 脆弱性・ネットワーク・OS・コンテナの演習は、localhostまたは隔離環境だけで実行してください。
- 教材用の簡略実装をそのまま本番へ投入しないでください。
- 各課題の「本番利用時の警告」を読まずに、演習コードを製品コードへ流用しないでください。

## 配布対象外

`node_modules/`、`dist/`、`coverage/`、一時DB、秘密情報、計測生成物は配布対象外です。
