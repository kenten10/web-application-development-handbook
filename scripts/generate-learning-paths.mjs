#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootArg = process.argv.indexOf('--root');
const root = path.resolve(rootArg >= 0 ? process.argv[rootArg + 1] : process.cwd());
const check = process.argv.includes('--check');
const bodyFiles = [
  '02-part1-foundations.md','03-part2-frontend.md','04-part3-backend.md',
  '05-part4-data.md','06-part5-infrastructure.md','07-part6-quality.md','08-part7-practice.md',
];

const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const learning = readJson('config/learning-levels.json');
const paths = readJson('config/learning-paths.json');
const outputFile = path.join(root, 'LEARNING_PATHS.md');

const formatMinutes = minutes => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}分`;
  if (!rest) return `${hours}時間`;
  return `${hours}時間${rest}分`;
};
const compareIds = (a, b) => {
  const aa = a.split('.').map(Number);
  const bb = b.split('.').map(Number);
  const length = Math.max(aa.length, bb.length);
  for (let i = 0; i < length; i++) {
    const diff = (aa[i] ?? -1) - (bb[i] ?? -1);
    if (diff) return diff;
  }
  return 0;
};
const anchorFor = id => `section-${id.replaceAll('.', '-')}`;

function scanBodySections() {
  const sections = new Map();
  for (const file of bodyFiles) {
    const lines = fs.readFileSync(path.join(root, file), 'utf8').split('\n');
    let inFence = false;
    for (const line of lines) {
      if (/^```/.test(line.trim())) { inFence = !inFence; continue; }
      if (inFence) continue;
      const match = line.match(/^#{3,4}\s+(\d+\.\d+(?:\.\d+)*)\s+(.+)$/);
      if (!match) continue;
      sections.set(match[1], { id: match[1], title: match[2].trim(), file });
    }
  }
  return sections;
}

const bodySections = scanBodySections();
const allIds = Object.keys(learning.sections).sort(compareIds);

function validateBaseData() {
  if (!Array.isArray(paths.routes) || paths.routes.length === 0) throw new Error('No learning routes defined');
  const routeIds = new Set();
  for (const route of paths.routes) {
    if (!/^[a-z0-9-]+$/.test(route.id)) throw new Error(`Invalid route id: ${route.id}`);
    if (routeIds.has(route.id)) throw new Error(`Duplicate route id: ${route.id}`);
    routeIds.add(route.id);
    if (!route.label || !route.audience || !route.goal || !route.entry) throw new Error(`Route ${route.id} is missing required text`);
    if (!Array.isArray(route.stages) || route.stages.length === 0) throw new Error(`Route ${route.id} has no stages`);
  }
  for (const id of allIds) {
    const body = bodySections.get(id);
    if (!body) throw new Error(`Learning section ${id} is missing from body`);
    if (body.title !== learning.sections[id].title) throw new Error(`Title mismatch for ${id}: ${body.title} != ${learning.sections[id].title}`);
  }
}

function expandSelector(selector) {
  const ids = [];
  if (selector.chapters || selector.levels) {
    if (!Array.isArray(selector.chapters) || !Array.isArray(selector.levels)) {
      throw new Error('A chapter selector requires chapters and levels arrays');
    }
    for (const chapter of selector.chapters) {
      const prefix = `${chapter}.`;
      for (const id of allIds) {
        if (!id.startsWith(prefix)) continue;
        if (selector.levels.includes(learning.sections[id].level)) ids.push(id);
      }
    }
  }
  if (selector.sections) {
    if (!Array.isArray(selector.sections)) throw new Error('sections must be an array');
    ids.push(...selector.sections);
  }
  if (!selector.chapters && !selector.sections) throw new Error('Empty selector');
  return ids;
}

function compileRoute(route) {
  const seen = new Set();
  const stages = route.stages.map((stage, index) => {
    if (!stage.label || !stage.purpose || !Array.isArray(stage.selectors) || stage.selectors.length === 0) {
      throw new Error(`Route ${route.id} stage ${index + 1} is incomplete`);
    }
    const ids = stage.selectors.flatMap(expandSelector);
    if (ids.length === 0) throw new Error(`Route ${route.id} stage ${stage.label} is empty`);
    for (const id of ids) {
      if (!learning.sections[id]) throw new Error(`Route ${route.id} references unknown section ${id}`);
      if (seen.has(id)) throw new Error(`Route ${route.id} contains duplicate section ${id}`);
      seen.add(id);
    }
    const minutes = ids.reduce((sum, id) => sum + learning.sections[id].minutes, 0);
    return { ...stage, ids, minutes };
  });
  for (const id of route.entryChecks ?? []) {
    if (!learning.sections[id]) throw new Error(`Route ${route.id} entry check references unknown section ${id}`);
  }
  return {
    ...route,
    stages,
    sectionCount: seen.size,
    minutes: stages.reduce((sum, stage) => sum + stage.minutes, 0),
  };
}

function sectionLink(id) {
  const body = bodySections.get(id);
  const item = learning.sections[id];
  const label = learning.levels[item.level].label;
  return `- [${id} ${item.title}](${body.file}#${anchorFor(id)}) — **${label}** / ${formatMinutes(item.minutes)}`;
}

function generate(compiled) {
  const lines = [
    '# 学習ルート',
    '',
    '<!-- handbook:generated; do not edit -->',
    `基準日: ${paths.updated}`,
    '',
    'このファイルは `config/learning-paths.json` と `config/learning-levels.json` から生成されます。ルート定義を変更した場合は `npm run generate:learning-paths` を実行してください。',
    '',
    '## ルート一覧',
    '',
    '| ルート | 想定読者 | 節数 | 推定時間 |',
    '|---|---|---:|---:|',
  ];
  for (const route of compiled) {
    lines.push(`| [${route.label}](#route-${route.id}) | ${route.audience} | ${route.sectionCount} | ${formatMinutes(route.minutes)} |`);
  }
  lines.push('', '## 使い方', '',
    '1. 担当領域を限定しない場合は標準通読から始めます。',
    '2. 目的別ルートへ途中参加する場合は、各ルートの「途中参加チェック」を先に確認します。',
    '3. チェック項目を説明できない場合は、リンク先の節を読んでから開始ステージへ進みます。',
    '4. 推定時間は本文と短いコード例を追う時間です。長時間の実装課題、環境構築、発展改造は別途見積もります。',
    '5. 同じ節を複数ルートで学ぶ場合、2回目以降は復習として短縮できます。',
    '');

  for (const route of compiled) {
    lines.push(`<a id="route-${route.id}"></a>`, `## ${route.label}`, '',
      `**想定読者:** ${route.audience}`, '',
      `**到達目標:** ${route.goal}`, '',
      `**開始方法:** ${route.entry}`, '',
      `**ルート全体:** ${route.sectionCount}節 / ${formatMinutes(route.minutes)}`, '');
    if ((route.entryChecks ?? []).length > 0) {
      lines.push('### 途中参加チェック', '', '次の節の要点を自分の言葉で説明できれば、前半を復習扱いにして開始できます。', '');
      for (const id of route.entryChecks) lines.push(sectionLink(id));
      lines.push('');
    }
    route.stages.forEach((stage, index) => {
      lines.push(`### ${index + 1}. ${stage.label}`, '', stage.purpose, '', `**このステージ:** ${stage.ids.length}節 / ${formatMinutes(stage.minutes)}`, '');
      for (const id of stage.ids) lines.push(sectionLink(id));
      lines.push('');
    });
  }

  lines.push('## 編集ルール', '',
    '1. ルートの正本は `config/learning-paths.json` です。',
    '2. 節の分類と推定時間は `config/learning-levels.json` を参照します。',
    '3. 節の追加・改名・削除時は両マニフェストを確認します。',
    '4. `npm run generate:learning-paths:check` は生成差分、存在しない節、重複した節、空ステージを検出します。',
    '5. 目次や前付けから本ファイルへのリンクを維持します。',
    '');
  return lines.join('\n');
}

validateBaseData();
const compiled = paths.routes.map(compileRoute);
const generated = generate(compiled);
if (check) {
  const current = fs.existsSync(outputFile) ? fs.readFileSync(outputFile, 'utf8') : '';
  if (current !== generated) {
    console.error('LEARNING_PATHS.md is out of date. Run npm run generate:learning-paths.');
    process.exit(1);
  }
  console.log(`Learning paths are current: ${compiled.length} routes.`);
} else {
  fs.writeFileSync(outputFile, generated);
  console.log(`Generated LEARNING_PATHS.md with ${compiled.length} routes.`);
  for (const route of compiled) console.log(`- ${route.label}: ${route.sectionCount} sections / ${formatMinutes(route.minutes)}`);
}
