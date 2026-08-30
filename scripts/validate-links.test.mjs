import assert from 'node:assert/strict';
import { test } from 'node:test';
import { githubSlug, splitFences } from './validate-links.mjs';

test('githubSlug は GitHub と同じ規則でアンカー候補を作る', () => {
  assert.equal(githubSlug('コード集の使い方'), 'コード集の使い方');
  assert.equal(githubSlug('23.6 認証関連の脆弱性'), '236-認証関連の脆弱性');
  assert.equal(githubSlug('Alternatives Considered'), 'alternatives-considered');
  assert.equal(githubSlug('`code` と **強調**'), 'code-と-強調');
});

test('splitFences はフェンス内の行へ inFence を立てる', () => {
  const rows = splitFences(['本文', '```text', '## Context', '```', '## 本物の見出し'].join('\n'));
  assert.equal(rows.length, 5);
  assert.equal(rows[0].inFence, false);
  assert.equal(rows[2].inFence, true, 'フェンス内の見出しはアンカー候補にしない');
  assert.equal(rows[4].inFence, false);
});

test('splitFences は入れ子に見えるチルダフェンスも閉じる', () => {
  const rows = splitFences(['~~~text', 'a', '~~~', 'b'].join('\n'));
  assert.equal(rows[1].inFence, true);
  assert.equal(rows[3].inFence, false);
});
