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

test('learning metadata is current', () => {
  const result = spawnSync(process.execPath, ['scripts/apply-learning-levels.mjs', '--check'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('all 415 numbered sections have generated metadata', () => {
  const count = bodyFiles
    .map((file) => fs.readFileSync(path.join(root, file), 'utf8'))
    .reduce((sum, text) => sum + [...text.matchAll(/^<!-- handbook:learning /gm)].length, 0);
  assert.equal(count, 415);
});

test('manifest covers every numbered section exactly once', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'config/learning-levels.json'), 'utf8'));
  assert.equal(Object.keys(manifest.sections).length, 415);
  assert.equal(manifest.sections['23.14'].level, 'advanced');
  assert.equal(manifest.sections['23.21'].level, 'outlook');
  assert.equal(manifest.sections['18.11'].level, 'advanced');
});

test('generated guide exposes a realistic first-reading route', () => {
  // 期待値は正本から導く。数値を直書きすると、節の推定時間を1つ直すたびに
  // テスト側も書き換えることになり、「正本と生成物が一致しているか」ではなく
  // 「昔の数値のままか」を検査してしまう (KEN-61)。
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'config/learning-levels.json'), 'utf8'));
  const sections = Object.values(manifest.sections);
  const required = sections.filter((section) => section.level === 'required');
  const format = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (hours === 0) return `${rest}分`;
    return rest === 0 ? `${hours}時間` : `${hours}時間${rest}分`;
  };
  const requiredMinutes = required.reduce((sum, section) => sum + section.minutes, 0);
  const totalMinutes = sections.reduce((sum, section) => sum + section.minutes, 0);

  const guide = fs.readFileSync(path.join(root, 'LEARNING_LEVELS.md'), 'utf8');
  assert.match(guide, new RegExp(`必修[^\\n]*${required.length}節、${format(requiredMinutes)}`));
  assert.match(guide, new RegExp(`全分類[^\\n]*${format(totalMinutes)}`));
});
