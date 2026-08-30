#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootArg = process.argv.indexOf('--root');
const root = path.resolve(rootArg >= 0 ? process.argv[rootArg + 1] : process.cwd());
const check = process.argv.includes('--check');
const manifestFile = 'config/chapter-guides.json';
const bodyFiles = [
  '02-part1-foundations.md',
  '03-part2-frontend.md',
  '04-part3-backend.md',
  '05-part4-data.md',
  '06-part5-infrastructure.md',
  '07-part6-quality.md',
  '08-part7-practice.md',
];
const blockPattern = /<!-- handbook:chapter-guide:start \{"chapter":\d+\} -->[\s\S]*?<!-- handbook:chapter-guide:end -->\n*/g;

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const write = (file, text) => fs.writeFileSync(path.join(root, file), text);
const normalize = (text) => text.replace(/\s+/g, ' ').trim();
const manifest = JSON.parse(read(manifestFile));
const requiredFields = manifest.requiredFields ?? [];
const chaptersManifest = manifest.chapters ?? {};
const chapterMap = new Map();
const sectionMap = new Map();

for (const file of bodyFiles) {
  const clean = read(file).replace(blockPattern, '');
  let currentChapter = null;
  for (const line of clean.split('\n')) {
    const chapterMatch = line.match(/^## 第(\d+)章\s+(.+?)\s*$/);
    if (chapterMatch) {
      const number = Number(chapterMatch[1]);
      currentChapter = number;
      chapterMap.set(number, { number, title: normalize(chapterMatch[2]), file });
      continue;
    }
    const sectionMatch = line.match(/^#{3,6}\s+(\d+\.\d+(?:\.\d+)?)\s+(.+?)\s*$/);
    if (sectionMatch) {
      sectionMap.set(sectionMatch[1], {
        id: sectionMatch[1],
        title: normalize(sectionMatch[2]),
        file,
        chapter: currentChapter,
      });
    }
  }
}

if (chapterMap.size !== 30) {
  throw new Error(`本文の章数が30ではありません: ${chapterMap.size}`);
}
if (Object.keys(chaptersManifest).length !== 30) {
  throw new Error(`章ガイド定義の章数が30ではありません: ${Object.keys(chaptersManifest).length}`);
}

function validateStringList(value, label, chapter) {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error(`第${chapter}章 ${label} は空でない文字列配列である必要があります`);
  }
}

for (let chapter = 1; chapter <= 30; chapter += 1) {
  const body = chapterMap.get(chapter);
  const entry = chaptersManifest[String(chapter)];
  if (!entry) throw new Error(`第${chapter}章の章ガイド定義がありません`);
  if (normalize(entry.title) !== body.title) {
    throw new Error(`第${chapter}章タイトル不一致: 本文「${body.title}」/ manifest「${entry.title}」`);
  }
  for (const field of requiredFields) {
    if (!(field in entry)) throw new Error(`第${chapter}章に必須項目 ${field} がありません`);
  }
  if (typeof entry.problem !== 'string' || !entry.problem.trim()) throw new Error(`第${chapter}章 problem が空です`);
  validateStringList(entry.objectives, 'objectives', chapter);
  if (!Array.isArray(entry.prerequisites) || entry.prerequisites.length === 0) throw new Error(`第${chapter}章 prerequisites が空です`);
  for (const prerequisite of entry.prerequisites) {
    if (typeof prerequisite === 'string') {
      if (!prerequisite.trim()) throw new Error(`第${chapter}章 prerequisites に空文字があります`);
    } else if (prerequisite && typeof prerequisite === 'object') {
      if (!prerequisite.section || !prerequisite.text) throw new Error(`第${chapter}章 prerequisites のオブジェクト形式が不正です`);
      if (!sectionMap.has(prerequisite.section)) throw new Error(`第${chapter}章 prerequisite節 ${prerequisite.section} が本文にありません`);
    } else {
      throw new Error(`第${chapter}章 prerequisites の形式が不正です`);
    }
  }
  for (const field of ['coreSections', 'minimalSections', 'exerciseSections']) {
    validateStringList(entry[field], field, chapter);
    for (const id of entry[field]) {
      if (!sectionMap.has(id)) throw new Error(`第${chapter}章 ${field} の節 ${id} が本文にありません`);
    }
  }
  for (const field of ['productionGaps', 'failureModes', 'diagnostics', 'decisions', 'evaluation', 'sources']) {
    validateStringList(entry[field], field, chapter);
  }
}

// KEN-61: 章ガイドの到達目標・中核概念・前提知識が、標準通読ルート (必修節のみ) の
// 範囲外の節を指していることが13章で報告された。節リンクへ学習レベルを添えて、
// 「必修だけを読んだ時点でどこまで到達しているか」を読者が自分で判定できるようにする。
const learningLevels = JSON.parse(read('config/learning-levels.json'));
const levelLabels = Object.fromEntries(
  Object.entries(learningLevels.levels ?? {}).map(([key, value]) => [key, value.label]),
);

export function levelSuffix(id) {
  const level = learningLevels.sections?.[id]?.level;
  if (!level || level === 'required') return '';
  const label = levelLabels[level] ?? level;
  return ` (${label})`;
}

function sectionLink(id, currentFile) {
  const target = sectionMap.get(id);
  const href = target.file === currentFile
    ? `#section-${id.replaceAll('.', '-')}`
    : `${target.file}#section-${id.replaceAll('.', '-')}`;
  return `[${id} ${target.title}](${href})${levelSuffix(id)}`;
}

function renderList(items, currentFile) {
  return items.map((item) => {
    if (typeof item === 'string') return `> - ${item}`;
    return `> - ${sectionLink(item.section, currentFile)} ― ${item.text}`;
  }).join('\n');
}

function renderSectionLinks(ids, currentFile) {
  return ids.map((id) => sectionLink(id, currentFile)).join('、');
}

function renderGuide(chapter, entry, currentFile) {
  return [
    `<!-- handbook:chapter-guide:start {"chapter":${chapter}} -->`,
    '> **この章の学習ガイド**',
    '>',
    '> **解決する実務上の問題**  ',
    `> ${entry.problem}`,
    '>',
    '> **到達目標**',
    renderList(entry.objectives, currentFile),
    '>',
    '> 到達目標は章全体に対するものである。標準通読ルートは必修節だけを読むため、下の「中核概念」に'
      + ' (実務選択) (発展) (展望) と付いた節がある章では、その節を読むまで到達目標の一部が埋まらない。'
      + '必修節を読み終えた時点で説明できない項目があれば、まず付記のある節へ進む。',
    '>',
    '> **前提知識**',
    renderList(entry.prerequisites, currentFile),
    '>',
    '> **中核概念**  ',
    `> ${renderSectionLinks(entry.coreSections, currentFile)}`,
    '>',
    '> **最小実装**  ',
    `> ${renderSectionLinks(entry.minimalSections, currentFile)}`,
    '>',
    '> **本番実装との差分**',
    renderList(entry.productionGaps, currentFile),
    '>',
    '> **典型的な失敗**',
    renderList(entry.failureModes, currentFile),
    '>',
    '> **診断・デバッグ方法**',
    renderList(entry.diagnostics, currentFile),
    '>',
    '> **意思決定チェックリスト**',
    renderList(entry.decisions, currentFile),
    '>',
    '> **演習と評価基準**  ',
    `> 対象: ${renderSectionLinks(entry.exerciseSections, currentFile)}`,
    renderList(entry.evaluation, currentFile),
    '>',
    '> **一次資料・発展資料**',
    renderList(entry.sources, currentFile),
    '<!-- handbook:chapter-guide:end -->',
  ].join('\n');
}

const generated = new Map();
for (const file of bodyFiles) {
  let output = read(file).replace(blockPattern, '');
  const chaptersInFile = [...chapterMap.values()].filter((entry) => entry.file === file).sort((a, b) => b.number - a.number);
  for (const chapter of chaptersInFile) {
    const anchor = `<a id="section-${chapter.number}-1"></a>`;
    const occurrences = output.split(anchor).length - 1;
    if (occurrences !== 1) throw new Error(`${file}: ${anchor} が1件ではありません: ${occurrences}`);
    const guide = renderGuide(chapter.number, chaptersManifest[String(chapter.number)], file);
    output = output.replace(anchor, `${guide}\n\n${anchor}`);
  }
  generated.set(file, output);
}

function generateTemplateDocument() {
  const lines = [
    '# 章共通教材テンプレート',
    '',
    '<!-- handbook:generated; do not edit -->',
    `基準日: ${manifest.updated}`,
    '',
    'このファイルと本文中の「この章の学習ガイド」は `config/chapter-guides.json` から生成されます。章本文を形式的な定型節で分断せず、既存の節を11の教材要素へ対応付ける方式です。',
    '',
    '## 11の教材要素',
    '',
    '1. **解決する実務上の問題**: その章を学ぶ理由を、現場の症状や判断へ接続する。',
    '2. **到達目標**: 読了後に説明・実装・判断できることを示す。',
    '3. **前提知識**: 途中参加する読者が先に確認すべき節を示す。',
    '4. **中核概念**: 章の理解に不可欠な既存節を示す。',
    '5. **最小実装**: 原理を観察するための既存実装・課題を示す。',
    '6. **本番実装との差分**: 教育用の省略、危険な単純化、運用上の追加要件を明記する。',
    '7. **典型的な失敗**: 読者が陥りやすい誤解と設計事故を示す。',
    '8. **診断・デバッグ方法**: 症状から原因へ進む観測方法を示す。',
    '9. **意思決定チェックリスト**: 技術や方式を選ぶ前に確認する問いを示す。',
    '10. **演習と評価基準**: 既存演習への導線と自己評価可能な結果を示す。',
    '11. **一次資料・発展資料**: 仕様、RFC、公式文書、代表的文献を示す。',
    '',
    '## 適用方針',
    '',
    '- 各章の導入文の後、最初の番号付き節の直前に1つの学習ガイドを置きます。',
    '- 中核概念や最小実装は既存節へリンクし、同じ説明を別の定型節として複製しません。',
    '- 教育用自作実装では、本番利用できない理由または省略した保証を必ず示します。',
    '- 章単独で読む場合は「前提知識」のリンクだけを先に確認できます。',
    '- 演習詳細（目的、前提、所要時間、完成条件、期待出力、観察項目、テスト方法、段階的ヒント、本番利用時の警告）は各課題の演習カードで示します。',
    '',
    '## 編集・検証',
    '',
    '```bash',
    'npm run apply:chapter-guides',
    'npm run apply:chapter-guides:check',
    'npm run test:chapter-guides',
    '```',
    '',
    '章の追加・改名・節移動時は `config/chapter-guides.json` を更新し、生成コマンドを実行します。`--check` は本文の生成ブロックとマニフェストに差分がある場合、非ゼロ終了します。',
    '',
    '## 適用状況',
    '',
    `- 対象章: ${chapterMap.size}/30`,
    `- マニフェスト定義: ${Object.keys(chaptersManifest).length}/30`,
    `- 参照可能な番号付き節: ${sectionMap.size}`, 
    '',
  ];
  return lines.join('\n');
}

generated.set('CHAPTER_TEMPLATE.md', generateTemplateDocument());
let changed = false;
for (const [file, content] of generated) {
  const absolute = path.join(root, file);
  const current = fs.existsSync(absolute) ? read(file) : '';
  if (current !== content) {
    changed = true;
    if (!check) write(file, content);
  }
}

if (check && changed) {
  console.error('Chapter guides are out of date. Run: npm run apply:chapter-guides');
  process.exit(1);
}

console.log(check
  ? `Chapter guides are current for ${chapterMap.size} chapters.`
  : `Applied chapter guides to ${chapterMap.size} chapters.`);
