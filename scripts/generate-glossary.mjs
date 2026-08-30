#!/usr/bin/env node
// config/glossary.json から GLOSSARY.md を生成する。
// 使い方: node scripts/generate-glossary.mjs [--check] [--root <dir>]
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootArgIndex = process.argv.indexOf('--root');
const root = path.resolve(rootArgIndex >= 0 ? process.argv[rootArgIndex + 1] : process.cwd());
const check = process.argv.includes('--check');
const target = 'GLOSSARY.md';

const glossary = JSON.parse(fs.readFileSync(path.join(root, 'config/glossary.json'), 'utf8'));

const KANA_ROWS = [
  ['あ行', 'あいうえおぁぃぅぇぉ'],
  ['か行', 'かきくけこがぎぐげご'],
  ['さ行', 'さしすせそざじずぜぞ'],
  ['た行', 'たちつてとだぢづでど'],
  ['な行', 'なにぬねの'],
  ['は行', 'はひふへほばびぶべぼぱぴぷぺぽ'],
  ['ま行', 'まみむめも'],
  ['や行', 'やゆよゃゅょ'],
  ['ら行', 'らりるれろ'],
  ['わ行', 'わをん'],
];

export function kanaRow(reading) {
  const head = (reading ?? '').charAt(0);
  for (const [label, characters] of KANA_ROWS) {
    if (characters.includes(head)) return label;
  }
  return 'その他';
}

const escapeCell = value => String(value ?? '').replace(/\|/g, '\\|');

export function renderGlossary(model) {
  const ascii = model.terms.filter(term => !term.reading).sort((a, b) => a.canonical.localeCompare(b.canonical, 'en'));
  const japanese = model.terms.filter(term => term.reading)
    .sort((a, b) => a.reading.localeCompare(b.reading, 'ja'));

  const lines = [
    '# 用語集',
    '',
    '<!-- handbook:generated; do not edit -->',
    '`config/glossary.json` から生成しています。直接編集せず、正本を修正して `pnpm run generate:glossary` を実行してください。',
    '',
    `基準日: ${model.updated}`,
    '',
    '表記の判定規則は [スタイルガイド](STYLE_GUIDE.md) の S-TERM-001・S-TERM-002 に対応します。',
    '`pnpm run validate:style` が本文と索引を機械検査します。',
    '',
    '## 分類',
    '',
    '| 分類 | 方針 |',
    '|---|---|',
  ];
  for (const [, definition] of Object.entries(model.categories)) {
    lines.push(`| ${escapeCell(definition.label)} | ${escapeCell(definition.note)} |`);
  }
  lines.push('', '## 別表記の扱い', '', '| 区分 | 意味 |', '|---|---|');
  for (const [key, description] of Object.entries(model.severities)) {
    lines.push(`| ${escapeCell(key)} | ${escapeCell(description)} |`);
  }

  const renderTable = terms => {
    const rows = ['| 正表記 | 分類 | 使わない表記 | 説明 | 索引 |', '|---|---|---|---|---|'];
    for (const term of terms) {
      const variants = (term.variants ?? []).length === 0
        ? '―'
        : term.variants.map(variant => `${variant.text}${variant.severity === 'warn' ? '(非推奨)' : ''}`).join('、');
      const category = model.categories[term.category]?.label ?? term.category;
      rows.push(`| **${escapeCell(term.canonical)}** | ${escapeCell(category)} | ${escapeCell(variants)} | ${escapeCell(term.definition)} | ${term.indexTerm ? '○' : ''} |`);
    }
    return rows;
  };

  lines.push('', '## 英字・記号で始まる語', '', ...renderTable(ascii));

  lines.push('', '## 日本語 (五十音順)', '');
  const grouped = new Map();
  for (const term of japanese) {
    const row = kanaRow(term.reading);
    if (!grouped.has(row)) grouped.set(row, []);
    grouped.get(row).push(term);
  }
  for (const [label] of KANA_ROWS) {
    const terms = grouped.get(label);
    if (!terms?.length) continue;
    lines.push(`### ${label}`, '', ...renderTable(terms), '');
  }
  const others = grouped.get('その他');
  if (others?.length) lines.push('### その他', '', ...renderTable(others), '');

  lines.push(
    '## 略語の初出',
    '',
    '次の略語は、本文で最初に説明する箇所で `略語 (英語正式名称)` の形を示します (S-EN-001)。',
    '',
    '| 略語 | 英語正式名称 |',
    '|---|---|',
  );
  for (const term of model.terms.filter(item => item.expandOnFirstUse && item.expansion)) {
    lines.push(`| ${escapeCell(term.canonical)} | ${escapeCell(term.expansion)} |`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function main() {
  const rendered = renderGlossary(glossary);
  const absolute = path.join(root, target);
  const current = fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : null;
  if (check) {
    if (current !== rendered) {
      console.error(`${target} が config/glossary.json と一致しません。pnpm run generate:glossary を実行してください。`);
      process.exitCode = 1;
      return;
    }
    console.log(`Glossary check passed: ${glossary.terms.length} term(s)`);
    return;
  }
  fs.writeFileSync(absolute, rendered);
  const variants = glossary.terms.reduce((sum, term) => sum + (term.variants?.length ?? 0), 0);
  console.log(`Generated ${target}: ${glossary.terms.length} term(s), ${variants} variant(s)`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
