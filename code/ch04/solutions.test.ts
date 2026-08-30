import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateSpecificity, compareSpecificity, sortSelectors } from './css-specificity.solution.js';
import { MiniEventLoop } from './event-loop/event-loop.solution.js';

test('mini event loop drains initial and nested microtasks at checkpoints', () => {
  const output: string[] = [];
  const loop = new MiniEventLoop();
  loop.addMacrotask(() => { output.push('macro'); loop.addMicrotask(() => output.push('nested micro')); });
  loop.addMicrotask(() => output.push('initial micro'));
  loop.run();
  assert.deepEqual(output, ['initial micro', 'macro', 'nested micro']);
});

test('CSS specificity matches the chapter example', () => {
  assert.deepEqual(calculateSpecificity('#header .nav li:hover a'), { inline: 0, id: 1, class: 2, type: 2, important: false });
});

test(':where has zero specificity and :is uses the strongest argument', () => {
  assert.deepEqual(calculateSpecificity(':where(#ignored) article'), { inline: 0, id: 0, class: 0, type: 1, important: false });
  assert.equal(compareSpecificity(calculateSpecificity(':is(.a, #b)'), calculateSpecificity('.a')), 1);
  assert.deepEqual(sortSelectors(['p', '.x', '#id']), ['#id', '.x', 'p']);
});
