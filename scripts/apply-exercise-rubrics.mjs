#!/usr/bin/env node
// 章末演習の「演習カード」を config/exercises.json から本文へ適用します (KEN-48)。
// 各 `#### 課題X.Y:` 見出し直下の `**目的**:` 行の次へ、生成ブロックを1つ挿入します。
// --check は本文とマニフェストに差分がある場合に非ゼロ終了します。
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootArg = process.argv.indexOf('--root');
const root = path.resolve(rootArg >= 0 ? process.argv[rootArg + 1] : path.resolve(import.meta.dirname, '..'));
const check = process.argv.includes('--check');

export const bodyFiles = [
  '02-part1-foundations.md',
  '03-part2-frontend.md',
  '04-part3-backend.md',
  '05-part4-data.md',
  '06-part5-infrastructure.md',
  '07-part6-quality.md',
  '08-part7-practice.md',
];

export const blockPattern = /^<!-- handbook:exercise:start \{"id":"[0-9]+\.[0-9]+"\} -->\n[\s\S]*?^<!-- handbook:exercise:end -->\n?/gm;

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const write = (file, text) => fs.writeFileSync(path.join(root, file), text);

/** マニフェストの全演習 (章別 + 観察課題) を id で引ける Map にする。 */
export function indexExercises(manifest) {
  const index = new Map();
  for (const [chapter, info] of Object.entries(manifest.chapters ?? {})) {
    for (const exercise of info.exercises ?? []) {
      index.set(exercise.id, { ...exercise, chapter: Number(chapter), kind: 'code' });
    }
  }
  for (const exercise of manifest.observationExercises ?? []) {
    index.set(exercise.id, { ...exercise, chapter: Number(exercise.chapter), kind: 'observation' });
  }
  return index;
}

const quote = (line) => (line === '' ? '>' : `> ${line}`);

export function renderCard(exercise) {
  const stars = '★'.repeat(exercise.difficulty);
  const services = (exercise.services ?? []).join('、') || 'なし';
  const lines = [
    `**演習カード 課題${exercise.id}** ― 難易度 ${stars} ／ 推定時間 ${exercise.minutes}分 ／ 必要サービス: ${services}`,
    '',
    '**前提**',
    '',
    ...exercise.prerequisites.map((item) => `- ${item}`),
    '',
    '**完成条件 (自己採点用チェックリスト)**',
    '',
    ...exercise.completion.map((item) => `- [ ] ${item}`),
    '',
    '**期待出力**',
    '',
    ...exercise.expected.map((item) => `- ${item}`),
    '',
    '**観察項目**',
    '',
    ...exercise.observations.map((item) => `- ${item}`),
    '',
    '**テスト方法 (自己採点手順)**',
    '',
    ...exercise.verification.map((item, i) => `${i + 1}. ${item}`),
    '',
    '**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)',
    '',
    `1. **方針**: ${exercise.hints[0]}`,
    `2. **構造**: ${exercise.hints[1]}`,
    `3. **実装の要点**: ${exercise.hints[2]}`,
    '',
    '**本番利用時の警告**',
    '',
    ...exercise.warnings.map((item) => `- ${item}`),
    '',
    '**導線**',
    '',
    ...renderPath(exercise),
    '',
    `**推定時間の内訳**: ${exercise.estimateBasis}`,
  ];
  return [
    `<!-- handbook:exercise:start {"id":"${exercise.id}"} -->`,
    ...lines.map(quote),
    '<!-- handbook:exercise:end -->',
  ];
}

function renderPath(exercise) {
  if (exercise.kind === 'observation') {
    return ['- コード成果物はない。観察結果と判断根拠を自分の記録へ残し、完成条件で照合する。'];
  }
  const starter = exercise.starter.map((value) => `\`${value}\``).join('、');
  const solution = exercise.solution.map((value) => `\`${value}\``).join('、');
  return [`- 開始地点: ${starter}`, `- 模範解答: ${solution}`];
}

export function applyToText(text, exercises, file) {
  const cleaned = text.replace(blockPattern, '');
  const lines = cleaned.split('\n');
  const output = [];
  const applied = [];
  const problems = [];
  for (let i = 0; i < lines.length; i += 1) {
    output.push(lines[i]);
    const heading = lines[i].match(/^#### 課題([0-9]+\.[0-9]+)[:：]/);
    if (!heading) continue;
    const id = heading[1];
    const exercise = exercises.get(id);
    if (!exercise) {
      problems.push(`${file}: 課題${id} がマニフェストにありません。`);
      continue;
    }
    let cursor = i + 1;
    while (cursor < lines.length && lines[cursor].trim() === '') {
      output.push(lines[cursor]);
      cursor += 1;
    }
    if (cursor >= lines.length || !/^\*\*目的\*\*[:：]/.test(lines[cursor])) {
      problems.push(`${file}: 課題${id} の見出し直後に「**目的**:」行がありません。`);
      i = cursor - 1;
      continue;
    }
    output.push(lines[cursor]);
    output.push('');
    output.push(...renderCard(exercise));
    output.push('');
    applied.push(id);
    let next = cursor + 1;
    while (next < lines.length && lines[next].trim() === '') next += 1;
    i = next - 1;
  }
  return { text: output.join('\n'), applied, problems };
}

const manifest = JSON.parse(read('config/exercises.json'));
const exercises = indexExercises(manifest);
const outputs = new Map();
const applied = [];
const problems = [];
for (const file of bodyFiles) {
  const result = applyToText(read(file), exercises, file);
  outputs.set(file, result.text);
  applied.push(...result.applied);
  problems.push(...result.problems);
}

for (const id of exercises.keys()) {
  const count = applied.filter((value) => value === id).length;
  if (count !== 1) problems.push(`課題${id} の演習カードが本文で1件ではありません: ${count}`);
}

if (problems.length) {
  for (const problem of problems) console.error(`ERROR: ${problem}`);
  process.exit(1);
}

const changed = [];
for (const [file, content] of outputs) {
  if (read(file) !== content) {
    changed.push(file);
    if (!check) write(file, content);
  }
}

if (check && changed.length) {
  console.error(`Exercise cards are out of date: ${changed.join(', ')}`);
  console.error('Run: pnpm run apply:exercise-rubrics');
  process.exit(1);
}

console.log(`Exercise cards ${check ? 'check' : 'application'} passed: ${applied.length} card(s) in ${bodyFiles.length} file(s)`);
