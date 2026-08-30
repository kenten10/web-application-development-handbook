# 第24章 パフォーマンス — コード教材

## 前提環境

- Node.js 24.18.0 LTS
- pnpm 11.15.1
- TypeScript 6.0.3

## 共通コマンド

```bash
pnpm install
pnpm --filter @handbook/ch24 run lint
pnpm --filter @handbook/ch24 run typecheck
pnpm --filter @handbook/ch24 run test
pnpm --filter @handbook/ch24 run build
```

> `solution` は要件一覧ではなく、実行・観察できる模範実装でなければなりません。`referenceArtifact` や `model answer scaffold` は検証エラーになります。

## 課題一覧

| 課題 | 開始地点 | 模範解答 | 難易度 | 推定時間 | 必要サービス |
|---|---|---|---:|---:|---|
| 24.1 課題24.1: 負荷テストツール自作 (★★★) | `mini-loadtest.ts` | `mini-loadtest.solution.ts` | ★★★ | 150分 | localhost |
| 24.2 課題24.2: CPU プロファイラ (サンプリング型) (★★★) | `profiler.ts` | `profiler.solution.ts` | ★★★ | 150分 | なし |
| 24.3 課題24.3: LRU / LFU キャッシュ実装 (★★) | `cache.ts` | `cache.solution.ts` | ★★ | 90分 | なし |
| 24.4 課題24.4: N+1 自動検出 + DataLoader 比較 (★★) | `n1-monitor.ts` | `n1-monitor.solution.ts` | ★★ | 90分 | なし |
| 24.5 課題24.5: Web Vitals 計測スクリプト (LCP/INP/CLS) (★★) | `web-vitals.html` | `web-vitals.solution.html` | ★★ | 90分 | Chrome, localhost |

## 課題詳細

### 24.1 課題24.1: 負荷テストツール自作 (★★★)

**目的**: autocannon / k6 風の HTTP 負荷テストツールを実装。

**難易度**: ★★★

**推定時間**: 150分 (worker 並行制御の実装35分、パーセンタイルと集計の実装30分、テスト用サーバの用意と実行25分、並行数を変えた飽和点の観察と記録60分)

**必要サービス**: localhost

**前提**

- 24.8 負荷テスト を読み、オープンモデルとクローズドモデルの違いと飽和点の見方を説明できる
- 22.7 SLI / SLO / SLA (第22章) を参照し、パーセンタイルをSLOへ接続する考え方を確認する
- node:http の createServer でローカルの計測対象サーバを起動できる
- async 関数を固定数の worker で並行実行するパターンを書ける

**完成条件 (自己採点用チェックリスト)**

- [ ] runLoadTest(url, {concurrency, requests}) が指定リクエスト数ちょうどで停止し、result.requests が指定値に一致する
- [ ] durationMs を指定した場合に、指定時間を過ぎた時点で新規リクエストを発行しなくなる
- [ ] statusCodes がステータスコードごとの件数マップになり、合計が requests と一致する
- [ ] percentile([1,2,3,4], 0.5) が 2 を返し、空配列では 0 を返す
- [ ] 結果に p50 と p90 と p99 と throughput が含まれ、throughput が0より大きい
- [ ] concurrency に0以下を渡すと concurrency must be positive で例外になる

**期待出力**

- 戻り値が requests / errors / durationMs / throughput / latencies / statusCodes / p50 / p90 / p99 の9キーを持つオブジェクトになる
- ローカルの即答サーバ相手では p50 が数ミリ秒台、throughput が数百から数千 req/s のオーダーになる
- latencies の長さが requests と一致し、statusCodes の 200 が全件になる

**観察項目**

- concurrency を1, 10, 100 と上げ、throughput が頭打ちになる点と p99 が跳ね上がる点がどこでずれるかを記録する
- 計測プロセスと対象サーバが同一マシンで動いていることを踏まえ、負荷生成側のCPUが先に飽和していないかを top などで確認する
- レスポンスボディを arrayBuffer() で読み切る行を外し、レイテンシの数値がどう変わるかを比較して「どこまでを応答時間と呼ぶか」を確定させる

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch24 exec tsx --test --test-name-pattern="load tester" solutions.test.ts` を実行し、passすれば合格
2. `pnpm --filter @handbook/ch24 run test` で章の5件がすべてpassすることを確認する
3. 自作実装で createServer(0) の一時サーバへ concurrency:4, requests:20 で実行し、statusCodes[200] が20、latencies の長さが20になれば計数が正しいと判定する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 総リクエスト数を先に配列で作って Promise.all するとメモリを食い、並行数の制御にならない。固定数の worker が「まだ続けてよいか」を毎回問い合わせるループ構造から設計する
2. 構造: should() のような継続条件関数に、時間の締め切りとリクエスト上限の両方を入れる。worker は while (should()) の中で発行時刻を performance.now() で取り、fetch と本文読み切りのあと差分を latencies に push する
3. 実装の要点: パーセンタイルは昇順ソート後 Math.ceil(p * n) - 1 番目を取り、上限を n - 1 で clamp する。エラーは reject と、レスポンスは返るが ok でない場合の2種類あり、どちらも errors に数えつつレイテンシは記録する

**本番利用時の警告**

- 負荷をかける対象は自分のマシンのlocalhostか、自分が明確に所有し許可を得た検証環境だけに限定する。第三者のサイトやSaaS、共用のステージング環境へ向けて実行するとDoS攻撃と区別がつかず、契約違反や不正アクセスにあたる
- このツールは負荷生成側と計測対象を同一ホストで走らせる前提で、CPUとネットワークスタックを共有する。得られた数値は絶対値としては使えず、同一条件での改善前後の比較にのみ使う
- レイテンシを全件配列で保持するため長時間の実行でメモリが線形に増え、接続の再利用やキープアライブ、DNS解決コスト、TLSハンドシェイクの分離も行っていない。本番の容量計画には k6 や autocannon など、ヒストグラム集約と分散実行を持つツールを使う

**導線**

- 開始地点: `mini-loadtest.ts`
- 模範解答: `mini-loadtest.solution.ts`

### 24.2 課題24.2: CPU プロファイラ (サンプリング型) (★★★)

**目的**: 「重い関数」を見つけるためのプロファイラを自作。

**難易度**: ★★★

**推定時間**: 150分 (AsyncLocalStorage によるフレーム管理の実装30分、self と total の集計実装35分、flamegraph 出力25分、間隔を変えた取りこぼしと同期ブロックの盲点の観察60分)

**必要サービス**: なし

**前提**

- 24.7 プロファイリング を読み、サンプリング型とインストルメンテーション型の違いを説明できる
- 自己時間 (self) と累積時間 (total) の定義を区別できる
- node:async_hooks の AsyncLocalStorage で非同期をまたぐコンテキストを保持できる
- setInterval で一定間隔のタイマーを起動・停止できる

**完成条件 (自己採点用チェックリスト)**

- [ ] withFrame(name, fn) がスタックへフレーム名を積み、fn の実行中だけ有効になる
- [ ] start() でタイマーが起動し、二重に start() を呼ぶと already started で例外になる
- [ ] report() の entries が関数名をキーに self と total を持つ Map を返す
- [ ] 同じ呼び出し経路を3回サンプリングしたとき、親フレームの total が3、葉フレームの self がその葉の出現回数に一致する
- [ ] flamegraph() が「フレームをセミコロンで連結した経路 スペース 回数」という行を、回数の降順で出力する
- [ ] stop() がタイマーを解除し、report() と同じ集計結果を返す

**期待出力**

- report() が samples と entries と Object の3キーを返し、samples が記録済みスタック数になる
- flamegraph() の出力が request;db 2 のような1行1経路のテキストになる
- 葉にならないフレームは self が0のまま total だけが増える

**観察項目**

- サンプリング間隔を1msから10msへ変えたとき、短時間しか走らない関数が結果から消えることを確認し、サンプリングの取りこぼしを体感する
- self が大きい関数と total が大きい関数を並べ、前者が「そこで時間を使っている」、後者が「そこを経由している」の違いになることを確認する
- 同期の重いループと await を挟む処理の両方を計測し、AsyncLocalStorage がどちらでフレームを保てているかを確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch24 exec tsx --test --test-name-pattern="sampling profiler" solutions.test.ts` を実行し、passすれば合格
2. `pnpm --filter @handbook/ch24 run test` で章の5件がすべてpassすることを確認する
3. 自作実装で record(['a','b']) を2回、record(['a','c']) を1回与え、a の total が3、b の self が2になれば集計が正しいと判定する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: タイマーで実際に採取する前に、スタック配列を直接渡して集計だけを検証できる record() を用意する。集計のバグとタイマーのバグを切り離せる
2. 構造: AsyncLocalStorage に文字列配列を入れ、withFrame は既存のストアに名前を足した新しい配列で run する。集計はサンプルごとに全フレームの total を加算し、末尾のフレームだけ self を加算する
3. 実装の要点: flamegraph は経路 (配列を join(';') した文字列) をキーにした回数の Map にして降順ソートする。start() を二重に呼ぶとタイマーが漏れるので、既存タイマーの有無を先に検査して例外にする

**本番利用時の警告**

- このプロファイラは自前の withFrame で明示的に囲んだ範囲しか見えず、ライブラリ内部やV8のネイティブフレーム、GCの停止時間は一切現れない。本番のCPU分析には node --cpu-prof や --inspect で取る V8 のプロファイルを使う
- setInterval によるサンプリングはイベントループが空いたときにしか発火しないため、同期の長いブロックの最中はサンプルが1つも取れず、最も重い区間が結果から欠落する。この構造的な盲点を知らずに「重い関数が見つからない」と判断してはいけない
- 全サンプルのスタックを配列で保持し続けるので、長時間の常時プロファイリングでメモリが増え続ける。本番で常駐させる場合は集約済みカウンタだけを保持し、サンプリング頻度も落とす必要がある

**導線**

- 開始地点: `profiler.ts`
- 模範解答: `profiler.solution.ts`

### 24.3 課題24.3: LRU / LFU キャッシュ実装 (★★)

**目的**: 2つの主要なキャッシュ追い出し戦略を実装。

**難易度**: ★★

**推定時間**: 90分 (LRU の実装20分、LFU のタイブレーク込み実装30分、ベンチマーク関数と偏り分布の生成20分、両方式のヒット率比較と汚染現象の観察20分)

**必要サービス**: なし

**前提**

- 24.5 キャッシュ戦略 を読み、キャッシュヒット率と追い出し方針の関係を説明できる
- 24.6 アルゴリズムとデータ構造 を読み、O(1) 操作を実現するデータ構造の考え方を確認する
- JavaScript の Map が挿入順を保持することを知っている
- Zipf 分布のような偏りのあるアクセス列を生成できる

**完成条件 (自己採点用チェックリスト)**

- [ ] LRUCache(2) に a と b を入れて a を get したあと c を set すると、b が追い出される
- [ ] LFUCache(2) で同じ操作をしたとき、参照回数の少ない b が追い出される
- [ ] LFU で頻度が同じ要素が複数あるとき、最後に使われた時刻が最も古いものが追い出される
- [ ] get したキーが LRU では最新位置へ移動し、keys() の並びが更新される
- [ ] capacity に0以下を渡すと例外になる
- [ ] benchmarkCache(cache, sequence) が operations と hits と hitRate を返し、hitRate が0以上1以下になる

**期待出力**

- benchmarkCache の戻り値が {operations: 列の長さ, hits: 命中回数, hitRate: hits/operations} という3キーのオブジェクトになる
- 偏りの強いアクセス列では LFU のヒット率が LRU を上回り、一様ランダムやスキャン的な列では差が縮むか逆転する
- has() が追い出されたキーに対して false を返す

**観察項目**

- 同じアクセス列を LRU と LFU に流し、ヒット率の差が分布の偏り (Zipf の指数) によってどう変わるかを表にする
- 全要素を1回ずつなめるスキャン的アクセスを流し、LRU のキャッシュ内容が全入れ替えになる cache pollution を確認する
- LFU で一度だけ大量参照された古いキーが居座り続ける現象を再現し、頻度の減衰 (aging) が必要になる理由を確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch24 exec tsx --test --test-name-pattern="LRU and LFU" solutions.test.ts` を実行し、passすれば合格
2. `pnpm --filter @handbook/ch24 run test` で章の5件がすべてpassすることを確認する
3. 自作実装に容量2で a, b, get(a), c の順に操作し、has('b') が false、has('a') が true になれば追い出し方針が正しいと判定する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 自前の双方向連結リストを書く前に、Map が挿入順を保つ性質で LRU が書けないかを検討する。LFU は順序だけでは足りず、頻度と最終使用時刻の2つの鍵が要ると気づくのが分かれ目
2. 構造: LRU は get のたびに delete してから set し直すことで末尾へ移動させ、size が capacity を超えたら keys().next().value を削除する。LFU は値と freq と tick を持つエントリを Map に入れ、追い出し時に freq 昇順、同値なら tick 昇順で最小を選ぶ
3. 実装の要点: LRU の get では値が undefined のときに delete/set をしてはいけない (未登録キーを登録してしまう)。LFU の set は既存キーの更新と新規挿入で分岐し、容量チェックは新規挿入時だけ行う

**本番利用時の警告**

- この実装は TTL (有効期限) を持たないため、元データが更新されても古い値を返し続ける。実サービスでキャッシュ層に使うと、削除済み・権限変更済みのデータを配り続ける情報漏えいにつながる
- LFU の追い出し候補探索は Map 全体を線形走査するため、容量が大きいと set のたびに O(n) かかる。100万件級のベンチマークでは追い出しコスト自体が測定結果を歪めるので、本番実装では頻度リスト方式で O(1) にする
- プロセス内キャッシュはインスタンスごとに独立し、値の書き込み時に他インスタンスへ無効化が伝わらない。複数台構成では Redis などの共有キャッシュか、明示的な無効化チャネルが必要になる

**導線**

- 開始地点: `cache.ts`
- 模範解答: `cache.solution.ts`

### 24.4 課題24.4: N+1 自動検出 + DataLoader 比較 (★★)

**目的**: 課題14.3 を発展させ、N+1 が起きると警告するモニタリングを実装。

**難易度**: ★★

**推定時間**: 90分 (AsyncLocalStorage によるリクエストスコープの実装25分、閾値判定と警告生成の実装25分、MiniDataLoader のバッチ実装25分、バッチ有無の呼び出し回数比較15分)

**必要サービス**: なし

**前提**

- 24.4 バックエンド最適化 を読み、N+1 クエリが発生する典型パターンを説明できる
- 第14章の課題14.3 で扱った N+1 とバッチ取得の関係を思い出しておく
- node:async_hooks の AsyncLocalStorage でリクエストスコープを表現できる
- queueMicrotask と Promise の解決順序を説明できる

**完成条件 (自己採点用チェックリスト)**

- [ ] withRequest(id, fn) の外で recordQuery() を呼ぶと recordQuery must run inside withRequest で例外になる
- [ ] 同一リクエスト内で同じクエリパターンを threshold 回記録したときに警告が1件だけ増える
- [ ] 警告オブジェクトが requestId と pattern と count と stack の4キーを持つ
- [ ] threshold を超えて呼び続けても警告が重複して増えない
- [ ] 別の withRequest スコープではカウンタが独立し、警告が引き継がれない
- [ ] MiniDataLoader で同一キーを2回 load しても batch 関数の呼び出しが1回で済む

**期待出力**

- threshold:3 で4回 recordQuery した場合、warnings() の長さが1になる
- 警告の stack に初回記録時の呼び出し位置が文字列として含まれる
- MiniDataLoader.load(1) を Promise.all で2本同時に呼ぶと、両方とも同じ値を返しつつバッチ回数が1になる

**観察項目**

- クエリのパターン (プレースホルダ付きSQL) とパラメータを分けて記録する設計により、値だけ違う同型クエリが1つのパターンへ集約される様子を確認する
- 警告に添付される stack が「初回に記録した時点」のものであることを確認し、N+1 の発生源を特定するには最初の呼び出し位置が必要な理由を読み取る
- DataLoader を通したときと通さないときで、batch 関数の呼び出し回数が N から1へ変わることを数え、往復回数の削減がどこに効くかを確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch24 exec tsx --test --test-name-pattern="monitor warns at threshold" solutions.test.ts` を実行し、passすれば合格
2. `pnpm --filter @handbook/ch24 run test` で章の5件がすべてpassすることを確認する
3. 自作実装で threshold:5 のまま同一パターンを10回記録し、warnings() の長さが1、count が5であれば発火条件が正しいと判定する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 「同じリクエストの中で」という条件をどう表現するかが要点。グローバル変数では並行リクエストが混ざるので、非同期をまたいで持ち回れるコンテキストを先に用意する
2. 構造: AsyncLocalStorage.run() でリクエストIDとクエリ集計 Map と警告配列を持つ状態を作り、recordQuery は getStore() でそれを取り出してパターン別にカウントする。DataLoader は保留キーの Map と queueMicrotask による1回のフラッシュで組む
3. 実装の要点: 警告が重複しないよう、発火条件は count > threshold ではなく count === threshold の等値比較にする。DataLoader の flush では先に pending を新しい Map に差し替えてから await しないと、バッチ中に来た load を取りこぼす

**本番利用時の警告**

- この監視は recordQuery を明示的に呼んだ箇所しか見えず、ORMやドライバの内部で発行されるクエリは捕捉できない。本番ではドライバのフックや OpenTelemetry の計装を通す必要がある
- 警告のたびに Error().stack を生成するのはコストが高く、リクエストごとに Map と配列を保持し続けるためメモリも増える。開発環境限定のフラグで囲まず本番へ入れると、監視自体が性能問題になる
- MiniDataLoader はキャッシュの無効化も TTL も持たず、batch がキーを返さないと例外で全体が落ちる。リクエストをまたいで使い回すと古い値を配るため、リクエスト単位で生成し捨てる運用が前提になる

**導線**

- 開始地点: `n1-monitor.ts`
- 模範解答: `n1-monitor.solution.ts`

### 24.5 課題24.5: Web Vitals 計測スクリプト (LCP/INP/CLS) (★★)

**目的**: Chrome DevTools が見せる Core Web Vitals を、JavaScript で実測。

**難易度**: ★★

**推定時間**: 90分 (3種のオブザーバ設置と状態管理の実装35分、シフト発生とINP計測用の操作要素の実装20分、スロットリングを変えた計測と DevTools との突き合わせ35分)

**必要サービス**: Chrome, localhost

**前提**

- 24.1 Core Web Vitals を読み、LCP と CLS と INP のしきい値と対象イベントを説明できる
- 24.2 フロントエンド最適化 を読み、レイアウトシフトの原因を挙げられる
- PerformanceObserver の observe に type と buffered を渡す書き方を知っている
- ローカルHTTPサーバ (npx http-server など) でファイルを配信し、Chrome で開ける

**完成条件 (自己採点用チェックリスト)**

- [ ] PerformanceObserver.supportedEntryTypes を確認してから observe を呼び、非対応環境でも例外を出さない
- [ ] largest-contentful-paint を buffered:true で観測し、ページ表示直後から LCP の値が表示される
- [ ] layout-shift のうち hadRecentInput が true のエントリを除外して CLS を累積する
- [ ] type:'event' を durationThreshold 付きで観測し、ボタン操作後に INP の値が更新される
- [ ] 計測結果が window.__webVitals から読め、画面上の output 要素にもJSONとして表示される
- [ ] レイアウトシフトを起こすボタンを押すと、約1.2秒後にシフトが起き CLS の値が増加する (クリック直後に動かすと `hadRecentInput` が true になり、意図どおり CLS へ加算されない)

**期待出力**

- output 要素に LCP と CLS と INP の3キーを持つJSONが整形表示され、初期状態では値が null と0になる
- LCP と INP はミリ秒の整数、CLS は小数第4位までの無次元の数値として表示される
- DevTools のコンソールで window.__webVitals を評価すると、その時点の3指標が返る

**観察項目**

- ページを再読み込みして LCP の対象要素が何かを DevTools の Performance パネルの LCP マーカーで確認し、スクリプトが返す数値と突き合わせる
- INP 計測用ボタンの中でメインスレッドを意図的に占有し、押してから描画されるまでの遅延が INP の数値として現れることを確認する
- シフトボタンの遅延を 500ms 未満へ縮めると `hadRecentInput` が true になり CLS が増えなくなることを確認する。CLS が測るのは「利用者が意図していない」シフトであり、操作への応答として動くものは対象外である。あわせて DevTools の Network パネルでスロットリングを Fast 3G などに変えて LCP を見る。この教材ページの LCP 対象は文字なので大きくは変わらない。画像を LCP 対象にしたページで比べると差が出る

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch24 exec tsx --test --test-name-pattern="Web Vitals HTML" solutions.test.ts` を実行し、必要なエントリタイプが含まれていればpassする
2. `npx http-server code/ch24 -p 8080` を起動し、Chrome で http://localhost:8080/web-vitals.html を開いて output に LCP の数値が出れば計測が動いていると判定する
3. レイアウトシフト発生ボタンを押し、約1.2秒後のシフトを待ってから output を見る。これを3回繰り返して CLS が単調増加すれば累積が正しいと判定する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 3指標を1つの状態オブジェクトにまとめ、どのオブザーバが発火しても同じ描画関数を呼ぶ構造にする。指標ごとに表示処理を書き分けると同期がずれる
2. 構造: LCP は最後に届いたエントリの startTime、CLS は hadRecentInput が false のエントリの value を加算、INP は event エントリの duration の最大値、という3種類の集約方法を使い分ける。いずれも observe に buffered:true を付けて発行済みのエントリを拾う
3. 実装の要点: event 型は durationThreshold を指定しないと短い操作が届かないため16程度を渡す。CLS の加算は浮動小数の誤差が見えるので toFixed(4) で丸めてから状態へ戻す

**本番利用時の警告**

- この計測はラボ環境の単一ブラウザ・単一ネットワーク条件の値であり、実利用者の分布 (フィールドデータ) ではない。1台のマシンで出た良い数値をSLOの達成根拠にすると、低速端末や低速回線の利用者の実態を見落とす
- INP はこのページでは event エントリの duration の最大値で近似しており、Web Vitals の公式定義 (全操作の分布から高位の値を選ぶ) とは一致しない。本番計測には web-vitals ライブラリを使い、定義の更新に追従させる
- PerformanceObserver のエントリタイプはブラウザによって対応状況が異なり、Safari では layout-shift も largest-contentful-paint も取得できない場合がある。対応していないブラウザで値が空になることを「良好」と誤読してはいけない

**導線**

- 開始地点: `web-vitals.html`
- 模範解答: `web-vitals.solution.html`

## 評価方法

1. starterから開始し、本文の要件と課題詳細の完成条件を満たす。
2. 期待出力・観察項目を記録する。
3. 完成条件のチェックリストで自己採点し、未達項目を残す。
4. solutionとの差分を説明する。
5. `pnpm --filter @handbook/ch24 run test` を実行する。

## 安全上の注意

- 脆弱性・ネットワーク・OS・コンテナの演習は、localhostまたは隔離環境だけで実行してください。
- 教材用の簡略実装をそのまま本番へ投入しないでください。
- 各課題の「本番利用時の警告」を読まずに、演習コードを製品コードへ流用しないでください。

## 配布対象外

`node_modules/`、`dist/`、`coverage/`、一時DB、秘密情報、計測生成物は配布対象外です。
