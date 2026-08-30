#!/usr/bin/env bash
# KEN-67: PostgreSQL 18・Redis 8 への実接続でデータ層演習を確認する
# 前提: handbook-postgres (postgres:18-alpine), handbook-redis (redis:8-alpine) が起動済み
# 接続情報は環境変数名のみログに残す (DATABASE_URL / REDIS_URL 相当。値は記録しない)
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOG="$ROOT/.verification/ken67/logs"
TMP="$(mktemp -d)"
mkdir -p "$LOG"
PSQL=(docker exec -i handbook-postgres psql -U handbook -d handbook -v ON_ERROR_STOP=0 -At)
REDIS=(docker exec handbook-redis redis-cli)
PASS=0; FAIL=0
check() { # $1=名称 $2=条件(0/1)
  if [[ "$2" == "0" ]]; then echo "PASS: $1"; PASS=$((PASS+1)); else echo "FAIL: $1"; FAIL=$((FAIL+1)); fi
}

echo "=== KEN-67 verification $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
docker exec handbook-postgres psql -U handbook -d handbook -Atc "select version()" | tee "$LOG/env-postgres.txt"
"${REDIS[@]}" info server | grep redis_version | tee "$LOG/env-redis.txt"

############################################
# 14.2 トランザクション分離レベル実験 (実PostgreSQL・2セッション)
############################################
run_isolation() { # $1=level $2=outfile-suffix
  local lvl="$1" sfx="$2"
  "${PSQL[@]}" <<'SQL' > /dev/null
DROP TABLE IF EXISTS accounts;
CREATE TABLE accounts(id int primary key, balance int not null);
INSERT INTO accounts VALUES (1,100),(2,100);
SQL
  mkfifo "$TMP/a-$sfx.in" "$TMP/b-$sfx.in"
  docker exec -i handbook-postgres psql -U handbook -d handbook -At < "$TMP/a-$sfx.in" > "$LOG/14.2-$sfx-A.out" 2>&1 &
  local A_PID=$!
  docker exec -i handbook-postgres psql -U handbook -d handbook -At < "$TMP/b-$sfx.in" > "$LOG/14.2-$sfx-B.out" 2>&1 &
  local B_PID=$!
  exec 3> "$TMP/a-$sfx.in"
  exec 4> "$TMP/b-$sfx.in"
  echo "BEGIN ISOLATION LEVEL $lvl;"                                    >&3; sleep 0.5
  echo "SELECT 'A-first-read', balance FROM accounts WHERE id=1;"       >&3
  for _ in $(seq 1 40); do grep -q "A-first-read" "$LOG/14.2-$sfx-A.out" && break; sleep 0.25; done
  echo "UPDATE accounts SET balance=999 WHERE id=1;"                    >&4
  for _ in $(seq 1 40); do grep -q "UPDATE 1" "$LOG/14.2-$sfx-B.out" && break; sleep 0.25; done
  echo "SELECT 'A-second-read', balance FROM accounts WHERE id=1;"      >&3; sleep 0.5
  echo "COMMIT;"                                                        >&3; sleep 0.3
  exec 3>&-; exec 4>&-
  wait "$A_PID" "$B_PID" 2>/dev/null
}

echo "--- 14.2 READ COMMITTED (non-repeatable read が起きることを確認) ---"
run_isolation "READ COMMITTED" "rc"
grep -q "A-first-read|100"  "$LOG/14.2-rc-A.out"; check "14.2 RC: 初回読み取りが100" $?
grep -q "A-second-read|999" "$LOG/14.2-rc-A.out"; check "14.2 RC: 2回目が999 (non-repeatable read発生)" $?

echo "--- 14.2 REPEATABLE READ (スナップショットで防がれることを確認) ---"
run_isolation "REPEATABLE READ" "rr"
grep -q "A-second-read|100" "$LOG/14.2-rr-A.out"; check "14.2 RR: 2回目も100 (non-repeatable read防止)" $?

echo "--- 14.2 SERIALIZABLE (write skewがserialization failureになることを確認) ---"
"${PSQL[@]}" <<'SQL' > /dev/null
UPDATE accounts SET balance=100 WHERE id IN (1,2);
SQL
mkfifo "$TMP/a-ser.in" "$TMP/b-ser.in"
docker exec -i handbook-postgres psql -U handbook -d handbook -At < "$TMP/a-ser.in" > "$LOG/14.2-ser-A.out" 2>&1 &
A_PID=$!
docker exec -i handbook-postgres psql -U handbook -d handbook -At < "$TMP/b-ser.in" > "$LOG/14.2-ser-B.out" 2>&1 &
B_PID=$!
exec 3> "$TMP/a-ser.in"; exec 4> "$TMP/b-ser.in"
echo "BEGIN ISOLATION LEVEL SERIALIZABLE;"                >&3; sleep 0.4
echo "SELECT 'A-sum', sum(balance) FROM accounts;"        >&3; sleep 0.4
echo "BEGIN ISOLATION LEVEL SERIALIZABLE;"                >&4; sleep 0.4
echo "SELECT 'B-sum', sum(balance) FROM accounts;"        >&4; sleep 0.4
echo "UPDATE accounts SET balance=0 WHERE id=1;"          >&4; sleep 0.4
echo "COMMIT;"                                            >&4; sleep 0.6
echo "UPDATE accounts SET balance=0 WHERE id=2;"          >&3; sleep 0.4
echo "COMMIT;"                                            >&3; sleep 0.4
exec 3>&-; exec 4>&-
wait "$A_PID" "$B_PID" 2>/dev/null
grep -q "could not serialize access" "$LOG/14.2-ser-A.out"; check "14.2 SER: serialization failure検出" $?

############################################
# 14.3 N+1 と EXPLAIN 比較 (実PostgreSQL)
############################################
echo "--- 14.3 N+1 と EXPLAIN ANALYZE ---"
"${PSQL[@]}" <<'SQL' > "$LOG/14.3-explain.out" 2>&1
DROP TABLE IF EXISTS posts; DROP TABLE IF EXISTS authors;
CREATE TABLE authors(id serial primary key, name text not null);
CREATE TABLE posts(id serial primary key, author_id int not null references authors(id), title text not null);
INSERT INTO authors(name) SELECT 'author-'||g FROM generate_series(1,100) g;
INSERT INTO posts(author_id,title) SELECT (g%100)+1, 'post-'||g FROM generate_series(1,1000) g;
CREATE INDEX idx_posts_author ON posts(author_id);
ANALYZE authors; ANALYZE posts;
\echo '=== N+1側: 1著者分のクエリ (アプリが100回発行する形) ==='
EXPLAIN ANALYZE SELECT * FROM posts WHERE author_id=42;
\echo '=== JOIN側: 1クエリで全件 ==='
EXPLAIN ANALYZE SELECT a.name, p.title FROM authors a JOIN posts p ON p.author_id = a.id;
\echo '=== 実測: 100回ループ vs 1 JOIN ==='
DO $$ DECLARE t0 timestamptz; r record; i int; BEGIN
  t0 := clock_timestamp();
  FOR i IN 1..100 LOOP
    FOR r IN SELECT * FROM posts WHERE author_id=i LOOP NULL; END LOOP;
  END LOOP;
  RAISE NOTICE 'n_plus_one_100_queries_ms=%', round(extract(epoch from clock_timestamp()-t0)*1000);
  t0 := clock_timestamp();
  FOR r IN SELECT a.name, p.title FROM authors a JOIN posts p ON p.author_id=a.id LOOP NULL; END LOOP;
  RAISE NOTICE 'single_join_ms=%', round(extract(epoch from clock_timestamp()-t0)*1000);
END $$;
SQL
grep -q "Index Scan\|Bitmap" "$LOG/14.3-explain.out"; check "14.3: 単一著者クエリがインデックスを使用" $?
grep -q "n_plus_one_100_queries_ms" "$LOG/14.3-explain.out"; check "14.3: N+1実測を記録" $?

############################################
# 14.5 マイグレーションRunner (演習ランナー実行 + 実PostgreSQL相当)
############################################
echo "--- 14.5 マイグレーションRunner (演習実装=SQLite) ---"
MIGDIR="$TMP/migrations"; mkdir -p "$MIGDIR"
cat > "$MIGDIR/001_create_users.sql" <<'M1'
CREATE TABLE users(id INTEGER PRIMARY KEY, email TEXT NOT NULL);
-- +migrate Down
DROP TABLE users;
M1
cat > "$MIGDIR/002_add_index.sql" <<'M2'
CREATE INDEX idx_users_email ON users(email);
-- +migrate Down
DROP INDEX idx_users_email;
M2
RUNNER="$ROOT/code/ch14/migration-runner/solution/main.sh"
{
  echo "== up ==";        bash "$RUNNER" up     "$MIGDIR" "$TMP/mig.sqlite3"
  echo "== up(再実行) =="; bash "$RUNNER" up     "$MIGDIR" "$TMP/mig.sqlite3"
  echo "== status ==";    bash "$RUNNER" status "$MIGDIR" "$TMP/mig.sqlite3"
  echo "== down ==";      bash "$RUNNER" down   "$MIGDIR" "$TMP/mig.sqlite3"
  echo "== status ==";    bash "$RUNNER" status "$MIGDIR" "$TMP/mig.sqlite3"
} > "$LOG/14.5-runner-sqlite.out" 2>&1
grep -q "applied 001_create_users.sql" "$LOG/14.5-runner-sqlite.out"; check "14.5: up適用" $?
UPCOUNT=$(grep -c "applied 001_create_users.sql" "$LOG/14.5-runner-sqlite.out")
[[ "$UPCOUNT" == "1" ]]; check "14.5: 再実行で二重適用なし(冪等)" $?
grep -qi "roll\|revert\|001\|002" "$LOG/14.5-runner-sqlite.out"; check "14.5: down/status出力あり" $?

echo "--- 14.5 実PostgreSQLでの同等マイグレーション ---"
"${PSQL[@]}" <<'SQL' > "$LOG/14.5-postgres.out" 2>&1
DROP TABLE IF EXISTS mig_users; DROP TABLE IF EXISTS schema_migrations;
CREATE TABLE schema_migrations(version int primary key, filename text not null, applied_at timestamptz default now());
\echo '== up 001 =='
BEGIN; CREATE TABLE mig_users(id serial primary key, email text not null); INSERT INTO schema_migrations(version,filename) VALUES (1,'001_create_users.sql'); COMMIT;
\echo '== up 002 =='
BEGIN; CREATE INDEX idx_mig_users_email ON mig_users(email); INSERT INTO schema_migrations(version,filename) VALUES (2,'002_add_index.sql'); COMMIT;
\echo '== up 001 再実行 (versionガードにより弾かれる) =='
INSERT INTO schema_migrations(version,filename) VALUES (1,'001_create_users.sql');
\echo '== status =='
SELECT version, filename FROM schema_migrations ORDER BY version;
\echo '== down 002 =='
BEGIN; DROP INDEX idx_mig_users_email; DELETE FROM schema_migrations WHERE version=2; COMMIT;
SELECT version, filename FROM schema_migrations ORDER BY version;
SQL
grep -q "duplicate key" "$LOG/14.5-postgres.out"; check "14.5 PG: 再適用がversionガードで拒否" $?
grep -q "1|001_create_users.sql" "$LOG/14.5-postgres.out"; check "14.5 PG: down後にversion 1のみ残存" $?

############################################
# 15.1 Redis風KVS → 実Redisで書き込み・読み出し・TTL・永続化境界
############################################
echo "--- 15.1 実Redis: SET/GET/TTL/永続化境界 ---"
{
  echo "== SET/GET =="
  "${REDIS[@]}" SET handbook:key1 value1
  "${REDIS[@]}" GET handbook:key1
  echo "== TTL =="
  "${REDIS[@]}" EXPIRE handbook:key1 2
  "${REDIS[@]}" TTL handbook:key1
  sleep 3
  echo -n "expired GET → "; "${REDIS[@]}" GET handbook:key1
  echo "== 永続化境界: SAVE後の再起動で残る =="
  "${REDIS[@]}" SET handbook:durable persists
  "${REDIS[@]}" SAVE
  docker restart handbook-redis > /dev/null; sleep 2
  echo -n "durable GET → "; "${REDIS[@]}" GET handbook:durable
  echo "== 永続化境界: SAVE後の書き込みはSIGKILLで失われる =="
  "${REDIS[@]}" SET handbook:volatile after-save
  docker kill handbook-redis > /dev/null; docker start handbook-redis > /dev/null; sleep 2
  echo -n "volatile GET → "; "${REDIS[@]}" GET handbook:volatile
} > "$LOG/15.1-redis.out" 2>&1
grep -q "value1" "$LOG/15.1-redis.out"; check "15.1: SET/GET" $?
grep -q "expired GET → $" "$LOG/15.1-redis.out"; check "15.1: TTL失効でnil" $?
grep -q "durable GET → persists" "$LOG/15.1-redis.out"; check "15.1: SAVE済みキーが再起動後も残存" $?
grep -q "volatile GET → $" "$LOG/15.1-redis.out"; check "15.1: SAVE後の書き込みはSIGKILLで消失(境界実証)" $?

############################################
# 17.4 Saga補償トランザクションのPostgreSQL永続化
############################################
echo "--- 17.4 SagaのPostgreSQL永続化 ---"
"${PSQL[@]}" <<'SQL' > "$LOG/17.4-saga.out" 2>&1
DROP TABLE IF EXISTS saga_log; DROP TABLE IF EXISTS inventory;
CREATE TABLE saga_log(seq serial primary key, saga_id text not null, step text not null, action text not null, at timestamptz default now());
CREATE TABLE inventory(item text primary key, reserved int not null default 0);
INSERT INTO inventory VALUES ('book', 0);
\echo '== saga実行: reserve成功 → charge失敗 → 補償(release) =='
BEGIN;
UPDATE inventory SET reserved = reserved + 1 WHERE item='book';
INSERT INTO saga_log(saga_id, step, action) VALUES ('saga-1','reserve_inventory','execute');
COMMIT;
BEGIN;
INSERT INTO saga_log(saga_id, step, action) VALUES ('saga-1','charge_payment','execute_failed');
COMMIT;
BEGIN;
UPDATE inventory SET reserved = reserved - 1 WHERE item='book';
INSERT INTO saga_log(saga_id, step, action) VALUES ('saga-1','reserve_inventory','compensate');
COMMIT;
\echo '== saga_log (実行順) =='
SELECT seq, step, action FROM saga_log WHERE saga_id='saga-1' ORDER BY seq;
\echo '== 最終在庫 (補償で0に戻る) =='
SELECT item, reserved FROM inventory;
SQL
grep -q "reserve_inventory|compensate" "$LOG/17.4-saga.out"; check "17.4: 補償ステップがPGに永続化" $?
grep -q "book|0" "$LOG/17.4-saga.out"; check "17.4: 補償後に在庫が復元" $?

############################################
# 28.3 ADRジェネレータのPostgreSQL記録
############################################
echo "--- 28.3 ADR記録のPostgreSQL保存 ---"
"${PSQL[@]}" <<'SQL' > "$LOG/28.3-adr.out" 2>&1
DROP TABLE IF EXISTS adr_records;
CREATE TABLE adr_records(number int primary key, title text not null, status text not null default 'accepted', decided_on date not null default current_date);
INSERT INTO adr_records(number,title) VALUES (1,'PostgreSQLを主データストアに採用する');
INSERT INTO adr_records(number,title,status) VALUES (2,'イベント駆動をKafkaで実装する','proposed');
\echo '== 重複番号は拒否される =='
INSERT INTO adr_records(number,title) VALUES (1,'重複ADR');
\echo '== 一覧 =='
SELECT number, title, status FROM adr_records ORDER BY number;
SQL
grep -q "duplicate key" "$LOG/28.3-adr.out"; check "28.3: ADR番号の一意性をPGが強制" $?
grep -q "2|イベント駆動をKafkaで実装する|proposed" "$LOG/28.3-adr.out"; check "28.3: ADRレコード保存・取得" $?

############################################
# 30.1 マルチテナントTask SaaS: solution self-test + PostgreSQL RLSでテナント分離
############################################
echo "--- 30.1 solution self-test (演習実装) ---"
bash "$ROOT/code/ch30/saas/solution/main.sh" self-test > "$LOG/30.1-selftest.out" 2>&1
grep -q '"tenantIsolation":true' "$LOG/30.1-selftest.out"; check "30.1: 演習solutionのself-test成功" $?

echo "--- 30.1 実PostgreSQL: Row-Level Securityによるテナント分離 ---"
"${PSQL[@]}" <<'SQL' > "$LOG/30.1-rls.out" 2>&1
DROP TABLE IF EXISTS saas_tasks;
DROP ROLE IF EXISTS saas_app;
CREATE TABLE saas_tasks(id serial primary key, tenant_id text not null, title text not null);
ALTER TABLE saas_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE saas_tasks FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON saas_tasks
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
CREATE ROLE saas_app NOLOGIN;
GRANT SELECT, INSERT, UPDATE, DELETE ON saas_tasks TO saas_app;
GRANT USAGE, SELECT ON SEQUENCE saas_tasks_id_seq TO saas_app;
\echo '== tenant t1 として書き込み =='
SET ROLE saas_app;
SET app.tenant_id = 't1';
INSERT INTO saas_tasks(tenant_id, title) VALUES ('t1', 'Ship handbook');
SELECT 't1-visible', count(*) FROM saas_tasks;
\echo '== tenant t2 からは見えない =='
SET app.tenant_id = 't2';
SELECT 't2-visible', count(*) FROM saas_tasks;
\echo '== t2セッションからt1のデータは書けない (WITH CHECK違反) =='
INSERT INTO saas_tasks(tenant_id, title) VALUES ('t1', '越境書き込み');
RESET ROLE;
SQL
grep -q "t1-visible|1" "$LOG/30.1-rls.out"; check "30.1 RLS: 自テナントの行が見える" $?
grep -q "t2-visible|0" "$LOG/30.1-rls.out"; check "30.1 RLS: 他テナントの行は見えない" $?
grep -q "new row violates row-level security" "$LOG/30.1-rls.out"; check "30.1 RLS: 越境書き込みが拒否される" $?

############################################
# まとめ
############################################
echo ""
echo "=== KEN-67 verification summary: PASS=$PASS FAIL=$FAIL ==="
rm -rf "$TMP"
exit $(( FAIL > 0 ? 1 : 0 ))
