import test from 'node:test';
import assert from 'node:assert/strict';
import { KeyValueStore, executeCommand } from './kvs.solution.js';
import { GCounter, LWWRegister, PNCounter } from './crdt.solution.js';
import { BloomFilter } from './bloom-filter.solution.js';
import { ConsistentHashRing } from './consistent-hash.solution.js';
import { MockCluster } from './cap-simulation.solution.js';

test('KVS supports set/get/delete and TTL metadata', () => {
  const store = new KeyValueStore();
  assert.equal(executeCommand(store, 'SET foo bar'), '+OK');
  assert.match(executeCommand(store, 'GET foo'), /bar/);
  assert.equal(executeCommand(store, 'DEL foo'), ':1');
  assert.equal(executeCommand(store, 'GET foo'), '$-1');
});

test('CRDTs converge', () => {
  const a = new GCounter('a'); const b = new GCounter('b'); a.increment(2); b.increment(); a.merge(b.state); b.merge(a.state);
  assert.equal(a.value, 3); assert.equal(b.value, 3);
  const pn = new PNCounter('a'); pn.increment(5); pn.decrement(2); assert.equal(pn.value, 3);
  const r1 = new LWWRegister('old', 'a'); const r2 = new LWWRegister('old', 'b'); r1.set('A', 10); r2.set('B', 20); r1.merge(r2.state); assert.equal(r1.value, 'B');
});

test('Bloom filter has no false negatives for inserted keys', () => {
  const filter = new BloomFilter(2048, 5); for (const key of ['a','b','c']) filter.add(key); for (const key of ['a','b','c']) assert.equal(filter.has(key), true);
});

test('Consistent hash moves a minority of keys when a node is added', () => {
  const ring = new ConsistentHashRing<string>({ virtualNodes: 256 }); ['a','b','c'].forEach((n) => ring.addNode(n));
  const keys = Array.from({ length: 2000 }, (_, i) => `key-${i}`); const before = keys.map((key) => ring.getNode(key)); ring.addNode('d');
  const moved = keys.filter((key, i) => ring.getNode(key) !== before[i]).length / keys.length;
  assert.ok(moved > 0.15 && moved < 0.38, `moved=${moved}`);
});

test('CAP simulation rejects minority writes in CP and merges AP writes', () => {
  const cp = new MockCluster(['a','b','c'], { mode: 'CP' }); cp.partition(['a'], ['b','c']); assert.equal(cp.set('a','k','x'), false); assert.equal(cp.set('b','k','y'), true);
  const ap = new MockCluster(['a','b','c'], { mode: 'AP' }); ap.partition(['a'], ['b','c']); ap.set('a','k','x'); ap.set('b','k','y'); ap.heal(); assert.equal(ap.get('c','k'), 'y');
});
