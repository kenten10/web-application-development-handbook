import assert from 'node:assert/strict';
import test from 'node:test';
import { createMiniReact, useEffect, useMemo, useRef, useState } from './mini-react/mini-react.solution.js';
import { computed, createSignal, effect } from './signals.solution.js';
import { diff, type VNode } from './vdom-diff.solution.js';
import { accessibleName, buildScreen, deleteItem, find, fixedDialog, fixedForm, naiveDialog, naiveForm, reachable, runFindings as runA11yFindings, tabbables, validSubmitAnnounced } from './a11y-focus/solution/main.js';

test('mini React keeps hook order and runs effect cleanup', async () => {
  let increment!: () => void;
  const effects: string[] = [];
  const runtime = createMiniReact(() => {
    const [count, setCount] = useState(0);
    increment = () => setCount((n) => n + 1);
    const doubled = useMemo(() => count * 2, [count]);
    const renders = useRef(0); renders.current += 1;
    useEffect(() => { effects.push(`effect:${count}`); return () => effects.push(`cleanup:${count}`); }, [count]);
    return { count, doubled, renders: renders.current };
  });
  assert.deepEqual(runtime.render(), { count: 0, doubled: 0, renders: 1 });
  increment();
  await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
  assert.deepEqual(runtime.render(), { count: 1, doubled: 2, renders: 3 });
  assert.deepEqual(effects, ['effect:0', 'cleanup:0', 'effect:1']);
  runtime.dispose();
  assert.equal(effects.at(-1), 'cleanup:1');
});

test('signals track dependencies and skip equal values', () => {
  const [count, setCount] = createSignal(1);
  const doubled = computed(() => count() * 2);
  const seen: number[] = [];
  const dispose = effect(() => seen.push(doubled()));
  setCount(1);
  setCount(2);
  dispose();
  setCount(3);
  assert.deepEqual(seen, [2, 4]);
});

test('signals reject direct cycles', () => {
  const [value, setValue] = createSignal(0);
  assert.throws(() => effect(() => { if (value() < 1) setValue(1); }), /cycle/i);
});

test('VDOM diff updates only changed nodes and emits keyed moves', () => {
  const oldTree: VNode = { type: 'ul', children: [
    { type: 'li', key: 'a', children: ['A'] },
    { type: 'li', key: 'b', children: ['B'] },
  ] };
  const newTree: VNode = { type: 'ul', children: [
    { type: 'li', key: 'b', children: ['B2'] },
    { type: 'li', key: 'a', children: ['A'] },
  ] };
  const patches = diff(oldTree, newTree);
  assert.equal(patches.filter((p) => p.type === 'MOVE').length, 2);
  assert.equal(patches.filter((p) => p.type === 'TEXT').length, 1);
  assert.equal(patches.some((p) => p.type === 'REPLACE'), false);
});

test('focus and error delivery barriers are reproduced and then removed', () => {
  const findings = runA11yFindings();
  assert.equal(findings.length, 4);
  assert.deepEqual(findings.filter((f) => f.reproduced).map((f) => f.id), ['A1', 'A2', 'A3', 'A4']);
  assert.deepEqual(findings.filter((f) => f.remains), []);
  assert.equal(validSubmitAnnounced(), true);
});

test('inert removes the background from the tab order while aria-hidden alone does not', () => {
  const naive = buildScreen();
  naive.activeId = 'del-2';
  naiveDialog.open(naive);
  assert.ok(tabbables(naive.root).some((node) => node.id === 'del-1'));

  const fixed = buildScreen();
  fixed.activeId = 'del-2';
  fixedDialog.open(fixed);
  assert.deepEqual(tabbables(fixed.root).map((node) => node.id), ['confirm', 'cancel']);
  assert.equal(fixed.activeId, 'confirm');
});

test('closing a dialog restores focus, or falls back when the trigger is gone', () => {
  const kept = buildScreen();
  kept.activeId = 'del-2';
  fixedDialog.open(kept);
  fixedDialog.close(kept);
  assert.equal(kept.activeId, 'del-2');

  const removed = buildScreen();
  removed.activeId = 'del-2';
  fixedDialog.open(removed);
  deleteItem(removed, 'item-2');
  fixedDialog.close(removed);
  assert.equal(removed.activeId, 'page-title');
  assert.equal(find(removed.root, 'page-title')?.attrs['tabindex'], '-1');
});

test('form errors reach the assistive path only when wired to name, description or focus', () => {
  const naive = buildScreen();
  naive.activeId = 'submit';
  const naiveResult = naiveForm.submit(naive, { email: '' });
  assert.equal(reachable(naive).join(' ').includes(naiveResult.errors['email'] ?? 'x'), false);

  const fixed = buildScreen();
  fixed.activeId = 'submit';
  const fixedResult = fixedForm.submit(fixed, { email: 'nope' });
  assert.equal(fixed.activeId, 'error-summary');
  assert.equal(find(fixed.root, 'email')?.attrs['aria-invalid'], 'true');
  assert.equal(find(fixed.root, 'email')?.attrs['aria-describedby'], 'email-help email-error');
  assert.ok(reachable(fixed).join(' ').includes(fixedResult.errors['email'] ?? 'x'));
  const summary = find(fixed.root, 'error-summary')!;
  assert.equal(accessibleName(fixed.root, summary), '入力内容に1件の問題があります');
});
