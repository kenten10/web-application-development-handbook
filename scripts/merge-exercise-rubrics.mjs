#!/usr/bin/env node
// KEN-48: 執筆した演習ルーブリック (前提・完成条件・期待出力・観察項目・テスト方法・
// 段階的ヒント・本番利用時の警告・推定時間の内訳) を config/exercises.json へ一括適用します。
//
//   node scripts/merge-exercise-rubrics.mjs rubrics-part1.json rubrics-part2.json ...
//
// 入力JSONは { "<演習ID>": { prerequisites: [...], completion: [...], ... } } 形式です。
// マニフェストの章別演習に存在しないIDは、本文から章・タイトル・目的を取り出して
// observationExercises (コード成果物を持たない観察課題) として登録します。
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootArg = process.argv.indexOf('--root');
const root = path.resolve(rootArg >= 0 ? process.argv[rootArg + 1] : path.resolve(import.meta.dirname, '..'));
const inputs = process.argv.slice(2).filter((value) => value.endsWith('.json'));
if (inputs.length === 0) {
  console.error('使い方: node scripts/merge-exercise-rubrics.mjs <rubric.json> [...]');
  process.exit(1);
}

const bodyFiles = [
  '02-part1-foundations.md',
  '03-part2-frontend.md',
  '04-part3-backend.md',
  '05-part4-data.md',
  '06-part5-infrastructure.md',
  '07-part6-quality.md',
  '08-part7-practice.md',
];
const rubricFields = ['prerequisites', 'completion', 'expected', 'observations', 'verification', 'hints', 'warnings', 'estimateBasis'];
const exerciseOrder = [
  'id', 'title', 'purpose', 'minutes', 'difficulty', 'services',
  ...rubricFields, 'source', 'starter', 'solution', 'references',
];
const observationOrder = [
  'id', 'chapter', 'title', 'purpose', 'minutes', 'difficulty', 'services',
  ...rubricFields, 'source',
];

const stripInline = (value) => value.replace(/\*\*/g, '').replace(/`/g, '').replace(/\s+/g, ' ').trim();

// コード成果物を持たない観察課題の必要サービス。本文の手順に対応する。
const observationServices = {
  '1.1': ['Chrome'],
  '1.2': ['なし'],
  '1.3': ['Chrome'],
  '9.1': ['localhost', 'Chrome'],
};

/** 本文から課題見出し・目的行を収集する。 */
function scanBody() {
  const found = new Map();
  for (const file of bodyFiles) {
    const lines = fs.readFileSync(path.join(root, file), 'utf8').split('\n');
    let chapter = null;
    for (let i = 0; i < lines.length; i += 1) {
      const chapterMatch = lines[i].match(/^##\s+第(\d+)章\s/);
      if (chapterMatch) chapter = Number(chapterMatch[1]);
      const heading = lines[i].match(/^#### (課題([0-9]+\.[0-9]+)[:：].*?)\s*$/);
      if (!heading) continue;
      let cursor = i + 1;
      while (cursor < lines.length && lines[cursor].trim() === '') cursor += 1;
      const purposeLine = lines[cursor] ?? '';
      const purpose = /^\*\*目的\*\*[:：]/.test(purposeLine)
        ? stripInline(purposeLine.replace(/^\*\*目的\*\*[:：]\s*/, ''))
        : null;
      found.set(heading[2], { id: heading[2], title: heading[1].trim(), purpose, chapter, source: file });
    }
  }
  return found;
}

function orderKeys(object, order) {
  const result = {};
  for (const key of order) if (key in object) result[key] = object[key];
  for (const key of Object.keys(object)) if (!(key in result)) result[key] = object[key];
  return result;
}

const rubrics = new Map();
for (const input of inputs) {
  const parsed = JSON.parse(fs.readFileSync(path.resolve(input), 'utf8'));
  for (const [id, value] of Object.entries(parsed)) {
    if (rubrics.has(id)) throw new Error(`ルーブリックが重複しています: ${id}`);
    rubrics.set(id, value);
  }
}

const manifestPath = path.join(root, 'config/exercises.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const body = scanBody();
const applied = [];
const adjusted = [];
const missing = [];

manifest.schemaVersion = 2;
manifest.conventions = {
  ...manifest.conventions,
  rubric: 'every exercise carries prerequisites, completion, expected, observations, verification, 3-step hints, warnings, and estimateBasis',
  card: 'body text renders one handbook:exercise card per 課題 heading via scripts/apply-exercise-rubrics.mjs',
};

for (const info of Object.values(manifest.chapters)) {
  info.exercises = info.exercises.map((exercise) => {
    const rubric = rubrics.get(exercise.id);
    if (!rubric) { missing.push(exercise.id); return exercise; }
    const merged = { ...exercise };
    for (const field of rubricFields) {
      if (rubric[field] === undefined) throw new Error(`${exercise.id}: ${field} がありません。`);
      merged[field] = rubric[field];
    }
    for (const field of ['minutes', 'difficulty']) {
      if (rubric[field] !== undefined && rubric[field] !== merged[field]) {
        adjusted.push(`${exercise.id} ${field}: ${merged[field]} -> ${rubric[field]}`);
        merged[field] = rubric[field];
      }
    }
    applied.push(exercise.id);
    return orderKeys(merged, exerciseOrder);
  });
}

const chapterIds = new Set(Object.values(manifest.chapters).flatMap((info) => info.exercises.map((exercise) => exercise.id)));
const observation = [];
for (const [id, rubric] of rubrics) {
  if (chapterIds.has(id)) continue;
  const heading = body.get(id);
  if (!heading) throw new Error(`本文に課題${id} の見出しがありません。`);
  if (!heading.purpose) throw new Error(`本文の課題${id} に「**目的**:」行がありません。`);
  const stars = (heading.title.match(/★/g) ?? []).length;
  observation.push(orderKeys({
    id,
    chapter: heading.chapter,
    title: heading.title,
    purpose: heading.purpose,
    minutes: rubric.minutes,
    difficulty: rubric.difficulty ?? stars,
    services: rubric.services ?? observationServices[id] ?? ['なし'],
    ...Object.fromEntries(rubricFields.map((field) => [field, rubric[field]])),
    source: heading.source,
  }, observationOrder));
  applied.push(id);
}
observation.sort((a, b) => Number(a.id.split('.')[0]) - Number(b.id.split('.')[0]) || Number(a.id.split('.')[1]) - Number(b.id.split('.')[1]));
manifest.observationExercises = observation;

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

// 検証台帳 (KEN-56) 側の推定時間・難易度・タイトルを演習正本へ追従させる。
const planPath = path.join(root, 'config/clean-environment-plan.json');
if (fs.existsSync(planPath)) {
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  const byId = new Map(Object.values(manifest.chapters).flatMap((info) => info.exercises.map((exercise) => [exercise.id, exercise])));
  let synced = 0;
  for (const entry of plan.exercises) {
    const exercise = byId.get(entry.id);
    if (!exercise) continue;
    if (entry.minutes !== exercise.minutes || entry.difficulty !== exercise.difficulty || entry.title !== exercise.title) {
      entry.minutes = exercise.minutes;
      entry.difficulty = exercise.difficulty;
      entry.title = exercise.title;
      synced += 1;
    }
  }
  if (synced) fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);
  console.log(`Clean environment plan synced: ${synced} entry(ies)`);
}

console.log(`Applied rubrics: ${applied.length}`);
console.log(`Observation exercises: ${observation.length}`);
if (adjusted.length) console.log(`Adjusted estimates:\n- ${adjusted.join('\n- ')}`);
if (missing.length) {
  console.error(`ERROR: ルーブリック未提供の演習があります: ${missing.join(', ')}`);
  process.exit(1);
}
