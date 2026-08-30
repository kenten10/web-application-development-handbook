import assert from 'node:assert/strict';
import test from 'node:test';
import { MyPromise } from './my-promise.solution.js';
import { runAsync } from './run-async.solution.js';
import { TypedEmitter } from './typed-emitter.solution.js';
import { formatCurrency, plural } from './i18n-utils.solution.js';

test('MyPromise chains and schedules handlers as microtasks', async () => {
  const order: string[] = [];
  const value = await new MyPromise<number>((resolve) => resolve(41))
    .then((n) => { order.push('then'); return n + 1; });
  order.unshift('sync');
  assert.equal(value, 42);
  assert.deepEqual(order, ['sync', 'then']);
});

test('MyPromise combinators and finally work', async () => {
  let finalized = false;
  const all = await MyPromise.all([MyPromise.resolve(1), 2, Promise.resolve(3)] as const);
  assert.deepEqual(all, [1, 2, 3]);
  const settled = await MyPromise.allSettled([1, MyPromise.reject('x')] as const);
  assert.equal(settled[1].status, 'rejected');
  assert.equal(await MyPromise.race([MyPromise.resolve('first'), new MyPromise((r) => setTimeout(() => r('later'), 5))]), 'first');
  await MyPromise.resolve(1).finally(() => { finalized = true; });
  assert.equal(finalized, true);
});

test('runAsync propagates resolved values and errors', async () => {
  const value = await runAsync((function* () {
    const a = yield Promise.resolve(20);
    const b = yield Promise.resolve(22);
    return Number(a) + Number(b);
  })());
  assert.equal(value, 42);
  await assert.rejects(runAsync((function* () { yield Promise.reject(new Error('boom')); return 0; })()), /boom/);
});

test('TypedEmitter supports on/off/once', () => {
  type Events = { tick: number; done: string };
  const emitter = new TypedEmitter<Events>();
  const values: number[] = [];
  const off = emitter.on('tick', (n) => values.push(n));
  emitter.once('tick', (n) => values.push(n * 10));
  emitter.emit('tick', 2);
  emitter.emit('tick', 3);
  off();
  emitter.emit('tick', 4);
  assert.deepEqual(values, [2, 20, 3]);
});

test('Intl helpers produce locale-aware values', () => {
  assert.match(formatCurrency(1500, 'JPY', 'ja-JP'), /1,500/);
  assert.equal(plural(0, 'en-US', { zero: 'no apples', one: '1 apple', other: '{n} apples' }), 'no apples');
  assert.equal(plural(5, 'en-US', { one: '1 apple', other: '{n} apples' }), '5 apples');
});
