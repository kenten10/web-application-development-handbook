# 第10章 サーバサイド言語とランタイム — コード教材

## 前提環境

- Node.js 24.18.0 LTS
- pnpm 11.15.1
- TypeScript 6.0.3

## 共通コマンド

```bash
pnpm install
pnpm --filter @handbook/ch10 run lint
pnpm --filter @handbook/ch10 run typecheck
pnpm --filter @handbook/ch10 run test
pnpm --filter @handbook/ch10 run build
```

> `solution` は要件一覧ではなく、実行・観察できる模範実装でなければなりません。`referenceArtifact` や `model answer scaffold` は検証エラーになります。

## 課題一覧

| 課題 | 開始地点 | 模範解答 | 難易度 | 推定時間 | 必要サービス |
|---|---|---|---:|---:|---|
| 10.1 課題10.1: シンプル echo サーバのベンチマーク (★★) | `bench.sh`<br>`echo-server.ts` | `bench.solution.sh`<br>`echo-server.solution.ts` | ★★ | 90分 | localhost |
| 10.2 課題10.2: スレッドプール vs イベントループ (★★★) | `thread-vs-event/starter/README.md` | `thread-vs-event/solution/main.mjs`<br>`thread-vs-event/solution/README.md` | ★★★ | 150分 | なし |
| 10.3 課題10.3: グリーンスレッド風スケジューラを自作 (★★★) | `green-threads.ts` | `green-threads.solution.ts` | ★★★ | 150分 | なし |
| 10.4 課題10.4: 言語間 HTTP サーバ性能比較 (★) | `lang-comparison/starter/main.sh` | `lang-comparison/solution/main.sh` | ★ | 45分 | なし |

## 課題詳細

### 10.1 課題10.1: シンプル echo サーバのベンチマーク (★★)

**目的**: 同じ仕様の echo サーバを Node.js で書いて、wrk や autocannon で性能計測する。

**難易度**: ★★

**推定時間**: 90分 (TCP/HTTP echo 2種の実装40分、bench.sh の作成と実行25分、work付き要求でのブロック観察と記録25分)

**必要サービス**: localhost

**前提**

- 10.2 Node.js ― イベントループの代表 を読み、イベントループがI/O待ちとCPU処理をどう扱うか把握する
- 10.8 ベンチマーク比較 ― 1万コネクション echo サーバ を読み、測定条件を固定する意味を確認する
- Node.js 24 系と curl が PATH にあり、`node --version` が 24.x を返す
- `net.createServer` と `http.createServer` でポートを listen するコードを書ける

**完成条件 (自己採点用チェックリスト)**

- [ ] `code/ch10/echo-server.ts` に `startEchoServers()` を実装し、TCPポートとHTTPポートの2つを同時に listen して両方のポート番号を返す
- [ ] TCPポートへ hello を送ると同じ hello がそのまま返る
- [ ] `POST /echo` が 200 とリクエストボディと同一のバイト列を返し、`content-length` が本文長と一致する
- [ ] `/echo` 以外のパスへの要求が 404 と error キーを持つJSONを返す
- [ ] `code/ch10/bench.sh` が総リクエスト数と同時実行数を受け取り、経過時間と概算rpsを1行で出力する
- [ ] クエリ `?work=500000` を付けた要求で応答時間が明確に伸びることを計測値で示せる

**期待出力**

- サーバ起動時に tcpPort と httpPort を含む1行のJSONが標準出力される
- benchスクリプトが `requests=100 concurrency=10 elapsed_ms=... approx_rps=...` の形式で1行出力する
- 最後に `cpu_block_probe=` に続けて echo 応答本文が表示され、work付き要求の往復が確認できる
- 同時実行数を10から100へ上げると elapsed_ms は伸びるが approx_rps は頭打ちになる

**観察項目**

- `curl -i` でレスポンスヘッダ `x-work-checksum` の値を見て、CPU処理が実際に実行されたことを確認する
- work を 0 と 500000 で切り替え、elapsed_ms の差からイベントループ占有時間を読む
- 重い要求を1本流しながら別ターミナルで軽い `/echo` を叩き、軽い方まで遅延することを確認する
- 環境変数 CONCURRENCY を 10 / 50 / 200 と変えたときの approx_rps の飽和点を記録する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch10 run test` を実行し、テスト `TCP and HTTP echo return the request body` がパスすることを確認する
2. `pnpm --filter @handbook/ch10 exec tsx echo-server.solution.ts` でサーバを起動し、表示された httpPort に対して `REQUESTS=200 CONCURRENCY=20 bash code/ch10/bench.solution.sh http://127.0.0.1:PORT/echo` を実行して計測1行が出れば合格
3. `nc 127.0.0.1 TCPPORT` を実行して hello と入力し、同じ hello がそのまま返ればTCP echoは合格
4. `curl -i -X POST --data hello 'http://127.0.0.1:PORT/echo?work=500000'` の応答に 200 と x-work-checksum が含まれることを確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: TCPとHTTPを1プロセスで同時に立てる方針にする。ポート0で listen して実際のポートを取り出す設計にすると、テストとベンチの両方から同じ関数を使い回せる。
2. 構造: TCP側は接続コールバックで `socket.pipe(socket)` の1行で足りる。HTTP側は request の data と end でチャンクを溜め、`Buffer.concat` してから `response.writeHead(200, ...)` で返す。起動待ちは `once(server, 'listening')` を使う。
3. 実装の要点: CPU負荷は無制限ループにせず `Math.min(iterations, 2_000_000)` のように上限を設ける。上限が無いと work に巨大値を渡された瞬間にプロセスが応答を返さなくなり、ベンチが完走しない。

**本番利用時の警告**

- クエリで同期CPU処理量をクライアントに決めさせる設計は、そのまま公開すると1リクエストでイベントループを止められるDoSになる。本番では処理量をサーバ側で固定し、重い処理は worker_threads やジョブキューへ逃がす。
- この echo サーバはボディ長上限、リクエストタイムアウト、逆流制御を持たないため、巨大ボディや接続を保持し続ける攻撃でメモリと接続枠を食い潰される。
- 負荷試験は必ず自分の localhost に対してのみ行う。bench.sh を第三者のホストへ向けるとDoS行為にあたる。

**導線**

- 開始地点: `bench.sh`、`echo-server.ts`
- 模範解答: `bench.solution.sh`、`echo-server.solution.ts`

### 10.2 課題10.2: スレッドプール vs イベントループ (★★★)

**目的**: 「スレッドプール」と「イベントループ」のスケーリング特性を実測で比較する。

**難易度**: ★★★

**推定時間**: 150分 (計測スクリプトの実装50分、並列数と UV_THREADPOOL_SIZE を変えた測定60分、結果表の作成と考察40分)

**必要サービス**: なし

**前提**

- 10.1 並行性モデルの3パターン を読み、スレッド・イベントループ・グリーンスレッドの区別を言えるようにする
- 10.2 Node.js ― イベントループの代表 を読み、libuv のスレッドプールが担当する処理を把握する
- `promisify` した `crypto.pbkdf2` を非同期に呼べる
- 環境変数 UV_THREADPOOL_SIZE を付けてコマンドを起動できる

**完成条件 (自己採点用チェックリスト)**

- [ ] I/O相当タスク (setTimeout 待ち) とCPU相当タスク (crypto.pbkdf2) を同じ並列数で実行し、経過時間を比較するスクリプトを書く
- [ ] 並列数を 16 / 100 / 500 / 1000 と変えて、両ワークロードの経過時間を表として記録する
- [ ] I/O側は並列数を上げても総経過時間がほぼ一定であることを数値で示す
- [ ] CPU側は UV_THREADPOOL_SIZE の値で経過時間が階段状に変わることを数値で示す
- [ ] 出力に label / count / elapsedMs の3列が含まれる

**期待出力**

- event-loop-io と libuv-thread-pool の2行を持つ表が出力され、各行に count と elapsedMs が入る
- 並列16では event-loop-io の elapsedMs が数十ミリ秒、libuv-thread-pool は数百ミリ秒以上と桁が異なる
- UV_THREADPOOL_SIZE=1 にすると libuv-thread-pool の elapsedMs がデフォルト値のときの数倍になる
- 実行の最後に観察内容を述べたコメント行が1行表示される

**観察項目**

- UV_THREADPOOL_SIZE を 1 / 4 / 8 と変え、CPU側 elapsedMs がプール数にほぼ反比例することを確認する
- 並列数を16から256へ増やしたとき、I/O側の elapsedMs がほとんど変わらないことを表で比べる
- CPU側の実行中に OS のCPU使用率を見て、物理コア数を超えては上がらないことを確認する
- pbkdf2 の反復数を増減させ、待ち行列の伸び方が線形かを見る

**テスト方法 (自己採点手順)**

1. `node code/ch10/thread-vs-event/solution/main.mjs 32` を実行し、2行の表と elapsedMs が表示されれば実行環境は正常
2. `UV_THREADPOOL_SIZE=1 node code/ch10/thread-vs-event/solution/main.mjs 32` とデフォルト値の結果を並べ、CPU行の elapsedMs が明確に増えていれば合格
3. `pnpm --filter @handbook/ch10 run test` を実行し、章の検証が通ることを確認する。この課題自体の自動テストは無いため、記録した数値表で自己採点する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 測る対象を「待つだけのタスク」と「CPUを実際に使うタスク」の2つに絞る。同じ関数で並列実行して経過時間だけを返す形にすると比較が単純になる。
2. 構造: `performance.now()` で開始時刻を取り、`Promise.all(tasks.map(t => t()))` を待って差分を返す runConcurrent(label, tasks) を用意する。I/O側は setTimeout を包んだ Promise、CPU側は promisify した pbkdf2 を使う。
3. 実装の要点: pbkdf2 は同期版ではなく非同期版を使うこと。同期版だとイベントループ自体が止まり、スレッドプールの飽和ではなく単なる直列実行を測ってしまう。UV_THREADPOOL_SIZE はプロセス起動時にしか反映されない。

**本番利用時の警告**

- 測定値はCPU、電源設定、Node.jsのバージョンに強く依存する。この数値を他マシンの容量計画へ流用してはいけない。
- UV_THREADPOOL_SIZE を大きくすると pbkdf2 だけでなくDNS解決やファイルI/Oも同じプールを奪い合う。本番で無闇に上げるとI/O遅延が悪化する。

**導線**

- 開始地点: `thread-vs-event/starter/README.md`
- 模範解答: `thread-vs-event/solution/main.mjs`、`thread-vs-event/solution/README.md`

### 10.3 課題10.3: グリーンスレッド風スケジューラを自作 (★★★)

**目的**: Go の goroutine、Erlang のプロセスのような「軽量スレッド」がどう実装されているか理解する。

**難易度**: ★★★

**推定時間**: 150分 (Scheduler本体の実装50分、sleep相当とチャンネル受信相当の拡張および例外処理50分、タスク数を増やしたメモリ観察と記録50分)

**必要サービス**: なし

**前提**

- 10.1 並行性モデルの3パターン のグリーンスレッドの説明を読む
- 10.4 Go ― シンプルで速い を読み、goroutine が協調的に切り替わる前提を確認する
- JavaScript の Generator (function* と yield) で実行を中断・再開できる
- Node.js 24 系と tsx で TypeScript を直接実行できる

**完成条件 (自己採点用チェックリスト)**

- [ ] Scheduler クラスに spawn(factory) と run(maxSteps) を実装する
- [ ] 2つのタスクを spawn すると出力が A step 0 / B step 0 / A step 1 / B step 1 の順に交互になる
- [ ] run() が steps と errors を返し、正常終了時に errors の件数が 0 になる
- [ ] タスク内で例外が起きても他タスクは走り続け、例外は errors に蓄積される
- [ ] maxSteps を超えると `Scheduler exceeded maxSteps=100000` を投げて無限ループを止める
- [ ] 1000個のタスクを spawn しても1プロセス内で完走する

**期待出力**

- A step 0 から B step 2 までの6行が交互に並び、最後に `steps=6 errors=0` が表示される
- 無限ループするタスクを混ぜると maxSteps 超過の例外で停止する
- 例外を投げるタスクを混ぜても他タスクの出力は最後まで続き、errors の件数が1になる

**観察項目**

- 出力順を見て、1タスクが完了してから次ではなく1ステップごとに切り替わっていることを確認する
- yield を消したタスクを混ぜ、他タスクが飢餓状態になることを再現する
- タスク数を10から10000へ増やし、`process.memoryUsage().heapUsed` の増分が1タスクあたり数百バイト程度に収まることを見る
- run() が返す steps が、タスク数と yield 回数から計算した値と一致するか数える

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch10 run test` を実行し、テスト `green scheduler interleaves cooperative tasks` がパスすることを確認する
2. `pnpm --filter @handbook/ch10 exec tsx green-threads.solution.ts` を実行し、6行の交互出力と `steps=6 errors=0` が出れば合格
3. 意図的に throw するタスクを spawn し、他タスクの出力が続き errors の件数が1になることを確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: スケジューラの本体はキュー1本で足りる。先頭のタスクを1ステップだけ進め、終わっていなければ末尾へ戻す、を繰り返せばラウンドロビンになる。
2. 構造: タスクは Generator オブジェクトとして保持し、`task.next()` の戻り値の done を見る。done が false ならキューへ push、true なら捨てる。spawn は Generator を作るファクトリ関数を受け取る形にする。
3. 実装の要点: `next()` の例外を try/catch で拾わないと、1タスクの失敗でスケジューラ全体が停止する。また無限ループするタスクに備えて総ステップ数の上限を持たせる。

**本番利用時の警告**

- この協調的スケジューラはプリエンプションを持たないため、yield しないタスクが1つあるだけで他タスクは永久に動かない。本番のワーカーには実行時間の上限と強制中断が要る。
- Generator ベースのタスクは同一スレッド上で切り替わるだけで並列実行ではない。CPU負荷の分散を狙って本番へ持ち込むとコアを1つしか使えず処理が詰まる。

**導線**

- 開始地点: `green-threads.ts`
- 模範解答: `green-threads.solution.ts`

### 10.4 課題10.4: 言語間 HTTP サーバ性能比較 (★)

**目的**: 同じ機能の HTTP サーバを Node.js、Go、Python で書いて性能を比較する (Go/Python は環境があれば)。

**難易度**: ★

**推定時間**: 45分 (起動スクリプトの作成20分、node/python/goの測定15分、結果の記録と偏りの考察10分)

**必要サービス**: なし

**前提**

- 10.9 ランタイム選択の判断軸 (まとめ) を読み、req/s以外の判断軸を確認する
- 10.4 Go ― シンプルで速い と 10.6 Python ― データとAIの覇者 に目を通す
- node と curl が使える。go と python3 は無ければスキップでよい
- bash スクリプトからバックグラウンドプロセスを起動し kill できる

**完成条件 (自己採点用チェックリスト)**

- [ ] GET で ok を返す最小サーバを Node.js で起動し、指定回数の逐次リクエストで経過時間を測るスクリプトを書く
- [ ] python3 と go がある場合は同等サーバも測り、無い場合は `python: skipped (not installed)` のように表示して続行する
- [ ] 各ランタイムについて requests / elapsed_ms / approx_rps の3項目を1行で出力する
- [ ] スクリプト終了時に起動したサーバプロセスと一時ディレクトリが残らない
- [ ] 測定値の一般化可能範囲についての注意書きを1行出力する

**期待出力**

- `node: requests=30 elapsed_ms=... approx_rps=...` の形式の行が、実行できたランタイムの数だけ出力される
- 未インストールのランタイムは skipped と1行だけ表示される
- 最後に、この数値は同一マシン・同一実行内でのみ比較できる旨の注意が1行出る
- 逐次curl測定のため、本文の表にあるような桁違いの差までは開かない

**観察項目**

- 逐次curlではプロセス起動と接続確立のコストが支配的で、本文の表ほど差が開かないことを確認する
- 各サーバが listen を完了するまでのヘルスチェック回数の違いを見る
- ps や top で各サーバプロセスの常駐メモリを比べる
- 同じスクリプトを2回続けて実行し、approx_rps がどれだけぶれるかを記録する

**テスト方法 (自己採点手順)**

1. `bash code/ch10/lang-comparison/solution/main.sh` を実行し、少なくとも node: の行が出力されれば合格
2. `REQUESTS=100 PORT_BASE=39200 bash code/ch10/lang-comparison/solution/main.sh` のように環境変数を変えて再実行し、出力形式が変わらないことを確認する
3. `pnpm --filter @handbook/ch10 run test` を実行し、章全体の検証が通ることを確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 3言語分の最小サーバをリポジトリへ置かず、スクリプト内のヒアドキュメントで一時ディレクトリへ書き出すと、環境差の切り分けが楽になる。
2. 構造: benchmark 名前・起動コマンド・ポート を受け取る関数を1つ作り、起動、ヘルスチェックのポーリング、計測ループ、kill の順に並べる。時刻取得は python3 の perf_counter_ns で全言語分を揃える。
3. 実装の要点: listen 完了を固定時間の sleep で待つと計測が不安定になる。`curl -sf` が成功するまでポーリングし、trap で必ずプロセスと一時ディレクトリを片付ける。

**本番利用時の警告**

- この逐次curl測定はプロセス起動と接続確立のコストを含むため、ランタイム選定の根拠として社外へ出す数値には使えない。
- ここで使う Python の http.server は開発用でシングルスレッドかつ堅牢性の考慮が無いため、本番のHTTPサーバとして公開してはいけない。

**導線**

- 開始地点: `lang-comparison/starter/main.sh`
- 模範解答: `lang-comparison/solution/main.sh`

## 評価方法

1. starterから開始し、本文の要件と課題詳細の完成条件を満たす。
2. 期待出力・観察項目を記録する。
3. 完成条件のチェックリストで自己採点し、未達項目を残す。
4. solutionとの差分を説明する。
5. `pnpm --filter @handbook/ch10 run test` を実行する。

## 安全上の注意

- 脆弱性・ネットワーク・OS・コンテナの演習は、localhostまたは隔離環境だけで実行してください。
- 教材用の簡略実装をそのまま本番へ投入しないでください。
- 各課題の「本番利用時の警告」を読まずに、演習コードを製品コードへ流用しないでください。

## 配布対象外

`node_modules/`、`dist/`、`coverage/`、一時DB、秘密情報、計測生成物は配布対象外です。
