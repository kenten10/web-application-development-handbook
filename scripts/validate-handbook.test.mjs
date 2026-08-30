import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const result = spawnSync(process.execPath, ['scripts/validate-handbook.mjs'], {
  cwd: new URL('..', import.meta.url),
  encoding: 'utf8',
});

const output = `${result.stdout}\n${result.stderr}`;

test('30章と415節を検出する', () => {
  assert.match(output, /- chapters: 30/);
  assert.match(output, /- numbered sections\/subsections: 415/);
});

test('全節の学習レベルメタデータを検出する', () => {
  assert.match(output, /- learning metadata: 415/);
  assert.doesNotMatch(output, /LEARNING_(?:METADATA_MISSING|LEVEL_INVALID|MINUTES_INVALID|MANIFEST_MISSING|TITLE_MISMATCH|METADATA_DRIFT|UNKNOWN_SECTION)/);
});

test('目次と本文の既知タイトル不一致がない', () => {
  assert.doesNotMatch(output, /TOC_SECTION_TITLE/);
});

test('コードブロックをMarkdownリンクとして誤検出しない', () => {
  assert.doesNotMatch(output, /require, module, module\.exports/);
});

test('本文のコード参照先がすべて配置されている', () => {
  assert.equal(result.status, 0);
  assert.doesNotMatch(output, /CODE_TARGET_MISSING/);
});

test('全30章の共通教材ガイドを検出する', () => {
  assert.match(output, /- chapter guides: 30/);
  assert.doesNotMatch(output, /CHAPTER_GUIDE_(?:MANIFEST_INVALID|MANIFEST_MISSING|TITLE_MISMATCH|FIELD_MISSING|BLOCK_COUNT|ELEMENT_MISSING|SECTION_MISSING|PREREQUISITE_MISSING|UNKNOWN_CHAPTER)/);
});
