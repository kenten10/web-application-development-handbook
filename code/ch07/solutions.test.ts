import assert from 'node:assert/strict';
import test from 'node:test';
import { createStore } from './redux.solution.js';
import { QueryCache } from './query-cache.solution.js';
import { OptimisticStore } from './optimistic/solution/optimistic-update.js';

test('Redux store notifies subscribers and unsubscribe works', () => {
  type CounterAction = { type: 'inc' } | { type: 'set'; payload: number };
  const store = createStore<number, CounterAction>((state, action) => action.type === 'inc' ? state + 1 : action.payload, 0);
  const seen: number[] = [];
  const unsubscribe = store.subscribe(() => seen.push(store.getState()));
  store.dispatch({ type: 'inc' });
  store.dispatch({ type: 'set', payload: 10 });
  unsubscribe();
  store.dispatch({ type: 'inc' });
  assert.deepEqual(seen, [1, 10]);
  assert.equal(store.getState(), 11);
});

test('QueryCache deduplicates in-flight requests and respects staleTime', async () => {
  let time = 0;
  let calls = 0;
  const cache = new QueryCache(() => time);
  const fetcher = async () => { calls += 1; await new Promise((resolve) => setTimeout(resolve, 5)); return { id: 1, calls }; };
  const [a, b, c] = await Promise.all([
    cache.fetch(['user', 1], fetcher, { staleTime: 100 }),
    cache.fetch(['user', 1], fetcher, { staleTime: 100 }),
    cache.fetch(['user', 1], fetcher, { staleTime: 100 }),
  ]);
  assert.equal(calls, 1);
  assert.deepEqual(a, b); assert.deepEqual(b, c);
  time = 50;
  await cache.fetch(['user', 1], fetcher, { staleTime: 100 });
  assert.equal(calls, 1);
  cache.invalidate(['user', 1]);
  await cache.fetch(['user', 1], fetcher, { staleTime: 100 });
  assert.equal(calls, 2);
});

test('OptimisticStore rolls back only failed operation', async () => {
  const store = new OptimisticStore({ count: 0 });
  let rejectFirst!: (error: Error) => void;
  let resolveSecond!: () => void;
  const first = store.mutate((s) => ({ count: s.count + 1 }), () => new Promise<void>((_, reject) => { rejectFirst = reject; }));
  const second = store.mutate((s) => ({ count: s.count + 10 }), () => new Promise<void>((resolve) => { resolveSecond = resolve; }));
  assert.equal(store.getState().count, 11);
  resolveSecond();
  await second;
  rejectFirst(new Error('fail'));
  const result = await first;
  assert.equal(result.ok, false);
  assert.equal(store.getState().count, 10);
});
