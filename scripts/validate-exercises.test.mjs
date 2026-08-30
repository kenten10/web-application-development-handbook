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
function run(args = [], cwd = root) { return spawnSync(process.execPath, ['scripts/validate-exercises.mjs', ...args], { cwd, encoding: 'utf8' }); }
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'handbook-exercises-'));
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  cpSync(join(root, 'scripts/validate-exercises.mjs'), join(dir, 'scripts/validate-exercises.mjs'));
  cpSync(join(root, 'config'), join(dir, 'config'), { recursive: true });
  cpSync(join(root, 'code'), join(dir, 'code'), { recursive: true });
  for (const file of bodyFiles) cpSync(join(root, file), join(dir, file));
  return dir;
}
function loadManifest(dir) {
  return JSON.parse(readFileSync(join(dir, 'config/exercises.json'), 'utf8'));
}
function saveManifest(dir, manifest) {
  writeFileSync(join(dir, 'config/exercises.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}
test('all chapters have normalized starter, solution, and README artifacts', () => {
  const result = run(['--allow-placeholders']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Exercise chapters: 30/);
  assert.match(result.stdout, /Exercise validation passed/);
});
test('a single chapter can be validated', () => {
  const result = run(['--chapter', 'ch07', '--allow-placeholders']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Exercise chapters: 1/);
});

test('every 課題 heading in the manuscript has exactly one exercise card', () => {
  const result = run(['--allow-placeholders']);
  assert.equal(result.status, 0, result.stderr);
  const match = result.stdout.match(/Exercise cards: (\d+) \/ headings: (\d+)/);
  assert.ok(match, result.stdout);
  assert.equal(match[1], match[2]);
  assert.ok(Number(match[2]) >= 132, `課題見出しが少なすぎます: ${match[2]}`);
});

test('observation exercises are registered with the same rubric fields', () => {
  const result = run(['--allow-placeholders']);
  assert.equal(result.status, 0, result.stderr);
  const manifest = loadManifest(root);
  assert.ok(Array.isArray(manifest.observationExercises));
  assert.ok(manifest.observationExercises.length >= 1);
  for (const exercise of manifest.observationExercises) {
    for (const field of ['prerequisites', 'completion', 'expected', 'observations', 'verification', 'hints', 'warnings', 'estimateBasis']) {
      assert.ok(exercise[field], `${exercise.id}: ${field}`);
    }
  }
});

test('placeholder solution artifacts are rejected', () => {
  const dir = fixture();
  try {
    const manifest = loadManifest(dir);
    const solution = manifest.chapters['25'].exercises[0].solution[0];
    writeFileSync(join(dir, solution), `// Model answer scaffold\nexport const referenceArtifact = true;\n`);
    const result = run(['--root', dir], dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /SOLUTION_PLACEHOLDER/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('missing starter is rejected', () => {
  const dir = fixture();
  try {
    const manifest = loadManifest(dir);
    const starter = manifest.chapters['01'].exercises[0].starter[0];
    rmSync(join(dir, starter));
    const result = run(['--root', dir, '--allow-placeholders'], dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /STARTER_TARGET_MISSING/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('README format drift is rejected', () => {
  const dir = fixture();
  try {
    writeFileSync(join(dir, 'code/ch01/README.md'), '# broken\n');
    const result = run(['--root', dir, '--allow-placeholders'], dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /README_FORMAT/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('generated distribution artifacts are rejected', () => {
  const dir = fixture();
  try {
    mkdirSync(join(dir, 'code/ch01/dist'));
    const result = run(['--root', dir, '--allow-placeholders'], dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /FORBIDDEN_ARTIFACT/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('installed node_modules are tolerated in a working copy', () => {
  const dir = fixture();
  try {
    mkdirSync(join(dir, 'code/ch01/node_modules'), { recursive: true });
    const result = run(['--root', dir, '--allow-placeholders'], dir);
    assert.equal(result.status, 0, result.stderr);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('node_modules are rejected in distribution audit mode', () => {
  const dir = fixture();
  try {
    mkdirSync(join(dir, 'code/ch01/node_modules'), { recursive: true });
    const result = run(['--root', dir, '--allow-placeholders', '--dist-audit'], dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /FORBIDDEN_ARTIFACT/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// --- KEN-48: 自己採点用メタデータの検証 ---

test('a missing rubric field is rejected', () => {
  const dir = fixture();
  try {
    const manifest = loadManifest(dir);
    delete manifest.chapters['02'].exercises[0].completion;
    saveManifest(dir, manifest);
    const result = run(['--root', dir, '--allow-placeholders'], dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /RUBRIC_FIELD_MISSING/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('too few completion criteria are rejected', () => {
  const dir = fixture();
  try {
    const manifest = loadManifest(dir);
    manifest.chapters['02'].exercises[0].completion = ['1つだけの完成条件にする'];
    saveManifest(dir, manifest);
    const result = run(['--root', dir, '--allow-placeholders'], dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /RUBRIC_FIELD_COUNT/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('hints must have exactly three stages', () => {
  const dir = fixture();
  try {
    const manifest = loadManifest(dir);
    manifest.chapters['02'].exercises[0].hints = ['方針だけのヒントを書く', '構造だけのヒントを書く'];
    saveManifest(dir, manifest);
    const result = run(['--root', dir, '--allow-placeholders'], dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /RUBRIC_FIELD_COUNT/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('boilerplate rubric text is rejected', () => {
  const dir = fixture();
  try {
    const manifest = loadManifest(dir);
    manifest.chapters['02'].exercises[0].hints = [
      '本文の中核概念を小さな関数または小さな実験へ分解する。',
      '最初に正常系を通し、その後に境界値と失敗系を追加する。',
      '模範解答を見る前に、観察した差分を言語化する。',
    ];
    saveManifest(dir, manifest);
    const result = run(['--root', dir, '--allow-placeholders'], dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /RUBRIC_ITEM_BOILERPLATE/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('verification without an executable command is rejected', () => {
  const dir = fixture();
  try {
    const manifest = loadManifest(dir);
    manifest.chapters['02'].exercises[0].verification = [
      '動いたかどうかを目視で確認する手順を書く',
      '結果が正しそうかを判断する手順を書く',
    ];
    saveManifest(dir, manifest);
    const result = run(['--root', dir, '--allow-placeholders'], dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /VERIFICATION_COMMAND_MISSING/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a production warning is required', () => {
  const dir = fixture();
  try {
    const manifest = loadManifest(dir);
    manifest.chapters['02'].exercises[0].warnings = [];
    saveManifest(dir, manifest);
    const result = run(['--root', dir, '--allow-placeholders'], dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /RUBRIC_FIELD_COUNT/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the estimate breakdown is required', () => {
  const dir = fixture();
  try {
    const manifest = loadManifest(dir);
    delete manifest.chapters['02'].exercises[0].estimateBasis;
    saveManifest(dir, manifest);
    const result = run(['--root', dir, '--allow-placeholders'], dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /ESTIMATE_BASIS_MISSING/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('difficulty must match the star count in the title', () => {
  const dir = fixture();
  try {
    const manifest = loadManifest(dir);
    manifest.chapters['02'].exercises[0].difficulty = 3;
    saveManifest(dir, manifest);
    const result = run(['--root', dir, '--allow-placeholders'], dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /DIFFICULTY_STAR_MISMATCH/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('an off-grid estimate is rejected', () => {
  const dir = fixture();
  try {
    const manifest = loadManifest(dir);
    manifest.chapters['02'].exercises[0].minutes = 7;
    saveManifest(dir, manifest);
    const result = run(['--root', dir, '--allow-placeholders'], dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /MINUTES_INVALID/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a starter without its paired solution is rejected', () => {
  const dir = fixture();
  try {
    const manifest = loadManifest(dir);
    const exercise = manifest.chapters['02'].exercises[0];
    exercise.solution = ['code/ch02/raw-http-server.solution.ts'];
    saveManifest(dir, manifest);
    const result = run(['--root', dir, '--allow-placeholders'], dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /STARTER_SOLUTION_UNPAIRED/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a manuscript exercise card removal is detected', () => {
  const dir = fixture();
  try {
    const file = join(dir, '02-part1-foundations.md');
    const text = readFileSync(file, 'utf8');
    writeFileSync(file, text.replace(/^<!-- handbook:exercise:start \{"id":"2\.1"\} -->\n[\s\S]*?^<!-- handbook:exercise:end -->\n/m, ''));
    const result = run(['--root', dir, '--allow-placeholders'], dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /CARD_MISSING/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('an exercise title drift between manuscript and manifest is rejected', () => {
  const dir = fixture();
  try {
    const manifest = loadManifest(dir);
    manifest.chapters['02'].exercises[0].title = '課題2.1: 別のタイトル (★★)';
    saveManifest(dir, manifest);
    const result = run(['--root', dir, '--allow-placeholders'], dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /TITLE_MISMATCH/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('an outdated schema version is rejected', () => {
  const dir = fixture();
  try {
    const manifest = loadManifest(dir);
    manifest.schemaVersion = 1;
    saveManifest(dir, manifest);
    const result = run(['--root', dir, '--allow-placeholders'], dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /SCHEMA_VERSION/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
