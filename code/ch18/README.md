# 第18章 Linuxとネットワーク — コード教材

## 前提環境

- Node.js 24.18.0 LTS
- pnpm 11.15.1
- TypeScript 6.0.3

## 共通コマンド

```bash
pnpm install
pnpm --filter @handbook/ch18 run lint
pnpm --filter @handbook/ch18 run typecheck
pnpm --filter @handbook/ch18 run test
pnpm --filter @handbook/ch18 run build
```

> `solution` は要件一覧ではなく、実行・観察できる模範実装でなければなりません。`referenceArtifact` や `model answer scaffold` は検証エラーになります。

## 課題一覧

| 課題 | 開始地点 | 模範解答 | 難易度 | 推定時間 | 必要サービス |
|---|---|---|---:|---:|---|
| 18.1 課題18.1: 高並行 TCP サーバ (epoll 風) を自作 (★★★) | `epoll-style-server.ts` | `epoll-style-server.solution.ts` | ★★★ | 150分 | localhost |
| 18.2 課題18.2: ファイルディスクリプタとリーク検出 (★★) | `fd-leak.ts` | `fd-leak.solution.ts` | ★★ | 90分 | なし |
| 18.3 課題18.3: シグナルハンドリングとグレースフルシャットダウン (★★) | `graceful-shutdown.ts` | `graceful-shutdown.solution.ts` | ★★ | 90分 | localhost |
| 18.4 課題18.4: 自作 L7 ロードバランサ (★★★) | `load-balancer.ts` | `load-balancer.solution.ts` | ★★★ | 150分 | localhost |
| 18.5 課題18.5: ネットワークデバッグツール (mini-tcpdump) (★) | `mini-tcpdump.ts` | `mini-tcpdump.solution.ts` | ★ | 45分 | なし |

## 課題詳細

### 18.1 課題18.1: 高並行 TCP サーバ (epoll 風) を自作 (★★★)

**目的**: Node.js のイベントループの裏側 ― epoll/kqueue による非同期 I/O を体感。

**難易度**: ★★★

**推定時間**: 150分 (多重化版とブロック版の2実装に60分、10,000接続のベンチスクリプトと ulimit 調整に50分、メモリとスループットの記録と考察に40分)

**必要サービス**: localhost

**前提**

- 18.5 ネットワークスタック を読み、TCP接続の確立とソケットバッファの役割を把握する
- 18.1 プロセスとスレッド を読み、1スレッドのイベントループが複数接続を多重化する意味を押さえる
- Node.js の net モジュールで createServer と createConnection を書ける
- `ulimit -n` で自環境の同時オープン上限を確認し、必要なら一時的に引き上げられる

**完成条件 (自己採点用チェックリスト)**

- [ ] createMultiplexedEchoServer が socket の data イベントごとに transform を適用し、metrics の connections と messages と bytes を加算する
- [ ] echoRoundTrip(port, 'a') が 'A' を返し、3クライアント同時実行で3件とも正しい応答が返る
- [ ] await でブロックする素朴版と data イベント版の2実装を用意し、同じ負荷で総所要時間とRSSを表として記録する
- [ ] 接続クローズ時に内部の Set からソケットが削除され、server.close() 後に残存ソケットが destroy される
- [ ] 同時1000接続以上でも接続確立エラー (EMFILE や ECONNREFUSED) を出さずに完走する

**期待出力**

- 計測スクリプトが 接続数 / 総メッセージ数 / 総バイト数 / 経過ms / RSSバイト を出力し、ブロック版と多重化版で経過msが数倍違う
- echo サーバ起動時に echo server on 127.0.0.1:3001 の1行が出る
- metrics オブジェクトは connections、messages、bytes の3キーを持つ数値レコードになる

**観察項目**

- ブロック版では1接続の処理中に他接続の応答が止まるため、クライアント側の往復時間の分布が階段状になることを確認する
- `ss -tan state established` の行数を数え、サーバ側の同時接続数と一致するか確認する
- process.memoryUsage().rss を接続数100/1000/10000で記録し、1接続あたりのメモリ増分を算出する
- 接続数を増やしていくと EMFILE が出る境界と `ulimit -n` の値の関係を確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch18 run test` を実行し、multiplexed echo server handles concurrent clients が通ることを確認する
2. code/ch18 で `tsx --test solutions.test.ts` を実行し、3並列の応答が A、B、C になり metrics.messages が 3 になることを確認する
3. `PORT=3001 tsx epoll-style-server.solution.ts` を起動し、別端末の `nc 127.0.0.1 3001` から hi を送って HI が返れば合格

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: まず「1接続を await で占有する版」と「data イベントで即応答する版」を別関数に分け、同じベンチマーク関数から呼べる形にする。計測対象は経過時間とRSSの2つに絞る
2. 構造: net.createServer のコールバックで socket.on('data') を登録し、Set<Socket> へ登録して close と error で削除する。メトリクスは connections/messages/bytes の3カウンタを持つオブジェクトを共有参照で返す
3. 実装の要点: data イベントの chunk は型上 string になり得るので Buffer.isBuffer で正規化してから length を加算する。クライアント側は socket.once('data') で受けたあと end() しないと接続が残りFDを食う

**本番利用時の警告**

- 10,000接続のベンチは自分のマシンの localhost に対してのみ行う。第三者のホストや共有の検証環境へ同じ負荷をかけると帯域とFDを奪うDoSになり、不正アクセスとして扱われる
- この echo サーバは受信バイト長の上限も接続数上限もタイムアウトも持たないため、公開すると1接続の巨大送信でメモリを食い尽くされ、接続を握ったまま放置する Slowloris 型の攻撃で停止する。本番では maxConnections、requestTimeout、backpressure 処理を持つ実装を使う

**導線**

- 開始地点: `epoll-style-server.ts`
- 模範解答: `epoll-style-server.solution.ts`

### 18.2 課題18.2: ファイルディスクリプタとリーク検出 (★★)

**目的**: 「FD を閉じ忘れる」とどうなるか、ulimit -n まで使い切る実演。

**難易度**: ★★

**推定時間**: 90分 (計測関数と open/close 版の実装に30分、ulimit を下げた枯渇再現と EMFILE 観察に35分、/proc と lsof の突き合わせ記録に25分)

**必要サービス**: なし

**前提**

- 18.2 ファイルディスクリプタ ― 全ては「ファイル」 を読み、プロセスごとのFDテーブルと ulimit の関係を把握する
- node:fs/promises の open が返す FileHandle と close の対応を書ける
- Linux 環境 (またはLinuxコンテナ) で /proc/self/fd を読める。macOS では `lsof -p $$` の行数で代替する

**完成条件 (自己採点用チェックリスト)**

- [ ] openMany(1000) が1000個の FileHandle を返し、その間 countOpenFileDescriptors() の値が開く前より約1000増える
- [ ] closeAll(handles) 後に countOpenFileDescriptors() が開く前の水準へ戻る
- [ ] openMany(count, true) の close 込み版と close しない版でFD数の推移を数値として比較・記録する
- [ ] `ulimit -n` を 64 などへ下げた状態で openMany を回し、EMFILE が発生する件数を記録する
- [ ] countOpenFileDescriptors() が /proc の無い環境で undefined を返し、テストが失敗せずスキップ相当になる

**期待出力**

- `tsx fd-leak.solution.ts 100` が count / before / during / after の4キーを持つJSONを1行出力し、during が before より約100大きく after が before と同程度に戻る
- Linux 以外では before/during/after が undefined となり、その値がJSONに現れない
- 上限を超えた場合は EMFILE: too many open files のエラーで停止する

**観察項目**

- `ls /proc/self/fd` の件数を open 前・open 中・close 後の3回数え、増減を確認する
- `lsof -p <pid>` の出力を handbook-fd-demo.txt で絞り、同じファイルに対して独立したFDが count 個できていることを確認する
- `ulimit -n` の soft limit と、実際に EMFILE が出た件数の差 (標準入出力など既存FD分) を確認する
- close 忘れ版を放置し、GC が走ってもFD数が減らない (FileHandle への参照が生きている限り解放されない) ことを確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch18 run test` を実行し、file handles can be observed and closed が通ることを確認する
2. `bash -c 'ulimit -n 64; tsx fd-leak.solution.ts 200'` を実行し、EMFILE で落ちれば上限到達の再現に成功
3. `tsx fd-leak.solution.ts 500` の出力で during から before を引いた値が500前後、after が before と一致すれば合格

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: まず「FD数を数える関数」を先に作る。数えられないと増減が観測できない。/proc/self/fd の readdir を try/catch で包み、無い環境では undefined を返す方針にする
2. 構造: open(path, 'a+') を count 回ループして FileHandle の配列へ貯める関数と、全件 close する関数の2つに分ける。close の途中失敗で残りを閉じ損ねないよう Promise.all ではなく allSettled を使う
3. 実装の要点: 同じパスを何度 open してもFDは毎回新規に割り当てられる点が肝。tmpdir() 配下の1ファイルで十分で、before/during/after は必ず await を挟んだ後に取得しないと close が反映されない

**本番利用時の警告**

- FDを意図的に枯渇させる実験は使い捨てのコンテナかVMで行う。共有サーバで ulimit 近くまで開くと、同じユーザーで動く他プロセスが accept や open に失敗して巻き添えで停止する
- 実サービスで FileHandle を close せず貯めると、数時間後に EMFILE で新規接続を一切受けられなくなり再起動以外に復旧手段がなくなる。本番では try/finally か using 宣言で必ず解放する

**導線**

- 開始地点: `fd-leak.ts`
- 模範解答: `fd-leak.solution.ts`

### 18.3 課題18.3: シグナルハンドリングとグレースフルシャットダウン (★★)

**目的**: SIGTERM を受けたときに「進行中のリクエストを完了 → 新規拒否 → 終了」する実装。

**難易度**: ★★

**推定時間**: 90分 (サーバとカウンタの実装に30分、SIGTERM を送ってのドレイン確認と503確認に30分、タイムアウト経路と未対応版の比較に30分)

**必要サービス**: localhost

**前提**

- 18.3 シグナル ― プロセス間通信の基礎 を読み、SIGTERM と SIGKILL の違いを押さえる
- 18.1 プロセスとスレッド を読み、プロセス終了時に何が破棄されるかを把握する
- node:http の createServer と server.close() の挙動 (既存接続は残る) を知っている
- `kill -TERM <pid>` で任意のプロセスへシグナルを送れる

**完成条件 (自己採点用チェックリスト)**

- [ ] GracefulHttpServer が shutdown 開始後の新規リクエストへ 503 と connection: close を返す
- [ ] shutdown(timeoutMs) が処理中リクエストの完了を待って drained を返し、待ち切れない場合に timeout を返す
- [ ] activeRequests が処理中は1以上、完了後は0になる
- [ ] timeout 到達時に server.closeAllConnections() が呼ばれ、プロセスが確実に終了する
- [ ] SIGTERM ハンドラから shutdown() を呼び、進行中の1件が 200 で完了してからプロセスが終了コード0で終わる

**期待出力**

- shutdown 中に投げたリクエストは 503 と本文 shutting down を返す
- shutdown 前に開始したリクエストは 200 と本文 ok を返し、shutdown() の戻り値が drained になる
- SIGTERM を送ると標準出力に drained または timeout の1語が出てから終了する

**観察項目**

- `curl -sv http://127.0.0.1:3002/` の直後に `kill -TERM <pid>` を送り、進行中の1件が完走してから終了することを確認する
- SIGTERM 直後に `curl -o /dev/null -w '%{http_code}' http://127.0.0.1:3002/` を実行し 503 が返ることを確認する
- handler の待ち時間をタイムアウトより長くして timeout 側の経路に入れ、closeAllConnections により curl が接続断エラーになることを確認する
- SIGTERM ハンドラを外した版と比較し、処理中レスポンスが途中で切れて curl が Empty reply from server になることを確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch18 run test` を実行し、graceful shutdown drains active requests が通ることを確認する
2. `PORT=3002 tsx graceful-shutdown.solution.ts` を起動し、`kill -TERM $(pgrep -f graceful-shutdown)` の後に終了コードが 0 なら合格
3. shutdown 中の新規が 503、既存が 200 の2点が揃えばグレースフル成立と判定する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 「新規を止める」「進行中を数える」「待つ」の3つに分けて考える。まず処理中リクエスト数のカウンタを増減させるところから作る
2. 構造: http.createServer のハンドラを try/finally で包み finally でカウンタを減らす。shutdown() では shuttingDown フラグを立てて server.close() を呼び、カウンタが0になるまで短い間隔でポーリングする
3. 実装の要点: Node.js 19 以降の server.close() は、listener を止めると同時にアイドルな keep-alive 接続も切る。停止処理の冒頭で呼ぶと、停止中に届いた要求は 503 ではなく接続拒否になり、完成条件1を満たせない。順序は「停止フラグを立てる → 処理中の要求が終わるまで待つ → close() と closeAllConnections()」にすること

**本番利用時の警告**

- このサーバは待機中の新規接続へ 503 を返すだけで、ロードバランサからの切り離しは行わない。本番では readiness を先に落とし、LBが対象から外すまでの数秒を待ってから close しないと、切替の隙間でエラーを利用者に返す
- Kubernetes の terminationGracePeriodSeconds より長い待ち時間を設定すると SIGKILL で強制終了され、進行中の処理が中断されて書きかけのデータが残る。タイムアウトは必ず猶予期間より短くする

**導線**

- 開始地点: `graceful-shutdown.ts`
- 模範解答: `graceful-shutdown.solution.ts`

### 18.4 課題18.4: 自作 L7 ロードバランサ (★★★)

**目的**: nginx のような L7 ロードバランサを Node.js で実装し、ロードバランシング戦略を試す。

**難易度**: ★★★

**推定時間**: 150分 (選択ロジックと転送処理の実装に55分、3戦略の切替と分布計測に40分、ヘルスチェック除外と502経路の確認に35分、ヘッダ転送の確認に20分)

**必要サービス**: localhost

**前提**

- 18.7 ロードバランサ ― L4 vs L7 を読み、L7が中身を見て振り分ける意味を押さえる
- 18.8 リバースプロキシとしての nginx を読み、X-Forwarded-For などの転送ヘッダの役割を把握する
- node:http の http.request でリクエストを転送し、pipe でストリームをつなげる
- バックエンド用の簡易HTTPサーバを2つ以上、別ポートで起動できる

**完成条件 (自己採点用チェックリスト)**

- [ ] LoadBalancer が round-robin と least-conn と random の3戦略を options.strategy で切り替えられる
- [ ] round-robin で2バックエンドへ交互に振り分けられ、連続2リクエストの応答が a、b の順になる
- [ ] markHealthy(index,false) で除外したバックエンドへ振り分けられず、全滅時は 503 と本文 no healthy backends を返す
- [ ] 転送先へ host ヘッダをバックエンドのホストへ書き換え、x-forwarded-for に元クライアントIPを載せる
- [ ] バックエンドが落ちている場合に upstream の error で 502 bad gateway を返し、そのバックエンドの healthy が false になる

**期待出力**

- round-robin で2回 GET すると本文が a、b の順で返る
- least-conn では active 数が最小のバックエンドが選ばれ、同数なら先頭が選ばれる
- 全バックエンドを unhealthy にすると HTTP 503 と本文 no healthy backends が返る
- バックエンド側に届くヘッダの x-forwarded-for が 127.0.0.1 になる

**観察項目**

- 各バックエンドが受けた件数を数え、3戦略それぞれの分布 (交互、偏り、ランダム) を比較する
- 1つのバックエンドを長時間レスポンスにして least-conn を回し、active が増えた側が選ばれなくなることを確認する
- `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/` をバックエンド停止の前後で実行し、200 から 502 へ変わる瞬間を確認する
- バックエンド側で受信ヘッダをダンプし、host が書き換わり x-forwarded-for が付与されていることを確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch18 run test` を実行し、round robin load balancer distributes requests が通ることを確認する
2. code/ch18 で `tsx --test solutions.test.ts` を実行し、2回のGET結果が a と b の順になることを確認する
3. strategy を least-conn と random に変えて同じ2回GETを行い、round-robin と分布が変わることを目視で確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 「バックエンド選択」と「プロキシ転送」を別メソッドに分ける。選択側を healthy なものだけを対象にした関数として書くと、3戦略の差が1行ずつで表現できる
2. 構造: バックエンドは url と active と healthy の3フィールドを持つ配列で持つ。round-robin は cursor を件数で剰余、least-conn は reduce で active 最小、random は乱数関数を注入可能にするとテストできる
3. 実装の要点: 転送では headers の host を必ずバックエンドの host へ書き換える (元のままだと仮想ホストが誤動作する)。active カウンタは upstream の close イベントで減らさないと、error 時に減らし忘れて偏る

**本番利用時の警告**

- この LB は x-forwarded-for を上書きするだけで既存値を検証しないため、公開するとクライアントが偽のIPを送ってIP制限やレート制限を回避できる。本番では信頼できるプロキシからの値だけを採用する
- ヘルスチェックは upstream エラー時に healthy を false にするだけで復帰処理が無い。一度落ちたバックエンドは永久に外れ、全滅すると全リクエストが 503 になる。本番では定期的な能動ヘルスチェックと復帰判定が必須
- リクエストサイズ上限もタイムアウトも無いため、そのまま公開すると巨大ボディや遅延接続でLBプロセス自体が枯渇する

**導線**

- 開始地点: `load-balancer.ts`
- 模範解答: `load-balancer.solution.ts`

### 18.5 課題18.5: ネットワークデバッグツール (mini-tcpdump) (★)

**目的**: 生のソケットでパケットの内容を覗く (教育用、Linux で実行)。

**難易度**: ★

**推定時間**: 45分 (hexDump と httpPreview の実装に20分、中継プロキシの配線に15分、curl での確認と非HTTPデータの比較に10分)

**必要サービス**: なし

**前提**

- 18.5 ネットワークスタック を読み、TCPペイロードとアプリケーションデータの関係を押さえる
- 18.9 トラブルシュート用コマンド集 を読み、tcpdump が何を表示しているかを把握する
- Buffer から16進文字列とASCII表現を作れる (toString(16) と padStart)

**完成条件 (自己採点用チェックリスト)**

- [ ] hexDump(buffer) が 1行16バイト、4桁16進のオフセット + 16進列 + ASCII列 の形式で出力する
- [ ] 非印字バイト (32未満と127以上) がASCII列でドットに置換される
- [ ] httpPreview(buffer) が GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS で始まる場合だけ先頭4行を返し、それ以外は undefined を返す
- [ ] createCapturingProxy が listenPort で待ち受け、targetPort へ中継しつつ onCapture へダンプを渡す
- [ ] プロキシ経由の `curl http://127.0.0.1:<listenPort>/` が本来のレスポンスを取得できる (中継が壊れていない)

**期待出力**

- GET リクエストのダンプ1行目が 0000 で始まり 47 45 54 20 2f の並びを含み、右端のASCII列に GET / HTTP/1.1 が読める
- httpPreview がリクエストラインと Host ヘッダを含む数行の文字列を返す
- HTTPでないバイナリデータでは httpPreview が undefined になり、16進ダンプだけが出る

**観察項目**

- 同じリクエストを `tcpdump -i lo0 -A port 3001` や Wireshark と並べ、自作ダンプと同じバイト列が見えることを確認する
- curl に -H でヘッダを追加し、増えたバイト数がダンプの行数増加と一致することを確認する
- keep-alive で2回リクエストすると、1本の接続に対して onCapture が2回呼ばれることを確認する
- HTTPS の通信を同じプロキシに通し、TLSレコードのため中身が読めず先頭が 16 03 になることを確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch18 run test` を実行し、hex dump and HTTP preview expose packet contents が通ることを確認する
2. code/ch18 で `tsx --test solutions.test.ts` を実行し、hexDump の出力が 47 45 54 を含み httpPreview が Host を含むことを確認する
3. createCapturingProxy を起動して `curl -s http://127.0.0.1:9999/` を叩き、標準出力にダンプが出つつレスポンスも返れば合格

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 16進ダンプは「16バイトずつ切って3列 (オフセット、16進、ASCII) に整形する」だけの文字列処理。ネットワークと切り離し Buffer.from('GET / HTTP/1.1') で先に完成させる
2. 構造: subarray で width バイト取り出し、padStart(2,'0') で16進化、padEnd で桁揃え、32以上127未満だけを文字にする。傍受は net.createServer と net.createConnection の双方向 write で作る
3. 実装の要点: 最終行は16バイト未満になるため padEnd を忘れるとASCII列がずれる。HTTP判定はメソッド名と空白の先頭一致にし、本文中に現れる同じ文字列に反応しないようにする

**本番利用時の警告**

- この傍受プロキシは自分で立てた localhost のサーバ宛の通信にだけ使う。第三者や社内の他人のトラフィックを同じ手法で覗くと、通信の秘密の侵害および不正アクセスにあたる
- 傍受したダンプにはリクエストの Cookie や Authorization ヘッダが平文で含まれる。ログとして保存したりチケットへ貼ると認証情報の漏洩になるため、実験後は必ず破棄する

**導線**

- 開始地点: `mini-tcpdump.ts`
- 模範解答: `mini-tcpdump.solution.ts`

## 評価方法

1. starterから開始し、本文の要件と課題詳細の完成条件を満たす。
2. 期待出力・観察項目を記録する。
3. 完成条件のチェックリストで自己採点し、未達項目を残す。
4. solutionとの差分を説明する。
5. `pnpm --filter @handbook/ch18 run test` を実行する。

## 安全上の注意

- 脆弱性・ネットワーク・OS・コンテナの演習は、localhostまたは隔離環境だけで実行してください。
- 教材用の簡略実装をそのまま本番へ投入しないでください。
- 各課題の「本番利用時の警告」を読まずに、演習コードを製品コードへ流用しないでください。

## 配布対象外

`node_modules/`、`dist/`、`coverage/`、一時DB、秘密情報、計測生成物は配布対象外です。
