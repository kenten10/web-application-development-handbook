# 第IV部 データ編

第III部では、クライアントから届いた要求をサーバで処理し、API契約と認証・認可によって「誰が何をしてよいか」を決めた。だが、正当な要求であっても、複数の処理が同じ値を同時に更新すれば、上書きや重複、途中失敗によって業務上の事実を壊しうる。また、保存できることと、必要な条件で速く見つけられること、変更を他の処理へ確実に伝えられることは別の問題である。

第IV部では、業務状態を扱う責務を段階的に広げる。まずRDBで制約、トランザクション、インデックスを用いて整合性と検索性能を両立する。次に、アクセスパターンや可用性の要求がRDBの標準モデルから外れる場面をNoSQLで比較する。保存されたデータを語句や意味から探すために検索専用の索引へ進み、最後にデータ変更を時間的・組織的に分離された処理へ伝えるイベント駆動を扱う。データ技術を製品の一覧ではなく、正しさ、形、発見、伝播という四つの問題としてつなげて理解することが、この部の目標である。

---

<a id="chapter-14"></a>
## 第14章 リレーショナルデータベース

第13章までで、要求の送り手と許可範囲を検証し、実行してよい業務処理を選べるようになった。残るのは、その処理が作る注文、残高、権限といった事実を、同時実行や途中失敗が起きても壊さず保存する問題である。アプリケーションのオブジェクトだけでは、プロセス停止後の永続性も、複数要求をまたぐ不変条件も保証できない。

本章では、表と制約によって業務上の関係を表し、インデックスと実行計画で取り出し方を最適化し、トランザクション、MVCC (Multi-Version Concurrency Control)、ロックで並行更新を制御する。さらに、スキーマ変更、分析処理、VACUUM、接続管理まで追うことで、ORM (Object-Relational Mapping) の下でRDBが何を保証しているかを理解する。後半では、同じ1つのデータベースを複数の顧客と複数の地域が共有する場合に必要になる2つの属性、すなわち「その行は誰のものか」と「その行はいつのものか」を扱う。その上で第15章では、アクセスパターンや分散可用性の要求が、この強い標準モデルから外れる場合を検討する。

<!-- handbook:chapter-guide:start {"chapter":14} -->
> **この章の学習ガイド**
>
> **解決する実務上の問題**  
> 整合性、性能、並行更新、スキーマ変更を、ORMの外側にあるRDBのモデルと実行機構から扱い、個人データの寿命まで設計に含める。
>
> **到達目標**
> - 正規化、制約、トランザクション境界を設計できる。
> - インデックスと実行計画を読み、N+1やスロークエリを改善できる。
> - MVCC、分離レベル、ロック、VACUUMの関係を説明できる。
> - テナント分離モデルを選び、Row-Level Securityで境界を宣言できる。
> - 瞬間、ローカル日時、カレンダー日を区別し、DBの日時型と定期実行へ落とせる。
> - 個人データの所在、保持期間、削除の伝播、エクスポートの範囲を設計できる。
>
> 到達目標は章全体に対するものである。標準通読ルートは必修節だけを読むため、下の「中核概念」に (実務選択) (発展) (展望) と付いた節がある章では、その節を読むまで到達目標の一部が埋まらない。必修節を読み終えた時点で説明できない項目があれば、まず付記のある節へ進む。
>
> **前提知識**
> - [12.3 リソース指向設計の実践](04-part3-backend.md#section-12-3) ― APIのリソース設計
>
> **中核概念**  
> [14.1 リレーショナルモデルの考え方](#section-14-1)、[14.2 正規化と非正規化の判断](#section-14-2)、[14.3 インデックスの内部構造](#section-14-3)、[14.4 実行計画 (EXPLAIN) の読み方](#section-14-4)、[14.6 ACIDとトランザクション](#section-14-6)、[14.7 トランザクション分離レベル](#section-14-7)、[14.8 MVCC ― スナップショットによる並行制御](#section-14-8)、[14.9 ロック ― 楽観 vs 悲観](#section-14-9)、[14.20 テナント分離モデルと Row-Level Security](#section-14-20) (実務選択)、[14.23 UTC、タイムゾーン、DST、カレンダー日](#section-14-23) (実務選択)、[14.25 個人データの収集と保存 ― 何を持ち、どこに置き、どこへ漏れるか](#section-14-25) (実務選択)
>
> **最小実装**  
> [14.13 スロークエリを10倍速くする実演](#section-14-13) (実務選択)、[14.27 実装課題 ― RDB の内側を実装する](#section-14-27) (発展)
>
> **本番実装との差分**
> - 教材DB実装はWAL、クラッシュリカバリ、並行制御、統計、永続性を簡略化する。本番では成熟したDBMSを使用する。
>
> **典型的な失敗**
> - インデックスを増やせば常に速くなると考える。
> - トランザクションを外部API待ちまで保持する。
> - オンライン移行のロックと互換期間を無視する。
> - RLSを有効化しただけで、所有者バイパスと接続の使い回しを確認しない。
> - カレンダー日を瞬間として保存し、地域によって1日ずれる。
> - 削除を主テーブルの行削除だけで済ませ、検索インデックスや分析基盤に残す。
> - ログの機密フィールドを拒否リストで管理し、新しい項目が増えるたびに漏らす。
>
> **診断・デバッグ方法**
> - EXPLAIN (ANALYZE, BUFFERS) とDB統計を確認する。
> - ロック待ち、長時間トランザクション、dead tuple、接続数を監視する。
> - テナント別の実行時間と待ち時間を分けて観測し、noisy neighborを特定する。
> - DST境界を含む固定日時で、定期実行と日次集計を再現する。
> - 削除要求の進捗を場所ごとに記録し、期限切れの残件数を監視する。
>
> **意思決定チェックリスト**
> - 守るべき不変条件はDB制約で表現できるか。
> - 読み取り整合性と書き込み競合の要件は。
> - テナント分離はプール、ブリッジ、サイロのどれか。復旧と移行の単位はどこか。
> - 各日時項目は瞬間か、ローカル日時か、カレンダー日か。
> - 「削除しました」と説明する範囲にバックアップを含めるか。含めない場合の説明はどうするか。
>
> **演習と評価基準**  
> 対象: [14.27 実装課題 ― RDB の内側を実装する](#section-14-27) (発展)
> - 同じクエリを計測し、実行計画に基づく改善を説明できる。
> - テナント越境と日時バグを再現し、対策後に再現しないことを示せる。
> - 削除の伝播漏れとエクスポートの範囲誤りを再現し、対策後に再現しないことを示せる。
>
> **一次資料・発展資料**
> - PostgreSQL documentation
> - SQL standard
> - Database System Concepts
> - PostgreSQL Row Security Policies
> - IANA Time Zone Database
> - RFC 9557
> - 各法域の個人データ保護に関する当局公表資料 (適用の判断は法務へ確認する)
<!-- handbook:chapter-guide:end -->

<a id="section-14-1"></a>
### 14.1 リレーショナルモデルの考え方
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"た行","term":"データモデリング"} -->
<!-- handbook:index {"group":"ら行","term":"リレーショナルモデル"} -->
<!-- handbook:index {"group":"さ行","term":"集合演算"} -->

<!-- handbook:narrative-bridge {"section":"14.1"} -->
APIで表したリソースを永続化するには、個々のオブジェクトを保存するだけでなく、注文と顧客、商品と在庫の関係を問い合わせ可能な形で表す必要がある。リレーショナルモデルは、業務状態を集合と関係へ写し、操作を宣言的に記述する出発点になる。

リレーショナルモデルは Edgar Codd が1970年に提案した [Codd, 1970]。核心は「**データを2次元の表 (リレーション) として扱い、集合演算で操作する**」こと。

リレーショナル代数の演算:

- **射影 (Projection)**: 列を選ぶ (`SELECT name FROM users`)
- **選択 (Selection)**: 行を絞る (`WHERE age > 30`)
- **結合 (Join)**: 複数の表を組み合わせる
- **和集合・差集合・積集合**: `UNION`、`EXCEPT`、`INTERSECT`
- **集約 (Aggregation)**: `GROUP BY` + `SUM`、`COUNT` など

SQL (Structured Query Language) はこの理論モデルの実装言語だ。

<a id="section-14-2"></a>
### 14.2 正規化と非正規化の判断
<!-- handbook:learning {"level":"required","minutes":10} -->
<!-- handbook:index {"group":"J","term":"JSONB (PostgreSQL)"} -->
<!-- handbook:index {"group":"さ行","term":"正規化"} -->

<!-- handbook:narrative-bridge {"section":"14.2"} -->
表と集合演算を使えても、同じ事実を複数の行へ重複して持てば、一部だけが更新される異常を防げない。正規化は、どの事実を一か所の正本に置き、どの関係を外部キーで結ぶかを決めるために必要になる。

正規化はデータの重複を排除する設計手法。第1〜第5正規形まであるが、実務では**第3正規形 (3NF) まで**で十分なことが多い。

**非正規化された設計 (悪い):**

```sql
CREATE TABLE orders (
  id INTEGER,
  customer_name TEXT,
  customer_email TEXT,
  product_name TEXT,
  product_price NUMERIC,
  quantity INTEGER
);
```

問題点:

- 同じ顧客の情報が注文ごとに重複する
- 顧客のメール変更時に全行を更新する必要
- 商品名のtypoが容易に発生
- 顧客や商品の単独管理が困難

**正規化された設計 (3NF):**

```sql
CREATE TABLE customers (
  id    INTEGER PRIMARY KEY,
  name  TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL
);

CREATE TABLE products (
  id    INTEGER PRIMARY KEY,
  name  TEXT NOT NULL,
  price NUMERIC NOT NULL
);

CREATE TABLE orders (
  id          INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE order_items (
  order_id    INTEGER NOT NULL REFERENCES orders(id),
  product_id  INTEGER NOT NULL REFERENCES products(id),
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_at_order NUMERIC(12, 2) NOT NULL CHECK (unit_price_at_order >= 0),
  PRIMARY KEY (order_id, product_id)
);
```

**しかし、非正規化が正しいケースもある:**

- 価格は「注文時点の価格」を残したい。商品の現在価格が変わっても過去の注文金額を再現できるよう、通常は`order_items.unit_price_at_order`へスナップショットする
- 集計をリアルタイム計算するとコストが大きいなら、集計用カラムを別途持つ (`users.posts_count` など)、ただし整合性管理が必要

「正規化が常に正しい」ではなく、「**正規化を基本とし、計測してボトルネックなら非正規化**」が現実的。

<a id="section-14-3"></a>
### 14.3 インデックスの内部構造
<!-- handbook:learning {"level":"required","minutes":10} -->
<!-- handbook:index {"group":"B","term":"B-Tree インデックス"} -->
<!-- handbook:index {"group":"B","term":"BRIN インデックス"} -->
<!-- handbook:index {"group":"G","term":"GIN インデックス"} -->
<!-- handbook:index {"group":"あ行","term":"インデックス (DB)"} -->

<!-- handbook:narrative-bridge {"section":"14.3"} -->
正規化によって更新の正しさは高まるが、必要な行を毎回全件走査していてはデータ量に耐えられない。正本の表とは別に探索順序を保持するインデックスを理解すると、どの条件を速くでき、どの更新コストを支払うかを判断できる。

インデックスは「クエリを高速化する補助データ構造」だが、種類によって得意なクエリが異なる。これを知らずに「とりあえずインデックス付けとけ」では、本当に欲しい速さが得られない。

**B-Tree インデックス (デフォルト、最も汎用):**

```text
                [50]
             /      \
        [20, 35]   [70, 85]
        /  |  \    /  |  \
     ...   ...    ...   ...
```

特徴:

- 等価検索 (`=`)、範囲検索 (`<`、`>`、`BETWEEN`)、ソート、`LIKE 'prefix%'` に効く
- `LIKE '%suffix'` (前方ワイルドカード) には効かない
- 列に関数や演算を適用すると通常の列インデックスとは式が一致しない。`WHERE LOWER(email) = 'alice@x.com'`には`CREATE INDEX ... ON users (LOWER(email))`のような式インデックスを検討する

**Hash インデックス:**

等価比較のみ。範囲検索やソートには使えない。PostgreSQLでは滅多に使わない (B-Treeで十分なことが多い)。

**GIN (Generalized Inverted Index):**

配列、JSONB、全文検索向け。「**1つの行に複数の値**」を持つカラムへの検索。

```sql
-- JSONB のキー検索を高速化
CREATE INDEX idx_user_attrs ON users USING GIN (attributes);

SELECT * FROM users WHERE attributes @> '{"role": "admin"}';
-- ↑ GIN インデックスで高速
```

**BRIN (Block Range Index):**

非常に大きなテーブルで、データが**物理的に並んでいる**カラム向け (時系列データなど)。サイズが極小。

```sql
-- 時系列ログテーブル
CREATE INDEX idx_logs_time ON logs USING BRIN (created_at);
```

**部分インデックス (Partial Index):**

「特定の行だけ」を対象にしたインデックス。サイズ削減と高速化を両立。

```sql
-- 「アクティブなユーザー」だけインデックス
CREATE INDEX idx_active_users ON users (email) WHERE status = 'active';

-- 「未読の通知」だけ
CREATE INDEX idx_unread_notifs ON notifications (user_id, created_at)
  WHERE read_at IS NULL;
```

**複合インデックスの順序の罠:**

```sql
CREATE INDEX idx_user_status_age ON users (status, age);

-- 効く
SELECT * FROM users WHERE status = 'active';
SELECT * FROM users WHERE status = 'active' AND age > 30;

-- 先頭列がないため一般には効率が落ちる
SELECT * FROM users WHERE age > 30;
```

複合B-treeは先頭列の条件があるほど探索範囲を強く絞れる。先頭列なしでも全インデックス走査や、PostgreSQL 18のskip scanが選ばれる場合はあるが、選択度、列の組合せ、統計、コストで判断される。`age`単独検索が重要なら、専用インデックスと実行計画を比較する。

<a id="section-14-4"></a>
### 14.4 実行計画 (EXPLAIN) の読み方
<!-- handbook:learning {"level":"required","minutes":10} -->
<!-- handbook:index {"group":"さ行","term":"実行計画"} -->

<!-- handbook:narrative-bridge {"section":"14.4"} -->
インデックスを作成した事実だけでは、実際のクエリがそれを利用するとは限らない。DBMSは統計とコスト見積もりから走査や結合の方法を選ぶため、その判断を可視化する実行計画を読めなければ性能改善は推測になる。

クエリが遅いときは、まず実行計画を確認する。`EXPLAIN`は実行せず見積もりを表示し、`EXPLAIN (ANALYZE, BUFFERS)`は実際にクエリを実行する。`UPDATE`、`DELETE`、`INSERT`など副作用のある文を`ANALYZE`付きで調べる場合は、検証環境または明示的なトランザクションと`ROLLBACK`を使う。

```sql
EXPLAIN ANALYZE
SELECT u.name, COUNT(p.id) AS post_count
FROM users u
LEFT JOIN posts p ON u.id = p.user_id
WHERE u.status = 'active'
GROUP BY u.id, u.name
ORDER BY post_count DESC
LIMIT 10;
```

出力例 (PostgreSQL):

```text
Limit  (cost=12345.67..12345.68 rows=10 width=18) (actual time=234.56..234.58 rows=10 loops=1)
  ->  Sort  (cost=12345.67..12400.45 rows=8000 width=18) (actual time=234.55..234.57 rows=10 loops=1)
        Sort Key: (count(p.id)) DESC
        Sort Method: top-N heapsort  Memory: 25kB
        ->  HashAggregate  (cost=10500.00..10719.12 rows=21912 width=18) (actual time=200.10..220.30 rows=8000 loops=1)
              Group Key: u.id
              ->  Hash Right Join  (cost=500.00..9500.00 rows=200000 width=14) (actual time=10.50..150.20 rows=200000 loops=1)
                    Hash Cond: (p.user_id = u.id)
                    ->  Seq Scan on posts p  (cost=0.00..6500.00 rows=200000 width=8) (actual time=0.10..50.20 rows=200000 loops=1)
                    ->  Hash  (cost=400.00..400.00 rows=8000 width=14) (actual time=10.30..10.31 rows=8000 loops=1)
                          ->  Index Scan using idx_users_status on users u  (cost=0.29..400.00 rows=8000 width=14) (actual time=0.03..7.50 rows=8000 loops=1)
                                Index Cond: (status = 'active')
Planning Time: 0.234 ms
Execution Time: 235.12 ms
```

読み方:

- **下から上に読む**: 実行は下のノードから始まり、上に流れる
- **cost**: プランナの見積もり (startup..total)、相対的な指標
- **actual time**: 実測時間 (ミリ秒)
- **rows**: 推定行数 vs 実際の行数 → 大きく違うなら統計情報が古い (`ANALYZE` 実行)
- **loops**: そのノードが何回実行されたか
- **Seq Scan**: フルテーブルスキャン (大きいテーブルでは要注意)
- **Index Scan**: インデックス利用
- **Index Only Scan**: 必要列をインデックスから取得できる計画。PostgreSQLでは可視性マップの状態によりヒープ確認が発生するため、常にテーブル本体を読まないとは限らない
- **Hash Join / Merge Join / Nested Loop**: 結合方式

**よくある問題と対処:**

| 症状 | 原因 | 対処 |
|---|---|---|
| Seq Scan が大きなテーブル | インデックスが効いていない | インデックス作成、WHERE 句を見直す |
| rows の推定が実際と大きく違う | 統計情報が古い | `ANALYZE table_name` |
| Nested Loop で内側 loops が膨大 | N+1的なジョイン | クエリの書き直し、インデックス追加 |
| Sort が遅い | メモリ不足 | `work_mem` 増、`LIMIT` を活用 |

<a id="section-14-5"></a>
### 14.5 N+1 問題
<!-- handbook:learning {"level":"required","minutes":10} -->
<!-- handbook:index {"group":"N","term":"N+1問題"} -->

<!-- handbook:narrative-bridge {"section":"14.5"} -->
一つのSQLの実行計画が適切でも、アプリケーションが関連データごとに同じ種類のSQLを繰り返せば、往復回数が全体の遅延を支配する。N+1問題は、DB内部の計画だけでなく、ORMから発行されるクエリ列を観測する必要がある例である。

「ORM が遅い」と言われる主因はこれ。

```typescript
// BAD: N+1 クエリ発生
const users = await db.user.findMany();           // 1クエリ
for (const u of users) {
  const posts = await db.post.findMany({           // ユーザー数だけクエリ実行
    where: { userId: u.id }
  });
  console.log(u.name, posts.length);
}
// ユーザー1000人なら 1 + 1000 = 1001 クエリ
```

**解決1: JOIN で一括取得 (Prisma):**

```typescript
const users = await db.user.findMany({
  include: { posts: true },  // ユーザーと投稿を一発取得
});
// → 内部で JOIN または 2回のクエリで完結
```

**解決2: 別クエリで取得後、JavaScript でグルーピング:**

```typescript
const users = await db.user.findMany();
const userIds = users.map(u => u.id);
const posts = await db.post.findMany({ where: { userId: { in: userIds } } });

const postsByUser = new Map<string, Post[]>();
for (const p of posts) {
  const list = postsByUser.get(p.userId) ?? [];
  list.push(p);
  postsByUser.set(p.userId, list);
}

for (const u of users) {
  console.log(u.name, postsByUser.get(u.id)?.length ?? 0);
}
// クエリ数は 2 (固定)
```

GraphQL 環境では DataLoader が同じパターンを自動化する (第12章で触れた)。

<a id="section-14-6"></a>
### 14.6 ACIDとトランザクション
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"A","term":"ACID"} -->
<!-- handbook:index {"group":"た行","term":"強い整合性"} -->

<!-- handbook:narrative-bridge {"section":"14.6"} -->
クエリ回数を減らして高速化しても、注文作成と在庫減算の片方だけが成功すれば業務状態は壊れる。複数の読み書きを一つの意味ある変更として扱うために、ACID (Atomicity, Consistency, Isolation, Durability) とトランザクション境界が必要になる。

トランザクションは「**複数の操作を1つの論理的な単位として扱う**」仕組み。

**ACID:**

- **Atomicity (原子性)**: 全部成功するか、全部失敗する。中途半端な状態にならない
- **Consistency (一貫性)**: 制約を満たす状態から、別の制約を満たす状態へ
- **Isolation (分離性)**: 並行実行されるトランザクション同士が干渉しない (※レベル設定可)
- **Durability (永続性)**: コミットされたら、クラッシュしても残る

```typescript
// 銀行振込: 全部成功するか、全部失敗するか
await db.$transaction(async (tx) => {
  // balance >= amount をUPDATE条件に含め、同時更新でも残高を負にしない
  const result = await tx.account.updateMany({
    where: { id: fromId, balance: { gte: amount } },
    data: { balance: { decrement: amount } },
  });
  if (result.count !== 1) throw new Error('Insufficient balance');

  await tx.account.update({
    where: { id: toId },
    data: { balance: { increment: amount } },
  });
});
// DB側にも CHECK (balance >= 0) を置く。複数通貨、精度、台帳、監査要件は別途設計する。
```

例外が投げられると自動でロールバック。両方の更新が反映されるか、どちらも反映されないかのいずれか。

<a id="section-14-7"></a>
### 14.7 トランザクション分離レベル
<!-- handbook:learning {"level":"required","minutes":10} -->
<!-- handbook:index {"group":"た行","term":"ダーティリード"} -->
<!-- handbook:index {"group":"た行","term":"トランザクション分離レベル"} -->
<!-- handbook:index {"group":"は行","term":"ファントムリード"} -->
<!-- handbook:index {"group":"は行","term":"反復可能読み取り"} -->

<!-- handbook:narrative-bridge {"section":"14.7"} -->
トランザクションが原子的に完了しても、並行する処理が途中の値をどこまで観測するかは一意に決まらない。正しさと並行性能の間で許容する異常を選ぶため、分離レベルを具体的な読み書き現象として理解する必要がある。

並行トランザクションが互いをどう「見える」か。SQL標準は4レベル:

| レベル | ダーティリード | ノンリピータブルリード | ファントムリード |
|---|---|---|---|
| READ UNCOMMITTED | 標準上は発生可 | 発生可 | 発生可 |
| READ COMMITTED | 防止 | 発生可 | 発生可 |
| REPEATABLE READ | 防止 | 防止 | 標準上は発生可 |
| SERIALIZABLE | 防止 | 防止 | 防止 |

各現象を例で説明する。

**ダーティリード**: 他トランザクションの未コミットの変更を読んでしまう。

```text
T1: UPDATE accounts SET balance = 100 WHERE id = 1;  -- まだコミットしない
T2: SELECT balance FROM accounts WHERE id = 1;       -- "100" を読む!
T1: ROLLBACK;                                         -- 巻き戻し
T2: → 存在しなかった値を見てしまった
```

**ノンリピータブルリード**: 同じトランザクション内で同じ行を2回読むと、値が違う。

```text
T1: SELECT balance FROM accounts WHERE id = 1;  -- 100
T2: UPDATE accounts SET balance = 200 WHERE id = 1;
T2: COMMIT;
T1: SELECT balance FROM accounts WHERE id = 1;  -- 200 (異なる!)
```

**ファントムリード**: 同じトランザクション内で同じ条件のSELECTで、行数が変わる。

```text
T1: SELECT COUNT(*) FROM orders WHERE status = 'pending';  -- 10
T2: INSERT INTO orders (status) VALUES ('pending');
T2: COMMIT;
T1: SELECT COUNT(*) FROM orders WHERE status = 'pending';  -- 11
```

**実装の現実:**

- **PostgreSQLのデフォルトはREAD COMMITTED**。READ UNCOMMITTEDを指定してもREAD COMMITTEDとして扱われる
- PostgreSQLのREPEATABLE READはスナップショット分離に基づき、標準が許容するファントムも防ぐ。ただし書き込みスキューなど直列化異常は残りうる
- MySQL InnoDBのデフォルト値は一般にREPEATABLE READだが、ロック読み取りやgap lockなど挙動はPostgreSQLと異なる
- **SERIALIZABLE**: PostgreSQLでは直列化失敗が起こりうるため、トランザクション全体をリトライできる設計が必要

実務では「READ COMMITTED で十分か、特定操作だけ SERIALIZABLE にするか」を考えるのが現実的。金銭が絡む操作は厳しめに。

<a id="section-14-8"></a>
### 14.8 MVCC ― スナップショットによる並行制御
<!-- handbook:learning {"level":"required","minutes":10} -->
<!-- handbook:index {"group":"M","term":"MVCC"} -->
<!-- handbook:index {"group":"V","term":"VACUUM"} -->
<!-- handbook:index {"group":"な行","term":"並行制御"} -->

<!-- handbook:narrative-bridge {"section":"14.8"} -->
異常を避けるために全ての読み取りをロックすれば、正しさと引き換えに並行性を大きく失う。MVCCは複数の版を保持し、読み手へ一貫したスナップショットを与えることで、読み取りと書き込みの衝突を減らす。

PostgreSQL や Oracle、MySQL InnoDB は **MVCC (Multi-Version Concurrency Control)** という仕組みを採用している。

**従来のロックベース:**

「読むときも書くときもロックを取得し、終わったら解放」 → 待機が多く性能が悪い。

**MVCC:**

「書くときは新しいバージョンを作り、読む側は分離レベルに応じたスナップショットを見る」ことで、通常の行読み取りと行更新の競合を減らす。ただし、行更新同士、明示ロック、DDL、外部キー、インデックス操作などでは待機やデッドロックが起こる。READ COMMITTEDでは文ごとにスナップショットが変わる。

```text
時刻1: 値 = 100 (バージョンv1)
時刻2: トランザクションA が REPEATABLE READ で開始し、100 を読む
時刻3: トランザクションB が UPDATE し、新バージョン v2 = 200 を作る (Bは未コミット)
時刻4: A が再度読む → A のスナップショットは時刻2 のままなので 100 を見る
時刻5: B がコミット → 以後に開始したトランザクションは 200 を見る
時刻6: A がコミット → A は最後まで 100 を見続けた
時刻7: バキューム → どのスナップショットからも見えなくなった v1 (100) を削除
```

同じ行に v1 と v2 が同時に存在し、どちらが見えるかは「読む側がいつ開始したか」で決まる。これが MVCC の要点である。読む側は書く側を待たず、書く側も読む側を待たない。

**VACUUM の重要性:**

PostgreSQL では、削除や更新で古いバージョンが残り続ける。これを掃除するのが VACUUM。Auto Vacuum がデフォルトで動くが、大量更新のテーブルでは追いつかず**テーブル膨張**が起きる。これは「テーブルサイズが減らない」「クエリが徐々に遅くなる」の原因。

**TXID Wraparound (周回問題):**

PostgreSQLの通常トランザクションIDは32ビット空間で周回するため、古い行をfreezeして可視性を維持する必要がある。Autovacuumにはwraparound防止の強制処理があり、限界へ近づくと書き込み停止や緊急VACUUMにつながりうる。`age(datfrozenxid)`などを監視し、autovacuumを無効化したまま運用しない。

<a id="section-14-9"></a>
### 14.9 ロック ― 楽観 vs 悲観
<!-- handbook:learning {"level":"required","minutes":10} -->
<!-- handbook:index {"group":"さ行","term":"楽観的ロック"} -->
<!-- handbook:index {"group":"は行","term":"悲観的ロック"} -->

<!-- handbook:narrative-bridge {"section":"14.9"} -->
MVCCは読み取りを進めやすくするが、同じ在庫や残高を複数の書き手が更新する競合までは自動的に解決しない。衝突を先に排除するか、更新時に検出してやり直すかという選択が、悲観ロックと楽観ロックである。

並行更新の競合をどう防ぐか。2つの戦略がある。

**悲観的ロック (Pessimistic Lock):**

「衝突するだろう」と想定し、最初からロックを取る。

```sql
BEGIN;
SELECT * FROM accounts WHERE id = 1 FOR UPDATE;  -- 排他ロック
-- 他のトランザクションは待たされる
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
COMMIT;
```

`FOR UPDATE` で行ロック。`SELECT ... FOR UPDATE SKIP LOCKED` を使えば、ロック中の行は飛ばして他を取れる (キュー実装の定石)。

**楽観的ロック (Optimistic Lock):**

「衝突は稀」と想定し、更新時に確認する。

```sql
-- バージョン列を持つ
CREATE TABLE products (
  id INTEGER PRIMARY KEY,
  name TEXT,
  stock INTEGER,
  version INTEGER NOT NULL DEFAULT 0
);

-- アプリ側: 取得時にversionも取る
SELECT id, stock, version FROM products WHERE id = 1;
-- → { stock: 10, version: 5 }

-- 在庫を減らす: versionが一致する場合のみ更新
UPDATE products
SET stock = stock - 1, version = version + 1
WHERE id = 1 AND version = 5;
-- 影響行数が 0 なら、他のトランザクションが先に更新した
-- → リトライまたはエラー
```

楽観的ロックは「**HTTP 409 Conflict**」を返す典型シナリオ (第12章のエラー設計を思い出してほしい)。クライアントは現在の版を取り直してリトライする。

<a id="section-14-10"></a>
### 14.10 デッドロック
<!-- handbook:learning {"level":"required","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"14.10"} -->
複数資源をロックする処理が増えると、それぞれが相手の保持するロックを待ち、進めなくなる可能性がある。デッドロックは個別のロック取得が正しくても全体の順序が循環する問題であり、検出とリトライを設計へ含めなければならない。

2つ以上のトランザクションが、互いのロック解放を待ち合う状態。

```text
T1: LOCK accounts(1) ← 取得
T2: LOCK accounts(2) ← 取得
T1: LOCK accounts(2) ← 待機 (T2 持ってる)
T2: LOCK accounts(1) ← 待機 (T1 持ってる)
   → デッドロック!
```

DB は自動検出して片方を強制ロールバックする。ただし、これに頼ると本番でエラーが頻発する。

**予防:**

- 複数行をロックするときは、**常に同じ順序で**取得する (例: ID 昇順)
- ロックの保持時間を短くする (トランザクション内で外部APIなど呼ばない)
- `SKIP LOCKED` でロック競合自体を避ける設計

<a id="section-14-11"></a>
### 14.11 ORM の光と影
<!-- handbook:learning {"level":"required","minutes":10} -->
<!-- handbook:index {"group":"O","term":"ORM"} -->

<!-- handbook:narrative-bridge {"section":"14.11"} -->
ここまでの仕組みを毎回SQLと結果変換で直接扱うと、業務コードが永続化の詳細へ埋もれる。ORMは表とオブジェクトの変換を共通化する一方、クエリ数、トランザクション境界、遅延読み込みを隠すため、その抽象の内外を往復して考える必要がある。

ORM (Object-Relational Mapping) はオブジェクトとリレーションを橋渡しする。代表例:

- **Prisma (Node/TypeScript)**: 型生成、マイグレーション、現代的
- **Drizzle (Node/TypeScript)**: SQLに近い、軽量、型安全
- **TypeORM (Node/TypeScript)**: NestJSとの統合、古参
- **Sequelize (Node)**: 老舗
- **SQLAlchemy (Python)**: 強力、フルスタック
- **ActiveRecord (Ruby/Rails)**: Rails のORM、規約重視

ORM の利点:

- 型安全 (TypeScript ORMの場合)
- SQLインジェクション対策が組み込み
- 複数 DB の差分を吸収
- マイグレーション管理

ORM の欠点:

- 複雑な SQL を表現しづらい
- 内部で発行される SQL が分かりづらい (パフォーマンス調査が困難)
- N+1 を生みやすい
- 学習コスト

**Prisma の実例:**

```typescript
// schema.prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String
  posts     Post[]
  createdAt DateTime @default(now())
}

model Post {
  id        String   @id @default(uuid())
  title     String
  body      String
  authorId  String
  author    User     @relation(fields: [authorId], references: [id])
  published Boolean  @default(false)
}
```

```typescript
// 利用側
const user = await prisma.user.findUnique({
  where: { email: 'alice@example.com' },
  include: { posts: { where: { published: true } } },
});
// user.posts は型補完が効く
```

**生 SQL に落とす局面:**

ORM では困難な複雑なクエリは、生 SQL を書くことを躊躇しない。多くの ORM は「raw query」のエスケープハッチを持つ。

```typescript
const stats = await prisma.$queryRaw<{ month: Date; count: bigint }[]>`
  SELECT DATE_TRUNC('month', created_at) AS month, COUNT(*) AS count
  FROM orders
  WHERE created_at >= NOW() - INTERVAL '12 months'
  GROUP BY month
  ORDER BY month;
`;
```

「ORM全部か、生SQL全部か」ではなく、適材適所で混在させるのがプロの使い方だ。

<a id="section-14-12"></a>
### 14.12 マイグレーション戦略
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"M","term":"Migration"} -->
<!-- handbook:index {"group":"ま行","term":"マイグレーション (DB)"} -->

<!-- handbook:narrative-bridge {"section":"14.12"} -->
ORMで現在のスキーマを扱えても、運用中のアプリケーションでは列、制約、インデックスを停止せず変更しなければならない。マイグレーションはDDLを書く作業ではなく、旧版と新版が共存する時間を安全に設計する作業である。

スキーマ変更を**コードとして管理し、版を進める**仕組み。

```sql
-- migrations/20260101_create_users.sql
CREATE TABLE users (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name  TEXT NOT NULL
);

-- migrations/20260201_add_status.sql
ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
CREATE INDEX idx_users_status ON users (status);
```

**安全なマイグレーションの原則 (本番ダウンタイムを避けるため):**

1. **NULL許可で列追加 → デフォルト値設定 → NOT NULL** (PostgreSQL 11+は ALTER TABLE ADD COLUMN with DEFAULT が高速になった)
2. **列削除は2段階**: 先にアプリで使うのを止める → 後で削除
3. **インデックス作成は CONCURRENTLY**: `CREATE INDEX CONCURRENTLY` でテーブルロックを避ける
4. **大きなテーブルの ALTER**: pg_repack や 段階的バッチ処理を検討

```sql
-- ロックを取らないインデックス作成
CREATE INDEX CONCURRENTLY idx_orders_user ON orders (user_id);
-- ※ トランザクション内では使えない
```

<a id="section-14-13"></a>
### 14.13 スロークエリを10倍速くする実演
<!-- handbook:learning {"level":"practical","minutes":10} -->

<!-- handbook:narrative-bridge {"section":"14.13"} -->
モデル、インデックス、実行計画、クエリ回数、接続方法を個別に理解した後は、それらを一つの遅い処理へ適用する必要がある。ここでは計測結果から原因仮説を立て、変更前後を比較する診断の流れとして性能改善を統合する。

実例で見る。次のクエリが遅いとしよう。

```sql
SELECT * FROM orders
WHERE LOWER(customer_email) = 'alice@example.com'
  AND created_at > '2025-01-01'
ORDER BY created_at DESC
LIMIT 20;
```

**ステップ1: EXPLAIN**

```text
Limit ... actual time=2500.5...
  -> Sort ... actual time=2500.4...
     Sort Key: created_at DESC
     -> Seq Scan on orders (cost=0.00..50000.00 rows=100 width=200)
        Filter: (lower(customer_email) = 'alice@example.com' AND created_at > '2025-01-01')
        Rows Removed by Filter: 999900
```

問題:

- Seq Scan (フルスキャン)
- `LOWER(customer_email)` で関数適用 → インデックスが効かない
- 100万行スキャンして 100行に絞っている

**ステップ2: 関数インデックス + 複合インデックス**

```sql
-- customer_email を常に lowercase で保存するか、関数インデックスを作る
CREATE INDEX idx_orders_email_created
  ON orders (LOWER(customer_email), created_at DESC);
```

**ステップ3: 再 EXPLAIN**

```text
Limit ... actual time=15.2...
  -> Index Scan using idx_orders_email_created on orders
     Index Cond: (lower(customer_email) = 'alice@example.com' AND created_at > '2025-01-01')
```

2500ms → 15ms (約170倍速)。インデックスのおかげで:

1. `LOWER(customer_email)` で直接絞り込み
2. `created_at` も含むのでさらに絞り込み + ソート不要

**ステップ4: SELECT * を必要列だけに**

```sql
SELECT id, created_at, total_amount FROM orders
WHERE ...
```

`*` で全列を取ると、大きな TEXT 列なども読まされる。**Index Only Scan** を狙うなら、必要な列だけインデックスに含める設計も検討。

これがチューニングの基本サイクル: **EXPLAIN → 問題特定 → 対策 → 再計測**。

<a id="section-14-14"></a>
### 14.14 OLTP と OLAP ― 役割の異なる2つのデータベース
<!-- handbook:learning {"level":"practical","minutes":10} -->
<!-- handbook:index {"group":"B","term":"BigQuery"} -->
<!-- handbook:index {"group":"C","term":"ClickHouse"} -->
<!-- handbook:index {"group":"O","term":"OLAP"} -->
<!-- handbook:index {"group":"O","term":"OLTP"} -->
<!-- handbook:index {"group":"た行","term":"データレイク"} -->

<!-- handbook:narrative-bridge {"section":"14.14"} -->
トランザクション処理を速くしても、大量の履歴を横断する集計が同じDB資源を占有すると、日常の更新処理を圧迫する。短い読み書きを最適化する OLTP (Online Transaction Processing) と、広い走査を最適化する OLAP (Online Analytical Processing) を分ける理由は、同じデータでも仕事の形が異なるためである。

ここまで扱ってきたPostgreSQLはOLTP (Online Transaction Processing) ― 短いトランザクションを大量に処理する用途だ。一方で、「**昨年の全注文を商品カテゴリ別に集計してグラフにする**」のような分析クエリは性質が違う。これを担うのが OLAP (Online Analytical Processing)。

| | OLTP | OLAP |
|---|---|---|
| クエリの性質 | 短い、1行〜数行を更新・取得 | 長い、数百万行を集計 |
| ユーザー | 顧客、業務担当 | アナリスト、経営陣 |
| データの新鮮さ | リアルタイム | 数分〜1日遅れOK |
| 代表DB | PostgreSQL、MySQL | BigQuery、Snowflake、ClickHouse、Redshift |
| ストレージ | 行指向 | 列指向 |

#### 列指向ストレージが効く理由

OLAPクエリは「**多数の行の少数の列を集計**」する。

```sql
SELECT category, SUM(amount) FROM orders
WHERE created_at >= '2025-01-01'
GROUP BY category;
```

行指向DB(PostgreSQL) は1行ぶんを連続して保存するため、`category` と `amount` だけ欲しくても、他の全列も読まされる。

列指向DBは1列ぶんを連続して保存するため、必要な列だけを読める。さらに同じ列内は値の種類が少ない (category なら数十種類) ので、圧縮率も高くなる。

#### 役割分担

```text
[アプリ] ─書き込み─> [Postgres (OLTP)]
                          ↓ CDC / 定期ETL
                     [BigQuery (OLAP)]
                          ↑
              [BI ツール / アナリスト]
```

OLTPは**動かす**ためのDB、OLAPは**測る**ためのDB。同じDBで両方やろうとすると、分析クエリがOLTPのレスポンスを劣化させる。

#### ClickHouse ― セルフホスト型OLAPの選択肢

クラウドOLAPはコストが膨らみがち。**ClickHouse**(Yandex発、OSS) はセルフホストで運用でき、秒間数百万行の挿入と、TB級データへの数秒のクエリを実現する。

```sql
-- ClickHouse の MergeTree テーブル
CREATE TABLE events (
  event_time DateTime,
  user_id UInt64,
  event_type LowCardinality(String),  -- 圧縮効率が良い
  properties String,
  amount Decimal64(2)
) ENGINE = MergeTree()
ORDER BY (event_time, user_id)
PARTITION BY toYYYYMM(event_time);

-- 集計クエリは桁違いに速い
SELECT
  toStartOfHour(event_time) AS hour,
  event_type,
  count() AS events,
  sumIf(amount, event_type = 'purchase') AS revenue
FROM events
WHERE event_time >= now() - INTERVAL 7 DAY
GROUP BY hour, event_type
ORDER BY hour;
```

PostgreSQLで同じクエリが数分かかるところを、ClickHouseは数秒で返す。

<a id="section-14-15"></a>
### 14.15 Schema Evolution ― データ契約をどう進化させるか
<!-- handbook:learning {"level":"practical","minutes":15} -->
<!-- handbook:index {"group":"P","term":"Protobuf"} -->
<!-- handbook:index {"group":"S","term":"Schema Evolution"} -->
<!-- handbook:index {"group":"S","term":"Schema Registry"} -->
<!-- handbook:index {"group":"さ行","term":"スキーマ進化"} -->
<!-- handbook:index {"group":"は行","term":"表記揺れ管理"} -->

<!-- handbook:narrative-bridge {"section":"14.15"} -->
OLTPと分析系へデータが広がると、スキーマ変更は一つのアプリケーションだけの問題ではなくなる。複数の生産者と消費者が異なる時期に更新される状況で、互換性を保ちながらデータ契約を進化させる設計が必要になる。

サービスが成長すると、データ構造も進化する。「**カラムを追加した**」「**型を変えた**」「**意味を変えた**」 ― これらが起きるたび、既存データと既存コードとの**互換性**が問題になる。

#### スキーマ進化の4種類

- **後方互換 (Backward compatible)**: 新スキーマで古いデータを読める
- **前方互換 (Forward compatible)**: 古いスキーマで新しいデータを読める
- **完全互換**: 両方
- **非互換 (Breaking)**: いずれも壊れる

メッセージング・イベントソーシング・API契約のいずれでも、**完全互換**を保つことが目標。一度壊すと、過去のメッセージを全部再変換するか、古いコンシューマを全て止めるかの選択になる。

#### Avro / Protobuf でのスキーマ進化

```protobuf
// v1: 初版
message UserCreated {
  string user_id = 1;
  string email = 2;
  string name = 3;
}

// v2: 任意フィールドを追加 (互換あり)
message UserCreated {
  string user_id = 1;
  string email = 2;
  string name = 3;
  optional string phone = 4;          // optional で前方・後方互換
  optional string locale = 5;
}

// v3: deprecated でマーク (まだフィールドは残す)
message UserCreated {
  string user_id = 1;
  string email = 2;
  string name = 3 [deprecated = true]; // 当面残す
  string full_name = 6;                // 新フィールド
  optional string phone = 4;
  optional string locale = 5;
}

// 後で「次のメジャー」リリースで name フィールド番号 3 を完全削除
```

**互換性のルール:**

- フィールド番号は**再利用しない**(削除後も予約済みにする)
- 必須 (required) フィールドの追加・削除は破壊的変更
- 型変更は基本的に破壊的 (`int32` → `int64` も注意)
- フィールド名変更はワイヤ互換だが、コード生成側で破壊的

#### Schema Registry の運用

複数サービスがイベントを共有するなら、スキーマを中央管理する。Confluent Schema Registry、Apicurio、AWS Glue Schema Registry などが選択肢。

```typescript
// Producer 側: スキーマを登録してメッセージを送信
import { SchemaRegistry, SchemaType } from '@kafkajs/confluent-schema-registry';

const registry = new SchemaRegistry({ host: 'http://schema-registry:8081' });

const schema = `
{
  "type": "record",
  "name": "UserCreated",
  "fields": [
    { "name": "userId", "type": "string" },
    { "name": "email", "type": "string" },
    { "name": "phone", "type": ["null", "string"], "default": null }
  ]
}`;

const { id: schemaId } = await registry.register({
  type: SchemaType.AVRO,
  schema,
});

// メッセージ送信
const event = { userId: 'user-42', email: 'alice@example.com', phone: null };
const encoded = await registry.encode(schemaId, event);
await producer.send({ topic: 'user-events', messages: [{ value: encoded }] });

// Consumer 側
await consumer.run({
  eachMessage: async ({ message }) => {
    const decoded = await registry.decode(message.value!);
    console.log(decoded);  // 型安全に取れる
  },
});
```

Schema Registry は新スキーマ登録時に**互換性チェック**を自動で行う。「後方互換のルール違反」のスキーマは登録を拒否される。これが**事故防止の最後の砦**になる。

#### REST API でのバージョニング

イベントだけでなくAPIにもスキーマ進化はある。

```text
# パスでバージョニング
/api/v1/users  → 旧フォーマット
/api/v2/users  → 新フォーマット

# ヘッダでバージョニング
Accept: application/vnd.myapp.v2+json

# クエリパラメータ
/api/users?v=2
```

「**新フィールドを増やすときは旧クライアントが壊れない**」が基本。フィールド削除は **deprecation 期間** を設けて、6ヶ月程度告知してから廃止する。

<a id="section-14-16"></a>
### 14.16 データレイクと列指向フォーマット ― Parquet、Iceberg、Delta Lake
<!-- handbook:learning {"level":"advanced","minutes":20} -->
<!-- handbook:index {"group":"D","term":"Delta Lake"} -->
<!-- handbook:index {"group":"I","term":"Iceberg (Apache)"} -->
<!-- handbook:index {"group":"L","term":"Lakehouse"} -->
<!-- handbook:index {"group":"P","term":"Parquet"} -->
<!-- handbook:index {"group":"た行","term":"データレイク"} -->
<!-- handbook:index {"group":"ら行","term":"列指向ストレージ"} -->

<!-- handbook:narrative-bridge {"section":"14.16"} -->
互換性を保って分析データを蓄積しても、行指向の表をそのまま長期保存・全件集計すると、容量とI/Oの効率が悪い。列指向フォーマットとテーブル形式は、分析で読む列だけを圧縮して走査し、巨大な履歴をデータレイク上で管理するために導入される。

14.14 で OLAP データベースを扱った。さらに大規模になると、**データレイク**という概念に出会う。「**生データを安価なオブジェクトストレージ (S3 等) に列指向フォーマットで保管し、複数の計算エンジンから読む**」アーキテクチャだ。

#### Parquet ― 分析基盤で広く使われる列指向フォーマット

Apache Parquet は列指向のバイナリフォーマットである。CSV や JSON と比べて次の点で有利になる:

| | CSV | JSON | Parquet |
|---|---|---|---|
| 行/列指向 | 行 | 行 | 列 |
| 圧縮 | gzip 等の外部圧縮 | gzip 等 | 内蔵 (Snappy、Gzip、Zstd) |
| 型情報 | なし | あいまい | あり (Schema 内蔵) |
| 範囲フィルタ | 全件スキャン | 全件スキャン | ファイル/列単位の統計でスキップ |
| 部分読み込み | 不可 | 不可 | 必要な列だけ読める |
| ファイルサイズ | 大 (10TB) | 大 (15TB) | 小 (1TB) |

10GB の CSV を Parquet にすると、1〜2GB 程度になることが一般的。S3 のコストもクエリ性能もケタが変わる。

```python
# pandas で Parquet 書き込み
import pandas as pd

df = pd.read_csv('sales.csv')
df.to_parquet('sales.parquet', compression='snappy')

# 読み込み(必要な列だけ)
df = pd.read_parquet('sales.parquet', columns=['date', 'amount'])
```

#### Apache Iceberg ― 「テーブルフォーマット」

Parquet はファイルフォーマットだが、それ単体ではテーブル概念 (`UPDATE`、`DELETE`、スキーマ進化、トランザクション) を持たない。これを上に被せるのが**テーブルフォーマット**。代表は3つ:

- **Apache Iceberg**: Netflix 発、現在のデファクト
- **Delta Lake**: Databricks 発、Spark との統合が強い
- **Apache Hudi**: Uber 発、ストリーミング更新に強い

Iceberg は「**S3 上の Parquet ファイル群を1つのテーブルとして扱う**」仕組み:

```text
my_table/
├── metadata/
│   ├── v1.metadata.json   ← スキーマ・スナップショット定義
│   ├── v2.metadata.json
│   └── snapshot-*.avro    ← トランザクションログ
└── data/
    ├── part-0001.parquet
    ├── part-0002.parquet
    └── ...
```

#### Iceberg が提供する機能

1. **ACID トランザクション**: 「**書き込み中に他の読み込みクライアントが中途半端なデータを見ない**」を保証
2. **スキーマ進化**: カラム追加・削除・型変更が可能 (14.15 の Schema Evolution の S3 版)
3. **タイムトラベル**: 過去の任意の時点のスナップショットを読める
4. **Hidden Partitioning**: 「日付パーティション」を SQL で明示せずとも自動適用
5. **Compaction**: 小さなファイルを統合してクエリ性能を維持
6. **複数エンジン対応**: Spark、Trino、Flink、Snowflake、BigQuery など、同じテーブルを異なるエンジンから読み書き

```sql
-- Spark から Iceberg テーブルを操作
CREATE TABLE prod.sales (
  id BIGINT,
  date DATE,
  amount DECIMAL(10,2),
  region STRING
)
USING iceberg
PARTITIONED BY (days(date));

INSERT INTO prod.sales VALUES (1, '2026-05-20', 100.50, 'JP');

-- タイムトラベル(1時間前の状態)
SELECT * FROM prod.sales TIMESTAMP AS OF '2026-05-20 14:00:00';

-- スキーマ追加
ALTER TABLE prod.sales ADD COLUMN customer_id BIGINT;
```

#### Lakehouse アーキテクチャ

「**データレイクの安さ + データウェアハウスの構造化**」を両立する考え方が **Lakehouse**。

```text
[OLTP DB (Postgres)]
       ↓ CDC (Debezium)
[Kafka]
       ↓
[Iceberg on S3]  ← 生データ・履歴
       ↓
[BigQuery / Snowflake / DuckDB] ← クエリエンジン (必要時にアクセス)
       ↓
[BI ツール、ML 学習]
```

「データはストレージに残り、計算エンジンはそのときどき選ぶ」のがクラウドネイティブな現代の流儀。ストレージとコンピュートを分離することで、それぞれを独立してスケールできる。

#### レイクハウスの採用判断

Lakehouse 系は**スタートアップには過剰**。PostgreSQL + 定期 BigQuery 同期で十分なケースが大半。

採用検討すべきとき:

- データ量が **TB を超え**、PostgreSQL の OLAP 性能が限界
- データを **複数のチーム/エンジンから** 並列利用する
- **過去スナップショット** が監査要件として必要
- ストリーミングと バッチ の両方で同じデータを扱う

<a id="section-14-17"></a>
### 14.17 Materialized View ― 高速集計の事前計算
<!-- handbook:learning {"level":"practical","minutes":15} -->
<!-- handbook:index {"group":"M","term":"Materialized View"} -->
<!-- handbook:index {"group":"P","term":"pg_ivm"} -->
<!-- handbook:index {"group":"ま行","term":"マテリアライズドビュー"} -->

<!-- handbook:narrative-bridge {"section":"14.17"} -->
分析基盤を用意しても、同じ集計を要求のたびに最初から計算すれば応答時間と計算費用が増える。Materialized Viewは結果を事前計算して保持し、更新鮮度と読み取り速度を交換する選択肢である。

17.9 の CQRS (Command Query Responsibility Segregation) と 15.9 の TimescaleDB Continuous Aggregates で「事前集計したテーブル」を扱うが、**Materialized View (マテリアライズドビュー)** の詳細を扱う。

#### 通常のビューとの違い

- **VIEW**: クエリの別名。読むたびに元クエリが実行される
- **MATERIALIZED VIEW**: クエリ結果を**実テーブルとして保存**。読み込みは高速、更新は手動またはトリガー

```sql
-- 通常のビュー: クエリのエイリアス
CREATE VIEW recent_orders AS
SELECT * FROM orders WHERE created_at > NOW() - INTERVAL '7 days';
-- 毎回 orders テーブルを WHERE で絞る

-- マテリアライズドビュー: 結果を物理保存
CREATE MATERIALIZED VIEW daily_sales AS
SELECT
  DATE(created_at) AS date,
  region,
  SUM(amount) AS total,
  COUNT(*) AS count
FROM orders
GROUP BY DATE(created_at), region;

-- インデックスも貼れる(通常のテーブルと同じ)
CREATE UNIQUE INDEX ON daily_sales (date, region);
```

#### リフレッシュ戦略

マテビューは「**いつ更新されるか**」が常に問題になる。

**1. 全件再計算 (Full Refresh)**

```sql
REFRESH MATERIALIZED VIEW daily_sales;
-- → SELECT 全体を再実行、テーブルを置き換える
-- → 大規模だと数分〜数時間かかる、その間ロック
```

**2. 並行リフレッシュ**

```sql
-- Postgres 9.4+
REFRESH MATERIALIZED VIEW CONCURRENTLY daily_sales;
-- → 古いビューを読みつつ、新しいビューを別途構築 → 切り替え
-- → ロックなし、ただし UNIQUE インデックス必須
```

**3. 増分リフレッシュ**

PostgreSQL 標準ではサポートされていない。トリガーや拡張 (`pg_ivm`) で実現する。

```sql
-- pg_ivm 拡張を使った増分マテビュー
CREATE INCREMENTAL MATERIALIZED VIEW daily_sales AS
SELECT DATE(created_at) AS date, SUM(amount) AS total
FROM orders
GROUP BY DATE(created_at);
-- → orders にINSERT/UPDATEがあると自動的にビューも更新
```

**4. アプリケーション側で増分更新**

最も柔軟。CQRS パターン (17.9) と同じ:

```typescript
// 注文作成時に集計テーブルも更新
async function createOrder(data: OrderInput) {
  await db.$transaction(async (tx) => {
    const order = await tx.order.create({ data });
    await tx.dailySales.upsert({
      where: { date_region: { date: today(), region: order.region } },
      update: {
        total: { increment: order.amount },
        count: { increment: 1 },
      },
      create: {
        date: today(), region: order.region,
        total: order.amount, count: 1,
      },
    });
    return order;
  });
}
```

#### 使い分け

| ケース | 戦略 |
|---|---|
| データが日次バッチで OK | 全件 REFRESH を cron で |
| ダウンタイム NG | CONCURRENTLY |
| リアルタイム性が必要 | 増分 (pg_ivm またはアプリ層) |
| 複雑な集計、頻繁な変更 | CQRS パターンでアプリ側管理 |

<a id="section-14-18"></a>
### 14.18 VACUUM の詳細 ― PostgreSQL 運用の死活問題
<!-- handbook:learning {"level":"practical","minutes":20} -->
<!-- handbook:index {"group":"P","term":"pg_repack"} -->
<!-- handbook:index {"group":"V","term":"VACUUM"} -->
<!-- handbook:index {"group":"あ行","term":"永続化 (PostgreSQL VACUUM)"} -->

<!-- handbook:narrative-bridge {"section":"14.18"} -->
MVCCが過去の行バージョンを残すことで読み書きは並行できるが、不要になった版を放置すれば表とインデックスが膨らむ。VACUUMはMVCCの利点を継続して得るための後処理であり、論理設計とは別に運用上の寿命管理が必要だと分かる。

14.8 MVCC で「VACUUM が掃除する」と書いたが、運用で苦しむ最大の問題の一つなので深掘りする。

#### PostgreSQL の MVCC が VACUUM を必要とする理由

PostgreSQL は UPDATE/DELETE 時に古い行をその場で消さず、新しい行を追加して古い行に「削除済み」マークを付ける。これにより:

- 進行中のトランザクションが古い行を読み続けられる (ロック不要)
- ロールバックが高速 (新しい行を捨てるだけ)

しかし結果として:
- テーブルがディスク上で**ふくらみ続ける** (テーブル肥大化)
- 「削除済み行」がインデックスにも残る
- クエリは大量の不要行を読みつつスキップする → 徐々に遅くなる

通常のVACUUMは、他のトランザクションから不要になった行バージョンを再利用可能として処理し、可視性マップ等を保守する。通常はテーブルファイルを詰め直してOSへ領域を返す処理ではない。

#### Autovacuum

PostgreSQL は **autovacuum** デーモンが自動的に VACUUM を実行する。

```sql
-- 設定確認
SHOW autovacuum;                  -- on
SHOW autovacuum_vacuum_threshold; -- 50
SHOW autovacuum_vacuum_scale_factor; -- 0.2 = 20%

-- 「死行数 > 50 + テーブル行数 × 0.2」になると autovacuum 起動
```

大量更新テーブルでは autovacuum が**追いつかない**ことがある。

#### VACUUM の種類

**1. VACUUM (通常)**

```sql
VACUUM orders;
-- 不要な行バージョンの領域を再利用可能にする
-- 可視性マップなどを保守する
-- 通常のVACUUMだけではプランナ統計を更新しない
-- テーブルサイズは通常縮まない
```

**2. VACUUM FULL**

```sql
VACUUM FULL orders;
-- テーブル全体を書き直す
-- テーブルサイズが実際に縮む
-- ★ ACCESS EXCLUSIVE LOCK ★ ― 全アクセスをブロック
-- 巨大テーブルだと数時間
```

`VACUUM FULL`は長い排他ロックと追加ディスク領域を要するため、通常運用の第一選択にはしない。ただし保守時間を確保でき、ファイル縮小が必要な場合には有効である。`pg_repack`などのオンライン再構築も、拡張導入、追加領域、主キーまたは一意制約、失敗時手順を確認して使う。

**3. VACUUM ANALYZE**

```sql
VACUUM ANALYZE orders;
-- 通常 VACUUM + 統計情報を完全に更新
-- クエリプランナの判断材料を更新する
```

新しいインデックスを作った後、巨大ロード後、大量UPDATE後などに手動実行する。

#### REINDEX

インデックスも肥大化する。

```sql
-- インデックスを作り直す
REINDEX INDEX orders_user_id_idx;
REINDEX TABLE orders;        -- テーブルの全インデックス
REINDEX DATABASE app;        -- DB 全体(危険)

-- Postgres 12+ なら CONCURRENTLY オプション
REINDEX INDEX CONCURRENTLY orders_user_id_idx;
```

#### pg_repack ― 本番運用のための拡張

VACUUM FULL は重すぎる。`pg_repack` は「ロックを最小限にしながらテーブル/インデックスを再構築」する拡張。

```bash
pg_repack -t orders mydb
# 内部的に:
# 1. orders と同じ構造の新テーブル作成
# 2. トリガーで変更を新テーブルにも反映
# 3. 既存データを新テーブルにコピー
# 4. 最後に超短時間ロックして名前を入れ替え
# 5. 古いテーブルを削除
```

テーブル肥大化が問題になったら、原因となる長時間トランザクション、レプリケーションスロット、autovacuum設定、更新パターンを先に診断する。再構築が必要な場合に`VACUUM FULL`、`CLUSTER`、`pg_repack`等を、ロック時間と追加ディスクを比較して選ぶ。

#### 監視すべきメトリクス

```sql
-- 死行数とテーブルサイズ
SELECT
  schemaname, relname,
  n_dead_tup,
  n_live_tup,
  n_dead_tup::float / NULLIF(n_live_tup, 0) AS dead_ratio,
  pg_size_pretty(pg_total_relation_size(relid)) AS size
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC
LIMIT 10;

-- 最後のVACUUM/autovacuum実行時刻
SELECT schemaname, relname, last_vacuum, last_autovacuum
FROM pg_stat_user_tables
WHERE last_autovacuum < NOW() - INTERVAL '1 day';
```

`n_dead_tup`や比率だけで一律判定せず、テーブルサイズ、更新速度、autovacuum実行時間、長時間トランザクション、I/O、クエリ性能、XID年齢と合わせて判断する。小さいテーブルと巨大テーブルでは適切な閾値が異なる。

#### Autovacuum チューニング

```sql
-- テーブル単位で設定変更
ALTER TABLE high_update_table SET (
  autovacuum_vacuum_scale_factor = 0.05,  -- 5% で発動
  autovacuum_vacuum_cost_limit = 2000     -- 1回でより多くの仕事をする
);
```

「大量更新するテーブルは autovacuum を積極的に」が指針。

<a id="section-14-19"></a>
### 14.19 Connection Pooler ― DB接続管理の必須インフラ
<!-- handbook:learning {"level":"practical","minutes":15} -->
<!-- handbook:index {"group":"C","term":"Connection Pooler"} -->
<!-- handbook:index {"group":"P","term":"PgBouncer"} -->
<!-- handbook:index {"group":"か行","term":"コネクションプール"} -->

<!-- handbook:narrative-bridge {"section":"14.19"} -->
テーブルとクエリを整えても、アプリケーションプロセス数に比例してDB接続を増やせば、接続管理だけでサーバ資源を使い切る。Connection Poolerは、アプリケーション上の並行要求とDBが実際に処理できるセッション数を切り離す。

「**アプリのインスタンスを 100 台に増やしたら、PostgreSQL が落ちた**」 ― これはコネクションプール不足によくある事故。

#### 問題: PostgreSQL のコネクションは重い

PostgreSQLはクライアント接続ごとにバックエンドプロセスを割り当てる。`max_connections`のデフォルト値や実用上限は配布形態、マネージドサービス、メモリ設定で異なる。上限を超えた新規接続は通常拒否され、上限へ近づく前からメモリ消費やスケジューリング負荷が性能を悪化させうる。

しかし:
- アプリインスタンスごとに10接続持つと、10台で100接続
- Lambda やコンテナでオートスケールすると、数百インスタンスに
- すぐに `max_connections` を超える

#### 解決: Connection Pooler

接続プーラーが「アプリ ⇔ PostgreSQL」の間に立ち、少数の物理接続を多数の論理接続に多重化する。

```text
[App 1] ─┐
[App 2] ─┤  ─→ [Pooler] ─5接続→ [Postgres]
[App 3] ─┤      (例: 500論理接続を5物理接続に集約)
...     ─┘
[App 100] 
```

#### PgBouncer ― 最も使われる Connection Pooler

3つのプーリングモードがある:

**1. Session pooling**: 接続単位で物理接続を割り当て (プーリング効果薄い)

**2. Transaction pooling**: トランザクション単位で割り当て (最もよく使われる)

**3. Statement pooling**: SQL文単位で割り当て (プリペアドステートメントが壊れる)

```ini
# pgbouncer.ini
[databases]
app_db = host=postgres.internal port=5432 dbname=app

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
```

「アプリは PgBouncer のポート (6432) に接続、PgBouncer が PostgreSQL(5432) に接続」という構成。

#### Transaction pooling の罠

トランザクション単位でプーリングすると、同じクライアントが次のトランザクションで同じサーバ接続を得る保証がない。そのため、接続に残る状態へ依存してはならず、プーラのリセット設定とバージョンごとの機能対応を確認する。

```sql
-- 接続に紐づくSQL PREPAREや一時オブジェクトは、次のトランザクションで
-- 同じバックエンドへ戻る前提にできない。PgBouncerのバージョンと設定によって
-- プロトコルレベルprepared statementの対応は異なる。
PREPARE my_query AS SELECT * FROM users WHERE id = $1;

-- トランザクション内だけ有効にする
SET LOCAL search_path TO custom_schema;
```

Transaction pooling 時の制約:
- `PREPARE` / `LISTEN` / `WITH HOLD CURSOR` などのセッション機能が使えない
- `SET` は `SET LOCAL` を使う
- 接続単位の一時テーブルは使いにくい

#### マネージドな選択肢

- **AWS RDS Proxy**: AWS マネージド、IAM認証統合、ホットスタンバイ
- **Supabase pooler**: Supabase 内蔵
- **Neon**: サーバレス PostgreSQL、内蔵 pooler
- **PgCat**: Rust 製の新興、ロードバランス機能つき

#### Lambda/サーバレスでの必要性

サーバレス実行環境は再利用されることがある一方、同時実行数の増加に応じて複数の実行環境が立ち上がる。各環境が独立したDBプールを持つと、ピーク時の総接続数が急増する。

```text
Lambda 同時実行 1000 → 1000 接続 → Postgres 死ぬ
```

サーバレスでは、マネージドプロキシ、外部プーラ、HTTP/Data API、接続数を小さくした直接接続などを比較する。高い同時実行数で直接PostgreSQLへ接続する場合は、総接続数と再接続嵐を負荷試験する。

#### アプリ側でのコネクションプール

各アプリ自身も内部でプールを持つ (Node.js `pg` の `Pool`、Prisma の内部プール等)。

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  host: 'pgbouncer.internal',
  port: 6432,                      // PgBouncer のポート
  database: 'app',
  user: 'app_user',
  max: 10,                         // インスタンスあたり最大10接続
  idleTimeoutMillis: 30000,        // アイドル30秒で切断
  connectionTimeoutMillis: 5000,   // 接続取得の待ち時間
});
```

「アプリのプール × インスタンス数 ≤ PgBouncer の上限 ≤ PostgreSQL の max_connections」の階層を考えて設定する。

<a id="section-14-20"></a>
### 14.20 テナント分離モデルと Row-Level Security
<!-- handbook:learning {"level":"practical","minutes":25} -->
<!-- handbook:index {"group":"R","term":"Row-Level Security (RLS)"} -->
<!-- handbook:index {"group":"ま行","term":"マルチテナント分離モデル"} -->
<!-- handbook:index {"group":"さ行","term":"サイロ・プール・ブリッジ"} -->

<!-- handbook:narrative-bridge {"section":"14.20"} -->
14.19 までで、1つのデータベースを多数のアプリケーションプロセスが共有する状況を扱った。SaaSではさらに、その1つのデータベースを多数の顧客企業が共有する。このとき顧客どうしの境界は、アプリケーションが書く `WHERE` 句だけが支えていることが多い。本節では、その境界をデータベース自身に宣言させる方法と、宣言が効かなくなる条件を扱う。

13.24 では、テナント境界の判定をアプリケーション側で型と関数へ集約した。ここでは同じ境界をデータベース側にも置く。目的は二重化であり、アプリケーションの経路が1つ抜けたときに、漏洩ではなく0件として現れるようにすることである。

#### 3つの分離モデル

テナントごとにどこまで物理的に分けるかで、運用の性質が大きく変わる。

| モデル | 構成 | 分離の強さ | 運用コスト | 向く条件 |
|---|---|---|---|---|
| プール (shared schema) | 1DB・1スキーマ・全テナント同居。行に `tenant_id` | 弱い (論理のみ) | 低い | テナント数が多く、1テナントが小さい |
| ブリッジ (schema per tenant) | 1DB・テナントごとにスキーマ | 中 | 中 | 数百規模、テナントごとの拡張が必要 |
| サイロ (database/cluster per tenant) | テナントごとにDBまたはクラスタ | 強い | 高い | 規制要件、大口顧客、性能の完全分離 |

この3つの呼び分けは、AWS の SaaS Lens が整理した語彙に沿っている [AWS SaaS Lens, 2024]。3つは排他ではない。多くのSaaSはデフォルトをプールにし、要求の厳しい顧客だけをサイロへ昇格させる混在構成を採る。混在させる場合、アプリケーションから見た接続先の解決 (テナント → 接続文字列) を1か所に集約しておかないと、後から分けられなくなる。

判断軸は次の4つで整理できる。

- **復旧単位**: 1テナントだけを過去の時点へ戻す要求があるか。プールでは論理的な巻き戻しを自前で作る必要がある。
- **移行単位**: スキーマ変更を全テナント同時に適用するか、テナントごとに段階適用するか。ブリッジやサイロでは適用対象が増え、14.12 のマイグレーションが N 回に増える。
- **雑音の遮断**: 1テナントの重い処理が他テナントへ波及することを許容できるか (14.22)。
- **単価**: テナントあたりの固定費。サイロはテナント数に比例して接続数、バックアップ、監視対象が増える。

以降はプールを前提にする。分離が最も弱く、対策が最も必要なモデルだからである。

#### Row-Level Security の基本

PostgreSQLのRow-Level Security (RLS) ― 行単位セキュリティ ― は、テーブルへアクセスした行を、宣言したポリシーで自動的に絞り込む機能である。アプリケーションが `WHERE tenant_id = ...` を書き忘れても、データベース側で条件が追加される。

```sql
-- 1. テーブルにテナント列を置く
CREATE TABLE tasks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  title       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tasks_tenant_created_idx ON tasks (tenant_id, created_at DESC);

-- 2. RLS を有効化する。この時点でポリシーが1つもなければ「全行不可視」になる
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- 3. ポリシーを宣言する
CREATE POLICY tasks_tenant_isolation ON tasks
  USING      (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

`USING` と `WITH CHECK` は役割が異なる。

- `USING` は**見える行**を決める。`SELECT`、`UPDATE`、`DELETE` が対象行を選ぶときに適用される。
- `WITH CHECK` は**書ける行**を決める。`INSERT` の新しい行と、`UPDATE` 後の行に適用される。

`WITH CHECK` を省略すると `USING` の式が流用される。しかし両者を分けたい場合がある。たとえば「読み取りは自テナント、書き込みはさらに読み取り専用フラグが立っていないこと」という条件は、`USING` と `WITH CHECK` を別に書く。逆に `USING` だけを書いて `WITH CHECK` の意味を考えないと、他テナントの `tenant_id` を持つ行を挿入できてしまう構成になりうる。

セッション変数は、リクエストの処理を始める時点で設定する。

```sql
BEGIN;
SET LOCAL app.tenant_id = '2b1a...';   -- トランザクション終了で自動的に戻る
SELECT count(*) FROM tasks;            -- 自テナントの行だけが数えられる
COMMIT;
```

#### 効かなくなる4つの条件

RLSは「有効にしたはずなのに効いていない」事故が起きやすい。原因のほとんどは次の4つに収まる。

**(1) テーブル所有者はポリシーを迂回する。** PostgreSQLでは、テーブルの所有者に対してRLSはデフォルトで適用されない [PostgreSQL Row Security Policies]。アプリケーションが所有者ロールで接続していると、ポリシーを書いても素通りする。所有者にも適用したい場合は明示する。

```sql
ALTER TABLE tasks FORCE ROW LEVEL SECURITY;
```

この1行は稼働中に実行してはいけない。所有者ロールで接続しているアプリは、実行した瞬間からポリシーの対象になる。`app.tenant_id` のような設定値を渡していない経路 (バッチ、管理画面、マイグレーション) のクエリは、エラーではなく**0行**を返す。障害としては「データが消えた」ように見え、原因にたどり着くまで時間がかかる。先に staging で全経路が設定値を渡していることを確かめ、切り戻し (`NO FORCE ROW LEVEL SECURITY`) を手元に用意してから、メンテナンス時間内に適用する。

なお、`CREATE ROLE ... PASSWORD 'リテラル'` の形で書いたパスワードは、`pg_stat_activity` の現在のクエリと、`log_statement` の設定によってはサーバログにも平文で残る。`psql` の `\password` メタコマンドを使うか、あらかじめ計算した SCRAM 検証子を渡す。

より安全なのは、所有者とアプリケーション用ロールを分けることである。マイグレーションは所有者ロール、アプリケーションは権限を絞ったロールで接続する。

```sql
-- 権限をまとめるグループロール (接続しない)
CREATE ROLE app_role NOLOGIN;
GRANT SELECT, INSERT, UPDATE, DELETE ON tasks TO app_role;

-- アプリケーションが接続するロール。グループから権限を継承する
CREATE ROLE app_user LOGIN PASSWORD '...';
GRANT app_role TO app_user;
-- app_user は所有者ではないため、ポリシーが適用される
```

**(2) `BYPASSRLS` 属性とスーパーユーザー。** `ALTER ROLE ... BYPASSRLS` を持つロールと、スーパーユーザーはポリシーを迂回する。バッチ処理や分析ツールが管理者ロールで接続していると、そこだけ境界がない。分析基盤へ流す経路 (14.14、17.12) は、RLSの適用対象外になりやすいので設計時に確認する。

**(3) セッション変数が未設定のまま。** `current_setting('app.tenant_id')` は第2引数を省略すると、未設定時にエラーになる。第2引数へ `true` を渡すと `NULL` を返し、`tenant_id = NULL` は真にならないため結果は0行になる。どちらが良いかは方針で決まる。

- エラーにする: 設定漏れが即座に失敗として現れる。開発中に見つけやすい。
- 0行にする: 本番で不可解な「データが消えた」という問い合わせになりやすい。

推奨は、エラーにするか、または `NULL` のときに例外を投げるラッパー関数を挟むことである。

```sql
CREATE FUNCTION app_current_tenant() RETURNS uuid
LANGUAGE plpgsql STABLE AS $$
DECLARE value text := current_setting('app.tenant_id', true);
BEGIN
  IF value IS NULL OR value = '' THEN
    RAISE EXCEPTION 'app.tenant_id is not set';
  END IF;
  RETURN value::uuid;
END;
$$;

CREATE POLICY tasks_tenant_isolation ON tasks
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());
```

**(4) 接続プールで前のリクエストの設定が残る。** 14.19 のトランザクションプーリングでは、同じ物理接続が次々に別のリクエストへ貸し出される。`SET` (セッション単位) で設定すると、返却後も値が残り、次のテナントの処理がその値を引き継ぐ。これは0件になるのではなく、**別テナントのデータが見える**方向の事故になる。

対策は、`SET LOCAL` をトランザクション内で使うことに尽きる。プールの返却時リセットに頼らず、借りた接続で必ず設定してから使う形をコードで固定する。

```typescript
import type { Pool, PoolClient } from 'pg';

/** テナント文脈つきでトランザクションを実行する唯一の入口。 */
export async function withTenant<T>(
  pool: Pool,
  tenantId: string,
  run: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // set_config の第3引数 true が SET LOCAL 相当。値はパラメータで渡す
    await client.query('SELECT set_config($1, $2, true)', ['app.tenant_id', tenantId]);
    const result = await run(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

`SET LOCAL app.tenant_id = '...'` を文字列連結で組み立てると、`SET` はパラメータ化できないためSQLインジェクションの経路になる。`set_config()` 関数を使えば通常のパラメータとして渡せる。

#### PERMISSIVE と RESTRICTIVE

複数のポリシーが同じテーブルに付く場合、デフォルトの `PERMISSIVE` は **OR** で結合される。つまりポリシーを増やすほどアクセスできる範囲が広がる。テナント境界のように「必ず満たすべき条件」は `RESTRICTIVE` で宣言すると **AND** で結合され、他のポリシーを追加しても境界が緩まない。

```sql
-- 必須条件: テナント一致 (AND で結合される)
CREATE POLICY tasks_tenant_guard ON tasks AS RESTRICTIVE
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());

-- 追加条件: 下書きは作成者だけが読める (OR で結合される)
CREATE POLICY tasks_visible ON tasks AS PERMISSIVE FOR SELECT
  USING (status <> 'draft' OR author_id = current_setting('app.user_id', true));
```

`RESTRICTIVE` ポリシーだけを定義してアクセスが全く通らない、という詰まり方をすることがある。`RESTRICTIVE` は許可を与えないため、少なくとも1つの `PERMISSIVE` ポリシーが必要である。

#### 性能への影響

ポリシーの述語は、クエリの条件に追加される形で評価される。したがって、その述語がインデックスを使えるかどうかが性能を決める。

- `tenant_id = <定数>` の形になるよう、`current_setting()` を包む関数は `STABLE` にする。`VOLATILE` だと行ごとに評価され、インデックス条件として使われない。
- 複合インデックスの先頭列を `tenant_id` にする。テナント内での並び替えや範囲検索がそのまま乗る。
- `EXPLAIN` の出力にポリシー由来の条件が現れる。想定した条件が `Index Cond` ではなく `Filter` に落ちていれば、インデックス設計かポリシーの書き方を見直す。

もう1つの注意点は、ポリシーの述語に使う関数が漏洩経路になりうることである。PostgreSQLは、`LEAKPROOF` でない関数を、セキュリティ条件より先に評価しないよう制御する。しかし、ユーザー定義関数をポリシーやクエリへ持ち込む場合は、エラーメッセージや実行時間から情報が推測されうる点を考慮する。ポリシーの述語は、列の比較のような単純な式に保つのが安全である。

#### ポリシーをテストする

RLSは「効いていること」を自動で確かめないと、いつ壊れたか分からない。次の3つを結合テストに入れる。

```sql
-- 1. 自テナントの行は見える
BEGIN;
SELECT set_config('app.tenant_id', :'tenant_a', true);
INSERT INTO tasks (tenant_id, title) VALUES (:'tenant_a', 'a-1');
SELECT count(*) FROM tasks;                      -- 1 を期待
COMMIT;

-- 2. 他テナントの行は見えない
BEGIN;
SELECT set_config('app.tenant_id', :'tenant_b', true);
SELECT count(*) FROM tasks;                      -- 0 を期待
-- 3. 他テナントの行は書けない (WITH CHECK 違反)
INSERT INTO tasks (tenant_id, title) VALUES (:'tenant_a', 'b-forged');
-- ERROR: new row violates row-level security policy for table "tasks"
ROLLBACK;
```

3番目が最も忘れられやすい。`USING` だけを見て「読めないから安全」と判断すると、他テナントの `tenant_id` を持つ行を作られ、そのテナントの一覧に見知らぬ行が現れる事故になる。

課題13.7 では、RLSに相当するポリシー層をアプリケーション内に自作し、境界が破れる条件と塞がる条件を実際に再現する。データベースを起動せずに、`USING` と `WITH CHECK` の役割の違い、所有者バイパス、接続の使い回しによる文脈残留を観察できる。

#### つまずく箇所 ― テナント分離モデル

- **RLSを有効にしただけで満足する**: ポリシーがなければ全行不可視、所有者接続なら全行素通りという両極端になる。有効化・ポリシー定義・`FORCE`・接続ロールの4点が揃って初めて機能する。
- **マイグレーションでポリシーを付け忘れる**: 新しいテーブルはデフォルトでRLS無効である。テーブル追加時にポリシーを必須にする検査 (`pg_class.relrowsecurity` を全テーブル分確認するテスト) をCIへ入れる。
- **アプリケーション側のフィルタを消してしまう**: RLSがあるからと `WHERE tenant_id` を外すと、結合や集計の実行計画が悪化し、また「0件なのは権限か不在か」の区別がつかなくなる。二重に書く。
- **RLSを認可の全体だと考える**: RLSが答えるのは「どのテナントの行か」だけで、「このロールがこの操作をしてよいか」は13.10 の認可モデルの仕事である。両方を1つのポリシーへ詰め込むと、変更のたびにSQLを書き換えることになる。

<a id="section-14-21"></a>
### 14.21 テナント別設定・暗号鍵・データ移行
<!-- handbook:learning {"level":"practical","minutes":20} -->
<!-- handbook:index {"group":"E","term":"Envelope Encryption (エンベロープ暗号化)"} -->
<!-- handbook:index {"group":"B","term":"BYOK (Bring Your Own Key)"} -->
<!-- handbook:index {"group":"か行","term":"暗号消去 (crypto-shredding)"} -->
<!-- handbook:index {"group":"た行","term":"テナント移行"} -->

<!-- handbook:narrative-bridge {"section":"14.21"} -->
14.20 で行の境界を宣言できるようになった。しかしテナントが違えば、見えるデータだけでなく、動作の設定、暗号鍵、そしてデータが置かれる場所そのものが変わりうる。境界を守ったまま、テナントごとに異なる値と、テナント単位の引っ越しをどう扱うかが次の問題になる。

#### 設定の解決順序を先に決める

テナントごとに変えたい値は、機能の有効・無効、上限値 (メンバー数、ファイルサイズ)、デフォルトのタイムゾーンや言語、通知の宛先、保持期間など多岐にわたる。実装を始める前に決めるべきは、値そのものではなく**解決順序**である。

```text
既定値 (コード)
  ← プラン (Free / Pro / Enterprise)
    ← テナント個別の上書き
      ← ユーザー個別の上書き (対象になる項目のみ)
```

順序が決まっていれば、「Pro プランなのにこの機能が使えない」という問い合わせに対し、どの層で上書きされたかを機械的に説明できる。逆に、テナント設定テーブルへ全項目を保存する設計にすると、デフォルト値を変更しても既存テナントへ反映されず、プランの意味が薄れる。

```typescript
export type FeatureSettings = {
  maxMembers: number;
  maxUploadBytes: number;
  auditLogRetentionDays: number;
  defaultTimeZone: string;      // IANA タイムゾーンID (14.23)
  ssoRequired: boolean;
};

const DEFAULTS: FeatureSettings = {
  maxMembers: 5,
  maxUploadBytes: 10 * 1024 * 1024,
  auditLogRetentionDays: 30,
  defaultTimeZone: 'UTC',
  ssoRequired: false,
};

const PLANS: Record<Plan, Partial<FeatureSettings>> = {
  free: {},
  pro: { maxMembers: 50, maxUploadBytes: 100 * 1024 * 1024, auditLogRetentionDays: 365 },
  enterprise: { maxMembers: 5000, auditLogRetentionDays: 2555, ssoRequired: true },
};

/** overrides はテナント設定テーブルから読む。未設定の項目は保存しない。 */
export function resolveSettings(plan: Plan, overrides: Partial<FeatureSettings>): FeatureSettings {
  return { ...DEFAULTS, ...PLANS[plan], ...overrides };
}
```

保存先は、項目が固定的なら専用列、増減が激しいなら `jsonb` 列が扱いやすい。`jsonb` を選ぶ場合は、書き込み時にスキーマ検証を通し、未知のキーを弾く。検証がないと、綴り違いのキーが黙って無視され、「設定したのに効かない」という調査の難しい不具合になる。

設定は認可の入力でもあるため、変更履歴を残す。誰が、いつ、どの値を、どの値へ変えたかを監査イベントとして記録し、キャッシュしている場合は無効化の経路も設計に含める (24.5)。

#### 暗号鍵をテナントごとに分ける

「顧客データは顧客ごとの鍵で暗号化する」という要求は、金融・医療・公共の顧客から出やすい。素直に実装すると、行ごとに鍵を引く処理が入り、鍵管理サービスへの呼び出しが増えて性能が落ちる。実務では**エンベロープ暗号化** (envelope encryption) を使う。鍵の階層と有効期間の考え方は NIST SP 800-57 が整理している [NIST SP 800-57 Part 1, 2020]。

```text
KEK (Key Encryption Key)          … KMS/HSM の中にあり、外へ出ない
 └─ DEK (Data Encryption Key)     … テナントごとに生成。KEK で暗号化して保存
      └─ 実データ                  … DEK で暗号化 (AES-256-GCM 等)
```

処理の流れは次のようになる。

1. テナント作成時に DEK を生成し、KEK で暗号化した状態 (wrapped DEK) をテナント行へ保存する。
2. リクエスト処理の開始時に wrapped DEK を KMS で復号し、プロセス内で短時間だけ保持する。
3. 行の暗号化・復号はプロセス内の DEK で行う。KMS呼び出しはテナントあたり1回で済む。

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export type Sealed = { keyId: string; iv: string; tag: string; data: string };

export function seal(dek: Buffer, keyId: string, plaintext: string): Sealed {
  const iv = randomBytes(12);                       // GCM は 96bit IV が推奨
  const cipher = createCipheriv('aes-256-gcm', dek, iv);
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    keyId,                                          // どの鍵で暗号化したかを行に残す
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: data.toString('base64'),
  };
}

export function unseal(dek: Buffer, sealed: Sealed): string {
  const decipher = createDecipheriv('aes-256-gcm', dek, Buffer.from(sealed.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(sealed.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(sealed.data, 'base64')), decipher.final()]).toString('utf8');
}
```

`keyId` を行に持たせる点が要点になる。鍵をローテーションすると、しばらくは新旧の鍵で暗号化された行が混在する。行がどの鍵で暗号化されたかを覚えていなければ、ローテーションは全行の再暗号化を伴う停止作業になる。

顧客が自分の鍵を持ち込む **BYOK** (Bring Your Own Key) では、KEK が顧客の KMS (Key Management Service) に置かれる。顧客が鍵を無効化した瞬間、そのテナントのデータは復号できなくなる。これは障害ではなく仕様であり、契約と運用手順 (無効化の検知、通知、復旧) を先に決めておく必要がある。

鍵を分けたことの副作用として、**暗号化した列では検索と集計ができなくなる**。全文検索 (16.7)、範囲検索、`GROUP BY` はいずれも平文の値を必要とする。実務では次のいずれかで折り合いをつける。

- 暗号化の対象を、検索しない列 (自由記述、添付ファイル本体、個人情報の一部) に限定する。
- 検索が必要な値は、鍵つきハッシュ (HMAC) の値を別列に持ち、完全一致検索だけを許す。順序や部分一致は諦める。
- 復号をアプリケーション側で行い、絞り込みはテナント内の件数が小さい範囲に限る。

鍵の分離が持つもう1つの利点は削除である。テナントの解約時に DEK を破棄すれば、暗号文が残っていても復元できない。この**暗号消去** (crypto-shredding) は、バックアップやレプリカから物理削除しきれない場合の現実的な手段になる。ただし「削除した」と説明するには、鍵が本当に消えたことを示す必要があり、鍵管理側の削除ログが証跡になる。規制上の位置づけは 28.14 で扱う。

#### テナント単位のデータ移行

テナントを別の場所へ動かす必要は、次の場面で発生する。

- プールからサイロへの昇格 (大口顧客、規制要件)
- リージョン移動 (データ所在地の要求、遅延の改善)
- テナントの分割・統合 (組織再編、企業買収)
- 解約時のエクスポートと削除

いずれも「テナントに属する行をすべて列挙できる」ことが前提になる。この列挙が難しい設計は、移行が始まってから判明する。テーブルに `tenant_id` を持たせるか、必ずテナントへ到達する外部キーの経路を1本に保つかを、最初に決めておく。

移行手順は、停止時間をどこまで許容するかで2つに分かれる。

**停止を許す場合 (単純)**

```text
1. 対象テナントを書き込み禁止にする (機能フラグ)
2. 対象行をコピーする
3. 件数とチェックサムを照合する
4. 接続先の解決を新しい場所へ切り替える
5. 書き込みを再開する
6. 旧データを一定期間保持し、問題がなければ削除する
```

**停止を許さない場合 (二重書き)**

```text
1. 新旧両方へ書き込む期間を作る (17.11 の Outbox または 17.12 の CDC で追随)
2. 既存行を背景でコピーする
3. 差分がゼロになるまで照合を繰り返す
4. 読み取りを新しい場所へ切り替える
5. 書き込みを新しい場所だけへ切り替える
6. 旧データを削除する
```

どちらでも、切り替えの前後で**逆戻りできる状態**を保つ。旧データを即座に削除すると、切り替え後に見つかった不整合を戻せない。

照合は件数だけでは足りない。テーブルごとに、行数と、主要列を並べたハッシュの集約を比較する。

```sql
-- 移行元・移行先で同じ値になることを確認する
SELECT count(*) AS rows,
       md5(string_agg(id::text || '|' || coalesce(title, '') || '|' ||
                      extract(epoch from updated_at)::text, ',' ORDER BY id)) AS digest
FROM tasks
WHERE tenant_id = :tenant_id;
```

移行で最も壊れやすいのは識別子である。連番の主キーを使っていると、移行先で既存の値と衝突する。UUIDなど衝突しない識別子を使っていれば、そのまま移せる。連番のまま移す場合は、値の対応表を作り、すべての外部キーを書き換える必要がある。テナント移行の可能性がある製品では、テナントをまたいで一意な識別子を選ぶ判断が後で効いてくる。

テナントの統合 (2社が1つのテナントになる) では、識別子の衝突に加えて、一意制約が問題になる。`(tenant_id, email)` のような制約は、統合すると重複が生じうる。統合前に重複を検出し、業務側の解決方針 (どちらを残すか) を決めてから実行する。

解約時の削除は、即時削除ではなく段階を踏む。

| 段階 | 内容 | 目的 |
|---|---|---|
| 論理削除 | ログイン不可、APIは 410 を返す | 誤操作からの復旧余地 |
| 猶予期間 | 30日程度そのまま保持 | 再契約、データ返却の要求 |
| 物理削除 | 行の削除または鍵の破棄 | 保持義務の終了 |
| バックアップ | 世代の期限切れを待つ | 完全な消滅は保持期間に依存 |

「削除しました」と説明するとき、どの段階を指しているかを社内で揃えておく。バックアップからの復元でデータが復活しうる期間を、顧客への説明に含めるかどうかも決めておく必要がある。

#### つまずく箇所 ― テナント別の設定と鍵と移行

- **設定を「テナント設定テーブルへ全部入れる」**: デフォルト値の変更が既存テナントへ届かなくなる。上書きされた項目だけを保存する。
- **鍵をテナントごとにしてから検索要件に気づく**: 暗号化する列の決定は、検索・集計・並び替えの要件を洗い出した後に行う。順序が逆だと作り直しになる。
- **`keyId` を持たずに暗号化する**: 鍵のローテーションが全停止の作業になる。最初の1行を書く前に付けておく。
- **移行の照合を件数だけで済ませる**: 更新の取りこぼしは件数に現れない。内容のハッシュまで比較する。
- **テナントに属する行を列挙できない**: 移行、エクスポート、削除のすべてが手作業になる。到達経路をテーブル設計の時点で保証する。

<a id="section-14-22"></a>
### 14.22 noisy neighbor とリソース分離
<!-- handbook:learning {"level":"practical","minutes":20} -->
<!-- handbook:index {"group":"N","term":"Noisy Neighbor"} -->
<!-- handbook:index {"group":"か行","term":"公平キューイング"} -->
<!-- handbook:index {"group":"か行","term":"クォータとレート制限"} -->

<!-- handbook:narrative-bridge {"section":"14.22"} -->
14.20 と 14.21 で、テナントのデータと鍵は分けられるようになった。しかし分けられていないものが残っている。CPU、ディスクI/O、コネクション、ロック、キャッシュ、ジョブの実行枠といった共有資源である。1テナントの重い処理が他テナントの応答時間を悪化させる現象は、データが混ざらなくても発生する。

**noisy neighbor** とは、共有資源を使う1つの利用者の振る舞いが、他の利用者の性能へ波及する現象を指す。マルチテナントSaaSでは、次のような形で現れる。

- あるテナントが10万件のCSVを取り込み、その間に全テナントの書き込みが遅くなる。
- あるテナントの解析クエリが接続を長時間占有し、プールが枯渇して他テナントが接続を取れない (14.19)。
- あるテナントの一括更新が長いトランザクションを作り、VACUUMが進まなくなる (14.18)。
- あるテナントの大量ジョブがキューを埋め、他テナントの通知が数時間遅れる (17.6)。
- 大きなテナントの作業セットが共有バッファやRedisを占め、他テナントのキャッシュヒット率が下がる (15.2)。

#### まずテナント別に観測できるようにする

対策より先に必要なのは、原因テナントを特定できる観測である。全体の平均値だけを見ていると、「p99 が悪化した」ところまでは分かるが、誰の負荷かが分からない。

- クエリへテナント識別子をコメントとして埋め込む。`pg_stat_statements` は定数を正規化するため、コメントを含む形にしておくと集計で追える。
- アプリケーションのメトリクスに `tenant_id` をラベルとして持たせる。ただしテナント数が多いとカーディナリティ爆発を招くため、上位N件だけを個別に、残りを `other` にまとめる (22.6)。
- 遅いリクエストのトレースにテナント識別子を属性として付ける (22.8)。

```sql
-- アプリケーション側でクエリ先頭にコメントを付けておくと、原因の切り分けが速くなる
/* tenant=2b1a...,op=task.search */ SELECT ... FROM tasks WHERE ...;

-- 実行時間の合計が大きい文を確認する
SELECT queryid, calls, total_exec_time, mean_exec_time, query
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;
```

`pg_stat_statements` は拡張機能であり、有効化と共有ライブラリの設定が必要になる。導入していない環境では、まずアプリケーション側のログにテナント識別子と所要時間を残すところから始める。

#### 対策を層で分ける

対策は1つでは足りない。入口から順に、それぞれの層で上限を持たせる。

| 層 | 手段 | 効果の範囲 |
|---|---|---|
| 入口 | テナント単位のレート制限・同時実行数の上限 | 過剰な要求量そのものを絞る |
| 実行 | `statement_timeout`、`idle_in_transaction_session_timeout` | 1本のクエリが長時間占有することを防ぐ |
| 接続 | テナント階層ごとにプールを分ける | 枯渇の影響を階層内に閉じる (26.8) |
| ジョブ | テナント別キューと公平スケジューリング | 待ち時間の偏りを抑える |
| データ | 大テナントのサイロ化・シャーディング | 物理的に切り離す (14.20、26.2) |
| 契約 | プラン別のクォータと超過時の扱い | 資源消費と課金を結びつける (30.8) |

**入口**では、テナント単位のトークンバケットを置く。ユーザー単位だけの制限では、1テナントが多数のユーザーを持つ場合に総量を抑えられない。

```typescript
type Bucket = { tokens: number; updatedAt: number };

export class TenantRateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  constructor(
    private readonly capacity: number,      // バースト許容量
    private readonly refillPerSecond: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** 消費できたら true。false なら 429 を返す。 */
  tryConsume(tenantId: string, cost = 1): boolean {
    const at = this.now();
    const bucket = this.buckets.get(tenantId) ?? { tokens: this.capacity, updatedAt: at };
    const elapsedSeconds = (at - bucket.updatedAt) / 1000;
    bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsedSeconds * this.refillPerSecond);
    bucket.updatedAt = at;
    if (bucket.tokens < cost) {
      this.buckets.set(tenantId, bucket);
      return false;
    }
    bucket.tokens -= cost;
    this.buckets.set(tenantId, bucket);
    return true;
  }
}
```

`cost` を操作の重さに応じて変える点が実務上は効く。一覧取得を 1、全文検索を 5、エクスポートを 50 とすれば、リクエスト数ではなく消費資源に近い量で制限できる。制限にかかったときは、429 と `Retry-After` を返し、クライアントが指数バックオフできるようにする (26.7)。

**実行**では、データベース側のタイムアウトを設定する。アプリケーション側のタイムアウトだけでは、クライアントが切断してもサーバ側のクエリは走り続けることがある。

```sql
-- アプリケーション用ロールの既定値として設定する
ALTER ROLE app_user SET statement_timeout = '5s';
ALTER ROLE app_user SET idle_in_transaction_session_timeout = '15s';

-- 重い分析用途には別ロールを用意し、上限を変える
ALTER ROLE app_report SET statement_timeout = '120s';
```

**ジョブ**では、テナントごとにキューを分け、取り出しを巡回させる。単一キューの先入れ先出しでは、1テナントが1万件を投入した時点で他テナントの待ち時間がその後ろに積み上がる。

```typescript
/** テナントごとのキューを巡回し、1テナントの大量投入が他を押し出さないようにする。 */
export class FairQueue<T> {
  private readonly queues = new Map<string, T[]>();
  private order: string[] = [];
  private cursor = 0;

  enqueue(tenantId: string, job: T): void {
    const queue = this.queues.get(tenantId);
    if (queue) { queue.push(job); return; }
    this.queues.set(tenantId, [job]);
    this.order.push(tenantId);
  }

  /** ラウンドロビンで1件取り出す。空になったテナントは巡回から外す。 */
  dequeue(): { tenantId: string; job: T } | undefined {
    for (let visited = 0; visited < this.order.length; visited += 1) {
      const tenantId = this.order[this.cursor % this.order.length];
      this.cursor += 1;
      const queue = this.queues.get(tenantId);
      if (queue && queue.length > 0) {
        const job = queue.shift() as T;
        if (queue.length === 0) {
          this.queues.delete(tenantId);
          this.order = this.order.filter((id) => id !== tenantId);
          this.cursor = 0;
        }
        return { tenantId, job };
      }
    }
    return undefined;
  }
}
```

この単純な巡回でも、待ち時間の最悪値はテナント数に比例する形に収まり、投入件数には比例しなくなる。プラン別に重みを付けたい場合は、1巡で取り出す件数をテナントの重みに応じて変える (重み付きラウンドロビン)。実運用では、テナントごとの同時実行上限 (1テナントが同時に使えるワーカー数の上限) を併用すると、長時間ジョブによる占有も抑えられる。

#### 公平性と全体スループットは両立しない

公平性を上げると、全体のスループットは下がる方向に働く。巡回のたびに別テナントのデータへ切り替わるため、キャッシュ局所性が失われるからである。どちらを優先するかは、契約している応答時間の約束 (22.7 の SLO (Service Level Objective)) で決める。

制限の設計でもう1つ決めるのは、**上限に達したときの挙動**である。

- 拒否する (429): 呼び出し側が再送を制御できる。同期APIに向く。
- 遅らせる (キュー): 完了は保証されるが、待ち時間が伸びる。非同期処理に向く。
- 縮退する: 全文検索を前方一致に落とす、リアルタイム更新を止めるなど、機能を減らして受け付ける。

いずれの場合も、上限に達したこと自体をテナント別のメトリクスとして出す。顧客からの「遅い」という問い合わせに対し、制限にかかった回数を提示できると、原因の説明と上位プランの提案が具体的になる。

#### つまずく箇所 ― リソース分離

- **全体の平均値だけを見ている**: noisy neighbor は分布の裾に現れる。テナント別の p95・p99 を見なければ、影響を受けている側は可視化されない。
- **制限をユーザー単位だけで掛ける**: テナント内のユーザー数が増えると総量が青天井になる。テナント単位の上限を必ず併設する。
- **無料プランと有料プランを同じ資源で動かす**: 無料利用者の負荷が有料顧客のSLOを壊す。少なくともワーカーとキューは分ける。
- **タイムアウトを長くして問題を先送りする**: 長いクエリが増えるほど、接続とロックの占有時間が伸び、影響が広がる。上限を伸ばす前に、クエリと索引を見直す。
- **リトライで自ら増幅する**: 制限にかかった呼び出しが即座に再送されると、負荷はむしろ増える。429 の応答には必ずバックオフを組み合わせる (26.7)。

<a id="section-14-23"></a>
### 14.23 UTC、タイムゾーン、DST、カレンダー日
<!-- handbook:learning {"level":"practical","minutes":25} -->
<!-- handbook:index {"group":"U","term":"UTC"} -->
<!-- handbook:index {"group":"D","term":"DST (夏時間)"} -->
<!-- handbook:index {"group":"I","term":"IANA tz database"} -->
<!-- handbook:index {"group":"か行","term":"カレンダー日"} -->
<!-- handbook:index {"group":"た行","term":"タイムゾーン"} -->

<!-- handbook:narrative-bridge {"section":"14.23"} -->
ここまでの3節では「その行は誰のものか」を守る手段を扱った。同じデータには、もう1つ間違えやすい属性がある。「その行はいつのものか」である。テナント境界の事故が権限の正しさを無意味にするのと同じで、日時の解釈がずれると、正しく計算した結果が業務上は誤りになる。しかも失敗は年に2回、特定の地域でだけ起きるため、テストをすり抜けやすい。

#### 3種類の「時間」を区別する

日時の不具合のほとんどは、性質の違う3つの値を同じ型で扱うことから生まれる。

| 種類 | 意味 | 例 | 誤って混ぜたときの症状 |
|---|---|---|---|
| 瞬間 (instant) | 世界のどこでも同一の時点 | 監査ログの記録時刻、決済の確定時刻 | ずれた時刻で記録され、順序が入れ替わる |
| ローカル日時 (plain date-time) | 壁時計が示す日付と時刻。地域が決まるまで瞬間が定まらない | 「11月1日 9時に開始する会議」 | DST 境界で存在しない、または二重の時刻になる |
| カレンダー日 (plain date) | 日付だけ。時刻も地域も持たない | 誕生日、請求月の締め日、有効期限日 | 地域によって1日ずれる |

「いつ起きたか」を記録するときは瞬間、「いつ行うか」を約束するときはローカル日時とタイムゾーンID、「どの日か」を扱うときはカレンダー日を使う。この3つを1つの `Date` や `timestamp` へ押し込めると、変換のたびに解釈が必要になり、どこかで取り違える。

この区別は用語としても標準化が進んでいる。インターネット上の日時表記は RFC 3339 が定め [RFC 3339]、RFC 9557 はそれを拡張して、オフセットに加えてタイムゾーンIDを角括弧で注記する形式を定めている [RFC 9557]。

```text
2026-11-01T01:30:00-04:00[America/New_York]   ← 瞬間 + どの地域の壁時計か
2026-11-01T01:30:00                            ← ローカル日時 (瞬間は定まらない)
2026-11-01                                     ← カレンダー日
```

#### タイムゾーンはオフセットではない

`+09:00` はオフセットであり、タイムゾーンではない。タイムゾーンは「ある地域で、どの期間にどのオフセットを使うか」という規則の集合である。`Asia/Tokyo` は現在は常に `+09:00` だが、1948年から1951年には夏時間があった。`America/New_York` は時期によって `-05:00` と `-04:00` を行き来する。

したがって、未来の予定をオフセットつきで保存すると、規則が変われば約束が変わる。保存すべきはタイムゾーンID (`Asia/Tokyo`、`America/New_York`) である。

タイムゾーンIDと規則の対応表が **IANA time zone database** (tzdb) であり、`2026a` のような版番号で更新される [IANA Time Zone Database]。更新は各国の法改正に追随するため、年に数回発生する。RFC 6557 は、このデータベースの維持手続きを定めている [RFC 6557]。

実務上の含意は次の3つになる。

- **tzdb は変わる**。「サモアが日付変更線をまたいだ」「エジプトが夏時間を再導入した」といった変更が、実際に過去数年で起きている。
- **更新の経路を把握する**。Node.js は同梱の ICU、PostgreSQL は同梱またはOSの tzdata、ブラウザはOSまたはブラウザ内蔵のデータを使う。どこか1つが古いと、サーバとクライアントで結果が食い違う。
- **未来の瞬間はキャッシュしない**。ローカル日時とタイムゾーンIDから瞬間を求める計算は、実行時点の tzdb に依存する。数か月先の予定を UTC の瞬間として保存すると、その間に規則が変わっても更新されない。

#### DST の3つの落とし穴

夏時間 (Daylight Saving Time) の切り替え日には、その地域の壁時計に穴と重複が生じる。以下は `America/New_York` の2026年の例である。

**(1) 存在しない時刻**

2026年3月8日、現地時刻 02:00 の直後に時計が 03:00 へ進む。この日、02:30 という壁時計の時刻は存在しない。

```text
01:59:59 -05:00
02:00:00 → 存在しない
02:30:00 → 存在しない   ← 「毎日 02:30 に実行」がこの日だけ実行されない
03:00:00 -04:00
```

**(2) 二度ある時刻**

2026年11月1日、現地時刻 02:00 の直後に時計が 01:00 へ戻る。この日、01:30 は2回訪れる。

```text
01:30:00 -04:00   ← 1回目
01:59:59 -04:00
01:00:00 -05:00   ← 時計が戻る
01:30:00 -05:00   ← 2回目
```

ローカル日時から瞬間を求めるとき、この2つの場合にどう振る舞うかを決めなければならない。一般的な選択肢は、前寄りを採る、後寄りを採る、例外にする、の3つである。予定の実行では「1回だけ実行する」ことが重要なので、後述の実装では前寄りに固定し、実行済みの記録で二重実行を防ぐ。

**(3) 「1日後」と「24時間後」は違う**

DST (Daylight Saving Time、夏時間) の切り替えをまたぐ日には、カレンダー上の1日が23時間または25時間になる。

```text
2026-03-07 12:00 America/New_York に 24時間 を足す → 2026-03-08 13:00 (壁時計は1時間ずれる)
2026-03-07 12:00 America/New_York に 1日   を足す → 2026-03-08 12:00 (壁時計は同じ)
```

どちらが正しいかは業務による。「24時間以内に応答する」は絶対時間、「翌日の同じ時刻に通知する」はカレンダー算術である。両者を同じ関数で計算していると、年2回だけ結果がずれる。

さらに、カレンダー算術は交換法則を満たさない。「1か月後の翌日」と「翌日の1か月後」は、月末付近で異なる結果になる。実装では、月・日・時刻の順に大きい単位から適用し、範囲外になった日を月末へ丸めるのが一般的だが、丸め方は処理系によって差がある。金額や期限に関わる計算では、丸め規則を自分で決めて明示的に実装する。

#### カレンダー日を瞬間に変えない

「9月1日が締切」という要件を `2026-09-01T00:00:00Z` として保存すると、日本の利用者にとっては9月1日9時が締切になり、ハワイの利用者にとっては8月31日14時が締切になる。カレンダー日は、瞬間へ変換した時点で意味が変わる。

対処は、比較する側でカレンダー日へ揃えることである。

```text
誤: 保存した瞬間と now() を比較する
正: now() を「判定に使うタイムゾーン」の壁時計へ変換し、その日付とカレンダー日を比較する
```

判定に使うタイムゾーンは、業務が決める。テナントの所在地 (14.21 の `defaultTimeZone`)、利用者個人の設定、あるいは契約で定めた固定のゾーンのいずれかであり、「サーバのタイムゾーン」であってはならない。サーバは移設されうるし、コンテナのデフォルトは UTC であることが多い。

#### JavaScript での扱い

JavaScript の `Date` は、エポックからのミリ秒を保持する瞬間であり、タイムゾーンを持たない。表示や壁時計の計算をするときは、`Intl.DateTimeFormat` に `timeZone` を明示して使う。この API の振る舞いは ECMA-402 が定め [ECMA-402]、地域ごとの表記データは Unicode CLDR に由来する [Unicode CLDR]。

```typescript
/** 指定タイムゾーンにおける壁時計の値を取り出す。 */
export function wallClockParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  // hourCycle の実装差で 24 が返る場合があるため 0 へ正規化する
  const hour = get('hour') % 24;
  return { year: get('year'), month: get('month'), day: get('day'), hour, minute: get('minute'), second: get('second') };
}

/** そのタイムゾーンでの UTC オフセット (分) を求める。 */
export function offsetMinutes(instant: Date, timeZone: string): number {
  const w = wallClockParts(instant, timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  // ミリ秒の丸め差を避けるため、秒単位で切り捨ててから差を取る
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60000);
}
```

ローカル日時からその地域の瞬間を求める処理は、答えのオフセットが答えそのものに依存するため、一度の計算では決まらない。切り替えの前後2つのオフセットで候補を作り、「その候補の実際のオフセットが、候補を作るのに使ったオフセットと一致するか」で妥当性を判定する。

```typescript
const DAY_MS = 24 * 60 * 60 * 1000;

/** ローカル日時 + タイムゾーンID → 瞬間。 */
export function resolveInstant(local: Local, timeZone: string): Date {
  const naive = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  // 切り替えを確実にまたぐよう、前後1日ずつのオフセットを取る
  const before = offsetMinutes(new Date(naive - DAY_MS), timeZone);
  const after = offsetMinutes(new Date(naive + DAY_MS), timeZone);
  const candidates = [...new Set([naive - before * 60000, naive - after * 60000])];
  const valid = candidates.filter(
    (candidate) => offsetMinutes(new Date(candidate), timeZone) === (naive - candidate) / 60000,
  );
  if (valid.length > 0) return new Date(Math.min(...valid));  // 二度ある時刻は先に訪れるほう
  return new Date(Math.max(...candidates));                   // 存在しない時刻は切り替え後へ
}
```

候補が2つとも妥当なら、その壁時計の時刻はその日に2回訪れている。どちらも妥当でなければ、その時刻はその日に存在しない。この判定を明示的に書いておくと、規則を変えたくなったときに1か所を直せばよくなる。上の実装は「二度あるときは前寄り、存在しないときは後方へ送る」規則を採っており、これは `Temporal` のデフォルトの解決方法と同じ振る舞いである。

TC39 では、これらを型として区別する `Temporal` の標準化が進んでいる。`Temporal.Instant`、`Temporal.PlainDate`、`Temporal.PlainDateTime`、`Temporal.ZonedDateTime` が、本節で挙げた3種類の区別にそのまま対応する。曖昧な時刻の解決方法も `disambiguation` オプションとして明示的に選べる。実装状況は処理系ごとに異なるため、採用前に対象ランタイムでの利用可否とポリフィルの要否を確認する [TC39 Temporal]。

#### つまずく箇所 ― タイムゾーンとDST

- **オフセットを保存してタイムゾーンだと思っている**: `+09:00` は瞬間を復元するには十分だが、未来の予定を正しく保つには足りない。ゾーンIDを併せて保存する。
- **サーバのローカルタイムゾーンに依存する**: コンテナ、CI、開発機で結果が変わる。プロセスのタイムゾーンは UTC に固定し、必要な場所でだけ明示的に変換する。
- **DST のテストを書かない**: 境界の日付を含む固定日時でテストする。`America/New_York` の3月と11月、南半球の `Australia/Sydney`、そして DST のない `Asia/Tokyo` を並べると、多くの誤りが1度に見つかる。
- **うるう秒を計算で扱おうとする**: 多くの環境で時刻は UTC のうるう秒を平滑化して提供される。アプリケーション層でうるう秒を意識する必要は通常なく、意識すべきなのは NTP による時刻の巻き戻りである。経過時間の計測には単調増加時計 (`performance.now()`、`process.hrtime.bigint()`) を使う。
- **32ビットの秒表現を前提にする**: 秒を32ビット符号つき整数で扱う経路は2038年に破綻する。外部システムとの連携で秒表現を受け渡す場合は、桁と型を確認する。

<a id="section-14-24"></a>
### 14.24 DB日時型、定期実行、ユーザー表示
<!-- handbook:learning {"level":"practical","minutes":25} -->
<!-- handbook:index {"group":"T","term":"timestamptz"} -->
<!-- handbook:index {"group":"C","term":"cron とタイムゾーン"} -->
<!-- handbook:index {"group":"は行","term":"半開区間"} -->
<!-- handbook:index {"group":"さ行","term":"時刻の表示ゾーン"} -->

<!-- handbook:narrative-bridge {"section":"14.24"} -->
14.23 で、瞬間・ローカル日時・カレンダー日を区別する必要が分かった。次に決めるのは、その区別をどの型で保存し、どの時刻に定期処理を走らせ、利用者にはどのゾーンで見せるかである。3つのうち1つでも曖昧なままだと、保存は正しいのに集計が1日ずれる、といった形で表面化する。

#### PostgreSQL の日時型

| 型 | 保持する内容 | 対応する概念 | 主な用途 |
|---|---|---|---|
| `timestamptz` | UTC の瞬間 (マイクロ秒精度) | 瞬間 | 作成日時、更新日時、監査ログ、イベント時刻 |
| `timestamp` | ゾーンなしの日付と時刻 | ローカル日時 | 予定の壁時計時刻 (ゾーンIDを別列で保持) |
| `date` | 日付のみ | カレンダー日 | 誕生日、締切日、請求期間 |
| `time` | 時刻のみ | 壁時計の時刻 | 営業時間、定期実行の希望時刻 |
| `interval` | 期間 (月・日・時分秒を別々に保持) | 期間 | 保持期間、リマインダの前倒し量 |

最初に押さえるべきは、`timestamptz` という名前の誤解を招きやすさである。この型は**タイムゾーンを保存しない** [PostgreSQL Date/Time Types]。入力値を UTC の瞬間へ正規化して保存し、取り出すときにセッションの `TimeZone` 設定で書式化するだけである。元の入力がどの地域の壁時計だったかは失われる。

```sql
SET TimeZone = 'UTC';
SELECT '2026-11-01 01:30:00-04'::timestamptz;   -- 2026-11-01 05:30:00+00
SET TimeZone = 'Asia/Tokyo';
SELECT '2026-11-01 01:30:00-04'::timestamptz;   -- 2026-11-01 14:30:00+09  (同じ瞬間)
```

したがって、「利用者が入力した地域の壁時計」を残す必要があるなら、`timestamp` (ローカル日時) と `text` (タイムゾーンID) の2列で持つ。予定の管理は、この2列に加えて「解決済みの瞬間」を `timestamptz` で持つ3列構成が扱いやすい。tzdb が更新されたら、2列から瞬間を再計算する。

`AT TIME ZONE` は、引数の型によって逆向きに働く。

```sql
-- ローカル日時 → 瞬間 (「東京の壁時計でこの時刻」と解釈する)
SELECT timestamp '2026-11-01 09:00' AT TIME ZONE 'Asia/Tokyo';   -- timestamptz

-- 瞬間 → ローカル日時 (「その瞬間の東京の壁時計」を取り出す)
SELECT now() AT TIME ZONE 'Asia/Tokyo';                          -- timestamp
```

同じ構文で意味が反転するため、読むときは必ず左辺の型を確認する。

現在時刻を返す関数も、用途によって使い分ける。

| 関数 | 返す時刻 | 用途 |
|---|---|---|
| `now()` / `current_timestamp` | トランザクション開始時刻 | 同一トランザクション内で一貫した記録 |
| `statement_timestamp()` | 文の開始時刻 | 文ごとの計測 |
| `clock_timestamp()` | 呼び出し時点の実時刻 | 経過時間の測定 |

長いトランザクションの中で `now()` を使うと、すべての行に同じ時刻が入る。一貫性としては正しいが、「処理に10分かかったのに全部同じ時刻」という結果になるため、実測が目的なら `clock_timestamp()` を使う。

#### 期間の加算とインデックス

`timestamptz` に `interval` を足すとき、単位によって意味が変わる。

```sql
SET TimeZone = 'America/New_York';
SELECT timestamptz '2026-03-07 12:00-05' + interval '1 day';    -- 2026-03-08 12:00-04 (壁時計は同じ)
SELECT timestamptz '2026-03-07 12:00-05' + interval '24 hours'; -- 2026-03-08 13:00-04 (絶対時間で24時間)
```

`day` 以上の単位はセッションの `TimeZone` を参照するカレンダー算術、`hour` 以下は絶対時間の加算である。「24時間以内」と「翌日」を書き分けるときは、この違いが結果に出る。

範囲検索は**半開区間** `[start, end)` で書く。両端を含む書き方 (`BETWEEN`) は、境界の値を二重に数えるか、精度の下限だけ取りこぼす。

```sql
-- 危険: 23:59:59 と 23:59:59.5 の間が落ちる
SELECT count(*) FROM tasks
WHERE created_at BETWEEN '2026-09-01 00:00:00+09' AND '2026-09-01 23:59:59+09';

-- 安全: 半開区間。インデックスもそのまま使える
SELECT count(*) FROM tasks
WHERE created_at >= timestamptz '2026-09-01 00:00+09'
  AND created_at <  timestamptz '2026-09-02 00:00+09';
```

日単位の集計をテナントのタイムゾーンで行う場合、列に関数を適用するとインデックスが使えなくなる。

```sql
-- 索引が使われない (列側に関数がある)
SELECT date_trunc('day', created_at AT TIME ZONE 'Asia/Tokyo') AS day, count(*)
FROM tasks WHERE tenant_id = $1
GROUP BY 1;

-- 絞り込みは半開区間で、変換は集計キーの生成にだけ使う
SELECT date_trunc('day', created_at AT TIME ZONE 'Asia/Tokyo') AS day, count(*)
FROM tasks
WHERE tenant_id = $1
  AND created_at >= $2 AND created_at < $3     -- (tenant_id, created_at) の索引に乗る
GROUP BY 1;
```

タイムゾーンを引数に取る3引数の `date_trunc(field, timestamptz, zone)` は PostgreSQL 16 で追加された。対象バージョンによっては `AT TIME ZONE` を使う形に統一しておくほうが移植しやすい。

#### 他のデータストアでの違い

- **MySQL**: `TIMESTAMP` はセッションのタイムゾーンで UTC へ変換して保存し、取り出しで戻す。範囲が 1970年から2038年に制限される。`DATETIME` は変換を行わず、値をそのまま保持する。どちらを使うかで、サーバのタイムゾーン設定を変えたときの挙動が変わる。
- **SQLite**: 日時専用の格納型を持たず、`TEXT` (ISO 8601 文字列)、`REAL` (ユリウス日)、`INTEGER` (エポック秒) のいずれかで表す。比較と索引は選んだ表現に依存する。
- **キー・バリュー / ドキュメントDB**: ソートキーへ日時を入れる場合、`2026-09-01T00:00:00.000Z` のような固定長の ISO 8601 文字列は辞書順と時刻順が一致する。桁揃えを崩す表記 (`2026-9-1`) を混ぜると順序が壊れる。
- **アプリケーション層の精度**: JavaScript の `Date` はミリ秒精度、PostgreSQL の `timestamptz` はマイクロ秒精度である。ORM を経由して往復すると下位の桁が落ち、「保存した値と読み出した値が一致しない」比較の失敗になる。時刻をキーに使う処理 (カーソルページネーション、重複排除) では、精度の下限を揃えるか、時刻と識別子の複合キーにする (12.4)。

#### 定期実行

定期実行は、日時の誤りが最も見えにくい形で現れる場所である。失敗しても例外が出ず、単に「動かなかった」「二重に動いた」という結果になるためである。

**プロセスとスケジューラは UTC で動かす。** そのうえで、テナントの希望時刻はデータとして保持し、実行時に解決する。cron 式そのものにタイムゾーンを埋め込む方式は、実装ごとに DST 時の振る舞いが異なるため、切り替え日の挙動を確認せずに使わない。Kubernetes の CronJob のようにタイムゾーンを指定できる仕組みもあるが、指定できることと DST 境界の規則が明示されていることは別である。

推奨する構成は、次のように「細かい間隔で起こし、対象を選ぶ」形である。

```typescript
type Schedule = {
  tenantId: string;
  timeZone: string;      // 例: 'Asia/Tokyo'
  localTime: string;     // 例: '09:00' (その地域の壁時計)
  lastRunKey: string | null;  // 実行済みの「現地の日付」
};

/** 15分ごとに起動し、その時点で実行すべきテナントを選ぶ。 */
export function dueSchedules(schedules: Schedule[], now: Date): Schedule[] {
  return schedules.filter((schedule) => {
    const wall = wallClockParts(now, schedule.timeZone);
    const localDate = `${wall.year}-${String(wall.month).padStart(2, '0')}-${String(wall.day).padStart(2, '0')}`;
    if (schedule.lastRunKey === localDate) return false;       // 同じ現地日には1回だけ
    const [hour, minute] = schedule.localTime.split(':').map(Number);
    const nowMinutes = wall.hour * 60 + wall.minute;
    // 希望時刻を過ぎていれば実行する。存在しない時刻でも、次の起床で条件を満たす
    return nowMinutes >= hour * 60 + minute;
  });
}
```

この形には3つの利点がある。

1. **存在しない時刻でも実行される**。02:30 が飛ばされた日でも、03:00 の起床時に「まだ今日は実行していない」と判定される。
2. **二度ある時刻でも1回だけ実行される**。実行済みの記録が「現地の日付」なので、01:30 が2回来ても2回目は除外される。
3. **遅延しても取りこぼさない**。ワーカーが止まっていた場合、復旧後の最初の起床で実行される。

一方で、「毎日必ず 09:00 ちょうど」という要求は満たせない。起床間隔だけ遅れる可能性がある。厳密な時刻が要求される場合は起床間隔を短くするが、間隔を短くしても DST の穴は消えない点は変わらない。

日付に関する定期実行では、次の2つも決めておく。

- **月末の扱い**: 「毎月31日」は31日のない月に実行されない。「毎月末日」なのか「毎月31日」なのかを要件として区別し、前者なら翌月1日から1日引く形で求める。
- **遅延時の方針**: 実行が n 回分遅れたとき、すべて追いつく (catch-up) のか、最新の1回だけ実行する (skip) のか。請求処理は前者、ダッシュボードの再集計は後者が自然である。

いずれの方式でも、ジョブは冪等にする (26.10)。同じ実行キー (テナント + 現地日付) で2回起動されても、結果が変わらないようにしておけば、スケジューラの二重起動が事故にならない。

#### ユーザー表示

表示に使うタイムゾーンは、次の順で決める。

1. 利用者個人の設定 (明示的に選んだ値)
2. テナントのデフォルトタイムゾーン (14.21 の設定解決)
3. クライアントからの推定値 (`Intl.DateTimeFormat().resolvedOptions().timeZone`)
4. UTC

推定値を最優先にすると、出張先で開いたときに過去の記録の表示が変わり、利用者が混乱する。逆に個人設定だけを見ると、初回利用時に設定を求めることになる。実務では、推定値を初期値として提示し、利用者が確定した時点で個人設定へ昇格させる形が扱いやすい。

APIの応答は、瞬間を RFC 3339 の形式で返し [RFC 3339]、表示の変換はクライアントで行う。カレンダー日は日付だけの文字列 (`2026-09-01`) で返す。両者を同じ形式で返すと、受け手が瞬間として解釈して1日ずれる。

```json
{
  "id": "tsk_01H...",
  "createdAt": "2026-09-01T03:12:45.120Z",
  "dueDate": "2026-09-30",
  "reminder": { "localTime": "09:00", "timeZone": "Asia/Tokyo" }
}
```

表示側で注意する点は2つある。

- **相対表示のキャッシュ**: 「3分前」をサーバ側で描画すると、CDNやHTTPキャッシュに乗った瞬間から誤りになる (24.5)。相対表示はクライアントで計算し、機械可読な絶対時刻を `datetime` 属性に併記する。
- **サーバとクライアントの不一致**: サーバ描画とクライアント描画で異なるタイムゾーンを使うと、9.2 の SSR でハイドレーションの不一致が起きる。サーバ側では UTC か明示したゾーンで描画し、クライアント側で確定させる。

エクスポート (CSV、監査ログ、請求書) では、必ずタイムゾーンを明示する。列名に含める (`created_at_jst`) か、オフセット付きの ISO 8601 で出力するかのどちらかを決め、ファイル内で統一する。受け取った側が表計算ソフトで開くと書式が変換されることがあるため、機械処理を前提とする出力ではオフセット付きの文字列が安全である。

課題14.6 では、ここまでで挙げた誤りのうち4つ (存在しない時刻での実行漏れ、カレンダー日と瞬間の取り違え、24時間加算とカレンダー加算の混同、日境界のずれによる集計誤り) を実際に再現し、修正後に再現しなくなることを確認する。

#### つまずく箇所 ― 日時型と定期実行

- **`timestamptz` がタイムゾーンを保存すると思っている**: 保存されるのは瞬間だけである。壁時計を残したいなら別に持つ。
- **`BETWEEN` で日付範囲を書く**: 境界の重複と取りこぼしが起きる。半開区間で書く。
- **集計の列側に変換関数を置く**: 索引が使えず、テナントが増えるほど遅くなる。絞り込みと集計キー生成を分ける。
- **cron に現地時刻を書く**: DST の切り替え日の挙動が実装依存になる。UTC で起こし、対象の選定をアプリケーションで行う。
- **表示のためにデータを書き換える**: 「日本の利用者向けだから」と保存時に9時間足すと、他ゾーンの利用者を追加できなくなり、過去データの意味も変わる。変換は表示層でだけ行う。

<a id="section-14-25"></a>
### 14.25 個人データの収集と保存 ― 何を持ち、どこに置き、どこへ漏れるか
<!-- handbook:learning {"level":"practical","minutes":25} -->
<!-- handbook:index {"group":"か行","term":"個人データの棚卸し"} -->
<!-- handbook:index {"group":"た行","term":"データ最小化"} -->
<!-- handbook:index {"group":"か行","term":"仮名化"} -->
<!-- handbook:index {"group":"ま行","term":"マスキング (ログ)"} -->
<!-- handbook:index {"group":"さ行","term":"最小権限 (データ)"} -->

<!-- handbook:narrative-bridge {"section":"14.25"} -->
14.20 から 14.24 では、テナントと時刻という「取り違えると事故になる軸」を扱った。個人データも同じ性質を持つ軸である。ただしテナント境界が「誰に見せてよいか」の問題であるのに対し、個人データは「そもそも持ってよいか、いつまで持つか、どうやってやめるか」という**寿命**の問題を追加で抱える。本節では、持つと決めた個人データをどう置くかを扱い、14.26 でその終わり方を扱う。

**本節は法的助言ではない。** 何が個人データにあたるか、どの取り扱いにどの根拠が要るか、どこまでが許されるかは、事業の所在地、利用者の所在地、業種、契約によって変わる。28.14 が挙げた GDPR、CCPA/CPRA、APPI (個人情報保護法)、HIPAA などは、要求する事項も用語の定義も同一ではない。ここで扱うのは、**どの制度の下でも共通して必要になる技術的な準備** ― どこに何があるかを把握し、範囲を絞り、消せる形にしておくこと ― に限る。実際の要件は、必ず法務および専門家に確認する。

#### まず「どこに何があるか」を一覧にする

個人データの取り扱いで最初に詰まるのは、法解釈ではなく**どこにあるか分からない**という事実である。「利用者を削除してください」という要求に対して、`users` テーブルの行を消せば済むと考えていたら、実際には次の場所に同じ人物の情報が残っていた、という展開になる。

```text
users テーブル                    ← 誰でも思い出す
  ├─ orders / addresses          ← 外部キーで辿れる
  ├─ audit_log                   ← 削除してよいか自体が判断を要する
  ├─ 検索インデックス (第16章)     ← DB と別の寿命を持つ
  ├─ キャッシュ (第15章)           ← TTL 任せで消える「はず」
  ├─ オブジェクトストレージ         ← アップロードしたファイルとその EXIF
  ├─ 分析基盤 / データレイク (14.16) ← 日次で複製され続けている
  ├─ ログ (22.3) / トレース (22.8)  ← 誰も PII だと思っていない
  ├─ バックアップ (26.13)          ← 世代が期限切れするまで消えない
  ├─ メール配信サービス            ← 抑制リスト、配信履歴 (17.14)
  └─ 外部SaaS (分析、CRM、決済)    ← 自分たちのDBではない
```

したがって、コードやスキーマとは別に**個人データの所在一覧**を持つ。維持できる粒度は組織によるが、最低限、次の列があれば削除もエクスポートも設計できる。

| 列 | 例 |
|---|---|
| 保存場所 | `postgres.orders`、`s3://uploads/`、`opensearch.users-v3`、`analytics.events` |
| 項目 | メールアドレス、氏名、配送先住所、IPアドレス、端末識別子 |
| 取得元 | 利用者の入力、外部連携、自動収集 |
| 用途 | 認証、配送、不正検知、統計 |
| 保持期間 | 退会後30日、法定保存期間、無期限 (要見直し) |
| 削除方法 | 行削除、匿名化、鍵破棄、外部APIの削除呼び出し |
| 担当 | どのチームが所有するか |

この一覧は、機械可読な形 (リポジトリ内の YAML など) で持ち、スキーマ変更のレビュー項目に「一覧を更新したか」を入れると腐りにくい。列を1つ足すたびに一覧が古くなる仕組みでは維持できない。

#### 持たないことが最良の対策である

漏洩しない唯一の確実な方法は、持たないことである。設計時に次の順で検討する。

1. **収集しない。** 「あとで使うかもしれない」で集めた項目は、たいてい使われないまま漏洩リスクと削除の手間だけを残す。生年月日が本当に必要か、年齢層で足りないか。氏名が必要か、表示名で足りないか。
2. **保持しない。** 一度使うだけの値 (本人確認書類、決済のためだけに受け取った情報) は、処理が終わったら消す。
3. **粒度を落として保持する。** 完全なIPアドレスではなく末尾を落とした値、正確な位置ではなく市区町村、生年月日ではなく生年。
4. **識別子を分離する。** 分析基盤へ送るイベントに実際の利用者IDを載せず、分析専用の識別子に置き換える (仮名化)。対応表は分析基盤の外に置き、権限を分ける。
5. **暗号化して保持する。** 検索に使わない項目は 14.21 のエンベロープ暗号化で保持する。鍵を破棄すれば実質的に消せる (14.26)。

3と4の区別は重要である。**粒度を落とす操作は元へ戻せないが、仮名化は対応表があれば戻せる。** 対応表を持っている限り、仮名化されたデータも個人データとして扱う必要がある、という整理が一般的である。「IDを別の乱数に置き換えたから個人情報ではない」という説明が成り立つかは、対応表の有無と管理方法に依存するため、この判断は自分たちだけで結論を出さない。

#### 列単位で分類し、その分類を型に載せる

一覧を持っても、コードの側が分類を知らなければ運用は続かない。分類をスキーマとコードに書き込む。

```sql
-- 分類をコメントとして残す（機械的に取り出せる）
COMMENT ON COLUMN users.email IS 'pii:contact retention:account+30d';
COMMENT ON COLUMN users.display_name IS 'pii:profile retention:account+30d';
COMMENT ON COLUMN events.ip_address IS 'pii:derived retention:90d';
```

```typescript
// 型の側でも「素の string」と区別する（27.2 の Value Object と同じ考え方）
type Sensitive<T, Tag extends string> = T & { readonly __sensitive: Tag };
type Email = Sensitive<string, 'contact'>;

// 素の string を受け取る関数へ渡せないため、うっかりログへ流す経路が減る
export function logSafe(email: Email): string {
  const [local, domain] = email.split('@');
  return `${local.slice(0, 1)}***@${domain}`;
}
```

型で完全に防げるわけではない (`JSON.stringify` は型を見ない) が、意図しない経路を1つずつ塞ぐ効果はある。決定的なのは次のログ側の対策である。

#### ログとトレースが最大の漏れ口である

22.3 で扱った構造化ログは、**そのまま使うと個人データの複製装置になる**。ログは長期間保存され、検索可能で、多くの場合アプリケーション本体より広い範囲の担当者が閲覧でき、そして削除要求の対象として認識されにくい。

漏れる典型的な経路は次の4つである。

| 経路 | 例 |
|---|---|
| リクエスト本体をそのまま出す | 登録フォームの `body` を丸ごと `logger.info` |
| エラーオブジェクトをそのまま出す | ORM の例外に SQL のバインド値が入っている |
| 識別子のつもりで実データを出す | `user_email` をログの相関キーにする |
| 自動収集される項目 | IPアドレス、`User-Agent`、`Referer`、Cookie |

対策は、**出さないものを列挙する (拒否リスト) のではなく、出してよいものを列挙する (許可リスト)**ことである。拒否リストは、新しい項目が増えるたびに漏れる。

```typescript
const LOGGABLE = new Set(['requestId', 'userId', 'tenantId', 'route', 'status', 'durationMs']);

export function scrub(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (LOGGABLE.has(key)) out[key] = value;
    else out[key] = '[redacted]';           // キーは残す。何が来たかは分かる
  }
  return out;
}
```

キー自体は残して値だけを伏せると、「そこに何かが渡された」という事実は追跡でき、調査に必要な情報を失わない。

- **エラーの本文も対象にする。** 例外メッセージ、スタックトレースの引数表示、ORM のクエリログはいずれも実データを含みうる。トレースの属性へ SQL を入れる場合はバインド前の文字列にする (22.8)。
- **`userId` は残してよいことが多い。** ログから個人を特定するには利用者DBが必要であり、DB側を消せばログ側の値は意味を失う。ただしこの整理が受け入れられるかは組織と制度によるため、方針として明文化しておく。
- **保持期間を短くする。** ログの保持期間は、費用の観点だけでなく個人データの観点でも決める。90日と2年では意味が違う。
- **ローカル開発とテストも対象にする。** 本番ログから採ったデータをテストの固定値へ貼り付けると、リポジトリの履歴に永久に残る (28.15 の課題28.1 も同じ点を警告している)。

#### 誰が見られるかを設計に含める

個人データの保護は、外部からの攻撃だけの問題ではない。内部の閲覧経路のほうが、日常的に発生する。

- **管理画面・サポートツールは例外にしない。** 13.24 が扱ったとおり、越境する経路は同じ認可層を通し、越境そのものを記録する。「サポートが顧客の画面を見る」機能は、誰がいつ誰のデータを見たかを残す。
- **本番DBへの直接接続を常用しない。** 調査のたびに `SELECT * FROM users` を叩く運用は、監査もマスキングも効かない。読み取り専用の閲覧経路を用意し、そこにマスキングを実装する。
- **分析基盤には最初から仮名化して送る。** 分析担当者が氏名やメールアドレスを見られる必要はまず無い。送ってから消すのではなく、送らない。
- **バックアップとレプリカにも同じ権限設計を適用する。** 本番より緩い権限で置かれたバックアップは、実質的にそこが最も弱い経路になる。

#### 保存時と通信時の暗号化は前提であって対策の全部ではない

保存時の暗号化 (ディスク暗号化、列単位の暗号化) と通信の暗号化 (TLS、第3章) は、いずれも前提として実施する。ただし、これらが効くのは**媒体や経路が奪われた場合**であり、正当な権限でアプリケーションを通して読まれる経路には効かない。実際の漏洩は、盗まれたディスクよりも、権限設計の穴、認可の抜け (23.7 の IDOR)、ログ、そして退職者のアクセス権の残存から起きることが多い。

列単位の暗号化を選ぶ場合は、14.21 のエンベロープ暗号化を使い、**利用者またはテナント単位で鍵を分ける**。鍵を分けておくと、14.26 で扱う「鍵を破棄して実質的に消す」手段が使えるようになる。分けていない場合、この手段は取れない。

#### つまずく箇所 ― 個人データの収集と保存

- **所在一覧を持たない**: 削除要求もエクスポート要求も、どこを見ればよいか分からず場当たり的な対応になる。スキーマ変更のレビュー項目に含める。
- **「あとで使うかもしれない」で収集する**: 使われないまま漏洩リスクと削除の手間だけが残る。収集しないのが最も安い対策である。
- **ログの機密フィールドを拒否リストで管理する**: 新しい項目が増えるたびに漏れる。許可リストにする。
- **エラーオブジェクトをそのまま出力する**: 例外メッセージとスタックにバインド値が入りうる。整形して出す。
- **仮名化を匿名化と呼ぶ**: 対応表がある限り復元できる。名称の取り違えは、社内の判断を誤らせる。
- **分析基盤へ実データを送ってから消す**: 複製が増えたあとで追いかけることになる。送る前に落とす。
- **管理画面とサポートツールを例外扱いする**: 日常的な閲覧経路であり、記録が無ければ何が見られたか説明できない。
- **暗号化しているから安全だと考える**: 正当な経路からの読み取りには効かない。権限と認可を併せて設計する。

<a id="section-14-26"></a>
### 14.26 保持期間、削除、エクスポート ― 個人データの終わり方
<!-- handbook:learning {"level":"practical","minutes":25} -->
<!-- handbook:index {"group":"は行","term":"保持期間 (個人データ)"} -->
<!-- handbook:index {"group":"さ行","term":"削除の伝播"} -->
<!-- handbook:index {"group":"た行","term":"データエクスポート"} -->
<!-- handbook:index {"group":"か行","term":"クリプトシュレッディング"} -->
<!-- handbook:index {"group":"た行","term":"同意の記録"} -->

<!-- handbook:narrative-bridge {"section":"14.26"} -->
14.25 で所在を把握し、持つ量を絞った。残るのは、いつやめるかと、やめたことをどう証明するかである。削除とエクスポートは、機能としては地味だが、設計を後回しにすると**あとから作れない**という性質を持つ。派生先が増えたあとで削除の伝播を作るのは、最初から作るより桁違いに難しいためである。

利用者からの要求として現れる形は、おおむね次の4つに集約される。制度によって名称も条件も異なるが、**技術的に用意すべき仕組みは共通している**。

| 要求 | 技術的に必要なもの |
|---|---|
| 自分のデータを見せてほしい | 利用者単位でデータを集める経路 |
| 持ち出したい | 機械可読な形式での書き出し |
| 直してほしい | 更新経路と、派生先への反映 |
| 消してほしい | 削除の伝播と、消せないものの説明 |

**繰り返すが、これは法的助言ではない。** 応じる義務があるか、どの期間内か、拒否できる場合があるか、本人確認をどこまで求めるかは法域と契約で異なる (28.14)。ここで扱うのは、どの制度に対応することになっても必要になる**土台の作り方**である。要件そのものは法務および専門家に確認する。

#### 保持期間はデータごとに決め、機械的に実行する

「必要な期間だけ保持する」という原則は広く共有されているが、方針を文書に書くだけでは何も消えない。保持期間は、次の3つが揃って初めて機能する。

1. **項目ごとの期間が決まっている** (14.25 の所在一覧)
2. **期間を過ぎたものを見つける手段がある** (列とインデックス)
3. **定期的に実行され、結果が観測できる** (14.24 の定期実行)

期間の決め方は、大きく3種類ある。

| 種別 | 例 | 起点 |
|---|---|---|
| 固定期間 | アクセスログ90日、トレース14日 | 作成時刻 |
| イベント起点 | 退会から30日後に本削除 | 状態遷移の時刻 |
| 法定・契約上の保存 | 取引記録、請求書 | 取引の成立時刻 |

3番目が重要である。**削除要求があっても消せない、あるいは消してはならないデータが存在しうる。** 取引記録や会計帳票の保存義務は、削除の要求と衝突する。この衝突をどう整理するかは制度と業種で異なるため、開発側で結論を出さず、あらかじめ法務と決めておく。技術側で必要なのは、「この範囲は消す、この範囲は残す、残す理由はこれ」を**データの分類として持てるようにしておく**ことである。

```sql
-- 期限切れを探せる形にしておく。全表走査になる設計では実行されなくなる
CREATE INDEX idx_events_purge ON events (created_at) WHERE purged_at IS NULL;

-- 削除ではなく「個人データの部分だけを落とす」ことも多い
UPDATE events
   SET ip_address = NULL, user_agent = NULL, purged_at = now()
 WHERE created_at < now() - interval '90 days'
   AND purged_at IS NULL;
```

削除ジョブは、一度に全件を消そうとすると長いトランザクションになり、14.18 の VACUUM とレプリケーション遅延に影響する。**上限件数を決めて刻み、残件数をメトリクスとして出す** (22.6)。残件数が減っていないことは、ジョブが失敗しているか、流入が処理量を超えていることの合図である。

#### 削除は「伝播」として設計する

`DELETE FROM users WHERE id = $1` で終わる設計は、まず存在しない。削除は、一覧に挙げたすべての保存場所へ届かなければ完了しない。しかも保存場所ごとに、削除の意味も所要時間も違う。

```text
削除要求
  │
  ├─ 即時   : ログイン不可にする、セッションを全失効させる、公開コンテンツを非表示にする
  ├─ 猶予中 : 復旧できる期間（誤操作・不正な要求への備え）。この間は「削除予定」状態
  ├─ 本削除 : 主テーブル、派生テーブル、検索インデックス、オブジェクトストレージ
  ├─ 委託先 : 外部SaaSの削除APIを呼ぶ。応答が非同期のものは完了を追う
  ├─ 鍵破棄 : 列暗号化しているものは DEK を破棄する（14.21）
  └─ 期限切れ: バックアップ世代が保持期間を過ぎて自然に消える
```

設計上の要点は4つある。

**1. 状態を持たせ、進捗を記録する。** 削除は一瞬では終わらないため、要求そのものを行として記録する。どこまで進んだか、どこで失敗したかが分からないと、再実行も説明もできない。

```sql
CREATE TABLE deletion_request (
  id            uuid PRIMARY KEY,
  subject_id    uuid NOT NULL,
  requested_at  timestamptz NOT NULL,
  purge_after   timestamptz NOT NULL,       -- 猶予期間の終わり
  state         text NOT NULL,              -- pending / purging / done / failed
  targets       jsonb NOT NULL,             -- 場所ごとの完了状況
  completed_at  timestamptz
);
```

**2. 各場所の処理を冪等にする。** 途中で失敗した削除は再実行される。「すでに消えている」は成功として扱う。17.13 で扱った冪等性の考え方が、そのまま当てはまる。

**3. 消せないものは、消せないと決めて記録する。** 監査ログの行そのものを消すと、監査ログの意味が失われる。取引記録は保存義務がありうる。これらは、**個人を識別する部分だけを落とす** (`user_id` を残して氏名・メールアドレスを消す、あるいは `user_id` を復元不能な値に置き換える) という扱いが取られることが多い。どの方式にするかは、監査要件と法定保存の両方に関わるため、開発側だけで決めない。

**4. バックアップは「期限切れを待つ」と明示する。** 過去のバックアップ世代からピンポイントで1人分を消すことは、現実的にはほぼ不可能である。多くの組織は「バックアップの保持期間内は残るが、復元した場合は再度削除処理を適用する」という運用にしている。**利用者に対して「削除しました」と説明する範囲に、バックアップが含まれるかどうかを明文化する。** これは 30.14 のチェックリストでも同じ点を確認している。列単位で暗号化し、利用者ごとの鍵を破棄する方式 (クリプトシュレッディング、14.21) を取っていれば、バックアップに暗号文が残っていても復元できないため、この問題を実務上回避できる。ただし、この扱いが制度上どう評価されるかは自分たちで結論を出さない。

削除の伝播で最も多い抜けは、**外部キーで辿れない場所**である。検索インデックス、キャッシュ、分析基盤、オブジェクトストレージ、外部SaaS。これらはアプリケーションの ORM から見えないため、テーブルを1つ足したときには気づいても、インデックスを1つ足したときには気づきにくい。所在一覧 (14.25) を削除ジョブの入力にしてしまい、一覧に載っているのにジョブが対応していない場所があれば起動時に失敗させる、という形にすると腐りにくい。

#### エクスポートは「範囲」と「形式」で失敗する

エクスポートは削除より単純に見えるが、2種類の事故が起きる。

**範囲が広すぎる事故**が最も危険である。共有ドキュメント、グループチャット、コメント欄のように、複数人が関わるデータをそのまま書き出すと、**要求した本人以外のデータが混ざる**。「自分のデータをください」という要求に応えたつもりが、第三者の情報を渡す事故になる。

判断の型としては、次のように分ける。

| データ | 扱い |
|---|---|
| 本人が入力した内容 | 含める |
| 本人に関する記録 (ログイン履歴、購入履歴) | 含める |
| 本人が受け取ったメッセージ | 送信者の識別子をどう扱うか事前に決める |
| 他者が本人について書いた内容 | 原則として含めない、または要判断 |
| 本人が参加した共有空間の全内容 | 含めない |

境界が曖昧なものは必ず出るため、**判断を都度その場で行わず、方針として先に決めておく**。決めておかないと、要求を受けてから慌てて判断することになる。

**範囲が狭すぎる事故**も起きる。実装した時点の表だけを対象にしていると、あとから追加された機能のデータが入らない。ここでも所在一覧を入力にし、一覧にあってエクスポート対象に無い項目を検出できるようにしておく。

形式については、機械可読であることが求められる場面が多い。実務的には次の点を決める。

- **JSON か CSV か。** 入れ子構造があるなら JSON、表形式なら CSV。CSV では 14.24 のとおり日時のタイムゾーンを明示する。
- **添付ファイルをどうするか。** メタデータだけを JSON に入れ、実体は同じアーカイブに同梱するのが扱いやすい。
- **書き出しは非同期にする。** 大きな利用者では時間がかかる。ジョブとして実行し (17.6)、完了を通知する。同期リクエストの中で作ろうとすると、タイムアウトと 14.22 の noisy neighbor を同時に招く。
- **ダウンロードURLに有効期限を付ける。** 生成したアーカイブそのものが個人データの塊である。署名付きURL (12.13) を短い有効期限で発行し、生成物にも保持期間を設定する。認証を通さない長命なURLを配ってはならない。

```typescript
type ExportScope = { subjectId: string; includeSharedContent: false };

// 一覧を入力にする。未対応の場所があれば起動時に落ちる
export async function buildExport(scope: ExportScope, inventory: InventoryEntry[]) {
  const missing = inventory.filter((e) => e.exportable && !EXPORTERS.has(e.location));
  if (missing.length > 0) {
    throw new Error(`export not implemented for: ${missing.map((e) => e.location).join(', ')}`);
  }
  // ...各 exporter を呼び、1つのアーカイブへまとめる
}
```

#### 同意と目的を記録する

「集めてよいか」の根拠が同意である場合、同意そのものが記録すべきデータになる。記録しておくべきなのは、同意した事実だけではない。

- **いつ**同意したか
- **何のバージョンの文面**に同意したか (文面は変わる)
- **どの目的**に対する同意か (目的ごとに別々に扱えるようにする)
- **撤回されたか**、撤回された時刻

重要なのは、**撤回が処理へ反映される経路を作っておく**ことである。同意フラグを `users` テーブルに置いただけで、実際にメールを送るバッチや分析基盤への転送がそのフラグを見ていない、という状態は起こりやすい。撤回は「フラグを下ろす」だけでなく、「その目的で動いているすべての処理が止まる」ところまでを含む。

なお、同意はあらゆる取り扱いの万能な根拠ではない。制度によっては、契約の履行や法令上の義務など、同意以外の根拠が想定されている。**「とりあえず同意を取ればよい」という設計にはしない。** どの取り扱いをどの根拠で行うかの整理は、法務と行う。

#### 事故が起きたときに答えられる状態にしておく

漏洩が疑われる事象が起きたとき、多くの制度が短い時間内での報告や通知を求めている (28.14 は GDPR の72時間に触れている)。その時点で答えを用意し始めるのでは間に合わない。あらかじめ答えられるようにしておく項目は、技術側でほぼ決まっている。

- どのデータが、どの範囲の人数分、どの経路で出た可能性があるか (14.25 の所在一覧)
- いつからいつまでか (ログの保持期間が短すぎると、ここが答えられない)
- 誰がアクセスしたか (アクセスログと監査ログ)
- すでに止まっているか (鍵・トークンの失効、権限の剥奪)

**ログの保持期間を短くしすぎると、事故のときに範囲を特定できない**という逆向きの制約がある。個人データの観点からは短く、調査の観点からは長く、という緊張関係があるため、種別ごとに決める。アクセスの事実を残す監査ログと、リクエスト内容を含むアプリケーションログでは、適切な期間が違う。

#### つまずく箇所 ― 保持期間、削除、エクスポート

- **保持期間を文書にだけ書く**: 実行するジョブと、期限切れを探せる索引が無ければ何も消えない。
- **削除を主テーブルの行削除だけで済ませる**: 検索インデックス、分析基盤、オブジェクトストレージ、外部SaaSに残る。所在一覧を削除ジョブの入力にする。
- **削除の進捗を記録しない**: 途中で失敗したときに、どこまで終わったかも再実行の可否も分からない。
- **削除処理が冪等でない**: 再実行のたびにエラーになり、結局手作業になる。
- **バックアップを含めて「削除しました」と説明する**: 実際には世代の期限切れまで残る。説明する範囲を明文化する。
- **エクスポートに他人のデータを含める**: 共有コンテンツやメッセージの扱いを先に決めていないと、要求に応じたつもりで漏洩になる。
- **エクスポートを同期リクエストで作る**: 大きな利用者でタイムアウトし、他テナントの資源も食う。ジョブにする。
- **生成したアーカイブに有効期限を付けない**: それ自体が個人データの塊である。署名付きURLと保持期間を設定する。
- **同意の撤回がフラグで止まる**: バッチや外部連携がフラグを見ていなければ、処理は続いている。

<a id="section-14-27"></a>
### 14.27 実装課題 ― RDB の内側を実装する
<!-- handbook:learning {"level":"advanced","minutes":930} -->

<!-- handbook:narrative-bridge {"section":"14.27"} -->
RDBの表面APIだけを使っていると、B-Tree、分離レベル、ORM、マイグレーションが別々の知識に見えやすい。最小実装を通じて、探索、可視性、変換、進化がどの状態を保持して成立するかを確かめる。

第14章では RDB の中核 (B-Tree、トランザクション、MVCC、N+1、ORM) を見た。本節では、それぞれを自作することでデータベースエンジン側の挙動を理解する。所要時間: 演習カードの推定時間の合計で15時間30分。

#### 課題14.1: B-Tree インデックスを自作 (★★★)

**目的**: 「**インデックスがあるとなぜ速いか**」を実装で確認。

<!-- handbook:exercise:start {"id":"14.1"} -->
> **演習カード 課題14.1** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - `14.3 インデックスの内部構造` を読み、B-Treeのノード分割と探索経路の考え方を把握する
> - 配列の二分探索と、再帰による木構造の走査をTypeScriptで書ける
> - `pnpm install` 済みで `pnpm --filter @handbook/ch14 exec tsx btree.ts` が実行できる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `code/ch14/btree.ts` に `BTree<K, V>` を実装し、`insert` / `search` / `range` / `depth` / `print` の5メソッドを公開している
> - [ ] 同じキーで2回 `insert` すると値が上書きされ、木の要素数が増えない
> - [ ] 次数3で1000件挿入したあとの `depth()` が10未満に収まる
> - [ ] `range(10, 13)` がキー昇順で `['v10','v11','v12','v13']` に相当する値配列を返す
> - [ ] 1000要素に対する `search` の所要時間が、同じ1000要素の配列 linear scan より10倍以上短い
>
> **期待出力**
>
> - `print()` がレベルごとにインデントされた `[10, 20]` 形式の行を返し、根から葉までの階層が読める
> - 1000件挿入後のベンチマークで、B-Tree検索の合計ミリ秒が linear scan の1/10以下になる
> - 存在しないキーの `search` が `undefined` を返し、例外にならない
>
> **観察項目**
>
> - 要素数100 / 1000 / 10000 で `depth()` を比較し、深さが対数的にしか増えないことを確認する
> - `minDegree` を2、3、8と変えて `print()` の行数とノードあたりのキー数がどう変わるかを見る
> - ノードが満杯になる直前と直後で `print()` を出力し、中央のキーが親へ押し上がる瞬間を確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch14 run test` を実行し、`B-Tree supports search, replacement, ranges, depth, and print` がパスすることを確認する
> 2. `console.time` と `console.timeEnd` で B-Tree検索1000回と `Array.prototype.find` 1000回を計測し、10倍以上の差が出るか確認する
> 3. `code/ch14/btree.solution.ts` の分割処理と自作実装を読み比べ、分割の発火条件 (キー数が `2 * minDegree - 1`) がずれていないか確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: まず葉ノード1枚だけの配列版から始める。キーを昇順に保つ挿入と線形探索が通ってから、分割を足すと崩れにくい。
> 2. **構造**: ノードは `entries: {key, value}[]` と `children: Node[]` の2配列で表す。`insert` は「根が満杯なら先に分割してから、満杯でない子へ降りる」順序で書き、`search` と `range` は「キーより小さいentryを数えてindexを決める」同じ走査を共有する。
> 3. **実装の要点**: 分割では `entries[minDegree - 1]` を親へ押し上げ、右半分を新ノードへ移す。既存キーの更新を分割より前に処理しないと、同じキーが複数ノードへ重複して残る。
>
> **本番利用時の警告**
>
> - このB-Treeはメモリ上のみでWAL、ページ永続化、クラッシュリカバリを持たないため、プロセス停止でインデックスが丸ごと消える。実データのインデックスはDBMSに任せる
> - 削除時のノードのマージと再配分を実装していないため、削除が必要な用途へ流用すると木の不変条件 (各ノードの最小キー数) が壊れて検索が誤る
>
> **導線**
>
> - 開始地点: `code/ch14/btree.ts`
> - 模範解答: `code/ch14/btree.solution.ts`
>
> **推定時間の内訳**: 挿入と分割の実装60分、search/range/depth/printの実装40分、linear scanとのベンチマーク30分、次数を変えた観察20分
<!-- handbook:exercise:end -->

**要件**: メモリ上の B-Tree を実装。

```typescript
const tree = new BTree<number, string>(4);  // 次数 4
tree.insert(50, 'fifty');
tree.insert(20, 'twenty');
tree.insert(80, 'eighty');
// ... 1000件挿入

tree.search(50);           // O(log n) で 'fifty'
tree.range(20, 60);        // [twenty, ..., fifty] (範囲検索)
tree.depth();              // ツリーの深さ
```

**評価基準**:
- 1000要素の挿入後、検索が**配列 linear scan より 10x 速い**
- 範囲検索が機能する
- 視覚化: `tree.print()` でツリー構造を表示

模範解答: `code/ch14/btree.solution.ts`

#### 課題14.2: トランザクション分離レベル実験 (★★★)

**目的**: 「**Read Committed、Repeatable Read、Serializable**」の違いを実演する。

<!-- handbook:exercise:start {"id":"14.2"} -->
> **演習カード 課題14.2** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: PostgreSQL、Docker
>
> **前提**
>
> - `14.7 トランザクション分離レベル` と `14.8 MVCC ― スナップショットによる並行制御` を読み、Dirty Read / Non-repeatable Read / Phantom Read を区別できる
> - `docker compose -f .devcontainer/docker-compose.yml up -d postgres` で postgres:18-alpine サービスを起動できる
> - psql で2セッションを同時に開き、`BEGIN` から `COMMIT` までを手動で交互に打てる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] 2セッションで Non-repeatable Read を再現し、READ COMMITTED では同一トランザクション内の2回の `SELECT balance` が異なる値になることを記録した
> - [ ] 同じ手順を REPEATABLE READ で実行し、2回の読み取り値が一致することを記録した
> - [ ] 別セッションが条件に合う行を INSERT する Phantom Read シナリオで、READ COMMITTED のとき件数が増えることを確認した
> - [ ] Lost Update シナリオを SERIALIZABLE で実行し、後からコミットした側がシリアライズ失敗で拒否されることを確認した
> - [ ] `code/ch14/transaction-isolation/starter/main.ts` にスナップショット模擬を実装し、`demonstrateNonRepeatableRead` が `read committed` で `[100, 999]`、`repeatable read` で `[100, 100]` を返す
>
> **期待出力**
>
> - READ COMMITTED の再現ログに `100 → 999` のように異なる2値が並ぶ
> - REPEATABLE READ では同じ位置に `100 → 100` と同値が並ぶ
> - SERIALIZABLE の衝突で PostgreSQL は SQLSTATE 40001 のエラーを返し、模擬実装は `Serialization failure` を投げる
>
> **観察項目**
>
> - 各セッションで `SELECT txid_current()` と `SELECT pg_current_snapshot()` を実行し、スナップショットの取得タイミングが分離レベルで変わることを見る
> - `SELECT * FROM pg_locks WHERE granted = false` で、同一行を更新する2トランザクションが行ロック待ちになっている様子を確認する
> - Phantom Read シナリオを REPEATABLE READ で実行し、PostgreSQL が標準の要求より強く phantom を防ぐことを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `docker compose -f .devcontainer/docker-compose.yml exec postgres psql -U handbook -d handbook -c 'SELECT 1'` が結果 `1` を返し、DBへ接続できることを先に確認する
> 2. `pnpm --filter @handbook/ch14 run test` を実行し、`isolation simulator exposes non-repeatable read and serializable conflict` がパスすることを確認する
> 3. 4シナリオ×3分離レベルの「防げた / 防げなかった」表を作り、`code/ch14/transaction-isolation/solution/main.ts` の読み取り版切り替え (read committed のときだけ最新版を読む) と結果が矛盾しないか確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: いきなり自動化せず、1シナリオ×1分離レベルを psql 2枚で手作業で通し、BEGIN・UPDATE・COMMIT・再SELECT を打つ順序を時系列表にしてからコードへ写す。
> 2. **構造**: コードでは接続を2本張り、`SET TRANSACTION ISOLATION LEVEL ...` を `BEGIN` 直後に発行する。模擬実装側は版番号付きの履歴 `{version, value}` を口座ごとに保持し、トランザクションが読む版を分離レベルで切り替える。
> 3. **実装の要点**: 詰まるのはスナップショットの取得時点。PostgreSQL の REPEATABLE READ はトランザクション内で最初にデータへ触れた時点の版を固定するため、`BEGIN` 直後に何も読まないまま別セッションがコミットすると、期待した「同じ値」が観測できない。
>
> **本番利用時の警告**
>
> - SERIALIZABLE を使う実装は SQLSTATE 40001 のリトライ処理と一体である。リトライを書かずに本番投入すると、負荷が上がった瞬間にユーザー操作がそのままエラーになる
> - この演習用 PostgreSQL は `handbook / handbook` という既知の資格情報で動く。ポートを公開してローカル以外から到達できる状態にしない
>
> **導線**
>
> - 開始地点: `code/ch14/transaction-isolation/starter/main.ts`
> - 模範解答: `code/ch14/transaction-isolation/solution/main.ts`
>
> **推定時間の内訳**: 環境起動とpsql2セッションの準備20分、4シナリオ×3分離レベルの手動実行60分、コードでの自動化と模擬実装50分、結果表の作成20分
<!-- handbook:exercise:end -->

**手順**: ローカル PostgreSQL を Docker で起動し、2クライアントで以下を再現:
- **Dirty Read**: トランザクション中の未コミットを読む (PostgreSQL は標準で防止済み)
- **Non-repeatable Read**: 同じ行を2回読むと値が違う
- **Phantom Read**: 同じクエリを2回叩くと行数が違う
- **Lost Update**: 2つのトランザクションが同じ行を更新

各シナリオを Read Committed → Repeatable Read → Serializable で実行し、どこから防げるか観察。

```typescript
// 2つのコネクションを使う
const conn1 = await pool.connect();
const conn2 = await pool.connect();

// シナリオ: Non-repeatable read
await conn1.query('BEGIN');
await conn1.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
const r1 = await conn1.query('SELECT balance FROM account WHERE id=1');

// 別トランザクションが更新 + コミット
await conn2.query('BEGIN');
await conn2.query('UPDATE account SET balance=999 WHERE id=1');
await conn2.query('COMMIT');

// もう一度読むと違う値!(Repeatable Read だと同じ値になる)
const r2 = await conn1.query('SELECT balance FROM account WHERE id=1');
console.log(r1.rows[0].balance, '→', r2.rows[0].balance);
```

模範解答: `code/ch14/transaction-isolation/`

#### 課題14.3: N+1 問題の解決 ― EXPLAIN 比較 (★★)

**目的**: 同じ機能を「ループで個別クエリ」vs「JOIN 一発」で実装し、EXPLAIN で実行計画を比較。

<!-- handbook:exercise:start {"id":"14.3"} -->
> **演習カード 課題14.3** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: PostgreSQL、SQLite
>
> **前提**
>
> - `14.5 N+1 問題` と `14.4 実行計画 (EXPLAIN) の読み方` を読み、Seq Scan / Index Scan / Hash Join の意味を言える
> - 第12章の DataLoader によるバッチ化を思い出し、アプリ側の解決とSQL側の解決を区別できる
> - `pnpm --filter @handbook/ch14 exec tsx n-plus-one/starter/main.ts` が実行できる状態にしてある
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `loadWithNPlusOne` と `loadWithJoin` が、どちらも `authorName` を持つ同一内容の配列を返す
> - [ ] クエリ回数カウンタで、N+1版が `1 + N` 回、JOIN版が1回になることを数値で示せる
> - [ ] 両方式の EXPLAIN 出力を並べ、JOIN側にだけ Hash Join が現れることを確認した
> - [ ] 著者が存在しない投稿でも `authorName` が `unknown` になり、例外にならない
> - [ ] 投稿件数を10、100、1000と増やしても JOIN版のクエリ回数が1のまま変わらない
>
> **期待出力**
>
> - 投稿2件・ユーザー2件のとき N+1版の `queryCount` が3、JOIN版が1になる
> - N+1側の EXPLAIN が `Seq Scan posts` と `Index Lookup users × N` の2行、JOIN側が `Hash Join posts.user_id = users.id` を含む3行を返す
> - 件数を増やすと N+1版のクエリ回数だけが線形に伸び、JOIN版は定数のままになる
>
> **観察項目**
>
> - 投稿件数を変えながら `queryCount` を記録し、N+1版は件数に比例、JOIN版は定数であることを表にする
> - 実DBで試す場合は `EXPLAIN (ANALYZE, BUFFERS)` の `Buffers: shared hit` 行を比較し、往復回数の差がバッファ読み取り量に現れることを見る
> - IN句で一括取得する DataLoader 方式を第3の実装として足し、クエリ回数が2回に収まることを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch14 run test` を実行し、`N+1 performs one plus N queries while join uses one` がパスすることを確認する
> 2. posts と users を作成したうえで `docker compose -f .devcontainer/docker-compose.yml exec postgres psql -U handbook -d handbook -c 'EXPLAIN ANALYZE SELECT posts.*, users.name FROM posts JOIN users ON users.id = posts.user_id'` を実行し、計画に Hash Join か Merge Join が現れることを確認する
> 3. N+1版とJOIN版の戻り値を `assert.deepEqual` で比較し、順序を含めて完全に一致することを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 先に「クエリを何回投げたか」を数える仕組みを作る。計測できないと改善したことを証明できない。
> 2. **構造**: DBスタブの各メソッド (投稿一覧・ユーザー1件取得・結合取得) でカウンタを1つ増やす。N+1版は投稿一覧の結果をループしてユーザーを都度引き、JOIN版はユーザーを `Map` に載せて1回の走査で組み立てる。
> 3. **実装の要点**: JOIN版で著者が見つからない投稿の扱いを先に決める。デフォルト値へ落とさないと、INNER JOIN と LEFT JOIN の件数差がそのままバグになる。
>
> **本番利用時の警告**
>
> - 教材の EXPLAIN は固定文字列を返す模擬であり、統計・行数見積り・コストに基づく実際のプランナ判断は再現しない。本番の判断は必ず実DBの `EXPLAIN (ANALYZE, BUFFERS)` で行う
> - JOIN一発が常に速いわけではない。1対多の JOIN は行数が掛け算で膨らむため、件数を測らずに全部JOINへ寄せると転送量とメモリで逆に遅くなる
>
> **導線**
>
> - 開始地点: `code/ch14/n-plus-one/starter/main.ts`
> - 模範解答: `code/ch14/n-plus-one/solution/main.ts`
>
> **推定時間の内訳**: 計測付きDBスタブの実装25分、N+1版とJOIN版の実装25分、EXPLAIN比較と件数を変えた計測25分、DataLoaderとの関係の整理15分
<!-- handbook:exercise:end -->

**準備**: SQLite ベースで動くサンプル (PostgreSQL は環境依存があるため)

```typescript
// Bad: N+1 パターン
const posts = db.query('SELECT * FROM posts');  // 1 クエリ
for (const post of posts) {
  post.author = db.query('SELECT * FROM users WHERE id=?', post.userId);  // N クエリ
}

// Good: JOIN
const postsWithAuthor = db.query(`
  SELECT posts.*, users.name AS author_name
  FROM posts JOIN users ON users.id = posts.user_id
`);
```

**問題**:
- 各方式の EXPLAIN を出力し、Seq Scan / Index Scan / Hash Join の違いを観察
- なぜ JOIN の方が速いか?
- DataLoader (第12章) との関係は?

模範解答: `code/ch14/n-plus-one/`

#### 課題14.4: 軽量 ORM 自作 (★★★)

**目的**: ActiveRecord 風の ORM を実装し、ORM が裏でやっていることを理解する。

<!-- handbook:exercise:start {"id":"14.4"} -->
> **演習カード 課題14.4** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: SQLite
>
> **前提**
>
> - `14.11 ORM の光と影` を読み、Active Record と Data Mapper の違いを説明できる
> - TypeScript の静的メソッドでのジェネリクスと、`then` を実装して `PromiseLike` にする書き方が読める
> - `pnpm --filter @handbook/ch14 exec tsx mini-orm/starter/main.ts` が実行できる状態にしてある
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `Model` を継承した `class User extends Model` で `create` / `find` / `update` / `delete` が動作する
> - [ ] `User.where({ age: { gte: 25 } }).orderBy('name', 'asc').limit(10)` がチェインでき、`await` でそのまま配列を取得できる
> - [ ] `compile()` が `SELECT * FROM users WHERE age >= ? ORDER BY name ASC LIMIT ?` と `params: [25, 10]` を返し、値がSQL文字列へ埋め込まれていない
> - [ ] `find` が存在しないidに対して `undefined` を、`delete` が成功時に `true` を返す
> - [ ] `where` で等値比較と `gte` / `lte` / `gt` / `lt` の4演算子が使える
>
> **期待出力**
>
> - `compile()` の戻り値が `sql` と `params` の2キーを持つオブジェクトになる
> - `create({ name: 'Alice', age: 30 })` が自動採番された `id` を含むインスタンスを返す
> - `name` に `"; DROP TABLE users; --` のような文字列を渡しても `sql` は変わらず、その文字列は `params` 配列の要素として現れる
>
> **観察項目**
>
> - 条件を足すたびに `compile()` の出力を表示し、`where` を2回呼んだときに `AND` で連結されることを確認する
> - `await query` と `query.execute()` の結果が一致することを確かめ、`PromiseLike` 実装の効果を見る
> - アダプタから取得した行を書き換えてもストア側の値が変わらないことを確認し、返す行がコピーである意味を読み取る
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch14 run test` を実行し、`mini ORM supports CRUD, chained query, and placeholders` がパスすることを確認する
> 2. 引用符とセミコロンを含む文字列を `where` に渡すテストを1件追加し、`compile()` の `sql` にその文字列が現れないことを確認する
> 3. `code/ch14/mini-orm/solution/main.ts` の `compile` と自作実装を比較し、`LIMIT ?` のパラメータが `params` の末尾に付く順序が一致するか確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 「SQL文字列を組み立てる部分」と「実際に行を返す部分」を最初から分ける。前者だけを単体で検証できれば、アダプタが何であっても設計が崩れない。
> 2. **構造**: クエリビルダに条件・並び順・件数上限の3状態を持たせ、`where` / `orderBy` / `limit` は `this` を返す。`then` を実装して `PromiseLike` にすると `await User.where(...)` と書ける。
> 3. **実装の要点**: 条件値がオブジェクト (`{ gte: 25 }`) か素の値かで分岐する箇所が要点。演算子名からSQL演算子への対応表を引き、実値は必ずパラメータ配列側へ push する。
>
> **本番利用時の警告**
>
> - この ORM はテーブル名とカラム名をエスケープせずSQLへ連結する。カラム名を外部入力から受け取る形で使うと、値にプレースホルダを使っていてもSQLインジェクションが成立する
> - コネクション管理、トランザクション、リレーション解決、マイグレーション整合を持たないため、実サービスでは Prisma や Drizzle などの実装済みORMを使う
>
> **導線**
>
> - 開始地点: `code/ch14/mini-orm/starter/main.ts`
> - 模範解答: `code/ch14/mini-orm/solution/main.ts`
>
> **推定時間の内訳**: ModelとAdapterの骨格40分、クエリビルダのチェインとcompile実装50分、CRUDと型付けの調整35分、インジェクション確認テストの追加25分
<!-- handbook:exercise:end -->

**要件**: 以下のように使えるミニ ORM。

```typescript
class User extends Model {
  static tableName = 'users';
  id!: number;
  name!: string;
  email!: string;
}

// セットアップ
ORM.init({ adapter: new SQLiteAdapter(':memory:') });
await User.createTable({ id: 'integer primary key', name: 'text', email: 'text' });

// CRUD
const u = await User.create({ name: 'Alice', email: 'alice@example.com' });
const found = await User.find(u.id);
const all = await User.findMany({ where: { name: 'Alice' } });
await User.update(u.id, { name: 'Alicia' });
await User.delete(u.id);

// Query builder
const recent = await User
  .where({ created_at: { gte: yesterday } })
  .orderBy('name', 'asc')
  .limit(10);
```

**評価基準**:
- 基本的な CRUD が動く
- where 句のチェイン
- SQL インジェクション対策 (プレースホルダ)
- マイグレーション機能 (発展)

模範解答: `code/ch14/mini-orm/`

#### 課題14.5: マイグレーション Runner 自作 (★★)

**目的**: Flyway や Rails Migration の動作原理を自作する。

<!-- handbook:exercise:start {"id":"14.5"} -->
> **演習カード 課題14.5** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: SQLite
>
> **前提**
>
> - `14.12 マイグレーション戦略` を読み、前方互換な変更順序 (追加、二重書き、切替、削除) を説明できる
> - `bash` と `python3` が PATH にあり、`python3 -c 'import sqlite3'` がエラーなく通る
> - `code/ch14/migration-runner/` の下に `migrations/` を作り、`001_create_users.sql` と `002_add_email_index.sql` を自分で用意する。各ファイルは up の SQL、`-- +migrate Down` の行、down の SQL の順に書く
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `up` が未適用のファイルだけを版番号の昇順で適用し、適用したファイル名を1行ずつ出力する
> - [ ] 適用済みの版が `schema_migrations` テーブル (version、filename、applied_at の3列) に記録される
> - [ ] 同じ `up` を2回続けて実行しても2回目は何も適用せず、スキーマが変わらない
> - [ ] `down` が最後に適用した1件だけを巻き戻し、`schema_migrations` から該当行を削除する
> - [ ] `status` が全ファイルを適用済みか未適用かのラベル付きで版番号順に一覧表示する
> - [ ] 巻き戻し用セクションを持たないファイルに対する `down` がエラーで停止し、DBを変更しない
>
> **期待出力**
>
> - 初回の `up` で `applied 001_create_users.sql` と `applied 002_add_email_index.sql` の2行が出る
> - `status` が `up` または `pending` のラベルとファイル名をタブ区切りで版番号順に返す
> - 適用済みが無い状態の `down` が `nothing to rollback` の1行だけを出す
>
> **観察項目**
>
> - `sqlite3 app.sqlite3 'SELECT * FROM schema_migrations'` で version / filename / applied_at を確認し、適用順が版番号の昇順であることを見る
> - 巻き戻しセクションの無いファイルで `down` を実行し、エラー終了後にテーブル定義が変わっていないことを確認する
> - ファイル名を `003-add-index.sql` のようにハイフン区切りにしても版番号が認識されることを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `bash code/ch14/migration-runner/solution/main.sh status migrations app.sqlite3` を実行し、自作版と同じ並び・同じラベルになることを比較する
> 2. `up` を2回連続で実行し、2回目の標準出力が空であること (冪等) を確認する
> 3. `sqlite3 app.sqlite3 '.schema users'` を `up` 後と `down` 後に実行し、テーブルの有無が期待どおり切り替わることを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 「ファイル一覧」「適用済み一覧」「その差分」の3つに分けて考える。差分さえ正しく取れれば、あとは順に流すだけになる。
> 2. **構造**: ファイル名から版番号を取り出す正規表現、`CREATE TABLE IF NOT EXISTS schema_migrations`、up と down を区切るマーカー文字列の3つを先に確定させる。マーカーは模範解答と揃えて `-- +migrate Down` (Down の D は大文字) とすること。揃えておかないと、模範解答を自作の migrations へかけたときに down の SQL が up の一部として実行され、作成したばかりのテーブルが落ちる。適用は1ファイル1トランザクションで囲む。
> 3. **実装の要点**: `down` で巻き戻すのは「最後に適用した1件」であって、ファイル一覧の末尾ではない。記録テーブル側を版番号の降順で1件引かないと、途中まで適用した状態で誤ったファイルを巻き戻す。
>
> **本番利用時の警告**
>
> - 1マイグレーションを1トランザクションで囲んでも、DDLをトランザクションでロールバックできないDBMS (MySQLなど) では途中失敗時に中途半端なスキーマが残る。本番では対象DBMSのDDLトランザクション対応を先に確認する
> - `down` による巻き戻しは列削除を伴えばデータを失う。本番の切り戻しは down 実行ではなく、前方互換な追加マイグレーションで行う
>
> **導線**
>
> - 開始地点: `code/ch14/migration-runner/starter/main.sh`
> - 模範解答: `code/ch14/migration-runner/solution/main.sh`
>
> **推定時間の内訳**: マイグレーションファイルの用意15分、upとschema_migrationsの実装30分、downとstatusの実装25分、冪等性と失敗系の確認20分
<!-- handbook:exercise:end -->

**要件**:
- ファイル名規則: `001_create_users.sql`, `002_add_email_index.sql`
- `schema_migrations` テーブルで適用済みを記録
- `up` で順番に適用、`down` でロールバック
- 適用済みを再適用しない冪等性

```bash
$ tsx migrate.ts up
Applying 001_create_users.sql... done
Applying 002_add_email_index.sql... done

$ tsx migrate.ts status
✓ 001_create_users.sql (applied at 2026-05-21 10:30)
✓ 002_add_email_index.sql (applied at 2026-05-21 10:31)

$ tsx migrate.ts down
Reverting 002_add_email_index.sql... done
```

模範解答: `code/ch14/migration-runner/`

#### 課題14.6: 日時バグを再現して直す (★★★)

**目的**: 14.23 と 14.24 で挙げた日時の誤りを、固定の条件で再現し、修正後に再現しなくなることを確かめる。

<!-- handbook:exercise:start {"id":"14.6"} -->
> **演習カード 課題14.6** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - 14.23 UTC、タイムゾーン、DST、カレンダー日 を読み、瞬間・ローカル日時・カレンダー日の3区分を確認する
> - 14.24 DB日時型、定期実行、ユーザー表示 を読み、半開区間と定期実行の実行済み判定キーを押さえる
> - `Intl.DateTimeFormat` の timeZone オプションと formatToParts の戻り値を確認する
> - `code/ch14` で pnpm install 済みで、`pnpm --filter @handbook/ch14 run typecheck` が通る状態にする
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `resolveInstant` が、存在しない時刻を切り替え後へ送り、二度ある時刻では先に訪れるほうを返す
> - [ ] `toPlainDate` と `addCalendarDays` が、タイムゾーンと壁時計を混ぜずにカレンダー日だけを扱う
> - [ ] `fixedDailyRuns` が毎日カレンダー日から解決し直し、DST 開始日以降も現地の希望時刻を保つ
> - [ ] `fixedIsOverdue` が判定用タイムゾーンの日付どうしを比較し、`fixedCountForDay` が半開区間で数える
> - [ ] `runFindings` が期待値を直書きせず、naive と fixed の結果の差から再現の有無を判定する
> - [ ] `pnpm --filter @handbook/ch14 exec tsx datetime-pitfalls/starter/report.ts` が6行の要約を出力する
>
> **期待出力**
>
> - 1行目に `naive implementation: 4/4 bugs reproduced` が出る
> - D1 の行が `naive drift days=3 / fixed drift days=1` になり、修正後のずれが切り替え日の1件だけに収まる
> - D2 の行が `naive overdue=true / fixed overdue=false` になる
> - D3 の行が `naive local=2026-11-01 19:00 / fixed local=2026-11-01 20:00` になる
> - D4 の行が `naive count=3 / fixed count=4` になり、最終行が `fixed implementation: 0/4 bugs remaining` になる
>
> **観察項目**
>
> - `TZ=UTC`、`TZ=Asia/Tokyo`、`TZ=America/New_York` の3通りで report を実行し、出力が変わらないことを確認する
> - `FIXTURES.springPlan.timeZone` を `Australia/Sydney` に、startDate を切り替え日の前後へ変えて、南半球では DST の向きが逆になることを確認する
> - `resolveInstant` の候補選択を、二度ある時刻で後に訪れるほうへ変え、D1 と D3 の結果がどう動くかを見る
> - `fixedCountForDay` の終端を半開区間から閉区間へ変え、境界の1件が二重に数えられることを確認する
> - `FIXTURES.plainZone` を `Pacific/Honolulu` に変え、D2 と D4 のずれる向きが逆になることを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch14 exec tsx datetime-pitfalls/solution/report.ts` を実行し、6行の要約が出力されることを確認する
> 2. `pnpm --filter @handbook/ch14 run test` を実行し、local time resolution と the four datetime bugs の2つのテストが pass することを確認する
> 3. 自分の `datetime-pitfalls/starter/report.ts` を実行し、solution と同じ出力になるかで自己採点する
> 4. `pnpm --filter @handbook/ch14 run typecheck` が 0 エラーで終わることを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 最初に resolveInstant を通す。残る3つの修正実装はすべてこの関数の上に載るため、ここが誤っていると原因の切り分けができなくなる。
> 2. **構造**: 日時を3つの型として扱う。瞬間は Date、ローカル日時は year から minute までの数値の組、カレンダー日は YYYY-MM-DD の文字列に固定する。関数の引数と戻り値をこの3つのどれかに揃えると、変換の抜けが型として現れる。
> 3. **実装の要点**: resolveInstant では、naive を UTC として解釈した値から前後1日のオフセットを取り、それぞれで候補を作る。候補が自分自身のオフセットと辻褄が合うかを検査し、2つ残れば二度ある時刻、0個なら存在しない時刻である。1回の推定だけで済ませると、切り替えの前後で1時間ずれる。
>
> **本番利用時の警告**
>
> - この実装は分単位までしか扱わず、秒とミリ秒、うるう秒の平滑化、歴史的なオフセット変更の一部を無視している。本番では標準ライブラリまたは実績のある日時ライブラリを使う。
> - IANA tz database は更新されるため、遠い未来の日付についてはここで得た結果が後で変わりうる。保存済みの未来の予定を再計算する手順を運用側で用意する必要がある。
> - `Intl.DateTimeFormat` の結果は実行環境の ICU データに依存する。Node.js、ブラウザ、データベースで版がずれていると、同じ入力に対して異なる結果になりうる。
>
> **導線**
>
> - 開始地点: `code/ch14/datetime-pitfalls/starter/main.ts`
> - 模範解答: `code/ch14/datetime-pitfalls/solution/main.ts`、`code/ch14/datetime-pitfalls/solution/report.ts`
>
> **推定時間の内訳**: resolveInstant とカレンダー日ユーティリティの実装に45分、4つの修正実装に45分、runFindings の判定設計に25分、タイムゾーンを変えた観察に35分。
<!-- handbook:exercise:end -->

**題材**: DST のある `America/New_York` と、DST のない `Asia/Tokyo` を使う。判定はすべて固定の日時に基づき、実行時の現在時刻とプロセスのタイムゾーンに依存しない。

**要件**: `code/ch14/datetime-pitfalls/starter/main.ts` に次を実装する。

1. `resolveInstant` ― ローカル日時とタイムゾーンIDから瞬間を求める。存在しない時刻と二度ある時刻を、候補の妥当性判定で区別する。
2. `toPlainDate` / `addCalendarDays` ― カレンダー日の取り出しと加算。壁時計もタイムゾーンも関与させない。
3. `fixedDailyRuns` / `fixedIsOverdue` / `fixedNextDaySameTime` / `fixedCountForDay` ― 4つの誤りに対応する修正実装。
4. `runFindings` ― `naive*` と `fixed*` の結果の差から、誤りの再現と解消を判定する。

再現する4件は次のとおりで、`naive*` として仕込んである。

| 番号 | 誤り | 現れ方 |
|---|---|---|
| D1 `dst-skipped-run` | 初回の瞬間に 24時間 を足し続ける | DST 開始日以降、現地の実行時刻が1時間ずれ続ける |
| D2 `calendar-day-as-instant` | 締切日を UTC の 00:00 とみなす | 東側の地域で、締切日の当日の朝から期限切れになる |
| D3 `add-24h-vs-add-1-day` | 「翌日の同じ時刻」を 24時間 の加算で表す | DST 終了日に壁時計が1時間戻る |
| D4 `daily-bucket-boundary` | UTC の日境界で集計する | 利用者の「その日」と件数が一致しない |

**評価基準**:

- `naive` 側で4件すべてが再現し、`fixed` 側で1件も残らない
- D1 で、修正実装のずれが切り替え日の1件だけに収まる (存在しない時刻の解決規則によるもので、誤りではない)
- `TZ` 環境変数を変えても出力が変わらない

```text
naive implementation: 4/4 bugs reproduced
  D1 dst-skipped-run: naive drift days=3 / fixed drift days=1
  D2 calendar-day-as-instant: naive overdue=true / fixed overdue=false
  D3 add-24h-vs-add-1-day: naive local=2026-11-01 19:00 / fixed local=2026-11-01 20:00
  D4 daily-bucket-boundary: naive count=3 / fixed count=4
fixed implementation: 0/4 bugs remaining
```

模範解答: `code/ch14/datetime-pitfalls/solution/`

---

#### 課題14.7: 個人データの削除・保持・エクスポート・同意の抜けを再現して塞ぐ (★★★)

**目的**: 14.25 の所在一覧と 14.26 の削除・保持・エクスポート・同意の設計が欠けた状態を実際に再現し、一覧を入力にした実装へ差し替えると同じ検査が1件も引っかからなくなることを確かめる。

<!-- handbook:exercise:start {"id":"14.7"} -->
> **演習カード 課題14.7** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - 14.25 個人データの収集と保存 を読み、所在一覧が削除とエクスポートの入力になる理由を確認する
> - 14.26 保持期間、削除、エクスポート を読み、削除を伝播として設計する意味と、消せないものの扱いを押さえる
> - 28.14 Web に関わる主要規制 を読み、制度によって要求が異なることを前提として確認する
> - `code/ch14` で pnpm install 済みで、`pnpm --filter @handbook/ch14 run typecheck` が通る状態にする
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `fixedErase` が INVENTORY を入力にし、一覧にあって未対応の場所があれば例外で落ちる
> - [ ] `fixedErase` が場所ごとに delete / anonymize / retain を使い分け、再実行しても結果が変わらない
> - [ ] `fixedPurge` が expired の対象から識別項目を落とし、1回あたりの件数に上限を持つ
> - [ ] `fixedExport` が exportable な場所から本人の行だけを集め、スレッド単位で集めない
> - [ ] `fixedDispatch` が配信の直前に同意の正本を引き、撤回済みの主体を除く
> - [ ] `pnpm --filter @handbook/ch14 exec tsx data-lifecycle/starter/report.ts` が6行の要約を出力する
>
> **期待出力**
>
> - 1行目に `naive lifecycle: 4/4 gaps reproduced` が出る
> - P1 の行の naive が `residual=10` で、fixed が `residual=0 at=[]` になる
> - P2 の行が `naive expired-left=4 purged=0 / fixed expired-left=0 purged=4` になる
> - P3 の行が `naive rows=6 foreign=1 missing=0 / fixed rows=9 foreign=0 missing=0` になる
> - 最終行が `fixed lifecycle: 0/4 gaps remaining (other subject intact)` になる
>
> **観察項目**
>
> - INVENTORY から search.users の行を外し、P1 が再現に戻る (fixed residual=1 at=[search.users]) ことを確認する
> - db.orders の erasure を retain に変え、P1 が再現に戻る (fixed residual=1 at=[db.orders]) ことを確認する
> - `fixedPurge` のデフォルト limit を 2 にし、P2 が再現に戻る (fixed expired-left=2 purged=2) ことを確認する
> - `fixedExport` をスレッド単位の集め方へ戻し、P3 が再現に戻る (fixed foreign=1) ことを確認する
> - `fixedDispatch` から consentActive の照合を外し、P4 が再現に戻る (fixed sent=[S1, S2]) ことを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch14 exec tsx data-lifecycle/solution/report.ts` を実行し、6行の要約が出力されることを確認する
> 2. `pnpm --filter @handbook/ch14 run test` を実行し、data lifecycle の6件のテストが pass することを確認する
> 3. 自分の `data-lifecycle/starter/report.ts` を実行し、solution と同じ出力になるかで自己採点する
> 4. `pnpm --filter @handbook/ch14 run typecheck` が 0 エラーで終わることを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 所在一覧を、文書ではなくコードの入力にする。削除もエクスポートも一覧を走査する形にしておくと、場所が1つ増えたときに実装が追いついていないことを起動時に検出できる。追いついていない状態で静かに成功するのが、この領域で最も高くつく失敗である。
> 2. **構造**: 削除を1種類の操作だと考えない。行ごと消せるもの、識別項目だけを落とすもの、そのまま残すものの3種類がある。監査ログと取引記録がどれに当たるかは業務と制度で決まるため、コードでは種別を一覧から受け取り、判断そのものは持たない。
> 3. **実装の要点**: エクスポートの範囲は「本人の行かどうか」で決める。スレッドや共有空間の単位で集めると、要求に応じたつもりで第三者の情報を渡すことになる。逆に、実装した時点の表だけを対象にすると、あとから追加された場所が漏れる。どちらも一覧を入力にすれば同じ仕組みで防げる。
>
> **本番利用時の警告**
>
> - このコードは本番のデータベース、レプリカ、バックアップに対して実行してはならない。削除は元へ戻せない。
> - データはすべて架空の値であり、実在の個人を示すものではない。本番から採取した実データをテストの固定値へ持ち込むと、リポジトリの履歴に永久に残る。
> - どのデータをどこまで消す義務があるか、何を残す義務があるか、「削除しました」と説明してよい範囲はどこまでかは、法域・業種・契約によって異なる。本課題は法的助言ではない。判断は法務および専門家に確認する (14.26、28.14、30.16)。
>
> **導線**
>
> - 開始地点: `code/ch14/data-lifecycle/starter/main.ts`
> - 模範解答: `code/ch14/data-lifecycle/solution/main.ts`、`code/ch14/data-lifecycle/solution/report.ts`
>
> **推定時間の内訳**: INVENTORY と world の読解30分、fixedErase の伝播40分、fixedPurge と fixedExport 40分、fixedDispatch と観察40分
<!-- handbook:exercise:end -->

**題材**: データはすべて架空の値であり、実在の個人を示さない。プロセス外へは何も書き出さない。9か所の保存場所 (主テーブル、取引記録、共有スレッド、監査ログ、検索インデックス、分析基盤、オブジェクトストレージ、外部SaaS、アクセスログ) を持つ `World` と、場所ごとの保持期間・エクスポート可否・削除のしかたを持つ `INVENTORY`、そして目的ごとの同意記録を用意してある。判定は固定の基準時刻を使い、現在時刻に依存しない。

**要件**: `code/ch14/data-lifecycle/starter/main.ts` に次の4つを実装する。

1. `fixedErase(world, subjectId)` ― `INVENTORY` を入力にして削除を伝播させる。一覧にあって未対応の場所があれば例外で落とす。場所ごとに `delete` / `anonymize` / `retain` を使い分け、再実行しても結果が変わらないようにする。
2. `fixedPurge(world, at, limit)` ― 期限切れの行から識別項目を落とす。1回あたりの件数に上限を置く。
3. `fixedExport(world, subjectId)` ― `exportable` な場所から、本人の行だけを集める。スレッド単位で集めない。
4. `fixedDispatch(world, consents, at)` ― 配信の直前に同意の正本を引く。

再現する4件は次のとおりである。

| 番号 | 誤り | `naive` で起きること |
|---|---|---|
| P1 `delete-not-propagated` | 主テーブルと外部キーで辿れる範囲だけを消す | 検索インデックス、分析基盤、ストレージ、外部SaaS、ログに10行が残る |
| P2 `retention-not-enforced` | 保持期間を文書にだけ書き、実行するものが無い | 期限を過ぎた4行がそのまま残り続ける |
| P3 `export-includes-others` | 本人が参加したスレッドを丸ごと書き出す | 他人が書いた連絡先を含む1行が、本人向けの書き出しに混ざる |
| P4 `consent-revoked-but-sent` | 配信バッチが同意の正本ではなく、更新されていない列を見ている | 撤回済みの主体へ配信が続く |

P1 の `db.orders` と `db.audit_log` は、行ごと消さずに識別項目だけを落とす扱いにしてある。取引記録と監査ログを消してよいかは制度と業務で決まるため、コード側は一覧から受け取った種別に従うだけにする、という形を取っている。

**評価基準**:

- 同じ `runFindings` が、`naive` 側では 4/4、`fixed` 側では 0/4 になる
- `fixedErase` が2回実行しても結果を変えない (冪等)
- 一覧にあって未対応の場所があるとき、`fixedErase` と `fixedExport` が静かに成功せず例外で落ちる
- `fixedExport` が他人の行を含まず、かつ本人が入力した内容を落とさない
- もう1人の利用者 (S2) のデータが巻き添えで消えず、同意が生きている限り配信も続く

```text
naive lifecycle: 4/4 gaps reproduced
  P1 delete-not-propagated: naive residual=10 at=[analytics.events, db.audit_log, log.requests, saas.crm, search.users, storage.uploads] / fixed residual=0 at=[]
  P2 retention-not-enforced: naive expired-left=4 purged=0 / fixed expired-left=0 purged=4
  P3 export-includes-others: naive rows=6 foreign=1 missing=0 / fixed rows=9 foreign=0 missing=0
  P4 consent-revoked-but-sent: naive sent=[S1, S2] / fixed sent=[S2]
fixed lifecycle: 0/4 gaps remaining (other subject intact)
```

模範解答: `code/ch14/data-lifecycle/solution/`

<!-- handbook:code-usage:start {"chapter":14} -->
### 第14章のコード集の使い方

<!-- handbook:generated; do not edit -->

コード集は pnpm ワークスペースとして構成してある (CODE_TOOLCHAIN.md)。依存はリポジトリ最上位で一度だけ解決し、章ごとの操作は `--filter` でワークスペースを指定する。

```bash
# 初回のみ。リポジトリ最上位で実行する
pnpm install

# 第14章の模範解答をまとめて検証する
pnpm --filter @handbook/ch14 run test

# 模範解答を個別に実行する
pnpm --filter @handbook/ch14 exec tsx btree.solution.ts                       # 課題14.1
pnpm --filter @handbook/ch14 exec tsx transaction-isolation/solution/main.ts  # 課題14.2
pnpm --filter @handbook/ch14 exec tsx n-plus-one/solution/main.ts             # 課題14.3
pnpm --filter @handbook/ch14 exec tsx mini-orm/solution/main.ts               # 課題14.4
bash code/ch14/migration-runner/solution/main.sh                              # 課題14.5
pnpm --filter @handbook/ch14 exec tsx datetime-pitfalls/solution/main.ts      # 課題14.6
pnpm --filter @handbook/ch14 exec tsx data-lifecycle/solution/main.ts         # 課題14.7
```

開始地点は模範解答と同じ場所に置いてある (`<name>.ts` と `<name>.solution.ts`、またはディレクトリ課題の `starter/` と `solution/`)。課題ごとの完成条件と採点手順は本節の演習カードと `code/ch14/README.md` にある。模範解答の多くは関数を export するだけで、実行して意味のある出力が出るかどうかは課題によって異なる。まず `run test` で通し、個別実行は演習カードのテスト方法に従う。
<!-- handbook:code-usage:end -->


ここまでで、関係を持つ業務データを正しく保存し、同時実行下で更新し、性能とスキーマ進化を運用する基準が揃った。加えて、テナント境界をポリシーとして宣言し、共有資源の偏りを抑え、日時を瞬間・ローカル日時・カレンダー日として区別する判断も、この章の設計に含まれるようになった。ただし、すべてのデータが結合と強い整合性を中心に設計されるわけではない。次章では、アクセスの形や分散時の優先順位を変えると、どの別モデルが必要になるかを比較する。

---

<a id="chapter-15"></a>
## 第15章 NoSQLとデータモデリング

第14章では、RDBが制約、結合、トランザクションによって多くの業務データを安全に扱えることを確認した。一方で、単一キーへの極端に多いアクセス、階層的な文書、巨大な分散配置、深い関係探索、ネットワーク分断中の継続書き込みなどでは、正規化された表と強い整合性が最優先とは限らない。

本章では、RDBを捨てるのではなく、データの形、読み書き経路、整合性、遅延、障害時挙動のどれを変えると別の選択肢が必要になるかを整理する。KVS、ドキュメント、ワイドカラム、グラフ、時系列、地理空間、CRDT (Conflict-free Replicated Data Type) をRDBとの比較で読み、専用ストアを増やす前にPostgreSQLで満たせる範囲も確認する。保存方式を選べるようになった後、第16章では、保存場所にかかわらず「語句や意味から探す」ための別の索引を扱う。

<!-- handbook:chapter-guide:start {"chapter":15} -->
> **この章の学習ガイド**
>
> **解決する実務上の問題**  
> RDB以外を流行やスケールの印象で選ばず、アクセスパターン、整合性、障害時挙動からデータストアを選ぶ。
>
> **到達目標**
> - KVS、ドキュメント、列指向、グラフのモデル差を説明できる。
> - CAP/PACELCと結果整合性を具体的な操作へ結び付けられる。
> - PostgreSQLを含む候補をアクセスパターンで比較できる。
>
> 到達目標は章全体に対するものである。標準通読ルートは必修節だけを読むため、下の「中核概念」に (実務選択) (発展) (展望) と付いた節がある章では、その節を読むまで到達目標の一部が埋まらない。必修節を読み終えた時点で説明できない項目があれば、まず付記のある節へ進む。
>
> **前提知識**
> - [14.1 リレーショナルモデルの考え方](#section-14-1) ― リレーショナルモデル
> - [14.6 ACIDとトランザクション](#section-14-6) ― トランザクション
>
> **中核概念**  
> [15.1 NoSQL の4分類](#section-15-1)、[15.2 Redis ― 最も使われるKVS](#section-15-2)、[15.4 DynamoDB ― クラウドネイティブ KV](#section-15-4) (実務選択)、[15.5 CAP 定理と PACELC](#section-15-5)、[15.6 結果整合性 (Eventual Consistency)](#section-15-6)、[15.8 PostgreSQL でどこまで戦えるか](#section-15-8)
>
> **最小実装**  
> [15.12 実装課題 ― NoSQL の核を実装する](#section-15-12) (実務選択)
>
> **本番実装との差分**
> - 教材KVSやCRDTは分散合意、永続化、リバランス、監視、アクセス制御を省略する。
>
> **典型的な失敗**
> - NoSQLをスキーマレスと考え契約を管理しない。
> - 結果整合性で許されない業務不変条件を扱う。
> - 単一クエリだけで将来の運用を決める。
>
> **診断・デバッグ方法**
> - 読み取り整合性、レプリカ遅延、パーティション、hot keyを計測する。
> - 失敗時のリトライと重複を書き込み履歴で確認する。
>
> **意思決定チェックリスト**
> - 主要アクセスパターンと更新競合は何か。
> - 強整合性が必要な不変条件はどこか。
>
> **演習と評価基準**  
> 対象: [15.12 実装課題 ― NoSQL の核を実装する](#section-15-12) (実務選択)
> - 同一モデルをRDBとNoSQLで表現し、失う保証を説明できる。
>
> **一次資料・発展資料**
> - DynamoDB documentation
> - Redis documentation
> - MongoDB documentation
> - CAP/PACELC primary literature
<!-- handbook:chapter-guide:end -->

<a id="section-15-1"></a>
### 15.1 NoSQL の4分類
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"C","term":"Cassandra"} -->
<!-- handbook:index {"group":"N","term":"NoSQL"} -->

<!-- handbook:narrative-bridge {"section":"15.1"} -->
RDBが広い範囲の要件を満たすからこそ、別のストアを選ぶときは「大量データだから」ではなく、どの性質を変えたいかを明確にする必要がある。NoSQLの分類は、キー、文書、列、関係というアクセスの中心を比較するための地図になる。

| 分類 | 代表 | 用途 |
|---|---|---|
| Key-Value | Redis、Memcached、DynamoDB | キャッシュ、セッション、KV単純検索 |
| Document | MongoDB、Couchbase、Firestore | スキーマレス、ネスト構造 |
| Wide-column | Cassandra、HBase、ScyllaDB | 大量書き込み、時系列 |
| Graph | Neo4j、ArangoDB、Neptune | ソーシャル、レコメンド、知識グラフ |

それぞれの特性を見ていく。

<a id="section-15-2"></a>
### 15.2 Redis ― 最も使われるKVS
<!-- handbook:learning {"level":"required","minutes":15} -->
<!-- handbook:index {"group":"R","term":"Redis"} -->
<!-- handbook:index {"group":"ら行","term":"レート制限"} -->

<!-- handbook:narrative-bridge {"section":"15.2"} -->
複雑な結合や任意条件検索が不要で、既知のキーから短時間で値を取得したい場合、RDBの汎用性は過剰になることがある。Redisは単純なKVSに有効期限、原子的操作、データ構造を加え、キャッシュや一時状態を低遅延で扱う。

Redis は単なる KVS ではなく、**インメモリのデータ構造サーバ**だ。文字列、リスト、ハッシュ、集合、ソート済み集合、ストリーム、地理空間 ― 多様なデータ型を持つ。

```typescript
import { createClient } from 'redis';

const client = await createClient().connect();

// 文字列
await client.set('greeting', 'Hello');
await client.expire('greeting', 60);  // 60秒で期限切れ
const v = await client.get('greeting');

// ハッシュ (フィールド付き)
await client.hSet('user:42', { name: 'Alice', age: '30' });
const name = await client.hGet('user:42', 'name');

// リスト (両端キュー)
await client.lPush('queue', 'job-1');
await client.lPush('queue', 'job-2');
const job = await client.rPop('queue');  // FIFO

// 集合
await client.sAdd('online:users', 'alice', 'bob');
const isOnline = await client.sIsMember('online:users', 'alice');

// ソート済み集合 (リーダーボード等)
await client.zAdd('leaderboard', [
  { score: 100, value: 'alice' },
  { score: 250, value: 'bob' },
]);
const top10 = await client.zRange('leaderboard', 0, 9, { REV: true });

// パブサブ
const subscriber = client.duplicate();
await subscriber.connect();
await subscriber.subscribe('channel', (message) => {
  console.log(message);
});
await client.publish('channel', 'hello');
```

**Redis の典型用途:**

1. **キャッシュ**: DB結果を一定時間保存し、再計算を避ける
2. **セッションストア**: スケールアウト時の共有セッション
3. **レート制限**: `INCR` + `EXPIRE` でシンプルに実装
4. **キュー**: `LPUSH` + `BRPOP` で簡易ジョブキュー
5. **リーダーボード**: ソート済み集合 (`ZADD`、`ZRANGE`)
6. **分散ロック**: `SET NX` (RedLock アルゴリズム)
7. **PubSub**: リアルタイム通知

**簡単なレート制限:**

```typescript
async function rateLimit(userId: string, limit: number, windowSec: number): Promise<boolean> {
  const key = `rate:${userId}`;
  const count = await client.incr(key);
  if (count === 1) {
    await client.expire(key, windowSec);
  }
  return count <= limit;
}

// 使う
if (!await rateLimit('user-42', 100, 60)) {
  return res.status(429).json({ error: 'Too many requests' });
}
```

**注意**: Redisは主にメモリ上で動作するが、RDBスナップショットやAOFを構成できる。 耐久性は`appendfsync`、レプリケーション、フェイルオーバー、バックアップによって変わり、設定次第では直近の書き込みを失いうる。`maxmemory`とeviction policyを明示し、Redisを唯一の正本にするかは復旧要件から判断する。

<a id="section-15-3"></a>
### 15.3 MongoDB ― ドキュメント DB
<!-- handbook:learning {"level":"practical","minutes":10} -->
<!-- handbook:index {"group":"M","term":"MongoDB"} -->

<!-- handbook:narrative-bridge {"section":"15.3"} -->
キーだけでは、プロフィールや商品カタログのように入れ子構造を一まとまりで読み書きするデータを自然に表せない。ドキュメントDBは集約単位をJSONに近い形で保存し、結合の代わりに一括取得とスキーマ柔軟性を優先する。

MongoDB は JSON ライクな BSON ドキュメントを格納する。スキーマレスで開発初期は楽だが、本番で「実は暗黙のスキーマが存在する」ことに気づく。

```typescript
import { MongoClient } from 'mongodb';

const client = new MongoClient('mongodb://localhost:27017');
const db = client.db('myapp');
const users = db.collection('users');

// 挿入
await users.insertOne({
  email: 'alice@example.com',
  name: 'Alice',
  preferences: {  // ネスト可
    theme: 'dark',
    notifications: { email: true, push: false },
  },
  tags: ['premium', 'beta'],
});

// 検索
const user = await users.findOne({ email: 'alice@example.com' });

// ネスト検索
const darkTheme = await users.find({ 'preferences.theme': 'dark' }).toArray();

// 配列検索
const beta = await users.find({ tags: 'beta' }).toArray();

// 更新
await users.updateOne(
  { _id: user._id },
  { $set: { 'preferences.theme': 'light' }, $push: { tags: 'vip' } }
);

// 集計パイプライン (SQL の GROUP BY に相当)
const stats = await users.aggregate([
  { $match: { tags: 'premium' } },
  { $group: { _id: '$preferences.theme', count: { $sum: 1 } } },
  { $sort: { count: -1 } },
]).toArray();
```

**MongoDB の向き不向き:**

向き:
- スキーマが定まらない初期段階
- ネスト構造を持つドキュメント (記事 + コメント + リアクション 等)
- 大量の単純な読み書き
- 地理空間検索 (`$geoNear`)

不向き:
- 強い整合性が必要な金銭処理 (※トランザクションはサポートされたが性能注意)
- 複雑な結合 (`$lookup` はあるが SQL の JOIN より制限的)
- 集計を多用するBI系処理 (Aggregation Pipeline は強力だが学習コスト)

MongoDBにもPostgreSQL+JSONBにも得意・不得意がある。関係制約、結合、トランザクション、柔軟なドキュメント、分散・運用要件を比較し、JSONBを「万能解」として無制限に使わない。頻繁に検索・更新する属性には型付き列や適切なインデックスを検討する。

<a id="section-15-4"></a>
### 15.4 DynamoDB ― クラウドネイティブ KV
<!-- handbook:learning {"level":"practical","minutes":10} -->
<!-- handbook:index {"group":"D","term":"DynamoDB"} -->
<!-- handbook:index {"group":"S","term":"Single-Table Design (DynamoDB)"} -->

<!-- handbook:narrative-bridge {"section":"15.4"} -->
文書を一まとまりで扱えても、世界規模の負荷を多数ノードへ予測可能に分散するには、パーティションキーと容量設計を先に決める必要がある。DynamoDBはアクセスパターンを起点にキーを設計し、管理された分散KVSとしてスケールを引き受ける。

AWS DynamoDB はマネージドな分散KVストア。設計思想がRDBやMongoDBと根本的に違う。

**特徴:**

- **アクセスパターン先行**: 主キー、ソートキー、GSI/LSIを、必要な問い合わせから逆算する
- **マネージドな水平分散**: パーティションは自動管理されるが、ホットパーティション、項目サイズ、スループットモード、クォータは設計対象
- **低レイテンシを狙う**: 実測値はリージョン、項目サイズ、整合性、負荷、リトライで変わる
- **問い合わせに制約**: `Query`はキー条件中心だが、二次インデックス、`Scan`、トランザクションもある。任意のJOINや集計の代替ではない
- **整合性を選ぶ**: テーブルとLSIは強い整合性読み取りを選べるが、GSIとStreamsは結果整合性。トランザクションAPIは複数項目のACID操作を提供する

```typescript
// テーブル設計が肝
// パーティションキー: PK = "USER#42"
// ソートキー:        SK = "PROFILE" or "POST#abc" or "ORDER#2025-01-01#xxx"

// 1ユーザーの全データ
await client.query({
  TableName: 'app',
  KeyConditionExpression: 'PK = :pk',
  ExpressionAttributeValues: { ':pk': 'USER#42' },
});

// あるユーザーの最近の投稿10件
await client.query({
  TableName: 'app',
  KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
  ExpressionAttributeValues: { ':pk': 'USER#42', ':sk': 'POST#' },
  ScanIndexForward: false,
  Limit: 10,
});
```

DynamoDB の **Single-Table Design** は強力だが、習得難度が高い。AWS re:Invent の Single-Table Design セッションが最もまとまった入門になる。

<a id="section-15-5"></a>
### 15.5 CAP 定理と PACELC
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"C","term":"CAP定理"} -->
<!-- handbook:index {"group":"C","term":"Cassandra"} -->
<!-- handbook:index {"group":"P","term":"PACELC"} -->
<!-- handbook:index {"group":"た行","term":"強い整合性"} -->

<!-- handbook:narrative-bridge {"section":"15.5"} -->
複数ノードへ複製すると、ネットワーク分断中に全ノードの合意を待つか、応答を継続するかを同時には満たせない。CAPとPACELCは製品を分類する標語ではなく、障害時と平常時に整合性、可用性、遅延のどれを選ぶかを言語化する枠組みである。

ネットワーク分断が起こりうる系では、分断中にCとAを同時には満たせない [Brewer, 2000] [Gilbert and Lynch, 2002]:

- **Consistency**: CAPでいうCは、各操作が単一の最も新しいコピーに対して行われたように見える性質 (線形化可能性)
- **Availability**: 分断されていない任意のノードへの要求が、成功または失敗の応答を有限時間で返すという形式的性質
- **Partition tolerance**: ノード間メッセージが失われるネットワーク分断をモデルに含める

分断中は、同じ操作・同じ構成でCとAを同時に完全には満たせない。製品を一語で「CP/AP」と固定せず、読み書き方式、クォーラム、整合性レベル、フェイルオーバー設定、対象操作ごとに評価する。

**PACELC** はより現実的な拡張 [Abadi, 2012]: ネットワーク分断 (Partition) があるときは A vs C を選び、なくても (Else) L (Latency) vs C を選ぶ。

「**PostgreSQL は ACID で完璧でしょ?**」と思うかもしれないが、レプリケーション (リードレプリカ等) を始めた瞬間、PACELCの問題に直面する。同期レプリケーションは遅延、非同期はラグ。完璧な解はない。データ分散の設計原理は Kleppmann の体系書 [Kleppmann, 2017] で網羅的に学べる。

<a id="section-15-6"></a>
### 15.6 結果整合性 (Eventual Consistency)
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"C","term":"CRDT (Conflict-free Replicated Data Type)"} -->

<!-- handbook:narrative-bridge {"section":"15.6"} -->
可用性や低遅延を優先して複製先の同期待ちを減らすと、読み手が一時的に古い値を見る可能性が生じる。結果整合性を採用するなら、「いつか一致する」だけでなく、競合解決、read-your-writes、リトライ時の意味を設計しなければならない。

分散データストアの一部は、可用性やレイテンシとの交換で結果整合性の読み取りを提供する。製品によっては操作ごとに強い整合性、因果整合性、セッション保証、結果整合性を選べるため、「NoSQL=結果整合性」とは限らない。

例: Twitter の「いいね」数。1秒前のあなたの「いいね」が、別ユーザーのタイムラインにすぐ反映されなくても、サービスは破綻しない。

逆に、銀行残高には強い整合性が必要。10秒前の振込が反映されていない残高表示は許されない。

**結果整合性が許されるかは業務ドメインで決まる**。技術選定の前に、ビジネス要件を確認する必要がある。

<a id="section-15-7"></a>
### 15.7 Neo4j ― グラフDB
<!-- handbook:learning {"level":"practical","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"15.7"} -->
キー、文書、表は対象そのものを取り出すには強いが、友人の友人や依存関係の経路を何段も辿る問いでは結合やアプリ側反復が増える。グラフDBは関係を第一級の要素として保存し、可変長の探索を中心に据える。

「**友達の友達**」「**ある記事を読んだ人が他に読んでいる記事**」のようなクエリは、SQLでは多段 JOIN が必要で重い。グラフ DB は最初からこれを高速化するために設計されている。

```cypher
// Cypher (Neo4j のクエリ言語)
// Alice の友達の友達 (2 hops)
MATCH (alice:User {name: 'Alice'})-[:FRIEND]->(:User)-[:FRIEND]->(fof:User)
WHERE NOT (alice)-[:FRIEND]->(fof) AND alice <> fof
RETURN fof.name, COUNT(*) AS commonFriends
ORDER BY commonFriends DESC
LIMIT 10;
```

ソーシャル、レコメンデーション、知識グラフ、不正検知 (関連するアカウントの探索) などに強い。一般のWebアプリでは滅多に使わないが、特定領域で唯一の選択肢になる。

<a id="section-15-8"></a>
### 15.8 PostgreSQL でどこまで戦えるか
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"J","term":"JSONB (PostgreSQL)"} -->
<!-- handbook:index {"group":"L","term":"LISTEN/NOTIFY"} -->
<!-- handbook:index {"group":"P","term":"pgvector"} -->
<!-- handbook:index {"group":"P","term":"PostgreSQL"} -->

<!-- handbook:narrative-bridge {"section":"15.8"} -->
専用モデルは特定の問いを簡潔にする一方、ストアごとにバックアップ、監視、権限、障害対応が増える。新しいDBを導入する前に、JSONB、配列、全文検索、拡張機能を持つPostgreSQLで要件を満たせるかを比較する必要がある。

「とりあえず PostgreSQL でいい」は2026年現在、極めて妥当な戦略になっている。

- **JSONB**: ドキュメント DB として使える
- **配列型**: タグなど多値属性
- **全文検索**: `tsvector`、`pg_trgm` (基礎レベルなら ES 不要)
- **GIS**: PostGIS で地理空間
- **時系列**: TimescaleDB 拡張
- **ベクトル検索**: pgvector (LLM 時代の必須)
- **ジョブキュー**: SKIP LOCKED で簡易キュー
- **PubSub**: LISTEN/NOTIFY

PostgreSQL を主に、Redis をキャッシュとして併用する ― この2つで足りるWebアプリは多い。NoSQL を増やすのは、特定のスケールやワークロードでPostgreSQLが限界に達してから。

<a id="section-15-9"></a>
### 15.9 時系列データベース ― メトリクスとイベントの定石
<!-- handbook:learning {"level":"practical","minutes":15} -->
<!-- handbook:index {"group":"C","term":"Continuous Aggregates"} -->
<!-- handbook:index {"group":"T","term":"TimescaleDB"} -->
<!-- handbook:index {"group":"さ行","term":"時系列DB"} -->

<!-- handbook:narrative-bridge {"section":"15.9"} -->
業務レコードとは別に、メトリクスやセンサー値は時刻順に追加され、期間集計と保持期限が中心になる。時系列DBは、この書き込み形状を前提にパーティション、圧縮、ダウンサンプリングを組み合わせる。

「**サーバのCPU使用率を1秒間隔で5年間記録**」「**IoTデバイスから秒間100万件のセンサーデータ**」のような時系列データは、通常のRDBに格納すると性能が崩壊する。専用の時系列DB (TSDB: Time Series Database) が必要だ。

#### 時系列データの特性

- **append-only**: 新しいデータがほぼ末尾に追加されるだけ、更新がない
- **タイムスタンプが主軸**: 範囲クエリが主用途
- **古いデータは粒度を落としていい**: 1年前のCPU使用率は1秒精度ではなく1分平均で十分
- **量が膨大**: 1秒刻みで5年分を保持すると、1メトリクス1サーバあたり約1.6億行になる。10メトリクス × 100サーバならその1000倍が積み上がる

#### 代表的なTSDB

- **TimescaleDB**: PostgreSQL拡張、SQL がそのまま使える、PostGISなど他拡張と組み合わせ可能
- **InfluxDB**: 独自クエリ言語 (Flux)、IoT・DevOps メトリクスの定番
- **Prometheus**: メトリクス専用、Pull型、Kubernetes と統合
- **VictoriaMetrics**: Prometheus 互換、より効率的
- **ClickHouse**: 汎用OLAPだが時系列にも強い

#### TimescaleDB の使い方

```sql
-- 拡張を有効化
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- 通常のテーブルを作成
CREATE TABLE metrics (
  time        TIMESTAMPTZ NOT NULL,
  device_id   TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  value       DOUBLE PRECISION
);

-- Hypertable に変換 (時間で自動パーティション)
SELECT create_hypertable('metrics', 'time', chunk_time_interval => INTERVAL '1 day');

-- インデックス
CREATE INDEX ON metrics (device_id, time DESC);

-- データ投入 (通常のINSERTでOK)
INSERT INTO metrics (time, device_id, metric_name, value)
VALUES (NOW(), 'sensor-1', 'temperature', 23.5);

-- 時系列クエリ
SELECT
  time_bucket('1 minute', time) AS bucket,
  device_id,
  AVG(value) AS avg_value,
  MAX(value) AS max_value
FROM metrics
WHERE time > NOW() - INTERVAL '1 hour'
  AND metric_name = 'temperature'
GROUP BY bucket, device_id
ORDER BY bucket DESC;
```

#### Continuous Aggregates ― 自動集計

「**生データは1秒精度で1週間、1分平均は1ヶ月、1時間平均は1年保持**」のようなダウンサンプリングを自動化:

```sql
-- 1分平均を継続的に維持
CREATE MATERIALIZED VIEW metrics_1min
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 minute', time) AS bucket,
  device_id,
  metric_name,
  AVG(value) AS avg_value,
  MAX(value) AS max_value,
  MIN(value) AS min_value
FROM metrics
GROUP BY bucket, device_id, metric_name;

-- ポリシー: 5分ごとに自動リフレッシュ
SELECT add_continuous_aggregate_policy('metrics_1min',
  start_offset => INTERVAL '1 hour',
  end_offset => INTERVAL '5 minutes',
  schedule_interval => INTERVAL '5 minutes');

-- データ保持ポリシー: 1週間を超えた生データを削除
SELECT add_retention_policy('metrics', INTERVAL '7 days');
```

これで「直近は生データで分析、過去は集計済みデータで取得」が自動運用される。保持する行数が減るぶん、ストレージコストも下がる。

<a id="section-15-10"></a>
### 15.10 地理空間データと PostGIS
<!-- handbook:learning {"level":"practical","minutes":15} -->
<!-- handbook:index {"group":"H","term":"H3 (Uber)"} -->
<!-- handbook:index {"group":"P","term":"PostGIS"} -->

<!-- handbook:narrative-bridge {"section":"15.10"} -->
時刻だけでなく、店舗、配送、移動体のように位置と距離が問い合わせの中心になるデータもある。緯度経度を単なる数値列として扱うのではなく、空間型と空間インデックスを使うことで、包含や近傍を正しい幾何として計算できる。

「**ユーザーの近く5km以内の店舗**」「**配送ルートに沿った交通情報**」「**ある住所がどの行政区域に属するか**」 ― これらを扱うのが地理空間DB。

#### PostGIS の基本

PostGIS は PostgreSQL の拡張である。OSS の地理空間データベースとして採用例が多く、測地系の変換、空間索引、距離・包含の演算を一通り備える。

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE stores (
  id      SERIAL PRIMARY KEY,
  name    TEXT,
  -- geography 型: 地球上の点 (WGS84)
  location GEOGRAPHY(POINT, 4326)
);

-- 位置情報の挿入
INSERT INTO stores (name, location) VALUES
  ('渋谷店', ST_MakePoint(139.7016, 35.6595)::geography),
  ('新宿店', ST_MakePoint(139.7036, 35.6896)::geography);

-- 空間インデックス (これがないと全件スキャンになる)
CREATE INDEX idx_stores_location ON stores USING GIST (location);

-- 「ユーザーの近く2km以内」
SELECT id, name, ST_Distance(location, ST_MakePoint(139.69, 35.68)::geography) AS distance_m
FROM stores
WHERE ST_DWithin(location, ST_MakePoint(139.69, 35.68)::geography, 2000)
ORDER BY distance_m
LIMIT 10;
```

#### Polygon (面) との交差判定

```sql
CREATE TABLE delivery_zones (
  id   SERIAL PRIMARY KEY,
  name TEXT,
  area GEOGRAPHY(POLYGON, 4326)
);

INSERT INTO delivery_zones (name, area) VALUES (
  '東京23区',
  ST_GeomFromText('POLYGON((139.6 35.5, 139.9 35.5, 139.9 35.8, 139.6 35.8, 139.6 35.5))', 4326)::geography
);

-- ある住所がどの配送ゾーンに含まれるか
SELECT name FROM delivery_zones
WHERE ST_Contains(area::geometry, ST_MakePoint(139.75, 35.65)::geometry);
```

#### Uber H3 ― 階層的グリッドの活用

Uber が開発した H3 は、地球表面を六角形タイルで覆い、各タイルに ID を振る。これで「**位置を文字列キーで扱う**」「**近傍タイルを高速に列挙**」が可能になる。

```typescript
import { latLngToCell, gridDisk, cellToBoundary } from 'h3-js';

// 緯度経度から H3 セルID (解像度9 のセルは平均辺長 約174m)
const cellId = latLngToCell(35.6595, 139.7016, 9);
console.log(cellId);  // 解像度9 のIDは '89' で始まる。値は手元で確認する

// 近傍 (1ホップ) のセルを取得
const neighbors = gridDisk(cellId, 1);  // 自分 + 周囲6セル
```

リアルタイム位置追跡 (Uber のドライバー検索、配送マッチング) では、各 H3 セルにオブジェクトを Redis Set で登録しておき、近傍セルだけスキャンする ― これで100万台のリアルタイム検索が現実的に。

```typescript
// ドライバーが位置更新するたびに H3 セル登録
async function updateDriverLocation(driverId: string, lat: number, lng: number) {
  const cell = latLngToCell(lat, lng, 9);
  // 旧位置から削除 → 新位置に追加 (簡略化)
  await redis.sadd(`drivers:${cell}`, driverId);
  await redis.set(`driver:${driverId}:pos`, JSON.stringify({ lat, lng, cell }));
}

// 配送リクエスト発生 → 近傍ドライバー検索
async function findNearbyDrivers(lat: number, lng: number, ringSize = 2): Promise<string[]> {
  const centerCell = latLngToCell(lat, lng, 9);
  const cells = gridDisk(centerCell, ringSize);  // 半径 ~340m
  const candidates: string[] = [];
  for (const cell of cells) {
    const drivers = await redis.smembers(`drivers:${cell}`);
    candidates.push(...drivers);
  }
  return candidates;
}
```

PostGIS のクエリより桁違いに速い (O(1) ハッシュ参照)。リアルタイム性が要るユースケースで有効。

<a id="section-15-11"></a>
### 15.11 CRDT ― 衝突なしの分散データ構造
<!-- handbook:learning {"level":"advanced","minutes":25} -->
<!-- handbook:index {"group":"A","term":"Automerge (CRDT)"} -->
<!-- handbook:index {"group":"C","term":"CRDT (Conflict-free Replicated Data Type)"} -->
<!-- handbook:index {"group":"L","term":"Liveblocks (CRDT)"} -->
<!-- handbook:index {"group":"Y","term":"Yjs (CRDT)"} -->
<!-- handbook:index {"group":"ら行","term":"ローカルファースト (CRDT)"} -->

<!-- handbook:narrative-bridge {"section":"15.11"} -->
分散配置やオフライン編集では、同じ値を複数地点が同時に更新し、中央のロックで順序を決められない場合がある。CRDTは許可する操作とマージ規則を制限し、到着順に依存せず同じ状態へ収束させる。

Google Docs、Figma、Notion ― 「**複数人が同時に編集できる**」アプリケーションは、いまや当たり前になった。これを支える技術が **CRDT (Conflict-free Replicated Data Type)** だ。

#### 問題: 分散データの編集衝突

複数クライアントが同時にデータを変更したとき、どう統合するか?

```text
クライアント A: "Hello World" → "Hello Beautiful World"
クライアント B: "Hello World" → "Hello My World"
サーバが両方を受け取った時、結果はどうなる?
```

伝統的アプローチ:

1. **Last-Write-Wins (LWW)**: 後から来た方が勝つ → データロス
2. **Operational Transformation (OT)**: 操作を変換して順序を整える → Google Docs が採用、サーバの中央権威が必要
3. **CRDT**: 定義されたmergeまたは操作適用条件を満たすと、レプリカが同じ更新集合から同じ状態へ収束するデータ構造

State-based CRDTでは状態とmergeが半束の条件を満たす必要があり、operation-based CRDTでは配送順序、重複排除、因果関係など追加条件がある。中央権威なしの同期に使えるが、認可、意図の保存、履歴圧縮、削除、帯域は別問題である。

#### CRDT の種類

CRDT は大きく2系統に分かれる:

- **State-based (CvRDT)**: 全状態を送信、`merge()` 操作で統合
- **Operation-based (CmRDT)**: 操作を送信、各レプリカで再適用

実用上は両者のハイブリッドが多い。

#### 簡単な例: G-Counter (Grow-only Counter)

「**増やすことしかできないカウンタ**」。

```typescript
class GCounter {
  // 各ノードの増分を別々に記録
  private counts: Map<string, number> = new Map();

  constructor(private nodeId: string) {}

  increment(by = 1) {
    this.counts.set(this.nodeId, (this.counts.get(this.nodeId) ?? 0) + by);
  }

  value(): number {
    // 全ノードの合計
    return Array.from(this.counts.values()).reduce((a, b) => a + b, 0);
  }

  merge(other: GCounter) {
    // 各ノードの最大値を取る
    for (const [nodeId, count] of other.counts) {
      this.counts.set(nodeId, Math.max(this.counts.get(nodeId) ?? 0, count));
    }
  }
}

// 使用例
const a = new GCounter('node-a');
const b = new GCounter('node-b');

a.increment();  // a={a:1}
b.increment();  // b={b:1}
b.increment();  // b={b:2}

a.merge(b);     // a={a:1, b:2} → value=3
b.merge(a);     // b={a:1, b:2} → value=3
// どんな順序で merge しても同じ結果
```

「**ノードごとに記録、merge は最大値**」 ― この単純な構造で、任意の順序の更新を吸収できる。

#### 実用的な CRDT: テキスト編集 (Yjs / Automerge)

「同じ位置に2人が同時に文字を挿入したら?」 ― これを解くのが**シーケンス CRDT**。

```typescript
// Yjs を使ったコラボレーティブ編集の例
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

const doc = new Y.Doc();

// WebSocket で他のクライアントと同期
const provider = new WebsocketProvider('wss://collab.example.com', 'room-id', doc);

// 共有テキストデータ
const ytext = doc.getText('content');

// 編集
ytext.insert(0, 'Hello, ');
ytext.insert(7, 'World!');

// 他のクライアントの変更を受け取る
ytext.observe(event => {
  console.log('Text changed:', ytext.toString());
});
```

Yjs は内部で「各文字に一意 ID を振り、その ID で位置を表現」する。これにより、複数の挿入が衝突しても順序が決定的に決まる。

**Yjs の特徴:**

- JavaScript/TypeScriptエコシステムで広く利用され、更新をバイナリ形式で交換できる
- 性能は文書構造、更新履歴、同期パターン、GC設定で変わるため、自分のワークロードで比較する
- React、Vue、CodeMirror、TipTap などとの統合が充実
- TipTap や BlockNote などのエディタライブラリで内部採用

#### 実用的な CRDT: マップ (キー・値ストア)

```typescript
// Yjs Map
const ymap = doc.getMap('users');
ymap.set('alice', { name: 'Alice', age: 30 });
ymap.set('bob', { name: 'Bob', age: 25 });

// 観測
ymap.observe(event => {
  event.changes.keys.forEach((change, key) => {
    if (change.action === 'add') console.log(`Added: ${key}`);
    if (change.action === 'update') console.log(`Updated: ${key}`);
  });
});
```

#### Automerge

Yjs の対抗実装。JSON ライクな API で書ける:

```typescript
import * as Automerge from '@automerge/automerge';

let doc = Automerge.init<{ counter: number; items: string[] }>();
doc = Automerge.change(doc, d => {
  d.counter = 0;
  d.items = [];
});

doc = Automerge.change(doc, d => {
  d.counter++;
  d.items.push('apple');
});

// バイナリ化して他クライアントへ送信
const binary = Automerge.save(doc);

// 受信側でロード・マージ
let remoteDoc = Automerge.load(binary);
const merged = Automerge.merge(doc, remoteDoc);
```

#### Liveblocks ― マネージド CRDT サービス

CRDT サーバを自前運用するのは大変。Liveblocks は「**バックエンドを書かずに協調編集を実装**」できる SaaS:

```typescript
import { createClient, LiveObject, LiveList } from '@liveblocks/client';

const client = createClient({ publicApiKey: PUBLIC_KEY });
const { room } = client.enterRoom('my-room', {
  initialPresence: { cursor: null },
  initialStorage: {
    document: new LiveObject({ title: '', body: '' }),
    comments: new LiveList([]),
  },
});

// 共有データを操作
const storage = await room.getStorage();
storage.root.get('document').set('title', '新しいタイトル');
// → 全ユーザーに即座に伝播
```

導入事例はサービスの公開情報と利用範囲を確認する。協調編集製品が必ずLiveblocksまたは同じCRDT実装を使うとは限らない。

#### CRDT の限界

- **データサイズ**: 編集履歴を内部に持つため、データが膨らみがち (GC が複雑)
- **複雑な制約**: 「全数値の合計が100以下」のようなグローバル制約は表現困難
- **権限・認可**: CRDT 自体は誰が編集していいかを区別しない、上位で実装する必要
- **学習曲線**: 直感的に書けない場面がある

それでも、**ローカルファースト**(オフラインで動き、後で同期) や**P2P**(中央サーバなし) が必要なアプリには不可欠の技術。

#### CRDT の採用判断

| ユースケース | 推奨 |
|---|---|
| 単純な「保存して同期」アプリ | 通常の API + WebSocket で十分 |
| ホワイトボード、コラボエディタ | Yjs |
| オフライン重視のアプリ | Automerge |
| バックエンド書きたくない | Liveblocks |
| 大規模なドキュメント、複雑な構造 | Yjs + 自前バックエンド |

<a id="section-15-12"></a>
### 15.12 実装課題 ― NoSQL の核を実装する
<!-- handbook:learning {"level":"practical","minutes":265} -->

<!-- handbook:narrative-bridge {"section":"15.12"} -->
NoSQLの製品機能を表面的に比較するだけでは、ハッシュ分散、存在判定、複製、競合解決のコストが見えにくい。中核データ構造を実装し、各モデルが何を高速化し、何を利用者へ委ねるかを確認する。

第15章では NoSQL の4分類、CAP/PACELC、CRDT などを見た。本節ではそれらに加えて、分散ストアが内部で使う Bloom Filter と Consistent Hashing も自作する。所要時間: 演習カードの推定時間の合計で8時間30分。

#### 課題15.1: Redis 風 KVS を自作 (★★)

**目的**: TCP プロトコルで KVS を実装し、Redis の構造を体感する。

<!-- handbook:exercise:start {"id":"15.1"} -->
> **演習カード 課題15.1** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: Redis
>
> **前提**
>
> - `15.2 Redis ― 最も使われるKVS` を読み、文字列型の操作とTTLの扱いを把握する
> - Node.js の `node:net` でTCPサーバを作り、`data` イベントの受信バッファを行単位に切り出せる
> - 6379番はコンテナのRedisと衝突しうるため、`PORT=6380` のように別ポートで起動する準備をしておく
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `SET` / `GET` / `DEL` / `EXPIRE` / `PING` / `DBSIZE` を1行入力で処理できる
> - [ ] `SET key value EX 5` でTTLを設定でき、期限切れ後の `GET` が `$-1` を返す
> - [ ] `GET` のヒット時に `$` に続くバイト長と値を返す、RESP の Bulk String 形式になっている
> - [ ] `DEL` が削除できたとき `:1`、対象が無いとき `:0` を返す
> - [ ] 値を省略した `SET` が使い方を示すエラー文字列を返し、サーバプロセスが落ちない
>
> **期待出力**
>
> - `SET foo bar` に対して `+OK`、続く `GET foo` に対して `$3` とバイト長つきの `bar` が返る
> - 未知のコマンドに対して `-ERR unknown command` が返る
> - サーバ起動時に `mini-kvs listening on 127.0.0.1:6380` の1行が標準出力に出る
>
> **観察項目**
>
> - 1コマンドを2回に分割して送り、受信バッファの結合によって正しく1コマンドとして処理されることを確認する
> - TTL切れの値が、参照されるまで内部のMapに残っていることを確認し、Redisの遅延削除と同じ性質を見る
> - `SET k "hello world"` のようにダブルクォート付きで送り、引用符の解除が働いて値に空白を含められることを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch15 run test` を実行し、`KVS supports set/get/delete and TTL metadata` がパスすることを確認する
> 2. `PORT=6380 pnpm --filter @handbook/ch15 exec tsx kvs.solution.ts` を起動し、`mini-kvs listening on 127.0.0.1:6380` が出ることを確認する
> 3. `solutions.test.ts` に「TTL 1秒で SET した1秒後の GET が `$-1` を返す」テストを1件追加し、再実行して合格することを確認する
> 4. `docker compose -f .devcontainer/docker-compose.yml exec redis redis-cli SET foo bar` と `GET foo` を実行し、本物のRedisと自作KVSで応答の意味が一致するか比較する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: ネットワークとコマンド解釈を分ける。まず「1行の文字列を受け取って応答文字列を返す純関数」を作り、テストで全コマンドを通してからTCPサーバを被せる。
> 2. **構造**: 値と失効時刻を持つMapのストア、コマンド名で分岐する実行関数、`net.createServer` で行を切り出すサーバの3層に分ける。TTLは保存時に失効時刻を計算し、取得時に現在時刻と比較する。
> 3. **実装の要点**: 受信データはコマンド境界で届かない。受け取ったチャンクを蓄積してから改行で分割し、最後の要素は未完成行として次回へ持ち越す。この処理を省くと長いコマンドが途中で壊れる。
>
> **本番利用時の警告**
>
> - 認証、待ち受けアドレスの制限、最大メモリと eviction ポリシーが無いため、0.0.0.0 で公開すると誰でも読み書きでき、無制限のキー投入でメモリを枯渇させられる。必ず 127.0.0.1 で待ち受ける
> - RDB や AOF に相当する永続化が無く、プロセス終了で全データが消える。キャッシュ以外の用途へ流用しない
>
> **導線**
>
> - 開始地点: `code/ch15/kvs.ts`
> - 模範解答: `code/ch15/kvs.solution.ts`
>
> **推定時間の内訳**: ストアとTTLの実装25分、コマンド分岐の実装30分、TCPサーバと行バッファリング20分、失敗系とTTLテストの追加15分
<!-- handbook:exercise:end -->

**要件**: TCP サーバとして以下のコマンドをサポート:
- `SET key value [EX seconds]`
- `GET key`
- `DEL key`
- `EXPIRE key seconds`
- `INCR key` / `DECR key`
- `EXISTS key`
- `KEYS pattern`

```bash
$ tsx kvs.solution.ts          # サーバ起動
$ telnet localhost 6379         # 別ターミナル
SET foo bar
GET foo
EX foo 60
DEL foo
```

**追加**:
- TTL の実装 (各値に expire timestamp、GET 時にチェック)
- RESP (REdis Serialization Protocol) サブセット対応 (発展)

模範解答: `code/ch15/kvs.solution.ts`

#### 課題15.2: CRDT (G-Counter、LWW-Register、PN-Counter) (★★★)

**目的**: 分散環境で「**衝突なしに収束する**」データ構造を実装。

<!-- handbook:exercise:start {"id":"15.2"} -->
> **演習カード 課題15.2** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - `15.11 CRDT ― 衝突なしの分散データ構造` を読み、可換性・結合性・冪等性の3性質を説明できる
> - `15.6 結果整合性 (Eventual Consistency)` を読み、収束と強整合性の違いを区別できる
> - レプリカごとの状態を独立したオブジェクトとして扱い、マージを副作用のない関数で書ける
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] G-Counter、PN-Counter、LWW-Register の3種が、状態の取得、値の算出、マージの各操作を備えている
> - [ ] G-Counter のマージがノードIDごとの最大値を取り、`merge(merge(a,b),c)` と `merge(a,merge(b,c))` が一致する
> - [ ] 同じ状態を2回マージしても値が変わらないことをテストで示せる
> - [ ] PN-Counter が5増加・2減少のあとに値3を返す
> - [ ] LWW-Register がタイムスタンプ同値のときノードIDで決着し、どのレプリカから見ても同じ勝者になる
> - [ ] G-Counter の増分に負数や小数を渡すと例外になる
>
> **期待出力**
>
> - ノードaで2、ノードbで1増やしてから相互にマージすると、両レプリカとも値3を返す
> - G-Counter の状態がノードIDをキー、増分を値とするオブジェクトとして取得できる
> - LWW-Register の状態が値・タイムスタンプ・ノードIDの3キーを持つ
>
> **観察項目**
>
> - 3レプリカを用意し、マージ順序を6通り試して最終値がすべて一致することを確認する
> - 小さいタイムスタンプの書き込みを後から適用し、その更新が黙って捨てられることを確認する
> - PN-Counter の状態を出力し、増加分と減少分が別々のG-Counterとして保持されていることを見る
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch15 run test` を実行し、`CRDTs converge` がパスすることを確認する
> 2. マージ順序をランダムに入れ替える100回ループを書き、毎回同じ値になることを `assert.equal` で確認する
> 3. 分断を模して片方のレプリカだけを10回増加させ、後からマージしても増分が失われないことを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: まず「状態をどう持てばマージが最大値の合成になるか」を紙の上で決める。カウンタは合計値ではなくノードごとの内訳を持つのが出発点。
> 2. **構造**: ノードIDから数値への写像を共通の状態型にし、最大値マージ関数を1つ書いて G-Counter と PN-Counter の両方から使う。PN-Counter は増加用と減少用の2本のG-Counterの差にする。
> 3. **実装の要点**: LWW の要点はタイムスタンプ同値時の決定性。全レプリカで同じ規則 (ノードIDの辞書順など) を使わないと、レプリカごとに違う勝者になり収束しない。
>
> **本番利用時の警告**
>
> - LWW-Register は物理時計に依存するため、ノード間のクロックスキューがあると新しいはずの書き込みが黙って捨てられる。本番ではハイブリッド論理時計やバージョンベクトルを使う
> - G-Counter はノードIDごとのエントリが増え続け、削除もできない。ノードを頻繁に入れ替える環境では状態が単調に肥大化する
>
> **導線**
>
> - 開始地点: `code/ch15/crdt.ts`
> - 模範解答: `code/ch15/crdt.solution.ts`
>
> **推定時間の内訳**: 3構造の実装60分、可換性・結合性・冪等性の検証テスト作成40分、分断と順序入れ替えの実験30分、時計巻き戻しの観察20分
<!-- handbook:exercise:end -->

**実装する3種**:

**G-Counter** (Grow-only Counter): ノードごとに増加分を持ち、合計を取る。
```typescript
const c1 = new GCounter('node-1');
const c2 = new GCounter('node-2');
c1.increment(); c1.increment();
c2.increment();
const merged = GCounter.merge(c1.state, c2.state);
console.log(GCounter.value(merged));  // 3
```

**LWW-Register** (Last-Writer-Wins): タイムスタンプが後の値が勝つ。
```typescript
const r1 = new LWWRegister(initial);
r1.set('A', timestamp1);
const r2 = new LWWRegister(initial);
r2.set('B', timestamp2);  // timestamp2 > timestamp1
const merged = LWWRegister.merge(r1.state, r2.state);
// → 'B' が選ばれる
```

**PN-Counter** (Positive-Negative): 増減両方できるカウンタ (G-Counter ×2)。

**評価基準**:
- 任意の順序でマージしても同じ結果 (可換性、結合性、冪等性)
- ネットワーク分断後にマージしてもデータ消失なし

模範解答: `code/ch15/crdt.solution.ts`

#### 課題15.3: Bloom Filter 自作 (★★)

**目的**: 「**存在しない可能性は確実、存在する可能性は誤検知あり**」の確率的構造を実装。

<!-- handbook:exercise:start {"id":"15.3"} -->
> **演習カード 課題15.3** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - `15.1 NoSQL の4分類` を読み、Cassandra や HBase のような Wide-column ストアの位置づけを把握する
> - `14.3 インデックスの内部構造` を読み、ディスクアクセスを1回減らすことの価値を数量で捉える
> - `node:crypto` の `createHash('sha256')` と、`Uint8Array` に対するビット演算 (シフトとマスク) が書ける
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] コンストラクタがビット長とハッシュ関数の個数を受け取り、ビット配列をビット長の8分の1のバイト数で確保する
> - [ ] 追加した1000件すべてに対する存在判定が `true` になり、偽陰性が1件も出ない
> - [ ] 未追加要素での実測 false positive 率が、理論式から算出した推定値と同じオーダーに収まる
> - [ ] ビット長やハッシュ関数の個数に0以下や非整数を渡すと例外を投げる
> - [ ] 最適なハッシュ関数の個数を理論式から計算し、その値の付近で実測FP率が最小になることを確認した
>
> **期待出力**
>
> - ビット長10000・ハッシュ7個に1000件追加した状態で、実測FP率が概ね1%前後の値として出力される
> - 推定FP率を返すメソッドが0から1の範囲の小数を返す
> - 未追加キーの判定はほとんど `false` で、稀に `true` が混じるログが得られる
>
> **観察項目**
>
> - 挿入件数を100 / 1000 / 5000と増やしながらFP率を測り、ビット配列の占有率とともに急上昇する点を見つける
> - ハッシュ関数の個数を1、3、7、15と変えてFP率の谷を探し、理論上の最適値と一致するか確認する
> - 同じ値を2回追加しても立っているビット数が増えないことを数えて確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch15 run test` を実行し、`Bloom filter has no false negatives for inserted keys` がパスすることを確認する
> 2. 未追加のランダムキー10000件で存在判定を呼び、`true` の件数から実測FP率を算出し、推定値と2倍以内に収まることを確認する
> 3. 追加済み1000件すべてで判定が `true` になるループを書き、1件でも `false` が出たらインデックス計算を疑う
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: ビットの立て方より先に「1つの値からk個の独立なインデックスをどう作るか」を決める。ここが決まれば残りは配列操作だけになる。
> 2. **構造**: sha256 のダイジェストから32ビット整数を2つ取り出し、`(h1 + i * h2 + i * i) % bitCount` の形で k 個を生成する二重ハッシュ法を使う。ビット操作はインデックスを8で割った商でバイト、余りでマスクを決める。
> 3. **実装の要点**: 2つ目のハッシュ値が0になると全インデックスが同じ値に潰れ、FP率が跳ね上がる。0のときは固定の非ゼロ定数 (0x9e3779b9 など) へ差し替えておく。
>
> **本番利用時の警告**
>
> - Bloom Filter は削除できない。ユーザー削除に追随させる用途に使うと、消したはずの値が永遠に「存在するかもしれない」と判定され続ける。削除が必要なら Counting Bloom Filter や Cuckoo Filter を選ぶ
> - false positive がそのまま業務上の誤りになる判定 (課金、権限、重複排除の最終決定) に単独で使ってはいけない。必ず本体ストアへの確認を後段に置く
>
> **導線**
>
> - 開始地点: `code/ch15/bloom-filter.ts`
> - 模範解答: `code/ch15/bloom-filter.solution.ts`
>
> **推定時間の内訳**: ビット配列とハッシュ生成の実装30分、追加と判定および例外系20分、FP率の実測と理論式の比較25分、ハッシュ個数を変えた観察15分
<!-- handbook:exercise:end -->

**要件**:

```typescript
const bf = new BloomFilter(10000, 7);  // ビット長 10000、ハッシュ関数 7 個

bf.add('apple');
bf.add('banana');
bf.add('cherry');

bf.has('apple');     // true (確実)
bf.has('banana');    // true (確実)
bf.has('grape');     // 多くの場合 false (未挿入でも稀に true になりうる)
bf.has('mango');     // 多くの場合 false、稀に true (false positive)

// false positive rate を実測
let fp = 0;
for (let i = 0; i < 10000; i++) {
  if (bf.has(`random-${Math.random()}`)) fp++;
}
console.log('FP rate:', (fp / 10000 * 100).toFixed(2), '%');
```

**追加**:
- 最適なハッシュ関数の数とビット長を理論式から計算
- 実プロダクト用途: Cassandra、HBase、CDN などの「キャッシュ判定」

模範解答: `code/ch15/bloom-filter.solution.ts`

#### 課題15.4: Consistent Hashing リング (★★)

**目的**: ノード追加・削除時に「**最小限のキー再配置**」で済む仕組みを実装。

<!-- handbook:exercise:start {"id":"15.4"} -->
> **演習カード 課題15.4** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - `15.4 DynamoDB ― クラウドネイティブ KV` を読み、パーティションキーによる水平分散とホットパーティションの問題を把握する
> - `15.5 CAP 定理と PACELC` を読み、ノード増減が可用性へ与える影響を意識しておく
> - ソート済み配列に対する下限探索 (二分探索) を自分で書ける
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] ノード追加、ノード削除、キーからノードを引く、分布を集計する、の4操作を備えたリングが動く
> - [ ] 仮想ノード数128以上で1000キーを4ノードへ配ったとき、各ノードの取り分が25%から5ポイント以内に収まる
> - [ ] ノードを1つ追加したとき、割り当てが変わるキーの割合が15%から38%の範囲に収まる
> - [ ] リング末尾を越えたハッシュのキーが先頭ノードへ折り返される
> - [ ] ノードが0個のリングでキーを引くと `ring has no nodes` の例外になる
>
> **期待出力**
>
> - 分布集計がノードごとの件数のMapを返し、4ノードで各250前後になる
> - 3ノードから4ノードへ増やしたときに移動したキーの割合が1/4付近の数値として出力される
> - 仮想ノード数を1に落とすと、同じ実験で取り分の偏りが数十パーセントまで拡大する
>
> **観察項目**
>
> - 仮想ノード数を1、16、128、256と変え、各ノードの取り分の最大と最小の差がどこまで縮むかを表にする
> - ノードを削除したとき、移動するのが削除ノードの担当分だけであることを確認する
> - 単純な剰余方式 (ハッシュをノード数で割った余り) も実装し、ノード追加時にほぼ全キーが動くことと比較する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch15 run test` を実行し、`Consistent hash moves a minority of keys when a node is added` がパスすることを確認する
> 2. 2000キーで追加前後の割り当てを配列に保存し、変化した比率が0.15から0.38の範囲に入ることを `assert.ok` で確認する
> 3. 分布集計の結果から最大ノードと最小ノードの差を計算し、仮想ノード256で5%以内に収まることを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: リングは「ハッシュ値でソートされた点の配列」1本で表せる。ノード追加は点をk個挿し込んで並べ直す操作だと捉える。
> 2. **構造**: ノード名とレプリカ番号を連結した文字列をハッシュして仮想ノードを作り、点の配列をハッシュ昇順に保つ。キー検索はキーのハッシュ以上で最小の点を二分探索する。
> 3. **実装の要点**: 二分探索の境界が要点。探索位置が配列長と等しくなったときに先頭へ折り返さないと、リング末尾より大きいハッシュのキーで未定義値を掴む。
>
> **本番利用時の警告**
>
> - 実際のクラスタでは再配置中のデータ移送、レプリカ配置、読み書きのクォーラムが必要で、リング単体では可用性も耐久性も得られない
> - 仮想ノード数を後から変えると全キーの割り当てが変わる。運用中の変更はキャッシュ全ミスやデータ喪失につながるため、初期設定として固定する
>
> **導線**
>
> - 開始地点: `code/ch15/consistent-hash.ts`
> - 模範解答: `code/ch15/consistent-hash.solution.ts`
>
> **推定時間の内訳**: リングと仮想ノードの実装30分、キー検索の二分探索と折り返し20分、1000キーの分配とノード追加の計測25分、仮想ノード数を変えた比較15分
<!-- handbook:exercise:end -->

**要件**:

```typescript
const ring = new ConsistentHashRing<string>();
ring.addNode('node-1');
ring.addNode('node-2');
ring.addNode('node-3');

// キーをノードに割り当て
const node = ring.getNode('user-123');  // 'node-2' など

// ノード追加: 既存キーの ~1/N だけ移動
ring.addNode('node-4');
// node-1, node-2, node-3 のキーで node-4 に移るものを観察

// 仮想ノード(replicas)で偏りを減らす
const ring2 = new ConsistentHashRing<string>({ virtualNodes: 100 });
```

**評価基準**:
- 1000キーを4ノードに均等分配 (各 ~25%)
- ノード追加で **25% のキーのみ** 移動
- 仮想ノード対応で偏りを 5% 以下に

模範解答: `code/ch15/consistent-hash.solution.ts`

#### 課題15.5: CAP 定理シミュレーション (★★)

**目的**: 「ネットワーク分断時に C を選ぶか A を選ぶか」を実装で体感。

<!-- handbook:exercise:start {"id":"15.5"} -->
> **演習カード 課題15.5** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - `15.5 CAP 定理と PACELC` を読み、分断時の選択と分断以外のときのレイテンシ選択を区別できる
> - `15.6 結果整合性 (Eventual Consistency)` を読み、収束するまでの読み取り不整合を許容する意味を説明できる
> - ノード集合の分割をグループの配列として扱い、多数派と少数派を件数で判定できる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] クラスタの生成が3ノード以上を要求し、2ノード以下では例外を投げる
> - [ ] 分断の指定時に全ノードが重複なくちょうど1グループへ属することを検証する
> - [ ] CPモードで少数派ノードへの書き込みが `false` を返して拒否され、多数派側は `true` を返す
> - [ ] APモードでは分断中も両側の書き込みが成功し、分断解消後に全ノードが同じ値へ収束する
> - [ ] 分断中に書いた値が、同一グループ内の全ノードから読み出せる
>
> **期待出力**
>
> - CPモードで少数派ノードへの書き込みが `false`、多数派ノードへの書き込みが `true` を返す
> - APモードで分断中に両側へ書いたあと分断を解消すると、どのノードから読んでも後勝ちの同じ1値になる
> - 3ノード未満でクラスタを生成すると `use at least three nodes` の例外になる
>
> **観察項目**
>
> - 分断中の各ノードの内部状態を出力し、APモードでは同じキーに異なる値が同時に存在することを確認する
> - 分断解消時の衝突解決が論理クロックの大小、同値ならノードID順で決まることを追い、勝者以外の書き込みが消える様子を見る
> - CPモードで少数派側の読み取りが古い値を返し続けることを確認し、拒否されるのが書き込みだけだという設計判断を読み取る
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch15 run test` を実行し、`CAP simulation rejects minority writes in CP and merges AP writes` がパスすることを確認する
> 2. 5ノードで2対3に分断し、CPモードで2ノード側の書き込みだけが `false` になることを確認する
> 3. APモードで分断中に片側へ3回書き、分断解消後に最後の書き込みだけが全ノードに残ることを出力で確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 「分断」をネットワークではなくノードのグループ分けとして表現すると実装が一気に単純になる。まずグループの二次元配列を持つところから始める。
> 2. **構造**: 各ノードに値・論理クロック・書き込み元ノードIDを保持させ、書き込みは自分と同じグループのノードだけへ伝播する。CP判定はグループの要素数が全ノード数の半分以下かどうかで行う。
> 3. **実装の要点**: 分断解消時の収束規則が要点。全ノードから同じキーの版を集め、論理クロック昇順、同値ならノードIDで並べて最後の1つを全ノードへ書き戻す。この規則が非対称だとノードごとに違う値へ落ち着く。
>
> **本番利用時の警告**
>
> - このシミュレータの収束は last-write-wins であり、敗者の書き込みを黙って捨てる。在庫や残高のように失うと業務が壊れる値へこの方針を適用してはいけない
> - 実システムの分断は「片方向だけ届く」「遅延して届く」など部分的に起きる。二分割の模擬だけで自社構成のCAP選択を結論づけない
>
> **導線**
>
> - 開始地点: `code/ch15/cap-simulation.ts`
> - 模範解答: `code/ch15/cap-simulation.solution.ts`
>
> **推定時間の内訳**: クラスタとパーティション表現の実装25分、AP/CPの書き込み判定25分、分断解消時の収束規則20分、5ノード構成と多数派境界の確認20分
<!-- handbook:exercise:end -->

**要件**: 3 ノードのレプリケーション付き KV ストアを実装し、以下を実演:
- **AP (Availability + Partition tolerance)**: 分断中も書き込み受け付け、後でマージ
- **CP (Consistency + Partition tolerance)**: 分断中は書き込み拒否、整合性優先

```typescript
const cluster = new MockCluster(['a', 'b', 'c'], { mode: 'AP' });
cluster.set('a', 'key', 'value1');
cluster.partition(['a'], ['b', 'c']);  // ネットワーク分断
cluster.set('a', 'key', 'newer');      // 分断中の書き込み
cluster.set('b', 'key', 'different');
cluster.heal();                        // 分断解消
// AP: 両方の値がマージされる(衝突解決方針による)
// CP: a の書き込みが拒否されていた
```

模範解答: `code/ch15/cap-simulation.solution.ts`

---

<!-- handbook:code-usage:start {"chapter":15} -->
### 第15章のコード集の使い方

<!-- handbook:generated; do not edit -->

コード集は pnpm ワークスペースとして構成してある (CODE_TOOLCHAIN.md)。依存はリポジトリ最上位で一度だけ解決し、章ごとの操作は `--filter` でワークスペースを指定する。

```bash
# 初回のみ。リポジトリ最上位で実行する
pnpm install

# 第15章の模範解答をまとめて検証する
pnpm --filter @handbook/ch15 run test

# 模範解答を個別に実行する
pnpm --filter @handbook/ch15 exec tsx kvs.solution.ts              # 課題15.1
pnpm --filter @handbook/ch15 exec tsx crdt.solution.ts             # 課題15.2
pnpm --filter @handbook/ch15 exec tsx bloom-filter.solution.ts     # 課題15.3
pnpm --filter @handbook/ch15 exec tsx consistent-hash.solution.ts  # 課題15.4
pnpm --filter @handbook/ch15 exec tsx cap-simulation.solution.ts   # 課題15.5
```

開始地点は模範解答と同じ場所に置いてある (`<name>.ts` と `<name>.solution.ts`、またはディレクトリ課題の `starter/` と `solution/`)。課題ごとの完成条件と採点手順は本節の演習カードと `code/ch15/README.md` にある。模範解答の多くは関数を export するだけで、実行して意味のある出力が出るかどうかは課題によって異なる。まず `run test` で通し、個別実行は演習カードのテスト方法に従う。
<!-- handbook:code-usage:end -->


NoSQLを学ぶことで、データストアは規模だけでなく、問い合わせの形、整合性、遅延、障害時の選択から決めるものだと分かった。それでも、どのストアに保存したかに関係なく、利用者が語句や意味から情報を探す問題は残る。次章では、正本とは別の検索用表現を組み立てる。

---

<a id="chapter-16"></a>
## 第16章 検索エンジンと全文検索

第14章と第15章で、データの正本をどのモデルへ置くかは選べるようになった。しかし、主キーや厳密な条件を知らない利用者が、文書中の語句、表記ゆれ、関連度、意味の近さから目的の情報を探す要求は、通常の行インデックスだけでは十分に表せない。保存に適した構造と発見に適した構造は一致しない。

本章では、文書から検索用の表現を作る過程を、転置インデックス、アナライザ、ランキング、ファセット、ベクトルという順に組み立てる。Elasticsearch/OpenSearch、軽量検索エンジン、PostgreSQL全文検索を同じ検索パイプラインとして比較し、品質、更新遅延、運用コストから選択できるようにする。検索索引は正本の複製であるため、第17章では、正本の変更を索引や他サービスへ確実に伝える問題へ進む。

<!-- handbook:chapter-guide:start {"chapter":16} -->
> **この章の学習ガイド**
>
> **解決する実務上の問題**  
> LIKE検索の限界、検索品質の低下、インデックス更新遅延、ベクトル検索の誤用を、検索パイプライン全体から解決する。
>
> **到達目標**
> - 転置インデックス、解析、BM25の基本を説明できる。
> - 全文検索、ファセット、ベクトル検索を要件で組み合わせられる。
> - 品質・レイテンシ・更新・コストを評価する検索実験を設計できる。
>
> 到達目標は章全体に対するものである。標準通読ルートは必修節だけを読むため、下の「中核概念」に (実務選択) (発展) (展望) と付いた節がある章では、その節を読むまで到達目標の一部が埋まらない。必修節を読み終えた時点で説明できない項目があれば、まず付記のある節へ進む。
>
> **前提知識**
> - [14.3 インデックスの内部構造](#section-14-3) ― インデックス内部構造
> - [15.6 結果整合性 (Eventual Consistency)](#section-15-6) ― 結果整合性
>
> **中核概念**  
> [16.1 転置インデックスの原理](#section-16-1)、[16.2 アナライザとトークン化](#section-16-2)、[16.3 関連度スコアリング ― TF-IDF と BM25](#section-16-3)、[16.7 PostgreSQL の全文検索](#section-16-7)、[16.8 ベクトル検索 ― LLM時代の検索](#section-16-8) (実務選択)、[16.9 検索エンジン選択の指針](#section-16-9)
>
> **最小実装**  
> [16.12 実装課題 ― 検索エンジンを自作する](#section-16-12) (発展)
>
> **本番実装との差分**
> - 自作検索は言語解析、分散インデックス、ランキング学習、障害復旧、アクセス制御を省略する。
>
> **典型的な失敗**
> - 件数だけで検索製品を選ぶ。
> - 更新反映遅延を利用者へ説明しない。
> - ベクトル類似度を正しさと同一視する。
>
> **診断・デバッグ方法**
> - query、解析後token、候補集合、score、フィルタ、応答時間を段階別に記録する。
> - 代表クエリと期待結果の評価セットを維持する。
>
> **意思決定チェックリスト**
> - 完全一致、全文、意味検索のどれが必要か。
> - freshnessとranking品質のどちらを優先するか。
>
> **演習と評価基準**  
> 対象: [16.12 実装課題 ― 検索エンジンを自作する](#section-16-12) (発展)
> - 検索評価セットで変更前後の品質と性能を比較できる。
>
> **一次資料・発展資料**
> - Elasticsearch documentation
> - PostgreSQL Full Text Search
> - HNSW primary paper
> - BM25 literature
<!-- handbook:chapter-guide:end -->

<a id="section-16-1"></a>
### 16.1 転置インデックスの原理
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"た行","term":"転置インデックス"} -->

<!-- handbook:narrative-bridge {"section":"16.1"} -->
データストアのモデルを選べても、文書のどこに語が現れるかを通常の列インデックスだけで高速に探すことは難しい。転置インデックスは「文書から語」ではなく「語から文書」への対応を持ち、全文検索の探索方向を逆転させる。

検索エンジンの心臓部は**転置インデックス**。

**普通のインデックス (順方向)**: ドキュメントID → 内容
**転置インデックス (逆方向)**: 単語 → その単語を含むドキュメントID

例: 3つのドキュメント

```text
doc1: "the quick brown fox"
doc2: "the lazy dog"
doc3: "the brown dog"
```

転置インデックス:

```text
the:   [doc1, doc2, doc3]
quick: [doc1]
brown: [doc1, doc3]
fox:   [doc1]
lazy:  [doc2]
dog:   [doc2, doc3]
```

`"brown dog"` を検索:
1. brown → [doc1, doc3]
2. dog → [doc2, doc3]
3. AND → [doc3] ← どちらにも含まれる

転置インデックスの構築は重いが、**検索は極めて高速**になる。

<a id="section-16-2"></a>
### 16.2 アナライザとトークン化
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"K","term":"Kuromoji"} -->

<!-- handbook:narrative-bridge {"section":"16.2"} -->
転置インデックスを作るには、文字列のどの単位を同じ語として登録するかを先に決めなければならない。アナライザは正規化、分割、語幹化、ストップワード処理を通じて、利用者の入力と索引中の語を比較可能にする。

「単語」と一口に言っても、扱いは複雑だ。検索エンジンは入力を**アナライザ**で前処理する。

```text
"The Quick-Brown Fox's running."
  ↓ トークン化
["The", "Quick", "Brown", "Fox's", "running"]
  ↓ 小文字化
["the", "quick", "brown", "fox's", "running"]
  ↓ ストップワード除去 (the, a, is など)
["quick", "brown", "fox's", "running"]
  ↓ 正規化 (アポストロフィ削除など)
["quick", "brown", "foxs", "running"]
  ↓ ステミング (語幹化、running → run)
["quick", "brown", "fox", "run"]
```

英語と日本語ではアナライザが大きく異なる:

- **英語**: Unicode のテキスト境界規則で語を切り出し (ハイフンやアポストロフィも境界になる)、ステミングをかける
- **日本語**: 形態素解析が必要 (Kuromoji、Sudachi) または N-gram (機械的に2-3文字ずつ切る)

<a id="section-16-3"></a>
### 16.3 関連度スコアリング ― TF-IDF と BM25
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"B","term":"BM25"} -->
<!-- handbook:index {"group":"T","term":"TF-IDF"} -->

<!-- handbook:narrative-bridge {"section":"16.3"} -->
語が一致する文書を列挙できても、すべてを同じ順序で返しては有用な検索にならない。TF-IDFやBM25は、文書内の頻度、語の希少性、文書長を使い、どの一致を上位へ置くかを定量化する。

「単に含む」だけでなく、「どれくらいマッチするか」をランキングする必要がある。

**TF-IDF:**

- **TF (Term Frequency)**: 単語がそのドキュメントに何回出るか (多いほど関連)
- **IDF (Inverse Document Frequency)**: その単語が全文書中で珍しいか (珍しい単語ほど価値が高い)

「the」のような頻出語は IDF が低く、ランキングへの寄与は小さい。一方「quantum」のような稀な単語は IDF が高く、検索結果に強い影響を与える。

**BM25:**

TF-IDF の改良版で、ドキュメント長を考慮する (長いドキュメントが有利になりすぎないよう調整)。現代の検索エンジンは BM25 をベースにしている。

<a id="section-16-4"></a>
### 16.4 Elasticsearch / OpenSearch
<!-- handbook:learning {"level":"practical","minutes":10} -->
<!-- handbook:index {"group":"E","term":"Elasticsearch"} -->
<!-- handbook:index {"group":"K","term":"Kuromoji"} -->
<!-- handbook:index {"group":"O","term":"OpenSearch"} -->

<!-- handbook:narrative-bridge {"section":"16.4"} -->
解析とランキングを自作できても、大量文書の分散配置、複製、更新、集約、障害復旧まで一から運用するのは重い。ElasticsearchとOpenSearchは検索パイプラインを分散システムとして提供し、その代わりクラスタ運用と整合性境界を引き受ける必要がある。

Elasticsearch (2010年〜) は Apache Lucene を基盤とする検索エンジンの事実上の標準。

```typescript
import { Client } from '@elastic/elasticsearch';

const client = new Client({ node: 'http://localhost:9200' });

// インデックス作成
// クライアント v8 以降は body ラッパを取り、mappings を直下に置く
await client.indices.create({
  index: 'posts',
  mappings: {
    properties: {
      title:   { type: 'text', analyzer: 'kuromoji' },
      body:    { type: 'text', analyzer: 'kuromoji' },
      tags:    { type: 'keyword' },        // 完全一致 (集計可能)
      author:  { type: 'keyword' },
      publishedAt: { type: 'date' },
      viewCount:   { type: 'integer' },
    },
  },
});

// ドキュメント投入
await client.index({
  index: 'posts',
  id: 'post-1',
  document: {
    title: 'Elasticsearch入門',
    body: '全文検索エンジンの基礎を学ぶ...',
    tags: ['検索', '入門'],
    author: 'Alice',
    publishedAt: '2026-05-01',
    viewCount: 100,
  },
});

// 検索
const result = await client.search({
  index: 'posts',
  query: {
    bool: {
      must: [
        { match: { body: '全文検索' } },          // 関連度検索
      ],
      filter: [
        { term: { author: 'Alice' } },           // 完全一致
        { range: { publishedAt: { gte: '2026-01-01' } } },
      ],
    },
  },
  sort: [
    { _score: 'desc' },                          // 関連度順
    { publishedAt: 'desc' },                     // 同点なら新しい順
  ],
  highlight: {                                    // ハイライト
    fields: { body: {} },
  },
  size: 20,
});
```

OpenSearch は Elastic 社のライセンス変更を受けてAWSがフォークしたもの。機能はほぼ同じ。

<a id="section-16-5"></a>
### 16.5 ファセット検索
<!-- handbook:learning {"level":"practical","minutes":5} -->
<!-- handbook:index {"group":"は行","term":"ファセット検索"} -->

<!-- handbook:narrative-bridge {"section":"16.5"} -->
関連度順の結果だけでは、利用者がカテゴリ、価格帯、属性で集合を絞り込む操作を支えられない。ファセット検索は検索結果集合を属性別に集計し、探索を「質問一回」から「条件を段階的に選ぶ対話」へ変える。

ECサイトでよくある「カテゴリで絞り込み、ブランドで絞り込み、価格帯で絞り込み...」を実現するのがファセット検索 (Aggregation)。

```typescript
const result = await client.search({
  index: 'products',
  query: { match: { name: 'スニーカー' } },
  aggs: {
    by_brand: {
      terms: { field: 'brand', size: 10 },
    },
    by_color: {
      terms: { field: 'color', size: 10 },
    },
    price_ranges: {
      range: {
        field: 'price',
        ranges: [
          { to: 5000 },
          { from: 5000, to: 10000 },
          { from: 10000 },
        ],
      },
    },
  },
});

// result.aggregations.by_brand.buckets で各ブランド名と件数が取れる
```

これで「Nike (45)、Adidas (32)、Puma (18)...」のような絞り込みUIが作れる。

<a id="section-16-6"></a>
### 16.6 Meilisearch / Typesense ― 軽量・高速
<!-- handbook:learning {"level":"practical","minutes":5} -->
<!-- handbook:index {"group":"M","term":"Meilisearch"} -->
<!-- handbook:index {"group":"T","term":"Typesense"} -->

<!-- handbook:narrative-bridge {"section":"16.6"} -->
分散検索エンジンは高機能だが、小規模サービスにも同じ運用負荷を持ち込むと、検索機能よりクラスタ管理が難しくなる。MeilisearchやTypesenseは機能範囲を絞り、単純な導入と低遅延を優先する選択肢になる。

Elasticsearch はパワフルだが、運用コストが高い。小〜中規模なら **Meilisearch** (Rust製) や **Typesense** (C++製) で十分なことが多い。

```typescript
// Meilisearch
import { MeiliSearch } from 'meilisearch';

const client = new MeiliSearch({ host: 'http://localhost:7700' });
const index = client.index('products');

await index.addDocuments([
  { id: 1, name: 'Nike Air Max', brand: 'Nike', price: 12000 },
  { id: 2, name: 'Adidas Stan Smith', brand: 'Adidas', price: 9000 },
]);

const results = await index.search('nike', {
  filter: 'price < 15000',
  facets: ['brand'],
  attributesToHighlight: ['name'],
});
```

シンプルなセットアップ、誤字許容 (typo tolerance)、即時検索 (instant search) が標準サポート。

<a id="section-16-7"></a>
### 16.7 PostgreSQL の全文検索
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"T","term":"tsvector"} -->

<!-- handbook:narrative-bridge {"section":"16.7"} -->
専用エンジンを追加すると正本との同期と新しい障害点が増える。検索要件が中規模で言語処理も限定的なら、PostgreSQLの全文検索を使い、トランザクションと検索索引を同じ運用境界へ置く方が単純な場合がある。

「Elasticsearch を立てるほどでもないが、`LIKE` よりは賢く」な場合、PostgreSQL の `tsvector` が選択肢。

```sql
-- 検索用のtsvector列を作る (生成列)
CREATE TABLE articles (
  id    SERIAL PRIMARY KEY,
  title TEXT,
  body  TEXT,
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))
  ) STORED
);

CREATE INDEX idx_articles_search ON articles USING GIN (search_vector);

-- 検索
SELECT title, ts_rank(search_vector, query) AS rank
FROM articles, to_tsquery('english', 'postgres & search') AS query
WHERE search_vector @@ query
ORDER BY rank DESC
LIMIT 10;
```

日本語は `pgroonga` 拡張で形態素解析対応。中規模プロジェクトなら PostgreSQL 一本で済むことが多い。

<a id="section-16-8"></a>
### 16.8 ベクトル検索 ― LLM時代の検索
<!-- handbook:learning {"level":"practical","minutes":10} -->
<!-- handbook:index {"group":"P","term":"pgvector"} -->
<!-- handbook:index {"group":"R","term":"RAG (Retrieval-Augmented Generation)"} -->
<!-- handbook:index {"group":"は行","term":"ベクトル検索"} -->

<!-- handbook:narrative-bridge {"section":"16.8"} -->
語彙が一致しない同義表現や、質問と説明文の関係は、字面を中心とする全文検索だけでは拾いにくい。ベクトル検索は入力を意味空間の座標へ写し、語の一致ではなく距離によって候補を探す。

2022年以降、テキストを**埋め込み (embedding)** ベクトルに変換し、ベクトル類似度で検索する構成が広く使われるようになった。LLM の RAG (Retrieval-Augmented Generation) はこの応用。

```typescript
// テキストを埋め込みに変換 (OpenAI 等)
async function embed(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return res.data[0].embedding;  // 1536次元のベクトル
}

// Postgres + pgvector
await db.query(`
  CREATE TABLE documents (
    id    SERIAL PRIMARY KEY,
    text  TEXT,
    embedding vector(1536)
  );
  -- 注意: ivfflat は既存データからクラスタ中心を学習する。空テーブルに作ると
  -- 探索品質が出ないため、索引はデータ投入後に作る。投入前に作るなら hnsw を選ぶ。
  -- CREATE INDEX ON documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
`);

// 投入
const embedding = await embed('Webアプリのスケーリング戦略');
await db.query(
  'INSERT INTO documents (text, embedding) VALUES ($1, $2)',
  ['Webアプリのスケーリング戦略', JSON.stringify(embedding)]
);

// 類似検索 (コサイン類似度)
const queryEmbed = await embed('サービスを大規模化する方法');
const similar = await db.query(`
  SELECT text, 1 - (embedding <=> $1) AS similarity
  FROM documents
  ORDER BY embedding <=> $1
  LIMIT 5
`, [JSON.stringify(queryEmbed)]);
```

専用のベクトルDB (Pinecone、Qdrant、Weaviate、Milvus) もあるが、`pgvector` で十分なケースが大半。第29章でRAGをさらに深堀りする。

<a id="section-16-9"></a>
### 16.9 検索エンジン選択の指針
<!-- handbook:learning {"level":"required","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"16.9"} -->
全文検索、軽量エンジン、PostgreSQL、ベクトル検索は互いの完全な代替ではない。更新頻度、検索品質、フィルタ、遅延、運用能力を同じ軸で比較し、必要なら語彙検索と意味検索を組み合わせる判断が必要になる。

| 要件 | 推奨 |
|---|---|
| 単純な部分一致、量が少ない | PostgreSQL `LIKE` + `pg_trgm` |
| 中規模、日本語、絞り込み | PostgreSQL tsvector + pgroonga |
| ECサイト、ファセット必須 | Meilisearch / Typesense |
| 大規模ログ・解析 | Elasticsearch / OpenSearch |
| ベクトル検索 (RAG等) | pgvector / Qdrant |

<a id="section-16-10"></a>
### 16.10 Embedding モデルの選択基準
<!-- handbook:learning {"level":"advanced","minutes":15} -->
<!-- handbook:index {"group":"E","term":"Embedding モデル"} -->
<!-- handbook:index {"group":"た行","term":"テキスト埋め込み"} -->
<!-- handbook:index {"group":"あ行","term":"埋め込みモデル"} -->

<!-- handbook:narrative-bridge {"section":"16.10"} -->
ベクトル検索を選んでも、埋め込みモデルによって次元数、言語性能、ドメイン適合性、費用、再索引範囲が変わる。モデル選択はランキング精度だけでなく、データ更新と運用継続性を含む設計判断である。

16.8 でベクトル検索を扱った。実装時に「**どの埋め込みモデルを使うか**」は性能と品質に直結する重要な判断。

#### 主要モデル (2026年時点)

| モデル | 次元 | 性能 | コスト | コンテキスト |
|---|---|---|---|---|
| OpenAI text-embedding-3-small | 1536 (削減可) | 高 | $0.02/1Mトークン | 8192トークン |
| OpenAI text-embedding-3-large | 3072 (削減可) | 最高 | $0.13/1Mトークン | 8192トークン |
| Voyage-3 | 1024 | 最高 (検索特化) | $0.06/1Mトークン | 32000トークン |
| Cohere embed-v3 | 1024 | 高 | $0.10/1Mトークン | 512トークン |
| Sentence-Transformers (OSS) | 384〜1024 | 中 | 無料 (自前) | 256〜512トークン |
| BGE-M3 (OSS) | 1024 | 高 (多言語) | 無料 (自前) | 8192トークン |
| E5-mistral-7b (OSS) | 4096 | 最高 (英語) | 自前GPU必要 | 8192トークン |

#### 選択基準

**1. ドメイン**

- **汎用 Web 検索**: OpenAI、Voyage
- **コード検索**: voyage-code-3、jina-embeddings-v2-base-code
- **多言語 (日本語含む)**: OpenAI、Cohere multilingual、BGE-M3
- **専門領域 (医療・法律)**: ドメイン特化モデル (BioBERT 派生など)、fine-tuning

**2. 次元と性能のトレードオフ**

```text
次元が高い → 表現力が高い → ベクトルDB のストレージ・検索コスト増
次元が低い → 速いが精度が落ちる
```

OpenAI text-embedding-3 は **Matryoshka 表現**(可変次元) に対応:

```python
# 必要なら次元を削減
response = openai.embeddings.create(
    model="text-embedding-3-large",
    input="some text",
    dimensions=512  # 3072 → 512 に切り詰め
)
# 性能はわずかに低下するがストレージは1/6
```

**3. コスト計算**

100万件のドキュメントを embedding する場合 (平均200トークン):

```text
text-embedding-3-small: 2億トークン × $0.02/1M = $4
text-embedding-3-large: 2億トークン × $0.13/1M = $26
Voyage-3:              2億トークン × $0.06/1M = $12
OSS (自前GPU):          GPU料金: ~$100/日(EC2 g4dn) × バッチ処理1日 = ~$100
```

数十万件までなら API、数百万件以上なら自前 GPU を検討。

**4. 互換する埋め込み空間と利用方法を揃える**

クエリと文書は、同じ埋め込み空間で比較できるよう、モデル、バージョン、次元、正規化、距離関数、query/document用プロンプトを対応させる。非対称検索向けに別のquery encoderとdocument encoderを使うモデルもあるため、「同じ文字列処理」ではなく提供元が定める互換な組を使う。モデルまたは互換性条件を変更した場合は、既存ベクトルの再生成と再インデックスを計画する。

#### 評価指標

- **MTEB (Massive Text Embedding Benchmark)**: 各モデルの性能スコア。`https://huggingface.co/spaces/mteb/leaderboard`
- **Recall@k**: 検索結果上位 k 件に正解が含まれる率
- **MRR (Mean Reciprocal Rank)**: 正解の順位の逆数の平均

自社データでの評価が最重要 ― リーダーボードのスコアは参考程度に。

<a id="section-16-11"></a>
### 16.11 ベクトルインデックスのアルゴリズム ― HNSW vs IVF vs DiskANN
<!-- handbook:learning {"level":"advanced","minutes":15} -->
<!-- handbook:index {"group":"D","term":"DiskANN"} -->
<!-- handbook:index {"group":"H","term":"HNSW (Hierarchical Navigable Small World)"} -->
<!-- handbook:index {"group":"I","term":"IVF (Inverted File Index)"} -->
<!-- handbook:index {"group":"は行","term":"ベクトルインデックス"} -->

<!-- handbook:narrative-bridge {"section":"16.11"} -->
適切なベクトルを得ても、全件との距離を厳密計算すれば件数に比例して遅くなる。HNSW、IVF、DiskANNなどの近似最近傍索引は、再現率、メモリ、構築時間、更新性を交換して探索候補を絞る。

ベクトル数が増えると、線形探索 (全件比較) は遅すぎる。**近似最近傍探索 (ANN: Approximate Nearest Neighbor)** が必要になる。代表的なアルゴリズムを比較する。

#### HNSW (Hierarchical Navigable Small World)

層状のグラフ構造で近傍を辿る。多くのベクトルDBやライブラリで採用される代表的なANNアルゴリズムだが、唯一の標準ではない。

```text
       層3:  少数のノード、長距離リンク
        ↓
       層2:  もう少しノード、中距離
        ↓
       層1:  さらにノード
        ↓
       層0:  全ノード、最短距離リンク
```

検索は上から下へ「だんだん近くへ」と移動する。

**特徴:**
- **精度**: 高い (recall 95%以上を実用範囲で達成)
- **速度**: 速い (数百万ベクトルで数 ms)
- **メモリ**: 全ベクトル + グラフ構造をメモリに載せる → 大量メモリ必要
- **更新**: 動的な追加・削除可能 (ただし削除は論理削除が多い)
- **代表実装**: Faiss、pgvector、Qdrant、Weaviate、Elasticsearch

```sql
-- pgvector で HNSW インデックス
CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops);

-- パラメータ調整
CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
-- m: 各ノードの隣接数(大きいほど精度↑、メモリ↑)
-- ef_construction: 構築時の探索幅(大きいほど精度↑、構築時間↑)
```

#### IVF (Inverted File Index)

ベクトルを k 個のクラスタに分け、検索時は「近いクラスタだけ」を探す。

**特徴:**
- **メモリ効率**: HNSW より省メモリ
- **大規模**: 圧縮やクラスタ分割と組み合わせてメモリを抑えやすい
- **精度**: `nlist`、`nprobe`、量子化、データ分布によって変わり、HNSWとの優劣は固定できない
- **更新**: クラスタリングが固定なので更新が苦手
- **代表実装**: Faiss、pgvector (ivfflat)

```sql
-- pgvector で IVF インデックス
CREATE INDEX ON documents USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);  -- クラスタ数
```

**バリエーション:**

- **IVF-PQ (Product Quantization)**: ベクトルを圧縮 (例: 1536次元 → 192バイトに)、メモリ大幅削減、精度低下
- **IVF-HNSW**: ハイブリッド、各クラスタ内で HNSW

#### DiskANN

「**SSD 上で動かす ANN**」。Microsoft Research 発、数十億ベクトルを単一マシンで扱える。

**特徴:**
- **大規模**: メモリに収まらない規模でも動く (SSD 主体)
- **コスト効率**: メモリより SSD の方が遥かに安い
- **精度・レイテンシ**: SSDアクセス、キャッシュ、探索幅、データ分布で変わる。HNSWと同等とは限らない
- **構築・更新コスト**: 実装と更新方式を確認する
- **実装**: 公開実装や各サービスの公式ドキュメントで、実際に使うインデックス方式を確認する

#### Approximate vs Exact

| | Exact (全件比較) | Approximate (HNSW など) |
|---|---|---|
| 精度 | 指定した距離関数に対する全件計算 | recall@kなどで評価し、探索パラメータで調整 |
| 速度 (100万件) | 数百 ms | 数 ms |
| 速度 (1億件) | 数秒〜分 | 数十 ms |
| 用途 | 小規模、絶対正確性が必要 | 大規模、Web 検索的な用途 |

「**100%の正解は不要、99%でいいから速く**」が ANN の哲学。

#### ベクトルインデックスの採用判断

| 判断軸 | 確認事項 |
|---|---|
| データ量・次元数 | 全件計算の実測、インデックスメモリ、ビルド時間 |
| 品質 | recall@k、nDCG、業務上の正解率 |
| レイテンシ | p50/p95/p99、同時実行、フィルタ併用時 |
| 更新 | 追加・削除・再構築、インデックスの鮮度 |
| 運用 | バックアップ、再構築時間、マルチテナント分離、コスト |

製品名や件数だけで方式を固定せず、代表クエリと実データでHNSW、IVF、DiskANN系、全件検索を比較する。

「**まず pgvector**」がほとんどのケースで最適解。専用ベクトルDB を導入するのは PostgreSQL が限界に達してから。

#### フィルタリング付き検索の罠

「**カテゴリ=本、価格<1000円のうち、クエリに近いもの**」 ― ベクトル検索と通常フィルタを組み合わせるとき、**Pre-filtering** と **Post-filtering** で性能と精度が変わる:

- **Pre-filtering**: フィルタ → ベクトル探索 (精度↑、速度↓)
- **Post-filtering**: ベクトル探索 → フィルタ (速度↑、精度↓ 候補が少なくなる)

Qdrant、Weaviate などはハイブリッド戦略を提供する。設計時に意識すべきポイント。

<a id="section-16-12"></a>
### 16.12 実装課題 ― 検索エンジンを自作する
<!-- handbook:learning {"level":"advanced","minutes":300} -->

<!-- handbook:narrative-bridge {"section":"16.12"} -->
検索品質は転置索引、解析、ランキング、補完、ベクトル探索のどれか一つでは決まらない。最小検索エンジンを組み立て、投入から候補生成、順位付け、応答までの一連のパイプラインを観測する。

第16章では転置インデックス、TF-IDF/BM25、ベクトル検索の3つの主要パラダイムを見た。本節ではそれぞれを自作する。所要時間: 演習カードの推定時間の合計で10時間30分。

#### 課題16.1: 転置インデックスを自作 (★★★)

**目的**: Elasticsearch 等の心臓部「転置インデックス」を実装し、なぜ全文検索が高速かを理解する。

<!-- handbook:exercise:start {"id":"16.1"} -->
> **演習カード 課題16.1** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - `16.1 転置インデックスの原理` を読み、文書から語ではなく語から文書への写像を持つ理由を説明できる
> - `16.2 アナライザとトークン化` を読み、正規化・小文字化・ストップワード除去の各段が何を捨てるかを把握する
> - JavaScript の Unicode プロパティ付き正規表現と、`Map` / `Set` を使った集合演算が書ける
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] トークナイザが小文字化と NFKC 正規化を行い、記号を除いた語の配列を返す
> - [ ] 文書追加時に語ごとの「文書ID から出現位置配列へ」のポスティングが構築される
> - [ ] 全語を含む文書IDを昇順で返すAND検索が動く
> - [ ] ストップワード除去とOR/NOT検索を追加し、ストップワードだけの検索が空配列になる
> - [ ] 文書削除後にその文書がどの検索結果にも現れず、空になったポスティングが取り除かれる
> - [ ] フレーズ検索が語順まで一致する文書だけを返す
>
> **期待出力**
>
> - 3文書を投入した状態で2語のAND検索が `[1, 3]` のような昇順のID配列を返す
> - フレーズ検索の結果が、同じ語のAND検索の結果の部分集合になる
> - 指定した語の文書頻度が、その語を含む文書数の整数として返る
>
> **観察項目**
>
> - 構築されたポスティングを出力し、頻出語が多数の文書IDを、稀な語が1件か2件だけを持つことを確認する
> - AND検索で最小のポスティングから走査した場合としない場合で比較回数を計測し、絞り込み順序の効果を見る
> - 位置情報を持つ場合と持たない場合でメモリ使用量を比較し、フレーズ検索の代償を数値で確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch16 run test` を実行し、`inverted index supports AND and phrase search` がパスすることを確認する
> 2. 同じ文書IDで2回 `addDocument` し、文書頻度が二重に増えないこと (再登録前に旧ポスティングを消していること) を確認する
> 3. `text.includes(query)` による全文走査版も実装し、1000文書での検索時間が転置インデックス側で桁違いに短いことを計測する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: データ構造を先に決める。「語から、文書IDと出現位置の対応へ」という二重の写像にしておけば、AND検索もフレーズ検索も同じ構造から導ける。
> 2. **構造**: 文書追加は「既存分の削除、トークン化、位置付きで登録」の順に書く。AND検索は語ごとの文書IDの集合を作り、要素数が最小の集合から他の集合に含まれるかで絞り込む。
> 3. **実装の要点**: フレーズ検索は位置の連続性で判定する。先頭語の各出現位置に対し、i番目の語がその位置プラスiに存在するかを全語で確認する。位置配列を昇順に保っていないとこの判定が破綻する。
>
> **本番利用時の警告**
>
> - ストップワードとステミングは言語依存で、この簡易実装は英語の空白区切りしか想定していない。日本語文書へそのまま適用すると語が切れず検索がほぼ機能しない
> - インデックスは全量がメモリ上にあり、永続化もセグメントマージもない。文書数の増加でヒープを使い切ってプロセスが落ちる
>
> **導線**
>
> - 開始地点: `code/ch16/inverted-index.ts`
> - 模範解答: `code/ch16/inverted-index.solution.ts`
>
> **推定時間の内訳**: トークナイザとポスティング構築40分、AND検索と削除処理30分、ストップワードとOR/NOTの追加40分、フレーズ検索と計測40分
<!-- handbook:exercise:end -->

**要件**:

```typescript
const idx = new InvertedIndex();
idx.addDocument(1, 'The quick brown fox jumps over the lazy dog');
idx.addDocument(2, 'A quick movement of the enemy will jeopardize six gunboats');
idx.addDocument(3, 'The lazy dog sleeps all day');

// AND 検索: 全単語を含む文書
idx.search('quick lazy');  // [1]
idx.search('lazy dog');    // [1, 3]
idx.search('quick brown'); // [1]
```

**機能要件**:
- 簡易なトークナイザ (空白分割 + 小文字化)
- ストップワード除去 (the, a, is, of など)
- ステミング (複数形 → 単数形など、簡易版)
- AND/OR/NOT 検索

模範解答: `code/ch16/inverted-index.solution.ts`

#### 課題16.2: TF-IDF と BM25 スコアリング (★★★)

**目的**: 「**どの文書が一番関連性が高いか**」のランキング計算を実装。

<!-- handbook:exercise:start {"id":"16.2"} -->
> **演習カード 課題16.2** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - `16.3 関連度スコアリング ― TF-IDF と BM25` を読み、TFの飽和と文書長正規化がなぜ必要かを説明できる
> - 課題16.1 のトークナイザを再利用できる状態にしておく (`inverted-index.solution.ts` から import する)
> - 自然対数を使った IDF の式変形を追える
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] スコアラが `k1`(デフォルト1.5) と `b`(デフォルト0.75) をコンストラクタオプションで受け取る
> - [ ] 文書登録時に語ごとの文書頻度が更新され、同じ文書IDを再投入しても文書頻度が二重に加算されない
> - [ ] 検索が文書IDとスコアの組を降順で返し、同点のときは文書ID昇順で安定する
> - [ ] TF-IDF版とBM25版の両方を実装し、同じTFでも短い文書のBM25スコアが高いことを数値で示せる
> - [ ] 全文書に出現する語のIDFが、1文書だけに出る語のIDFより小さくなる
>
> **期待出力**
>
> - 3文書で2語クエリを検索したとき、両語を含み最も短い文書が先頭に来る
> - スコアが正の実数で、クエリ語を1つも含まない文書は結果に現れない
> - `b` を0にすると文書長正規化が効かなくなり、長い文書の順位が上がる
>
> **観察項目**
>
> - `k1` を0.5、1.2、2.0と変え、同じ語を何度も含む文書のスコアの伸び方 (飽和の効き) を比較する
> - `b` を0と1で切り替え、平均文書長に対する文書長の比がスコアへ与える影響を確認する
> - IDF の式に文書頻度イコール全文書数を代入し、値が0付近まで落ちることを手計算で確かめる
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch16 run test` を実行し、`BM25 ranks relevant documents first` がパスすることを確認する
> 2. 同じ内容を2回繰り返して長さだけ2倍にした文書を追加し、短い方のスコアが高いことを `assert.ok` で確認する
> 3. 同じ文書IDを2回登録してからスコアを比較し、1回だけ登録した場合と一致することを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 先にTF-IDFで順位を出し、そのあとBM25の分母だけを差し替える。2つのスコアの順位差を見ると各項の役割が分かる。
> 2. **構造**: 文書IDからトークン配列への写像と、語から文書頻度への写像の2つを持ち、検索のたびに平均文書長を算出する。スコアは語ごとに IDF と飽和付きTF項の積を足し合わせる。
> 3. **実装の要点**: 再登録時の文書頻度の更新が落とし穴。既存文書を上書きするなら、文書頻度を丸ごと再計算するか差分を引くかを先に決めないと、同じ文書を入れ直すだけでIDFが狂う。
>
> **本番利用時の警告**
>
> - BM25スコアは同一インデックス内の相対値であり、サービス横断のしきい値として使えない。文書集合が変わればIDFが変わり、同じクエリでも絶対値が動く
> - スコアの高さは語の一致度であって正しさではない。事実確認や権限フィルタを検索スコアに委ねると、見せてはいけない文書が上位に出る
>
> **導線**
>
> - 開始地点: `code/ch16/bm25.ts`
> - 模範解答: `code/ch16/bm25.solution.ts`
>
> **推定時間の内訳**: TF-IDFの実装35分、BM25の分母と長さ正規化の実装40分、k1とbを変えた比較実験40分、再登録時の文書頻度整合の修正35分
<!-- handbook:exercise:end -->

**要件**: 課題16.1 の転置インデックスに以下を追加:

- **TF**: 文書内での単語頻度
- **IDF**: その単語が出現する文書の希少度
- **TF-IDF**: TF × IDF
- **BM25**: 改良版 (文書長で正規化、TF の飽和)

```typescript
const scorer = new BM25Scorer({ k1: 1.5, b: 0.75 });
scorer.indexDocument(1, 'machine learning algorithms');
scorer.indexDocument(2, 'deep learning is a subset of machine learning');
scorer.indexDocument(3, 'neural networks are used in deep learning');

const ranked = scorer.search('machine learning');
// [{ docId: 2, score: 1.85 }, { docId: 1, score: 1.62 }, { docId: 3, score: 0.42 }]
```

**評価基準**:
- スコアの計算式が正しい
- 短い文書が長い文書より同じ TF で有利
- レアな単語に高いスコア

模範解答: `code/ch16/bm25.solution.ts`

#### 課題16.3: トライ木でオートコンプリート (★★)

**目的**: 検索ボックスの「入力中に候補表示」を実装。

<!-- handbook:exercise:start {"id":"16.3"} -->
> **演習カード 課題16.3** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - `16.2 アナライザとトークン化` を読み、前方一致のために小文字化とNFKC正規化が必要な理由を把握する
> - `16.6 Meilisearch / Typesense ― 軽量・高速` を読み、instant search が要求する応答時間の水準を知る
> - 子ノードを `Map` で持つ木構造を、再帰またはスタックで走査できる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] 語と重みの登録、接頭辞と件数上限を指定した候補取得の2操作を備えたトライ木が動く
> - [ ] 接頭辞 `app` の候補が `apple` / `application` / `apply` の順 (重み降順) で返る
> - [ ] 存在しない接頭辞では空配列を返し、例外を投げない
> - [ ] 大文字や全角で入力しても、正規化後に同じ候補が返る
> - [ ] 10万語を投入しても候補取得1回あたりの時間が数ミリ秒以内に収まる
>
> **期待出力**
>
> - 候補が語と重みの2キーを持つオブジェクトの配列として、重み降順で返る
> - 重みが同点のときは語の辞書順で安定した並びになる
> - 件数上限を2にすると上位2件だけが返る
>
> **観察項目**
>
> - 10万語投入後のノード数を数え、共有接頭辞のおかげで語数×平均語長よりはるかに少ないことを確認する
> - 接頭辞 `a` と `appl` で所要時間を比べ、計算量が接頭辞の長さではなく配下の候補数に支配されることを確認する
> - 各ノードに部分木の最大重みをキャッシュした場合としない場合で応答時間を比較する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch16 run test` を実行し、`trie returns weighted suggestions` がパスすることを確認する
> 2. ランダム生成した10万語を投入し、`console.time` で候補取得100回の合計を計測して1回あたりが数ミリ秒以内であることを確認する
> 3. 配列の `filter` と `startsWith` による総当たり版を並べて実装し、同じ10万語で応答時間を比較する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 「接頭辞まで降りる」処理と「そこから下の候補を集める」処理を別メソッドに分けると、あとから重みキャッシュを足しやすい。
> 2. **構造**: ノードは子ノードのMapと、終端なら語と重みを持つ形にする。候補取得は接頭辞ノードまで降りてからスタックで深さ優先に集め、重み降順に並べて上限件数で切る。
> 3. **実装の要点**: 接頭辞配下の候補が数万件あると、全部集めてからソートする実装は遅い。各ノードに部分木の最大重みを持たせ、優先度付きキューで上位だけを辿る形へ変える。
>
> **本番利用時の警告**
>
> - 全語をメモリ上のMapで保持するため、語彙が数百万に達するとヒープを圧迫する。本番の補完は FST や DAWG などの専用インデックス、または検索エンジンの suggester を使う
> - 検索クエリをそのまま候補として学習させると、他ユーザーの個人情報や不適切語が補完候補として露出する。投入前のフィルタリングが必須
>
> **導線**
>
> - 開始地点: `code/ch16/trie-autocomplete.ts`
> - 模範解答: `code/ch16/trie-autocomplete.solution.ts`
>
> **推定時間の内訳**: トライ木の挿入と走査の実装30分、重み順の並び替えと上限処理20分、10万語のベンチマーク25分、ファジーマッチの検討15分
<!-- handbook:exercise:end -->

**要件**:

```typescript
const trie = new Trie();
trie.insert('apple', 100);    // 単語 + 重み(検索回数等)
trie.insert('application', 80);
trie.insert('apply', 50);
trie.insert('banana', 70);
trie.insert('band', 30);

trie.suggest('app', 5);
// → [{ word: 'apple', weight: 100 }, { word: 'application', weight: 80 }, { word: 'apply', weight: 50 }]

trie.suggest('ban', 5);
// → [{ word: 'banana', weight: 70 }, { word: 'band', weight: 30 }]
```

**評価基準**:
- O(prefix-length) で候補発見
- 重み順にソート
- 大量データ (10万単語) でもインタラクティブに動作

**発展**: ファジーマッチ (編集距離1の単語も候補に含める)

模範解答: `code/ch16/trie-autocomplete.solution.ts`

#### 課題16.4: ベクトル検索 ― Cosine Similarity (★★)

**目的**: LLM 時代の検索の基本「**ベクトル類似度**」を実装。

<!-- handbook:exercise:start {"id":"16.4"} -->
> **演習カード 課題16.4** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - `16.8 ベクトル検索 ― LLM時代の検索` を読み、埋め込みによる検索と語一致検索の違いを説明できる
> - `16.11 ベクトルインデックスのアルゴリズム ― HNSW vs IVF vs DiskANN` を読み、総当たり検索が実用になる規模感を把握する
> - 内積とノルムからコサイン類似度を計算する式を書ける
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] コサイン類似度の関数が次元不一致や空配列で例外を投げ、同一ベクトルに対して `1` を返す
> - [ ] ゼロベクトルとの類似度が例外でも NaN でもなく `0` になる
> - [ ] ベクトルストアが、宣言した次元数と異なるベクトルの追加を拒否する
> - [ ] 検索がID・スコア・メタデータの3キーをスコア降順で返し、同点はID昇順で安定する
> - [ ] 10000ベクトル×100クエリのベンチマークを実行し、1クエリあたりの平均時間をミリ秒で記録した
>
> **期待出力**
>
> - 同一の2次元ベクトル同士のコサイン類似度が厳密に `1` になる
> - 2次元ストアでクエリ `[0.9, 0.1]` の先頭が `[1, 0]` を登録したIDになる
> - 10000件×384次元の総当たり検索で、1クエリの所要時間が数ミリ秒から数十ミリ秒のオーダーに収まる
>
> **観察項目**
>
> - 次元数を32、128、384、1536と変えて1クエリの所要時間を測り、次元数に比例して伸びることを確認する
> - 正規化済みベクトル同士では内積とコサイン類似度が一致することを確認し、事前正規化で除算を省ける理由を見る
> - 上位1件と上位10件のスコア差を出力し、差が小さいときに順位が埋め込みのノイズで入れ替わりうることを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch16 run test` を実行し、`vector store ranks cosine similarity` がパスすることを確認する
> 2. 10000件をランダム生成して投入し、`console.time` で100クエリの総当たり検索を計測して1クエリ平均を算出する
> 3. 総当たりの結果を正解として、簡易HNSWや事前クラスタリング版を実装した場合の上位10件一致率を計算する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 類似度計算とストアを分ける。コサイン類似度を純関数として先に確定させ、`1` / `0` / `-1` の3ケースをテストで固定する。
> 2. **構造**: IDからベクトルとメタデータへの写像に保持し、検索は全件をスコア化して並べ替える。比較はスコア降順を主、ID昇順を副とする2段階にして同点時も決定的にする。
> 3. **実装の要点**: ゼロベクトルの扱いが落とし穴。ノルムが0のまま除算すると NaN になり、並べ替えで順位が壊れる。どちらかのノルムが0なら先に0を返す。
>
> **本番利用時の警告**
>
> - 総当たり検索は件数に比例して遅くなる。数十万件規模へそのまま持ち込むと1クエリが秒単位になるため、本番では HNSW や IVF のインデックスを使う
> - ベクトル類似度は意味の近さの近似でしかない。アクセス制御や事実確認を類似度に委ねると、権限のない文書や誤情報が上位に出る
>
> **導線**
>
> - 開始地点: `code/ch16/vector-search.ts`
> - 模範解答: `code/ch16/vector-search.solution.ts`
>
> **推定時間の内訳**: コサイン類似度の実装と境界テスト20分、ストアの追加と検索の実装25分、10000件のベンチマーク25分、次元数を変えた計測20分
<!-- handbook:exercise:end -->

**要件**:

```typescript
// 文書とその埋め込みベクトル(本来は OpenAI Embeddings 等で生成)
const store = new VectorStore(384);  // 次元数
store.add(1, [0.1, 0.5, -0.3, ...], { title: 'Cat behavior' });
store.add(2, [0.4, 0.2, 0.1, ...], { title: 'Dog training' });

// クエリベクトルとの類似度で検索
const queryVec = embed('how do cats sleep');
const results = store.search(queryVec, 5);
// 類似度の高い順に上位 5 件
```

**機能**:
- Cosine Similarity 計算
- ブルートフォース検索 (1000件まで実用的)
- 結果のメタデータ取得
- ベンチマーク: 10000ベクトル × 100クエリで線形検索の速度を測定

**発展**: HNSW の簡易版実装 (近似最近傍検索)

模範解答: `code/ch16/vector-search.solution.ts`

#### 課題16.5: 統合検索エンジン (★★★)

**目的**: 上記すべてを組み合わせた「**ミニ Elasticsearch**」を作る。

<!-- handbook:exercise:start {"id":"16.5"} -->
> **演習カード 課題16.5** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: localhost
>
> **前提**
>
> - 課題16.1から16.4を終え、転置インデックス、BM25スコアラ、トライ木、ベクトルストアを import できる状態にしておく
> - `16.4 Elasticsearch / OpenSearch` を読み、インデックスAPIと検索APIを分ける設計を把握する
> - `node:http` でJSONを返すHTTPサーバを立て、`curl` で叩ける
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] 文書登録エンドポイントが1回の呼び出しで転置インデックス、BM25、トライ木、ベクトルストアの4つへ同時に登録する
> - [ ] キーワード検索エンドポイントがBM25スコア降順のJSON配列を返す
> - [ ] オートコンプリートのエンドポイントがトライ木の候補配列を返す
> - [ ] ベクトル検索エンドポイントがベクトルと件数上限を受け取り、コサイン類似度順の結果を返す
> - [ ] 未定義パスへのリクエストが404を返し、プロセスが落ちない
> - [ ] 自己テストモードで起動すると、サーバを立てずに検索結果を検証して終了コード0で終わる
>
> **期待出力**
>
> - `bash mini-search-engine/solution/main.sh --self-test` が `Search ranking` を含むJSONを1行出力し、終了コード0で終わる
> - 模範解答をサーバモードで起動すると `mini-search listening on 127.0.0.1:3004` の1行が出る
> - 自作サーバの文書登録が登録したIDを含むJSONを返し、以降のキーワード検索の対象になる
>
> **観察項目**
>
> - 同じクエリをキーワード検索とベクトル検索の両方へ投げ、上位の並びが異なることを確認し、ハイブリッド検索が必要になる理由を見る
> - 文書追加の直後に検索して結果へ現れることを確認し、Elasticsearch の refresh 間隔による反映遅延との違いを対比する
> - スコア0の文書が結果から除外されていることを確認し、しきい値の置き方で再現率が変わることを見る
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch16 run test` を実行し、`integrated search self-test succeeds` がパスすることを確認する
> 2. `bash code/ch16/mini-search-engine/solution/main.sh --self-test` を直接実行し、出力されたJSONで `Search ranking` の文書が首位になっていることを確認する
> 3. 自作サーバを7000番で起動し、`curl -s -X POST http://127.0.0.1:7000/index -d '{"id":9,"text":"kafka streaming"}'` の後に `curl -s 'http://127.0.0.1:7000/search?q=kafka&type=keyword'` を実行して追加文書がヒットすることを確認する (模範解答の `main.sh` は検索のみを提供する最小版なので比較対象にしない)
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: まず4つのインデックスを束ねる検索エンジンのクラスを作り、HTTPは薄いルーティングだけにする。HTTPから書き始めるとインデックス間の整合が後付けになる。
> 2. **構造**: 文書登録の中で転置インデックスへの追加、BM25への登録、語ごとのトライ木への挿入、ベクトルの追加を順に呼ぶ。ルーティングは `new URL(req.url, 'http://localhost')` の `pathname` と `searchParams` で分岐する。
> 3. **実装の要点**: POSTボディは `data` イベントで分割到着する。全チャンクを結合してから `JSON.parse` しないと、大きめのボディで構文エラーになる。パース失敗は400で返す。
>
> **本番利用時の警告**
>
> - 認証、レート制限、ボディサイズ上限が無いため、公開すると誰でも索引を書き換えられ、巨大なボディでメモリを枯渇させられる。必ず 127.0.0.1 で待ち受ける
> - インデックスはメモリ上のみで永続化もレプリカも無い。再起動で全文書が消えるため、正本のデータベースを別に持つ前提を崩さない
>
> **導線**
>
> - 開始地点: `code/ch16/mini-search-engine/starter/main.sh`
> - 模範解答: `code/ch16/mini-search-engine/solution/main.sh`
>
> **推定時間の内訳**: 4インデックスの統合40分、HTTPルーティングと4エンドポイントの実装50分、curlでの動作確認30分、自己テストとエラー処理の追加30分
<!-- handbook:exercise:end -->

**機能**:
- BM25 + Trie autocomplete + Vector search を同時提供
- HTTP API として公開
- インデックスと検索の REST エンドポイント

模範解答は `/search` だけを提供する最小版 (待ち受けはポート3004) である。以下の4エンドポイントは、そこへ読者が足していく到達点を示す。ポート番号は演習カードの手順に合わせて7000番で起動する前提で書いてある。

```bash
# 文書追加
curl -X POST http://localhost:7000/index \
  -d '{"id": 1, "text": "TypeScript handbook", "tags": ["lang", "web"]}'

# キーワード検索
curl 'http://localhost:7000/search?q=typescript&type=keyword'

# オートコンプリート
curl 'http://localhost:7000/suggest?prefix=type'

# ベクトル検索
curl -X POST http://localhost:7000/vector-search \
  -d '{"vector": [0.1, 0.2, ...], "limit": 10}'
```

模範解答: `code/ch16/mini-search-engine/solution/main.sh` (検索のみの最小版)

---

<!-- handbook:code-usage:start {"chapter":16} -->
### 第16章のコード集の使い方

<!-- handbook:generated; do not edit -->

コード集は pnpm ワークスペースとして構成してある (CODE_TOOLCHAIN.md)。依存はリポジトリ最上位で一度だけ解決し、章ごとの操作は `--filter` でワークスペースを指定する。

```bash
# 初回のみ。リポジトリ最上位で実行する
pnpm install

# 第16章の模範解答をまとめて検証する
pnpm --filter @handbook/ch16 run test

# 模範解答を個別に実行する
pnpm --filter @handbook/ch16 exec tsx inverted-index.solution.ts     # 課題16.1
pnpm --filter @handbook/ch16 exec tsx bm25.solution.ts               # 課題16.2
pnpm --filter @handbook/ch16 exec tsx trie-autocomplete.solution.ts  # 課題16.3
pnpm --filter @handbook/ch16 exec tsx vector-search.solution.ts      # 課題16.4
bash code/ch16/mini-search-engine/solution/main.sh                   # 課題16.5
```

開始地点は模範解答と同じ場所に置いてある (`<name>.ts` と `<name>.solution.ts`、またはディレクトリ課題の `starter/` と `solution/`)。課題ごとの完成条件と採点手順は本節の演習カードと `code/ch16/README.md` にある。模範解答の多くは関数を export するだけで、実行して意味のある出力が出るかどうかは課題によって異なる。まず `run test` で通し、個別実行は演習カードのテスト方法に従う。
<!-- handbook:code-usage:end -->


ここまでで、文書を語句や意味から探し、関連度順に返す検索パイプラインを設計できるようになった。検索索引は正本の複製であり、更新を遅延や欠落なく反映する必要がある。次章では、この同期問題を一般化し、処理同士を時間的に分離してデータ変更を伝える仕組みへ進む。

---

<a id="chapter-17"></a>
## 第17章 イベント駆動とメッセージング

第16章では、業務データとは別に検索用の索引を持つことで、語句や意味から情報を発見できるようになった。だが、ユーザー登録後のメール送信、検索索引更新、分析記録のような副作用を元のHTTP要求へ直列に詰め込むと、遅い処理や一時障害が応答全体を巻き込み、サービス間の時間的結合も強くなる。

本章では、同期処理の境界を越えて仕事を受け渡すため、キュー、ログ、Pub/Sub、ジョブ処理を比較する。そのうえで、非同期化によって生じる重複、順序、リトライ、部分失敗を、冪等性、Saga、Outbox、CDCで扱う。同じ問題は自分のシステムの外側でも起き、他社から届くWebhook、送信したメールの配送結果、外部APIの呼び出しはいずれも「後から非同期に結果が返る」構造を持つため、章の後半でそれぞれの実務を扱う。これによりデータ変更を複数の処理へ安全に伝えられるようになるが、ブローカー、DB、検索、ワーカーを継続運用する計算資源と配置はまだ未解決であり、第V部ではインフラと運用へ進む。

<!-- handbook:chapter-guide:start {"chapter":17} -->
> **この章の学習ガイド**
>
> **解決する実務上の問題**  
> 時間のかかる処理やサービス連携を非同期化しつつ、重複、順序逆転、取りこぼし、再処理を安全に扱う。
>
> **到達目標**
> - 同期と非同期の境界を要件から決められる。
> - at-most-once、at-least-once、Kafkaの保証境界を説明できる。
> - Outbox、Saga、CDC、冪等コンシューマを設計できる。
> - Webhook受信、メール配送、外部API呼び出しを、相手を制御できない前提で設計できる。
> - 決済のようにリトライが金銭を動かす連携を、冪等キー・状態機械・突合で設計できる。
>
> 到達目標は章全体に対するものである。標準通読ルートは必修節だけを読むため、下の「中核概念」に (実務選択) (発展) (展望) と付いた節がある章では、その節を読むまで到達目標の一部が埋まらない。必修節を読み終えた時点で説明できない項目があれば、まず付記のある節へ進む。
>
> **前提知識**
> - [2.2 メソッドの意味論](02-part1-foundations.md#section-2-2) ― 冪等性
> - [14.6 ACIDとトランザクション](#section-14-6) ― トランザクション
>
> **中核概念**  
> [17.1 同期 vs 非同期 ― いつ非同期にすべきか](#section-17-1)、[17.2 メッセージキューの基本](#section-17-2)、[17.4 Kafka ― 高スループット分散ストリーミング](#section-17-4) (実務選択)、[17.6 ジョブキュー ― Web アプリでの定番](#section-17-6)、[17.10 Saga パターン ― 分散トランザクション](#section-17-10) (実務選択)、[17.11 Outbox パターン ― 信頼性の高いイベント発行](#section-17-11)、[17.12 CDC (Change Data Capture) ― DBの変更をイベント化する](#section-17-12) (実務選択)、[17.13 Webhook 受信の実務 ― 再送、順序逆転、冪等性](#section-17-13) (実務選択)、[17.14 メール送信の実務 ― 配送経路、バウンス、DKIM/SPF/DMARC](#section-17-14) (実務選択)、[17.15 外部API連携の実務 ― 時間予算、リトライ、Circuit Breaker](#section-17-15) (実務選択)、[17.16 決済連携の実務 ― 二重課金、返金、突合](#section-17-16) (実務選択)
>
> **最小実装**  
> [17.17 実装課題 ― メッセージング基盤を自作する](#section-17-17) (発展)
>
> **本番実装との差分**
> - 自作ブローカーは永続ログ、レプリケーション、rebalance、backpressure、認証を省略する。
> - 外部連携の例は実際のHTTPクライアント、TLS、レピュテーション管理を省略する。
>
> **典型的な失敗**
> - 配信成功を業務処理成功と同一視する。
> - リトライで外部副作用を重複させる。
> - イベント順序を全体で保証できると思い込む。
> - パース後の本文で署名を検証し、開発環境だけで通る状態にする。
> - バウンスを無視し、送信ドメインの評価を自ら下げる。
> - 冪等キーなしで POST をリトライし、二重の副作用を起こす。
> - タイムアウトを失敗として扱い、新しい取引として作り直して二重課金する。
> - 返金を決済行の更新として実装し、並行要求で累計の上限を越える。
>
> **診断・デバッグ方法**
> - message ID、attempt、partition/key、処理結果を追跡する。
> - DLQ、lag、リトライ回数、重複率を監視する。
> - 受信の遅延、重複率、署名検証失敗数、突合の差分件数を見る。
> - 連携先ごとに成功率、分位点、リトライ回数、ブレーカ状態を分けて記録する。
> - 事業者側の記録と自分たちの記録を日次で3方向に照合し、差分件数と金額差を出す。
>
> **意思決定チェックリスト**
> - ユーザーは即時結果を必要とするか。
> - 順序保証の単位と再処理方法は。
> - 正本データとイベントの整合をどう保つか。
> - 順序逆転を版番号・再取得・キー単位の順次処理のどれで解くか。
> - 障害時の縮退は古い値・隠す・後で・断るのどれか。
> - 結果が不明な決済をどの状態として持ち、どう回復するか。
>
> **演習と評価基準**  
> 対象: [17.17 実装課題 ― メッセージング基盤を自作する](#section-17-17) (発展)
> - 重複配送と順序逆転を注入し、結果が正しいことを示せる。
> - 重複配送と順序逆転と欠落を注入し、突合まで含めて結果が正しいことを示せる。
> - 二重課金、返金の超過、突合の欠如を再現し、対策後に再現しないことを示せる。
>
> **一次資料・発展資料**
> - Kafka documentation
> - RabbitMQ documentation
> - AWS SQS documentation
> - Debezium documentation
> - RFC 6376 DKIM
> - RFC 7208 SPF
> - RFC 7489 DMARC
> - Nygard, Release It! 2nd ed.
> - PCI Security Standards Council, PCI DSS
<!-- handbook:chapter-guide:end -->

<a id="section-17-1"></a>
### 17.1 同期 vs 非同期 ― いつ非同期にすべきか
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"た行","term":"同期処理"} -->

<!-- handbook:narrative-bridge {"section":"17.1"} -->
検索索引や分析データは正本から派生するため、変更を別処理へ伝える必要がある。すべてを元のHTTP要求で完了させると、下流の遅延と障害が利用者の応答へ伝播するため、どの処理を同期境界から外すかを最初に判断する。

**同期処理にすべき:**

- ユーザーが結果を直接受け取る (検索、ログイン)
- 整合性が即座に必要 (残高チェックして送金)

**非同期処理にすべき:**

- 結果が即座に必要ではない (メール送信、通知、レポート生成)
- 失敗時にリトライしたい
- 処理に時間がかかる (動画エンコーディング、PDF生成)
- 複数の処理を並列に実行したい
- 外部システム連携 (一時的に応答しないかもしれない)

<a id="section-17-2"></a>
### 17.2 メッセージキューの基本
<!-- handbook:learning {"level":"required","minutes":10} -->

<!-- handbook:narrative-bridge {"section":"17.2"} -->
処理を非同期へ移すと、呼び出し元のメモリ上にタスクを置くだけではプロセス停止時に失われる。メッセージキューは仕事を永続的に受け渡し、送信側と受信側の実行時刻と処理速度を切り離す。

非同期処理は典型的に**メッセージキュー**で実現する。

```text
[Producer] → [Queue] → [Consumer]
```

Producer はメッセージをキューに投入、Consumer はキューから取り出して処理。Producer と Consumer は疎結合。

**重要な概念:**

- **At-most-once**: 最大1回 (失敗したら諦める、メッセージ消失あり)
- **At-least-once**: リトライによって1回以上届ける。重複処理を前提に、冪等性または重複排除を設計する
- **Exactly-once**: 適用範囲を限定して実現する性質。ブローカー内、ストリーム処理、外部DBまで含むかで意味が異なり、単一のラベルだけでは保証範囲が分からない

**冪等性 (Idempotency):**

At-least-once では同じメッセージが複数回処理されうる。Consumer 側で**何度実行しても結果が同じ**になるように設計する必要がある。

```typescript
// BAD: 二重実行で残高が2倍引かれる
async function processPayment(message: { userId: string; amount: number }) {
  await db.user.update({
    where: { id: message.userId },
    data: { balance: { decrement: message.amount } },
  });
}

// GOOD: メッセージIDを主キーに持つ表へ「先に書く」ことで重複を弾く
async function processPayment(message: { id: string; userId: string; amount: number }) {
  try {
    await db.$transaction(async (tx) => {
      // 先に記録する。重複なら一意制約違反でここが失敗し、残高には触れない
      await tx.processedEvent.create({ data: { id: message.id } });
      await tx.user.update({
        where: { id: message.userId },
        data: { balance: { decrement: message.amount } },
      });
    });
  } catch (e) {
    if (isUniqueViolation(e)) return;  // 既に処理済み
    throw e;
  }
}
```

順序が逆だと守れない。「`findUnique` で存在を確かめてから `create` する」形は、同じメッセージが同時に2回届いたときに両方の確認が「無し」を返して両方が先へ進む。本書が 14.7 で見たとおり、READ COMMITTED では他のトランザクションが未コミットの行は見えないためである。実際に重複を止めているのは主キーの一意制約であり、確認の `SELECT` ではない。だから確認より先に書き、制約違反を「処理済み」として扱う。

分離レベルを SERIALIZABLE へ上げても止められるが、決済のような高頻度の処理ではシリアライズの失敗とリトライが増える。一意制約に任せる方が安い。

<a id="section-17-3"></a>
### 17.3 RabbitMQ ― 伝統的メッセージブローカー
<!-- handbook:learning {"level":"practical","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"17.3"} -->
キューの基本モデルを理解すると、配信確認、ルーティング、優先度、リトライを誰が担当するかが選定軸になる。RabbitMQはメッセージを消費者へ配送するブローカーとして、柔軟なルーティングとタスク処理を得意とする。

RabbitMQ は AMQP プロトコルベース。柔軟なルーティング (exchanges、bindings) が特徴。

```typescript
import amqp from 'amqplib';

// Producer
const connection = await amqp.connect('amqp://localhost');
const channel = await connection.createChannel();
await channel.assertQueue('email_queue', { durable: true });

channel.sendToQueue(
  'email_queue',
  Buffer.from(JSON.stringify({ to: 'alice@x.com', subject: 'Welcome' })),
  { persistent: true }
);

// Consumer
const ch = await connection.createChannel();
await ch.assertQueue('email_queue', { durable: true });
ch.prefetch(1);  // 1メッセージずつ取って処理

ch.consume('email_queue', async (msg) => {
  if (!msg) return;
  const data = JSON.parse(msg.content.toString());
  try {
    await sendEmail(data);
    ch.ack(msg);  // 成功 → キューから削除
  } catch (err) {
    ch.nack(msg, false, true);  // 失敗 → 再キュー
  }
});
```

**RabbitMQ の特徴:**

- 柔軟なルーティング (Direct、Topic、Fanout exchange)
- メッセージ単位の ack/nack
- 優先度キュー、デッドレターキュー、TTL

<a id="section-17-4"></a>
### 17.4 Kafka ― 高スループット分散ストリーミング
<!-- handbook:learning {"level":"practical","minutes":10} -->
<!-- handbook:index {"group":"K","term":"Kafka"} -->

<!-- handbook:narrative-bridge {"section":"17.4"} -->
タスクを一度処理して削除するキューでは、同じイベント列を複数用途が独立に再生したり、大量ストリームを長期間保持したりする要求に合わない。Kafkaはメッセージを追記ログとして保持し、消費位置を利用者側のオフセットとして分離する。

Kafka (LinkedIn 発祥、現 Apache) は伝統的なキューとは設計思想が異なる。**メッセージは消費されても消えず、ログとして保持される**。

```text
[Topic: orders]
  partition 0: [msg1][msg2][msg3][msg4]
  partition 1: [msg1][msg2][msg3]
  partition 2: [msg1][msg2][msg3][msg4][msg5]
```

特徴:

- **Topic とパーティション**: トピックは複数パーティションに分割、並列処理
- **オフセット**: コンシューマが「どこまで読んだか」を保持
- **保持期間**: 設定により数日〜永久に保持
- **再読み込み**: オフセットを巻き戻して再処理可能

```typescript
import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'myapp',
  brokers: ['kafka:9092'],
});

// Producer
const producer = kafka.producer();
await producer.connect();
await producer.send({
  topic: 'user-events',
  messages: [
    { key: 'user-42', value: JSON.stringify({ type: 'registered', userId: '42' }) },
  ],
});

// Consumer
const consumer = kafka.consumer({ groupId: 'email-service' });
await consumer.connect();
await consumer.subscribe({ topic: 'user-events', fromBeginning: false });

await consumer.run({
  eachMessage: async ({ topic, partition, message }) => {
    const event = JSON.parse(message.value!.toString());
    if (event.type === 'registered') {
      await sendWelcomeEmail(event.userId);
    }
  },
});
```

**Consumer Group**:

同じconsumer group内では、1つのpartitionは同時に1つのconsumerへ割り当てられる。そのためグループ内の最大並列度はpartition数に制約される。別のconsumer groupは同じpartitionを独立に読む。

Kafkaのidempotent producerとtransaction APIは、対応するproducer/consumer設定とKafka内のread-process-write処理で重複を抑える保証を提供する。外部DB、HTTP API、メール送信まで自動的にexactly-onceになるわけではなく、外部システムとのトランザクション連携または冪等性が必要。

**Kafka が向くケース:**

- 巨大スループット (秒間百万メッセージ)
- 複数の Consumer が独立に同じデータを読む (Eメール、分析、検索インデックス更新...)
- イベントソーシング (後述)
- ストリーム処理 (Kafka Streams、Flink との連携)

<a id="section-17-5"></a>
### 17.5 AWS SQS / SNS ― マネージドの安心感
<!-- handbook:learning {"level":"practical","minutes":5} -->
<!-- handbook:index {"group":"A","term":"AWS SQS/SNS"} -->

<!-- handbook:narrative-bridge {"section":"17.5"} -->
RabbitMQやKafkaは柔軟だが、クラスタ構築、複製、アップグレード、監視を自分たちで担う必要がある。SQSとSNSは機能と制御範囲を限定する代わりに、可用性と運用の多くをクラウド側へ移す。

クラウドで運用するなら、AWS の SQS (Simple Queue Service) や SNS (Simple Notification Service) でメッセージブローカーをマネージドに使える。

- **SQS**: キュー (1 メッセージ = 1 Consumer)
- **SNS**: PubSub (1 メッセージ = 複数 Subscriber)
- **EventBridge**: ルールベースのイベントバス、AWSサービス連携

SQS Standardはat-least-once配信で、まれな重複と順序の入れ替わりを前提にする。FIFOは順序と重複排除機能を提供するが、重複排除IDの範囲・期間、consumer障害、外部副作用まで含む「永久に一度だけの処理」を保証するものではない。

SQS/SNSはブローカー運用をAWSへ委ねられるが、可視性タイムアウト、DLQ、リトライ、重複、順序、スループット、IAM、コストは利用側が設計する。AWS上の疎結合ジョブでは有力な開始点だが、長期保持、リプレイ、ストリーム処理、複数独立consumer groupが必要ならKafka系も比較する。

<a id="section-17-6"></a>
### 17.6 ジョブキュー ― Web アプリでの定番
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"B","term":"BullMQ"} -->
<!-- handbook:index {"group":"わ行","term":"ワーカー (Worker)"} -->

<!-- handbook:narrative-bridge {"section":"17.6"} -->
汎用メッセージ基盤が必要でないWebアプリでも、メール送信、画像変換、定期集計を要求処理から外したい場面は多い。ジョブキューはアプリケーションの関数実行へ焦点を絞り、リトライ、予約、ワーカー管理を扱う。

Web アプリで「メール送信」「画像変換」「日次集計」のような非同期ジョブを処理するライブラリ。

**BullMQ (Node.js + Redis):**

```typescript
import { Queue, Worker, QueueEvents } from 'bullmq';

const connection = { host: 'localhost', port: 6379 };

// ジョブを追加 (Producer)
const emailQueue = new Queue('emails', { connection });

await emailQueue.add('welcome', { to: 'alice@x.com' }, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: 100,  // 直近100件のみ保持
});

// ジョブを処理 (Worker)
const worker = new Worker('emails', async (job) => {
  console.log(`Processing job ${job.id}: ${job.name}`);
  await sendEmail(job.data.to);
}, { connection, concurrency: 5 });

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});

// 定期実行 (cron 風)
await emailQueue.add('digest', { type: 'weekly' }, {
  repeat: { pattern: '0 9 * * MON' },  // 月曜9時
});
```

**選択基準:**

| 用途 | 推奨 |
|---|---|
| Node.js プロジェクトの非同期ジョブ | BullMQ |
| Ruby/Rails | Sidekiq |
| Python | Celery |
| 大規模 (秒間万件) | Kafka |
| AWS フルマネージド | SQS + Lambda |

<a id="section-17-7"></a>
### 17.7 Pub/Sub パターンと Fan-out
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"A","term":"Aggregate (集約)"} -->
<!-- handbook:index {"group":"F","term":"Fan-out"} -->
<!-- handbook:index {"group":"P","term":"Pub/Sub"} -->

<!-- handbook:narrative-bridge {"section":"17.7"} -->
一つのキューを複数ワーカーで分担すると処理能力は上がるが、同じ出来事を検索、通知、分析がそれぞれ受け取る要件は満たせない。Pub/SubとFan-outは一つのイベントを複数の独立した購読先へ複製する。

1つのイベントを複数のサービスに配信するパターン。

```text
[ユーザー登録イベント] → [Topic]
                            ├→ [Email Service] (ウェルカムメール)
                            ├→ [Analytics] (登録ログ記録)
                            ├→ [CRM] (顧客情報同期)
                            └→ [Slack] (内部通知)
```

各サービスは互いを知らない。発行側は「イベントを発行する」だけ。

**実装パターン:**

- Kafka: 同じ topic を複数の consumer group が独立に読む
- RabbitMQ: Fanout exchange で全 queue にコピー
- Redis: PubSub (ただし永続化なし、消費前のクラッシュで消える)
- SNS + SQS: 1つのSNSトピックに複数SQSキューを紐付け

<a id="section-17-8"></a>
### 17.8 イベントソーシング (Event Sourcing)
<!-- handbook:learning {"level":"advanced","minutes":5} -->
<!-- handbook:index {"group":"E","term":"Event Sourcing"} -->
<!-- handbook:index {"group":"あ行","term":"イベントソーシング"} -->
<!-- handbook:index {"group":"た行","term":"ドメインイベント"} -->

<!-- handbook:narrative-bridge {"section":"17.8"} -->
イベントを連携通知として使うだけでなく、状態変更の履歴そのものを正本にすると、現在値だけでは失われる理由と経緯を再現できる。イベントソーシングは状態をイベント列から導出し、監査と再構築を可能にする代わりにモデルの複雑さを増やす。

「**状態を保存する代わりに、状態を変更したイベントを保存する**」アーキテクチャ。

**従来 (状態指向):**

```sql
-- accounts テーブルに現在の残高を保持
UPDATE accounts SET balance = 1000 WHERE id = 42;
```

**イベントソーシング:**

```text
events:
  - { type: AccountCreated, id: 42, initialBalance: 0 }
  - { type: Deposited,     id: 42, amount: 500 }
  - { type: Deposited,     id: 42, amount: 700 }
  - { type: Withdrawn,     id: 42, amount: 200 }
```

現在の残高 = 全イベントを順に適用した結果 (0 + 500 + 700 - 200 = 1000)。

**利点:**

- 完全な監査ログが標準で得られる
- 過去の任意時点の状態を再現できる
- 「もし変更がなかったら」のシミュレーションが可能
- 新しい View を後から追加できる (全イベントを再投影)

**欠点:**

- 複雑になる、運用ノウハウが少ない
- イベントスキーマの変更が難しい (過去のデータも壊さない)
- クエリ性能のため別途リードモデルを作る必要 (CQRS)

<a id="section-17-9"></a>
### 17.9 CQRS (Command Query Responsibility Segregation)
<!-- handbook:learning {"level":"advanced","minutes":5} -->
<!-- handbook:index {"group":"C","term":"CQRS"} -->
<!-- handbook:index {"group":"M","term":"Materialized View"} -->
<!-- handbook:index {"group":"ま行","term":"マテリアライズドビュー"} -->

<!-- handbook:narrative-bridge {"section":"17.9"} -->
イベント列は書き込み履歴として自然でも、画面や帳票が必要とする現在形の問い合わせには扱いにくい。CQRSは変更を受け付けるモデルと読み取り用モデルを分離し、用途ごとに最適化する。

「書き込みと読み込みのモデルを分離する」パターン。

```text
[Command] → [Write Model] → [Event Store]
                                  ↓
[Query]   ← [Read Model] ← [Projection]
```

書き込みは正規化された強整合の書き込みモデル、読み込みは非正規化された読み専用モデル。両者は非同期に同期される。

CQRSは複雑なので、要件に対してオーバースペックになりがちだ。**「複雑なドメインで、書き込みと読み込みの要件が大きく異なる」**ときに検討する。

<a id="section-17-10"></a>
### 17.10 Saga パターン ― 分散トランザクション
<!-- handbook:learning {"level":"practical","minutes":25} -->
<!-- handbook:index {"group":"S","term":"Saga パターン"} -->
<!-- handbook:index {"group":"あ行","term":"オーケストレーション (Saga)"} -->
<!-- handbook:index {"group":"か行","term":"コレオグラフィ"} -->

<!-- handbook:narrative-bridge {"section":"17.10"} -->
一つのDB内ならトランザクションで原子性を保てるが、予約、在庫、決済が別サービスに分かれると同じコミット境界を共有できない。Sagaは各サービスのローカルトランザクションを順につなぎ、失敗時には補償操作で業務上の整合性を回復する。

マイクロサービス間でトランザクションをどう実現するか? 単一DBの ACID は使えない。

**Saga**: 複数のローカルトランザクションと、その失敗時に実行する補償アクションとして表現する。補償はDBロールバックではなく新しい業務操作であり、外部送信、配送、相場変動など完全に元へ戻せない処理もある。補償自体の失敗、重複、タイムアウト、手動介入を設計する。

例: 注文処理

```text
1. 注文作成 (Order Service)
2. 在庫予約 (Inventory Service)
3. 決済 (Payment Service)
4. 配送手配 (Shipping Service)
```

3 で失敗したら:
- 2 を補償: 在庫予約を取消
- 1 を補償: 注文をキャンセル状態に

**実装パターン:**

- **オーケストレーション**: 中央のオーケストレータがフローを管理
- **コレオグラフィ**: 各サービスがイベントを発行・購読、自律的に流れる

**コレオグラフィの実装例 (イベント駆動):**

```typescript
// 各サービスは自分の責任のイベントを購読・発行する

// === Order Service ===
async function handleOrderCreated(event: OrderCreatedEvent) {
  await db.order.create({ data: { id: event.orderId, status: 'PENDING' } });
  await mq.publish('OrderConfirmed', { orderId: event.orderId, items: event.items });
}

async function handlePaymentFailed(event: PaymentFailedEvent) {
  // 補償: 注文をキャンセル状態に
  await db.order.update({
    where: { id: event.orderId },
    data: { status: 'CANCELLED', cancelReason: event.reason },
  });
}

// === Inventory Service ===
async function handleOrderConfirmed(event: OrderConfirmedEvent) {
  try {
    await db.$transaction(async (tx) => {
      for (const item of event.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product || product.stock < item.quantity) {
          throw new Error(`Insufficient stock: ${item.productId}`);
        }
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
        await tx.inventoryReservation.create({
          data: { orderId: event.orderId, productId: item.productId, quantity: item.quantity },
        });
      }
    });
    await mq.publish('InventoryReserved', { orderId: event.orderId });
  } catch (e) {
    await mq.publish('InventoryReservationFailed', {
      orderId: event.orderId,
      reason: (e as Error).message,
    });
  }
}

async function handlePaymentFailed(event: PaymentFailedEvent) {
  // 補償: 在庫予約を取消し、商品在庫を戻す
  const reservations = await db.inventoryReservation.findMany({
    where: { orderId: event.orderId },
  });
  await db.$transaction(async (tx) => {
    for (const r of reservations) {
      await tx.product.update({
        where: { id: r.productId },
        data: { stock: { increment: r.quantity } },
      });
    }
    await tx.inventoryReservation.deleteMany({ where: { orderId: event.orderId } });
  });
}

// === Payment Service ===
async function handleInventoryReserved(event: InventoryReservedEvent) {
  try {
    const result = await chargeCard({ orderId: event.orderId, amount: event.amount });
    await mq.publish('PaymentSucceeded', { orderId: event.orderId, paymentId: result.id });
  } catch (e) {
    await mq.publish('PaymentFailed', { orderId: event.orderId, reason: (e as Error).message });
  }
}

// === Shipping Service ===
async function handlePaymentSucceeded(event: PaymentSucceededEvent) {
  await arrangeShipping(event.orderId);
  await mq.publish('ShippingArranged', { orderId: event.orderId });
}
```

各サービスは「自分が成功したら次のイベント発行」「失敗イベントを受けたら補償」を担う。中央調整役がいないので、自律的に流れる代わりに**全体像を追うのが難しい**(誰が何を購読しているか、ドキュメントが要る)。

**オーケストレーション版 (中央調整役):**

```typescript
class OrderSagaOrchestrator {
  async execute(orderInput: OrderInput): Promise<void> {
    const sagaId = crypto.randomUUID();
    const log: Array<{ step: string; compensate: () => Promise<void> }> = [];

    try {
      // ステップ1: 注文作成
      const order = await orderService.create(orderInput);
      log.push({ step: 'createOrder', compensate: () => orderService.cancel(order.id) });

      // ステップ2: 在庫予約
      const reservation = await inventoryService.reserve(order.id, order.items);
      log.push({ step: 'reserveInventory', compensate: () => inventoryService.release(reservation.id) });

      // ステップ3: 決済
      const payment = await paymentService.charge(order.id, order.total);
      log.push({ step: 'chargePayment', compensate: () => paymentService.refund(payment.id) });

      // ステップ4: 配送手配
      await shippingService.arrange(order.id);

    } catch (err) {
      // 補償アクションを逆順に実行
      for (const entry of log.reverse()) {
        try {
          await entry.compensate();
        } catch (compErr) {
          // 補償自体の失敗 → アラート飛ばして手動対応へ
          await alertOps(sagaId, entry.step, compErr);
        }
      }
      throw err;
    }
  }
}
```

オーケストレーションの方が「フローが1箇所に集約されて読みやすい」が、調整役がボトルネックになる。使い分けの目安は、**分岐がなく一方向に流れるならコレオグラフィ、条件分岐と補償が絡むならオーケストレーション**である。

Saga は分散システムの根本的な複雑さを引き受ける。可能なら**モジュラモノリス**で単一DBの ACID で済ませる方がシンプル (第26章のアーキテクチャで詳述)。

<a id="section-17-11"></a>
### 17.11 Outbox パターン ― 信頼性の高いイベント発行
<!-- handbook:learning {"level":"required","minutes":10} -->
<!-- handbook:index {"group":"O","term":"Outbox パターン"} -->

<!-- handbook:narrative-bridge {"section":"17.11"} -->
Sagaやイベント通知を設計しても、DB更新に成功した直後、イベント送信前にプロセスが停止する二重書き込み問題が残る。Outboxは業務更新と送信予定を同じDBトランザクションへ記録し、配送を後段へ分離する。

DBへの書き込みと、メッセージ発行の両方を行いたい。両者をアトミックにしないと、「DB更新したのにイベント発行失敗」「イベント発行したのにDB更新失敗」が起きる。

```typescript
// BAD: 部分失敗のリスク
async function createOrder(data: OrderData) {
  const order = await db.order.create({ data });
  await mqClient.publish('order-created', { orderId: order.id });
  // ↑ ここで失敗するとイベントが発行されない
}
```

**Outbox パターン:**

DB内に「未発行イベント」テーブルを作り、本体のテーブル更新と同じトランザクション内で書き込む。別プロセスが outbox を監視してメッセージ発行 + 削除する。

```typescript
async function createOrder(data: OrderData) {
  await db.$transaction(async (tx) => {
    const order = await tx.order.create({ data });
    await tx.outbox.create({
      data: {
        topic: 'order-created',
        payload: JSON.stringify({ orderId: order.id }),
      },
    });
  });
  // この時点で DB は ACID。outbox エントリも確実に作られている
}

// 別プロセス (バックグラウンド)
async function publishOutbox() {
  while (true) {
    const events = await db.outbox.findMany({ take: 100, orderBy: { id: 'asc' } });
    for (const e of events) {
      try {
        await mqClient.publish(e.topic, JSON.parse(e.payload));
        await db.outbox.delete({ where: { id: e.id } });
      } catch (err) {
        // 次のループでリトライ
        break;
      }
    }
    await sleep(1000);
  }
}
```

これにより、業務データと「発行すべきイベント」の記録は同じDBトランザクションで確定できる。ただしpublish成功後にoutbox削除前で停止すると再送されるため、配信は通常at-least-onceになる。複数relayの行ロック/lease、イベントID、consumer側の冪等性、保持・リトライ・DLQを設計する。DebeziumのOutbox Event Routerでrelayを構成する方法もある。

<a id="section-17-12"></a>
### 17.12 CDC (Change Data Capture) ― DBの変更をイベント化する
<!-- handbook:learning {"level":"practical","minutes":20} -->
<!-- handbook:index {"group":"C","term":"CDC (Change Data Capture)"} -->
<!-- handbook:index {"group":"D","term":"Debezium"} -->
<!-- handbook:index {"group":"ら行","term":"論理レプリケーション"} -->

<!-- handbook:narrative-bridge {"section":"17.12"} -->
Outboxはアプリケーションが業務イベントを明示できる一方、既存システムを変更せず行更新を外部へ流したい場合には導入が難しい。CDCはDBの変更ログを読み、正本の更新をストリームとして取り出す。

Outboxパターンはアプリ層で業務イベントを明示的に記録する。一方のCDCはDBの変更ログを読み、行変更イベントとして配信する。既存の更新コードを大きく変えずデータ連携を追加できる場合はあるが、意味のある業務イベント、スキーマ、PII (Personally Identifiable Information)、削除、再処理、consumer互換性は別途設計する。

#### 仕組み

PostgreSQL は WAL (Write-Ahead Logging)、MySQL は binlog、MongoDB は oplog という変更ログを内部的に持つ。CDC ツールはこれを読み取り、Kafka などへ流す。

```text
[Postgres] → WAL → [Debezium] → [Kafka topic: orders.public.users]
                                       ↓
                              [Search Service] (Elasticsearch同期)
                              [Analytics] (DWH 投入)
                              [Cache] (Redis 無効化)
                              [Webhook] (外部システム通知)
```

アプリは普通に `UPDATE users SET ...` するだけ。CDC が後ろで変更を全配信する。

#### Debezium の利点

- **行変更を捕捉**: 対象テーブルのINSERT/UPDATE/DELETEをWALから配信できる
- **オフセットから再開**: 正しく構成・監視されたレプリケーションスロットとconsumer offsetにより再開できる。ただしスロット喪失、WAL削除、設定不備、障害復旧手順によってデータ欠落は起こりうる
- **トランザクション情報**: コネクタ設定とイベント形式により、同一トランザクションの関係を扱える
- **運用責任**: consumer停止中はレプリケーションスロットがWALを保持し、ディスクを圧迫しうる。WAL保持量、slot lag、コネクタ状態、バックプレッシャーを監視する

#### PostgreSQL + Debezium の設定

```sql
-- Postgres 側: 論理レプリケーションを有効化
-- 注意: wal_level の変更は再起動が必要で、稼働中のDBでは接続がすべて切れる。
-- メンテナンス時間を確保し、切り戻し手順を決めてから実行する。
-- 論理レプリケーションを有効にするとWALの量が増えるため、
-- ディスクの空きとレプリケーションスロットの滞留も監視対象へ加える。
-- スロットを作ったまま消費者が止まると、WALが溜まり続けてディスクを埋める
ALTER SYSTEM SET wal_level = 'logical';
ALTER SYSTEM SET max_replication_slots = 4;
ALTER SYSTEM SET max_wal_senders = 4;
-- ここで再起動 (メンテナンス時間内に実施)

-- 専用ユーザー作成。パスワードはシークレット管理から渡し、SQLへ直接書かない
CREATE ROLE debezium WITH REPLICATION LOGIN PASSWORD :'cdc_password';

-- 公開するテーブルだけへ権限を与える。ALL TABLES を渡すと、
-- 個人情報を含む表まで CDC 経路へ流れうる (14.25 の許可リストの原則)
GRANT SELECT ON users, orders, products TO debezium;

-- パブリケーション (どのテーブルを公開するか)
CREATE PUBLICATION debezium_pub FOR TABLE users, orders, products;
```

公開するのはテーブル単位だが、列の中身までは絞れない。氏名やメールアドレスのように下流へ出したくない列がある場合は、CDCの対象を別に用意した射影用のテーブルかビューに限る、あるいは下流の入口でマスクする。

```yaml
# Debezium コネクタ設定 (Kafka Connect 用)
name: postgres-connector
config:
  connector.class: io.debezium.connector.postgresql.PostgresConnector
  database.hostname: postgres.internal
  database.port: 5432
  database.user: debezium
  database.password: xxx
  database.dbname: app_production
  database.server.name: orders
  plugin.name: pgoutput
  publication.name: debezium_pub
  table.include.list: public.users,public.orders,public.products
  topic.prefix: orders
  # この例ではDebezium envelopeを保持し、consumerがop/before/afterを読む。
  # ExtractNewRecordStateでunwrapする場合はconsumer側のイベント形式も変更する。
```

これで Kafka に `orders.public.users` トピックが作られ、ユーザーテーブルの変更が流れ続ける。

#### Consumer 側

```typescript
import { Kafka } from 'kafkajs';

const kafka = new Kafka({ brokers: ['kafka:9092'] });
const consumer = kafka.consumer({ groupId: 'search-indexer' });

await consumer.connect();
await consumer.subscribe({ topic: 'orders.public.users', fromBeginning: false });

await consumer.run({
  eachMessage: async ({ message }) => {
    const event = JSON.parse(message.value!.toString());
    const op = event.op;  // 'r' = 初期スナップショット, 'c' = create, 'u' = update, 'd' = delete

    // 'r' を落とすと初回同期分が索引へ入らない。取りこぼしやすい分岐である
    if (op === 'r' || op === 'c' || op === 'u') {
      const user = event.after;
      await elasticsearchClient.index({
        index: 'users',
        id: user.id,
        document: user,
      });
    } else if (op === 'd') {
      const user = event.before;
      await elasticsearchClient.delete({ index: 'users', id: user.id });
    }
  },
});
```

#### CDC と Outbox の使い分け

| | Outbox | CDC |
|---|---|---|
| アプリコード変更 | 必要 (`outbox` テーブル書き込み) | 行変更の捕捉だけなら小さい。業務イベント化・スキーマ安定化には変更が必要な場合がある |
| ペイロード設計の自由度 | 高 (アプリで構造を決める) | 低 (テーブルの行そのまま) |
| 運用負荷 | 軽 | 重 (Kafka Connect、レプリスロット監視) |
| ビジネスイベントの表現 | 自然 (`UserRegistered` 等) | テーブル変更ベースに留まる |

設計上の判断:

- **ビジネスイベントを発行したい** → Outbox(ドメイン語彙でイベント設計)
- **既存システムを変えずデータ連携したい** → CDC(配信側非介入)
- **両方** → OutboxテーブルをCDCで配送し、業務イベント設計とログベース配送を組み合わせる方法がある

#### Debezium 以外の選択肢

- **AWS DMS (Database Migration Service)**: マネージド CDC、DWH 連携が容易
- **Materialize**: ストリーミング SQL、リアルタイムマテビュー
- **Conduit**: Go 製の軽量 CDC、Kafka Connect の代替

<a id="section-17-13"></a>
### 17.13 Webhook 受信の実務 ― 再送、順序逆転、冪等性
<!-- handbook:learning {"level":"practical","minutes":25} -->
<!-- handbook:index {"group":"W","term":"Webhook 受信"} -->
<!-- handbook:index {"group":"さ行","term":"再送 (Webhook)"} -->
<!-- handbook:index {"group":"さ行","term":"順序逆転"} -->
<!-- handbook:index {"group":"た行","term":"突合 (reconciliation)"} -->

<!-- handbook:narrative-bridge {"section":"17.13"} -->
17.11 の Outbox は、自分のシステムの中でイベントを確実に外へ出す仕組みだった。外から届くイベントには、この保証が付いていない。12.15 で送信側が「重複する・順序は保証しない・欠落しうる」と宣言した以上、受信側はその3つを前提に組む必要がある。本節では、その受け口の設計を扱う。

Webhook の受信ハンドラは、見た目は単なる `POST` のエンドポイントである。しかし性質としては、**制御できない発行者からの、順不同・重複あり・欠落ありのメッセージ購読**であり、17.2 のメッセージキューの消費者と同じ設計問題を持つ。違いは、リトライ方針とバックプレッシャーの主導権が相手側にあることだけである。

#### 受理と処理を分ける

最初に決めるのは、ハンドラの中で業務処理まで済ませるかどうかである。答えはほぼ常に「済ませない」になる。

```text
受理 (数十ミリ秒で終わらせる)
  1. 生ボディを保持する
  2. 署名とタイムスタンプを検証する      → 失敗なら 401 (再送させない)
  3. イベントIDで重複を判定する          → 既知なら 200 (何もしない)
  4. 生ボディごと受信テーブルへ INSERT する
  5. 200 を返す
                    │
処理 (別プロセス、リトライ可能) ──┘
  6. ジョブとして取り出し、業務処理を行う
  7. 失敗は 17.3 の DLQ とバックオフへ
```

分ける理由は3つある。第一に、送信側のタイムアウトは短い (12.15 で見たように数秒であることが多い)。第二に、業務処理が失敗したときのリトライを、相手の再送方針ではなく自分のキューの方針で決められる。第三に、受信の記録が残るため、後から再処理と調査ができる。

受理を軽くするほど、送信側から見た成功率が上がる。成功率が上がると、送信側の自動停止 (12.15) に引っかからなくなる。

#### 署名検証で落とす3つの罠

```typescript
import crypto from 'node:crypto';

const TOLERANCE_SECONDS = 5 * 60;

export function verify(
  rawBody: Buffer,                 // 罠1: パース前の生バイト列でなければならない
  headers: Record<string, string>,
  secrets: Map<string, Buffer>,    // 罠3: 鍵は複数受け付ける
  nowSeconds: number,
): { ok: true; eventId: string } | { ok: false; reason: string } {
  const eventId = headers['webhook-id'];
  const timestamp = Number(headers['webhook-timestamp']);
  if (!eventId || !Number.isFinite(timestamp)) return { ok: false, reason: 'missing headers' };

  // 罠2: 許容差を持たせつつ、未来側にも上限を置く。片側だけだとリプレイが通る。
  if (Math.abs(nowSeconds - timestamp) > TOLERANCE_SECONDS) {
    return { ok: false, reason: 'timestamp outside tolerance' };
  }

  const signed = Buffer.concat([Buffer.from(`${eventId}.${timestamp}.`, 'utf8'), rawBody]);
  const presented = (headers['webhook-signature'] ?? '').split(' ');
  for (const token of presented) {
    // `v1,<base64>` の形。カンマの前は署名バージョンであって鍵IDではない。
    // どの鍵で署名されたかは分からないので、保持している鍵をすべて試す。
    const at = token.indexOf(',');
    if (at < 0) continue;
    const value = token.slice(at + 1);
    if (!value) continue;
    const actual = Buffer.from(value, 'base64');
    for (const key of secrets.values()) {
      const expected = crypto.createHmac('sha256', key).update(signed).digest();
      // 長さが違うと timingSafeEqual は例外を投げるため、先に確認する。
      if (actual.length === expected.length && crypto.timingSafeEqual(actual, expected)) {
        return { ok: true, eventId };
      }
    }
  }
  return { ok: false, reason: 'no matching signature' };
}
```

- **罠1 (生ボディ)**: フレームワークのJSONボディパーサが先に走ると、`JSON.parse` して `JSON.stringify` し直した文字列で検証することになる。キーの順序、数値の表記、Unicodeのエスケープが1バイトでも変われば署名は一致しない。しかも、**一致することもある**ため、開発環境では通って本番で落ちるという最悪の壊れ方をする。該当ルートだけ生ボディを保持する設定を入れる。
- **罠2 (時刻)**: 許容差が広すぎるとリプレイの窓が広がり、狭すぎると自分たちのサーバの時刻ずれで正当な通知を落とす。NTPで同期していることを前提に数分程度に置き、超過は監視する。
- **罠3 (鍵)**: 送信側が鍵をローテーションすると、切り替えの瞬間に旧鍵と新鍵が混在する。受け付ける鍵を1つに固定した実装は、この期間の通知をすべて落とす。

署名検証の失敗は 4xx を返す。5xx を返すと、相手は「一時的な障害」とみなして再送を続け、無効なリクエストが延々と届く。

#### 冪等性 ― 何を鍵にするか

重複を防ぐ鍵は、扱う操作の性質で変わる。

| 鍵 | 防げるもの | 防げないもの |
|---|---|---|
| イベントID | 同じイベントの再送 | 内容が同じ別イベント (`id` が違う二重発行) |
| (リソースID, 版番号) | 同じ状態への重複反映 | 版番号を持たない相手 |
| 業務上の自然キー | 経路をまたいだ二重登録 | キーが後から変わる業務 |

もっとも実装が単純で、効き目も確実なのは**一意制約による重複判定**である。「先に読んで、無ければ書く」形は、同じイベントが並行して2本届くと両方が「無い」を見て二重処理になる。

```sql
CREATE TABLE inbound_event (
  event_id     text PRIMARY KEY,          -- 一意制約が重複判定そのものになる
  source       text NOT NULL,
  received_at  timestamptz NOT NULL DEFAULT now(),
  payload      jsonb NOT NULL,
  state        text NOT NULL DEFAULT 'RECEIVED'   -- RECEIVED / DONE / FAILED
);
```

```typescript
export async function accept(source: string, eventId: string, payload: unknown) {
  try {
    await db.inboundEvent.create({ data: { eventId, source, payload } });
  } catch (error) {
    if (isUniqueViolation(error)) return { duplicate: true };   // 何もしないで 200
    throw error;
  }
  await queue.add('handle-inbound-event', { eventId });
  return { duplicate: false };
}
```

受信テーブルは無限に伸びる。重複判定に必要な期間は、相手の再送打ち切り期間 (12.15 でいう3日) より少し長ければ足りる。それを超えた行はパーティション単位で落とすか、`received_at` で定期削除する。削除期間を再送期間より短くすると、遅れて届いた再送を新規イベントとして二重処理する。

#### 順序逆転への3つの対処

再送とネットワークの都合で、後に起きたイベントが先に着く。「有効化」の後に「作成」が届く、といったことが実際に起きる。対処は3つあり、どれを選ぶかは扱うデータで決まる。

**(1) 版番号で古い更新を捨てる。** 相手が版番号または更新時刻を送ってくる場合、これが最も安い。

```typescript
// 更新条件に版番号を入れる。古いイベントは 0 行更新になり、静かに無視される。
const updated = await db.subscription.updateMany({
  where: { id: event.data.id, version: { lt: event.data.version } },
  data: { status: event.data.status, version: event.data.version },
});
if (updated.count === 0) log.info('stale event ignored', { eventId: event.id });
```

**(2) 状態を取りに行く (reconcile)。** イベントの本文を信じず、「このリソースが変わった」という合図としてだけ使い、現在の状態は相手のAPIから取得する。順序逆転は原理的に起きなくなる。代償はAPI呼び出しの増加であり、レート制限 (17.15) と相談することになる。多くの事業者が推奨するのはこの形である。

**(3) キーごとに順番待ちにする。** 同じリソースに対する処理を1本のキューに寄せ、順番に処理する。17.4 のパーティションキーと同じ考え方で、リソースIDをキーにする。スループットは落ちるが、順序が業務的に意味を持つ場合 (残高の増減など) には必要になる。

避けるべきなのは、到着順をそのまま業務の順序とみなす実装である。テスト環境では順序どおり届くため、この誤りは本番でしか現れない。

#### 欠落への対処 ― 突合を最初から作る

再送を尽くしても届かないイベントは必ず出る。相手の障害、自分たちの長時間の停止、自動停止からの復旧遅れが原因になる。したがって、**イベントだけを唯一の情報源にしない**。

- 定期的に相手の一覧APIを引き、自分の状態と食い違う行を洗い出す (突合)。頻度は日次で足りることが多い。
- 突合で見つかった差分は、件数をメトリクスとして出す。0件が続いていた指標が跳ねたら、Webhook 経路が壊れている合図になる。
- 相手がイベントの再送APIを提供している場合は、突合で見つけた期間を指定して取り直す。

突合の実装は地味だが、Webhook を使う機能の信頼性はほぼこれで決まる。決済や契約状態のように「食い違うと金銭が動く」領域では、突合のない Webhook 連携は運用に載せられない。

#### 失敗をどう返すか

| 状況 | 返す状態コード | 理由 |
|---|---|---|
| 署名不正・形式不正 | 400 / 401 | 再送しても直らない。再送させない |
| 未知のイベント種別 | 200 | 相手が新種を追加しただけ。受理して無視する |
| 自分たちのDBが一時的に落ちている | 500 | 相手の再送に乗る。これが最も安全 |
| 業務処理が恒久的に失敗する | 200 + 内部でDLQへ | 相手に無限再送させず、自分の DLQ で扱う |

3行目と4行目の使い分けが要点になる。**受理できない (RECEIVED にすら入らない) ときだけ 5xx を返す。** 受理した後の失敗を 5xx で返すと、相手の再送と自分のリトライが二重に走り、負荷が掛け算になる。

#### 観測すべき指標

- **受信から処理完了までの遅延**、および `created_at` から受信までの遅延。後者が伸びていれば相手側の滞留である。
- **重複率**。急に上がったら、こちらの 200 応答が遅くなって相手がタイムアウトしている疑いがある。
- **署名検証失敗数**。0でない状態が続くなら、鍵の設定ミスか、生ボディの扱いが壊れている。
- **突合で見つかる差分件数**。

#### つまずく箇所 ― Webhook の受信

- **ボディパーサの後で署名を検証する**: 開発環境で偶然通ることがあるため、発見が遅れる。生ボディを保持する設定を、該当ルートに限定して入れる。
- **「読んでから書く」で重複を判定する**: 並行して届いた同一イベントが両方通る。一意制約に判定させる。
- **受信テーブルの保持期間を短くする**: 再送打ち切り期間より短いと、遅延した再送が新規として二重処理される。
- **処理の失敗を 5xx で返し続ける**: 相手の再送が止まらず、自分の負荷も相手の配送キューも詰まる。受理と処理を分けたうえで、処理の失敗は自分の DLQ で扱う。
- **突合を後回しにする**: 欠落は必ず起きる。突合がないと、食い違いは利用者の問い合わせで発覚することになる。

<a id="section-17-14"></a>
### 17.14 メール送信の実務 ― 配送経路、バウンス、DKIM/SPF/DMARC
<!-- handbook:learning {"level":"practical","minutes":25} -->
<!-- handbook:index {"group":"D","term":"DKIM 署名検証"} -->
<!-- handbook:index {"group":"D","term":"DMARC アラインメント"} -->
<!-- handbook:index {"group":"S","term":"SPF レコード"} -->
<!-- handbook:index {"group":"は行","term":"バウンス処理"} -->
<!-- handbook:index {"group":"は行","term":"配信抑制リスト"} -->

<!-- handbook:narrative-bridge {"section":"17.14"} -->
17.13 で扱ったのは、外から届くイベントの受け口だった。メールはその逆向きで、こちらから出した通知が、自分の管理下にない多段の経路を通って届く。送信APIが 200 を返しても届いたことにはならないという点で、これも非同期の配送問題である。本節では、その経路と失敗の受け取り方を扱う。

`sendMail()` が成功しても、メールは届いていない。返ってきた 200 は「預かった」の意味であり、そこから先は受信側のフィルタまで含む多段の配送になる。つまりメール送信は、**結果が後から非同期に返ってくる外部連携**であり、17.13 の Webhook 受信と同じ形の設計が要る。

```text
アプリ ──API──> 送信プロバイダ(MSA) ──SMTP──> 受信側MX ──> フィルタ ──> 受信箱
   ▲                    │                                   │
   └── 配送イベント ─────┘                                   │
       (delivered / bounced / complained) <──── DSN / FBL ───┘
```

#### 2つの From と、なりすまし対策の全体像

SMTP には送信者を表す欄が2つある。ここを区別しないと、SPF と DMARC の関係が理解できない。

| 欄 | 別名 | 誰が見るか | 用途 |
|---|---|---|---|
| エンベロープ From (`MAIL FROM`) | Return-Path | メールサーバ | バウンスの返送先。SPF の検査対象 |
| ヘッダ From (`From:`) | 表示上の差出人 | 利用者 | 画面に出る。DMARC の整合判定の基準 |

利用者が見るのはヘッダ From だけである。なりすましを防ぐとは、**このヘッダ From を騙れないようにする**ことにほかならない。3つの仕組みが役割を分担する。

- **SPF** [RFC 7208]: 「このドメインの名前でメールを出してよい送信元IPはこれだ」をDNSのTXTレコードで宣言する。検査対象はエンベロープ From のドメインである。転送されると送信元IPが変わるため、転送で壊れる。
- **DKIM** [RFC 6376]: メールのヘッダと本文に電子署名を付け、公開鍵を `<selector>._domainkey.<domain>` のDNSに置く。検査するのは署名した `d=` ドメインである。本文が書き換わらなければ転送でも残る。
- **DMARC** [RFC 7489]: 「SPF か DKIM の**どちらかが通り、かつそのドメインがヘッダ From と整合 (alignment) している**」を要求し、満たさない場合の扱い (`none` / `quarantine` / `reject`) を宣言する。加えて、検査結果の集計レポートを受け取る宛先を指定できる。

```dns
example.com.                 IN TXT "v=spf1 include:_spf.provider.example -all"
s1._domainkey.example.com.   IN TXT "v=DKIM1; k=rsa; p=MIIBIjANBgkq..."
_dmarc.example.com.          IN TXT "v=DMARC1; p=none; rua=mailto:dmarc-rua@example.com; fo=1"
```

整合 (alignment) が要点である。SPF が通っていても、それがプロバイダのドメイン (`bounces.provider.example`) に対する `pass` であれば、ヘッダ From の `example.com` とは整合しない。プロバイダ側でカスタムの Return-Path ドメイン (`mail.example.com` など) を設定して初めて、DMARC の観点で意味を持つ。この設定漏れは非常に多い。

#### 導入は必ず `p=none` から

`p=reject` をいきなり設定すると、自分でも把握していない送信元 (勤怠システム、CRM、古いバッチ、事業部が契約した配信サービス) からのメールが、その日から一斉に届かなくなる。手順は固定である。

1. `p=none` と `rua=` を設定し、集計レポートを2〜4週間集める。
2. レポートに現れる送信元IPとドメインを棚卸しし、正当なものはすべて SPF / DKIM を整える。
3. `p=quarantine; pct=25` のように割合を指定して段階的に上げる。
4. 問題が出なければ `p=reject` へ。

集計レポートは XML で届くため、可視化サービスか自作の集計を用意しないと読み切れない。転送やメーリングリストによる失敗が一定数残るのが普通で、これはゼロにできない。ゼロにしようとするより、**正当な送信元をすべて把握できた状態**を到達点にする。

なお、転送で SPF が壊れる問題に対しては ARC という仕組みがあるが、これは主に転送する側 (メーリングリストなど) が実装するものである。送信側のアプリケーションが直接扱うことは少ない。

#### バウンスは戻り値ではなくイベント

送信APIの応答には、届いたかどうかは含まれない。届かなかったことは、後から次の3系統で返ってくる。

| 種類 | 元になる仕組み | 意味 | 対応 |
|---|---|---|---|
| ハードバウンス | DSN [RFC 3464] の恒久エラー (5.x.x) | 宛先が存在しない、ドメインが無い | **即座に抑制リストへ入れ、二度と送らない** |
| ソフトバウンス | DSN の一時エラー (4.x.x) | 容量超過、一時的な拒否 | 回数を数え、連続で続いたら抑制する |
| 苦情 (complaint) | フィードバックループ、ARF [RFC 5965] | 受信者が「迷惑メール」を押した | 抑制リストへ入れる。原因も調べる |

存在しないアドレスへ送り続けると、送信ドメインとIPの評価が下がる。評価が下がると、**正当な宛先にも届かなくなる**。つまり、バウンスの放置は自分の到達率を自分で下げる行為になる。

抑制リストは、プロバイダ側にもあるがそれに任せきりにしない。自分のDBに一次データとして持ち、送信直前に必ず引く。プロバイダを乗り換えたときに履歴が消えるのを防ぐためでもある。

```typescript
type SuppressionReason = 'hard_bounce' | 'complaint' | 'unsubscribed' | 'manual';

export async function sendTransactional(job: { to: string; templateId: string; dedupeKey: string }) {
  const blocked = await db.emailSuppression.findUnique({ where: { address: job.to } });
  if (blocked) return { skipped: true, reason: blocked.reason };

  // 冪等性: ジョブのリトライで二重送信しない。送信「前」に鍵を確保する。
  try {
    await db.emailSend.create({ data: { dedupeKey: job.dedupeKey, address: job.to, state: 'SENDING' } });
  } catch (error) {
    if (isUniqueViolation(error)) return { skipped: true, reason: 'already sent' };
    throw error;
  }

  const providerId = await provider.send({ to: job.to, templateId: job.templateId });
  await db.emailSend.update({ where: { dedupeKey: job.dedupeKey }, data: { state: 'ACCEPTED', providerId } });
  return { skipped: false, providerId };
}
```

送信前に鍵を確保する順序が重要になる。送信してから記録すると、その間でプロセスが落ちたときに再送で二重に届く。逆順にしておけば、最悪でも「記録はあるが送っていない」になり、これは検出も再送も容易である。17.11 の Outbox と同じ考え方である。

配送イベントはプロバイダから Webhook で届く。つまり 17.13 の設計がそのまま必要になる ― 署名検証、重複排除、順序逆転 (`delivered` の後に `bounced` が届くことがある)、そして突合である。

#### 到達率を落とさないための実務

- **プレーンテキスト版を必ず付ける。** HTML のみのメールはスパム判定の材料になる。
- **`List-Unsubscribe` と、ワンクリック解除 [RFC 8058] を付ける。** 主要な受信事業者が一括送信の要件として求めている。解除リンクを探させると、代わりに迷惑メール報告が押される。
- **種別を分ける。** 取引メール (パスワード再設定など) と通知・広告を同じドメイン・同じIPで送ると、広告の苦情率が取引メールの到達率を巻き添えにする。サブドメインを分けるのが基本になる。
- **量を急に増やさない。** 新しい送信元の評価はゼロから始まる。少量から数週間かけて増やす (ウォーミング)。
- **指標を持つ。** 配送率、ハードバウンス率、苦情率を日次で見る。苦情率は千分の一の単位で管理され、少し超えただけで到達率が急落する。

#### 送信そのものを非同期にする

メール送信は外部API呼び出しであり、遅延も失敗もする。リクエスト処理の同期経路から呼ぶと、プロバイダの遅延がそのままAPIの応答時間になる。17.6 のジョブキューへ載せ、リトライとバックオフ (26.7)、そして次節の時間予算とサーキットブレーカを適用する。

ただし、キューに載せた時点で「送信した」と利用者に見せてはならない。パスワード再設定のように、届かないことが利用者を止める種類のメールは、送信状態を確認できる導線 (再送ボタン、状態表示) を併せて用意する。

#### つまずく箇所 ― メール配送

- **Return-Path のドメインを揃えない**: SPF は通るのに DMARC が通らない、という分かりにくい状態になる。整合の対象はヘッダ From のドメインである。
- **`p=reject` を最初に設定する**: 把握していない送信元が全滅する。`p=none` とレポート収集から始める。
- **バウンスを無視する**: 到達率が下がり、原因が「自分たちの送り方」だと気づくまでに数か月かかる。抑制リストは機能の一部である。
- **送信してから記録する**: リトライで二重に届く。鍵の確保を先に行う。
- **配送イベントの Webhook を素朴に実装する**: 署名検証、重複、順序逆転が Webhook 一般の問題としてそのまま出る。17.13 の設計を流用する。

<a id="section-17-15"></a>
### 17.15 外部API連携の実務 ― 時間予算、リトライ、Circuit Breaker
<!-- handbook:learning {"level":"practical","minutes":25} -->
<!-- handbook:index {"group":"C","term":"Circuit Breaker (外部API)"} -->
<!-- handbook:index {"group":"R","term":"Retry-After"} -->
<!-- handbook:index {"group":"さ行","term":"時間予算 (deadline)"} -->
<!-- handbook:index {"group":"ら行","term":"リトライ予算"} -->

<!-- handbook:narrative-bridge {"section":"17.15"} -->
17.14 のメール送信も、17.13 の相手への再取得も、結局は外部サービスへのHTTP呼び出しである。26.6 から26.11 では耐障害性のパターンを個別に見るが、それを「自分が制御できない相手」へ当てはめるときには、追加で決めることがある。本節では、外部API連携に固有の判断をまとめる。

サーキットブレーカ、リトライ、バックオフ、タイムアウト、バルクヘッドといったパターンは 26.6 から 26.11 で扱う。ここで扱うのは、それらを**自分たちが直せない相手**に適用するときの具体である。相手のコードは直せず、相手のデプロイも制御できず、相手の障害情報は自分たちより遅れて届く。

#### 時間予算を上から配る

タイムアウトを各呼び出しでばらばらに決めると、合計が上流のタイムアウトを超える。上流から残り時間を配る形にすると、この破綻が起きない。

```typescript
export type Deadline = { at: number };   // epoch ミリ秒

export function budgetFor(deadline: Deadline, share: number, cap: number): number {
  const remaining = deadline.at - Date.now();
  if (remaining <= 0) throw new DeadlineExceededError();
  // 残り時間の一部だけを1回の呼び出しへ割り当て、上限も置く。
  return Math.min(cap, Math.floor(remaining * share));
}

export async function callProvider<T>(deadline: Deadline, fn: (ms: number) => Promise<T>): Promise<T> {
  const ms = budgetFor(deadline, 0.4, 3_000);
  return withTimeout(fn(ms), ms);
}
```

残り時間が尽きているのに呼び出しを始めるのは、純粋な無駄である。上流はすでに応答を諦めており、こちらの呼び出しは相手に負荷を掛けるだけになる。**始める前に残り時間を確認する**という一行が、障害時の負荷の増幅をかなり抑える。

HTTPクライアントのタイムアウトは1つではない。少なくとも3つを区別して設定する。

| 種類 | 意味 | 目安 |
|---|---|---|
| 接続タイムアウト | TCP接続とTLSハンドシェイクまで | 短く。1秒前後 |
| 読み取りタイムアウト | 最初のバイトが返るまで、あるいは無通信の上限 | 用途による |
| 全体タイムアウト | リトライを含めた合計 | 時間予算から決める |

多くのHTTPクライアントは、デフォルトでこれらのいくつかを無制限にしている。「設定していない」は「無制限」を意味することが多く、相手が応答を返さないまま接続を保持すると、こちら側の接続とスレッドが解放されない。使うクライアントのデフォルト値を必ず確認する。

#### リトライしてよい条件

リトライは、条件を絞らないと**障害を増幅する装置**になる。相手が遅くなっているときに全員がリトライすると、負荷は数倍になり、回復を妨げる。

安全にリトライできるのは次のいずれかを満たす場合に限られる。

1. 呼び出しが冪等である (`GET`、`PUT`、`DELETE` など、意味論として繰り返してよい / RFC 9110 §9.2.2)。
2. 冪等キーを付けており、相手が重複を弾くと明示している。
3. 接続確立前に失敗した (相手はリクエストを受け取っていない)。

`POST` の再送は、応答が返らなかった場合に「相手は処理したのか、していないのか」が原理的に分からない。冪等キーなしでのリトライは、二重課金や二重発注の直接の原因になる。

```typescript
export async function retrying<T>(
  deadline: Deadline,
  budget: RetryBudget,
  attempt: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  let wait = 200;
  for (let i = 0; ; i += 1) {
    try {
      return await attempt(signalFor(deadline));
    } catch (error) {
      if (!isRetryable(error)) throw error;          // 4xx の大半は再試行しても直らない
      if (!budget.tryConsume()) throw error;         // 全体のリトライ量に上限を置く
      const hint = retryAfterMillis(error);          // 429/503 の Retry-After を尊重する
      // 指数バックオフ + 完全ジッタ。ジッタが無いと再試行が同じ瞬間に揃う。
      const backoff = hint ?? Math.floor(Math.random() * Math.min(wait * 2 ** i, 20_000));
      if (Date.now() + backoff >= deadline.at) throw new DeadlineExceededError();
      await sleep(backoff);
    }
  }
}
```

2つの制御が効いている。**リトライ予算**は、たとえば「直近1分間の総リクエストの10%までしかリトライに使わない」といった全体量の制限で、個々の呼び出しのリトライ回数とは別に置く。**完全ジッタ**は、待ち時間を `[0, backoff]` の一様乱数にすることで、同時に失敗した多数のクライアントが同じ瞬間にリトライするのを防ぐ。

相手が `Retry-After` や `RateLimit` 系のヘッダで待つべき時間を返している場合は、こちらの計算より優先する。相手が明示した回復時刻より早く叩くのは、レート制限をさらに引き当てるだけである。

#### サーキットブレーカを相手ごとに置く

相手が落ちているあいだ、呼び出しを試み続けるのは双方にとって損である。サーキットブレーカ [Nygard, 2018] は、失敗が続いたら一定時間**呼び出しを試みずに即座に失敗させる**仕組みで、3つの状態を持つ。

```text
          失敗率がしきい値を超える
  closed ────────────────────────> open
    ▲                               │ 冷却時間の経過
    │  試験呼び出しが成功            ▼
    └───────────────  half-open (同時1本だけ通す)
                          │ 試験呼び出しが失敗
                          └──────> open
```

実装で決めるのは次の4つになる。

- **判定の窓と最小件数**: 「直近20件中5件失敗」のように、件数が少ないうちは開かないようにする。1件の失敗で開くと、通常の揺らぎで頻繁に遮断される。
- **何を失敗と数えるか**: タイムアウトと 5xx は数える。401 や 422 のような自分側の誤りは数えない。数えると、こちらのバグで相手を遮断することになる。
- **冷却時間**: 開いたまま待つ時間。相手の復旧が数分単位なら数十秒程度から始める。
- **half-open の同時実行数**: 1本に絞る。複数通すと、復旧しかけた相手を再び倒す。

ブレーカは**相手ごと、できれば相手のエンドポイント群ごと**に持つ。1つのブレーカを全外部呼び出しで共有すると、決済プロバイダの障害で地図APIまで止まる。同様に、相手ごとに同時実行数の上限 (バルクヘッド、26.8) を置く。上限がないと、遅い1社への呼び出しが接続プールとスレッドを占有し、他のすべてが巻き添えになる。

#### 開いているあいだ何を返すか

ブレーカが開いている、あるいは時間予算が尽きたときの振る舞いを、機能ごとに決めておく。決めていないと、その場のコードが 500 を返すだけになる。

| 縮退の型 | 例 | 適する場面 |
|---|---|---|
| 直近の成功値を返す | 為替レート、機能フラグ、住所検索 | 少し古くても実害がない |
| 機能を隠す | 「おすすめ」欄を表示しない | 補助的な機能 |
| 後で追いつく | 通知・同期をキューへ積む | 即時性が要らない書き込み |
| 明示的に断る | 決済、在庫確保 | 中途半端な成功が許されない |

最後の行が重要である。すべてを縮退させようとすると、「支払わずに注文が通る」ような状態を作る。**縮退しない**という判断も設計の一部であり、その場合は利用者に理由を返し、後でリトライできる導線を用意する。

#### 相手の変化を検出する

外部APIは予告なく変わる。契約を守るための手立てを、連携ごとに用意しておく。

- **記録した応答での再生テスト**: 実際の応答を1度記録し、それに対する自分たちの解釈をテストに固定する。相手の仕様変更そのものは検出できないが、自分たちの回帰は防げる。
- **サンドボックス環境への定期的な疎通**: 本番に影響を与えずに、認証・主要な呼び出し・エラー形式の疎通を日次で確認する。
- **未知の項目・未知の状態を落とさない**: 相手が列挙値を増やしたときに例外で落ちる実装は、相手のリリース日に壊れる。未知の値は保持してデフォルトの扱いにする。
- **秘密の期限を管理する**: APIキーと証明書には有効期限がある。期限の監視を 23.9 のシークレット管理に含める。

#### 相手ごとの指標を持つ

外部連携の障害は、自分たちのメトリクスでは「一部のAPIが遅い」としか見えないことが多い。相手ごとに次を分けて記録すると、切り分けが数分で終わる。

- 呼び出し数、成功率、エラーの内訳 (タイムアウト / 4xx / 5xx)
- 応答時間の分位点 (平均ではなく p95・p99)
- リトライ回数と、リトライ予算の消費率
- ブレーカの状態遷移 (開いた回数、開いていた時間)

22.5 で扱う分散トレースに、相手の呼び出しを1つのスパンとして残しておくと、遅延の原因がどの相手かをそのまま辿れる。

#### つまずく箇所 ― 外部API連携

- **タイムアウトを設定しない**: デフォルトが無制限のクライアントが多い。設定していない箇所は、必ず障害時に見つかる。
- **`POST` を冪等キーなしでリトライする**: 二重課金・二重発注の典型的な原因になる。冪等キーを付けられないなら、リトライしないほうが安全である。
- **ジッタを入れない**: 失敗した全クライアントが同じ瞬間にリトライし、相手の回復を妨げる。
- **ブレーカを共有する**: 1社の障害で無関係な連携まで止まる。相手ごとに分ける。
- **4xx を失敗として数える**: 自分たちの実装の誤りで相手を遮断し、原因の切り分けが難しくなる。
- **縮退の方針を決めていない**: 障害時の挙動が実装者ごとにばらつく。機能ごとに「古い値」「隠す」「後で」「断る」のどれかを事前に決めておく。

<a id="section-17-16"></a>
### 17.16 決済連携の実務 ― 二重課金、返金、突合
<!-- handbook:learning {"level":"practical","minutes":25} -->
<!-- handbook:index {"group":"か行","term":"決済連携"} -->
<!-- handbook:index {"group":"な行","term":"二重課金"} -->
<!-- handbook:index {"group":"は行","term":"返金 (決済)"} -->
<!-- handbook:index {"group":"P","term":"PCI DSS"} -->
<!-- handbook:index {"group":"た行","term":"突合 (決済)"} -->

<!-- handbook:narrative-bridge {"section":"17.16"} -->
17.15 で扱った外部API連携の失敗 ― タイムアウト、リトライ、結果が分からない状態 ― は、相手が決済事業者になると性質が変わる。取得の失敗は再取得すれば済むが、**課金の失敗は「起きたかどうか分からない」という状態を残し、リトライが二重課金になりうる**からである。本節は、17.13 の Webhook 受信と 17.15 の呼び出し設計を前提に、決済に固有の判断だけを扱う。金額そのものの表現は 27.18 にある。

決済は、外部連携の中で唯一「間違えると相手の資産が動く」領域である。設計の出発点は、次の3つを受け入れることである。

1. **自分たちのDBと事業者側の記録は必ずずれる。** 通信は落ちるし、Webhook は遅れるし、欠落もする。
2. **ずれることそのものは避けられない。** 避けられるのは、**ずれたまま気づかないこと**である。
3. **事業者側の記録が正となる。** 自分たちのDBは、そこから導かれた写しである。

**本節は法的助言でも、決済事業に関する規制の解説でもない。** カード情報の取り扱い、決済代行の契約、資金移動や前払式支払手段に関する規制、税の扱いは、国・地域・業種・契約によって大きく異なる。ここで扱うのは、決済事業者を利用する側のアプリケーションが、**技術的に何を保証し、何を保証できないか**に限る。実際の要件は、決済事業者、法務、および必要に応じて監査人へ確認する。

#### カード情報を自前で扱わないという方針

カード会員データの取り扱いには PCI DSS [PCI DSS] という業界標準があり、取り扱う範囲に応じて要求される管理策が変わる。ここで技術判断として明確なのは1点である。**カード番号を自分たちのサーバへ通さない構成を選ぶ。**

具体的には、カード情報の入力欄を決済事業者が提供する部品 (別オリジンの iframe や、事業者のホストする決済画面) に任せ、自分たちのサーバが受け取るのは事業者が発行したトークンだけにする。この構成であれば、カード番号は自分たちのアプリケーション、ログ、DB、バックアップのいずれにも入らない。

- **入力欄を自前で作らない。** 「デザインを揃えたい」という理由で自前のフォームからカード番号を送ると、そのサーバもログもバックアップもすべて対象範囲に入る。事業者の部品は多くの場合、外観をある程度指定できる。
- **カード番号をログに残さない。** 万一経路に入ってしまった場合に備え、22.3 の許可リスト方式 (14.25) を適用しておく。
- **保存するのは事業者の識別子だけにする。** 顧客ID、決済手段ID、取引ID。末尾4桁とブランドは表示のために保存されることが多いが、これも事業者から返る値をそのまま持つ。
- **どこまでが対象範囲かは自分たちで結論を出さない。** 構成によって求められる対応は変わる。決済事業者が提供する資料と、必要なら評価機関に確認する。

#### 二重課金は「結果が分からない状態」から生まれる

決済の作成要求を送り、タイムアウトした。このとき起きうる状態は3つある。

```text
    要求 ──X──> 事業者     : 届いていない。課金されていない
    要求 ─────> 事業者     : 届いた。処理中
    要求 ─────> 事業者 ──X──> 応答が返らなかった。課金は成功している
```

**タイムアウトは失敗ではなく「不明」である。** これを失敗として扱い、新しい取引として作り直すと二重課金になる。17.15 の「`POST` を冪等キーなしでリトライしない」は、決済ではさらに厳しく適用される。

正しい形は、**冪等キーを送信前に確保して永続化し、不明なときは同じ鍵でリトライする**ことである。

```typescript
// 誤り: 応答を受け取ってから記録する
async function chargeWrong(orderId: string, amount: Money) {
  const result = await gateway.createPayment({ amount, idempotencyKey: randomUUID() });
  await db.payment.create({ orderId, externalId: result.id });   // ここへ到達しないことがある
  return result;
}

// 正しい形: 鍵を先に決めて保存し、同じ鍵で再試行する
async function charge(orderId: string, amount: Money) {
  // 1. 鍵は注文ごとに一意で、再試行しても変わらない値から導く
  const attempt = await db.paymentAttempt.upsert({
    where: { orderId },
    create: { orderId, idempotencyKey: `order:${orderId}`, state: 'PENDING' },
    update: {},
  });

  try {
    // 2. 同じ鍵で送る限り、事業者側は同じ取引として扱う
    const result = await gateway.createPayment({ amount, idempotencyKey: attempt.idempotencyKey });
    await db.paymentAttempt.update({ where: { orderId }, data: { state: 'SUCCEEDED', externalId: result.id } });
    return result;
  } catch (error) {
    if (isTimeout(error)) {
      // 3. 不明として記録する。失敗にしない
      await db.paymentAttempt.update({ where: { orderId }, data: { state: 'UNKNOWN' } });
      throw new PaymentPendingError(attempt.idempotencyKey);
    }
    throw error;
  }
}
```

要点は3つある。

- **鍵は業務上の一意な値から導く。** 毎回 `randomUUID()` で作ると、リトライのときに前回の鍵が分からない。注文IDのように、同じ操作なら必ず同じ値になるものを使う。
- **鍵を送信の前に永続化する。** 送ってから記録する形は、記録の直前で落ちた場合に鍵を失う。
- **`UNKNOWN` という状態を持つ。** 「成功」でも「失敗」でもない状態を型に載せないと、コードのどこかで失敗として扱われる。この状態からの回復は、同じ鍵での再送か、事業者への照会で行う。

なお、26.10 が扱う冪等性は**自分たちのAPIが受ける側**の話であり、12.15・17.13 の冪等性は**Webhook を受ける側**の話である。ここで扱っているのは**自分たちが呼ぶ側**であり、鍵を作って持つ責任が自分たちにある点が違う。3つは補完関係にあり、決済ではすべてが必要になる。

#### 状態は事業者から受け取り、自分たちで進めない

決済完了後のリダイレクト先 (`success_url` 等) で権利を付与する設計は、必ず破綻する。ブラウザは閉じられるし、ネットワークは切れるし、URL は書き換えられる。30.13.1 が指摘するとおり、**状態は Webhook で受け取る**。

受信側の実装 (生ボディでの署名検証、イベントIDによる一意制約、順序逆転への対処、突合、状態コードの返し分け) は 17.13 のとおりであり、決済でも変わらない。決済に固有なのは、**受け取った状態を自分たちのどの状態へ写すか**である。

```text
                  ┌────────────────────────────────┐
  PENDING ──────> │ AUTHORIZED ──> CAPTURED        │ ──> REFUNDED (全額/一部)
     │            └────────────────────────────────┘
     └──> FAILED                    │
                                    └──> DISPUTED（申し立て）
```

- **与信 (authorize) と売上確定 (capture) を分ける事業者が多い。** 与信の時点では、まだ資金は動いていない。与信には有効期限があり、期限切れになると自動的に解放される。「与信が通ったから商品を発送する」設計は、確定を忘れると請求されない。
- **失敗は終端ではない。** 定期課金では、支払い失敗のあとに事業者が自動でリトライする (ダニング)。失敗の通知を受けた瞬間に契約を解除すると、その後の成功で復活させる処理が必要になる。**猶予期間を持つ状態** (`PAST_DUE` など) を設ける。
- **申し立て (チャージバック) は、確定のあとから来る。** 数か月後に来ることもある。売上が確定した時点でデータを削除してしまうと、対応できない。14.26 の保持期間の設計に、この期間を織り込む。
- **状態の写し取りは版で守る。** 17.13 の順序逆転への対処をそのまま適用する。古い状態の通知が後から届いて、`CAPTURED` を `PENDING` へ戻す事故は実際に起きる。

#### 返金は「元の取引に紐づく別の取引」である

返金を「課金の取り消し」として実装すると、必ず破綻する。返金は独立した取引であり、次の性質を持つ。

- **元の取引に紐づく。** どの決済に対する返金かが決まっている。
- **複数回起こりうる。** 部分返金を繰り返すことができる。
- **累計に上限がある。** 返金額の合計は、元の決済額を超えられない。
- **失敗しうる。** 事業者側の残高不足、期限切れ、決済手段の失効。

したがって、返金には**返金だけのテーブル**が要る。決済の行に `refunded_amount` を持たせて更新する形は、並行する2つの返金要求で両方が上限検査を通過してしまう (17.13 の「読んでから書く」と同じ失敗である)。

```sql
CREATE TABLE refund (
  id              uuid PRIMARY KEY,
  payment_id      uuid NOT NULL REFERENCES payment(id),
  idempotency_key text NOT NULL UNIQUE,        -- 再試行しても増えない
  amount_minor    bigint NOT NULL CHECK (amount_minor > 0),
  currency        text NOT NULL,
  state           text NOT NULL,               -- PENDING / SUCCEEDED / FAILED
  reason          text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 累計の上限は、行を数える側で守る
CREATE INDEX idx_refund_payment ON refund (payment_id) WHERE state <> 'FAILED';
```

上限の検査は、決済の行を排他ロックした上で累計を数え直す (14.9 の悲観ロック) か、決済の行に「返金済み累計」を持たせて条件付き更新で増やす。どちらでも、**検査と更新が同じトランザクションで、かつ他の返金要求と一列に並んで処理される**ことが条件になる。

返金でよく問題になる判断が3つある。

- **付随する権利をどう戻すか。** 返金したら機能を無効にするのか、期間の途中まで使えるのか。ダウングレードとの整合 (30.13.1 が挙げる「ダウングレード時に上位機能の権限が残る」) も同じ問題である。
- **手数料の扱い。** 決済手数料が返らない事業者・条件がある。返金額と自社の損益は一致しない。
- **返金したデータを消してよいか。** 取引記録には保存義務がありうる (14.26)。返金と削除を同じ操作にしない。

部分返金を明細へ配分する場合は、27.18 の `allocate` を使い、**配分の合計が返金額と一致すること**を保証する。ここで1円が消えると、返金の累計と明細の累計がずれ、上限の検査が狂う。

#### 突合を最初から作る

17.13 が述べたとおり、**食い違うと金銭が動く領域では、突合のない連携は運用に載せられない**。決済では、突合は必須の機能である。

日次で行うのは3つの照合である。

| 照合 | 見つかるもの |
|---|---|
| 事業者側にあって自分たちに無い取引 | 取りこぼした Webhook、処理に失敗したイベント |
| 自分たちにあって事業者側に無い取引 | `UNKNOWN` のまま残った試行、実際には作られなかった取引 |
| 両方にあるが金額・状態・通貨が違う | 版の取り違え、通貨の取り違え、部分返金の反映漏れ |

3番目の金額比較では、**最小単位の整数どうしで比較する** (27.18)。主単位の小数へ変換してから比べると、`12.34` と `12.340000000000001` の比較になりうる。

```typescript
type Discrepancy = { kind: 'missing-local' | 'missing-remote' | 'mismatch'; id: string; detail: string };

export function reconcile(local: PaymentRow[], remote: RemotePayment[]): Discrepancy[] {
  const byExternalId = new Map(local.map((row) => [row.externalId, row]));
  const found = new Set<string>();
  const out: Discrepancy[] = [];

  for (const r of remote) {
    const l = byExternalId.get(r.id);
    if (!l) { out.push({ kind: 'missing-local', id: r.id, detail: 'not applied' }); continue; }
    found.add(r.id);
    if (l.amountMinor !== r.amountMinor || l.currency !== r.currency) {
      out.push({ kind: 'mismatch', id: r.id, detail: `${l.amountMinor}${l.currency} vs ${r.amountMinor}${r.currency}` });
    } else if (l.state !== r.state) {
      out.push({ kind: 'mismatch', id: r.id, detail: `${l.state} vs ${r.state}` });
    }
  }
  for (const l of local) {
    if (l.externalId && !found.has(l.externalId)) {
      out.push({ kind: 'missing-remote', id: l.externalId, detail: l.state });
    }
  }
  return out;
}
```

差分の件数と金額差の合計を**メトリクスとして出す** (22.6)。ゼロが続くことを確認できて初めて、突合は機能していると言える。差分が出たときに自動で修復するか、人が確認するかは、金額の大きさと種別で決める。少なくとも、**差分が出たまま誰も知らない状態にはしない**。

#### 環境の分離と、テストでの再現

決済事業者はテスト用の環境と鍵を提供している。ここでの事故は2種類ある。

- **本番の鍵をテスト環境へ置く。** 実際の課金が発生する。鍵は環境変数で注入し (20.13)、テスト環境のコードが本番の鍵を読める構成にしない (23.9)。
- **テストの鍵を本番へ置く。** 課金が一切成立しないまま、画面上は成功する。デプロイ時に、鍵の種別と環境の対応を検査する。

再現しにくい事象 (タイムアウト、遅れて届く Webhook、順序逆転、部分返金の重複) は、事業者のテスト環境でも再現しにくい。**これらは自分たちのコード側で模擬して検証する。** 課題17.7 では、金額の表現、冪等キーの確保順序、返金の累計上限、突合の欠如という4件を、外部へ接続せずに再現して塞ぐ。

#### つまずく箇所 ― 決済連携

- **タイムアウトを失敗として扱う**: 新しい取引として作り直すと二重課金になる。「不明」の状態を持ち、同じ冪等キーでリトライする。
- **冪等キーを毎回乱数で作る**: リトライのときに前回の鍵が分からない。業務上の一意な値から導く。
- **冪等キーを応答受信後に保存する**: 記録の直前で落ちると鍵を失う。送信前に永続化する。
- **リダイレクト先で権利を付与する**: ブラウザは閉じられ、URL は書き換えられる。状態は Webhook で受け取る。
- **支払い失敗で即座に契約を解除する**: 事業者の自動リトライで成功しうる。猶予期間の状態を設ける。
- **返金を決済行の更新として実装する**: 並行する返金要求が両方とも上限検査を通る。返金を別の行として持ち、一列に並べて処理する。
- **返金の累計上限を検査しない**: 部分返金の繰り返しで元の決済額を超える。
- **突合を持たない**: Webhook の欠落に永久に気づかない。日次で3方向を照合し、差分をメトリクスにする。
- **金額を主単位の小数で比較する**: 浮動小数点数の誤差で差分が出たり出なかったりする。最小単位の整数で比較する (27.18)。
- **カード情報を自前のフォームで受ける**: 対象範囲が自分たちのサーバ、ログ、バックアップへ広がる。事業者の部品に任せる。

<a id="section-17-17"></a>
### 17.17 実装課題 ― メッセージング基盤を自作する
<!-- handbook:learning {"level":"advanced","minutes":990} -->

<!-- handbook:narrative-bridge {"section":"17.17"} -->
キュー、ログ、リトライ、補償、二重書き込み対策を個別に読んでも、保証の境界は実装しなければ曖昧に残る。最小ブローカー、Outbox Relay、DLQ、Sagaを作り、重複と失敗を含む状態遷移を確認する。

第17章ではキュー、Kafka、Pub/Sub、Saga、Outbox、CDC を見た。本節ではメッセージングの中核パターンを自作し、信頼性とトレードオフを理解する。所要時間: 演習カードの推定時間の合計で16時間30分。

#### 課題17.1: ミニ Kafka 風キュー (★★★)

**目的**: Kafka の「**Topic + Partition + Offset + Consumer Group**」モデルを実装。

<!-- handbook:exercise:start {"id":"17.1"} -->
> **演習カード 課題17.1** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - `17.4 Kafka ― 高スループット分散ストリーミング` を読み、Topic / Partition / Offset / Consumer Group の関係を図で説明できる
> - `17.2 メッセージキューの基本` を読み、at-most-once と at-least-once の違いを区別できる
> - `node:events` の `EventEmitter` を継承したクラスを書き、`emit` と `on` の同期的な呼び出し順序を追える。なおこの演習のコンシューマは pull 型である。`on('message', ...)` を登録しただけでは配信されず、`drain()` を呼んだときにまとめて emit される
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] トピック作成が指定数のパーティションを確保し、0以下の指定でエラーになる
> - [ ] キー指定ありの publish はハッシュで固定パーティション、キーなしはラウンドロビンで振り分けられる
> - [ ] 同じキーのメッセージが必ず同じパーティションに入る
> - [ ] 同一グループでの消費によりオフセットが前進し、続けて同じ消費を行うと0件になる
> - [ ] 別グループのconsumerが同じメッセージを独立に全件受信できる
> - [ ] オフセットを過去へ戻して再生でき、コミット済みメッセージも保持されている
>
> **期待出力**
>
> - 2件publish後、グループAの取得が2件、続く取得が0件、別グループの取得が2件になる
> - publish の戻り値がトピック名・パーティション番号・オフセット・値・タイムスタンプの5キーを持つ
> - 同じキーで10件publishすると全件のパーティション番号が同一になる
>
> **観察項目**
>
> - 各パーティションのログ配列を出力し、オフセットがパーティションごとに独立した連番であることを確認する
> - コミット済みオフセットの表を出力し、グループごとに別のカーソルを持つことを見る
> - キーを与えない場合の振り分けを100件で数え、パーティション間の件数が均等になることを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch17 run test` を実行し、`consumer groups track offsets independently` がパスすることを確認する
> 2. 同一グループのconsumerを2つ作って交互に取得し、同じメッセージが二重配信されないことを確認する
> 3. コミット位置を0へ戻してから取得し、過去のメッセージが再度読める (リプレイできる) ことを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: Kafkaのログは追記専用の配列でよい。まずパーティション1本、consumer 1つで publish と取得を通し、そのあとグループとオフセットを足す。
> 2. **構造**: トピック名からパーティションごとのログ配列への写像と、「グループ名・トピック名・パーティション番号」からオフセットへの写像の2つを持つ。consumerはブローカーへの参照とグループ名を持つ薄いラッパにする。
> 3. **実装の要点**: オフセットは「次に読む位置」であり、コミットで保存するのは処理したメッセージのオフセットに1を足した値。オフセットそのものを保存すると同じメッセージを毎回1件ずつ再配信する。
>
> **本番利用時の警告**
>
> - 永続化、レプリケーション、リーダー選出、ISRが無いため、プロセスが落ちれば全メッセージを失う。at-least-once すら保証しない
> - 保持期間による削除もないので、長時間動かすとログ配列が単調に伸びてメモリを使い切る。本番は Kafka や Redpanda など実装済みのブローカーを使う
>
> **導線**
>
> - 開始地点: `code/ch17/mini-kafka.ts`
> - 模範解答: `code/ch17/mini-kafka.solution.ts`
>
> **推定時間の内訳**: トピックとパーティションの実装35分、publishの振り分けとオフセット管理40分、consumer groupとコミットの実装45分、リプレイと均等分配の観察30分
<!-- handbook:exercise:end -->

**要件**:

```typescript
const broker = new MiniBroker();
broker.createTopic('events', { partitions: 3 });

// Producer
broker.publish('events', { userId: 1, action: 'login' });
broker.publish('events', { userId: 2, action: 'logout' });

// Consumer Group (同じ group なら 1 メッセージは 1 consumer に)
const c1 = broker.consumer('events', { group: 'analytics' });
const c2 = broker.consumer('events', { group: 'analytics' });

c1.on('message', (msg) => console.log('C1:', msg));
c2.on('message', (msg) => console.log('C2:', msg));

// 別グループは独立に全部受信
const audit = broker.consumer('events', { group: 'audit' });
audit.on('message', ...);
```

**機能**:
- パーティション (キーベースのハッシュ振り分け)
- オフセット管理 (各 consumer グループのカーソル)
- メッセージ保持 (コミット済みも一定期間保持)
- 再生 (consumer がオフセットを過去に戻せる)

模範解答: `code/ch17/mini-kafka.solution.ts`

#### 課題17.2: Outbox パターン実装 (★★★)

**目的**: 「**DB トランザクションとイベント発行を1つの原子操作にする**」パターン。

<!-- handbook:exercise:start {"id":"17.2"} -->
> **演習カード 課題17.2** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - `17.11 Outbox パターン ― 信頼性の高いイベント発行` を読み、二重書き込み問題がどこで起きるかを説明できる
> - `14.6 ACIDとトランザクション` を読み、同一トランザクション内の書き込みの原子性を前提にできる
> - `17.12 CDC (Change Data Capture) ― DBの変更をイベント化する` を読み、Outbox と CDC の役割の違いを区別できる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] 業務データの作成とoutboxレコードの追加が、1つのトランザクション呼び出しで同時に確定する
> - [ ] outboxレコードがID、イベント種別、ペイロード、作成時刻、試行回数、送信時刻の各フィールドを持つ
> - [ ] リレーの1回実行が、送信時刻の入っていないイベントだけを取り出して publish する
> - [ ] publish が例外を投げた回は送信件数が0で、レコードが未送信のまま残る
> - [ ] 再実行で同じイベントが送信され、成功後は送信時刻が設定されて二度と送られない
> - [ ] 送信を試行するたびに試行回数が加算される
>
> **期待出力**
>
> - 1件登録後、publishが失敗する1回目の実行が `0`、成功する2回目が `1` を返す
> - 送信成功後、該当outboxレコードの送信時刻が Date 値として設定される
> - デモ実行が `{"users":1,"published":["user.created"]}` 形式のJSONを1行出力する
>
> **観察項目**
>
> - publish成功後・送信時刻の更新前にプロセスが落ちる場合をコード上で追い、同じイベントが再送されうる (at-least-once) ことを確認する
> - 試行回数の推移を出力し、失敗し続けるイベントを識別できることを見る
> - outboxを使わず「DB書き込みの後にbrokerへpublish」を別々に行う実装を並べ、publish失敗時にイベントだけが欠落することを再現する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch17 run test` を実行し、`outbox relay preserves unsent events and marks successful events` がパスすることを確認する
> 2. `pnpm --filter @handbook/ch17 exec tsx outbox/solution/main.ts` を実行し、`{"users":1,"published":["user.created"]}` が出力されることを確認する
> 3. 同じイベントに対してリレーの1回実行を3回連続で呼び、publish関数が実際に呼ばれた回数が1回だけであることをカウンタで確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 「業務データとイベントを同時に確定させる」ことと「送る」ことを完全に分離する。送信側はDBの状態だけを見て動くようにする。
> 2. **構造**: トランザクション模擬は操作を一旦pending配列へ溜め、コールバックが正常終了してから一括反映する形にする。リレーは送信時刻が未設定のものを絞り込み、publish成功時にだけ送信時刻を入れる。
> 3. **実装の要点**: 失敗時に何を残すかが要点。publishが例外を投げたら送信時刻を設定せずに次のポーリングへ回す。ここで例外を握りつぶしてレコードを消すと、イベントが黙って失われる。
>
> **本番利用時の警告**
>
> - リレーは at-least-once であり、publish成功後に停止すれば同じイベントを再送する。消費側に冪等キーによる重複排除が無ければ、二重課金や二重通知が起きる
> - 複数のリレーを同時に動かすと同じ行を並行して送る。本番では `SELECT ... FOR UPDATE SKIP LOCKED` などの行ロックかリースが必要
> - 送信済みレコードを削除もアーカイブもしないとoutboxテーブルが肥大化し、ポーリングのクエリが徐々に遅くなる
>
> **導線**
>
> - 開始地点: `code/ch17/outbox/starter/main.ts`
> - 模範解答: `code/ch17/outbox/solution/main.ts`
>
> **推定時間の内訳**: トランザクション模擬とoutboxの実装40分、リレーのポーリングと再送処理40分、publish例外時の検証35分、二重書き込み版との比較実験35分
<!-- handbook:exercise:end -->

**要件**:

```typescript
// 同じトランザクション内で
await db.transaction(async (tx) => {
  await tx.users.create({ name: 'Alice' });
  await tx.outbox.insert({
    eventType: 'user.created',
    payload: { userId: 'u1', name: 'Alice' },
    createdAt: new Date(),
  });
});

// 別プロセス(Outbox Relay)が outbox テーブルをポーリング
const relay = new OutboxRelay({ db, broker });
relay.start();  // 未送信を取り出し → broker に publish → 削除
```

実装ポイント:
- DB と Broker を別トランザクションで触る → イベント二重送信問題
- Outbox パターンなら DB のコミットで「送信予定」が確実に記録
- リレーは At-Least-Once 配信、消費側で冪等性を担保

模範解答: `code/ch17/outbox/`

#### 課題17.3: Dead Letter Queue + 指数バックオフ (★★)

**目的**: メッセージ処理が失敗したときの自動リトライと「**諦めるべき時の DLQ 退避**」を実装。

<!-- handbook:exercise:start {"id":"17.3"} -->
> **演習カード 課題17.3** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - `17.2 メッセージキューの基本` を読み、可視性タイムアウトとリトライの関係を把握する
> - `17.6 ジョブキュー ― Web アプリでの定番` を読み、失敗ジョブの実務での扱いを知る
> - テストのために現在時刻を引数で注入する設計 (`now` を渡す) を受け入れられる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] キューが最大リトライ回数と基準遅延をオプションで受け取り、デフォルトで5回・1000msで動く
> - [ ] 処理失敗のたびに試行回数が増え、次に処理可能になる時刻が基準遅延×2の (試行回数マイナス1) 乗だけ先へずれる
> - [ ] 処理可能時刻が未来のメッセージは処理対象に選ばれない
> - [ ] 最大リトライ回数に達したメッセージが元キューから消え、最後のエラー文言付きでDLQへ積まれる
> - [ ] DLQから取り出して元キューへ再投入できる
> - [ ] 1回の処理実行が、成功・リトライ・DLQ移動の3件数を返す
>
> **期待出力**
>
> - 最大3回・基準遅延10msの設定で、時刻0・10・30の3回処理するとDLQの件数が1になる
> - 基準遅延1000msのとき、遅延の系列が1秒、2秒、4秒、8秒、16秒になる
> - 成功したメッセージは成功件数1として返り、キューにもDLQにも残らない
>
> **観察項目**
>
> - 各リトライでの次回処理可能時刻を出力し、間隔が指数的に開くことを数値で確認する
> - 全メッセージが同時に失敗した場合、リトライも同時に集中することを確認し、ジッタの必要性を読み取る
> - DLQへ落ちたメッセージの最後のエラー文言を読み、恒久的な失敗 (バリデーションエラー) と一時的な失敗 (接続断) を区別できるか検討する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch17 run test` を実行し、`retry queue uses exponential delays and DLQ` がパスすることを確認する
> 2. 現在時刻を「次回処理可能時刻の1ミリ秒前」に設定して処理を呼び、成功もリトライも0件で何も起きないことを確認する
> 3. DLQから取り出したメッセージが試行回数と最後のエラー文言を保ったままであることを確認し、再投入時に試行回数をリセットするか引き継ぐかを決めて実装する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 「いま処理してよいメッセージ」を時刻で選ぶ設計にすると、実際に待たずにテストできる。`Date.now()` を関数の内部から直接呼ばない。
> 2. **構造**: メッセージはID、ペイロード、試行回数、次回処理可能時刻、最後のエラーで表す。処理関数は処理可能時刻が現在時刻以下のものだけを対象にし、失敗時は試行回数を増やしてキューへ戻し、上限超過でDLQへ移す。
> 3. **実装の要点**: ループ中にキューから要素を削除するため、前から回すと添字がずれて1件飛ばす。後ろから回すか、対象を先に抜き出してから処理する。
>
> **本番利用時の警告**
>
> - ジッタの無い純粋な指数バックオフは、大量メッセージが同時に失敗したときリトライも同時に集中し、復旧しかけた下流を再び落とす。本番ではランダムなゆらぎを加える
> - DLQは監視して初めて意味を持つ。アラートも定期的な棚卸しもないままDLQへ積むと、失敗が静かに溜まりデータ欠損に気付けない
> - キューはメモリ上のみで、プロセス再起動により未処理メッセージが消える
>
> **導線**
>
> - 開始地点: `code/ch17/dlq.ts`
> - 模範解答: `code/ch17/dlq.solution.ts`
>
> **推定時間の内訳**: キューとメッセージ構造の実装20分、指数バックオフとDLQ移動の実装30分、時刻注入によるテスト作成25分、再投入と失敗系の確認15分
<!-- handbook:exercise:end -->

**要件**:
- 最大 5 回までリトライ
- 各リトライで指数バックオフ (1秒、2秒、4秒、8秒、16秒)
- 5回失敗で DLQ に移動 + 元キューから削除
- DLQ メッセージは手動で再投入可能

```typescript
const queue = new RetryableQueue({
  maxRetries: 5,
  baseDelayMs: 1000,
});

queue.handle(async (msg) => {
  // 失敗する処理
  if (Math.random() < 0.5) throw new Error('processing failed');
});

queue.dlq.on('message', (msg) => {
  console.log('Moved to DLQ:', msg);
});
```

模範解答: `code/ch17/dlq.solution.ts`

#### 課題17.4: Saga パターン (補償トランザクション) (★★★)

**目的**: 分散システムでの「**前のステップを巻き戻して整合性を取り戻す**」パターン。

<!-- handbook:exercise:start {"id":"17.4"} -->
> **演習カード 課題17.4** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - `17.10 Saga パターン ― 分散トランザクション` を読み、オーケストレーションとコレオグラフィの違いを説明できる
> - `14.6 ACIDとトランザクション` を読み、分散環境で2フェーズコミットを避ける理由を把握する
> - `async` / `await` による逐次実行と、`try` / `catch` での部分失敗の捕捉が書ける
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] ステップ登録がチェイン可能で、実行時に全ステップを登録順で逐次実行する
> - [ ] 全成功時の戻り値が成功フラグと、登録順のステップ名一覧を含む
> - [ ] 途中失敗時に成功済みステップだけを逆順に補償し、実行した補償の名前一覧を返す
> - [ ] 失敗結果に失敗したステップ名と Error インスタンスが含まれる
> - [ ] 補償自体が例外を投げても、残りの補償が継続される
> - [ ] 失敗したステップ自身の補償は呼ばれない
>
> **期待出力**
>
> - 3ステップのうち3番目が失敗すると、補償のログが2番目、1番目の逆順になる
> - 全成功時の戻り値の成功フラグが `true`、途中失敗時は `false` になる
> - 補償関数が、対応するアクションの戻り値 (予約IDなど) を引数として受け取る
>
> **観察項目**
>
> - 各ステップの開始・成功・補償をログ出力し、時系列が「前進、失敗、逆順の巻き戻し」になることを確認する
> - 補償自体が失敗するケースを作り、その事実が結果に残らないことを確認し、本番で必要になる記録項目を検討する
> - 補償の実行中にプロセスが落ちた場合を想定し、中途半端な状態から再開するには何を永続化する必要があるかを列挙する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch17 run test` を実行し、`saga compensates completed steps in reverse order` がパスすることを確認する
> 2. ホテル・フライト・支払いの3ステップで支払いだけを失敗させ、ホテルとフライトのキャンセルが1回ずつ呼ばれることを呼び出し回数のカウンタで確認する
> 3. 全ステップ成功のケースで補償関数が一度も呼ばれないことを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 「どこまで成功したか」を配列に積みながら前進し、失敗したらその配列を逆順に辿るだけ。まず補償なしの逐次実行を通してから補償を足す。
> 2. **構造**: ステップの配列に登録し、実行時はステップとその戻り値の組を蓄積する。失敗時は蓄積した配列のコピーを反転させ、各ステップの補償に対応する戻り値を渡して呼ぶ。
> 3. **実装の要点**: 補償の中でさらに例外が出る場合の扱いが要点。個々の補償を `try` / `catch` で囲まないと、1つの補償失敗で残りの巻き戻しが止まり、より悪い中途半端な状態が残る。
>
> **本番利用時の警告**
>
> - Saga は原子性を提供しない。補償が完了するまでの間、他の処理から中間状態が見える (在庫が一時的に減ったままなど)。分離が必要な業務には予約状態を別途設計する
> - 補償アクションは冪等でなければならない。ネットワークリトライでキャンセルが2回届くと、この実装は二重キャンセルをそのまま下流へ渡す
> - 実行状態をメモリにしか持たないため、プロセスが落ちると補償の途中で止まり、誰も巻き戻せない孤児状態が残る。本番ではSagaの状態を永続化する
>
> **導線**
>
> - 開始地点: `code/ch17/saga.ts`
> - 模範解答: `code/ch17/saga.solution.ts`
>
> **推定時間の内訳**: Sagaの逐次実行と結果型の実装40分、補償の逆順実行40分、旅行予約3サービスの模擬と失敗注入40分、補償失敗と冪等性の検討30分
<!-- handbook:exercise:end -->

**シナリオ**: 旅行予約システム
1. ホテル予約
2. フライト予約
3. 支払い処理
4. ↑ どれかが失敗したら、成功済みステップを巻き戻し (キャンセル)

```typescript
const saga = new Saga();
saga
  .step({
    name: 'reserve-hotel',
    action: async () => await hotelService.reserve({ ... }),
    compensate: async (result) => await hotelService.cancel(result.id),
  })
  .step({
    name: 'book-flight',
    action: async () => await flightService.book({ ... }),
    compensate: async (result) => await flightService.cancel(result.id),
  })
  .step({
    name: 'charge-payment',
    action: async () => await paymentService.charge({ ... }),
    compensate: async (result) => await paymentService.refund(result.id),
  });

const result = await saga.execute();
// 途中で失敗 → 成功済みを補償アクションでロールバック
```

模範解答: `code/ch17/saga.solution.ts`

---

#### 課題17.5: Webhook 配送の失敗を再現して冪等・順序耐性にする (★★★)

**目的**: 17.13 で挙げた署名検証・重複配送・順序逆転・欠落の4つを、外部サービスを使わずに再現し、受信側の実装を変えるだけで解消することを確かめる。

<!-- handbook:exercise:start {"id":"17.5"} -->
> **演習カード 課題17.5** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - 17.13 Webhook 受信の実務 ― 再送、順序逆転、冪等性 を読み、受理と処理を分ける理由と署名検証の3つの罠を確認する
> - 12.15 Webhook の設計 ― イベント契約と署名 を読み、イベント封筒の各項目が受信側で何に使われるかを押さえる
> - 13.14 HMAC-SHA256 ― 共有秘密鍵による署名 を読み、node:crypto の createHmac と timingSafeEqual を使える状態にする
> - `code/ch17` で pnpm install 済みで、`pnpm --filter @handbook/ch17 run typecheck` が通る状態にする
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `verifySignature` が生バイト列に対して HMAC-SHA256 を計算し、複数鍵の併記と時刻の許容差を扱う
> - [ ] `Receiver` の guarded 経路がイベントIDの一意制約違反を捕捉して重複を判定し、二重適用しない
> - [ ] `guardedReceiver` が版番号の古いイベントを 0 件更新として静かに無視する
> - [ ] `reconcile` が送信側の一覧と受信側の状態を突き合わせ、欠落した1件だけを埋める
> - [ ] `runFindings` が期待値を直書きせず、受信側の最終状態と戻り値の差から判定する
> - [ ] `pnpm --filter @handbook/ch17 exec tsx webhook-delivery/starter/report.ts` が6行の要約を出力する
>
> **期待出力**
>
> - 1行目に `naive receiver: 4/4 failures reproduced` が出る
> - W1 の行が `naive accepted=false / guarded accepted=true` になる
> - W2 の行が `naive charges=2 / guarded charges=1` になる
> - W3 の行が `naive status=past_due / guarded status=active` になる
> - W4 の行が `naive missing=1 / guarded missing=0 (after reconcile)` になり、最終行が `guarded receiver: 0/4 failures remaining` になる
>
> **観察項目**
>
> - `verifySignature` に渡す本文を生バイト列からパースし直した文字列へ変え、W1 だけが再現に戻ることを確認する
> - 重複判定を「先に検索して無ければ挿入」へ変え、あわせて `apply` の版番号比較も外すと W2 と W3 の2件が再現に戻ることを確認する
> - `apply` の版番号比較だけを外し、W3 だけが再現に戻ることを確認する
> - `probeDropped` の `reconcile` 呼び出しを外し、W4 だけが再現に戻ることを確認する
> - `Sender.build` の整形を常に有効にし、naive 側では W2 から W4 までが観測できなくなる (charges=0、status=none) ことを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch17 exec tsx webhook-delivery/solution/report.ts` を実行し、6行の要約が出力されることを確認する
> 2. `pnpm --filter @handbook/ch17 run test` を実行し、webhook delivery のテストが pass することを確認する
> 3. 自分の `webhook-delivery/starter/report.ts` を実行し、solution と同じ出力になるかで自己採点する
> 4. `pnpm --filter @handbook/ch17 run typecheck` が 0 エラーで終わることを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 署名検証から着手する。ここが通らないと、残る3件の判定がすべて「署名不正で拒否された」に潰れてしまい、重複や順序の挙動を観察できない。
> 2. **構造**: 受信側を、受理と適用の2層に分ける。受理層はイベントIDを鍵にした台帳への挿入だけを行い、適用層は台帳の行を読んで業務状態を書き換える。この分け方にすると、重複は受理層の一意制約で、順序逆転は適用層の版番号で、別々に解ける。
> 3. **実装の要点**: 重複判定は、検索してから挿入するのではなく、挿入を試みて一意制約違反を捕まえる形にする。順序逆転は、更新条件に `version < 新しい版` を入れて 0 件更新を許容する形にする。どちらも「例外を投げない無視」であり、ログには残すが処理は成功として返すのが要点になる。
>
> **本番利用時の警告**
>
> - この実装は送信側と受信側を同一プロセスに置いており、実際のネットワーク遅延、TLS、HTTPサーバのボディ取り扱いを再現していない。本番では利用するフレームワークで生ボディが保持されることを個別に確認する。
> - `Link` が起こす障害は固定表から取るため、実際の配送で起きうる組み合わせのごく一部でしかない。本番では突合ジョブを必ず用意し、その差分件数を監視する。
> - 受信テーブルの保持期間、DLQ、バックプレッシャーはこの課題に含まれていない。本番では相手の再送打ち切り期間より長い保持期間と、恒久失敗の退避先が要る。
>
> **導線**
>
> - 開始地点: `code/ch17/webhook-delivery/starter/main.ts`
> - 模範解答: `code/ch17/webhook-delivery/solution/main.ts`、`code/ch17/webhook-delivery/solution/report.ts`
>
> **推定時間の内訳**: 署名検証の実装35分、受理層と適用層の分離40分、reconcile と runFindings の判定設計40分、検査を外した観察35分
<!-- handbook:exercise:end -->

**題材**: 送信側 (`Sender`) と受信側 (`Receiver`) を同一プロセスに置く。固定表 (`FIXTURES`) が、本文の整形の違い・並行到着・順序の入れ替え・完全な欠落を決まったとおりに起こす。乱数を使わないため、何度実行しても同じ結果になる。

**要件**: `code/ch17/webhook-delivery/starter/main.ts` に次の4つを実装する。

1. `verifySignature(rawBody, headers, secrets, nowSeconds)` ― 生バイト列に対する HMAC-SHA256 を検証する。署名対象は `id.timestamp.body` で、複数鍵の併記と時刻の許容差を扱う。`naive` 受信側は `JSON.stringify` し直した文字列で検証し、鍵を1つしか見ない。
2. `Receiver` の `guarded` 経路 ― `naive` と同じ `deliver(request)` を通しつつ、署名検証、イベントIDの一意制約による重複排除、版番号による古いイベントの棄却を行う。
3. `reconcile(receiver, sender)` ― 送信側の一覧を引き、受信側に無い、または版が古い行を洗い出して埋める。欠落した配送はこれでしか回復しない。
4. `runFindings(build)` ― 4件の判定を、受信側の最終状態と戻り値だけから導く。期待値を直書きしない。

再現する4件は次のとおりである。

| 番号 | 誤り | 再現される事象 |
|---|---|---|
| W1 `parsed-body-signature` | パース後の文字列で署名を検証する | 正当な通知が `invalid signature` で落ちる |
| W2 `duplicate-delivery` | 「読んでから書く」で重複を判定する | 同じイベントが2回適用され、課金回数が2になる |
| W3 `out-of-order` | 到着順をそのまま適用する | 後から届いた古いイベントで `active` が `past_due` に戻る |
| W4 `dropped-event` | 突合を持たない | 欠落した1件が永久に反映されない |

**評価基準**:

- 同じ `runFindings` が、`naive` 受信側では 4/4、`guarded` 受信側では 0/4 になる
- W1 が、送信側の整形が変わっても、また鍵のローテーション中 (旧鍵と新鍵の併記) でも受理されることまで含めて解消する
- W2 で、重複判定が一意制約違反の捕捉によって行われ、並行到着でも二重適用が起きない
- W3 で、古いイベントが例外ではなく「0件更新」として静かに無視される
- W4 が、`reconcile` を1回走らせたときだけ解消する

```text
naive receiver: 4/4 failures reproduced
  W1 parsed-body-signature: naive accepted=false / guarded accepted=true
  W2 duplicate-delivery: naive charges=2 / guarded charges=1
  W3 out-of-order: naive status=past_due / guarded status=active
  W4 dropped-event: naive missing=1 / guarded missing=0 (after reconcile)
guarded receiver: 0/4 failures remaining
```

模範解答: `code/ch17/webhook-delivery/solution/`

---

#### 課題17.6: 外部API連携の障害を再現して耐える (★★★)

**目的**: 17.15 の時間予算・リトライ・Circuit Breaker と、17.14 のバウンス処理を、故障する外部サービスの模擬に対して実装し、素朴な呼び出しとの差を数値で確かめる。

<!-- handbook:exercise:start {"id":"17.6"} -->
> **演習カード 課題17.6** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - 17.15 外部API連携の実務 ― 時間予算、リトライ、Circuit Breaker を読み、3種類のタイムアウトとリトライ可否の条件を確認する
> - 17.14 メール送信の実務 を読み、抑制リストの照合と冪等キーを送信前に確保する理由を押さえる
> - 26.6 サーキットブレーカ と 26.7 リトライとバックオフ を読み、状態遷移と完全ジッタの意味を確認する
> - `code/ch17` で pnpm install 済みで、`pnpm --filter @handbook/ch17 run typecheck` が通る状態にする
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `budgetFor` が残り時間から1回分のタイムアウトを決め、残り時間が尽きていれば呼び出さずに失敗する
> - [ ] `retrying` が Retry-After を尊重し、完全ジッタ付き指数バックオフとリトライ予算の消費を行う
> - [ ] `CircuitBreaker` が closed / open / half-open を遷移し、4xx を失敗として数えず、half-open で1本だけ通す
> - [ ] `MailSender` が抑制リストを事前照合し、冪等キーを送信前に確保する
> - [ ] すべての待機が `VirtualClock` 上で行われ、実時間の待機を使わない
> - [ ] `pnpm --filter @handbook/ch17 exec tsx external-api/starter/report.ts` が6行の要約を出力する
>
> **期待出力**
>
> - 1行目に `naive integration: 4/4 failures reproduced` が出る
> - E1 の行が `naive elapsed=30000ms / resilient elapsed=1200ms (budget=1200ms)` になる
> - E2 の行が `naive calls=64 / resilient calls=6 (limit=6)` になる
> - E3 の行が `naive upstream-waits=12 / resilient upstream-waits=3 (short-circuited=9, state=open)` になる
> - E4 の行が `naive delivered=3 suppressed-hits=1 / resilient delivered=1 suppressed-hits=0` になり、最終行が `resilient integration: 0/4 failures remaining` になる
>
> **観察項目**
>
> - `retrying` の完全ジッタを固定の上限値へ変え、リトライの待ち時間が毎回同じになり、仮想時刻の進み方が揃うことを確認する
> - `FIXTURES.retryBudgetLimit` を 30 へ上げ、E2 の総呼び出し回数が 31 まで伸びることを確認する
> - `CircuitBreaker.countsAsFailure` が 4xx も数えるよう変え、章テストの circuit breaker ignores 4xx が失敗することを確認する
> - `MailSender.send` の抑制リスト照合を外し、E4 が再現に戻る (delivered=2、suppressed-hits=1) ことを確認する
> - `FIXTURES.hangingDeadlineMs` を 10000 へ上げ、E1 の resilient 側の予算が cap の 3000ms で頭打ちになることを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch17 exec tsx external-api/solution/report.ts` を実行し、6行の要約が出力されることを確認する
> 2. `pnpm --filter @handbook/ch17 run test` を実行し、external api resilience のテストが pass することを確認する
> 3. 自分の `external-api/starter/report.ts` を実行し、solution と同じ出力になるかで自己採点する
> 4. `pnpm --filter @handbook/ch17 run typecheck` が 0 エラーで終わることを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 先に VirtualClock を通す。実時間で待つ実装にすると、指数バックオフの観察に何十秒もかかり、試行錯誤が続かなくなる。
> 2. **構造**: 時間の扱いを1か所へ集める。現在時刻の取得、待機、タイムアウトの3つをすべて clock 経由にすると、テストで時間を進めるだけで数分間の挙動を再現できる。deadline は「終了予定の絶対時刻」として持ち、各呼び出しはそこから残り時間を引き算する。
> 3. **実装の要点**: ブレーカでは、判定窓を件数の固定長リングにし、最小件数を満たすまで開かないようにする。half-open は同時実行を1本に絞るため、通過中かどうかを示す真偽値を1つ持てば足りる。失敗として数えるかどうかの判定は、例外の種別ではなく状態コードの分類で行うと、4xx を除外する条件が1か所に収まる。
>
> **本番利用時の警告**
>
> - この実装は仮想時刻で動くため、実際のHTTPクライアントの接続タイムアウトやTLSハンドシェイクの挙動を再現していない。本番では利用するクライアントのデフォルト値を必ず確認する。
> - リトライ予算とブレーカのしきい値はこの課題の固定値であり、実際の相手のSLOと自分たちの負荷から決め直す必要がある。値を写して使わない。
> - メール送信の模擬には、実際の到達率、レピュテーション、送信量の制限が含まれていない。本番ではバウンス率と苦情率の監視、および段階的な送信量の増加が別途要る。
>
> **導線**
>
> - 開始地点: `code/ch17/external-api/starter/main.ts`
> - 模範解答: `code/ch17/external-api/solution/main.ts`、`code/ch17/external-api/solution/report.ts`
>
> **推定時間の内訳**: VirtualClock と FakeProvider の実装30分、callWithBudget と retrying の実装40分、CircuitBreaker の状態遷移40分、MailSender と観察40分
<!-- handbook:exercise:end -->

**題材**: `FakeProvider` は仮想時刻で動く外部サービスの模擬で、応答しない、`429` を `Retry-After` 付きで返す、恒久的に `500` を返す、といった振る舞いを固定表から取る。時間は `VirtualClock` で進めるため、実時間の待機は発生せず、実行は1秒未満で終わる。

**要件**: `code/ch17/external-api/starter/main.ts` に次の4つを実装する。

1. `budgetFor(clock, deadline, share, cap)` ― 残り時間から1回分のタイムアウトを決め、残り時間が尽きていれば呼び出さずに `DeadlineExceededError` を投げる。
2. `retrying(clock, deadline, budget, rand, attempt)` ― リトライ可否の判定、`Retry-After` の尊重、完全ジッタ付き指数バックオフ、リトライ予算の消費を行う。ジッタの乱数は注入された `rand` から取り、テストでは固定列を渡す。
3. `CircuitBreaker` ― `closed` / `open` / `half-open` の3状態。判定窓・最小件数・冷却時間・half-open の同時実行1本を実装し、4xx を失敗として数えない。
4. `MailSender` ― 抑制リストの事前照合、送信前の冪等キー確保、バウンスイベントの反映を行う。`naive` 版は冪等キーを送信後に書き、バウンスを無視する。

再現する4件は次のとおりである。

| 番号 | 誤り | 再現される事象 |
|---|---|---|
| E1 `no-timeout` | タイムアウトを設定しない | 応答しない相手に対して呼び出しが返らず、上流の予算を使い切る |
| E2 `retry-storm` | 予算とジッタなしでリトライする | 総呼び出し回数が跳ね上がり、相手の回復を妨げる |
| E3 `no-breaker` | 恒久障害でも呼び出し続ける | 全リクエストが上流のタイムアウトまで待たされる |
| E4 `duplicate-mail` | 送信後に冪等キーを書く | ジョブのリトライで同じ宛先へ2通届き、抑制済みにも送る |

**評価基準**:

- 同じ `runFindings` が、`naive` 実装では 4/4、`resilient` 実装では 0/4 になる
- E1 で、`resilient` 側の1回の呼び出しが割り当てた予算内で打ち切られる
- E2 で、`resilient` 側の総呼び出し回数がリトライ予算の上限以下に収まる
- E3 で、ブレーカが開いた後の呼び出しが相手へ届かず、即座に失敗する
- E4 で、抑制済み宛先への送信が0件になり、同一冪等キーの送信が1回になる
- すべての待機が `VirtualClock` 上で行われ、実時間の `sleep` を使わない

```text
naive integration: 4/4 failures reproduced
  E1 no-timeout: naive elapsed=30000ms / resilient elapsed=1200ms (budget=1200ms)
  E2 retry-storm: naive calls=64 / resilient calls=6 (limit=6)
  E3 no-breaker: naive upstream-waits=12 / resilient upstream-waits=3 (short-circuited=9, state=open)
  E4 duplicate-mail: naive delivered=3 suppressed-hits=1 / resilient delivered=1 suppressed-hits=0
resilient integration: 0/4 failures remaining
```

模範解答: `code/ch17/external-api/solution/`

---

#### 課題17.7: 決済連携の二重課金・返金超過・突合欠如を再現して塞ぐ (★★★)

**目的**: 17.16 の冪等キーの確保順序・返金の上限・突合と、27.18 の金額表現が欠けた状態を実際に再現し、実装を差し替えると同じ検査が1件も引っかからなくなることを確かめる。

<!-- handbook:exercise:start {"id":"17.7"} -->
> **演習カード 課題17.7** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - 17.16 決済連携の実務 を読み、タイムアウトが「不明」であることと、返金が独立した取引である理由を確認する
> - 27.18 金額と通貨の表現 を読み、最小単位の整数と端数の配分規則を押さえる
> - 17.13 Webhook 受信の実務 を読み、受信側の冪等性と、本課題が扱う呼び出し側の冪等キーとの違いを確認する
> - `code/ch17` で pnpm install 済みで、`pnpm --filter @handbook/ch17 run typecheck` が通る状態にする
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `allocate` の戻り値の合計が、どの重みでも必ず元の金額と一致する
> - [ ] `applyRate` が浮動小数点数を経由せず、分子と分母から丸めの向きを決める
> - [ ] `fixedCharge` が冪等キーを業務上の一意な値から導き、送信前に永続化する
> - [ ] `fixedCharge` がタイムアウトを UNKNOWN として扱い、同じ鍵でリトライする
> - [ ] `tryAddRefund` が上限の検査と反映を同じ操作で行い、返金IDの重複と通貨の不一致も拒否する
> - [ ] `reconcile` が missing-local / missing-remote / mismatch の3方向を検出し、金額を最小単位の整数で比較する
>
> **期待出力**
>
> - 1行目に `naive payments: 4/4 defects reproduced` が出る
> - M1 の行が `naive sum=999 expected=1000 / fixed sum=1000 expected=1000` になる
> - M2 の行が `naive charges=2 / fixed charges=1` になる
> - M3 の行が `naive refunded=12000 capture=10000 / fixed refunded=6000 capture=10000` になる
> - 最終行が `fixed payments: 0/4 defects remaining (legitimate charge and refund still pass)` になる
>
> **観察項目**
>
> - `allocate` の余りの配り直しを外し、M1 が再現に戻る (fixed sum=999) ことを確認する
> - `fixedCharge` の冪等キーに試行回数を混ぜ、M2 が再現に戻る (fixed charges=2) ことを確認する
> - `tryAddRefund` の上限検査を外し、M3 が再現に戻る (fixed refunded=12000) ことを確認する
> - `reconcile` の missing-local の検出を外し、M4 が再現に戻る (fixed detected=0) ことを確認する
> - `FIXTURES.partialRefund` を 5,000 へ下げ、M3 が naive でも再現しなくなる (refunded=10000 で上限ちょうど) ことを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch17 exec tsx payment-integration/solution/report.ts` を実行し、6行の要約が出力されることを確認する
> 2. `pnpm --filter @handbook/ch17 run test` を実行し、payment integration の5件のテストが pass することを確認する
> 3. 自分の `payment-integration/starter/report.ts` を実行し、solution と同じ出力になるかで自己採点する
> 4. `pnpm --filter @handbook/ch17 run typecheck` が 0 エラーで終わることを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 金額を扱う関数の制約を先に1行で書く。配分なら「戻り値の合計が元と一致する」、返金なら「累計が元の決済額を超えない」、突合なら「両側の集合の差をすべて挙げる」。この制約が満たされているかだけを見れば、実装の細部は自由に選べる。
> 2. **構造**: 冪等キーは「同じ操作なら必ず同じ値になる」ことが唯一の条件である。乱数で作るとリトライのときに前回の鍵が分からず、事業者から見て別の取引になる。注文IDのように業務上の一意な値から導き、送信の前に永続化しておく。
> 3. **実装の要点**: 返金は、決済の行を更新する処理ではなく、独立した行の追加として作る。上限の検査と反映が別の操作に分かれていると、2本の要求が「両方とも検査を通ってから、両方とも書く」という順序で交錯したときに上限を越える。検査と反映を1つの操作にまとめることが対策である。
>
> **本番利用時の警告**
>
> - FakeGateway はメモリ上の模擬であり、実在の決済事業者の振る舞いを再現するものではない。与信と売上確定の分離、ダニング、申し立て、手数料の扱いは事業者ごとに異なる。
> - 実際の決済 API を試す場合は、必ずテスト環境の鍵だけを使う。本番の鍵を置いたまま演習すると、実際の課金や返金が発生する。
> - カード情報の取り扱い範囲、PCI DSS の適用、返金や保存義務の判断は、構成・取引量・契約・法域によって異なる。本課題は法的助言ではない。決済事業者および法務へ確認する (17.16、30.16)。
>
> **導線**
>
> - 開始地点: `code/ch17/payment-integration/starter/main.ts`
> - 模範解答: `code/ch17/payment-integration/solution/main.ts`、`code/ch17/payment-integration/solution/report.ts`
>
> **推定時間の内訳**: Money と allocate の実装35分、fixedCharge の冪等キー40分、返金の上限検査35分、reconcile と観察40分
<!-- handbook:exercise:end -->

**題材**: 実在の決済事業者へは接続しない。鍵もエンドポイントもカード情報も含まない。`FakeGateway` はメモリ上の模擬で、冪等キーによる取引の同一視、「相手には届くが応答が返らない」状態、返金の上限、記録の一覧取得だけを持つ。金額は最小単位の整数 (`bigint`) で扱い、通貨ごとの小数桁は表として持つ。

**要件**: `code/ch17/payment-integration/starter/main.ts` に次の5つを実装する。

1. `applyRate(base, numerator, denominator)` ― 割合を分子と分母で受け取り、最後に一度だけ丸める。浮動小数点数を経由しない。
2. `allocate(total, weights)` ― 切り捨てで配り、余りを1最小単位ずつ配り直す。戻り値の合計は必ず元の金額と一致する。
3. `fixedCharge(gateway, ledger, orderId, amount)` ― 冪等キーを業務上の一意な値から導き、送信前に永続化し、タイムアウトを `UNKNOWN` として同じ鍵でリトライする。
4. `Ledger.tryAddRefund(...)` ― 返金を独立した行として追加する。上限の検査と反映を同じ操作で行う。
5. `reconcile(ledger, remote)` ― 欠落・過剰・不一致の3方向を検出する。金額は最小単位の整数どうしで比較する。

再現する4件は次のとおりである。

| 番号 | 誤り | `naive` で起きること |
|---|---|---|
| M1 `float-money-split` | 主単位の浮動小数点数で按分し、最後に丸める | 1,000円を3人へ分けた合計が 999円 になり、1円が消える |
| M2 `double-charge` | タイムアウトを失敗として扱い、新しい鍵で作り直す | 1件の注文に対して事業者側に2件の取引ができる |
| M3 `refund-exceeds-capture` | 上限の検査と反映が別の操作に分かれている | 6,000円の部分返金が2本通り、返金累計が 12,000円 になる |
| M4 `reconcile-gap` | 突合を持たない | 届かなかった通知1件が、永久に反映されないまま気づかれない |

M3 の再現は、2本の要求が「両方とも検査を通ってから、両方とも書く」という順序で交錯する形を明示的に組み立てている。逐次に実行すれば2本目は上限で止まるため、この順序を作らないと再現しない。

**評価基準**:

- 同じ `runFindings` が、`naive` 側では 4/4、`fixed` 側では 0/4 になる
- `allocate` の戻り値の合計が、どの重みでも元の金額と一致する
- `fixedCharge` が応答を受け取れなかったあとも、同じ鍵で問い合わせて1件の取引に収める
- 返金の累計が元の決済額を超えず、返金IDの重複と通貨の不一致も拒否される
- 上限内の返金と、平常時の課金が `fixed` 側でも通る (過剰な拒否をしていない)

```text
naive payments: 4/4 defects reproduced
  M1 float-money-split: naive sum=999 expected=1000 / fixed sum=1000 expected=1000
  M2 double-charge: naive charges=2 / fixed charges=1
  M3 refund-exceeds-capture: naive refunded=12000 capture=10000 / fixed refunded=6000 capture=10000
  M4 reconcile-gap: naive detected=0 / fixed detected=1
fixed payments: 0/4 defects remaining (legitimate charge and refund still pass)
```

模範解答: `code/ch17/payment-integration/solution/`

<!-- handbook:code-usage:start {"chapter":17} -->
### 第17章のコード集の使い方

<!-- handbook:generated; do not edit -->

コード集は pnpm ワークスペースとして構成してある (CODE_TOOLCHAIN.md)。依存はリポジトリ最上位で一度だけ解決し、章ごとの操作は `--filter` でワークスペースを指定する。

```bash
# 初回のみ。リポジトリ最上位で実行する
pnpm install

# 第17章の模範解答をまとめて検証する
pnpm --filter @handbook/ch17 run test

# 模範解答を個別に実行する
pnpm --filter @handbook/ch17 exec tsx mini-kafka.solution.ts                # 課題17.1
pnpm --filter @handbook/ch17 exec tsx outbox/solution/main.ts               # 課題17.2
pnpm --filter @handbook/ch17 exec tsx dlq.solution.ts                       # 課題17.3
pnpm --filter @handbook/ch17 exec tsx saga.solution.ts                      # 課題17.4
pnpm --filter @handbook/ch17 exec tsx webhook-delivery/solution/main.ts     # 課題17.5
pnpm --filter @handbook/ch17 exec tsx external-api/solution/main.ts         # 課題17.6
pnpm --filter @handbook/ch17 exec tsx payment-integration/solution/main.ts  # 課題17.7
```

開始地点は模範解答と同じ場所に置いてある (`<name>.ts` と `<name>.solution.ts`、またはディレクトリ課題の `starter/` と `solution/`)。課題ごとの完成条件と採点手順は本節の演習カードと `code/ch17/README.md` にある。模範解答の多くは関数を export するだけで、実行して意味のある出力が出るかどうかは課題によって異なる。まず `run test` で通し、個別実行は演習カードのテスト方法に従う。
<!-- handbook:code-usage:end -->


---

## まとめ ― 第IV部の総括

第IV部では、認証済みの要求が生み出す業務状態を、正しく保存し、目的に応じて形を変え、発見し、他の処理へ伝えるところまで進んだ。

第14章では、RDBを単なるSQL実行装置ではなく、制約とトランザクションで不変条件を守り、インデックスと実行計画で読み取りを最適化し、MVCC、ロック、マイグレーション、保守によってその保証を運用し続ける仕組みとして捉えた。第15章では、その標準モデルから外れるアクセスパターンや分散要件を起点に、KVS、文書、グラフ、時系列、地理空間、CRDTを比較した。ここで得たのは「RDBかNoSQLか」という二択ではなく、どの問いと障害条件を優先するかという選択基準である。

第16章では、保存に適した構造と発見に適した構造を分け、解析、転置索引、ランキング、ファセット、ベクトル探索を検索パイプラインとして組み立てた。第17章では、そのような派生データや副作用へ変更を伝えるため、同期境界をキュー、ログ、Pub/Subで分離し、重複、順序、リトライ、部分失敗をSaga、Outbox、CDCで扱った。これにより、一つの要求を一つのDB更新として見るだけでなく、時間をまたいで複数の状態へ伝播する処理として設計できるようになった。

ここまでで、アプリケーション内部のデータ責務は整理できた。しかし、DB、検索エンジン、ブローカー、ワーカーは、CPU、メモリ、ファイル、ネットワーク上で動き、配置、起動、更新、監視を誤れば設計どおりの保証を提供できない。第V部では、これらを支えるLinux、コンテナ、Kubernetes、クラウド、CI/CD、可観測性へ進み、正しいアプリケーションを継続して動かす問題を扱う。
