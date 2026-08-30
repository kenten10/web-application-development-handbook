import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));
const bodyFiles = [
  '02-part1-foundations.md','03-part2-frontend.md','04-part3-backend.md',
  '05-part4-data.md','06-part5-infrastructure.md','07-part6-quality.md','08-part7-practice.md',
];
const labels = [
  '解決する実務上の問題','到達目標','前提知識','中核概念','最小実装','本番実装との差分',
  '典型的な失敗','診断・デバッグ方法','意思決定チェックリスト','演習と評価基準','一次資料・発展資料',
];

test('chapter guides are current', () => {
  const result = spawnSync(process.execPath, ['scripts/apply-chapter-guides.mjs', '--check'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('all 30 chapters have exactly one generated guide', () => {
  const text = bodyFiles.map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
  const starts = [...text.matchAll(/<!-- handbook:chapter-guide:start \{"chapter":(\d+)\} -->/g)].map((m) => Number(m[1]));
  assert.equal(starts.length, 30);
  assert.deepEqual(starts.sort((a, b) => a - b), Array.from({ length: 30 }, (_, i) => i + 1));
});

test('every chapter guide contains the 11 required elements', () => {
  const text = bodyFiles.map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
  const blocks = [...text.matchAll(/<!-- handbook:chapter-guide:start \{"chapter":(\d+)\} -->([\s\S]*?)<!-- handbook:chapter-guide:end -->/g)];
  assert.equal(blocks.length, 30);
  for (const [, chapter, block] of blocks) {
    for (const label of labels) assert.match(block, new RegExp(label), `第${chapter}章に ${label} がない`);
  }
});

test('manifest covers all chapters and key educational warnings', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'config/chapter-guides.json'), 'utf8'));
  assert.equal(Object.keys(manifest.chapters).length, 30);
  assert.match(manifest.chapters['5'].productionGaps.join(' '), /自作Promise|自作Promise|自作Promise/i);
  assert.match(manifest.chapters['13'].productionGaps.join(' '), /公開認証基盤として利用しない/);
  assert.match(manifest.chapters['23'].productionGaps.join(' '), /隔離環境/);
});

test('template document explains non-repetitive application', () => {
  const guide = fs.readFileSync(path.join(root, 'CHAPTER_TEMPLATE.md'), 'utf8');
  assert.match(guide, /既存の節を11の教材要素へ対応付ける/);
  assert.match(guide, /対象章: 30\/30/);
});
