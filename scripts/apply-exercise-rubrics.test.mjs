import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const root = resolve(import.meta.dirname, '..');
const bodyFiles = [
  '02-part1-foundations.md',
  '03-part2-frontend.md',
  '04-part3-backend.md',
  '05-part4-data.md',
  '06-part5-infrastructure.md',
  '07-part6-quality.md',
  '08-part7-practice.md',
];

function run(args = [], cwd = root) {
  return spawnSync(process.execPath, ['scripts/apply-exercise-rubrics.mjs', ...args], { cwd, encoding: 'utf8' });
}

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'handbook-cards-'));
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  cpSync(join(root, 'scripts/apply-exercise-rubrics.mjs'), join(dir, 'scripts/apply-exercise-rubrics.mjs'));
  cpSync(join(root, 'config'), join(dir, 'config'), { recursive: true });
  for (const file of bodyFiles) cpSync(join(root, file), join(dir, file));
  return dir;
}

test('exercise cards in the manuscript are current', () => {
  const result = run(['--check']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Exercise cards check passed: \d+ card\(s\)/);
});

test('every card renders the required rubric labels', () => {
  const labels = ['**前提**', '**完成条件 (自己採点用チェックリスト)**', '**期待出力**', '**観察項目**',
    '**テスト方法 (自己採点手順)**', '**段階的ヒント**', '**本番利用時の警告**', '**導線**', '**推定時間の内訳**'];
  let cards = 0;
  for (const file of bodyFiles) {
    const text = readFileSync(join(root, file), 'utf8');
    for (const match of text.matchAll(/<!-- handbook:exercise:start \{"id":"([0-9.]+)"\} -->([\s\S]*?)<!-- handbook:exercise:end -->/g)) {
      cards += 1;
      for (const label of labels) {
        assert.ok(match[2].includes(label), `課題${match[1]} に ${label} がありません`);
      }
      for (const line of match[2].split('\n').filter((value) => value !== '')) {
        assert.ok(line.startsWith('>'), `課題${match[1]} のカード行が引用形式ではありません: ${line}`);
      }
    }
  }
  assert.ok(cards >= 132, `演習カードが少なすぎます: ${cards}`);
});

test('applying the cards twice is idempotent', () => {
  const dir = fixture();
  try {
    const first = run(['--root', dir], dir);
    assert.equal(first.status, 0, first.stderr);
    const snapshot = bodyFiles.map((file) => readFileSync(join(dir, file), 'utf8'));
    const second = run(['--root', dir], dir);
    assert.equal(second.status, 0, second.stderr);
    bodyFiles.forEach((file, index) => {
      assert.equal(readFileSync(join(dir, file), 'utf8'), snapshot[index], file);
    });
    const check = run(['--root', dir, '--check'], dir);
    assert.equal(check.status, 0, check.stderr);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a hand-edited card is detected and restored', () => {
  const dir = fixture();
  try {
    const file = join(dir, '02-part1-foundations.md');
    const text = readFileSync(file, 'utf8');
    writeFileSync(file, text.replace('> **前提**', '> **改ざんされた見出し**'));
    const check = run(['--root', dir, '--check'], dir);
    assert.notEqual(check.status, 0);
    assert.match(check.stderr, /Exercise cards are out of date/);
    const apply = run(['--root', dir], dir);
    assert.equal(apply.status, 0, apply.stderr);
    assert.equal(readFileSync(file, 'utf8'), text);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('an unregistered 課題 heading is rejected', () => {
  const dir = fixture();
  try {
    const manifestPath = join(dir, 'config/exercises.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.chapters['02'].exercises = manifest.chapters['02'].exercises.filter((exercise) => exercise.id !== '2.1');
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const result = run(['--root', dir, '--check'], dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /課題2\.1 がマニフェストにありません/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
