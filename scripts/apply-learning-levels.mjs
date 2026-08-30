#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootArg = process.argv.indexOf('--root');
const root = path.resolve(rootArg >= 0 ? process.argv[rootArg + 1] : process.cwd());
const check = process.argv.includes('--check');
const manifestPath = 'config/learning-levels.json';
const bodyFiles = [
  '02-part1-foundations.md',
  '03-part2-frontend.md',
  '04-part3-backend.md',
  '05-part4-data.md',
  '06-part5-infrastructure.md',
  '07-part6-quality.md',
  '08-part7-practice.md',
];

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const write = (file, text) => fs.writeFileSync(path.join(root, file), text);
const normalize = (text) => text.replace(/\s+/g, ' ').trim();
const manifest = JSON.parse(read(manifestPath));
const sections = manifest.sections;
const seen = new Set();
const generated = new Map();

for (const file of bodyFiles) {
  const input = read(file).split('\n');
  const clean = input.filter((line) => !/^<!-- handbook:learning /.test(line));
  const output = [];
  let inFence = false;

  for (const line of clean) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      output.push(line);
      continue;
    }

    output.push(line);
    if (inFence) continue;

    const match = line.match(/^#{3,6}\s+(\d+\.\d+(?:\.\d+)?)\s+(.+?)\s*$/);
    if (!match) continue;

    const id = match[1];
    const title = normalize(match[2]);
    const entry = sections[id];
    if (!entry) throw new Error(`${file}: 分類マニフェストに節 ${id} がありません`);
    if (normalize(entry.title) !== title) {
      throw new Error(`${file}: 節 ${id} のタイトルが不一致です。本文「${title}」/ manifest「${entry.title}」`);
    }
    if (!manifest.levels[entry.level]) throw new Error(`節 ${id}: 未知の学習レベル ${entry.level}`);
    if (!Number.isInteger(entry.minutes) || entry.minutes <= 0) throw new Error(`節 ${id}: minutes が正の整数ではありません`);

    seen.add(id);
    output.push(`<!-- handbook:learning ${JSON.stringify({ level: entry.level, minutes: entry.minutes })} -->`);
  }

  generated.set(file, output.join('\n'));
}

const missing = Object.keys(sections).filter((id) => !seen.has(id));
if (missing.length) throw new Error(`本文に存在しない分類エントリがあります: ${missing.join(', ')}`);

function formatMinutes(minutes) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}分`;
  if (!rest) return `${hours}時間`;
  return `${hours}時間${rest}分`;
}

function generateGuide() {
  const counts = Object.fromEntries(Object.keys(manifest.levels).map((key) => [key, 0]));
  const totals = Object.fromEntries(Object.keys(manifest.levels).map((key) => [key, 0]));
  const chapterStats = new Map();

  for (const [id, entry] of Object.entries(sections)) {
    counts[entry.level] += 1;
    totals[entry.level] += entry.minutes;
    const chapter = Number(id.split('.')[0]);
    const stats = chapterStats.get(chapter) ?? { required: 0, practical: 0, advanced: 0, outlook: 0, all: 0 };
    stats[entry.level] += entry.minutes;
    stats.all += entry.minutes;
    chapterStats.set(chapter, stats);
  }

  const requiredTotal = totals.required;
  const allTotal = Object.values(totals).reduce((sum, value) => sum + value, 0);
  const lines = [
    '# 学習レベルと推定時間',
    '',
    '<!-- handbook:generated; do not edit -->',
    `基準日: ${manifest.updated}`,
    '',
    'このファイルは `config/learning-levels.json` から生成されます。分類や時間を変更した場合は `npm run apply:learning-levels` を実行してください。',
    '',
    '## 4つの学習レベル',
    '',
  ];

  for (const [key, definition] of Object.entries(manifest.levels)) {
    lines.push(`- **${definition.label}**: ${definition.description}（${counts[key]}節、${formatMinutes(totals[key])}）`);
  }

  lines.push(
    '',
    '## 初回通読の目安',
    '',
    `初回は **必修** のみを読み、必要に応じて実務選択へ進みます。必修は ${counts.required}節、推定 ${formatMinutes(requiredTotal)} です。`,
    '',
    `全分類を読み、すべての演習を実施する場合の推定は ${formatMinutes(allTotal)} です。これは計画値であり、既知技術、演習の実装速度、環境構築によって大きく変わります。`,
    '',
    '### 時間見積もりの前提',
    '',
    '- 技術文書を読みながら、短いコード例を追跡する時間を含みます。',
    '- 実装課題は難易度表示と課題数から見積もっています。デバッグや発展改造は含みません。',
    '- 外部サービスの契約、クラウド待ち時間、レビュー時間は含みません。',
    '',
    '## 章別の推定時間',
    '',
    '| 章 | 必修 | 実務選択 | 発展 | 展望 | 全体 |',
    '|---:|---:|---:|---:|---:|---:|',
  );

  for (let chapter = 1; chapter <= 30; chapter += 1) {
    const stats = chapterStats.get(chapter) ?? { required: 0, practical: 0, advanced: 0, outlook: 0, all: 0 };
    lines.push(`| 第${chapter}章 | ${formatMinutes(stats.required)} | ${formatMinutes(stats.practical)} | ${formatMinutes(stats.advanced)} | ${formatMinutes(stats.outlook)} | ${formatMinutes(stats.all)} |`);
  }

  lines.push(
    '',
    '## 編集ルール',
    '',
    '1. 節の追加・改名時は `config/learning-levels.json` を更新します。',
    '2. `npm run apply:learning-levels` で本文メタデータと本ファイルを再生成します。',
    '3. `npm run apply:learning-levels:check` は差分があれば失敗します。',
    '4. 「展望」は採用推奨を意味しません。基準日、仕様成熟度、代替案を本文で確認します。',
    '',
  );
  return lines.join('\n');
}

generated.set('LEARNING_LEVELS.md', generateGuide());
let changed = false;
for (const [file, content] of generated) {
  const current = fs.existsSync(path.join(root, file)) ? read(file) : '';
  if (current !== content) {
    changed = true;
    if (!check) write(file, content);
  }
}

if (check && changed) {
  console.error('Learning metadata is out of date. Run: npm run apply:learning-levels');
  process.exit(1);
}

console.log(check
  ? `Learning metadata is current for ${seen.size} numbered sections.`
  : `Applied learning metadata to ${seen.size} numbered sections.`);
