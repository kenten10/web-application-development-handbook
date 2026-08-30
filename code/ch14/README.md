# 第14章 リレーショナルデータベース — コード教材

## 前提環境

- Node.js 24.18.0 LTS
- pnpm 11.15.1
- TypeScript 6.0.3

## 共通コマンド

```bash
pnpm install
pnpm --filter @handbook/ch14 run lint
pnpm --filter @handbook/ch14 run typecheck
pnpm --filter @handbook/ch14 run test
pnpm --filter @handbook/ch14 run build
```

> `solution` は要件一覧ではなく、実行・観察できる模範実装でなければなりません。`referenceArtifact` や `model answer scaffold` は検証エラーになります。

## 課題一覧

| 課題 | 開始地点 | 模範解答 | 難易度 | 推定時間 | 必要サービス |
|---|---|---|---:|---:|---|
| 14.1 課題14.1: B-Tree インデックスを自作 (★★★) | `btree.ts` | `btree.solution.ts` | ★★★ | 150分 | なし |
| 14.2 課題14.2: トランザクション分離レベル実験 (★★★) | `transaction-isolation/starter/main.ts` | `transaction-isolation/solution/main.ts` | ★★★ | 150分 | PostgreSQL, Docker |
| 14.3 課題14.3: N+1 問題の解決 ― EXPLAIN 比較 (★★) | `n-plus-one/starter/main.ts` | `n-plus-one/solution/main.ts` | ★★ | 90分 | PostgreSQL, SQLite |
| 14.4 課題14.4: 軽量 ORM 自作 (★★★) | `mini-orm/starter/main.ts` | `mini-orm/solution/main.ts` | ★★★ | 150分 | SQLite |
| 14.5 課題14.5: マイグレーション Runner 自作 (★★) | `migration-runner/starter/main.sh` | `migration-runner/solution/main.sh` | ★★ | 90分 | SQLite |
| 14.6 課題14.6: 日時バグを再現して直す (★★★) | `datetime-pitfalls/starter/main.ts` | `datetime-pitfalls/solution/main.ts`<br>`datetime-pitfalls/solution/report.ts` | ★★★ | 150分 | なし |
| 14.7 課題14.7: 個人データの削除・保持・エクスポート・同意の抜けを再現して塞ぐ (★★★) | `data-lifecycle/starter/main.ts` | `data-lifecycle/solution/main.ts`<br>`data-lifecycle/solution/report.ts` | ★★★ | 150分 | なし |

## 課題詳細

### 14.1 課題14.1: B-Tree インデックスを自作 (★★★)

**目的**: 「インデックスがあるとなぜ速いか」を実装で確認。

**難易度**: ★★★

**推定時間**: 150分 (挿入と分割の実装60分、search/range/depth/printの実装40分、linear scanとのベンチマーク30分、次数を変えた観察20分)

**必要サービス**: なし

**前提**

- `14.3 インデックスの内部構造` を読み、B-Treeのノード分割と探索経路の考え方を把握する
- 配列の二分探索と、再帰による木構造の走査をTypeScriptで書ける
- `pnpm install` 済みで `pnpm --filter @handbook/ch14 exec tsx btree.ts` が実行できる

**完成条件 (自己採点用チェックリスト)**

- [ ] `code/ch14/btree.ts` に `BTree<K, V>` を実装し、`insert` / `search` / `range` / `depth` / `print` の5メソッドを公開している
- [ ] 同じキーで2回 `insert` すると値が上書きされ、木の要素数が増えない
- [ ] 次数3で1000件挿入したあとの `depth()` が10未満に収まる
- [ ] `range(10, 13)` がキー昇順で `['v10','v11','v12','v13']` に相当する値配列を返す
- [ ] 1000要素に対する `search` の所要時間が、同じ1000要素の配列 linear scan より10倍以上短い

**期待出力**

- `print()` がレベルごとにインデントされた `[10, 20]` 形式の行を返し、根から葉までの階層が読める
- 1000件挿入後のベンチマークで、B-Tree検索の合計ミリ秒が linear scan の1/10以下になる
- 存在しないキーの `search` が `undefined` を返し、例外にならない

**観察項目**

- 要素数100 / 1000 / 10000 で `depth()` を比較し、深さが対数的にしか増えないことを確認する
- `minDegree` を2、3、8と変えて `print()` の行数とノードあたりのキー数がどう変わるかを見る
- ノードが満杯になる直前と直後で `print()` を出力し、中央のキーが親へ押し上がる瞬間を確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch14 run test` を実行し、`B-Tree supports search, replacement, ranges, depth, and print` がパスすることを確認する
2. `console.time` と `console.timeEnd` で B-Tree検索1000回と `Array.prototype.find` 1000回を計測し、10倍以上の差が出るか確認する
3. `code/ch14/btree.solution.ts` の分割処理と自作実装を読み比べ、分割の発火条件 (キー数が `2 * minDegree - 1`) がずれていないか確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: まず葉ノード1枚だけの配列版から始める。キーを昇順に保つ挿入と線形探索が通ってから、分割を足すと崩れにくい。
2. 構造: ノードは `entries: {key, value}[]` と `children: Node[]` の2配列で表す。`insert` は「根が満杯なら先に分割してから、満杯でない子へ降りる」順序で書き、`search` と `range` は「キーより小さいentryを数えてindexを決める」同じ走査を共有する。
3. 実装の要点: 分割では `entries[minDegree - 1]` を親へ押し上げ、右半分を新ノードへ移す。既存キーの更新を分割より前に処理しないと、同じキーが複数ノードへ重複して残る。

**本番利用時の警告**

- このB-Treeはメモリ上のみでWAL、ページ永続化、クラッシュリカバリを持たないため、プロセス停止でインデックスが丸ごと消える。実データのインデックスはDBMSに任せる
- 削除時のノードのマージと再配分を実装していないため、削除が必要な用途へ流用すると木の不変条件 (各ノードの最小キー数) が壊れて検索が誤る

**導線**

- 開始地点: `btree.ts`
- 模範解答: `btree.solution.ts`

### 14.2 課題14.2: トランザクション分離レベル実験 (★★★)

**目的**: 「Read Committed、Repeatable Read、Serializable」の違いを実演する。

**難易度**: ★★★

**推定時間**: 150分 (環境起動とpsql2セッションの準備20分、4シナリオ×3分離レベルの手動実行60分、コードでの自動化と模擬実装50分、結果表の作成20分)

**必要サービス**: PostgreSQL, Docker

**前提**

- `14.7 トランザクション分離レベル` と `14.8 MVCC ― スナップショットによる並行制御` を読み、Dirty Read / Non-repeatable Read / Phantom Read を区別できる
- `docker compose -f .devcontainer/docker-compose.yml up -d postgres` で postgres:18-alpine サービスを起動できる
- psql で2セッションを同時に開き、`BEGIN` から `COMMIT` までを手動で交互に打てる

**完成条件 (自己採点用チェックリスト)**

- [ ] 2セッションで Non-repeatable Read を再現し、READ COMMITTED では同一トランザクション内の2回の `SELECT balance` が異なる値になることを記録した
- [ ] 同じ手順を REPEATABLE READ で実行し、2回の読み取り値が一致することを記録した
- [ ] 別セッションが条件に合う行を INSERT する Phantom Read シナリオで、READ COMMITTED のとき件数が増えることを確認した
- [ ] Lost Update シナリオを SERIALIZABLE で実行し、後からコミットした側がシリアライズ失敗で拒否されることを確認した
- [ ] `code/ch14/transaction-isolation/starter/main.ts` にスナップショット模擬を実装し、`demonstrateNonRepeatableRead` が `read committed` で `[100, 999]`、`repeatable read` で `[100, 100]` を返す

**期待出力**

- READ COMMITTED の再現ログに `100 → 999` のように異なる2値が並ぶ
- REPEATABLE READ では同じ位置に `100 → 100` と同値が並ぶ
- SERIALIZABLE の衝突で PostgreSQL は SQLSTATE 40001 のエラーを返し、模擬実装は `Serialization failure` を投げる

**観察項目**

- 各セッションで `SELECT txid_current()` と `SELECT pg_current_snapshot()` を実行し、スナップショットの取得タイミングが分離レベルで変わることを見る
- `SELECT * FROM pg_locks WHERE granted = false` で、同一行を更新する2トランザクションが行ロック待ちになっている様子を確認する
- Phantom Read シナリオを REPEATABLE READ で実行し、PostgreSQL が標準の要求より強く phantom を防ぐことを確認する

**テスト方法 (自己採点手順)**

1. `docker compose -f .devcontainer/docker-compose.yml exec postgres psql -U handbook -d handbook -c 'SELECT 1'` が結果 `1` を返し、DBへ接続できることを先に確認する
2. `pnpm --filter @handbook/ch14 run test` を実行し、`isolation simulator exposes non-repeatable read and serializable conflict` がパスすることを確認する
3. 4シナリオ×3分離レベルの「防げた / 防げなかった」表を作り、`code/ch14/transaction-isolation/solution/main.ts` の読み取り版切り替え (read committed のときだけ最新版を読む) と結果が矛盾しないか確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: いきなり自動化せず、1シナリオ×1分離レベルを psql 2枚で手作業で通し、BEGIN・UPDATE・COMMIT・再SELECT を打つ順序を時系列表にしてからコードへ写す。
2. 構造: コードでは接続を2本張り、`SET TRANSACTION ISOLATION LEVEL ...` を `BEGIN` 直後に発行する。模擬実装側は版番号付きの履歴 `{version, value}` を口座ごとに保持し、トランザクションが読む版を分離レベルで切り替える。
3. 実装の要点: 詰まるのはスナップショットの取得時点。PostgreSQL の REPEATABLE READ はトランザクション内で最初にデータへ触れた時点の版を固定するため、`BEGIN` 直後に何も読まないまま別セッションがコミットすると、期待した「同じ値」が観測できない。

**本番利用時の警告**

- SERIALIZABLE を使う実装は SQLSTATE 40001 のリトライ処理と一体である。リトライを書かずに本番投入すると、負荷が上がった瞬間にユーザー操作がそのままエラーになる
- この演習用 PostgreSQL は `handbook / handbook` という既知の資格情報で動く。ポートを公開してローカル以外から到達できる状態にしない

**導線**

- 開始地点: `transaction-isolation/starter/main.ts`
- 模範解答: `transaction-isolation/solution/main.ts`

### 14.3 課題14.3: N+1 問題の解決 ― EXPLAIN 比較 (★★)

**目的**: 同じ機能を「ループで個別クエリ」vs「JOIN 一発」で実装し、EXPLAIN で実行計画を比較。

**難易度**: ★★

**推定時間**: 90分 (計測付きDBスタブの実装25分、N+1版とJOIN版の実装25分、EXPLAIN比較と件数を変えた計測25分、DataLoaderとの関係の整理15分)

**必要サービス**: PostgreSQL, SQLite

**前提**

- `14.5 N+1 問題` と `14.4 実行計画 (EXPLAIN) の読み方` を読み、Seq Scan / Index Scan / Hash Join の意味を言える
- 第12章の DataLoader によるバッチ化を思い出し、アプリ側の解決とSQL側の解決を区別できる
- `pnpm --filter @handbook/ch14 exec tsx n-plus-one/starter/main.ts` が実行できる状態にしてある

**完成条件 (自己採点用チェックリスト)**

- [ ] `loadWithNPlusOne` と `loadWithJoin` が、どちらも `authorName` を持つ同一内容の配列を返す
- [ ] クエリ回数カウンタで、N+1版が `1 + N` 回、JOIN版が1回になることを数値で示せる
- [ ] 両方式の EXPLAIN 出力を並べ、JOIN側にだけ Hash Join が現れることを確認した
- [ ] 著者が存在しない投稿でも `authorName` が `unknown` になり、例外にならない
- [ ] 投稿件数を10、100、1000と増やしても JOIN版のクエリ回数が1のまま変わらない

**期待出力**

- 投稿2件・ユーザー2件のとき N+1版の `queryCount` が3、JOIN版が1になる
- N+1側の EXPLAIN が `Seq Scan posts` と `Index Lookup users × N` の2行、JOIN側が `Hash Join posts.user_id = users.id` を含む3行を返す
- 件数を増やすと N+1版のクエリ回数だけが線形に伸び、JOIN版は定数のままになる

**観察項目**

- 投稿件数を変えながら `queryCount` を記録し、N+1版は件数に比例、JOIN版は定数であることを表にする
- 実DBで試す場合は `EXPLAIN (ANALYZE, BUFFERS)` の `Buffers: shared hit` 行を比較し、往復回数の差がバッファ読み取り量に現れることを見る
- IN句で一括取得する DataLoader 方式を第3の実装として足し、クエリ回数が2回に収まることを確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch14 run test` を実行し、`N+1 performs one plus N queries while join uses one` がパスすることを確認する
2. posts と users を作成したうえで `docker compose -f .devcontainer/docker-compose.yml exec postgres psql -U handbook -d handbook -c 'EXPLAIN ANALYZE SELECT posts.*, users.name FROM posts JOIN users ON users.id = posts.user_id'` を実行し、計画に Hash Join か Merge Join が現れることを確認する
3. N+1版とJOIN版の戻り値を `assert.deepEqual` で比較し、順序を含めて完全に一致することを確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 先に「クエリを何回投げたか」を数える仕組みを作る。計測できないと改善したことを証明できない。
2. 構造: DBスタブの各メソッド (投稿一覧・ユーザー1件取得・結合取得) でカウンタを1つ増やす。N+1版は投稿一覧の結果をループしてユーザーを都度引き、JOIN版はユーザーを `Map` に載せて1回の走査で組み立てる。
3. 実装の要点: JOIN版で著者が見つからない投稿の扱いを先に決める。デフォルト値へ落とさないと、INNER JOIN と LEFT JOIN の件数差がそのままバグになる。

**本番利用時の警告**

- 教材の EXPLAIN は固定文字列を返す模擬であり、統計・行数見積り・コストに基づく実際のプランナ判断は再現しない。本番の判断は必ず実DBの `EXPLAIN (ANALYZE, BUFFERS)` で行う
- JOIN一発が常に速いわけではない。1対多の JOIN は行数が掛け算で膨らむため、件数を測らずに全部JOINへ寄せると転送量とメモリで逆に遅くなる

**導線**

- 開始地点: `n-plus-one/starter/main.ts`
- 模範解答: `n-plus-one/solution/main.ts`

### 14.4 課題14.4: 軽量 ORM 自作 (★★★)

**目的**: ActiveRecord 風の ORM を実装し、ORM が裏でやっていることを理解する。

**難易度**: ★★★

**推定時間**: 150分 (ModelとAdapterの骨格40分、クエリビルダのチェインとcompile実装50分、CRUDと型付けの調整35分、インジェクション確認テストの追加25分)

**必要サービス**: SQLite

**前提**

- `14.11 ORM の光と影` を読み、Active Record と Data Mapper の違いを説明できる
- TypeScript の静的メソッドでのジェネリクスと、`then` を実装して `PromiseLike` にする書き方が読める
- `pnpm --filter @handbook/ch14 exec tsx mini-orm/starter/main.ts` が実行できる状態にしてある

**完成条件 (自己採点用チェックリスト)**

- [ ] `Model` を継承した `class User extends Model` で `create` / `find` / `update` / `delete` が動作する
- [ ] `User.where({ age: { gte: 25 } }).orderBy('name', 'asc').limit(10)` がチェインでき、`await` でそのまま配列を取得できる
- [ ] `compile()` が `SELECT * FROM users WHERE age >= ? ORDER BY name ASC LIMIT ?` と `params: [25, 10]` を返し、値がSQL文字列へ埋め込まれていない
- [ ] `find` が存在しないidに対して `undefined` を、`delete` が成功時に `true` を返す
- [ ] `where` で等値比較と `gte` / `lte` / `gt` / `lt` の4演算子が使える

**期待出力**

- `compile()` の戻り値が `sql` と `params` の2キーを持つオブジェクトになる
- `create({ name: 'Alice', age: 30 })` が自動採番された `id` を含むインスタンスを返す
- `name` に `"; DROP TABLE users; --` のような文字列を渡しても `sql` は変わらず、その文字列は `params` 配列の要素として現れる

**観察項目**

- 条件を足すたびに `compile()` の出力を表示し、`where` を2回呼んだときに `AND` で連結されることを確認する
- `await query` と `query.execute()` の結果が一致することを確かめ、`PromiseLike` 実装の効果を見る
- アダプタから取得した行を書き換えてもストア側の値が変わらないことを確認し、返す行がコピーである意味を読み取る

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch14 run test` を実行し、`mini ORM supports CRUD, chained query, and placeholders` がパスすることを確認する
2. 引用符とセミコロンを含む文字列を `where` に渡すテストを1件追加し、`compile()` の `sql` にその文字列が現れないことを確認する
3. `code/ch14/mini-orm/solution/main.ts` の `compile` と自作実装を比較し、`LIMIT ?` のパラメータが `params` の末尾に付く順序が一致するか確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 「SQL文字列を組み立てる部分」と「実際に行を返す部分」を最初から分ける。前者だけを単体で検証できれば、アダプタが何であっても設計が崩れない。
2. 構造: クエリビルダに条件・並び順・件数上限の3状態を持たせ、`where` / `orderBy` / `limit` は `this` を返す。`then` を実装して `PromiseLike` にすると `await User.where(...)` と書ける。
3. 実装の要点: 条件値がオブジェクト (`{ gte: 25 }`) か素の値かで分岐する箇所が要点。演算子名からSQL演算子への対応表を引き、実値は必ずパラメータ配列側へ push する。

**本番利用時の警告**

- この ORM はテーブル名とカラム名をエスケープせずSQLへ連結する。カラム名を外部入力から受け取る形で使うと、値にプレースホルダを使っていてもSQLインジェクションが成立する
- コネクション管理、トランザクション、リレーション解決、マイグレーション整合を持たないため、実サービスでは Prisma や Drizzle などの実装済みORMを使う

**導線**

- 開始地点: `mini-orm/starter/main.ts`
- 模範解答: `mini-orm/solution/main.ts`

### 14.5 課題14.5: マイグレーション Runner 自作 (★★)

**目的**: Flyway や Rails Migration の動作原理を自作する。

**難易度**: ★★

**推定時間**: 90分 (マイグレーションファイルの用意15分、upとschema_migrationsの実装30分、downとstatusの実装25分、冪等性と失敗系の確認20分)

**必要サービス**: SQLite

**前提**

- `14.12 マイグレーション戦略` を読み、前方互換な変更順序 (追加、二重書き、切替、削除) を説明できる
- `bash` と `python3` が PATH にあり、`python3 -c 'import sqlite3'` がエラーなく通る
- `code/ch14/migration-runner/` の下に `migrations/` を作り、`001_create_users.sql` と `002_add_email_index.sql` を自分で用意する。各ファイルは up の SQL、`-- +migrate Down` の行、down の SQL の順に書く

**完成条件 (自己採点用チェックリスト)**

- [ ] `up` が未適用のファイルだけを版番号の昇順で適用し、適用したファイル名を1行ずつ出力する
- [ ] 適用済みの版が `schema_migrations` テーブル (version、filename、applied_at の3列) に記録される
- [ ] 同じ `up` を2回続けて実行しても2回目は何も適用せず、スキーマが変わらない
- [ ] `down` が最後に適用した1件だけを巻き戻し、`schema_migrations` から該当行を削除する
- [ ] `status` が全ファイルを適用済みか未適用かのラベル付きで版番号順に一覧表示する
- [ ] 巻き戻し用セクションを持たないファイルに対する `down` がエラーで停止し、DBを変更しない

**期待出力**

- 初回の `up` で `applied 001_create_users.sql` と `applied 002_add_email_index.sql` の2行が出る
- `status` が `up` または `pending` のラベルとファイル名をタブ区切りで版番号順に返す
- 適用済みが無い状態の `down` が `nothing to rollback` の1行だけを出す

**観察項目**

- `sqlite3 app.sqlite3 'SELECT * FROM schema_migrations'` で version / filename / applied_at を確認し、適用順が版番号の昇順であることを見る
- 巻き戻しセクションの無いファイルで `down` を実行し、エラー終了後にテーブル定義が変わっていないことを確認する
- ファイル名を `003-add-index.sql` のようにハイフン区切りにしても版番号が認識されることを確認する

**テスト方法 (自己採点手順)**

1. `bash code/ch14/migration-runner/solution/main.sh status migrations app.sqlite3` を実行し、自作版と同じ並び・同じラベルになることを比較する
2. `up` を2回連続で実行し、2回目の標準出力が空であること (冪等) を確認する
3. `sqlite3 app.sqlite3 '.schema users'` を `up` 後と `down` 後に実行し、テーブルの有無が期待どおり切り替わることを確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 「ファイル一覧」「適用済み一覧」「その差分」の3つに分けて考える。差分さえ正しく取れれば、あとは順に流すだけになる。
2. 構造: ファイル名から版番号を取り出す正規表現、`CREATE TABLE IF NOT EXISTS schema_migrations`、up と down を区切るマーカー文字列の3つを先に確定させる。マーカーは模範解答と揃えて `-- +migrate Down` (Down の D は大文字) とすること。揃えておかないと、模範解答を自作の migrations へかけたときに down の SQL が up の一部として実行され、作成したばかりのテーブルが落ちる。適用は1ファイル1トランザクションで囲む。
3. 実装の要点: `down` で巻き戻すのは「最後に適用した1件」であって、ファイル一覧の末尾ではない。記録テーブル側を版番号の降順で1件引かないと、途中まで適用した状態で誤ったファイルを巻き戻す。

**本番利用時の警告**

- 1マイグレーションを1トランザクションで囲んでも、DDLをトランザクションでロールバックできないDBMS (MySQLなど) では途中失敗時に中途半端なスキーマが残る。本番では対象DBMSのDDLトランザクション対応を先に確認する
- `down` による巻き戻しは列削除を伴えばデータを失う。本番の切り戻しは down 実行ではなく、前方互換な追加マイグレーションで行う

**導線**

- 開始地点: `migration-runner/starter/main.sh`
- 模範解答: `migration-runner/solution/main.sh`

### 14.6 課題14.6: 日時バグを再現して直す (★★★)

**目的**: DST 境界での実行漏れ、カレンダー日と瞬間の取り違え、24時間加算とカレンダー加算の混同、日境界のずれによる集計誤りの4件を固定の条件で再現し、修正実装では再現しなくなることを機械的に確かめる。

**難易度**: ★★★

**推定時間**: 150分 (resolveInstant とカレンダー日ユーティリティの実装に45分、4つの修正実装に45分、runFindings の判定設計に25分、タイムゾーンを変えた観察に35分。)

**必要サービス**: なし

**前提**

- 14.23 UTC、タイムゾーン、DST、カレンダー日 を読み、瞬間・ローカル日時・カレンダー日の3区分を確認する
- 14.24 DB日時型、定期実行、ユーザー表示 を読み、半開区間と定期実行の実行済み判定キーを押さえる
- `Intl.DateTimeFormat` の timeZone オプションと formatToParts の戻り値を確認する
- `code/ch14` で pnpm install 済みで、`pnpm --filter @handbook/ch14 run typecheck` が通る状態にする

**完成条件 (自己採点用チェックリスト)**

- [ ] `resolveInstant` が、存在しない時刻を切り替え後へ送り、二度ある時刻では先に訪れるほうを返す
- [ ] `toPlainDate` と `addCalendarDays` が、タイムゾーンと壁時計を混ぜずにカレンダー日だけを扱う
- [ ] `fixedDailyRuns` が毎日カレンダー日から解決し直し、DST 開始日以降も現地の希望時刻を保つ
- [ ] `fixedIsOverdue` が判定用タイムゾーンの日付どうしを比較し、`fixedCountForDay` が半開区間で数える
- [ ] `runFindings` が期待値を直書きせず、naive と fixed の結果の差から再現の有無を判定する
- [ ] `pnpm --filter @handbook/ch14 exec tsx datetime-pitfalls/starter/report.ts` が6行の要約を出力する

**期待出力**

- 1行目に `naive implementation: 4/4 bugs reproduced` が出る
- D1 の行が `naive drift days=3 / fixed drift days=1` になり、修正後のずれが切り替え日の1件だけに収まる
- D2 の行が `naive overdue=true / fixed overdue=false` になる
- D3 の行が `naive local=2026-11-01 19:00 / fixed local=2026-11-01 20:00` になる
- D4 の行が `naive count=3 / fixed count=4` になり、最終行が `fixed implementation: 0/4 bugs remaining` になる

**観察項目**

- `TZ=UTC`、`TZ=Asia/Tokyo`、`TZ=America/New_York` の3通りで report を実行し、出力が変わらないことを確認する
- `FIXTURES.springPlan.timeZone` を `Australia/Sydney` に、startDate を切り替え日の前後へ変えて、南半球では DST の向きが逆になることを確認する
- `resolveInstant` の候補選択を、二度ある時刻で後に訪れるほうへ変え、D1 と D3 の結果がどう動くかを見る
- `fixedCountForDay` の終端を半開区間から閉区間へ変え、境界の1件が二重に数えられることを確認する
- `FIXTURES.plainZone` を `Pacific/Honolulu` に変え、D2 と D4 のずれる向きが逆になることを確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch14 exec tsx datetime-pitfalls/solution/report.ts` を実行し、6行の要約が出力されることを確認する
2. `pnpm --filter @handbook/ch14 run test` を実行し、local time resolution と the four datetime bugs の2つのテストが pass することを確認する
3. 自分の `datetime-pitfalls/starter/report.ts` を実行し、solution と同じ出力になるかで自己採点する
4. `pnpm --filter @handbook/ch14 run typecheck` が 0 エラーで終わることを確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 最初に resolveInstant を通す。残る3つの修正実装はすべてこの関数の上に載るため、ここが誤っていると原因の切り分けができなくなる。
2. 構造: 日時を3つの型として扱う。瞬間は Date、ローカル日時は year から minute までの数値の組、カレンダー日は YYYY-MM-DD の文字列に固定する。関数の引数と戻り値をこの3つのどれかに揃えると、変換の抜けが型として現れる。
3. 実装の要点: resolveInstant では、naive を UTC として解釈した値から前後1日のオフセットを取り、それぞれで候補を作る。候補が自分自身のオフセットと辻褄が合うかを検査し、2つ残れば二度ある時刻、0個なら存在しない時刻である。1回の推定だけで済ませると、切り替えの前後で1時間ずれる。

**本番利用時の警告**

- この実装は分単位までしか扱わず、秒とミリ秒、うるう秒の平滑化、歴史的なオフセット変更の一部を無視している。本番では標準ライブラリまたは実績のある日時ライブラリを使う。
- IANA tz database は更新されるため、遠い未来の日付についてはここで得た結果が後で変わりうる。保存済みの未来の予定を再計算する手順を運用側で用意する必要がある。
- `Intl.DateTimeFormat` の結果は実行環境の ICU データに依存する。Node.js、ブラウザ、データベースで版がずれていると、同じ入力に対して異なる結果になりうる。

**導線**

- 開始地点: `datetime-pitfalls/starter/main.ts`
- 模範解答: `datetime-pitfalls/solution/main.ts`、`datetime-pitfalls/solution/report.ts`

### 14.7 課題14.7: 個人データの削除・保持・エクスポート・同意の抜けを再現して塞ぐ (★★★)

**目的**: 削除の伝播漏れ、保持期間の未実行、エクスポートへの他人のデータ混入、撤回された同意での配信という4件を再現し、所在一覧を入力にした実装へ差し替えると1件も残らず、かつ他の利用者のデータが巻き添えにならないことを機械的に確かめる。

**難易度**: ★★★

**推定時間**: 150分 (INVENTORY と world の読解30分、fixedErase の伝播40分、fixedPurge と fixedExport 40分、fixedDispatch と観察40分)

**必要サービス**: なし

**前提**

- 14.25 個人データの収集と保存 を読み、所在一覧が削除とエクスポートの入力になる理由を確認する
- 14.26 保持期間、削除、エクスポート を読み、削除を伝播として設計する意味と、消せないものの扱いを押さえる
- 28.14 Web に関わる主要規制 を読み、制度によって要求が異なることを前提として確認する
- `code/ch14` で pnpm install 済みで、`pnpm --filter @handbook/ch14 run typecheck` が通る状態にする

**完成条件 (自己採点用チェックリスト)**

- [ ] `fixedErase` が INVENTORY を入力にし、一覧にあって未対応の場所があれば例外で落ちる
- [ ] `fixedErase` が場所ごとに delete / anonymize / retain を使い分け、再実行しても結果が変わらない
- [ ] `fixedPurge` が expired の対象から識別項目を落とし、1回あたりの件数に上限を持つ
- [ ] `fixedExport` が exportable な場所から本人の行だけを集め、スレッド単位で集めない
- [ ] `fixedDispatch` が配信の直前に同意の正本を引き、撤回済みの主体を除く
- [ ] `pnpm --filter @handbook/ch14 exec tsx data-lifecycle/starter/report.ts` が6行の要約を出力する

**期待出力**

- 1行目に `naive lifecycle: 4/4 gaps reproduced` が出る
- P1 の行の naive が `residual=10` で、fixed が `residual=0 at=[]` になる
- P2 の行が `naive expired-left=4 purged=0 / fixed expired-left=0 purged=4` になる
- P3 の行が `naive rows=6 foreign=1 missing=0 / fixed rows=9 foreign=0 missing=0` になる
- 最終行が `fixed lifecycle: 0/4 gaps remaining (other subject intact)` になる

**観察項目**

- INVENTORY から search.users の行を外し、P1 が再現に戻る (fixed residual=1 at=[search.users]) ことを確認する
- db.orders の erasure を retain に変え、P1 が再現に戻る (fixed residual=1 at=[db.orders]) ことを確認する
- `fixedPurge` のデフォルト limit を 2 にし、P2 が再現に戻る (fixed expired-left=2 purged=2) ことを確認する
- `fixedExport` をスレッド単位の集め方へ戻し、P3 が再現に戻る (fixed foreign=1) ことを確認する
- `fixedDispatch` から consentActive の照合を外し、P4 が再現に戻る (fixed sent=[S1, S2]) ことを確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch14 exec tsx data-lifecycle/solution/report.ts` を実行し、6行の要約が出力されることを確認する
2. `pnpm --filter @handbook/ch14 run test` を実行し、data lifecycle の6件のテストが pass することを確認する
3. 自分の `data-lifecycle/starter/report.ts` を実行し、solution と同じ出力になるかで自己採点する
4. `pnpm --filter @handbook/ch14 run typecheck` が 0 エラーで終わることを確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 所在一覧を、文書ではなくコードの入力にする。削除もエクスポートも一覧を走査する形にしておくと、場所が1つ増えたときに実装が追いついていないことを起動時に検出できる。追いついていない状態で静かに成功するのが、この領域で最も高くつく失敗である。
2. 構造: 削除を1種類の操作だと考えない。行ごと消せるもの、識別項目だけを落とすもの、そのまま残すものの3種類がある。監査ログと取引記録がどれに当たるかは業務と制度で決まるため、コードでは種別を一覧から受け取り、判断そのものは持たない。
3. 実装の要点: エクスポートの範囲は「本人の行かどうか」で決める。スレッドや共有空間の単位で集めると、要求に応じたつもりで第三者の情報を渡すことになる。逆に、実装した時点の表だけを対象にすると、あとから追加された場所が漏れる。どちらも一覧を入力にすれば同じ仕組みで防げる。

**本番利用時の警告**

- このコードは本番のデータベース、レプリカ、バックアップに対して実行してはならない。削除は元へ戻せない。
- データはすべて架空の値であり、実在の個人を示すものではない。本番から採取した実データをテストの固定値へ持ち込むと、リポジトリの履歴に永久に残る。
- どのデータをどこまで消す義務があるか、何を残す義務があるか、「削除しました」と説明してよい範囲はどこまでかは、法域・業種・契約によって異なる。本課題は法的助言ではない。判断は法務および専門家に確認する (14.26、28.14、30.16)。

**導線**

- 開始地点: `data-lifecycle/starter/main.ts`
- 模範解答: `data-lifecycle/solution/main.ts`、`data-lifecycle/solution/report.ts`

## 評価方法

1. starterから開始し、本文の要件と課題詳細の完成条件を満たす。
2. 期待出力・観察項目を記録する。
3. 完成条件のチェックリストで自己採点し、未達項目を残す。
4. solutionとの差分を説明する。
5. `pnpm --filter @handbook/ch14 run test` を実行する。

## 安全上の注意

- 脆弱性・ネットワーク・OS・コンテナの演習は、localhostまたは隔離環境だけで実行してください。
- 教材用の簡略実装をそのまま本番へ投入しないでください。
- 各課題の「本番利用時の警告」を読まずに、演習コードを製品コードへ流用しないでください。

## 配布対象外

`node_modules/`、`dist/`、`coverage/`、一時DB、秘密情報、計測生成物は配布対象外です。
