import assert from 'node:assert/strict';
import test from 'node:test';
import { BTree } from './btree.solution.js';
import { AccountDatabase, demonstrateNonRepeatableRead } from './transaction-isolation/solution/main.js';
import { QueryCountingDatabase, loadWithJoin, loadWithNPlusOne } from './n-plus-one/solution/main.js';
import { MemoryAdapter, Model } from './mini-orm/solution/main.js';
import { INVENTORY, NOW, buildWorld, expired, fixedDispatch, fixedErase, fixedExport, fixedPurge, foreignRows, missingAuthoredRows, naiveErase, naiveExport, otherSubjectIntact, residual, revokeConsent, runFindings as runLifecycleFindings } from './data-lifecycle/solution/main.js';
import {
  FIXTURES,
  addCalendarDays,
  driftingRunCount,
  fixedCountForDay,
  fixedDailyRuns,
  fixedIsOverdue,
  fixedNextDaySameTime,
  formatLocal,
  naiveCountForDay,
  naiveDailyRuns,
  naiveIsOverdue,
  naiveNextDaySameTime,
  resolveInstant,
  runFindings,
} from './datetime-pitfalls/solution/main.js';

test('B-Tree supports search, replacement, ranges, depth, and print', () => {
  const tree = new BTree<number, string>(3); for (let index = 0; index < 1000; index += 1) tree.insert(index, `v${index}`);
  assert.equal(tree.search(500), 'v500'); tree.insert(500, 'updated'); assert.equal(tree.search(500), 'updated');
  assert.deepEqual(tree.range(10, 13), ['v10','v11','v12','v13']); assert.ok(tree.depth() < 10); assert.match(tree.print(), /\[/);
});

test('isolation simulator exposes non-repeatable read and serializable conflict', () => {
  assert.deepEqual(demonstrateNonRepeatableRead('read committed'), [100, 999]); assert.deepEqual(demonstrateNonRepeatableRead('repeatable read'), [100, 100]);
  const db = new AccountDatabase({ 1: 100 }); const a = db.begin('serializable'); const b = db.begin('serializable'); a.write(1, 200); a.commit(); b.write(1, 300); assert.throws(() => b.commit(), /Serialization/);
});

test('N+1 performs one plus N queries while join uses one', () => {
  const users = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }]; const posts = [{ id: 1, userId: 1, title: 'x' }, { id: 2, userId: 2, title: 'y' }];
  const bad = new QueryCountingDatabase(users, posts); assert.equal(loadWithNPlusOne(bad).length, 2); assert.equal(bad.queryCount, 3);
  const good = new QueryCountingDatabase(users, posts); assert.equal(loadWithJoin(good).length, 2); assert.equal(good.queryCount, 1); assert.match(good.explain('join').join(' '), /Hash Join/);
});

test('mini ORM supports CRUD, chained query, and placeholders', async () => {
  class User extends Model { static override tableName = 'users'; id!: number; name!: string; age!: number; }
  const adapter = new MemoryAdapter(); User.use(adapter);
  const alice = await User.create({ name: 'Alice', age: 30 }); const bob = await User.create({ name: 'Bob', age: 20 });
  assert.equal((await User.find(alice.id))?.name, 'Alice'); await User.update(bob.id, { age: 25 });
  const query = User.where({ age: { gte: 25 } }).orderBy('name', 'asc').limit(10); assert.deepEqual((await query).map((user) => user.name), ['Alice','Bob']);
  assert.deepEqual(query.compile(), { sql: 'SELECT * FROM users WHERE age >= ? ORDER BY name ASC LIMIT ?', params: [25, 10] });
  assert.equal(await User.delete(alice.id), true); assert.equal(await User.find(alice.id), undefined);
});

test('local time resolution handles skipped and repeated wall clock times', () => {
  const zone = 'America/New_York';
  // 2026-03-08 02:30 は存在しない。切り替え後の 03:30 へ送られる
  assert.equal(formatLocal(resolveInstant({ year: 2026, month: 3, day: 8, hour: 2, minute: 30 }, zone), zone), '2026-03-08 03:30');
  // 2026-11-01 01:30 は2回訪れる。先に訪れるほう (-04:00) を採る
  assert.equal(resolveInstant({ year: 2026, month: 11, day: 1, hour: 1, minute: 30 }, zone).toISOString(), '2026-11-01T05:30:00.000Z');
  assert.equal(addCalendarDays('2026-02-28', 1), '2026-03-01');
});

test('the four datetime bugs reproduce with the naive code and vanish after the fix', () => {
  const findings = runFindings();
  assert.equal(findings.length, 4);
  assert.deepEqual(findings.filter((finding) => finding.reproduced).map((finding) => finding.id), ['D1', 'D2', 'D3', 'D4']);
  assert.deepEqual(findings.filter((finding) => finding.remains), []);
  const plan = FIXTURES.springPlan;
  assert.equal(driftingRunCount(naiveDailyRuns(plan), plan), 3);
  assert.equal(driftingRunCount(fixedDailyRuns(plan), plan), 1);
  assert.equal(naiveIsOverdue(FIXTURES.dueDate, FIXTURES.duringDueDate), true);
  assert.equal(fixedIsOverdue(FIXTURES.dueDate, FIXTURES.duringDueDate, FIXTURES.plainZone), false);
  assert.equal(formatLocal(naiveNextDaySameTime(FIXTURES.beforeFallBack), FIXTURES.dstZone), '2026-11-01 19:00');
  assert.equal(formatLocal(fixedNextDaySameTime(FIXTURES.beforeFallBack, FIXTURES.dstZone), FIXTURES.dstZone), '2026-11-01 20:00');
  assert.equal(naiveCountForDay(FIXTURES.events, FIXTURES.dueDate), 3);
  assert.equal(fixedCountForDay(FIXTURES.events, FIXTURES.dueDate, FIXTURES.plainZone), 4);
});

test('personal data lifecycle gaps are reproduced and then closed', () => {
  const findings = runLifecycleFindings();
  assert.equal(findings.length, 4);
  assert.deepEqual(findings.filter((f) => f.reproduced).map((f) => f.id), ['P1', 'P2', 'P3', 'P4']);
  assert.deepEqual(findings.filter((f) => f.remains), []);
  assert.equal(otherSubjectIntact(), true);
});

test('erasure follows the inventory and stays idempotent', () => {
  const naive = buildWorld().world;
  naiveErase(naive, 'S1');
  const leftover = [...new Set(residual(naive, 'S1').map((entry) => entry.location))].sort();
  assert.deepEqual(leftover, ['analytics.events', 'db.audit_log', 'log.requests', 'saas.crm', 'search.users', 'storage.uploads']);

  const fixed = buildWorld().world;
  const first = fixedErase(fixed, 'S1');
  assert.equal(first.state, 'done');
  assert.equal(Object.values(first.targets).every((state) => state === 'done'), true);
  assert.equal(Object.keys(first.targets).length, INVENTORY.length);
  assert.equal(residual(fixed, 'S1').length, 0);
  fixedErase(fixed, 'S1'); // 再実行しても結果が変わらない
  assert.equal(residual(fixed, 'S1').length, 0);
  // 監査ログの行は残す。行ごと消すと監査の意味が失われる。
  assert.equal(fixed.stores.get('db.audit_log')?.length, 2);
  assert.equal(fixed.stores.get('search.users')?.length, 0);
});

test('unimplemented locations make erasure and export fail loudly', () => {
  const world = buildWorld().world;
  world.stores.delete('saas.crm');
  assert.throws(() => fixedErase(world, 'S1'), /saas\.crm/);
  const exportWorld = buildWorld().world;
  exportWorld.stores.delete('storage.uploads');
  assert.throws(() => fixedExport(exportWorld, 'S1'), /storage\.uploads/);
});

test('retention purge clears expired identifiers within a bounded batch', () => {
  const world = buildWorld().world;
  assert.equal(expired(world, NOW).length, 4);
  assert.equal(fixedPurge(world, NOW, 2), 2);
  assert.equal(expired(world, NOW).length, 2);
  assert.equal(fixedPurge(world, NOW), 2);
  assert.equal(expired(world, NOW).length, 0);
});

test('export keeps foreign rows out without dropping the subject own content', () => {
  const world = buildWorld().world;
  const naive = naiveExport(world, 'S1');
  assert.equal(foreignRows(world, naive), 1);
  const fixed = fixedExport(world, 'S1');
  assert.equal(foreignRows(world, fixed), 0);
  assert.equal(missingAuthoredRows(world, fixed), 0);
  assert.equal(fixed.rows.some((entry) => entry.location === 'db.audit_log'), false);
});

test('revoked consent stops the dispatch only for the revoking subject', () => {
  const { world, consents } = buildWorld();
  revokeConsent(consents, 'S1', 'marketing', NOW - 24 * 60 * 60 * 1000);
  assert.deepEqual(fixedDispatch(world, consents, NOW), ['S2']);
  assert.deepEqual(world.sent, ['S2']);
});
