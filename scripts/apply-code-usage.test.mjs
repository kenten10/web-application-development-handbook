import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildBlock, commandFor, findBlock, priority } from './apply-code-usage.mjs';

test('priority はブラウザ課題の HTML を最優先にする', () => {
  assert.ok(priority('code/ch04/render-bench/index.solution.html') < priority('code/ch04/x.solution.ts'));
  assert.ok(priority('code/ch12/typed-rpc/solution/main.ts') < priority('code/ch12/dataloader.solution.ts'));
  assert.equal(priority('code/ch02/blog-api/solution/README.md'), 99, 'md は実行対象にしない');
});

test('commandFor は拡張子ごとに実行コマンドを選ぶ', () => {
  assert.equal(
    commandFor(19, 'code/ch19/manifest-validator/solution/main.ts'),
    'pnpm --filter @handbook/ch19 exec tsx manifest-validator/solution/main.ts',
  );
  assert.equal(commandFor(19, 'code/ch19/x/solution/main.sh'), 'bash code/ch19/x/solution/main.sh');
  assert.equal(commandFor(10, 'code/ch10/t/solution/main.mjs'), 'node code/ch10/t/solution/main.mjs');
  assert.equal(commandFor(4, 'code/ch04/a/index.solution.html'), 'open code/ch04/a/index.solution.html');
});

test('buildBlock は章ごとに一意な見出しと pnpm 手順を出す', () => {
  const block = buildBlock(7, [
    { id: '7.1', solution: ['code/ch07/redux.solution.ts'] },
    { id: '7.2', solution: ['code/ch07/notes/solution.md'] },
  ]);
  assert.match(block, /^<!-- handbook:code-usage:start \{"chapter":7\} -->/);
  assert.match(block, /### 第7章のコード集の使い方/);
  assert.match(block, /pnpm --filter @handbook\/ch07 run test/);
  assert.match(block, /pnpm --filter @handbook\/ch07 exec tsx redux\.solution\.ts {2}# 課題7\.1/);
  assert.match(block, /課題7\.2 はコマンドで完結しない観察・記録課題/);
  assert.ok(block.endsWith('<!-- handbook:code-usage:end -->'));
  assert.ok(!/(^|\n)npm /.test(block), 'npm ではなく pnpm を案内する');
});

test('findBlock はマーカーが無い旧ブロックも見出しからフェンス終端まで拾う', () => {
  const lines = ['### コード集の使い方', '', '```bash', 'cd code/ch02', '```', '', '---'];
  assert.deepEqual(findBlock(lines, 0), { start: 0, end: 4 });
});

test('findBlock はマーカー付きブロックをマーカーごと置き換え対象にする', () => {
  const lines = [
    '<!-- handbook:code-usage:start {"chapter":2} -->',
    '### 第2章のコード集の使い方',
    '',
    '```bash',
    'pnpm install',
    '```',
    '<!-- handbook:code-usage:end -->',
  ];
  assert.deepEqual(findBlock(lines, 1), { start: 0, end: 6 });
});
