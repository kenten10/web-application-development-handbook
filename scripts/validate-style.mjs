#!/usr/bin/env node
// STYLE_GUIDE.md のルールを本文と索引に対して機械検査する。
// 使い方:
//   node scripts/validate-style.mjs                 検査する
//   node scripts/validate-style.mjs --update-baseline   ベースラインを現状へ更新する
//   node scripts/validate-style.mjs --backlog       STYLE_BACKLOG.md を再生成する
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootArgIndex = process.argv.indexOf('--root');
const root = path.resolve(rootArgIndex >= 0 ? process.argv[rootArgIndex + 1] : process.cwd());
const updateBaseline = process.argv.includes('--update-baseline');
const writeBacklog = process.argv.includes('--backlog');
const checkBacklog = process.argv.includes('--check');

const readFile = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');
const config = JSON.parse(readFile('config/style-guide.json'));
const glossary = JSON.parse(readFile('config/glossary.json'));

const errors = [];
const warnings = [];
const findings = new Map(); // ruleId -> [{file, line, text}]

function record(ruleId, file, line, text) {
  if (!findings.has(ruleId)) findings.set(ruleId, []);
  findings.get(ruleId).push({ file, line, text });
}
function report(kind, code, message, location) {
  (kind === 'error' ? errors : warnings).push({ code, message, location });
}

// ---------------------------------------------------------------- 共通ユーティリティ
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isAscii = value => /^[\x20-\x7E]+$/.test(value);

export function variantPattern(canonical, variantText) {
  let pattern = escapeRegExp(variantText);
  if (canonical.startsWith(variantText) && canonical.length > variantText.length) {
    pattern += `(?!${escapeRegExp(canonical.slice(variantText.length, variantText.length + 1))})`;
  }
  if (isAscii(variantText)) pattern = `(?<![A-Za-z0-9_])${pattern}(?![A-Za-z0-9_])`;
  return new RegExp(pattern, 'g');
}

// 検査対象外の区間（インラインコード、リンク先、URL、HTMLタグ、パス）を空白へ置き換える。
export function maskProtected(line) {
  return line
    .replace(/(`+)[\s\S]*?\1/g, match => ' '.repeat(match.length))
    .replace(/<a\s+id="[^"]*"><\/a>/g, match => ' '.repeat(match.length))
    .replace(/\]\([^)]*\)/g, match => `]${' '.repeat(match.length - 1)}`)
    .replace(/https?:\/\/[^\s)、。]+/g, match => ' '.repeat(match.length))
    .replace(/<[^>]+>/g, match => ' '.repeat(match.length))
    .replace(/(?:code|scripts|config|dist|node_modules|\.github|\.devcontainer)\/[A-Za-z0-9_./{}-]+/g,
      match => ' '.repeat(match.length))
    .replace(/[A-Za-z0-9_-]+\/[A-Za-z0-9_./-]*\.[a-z]{1,6}\b/g, match => ' '.repeat(match.length));
}

// 引用符に囲まれたUI文言・発話例は文体規約の対象外とする。
export function maskQuoted(text) {
  return text
    .replace(/「[^」]*」/g, match => ' '.repeat(match.length))
    .replace(/『[^』]*』/g, match => ' '.repeat(match.length))
    .replace(/"[^"]*"/g, match => ' '.repeat(match.length));
}

export function maskLiterals(text, literals) {
  let output = text;
  for (const literal of literals) {
    if (!literal) continue;
    let from = 0;
    for (;;) {
      const at = output.indexOf(literal, from);
      if (at < 0) break;
      output = output.slice(0, at) + ' '.repeat(literal.length) + output.slice(at + literal.length);
      from = at + literal.length;
    }
  }
  return output;
}

// 本文Markdownを行単位で分類する。
export function scanDocument(text) {
  const lines = text.split('\n');
  const rows = [];
  const fences = [];
  let inFence = false;
  let fenceInfo = null;
  let fenceStart = 0;
  let generated = null;
  for (const [zeroBased, raw] of lines.entries()) {
    const fence = raw.match(/^\s*(`{3,})(.*)$/);
    if (fence) {
      if (!inFence) {
        inFence = true;
        fenceInfo = fence[2].trim();
        fenceStart = zeroBased + 1;
      } else {
        inFence = false;
        fences.push({ info: fenceInfo, line: fenceStart });
      }
      rows.push({ line: zeroBased + 1, raw, kind: 'fence', generated });
      continue;
    }
    if (inFence) {
      rows.push({ line: zeroBased + 1, raw, kind: 'code', generated });
      continue;
    }
    const start = raw.match(/^<!--\s*handbook:([a-z-]+):start/);
    if (start) {
      generated = start[1];
      rows.push({ line: zeroBased + 1, raw, kind: 'meta', generated });
      continue;
    }
    if (/^<!--\s*handbook:[a-z-]+:end/.test(raw)) {
      rows.push({ line: zeroBased + 1, raw, kind: 'meta', generated });
      generated = null;
      continue;
    }
    let kind = 'prose';
    if (/^<!--/.test(raw.trim())) kind = 'meta';
    else if (/^#{1,6}\s/.test(raw)) kind = 'heading';
    else if (/^\s*\|/.test(raw)) kind = 'table';
    else if (/^\s*>/.test(raw)) kind = 'quote';
    else if (/^\s*([-*+]|\d+\.)\s/.test(raw)) kind = 'list';
    else if (raw.trim() === '') kind = 'blank';
    rows.push({ line: zeroBased + 1, raw, kind, generated });
  }
  if (inFence) fences.push({ info: fenceInfo, line: fenceStart, unterminated: true });
  return { rows, fences };
}

const documents = new Map();
for (const file of config.scope.manuscript) {
  documents.set(file, scanDocument(readFile(file)));
}
const textRowsOf = file => documents.get(file).rows.filter(row => !['code', 'fence', 'meta', 'blank'].includes(row.kind));

// ---------------------------------------------------------------- 文字種のルール
const characterRules = [
  ['S-JA-001', /[，．]/g],
  ['S-JA-002', /[Ａ-Ｚａ-ｚ０-９]/g],
  ['S-JA-003', /[！？]/g],
  ['S-JA-004', /[（）]/g],
  ['S-JA-005', /　/g],
  ['S-SYM-001', /[—–]/g],
  ['S-SYM-002', /～/g],
];
for (const file of config.scope.manuscript) {
  for (const row of documents.get(file).rows) {
    if (row.kind === 'code' || row.kind === 'fence') continue;
    const masked = maskProtected(row.raw);
    for (const [ruleId, pattern] of characterRules) {
      for (const match of masked.matchAll(pattern)) {
        record(ruleId, file, row.line, `${match[0]} : ${row.raw.trim().slice(0, 90)}`);
      }
    }
  }
}

// S-JA-006 和文と半角括弧の間の半角スペース
const JAPANESE = /[ぁ-んァ-ヴ一-龥々〆ヵヶー]/;
for (const file of config.scope.manuscript) {
  for (const row of documents.get(file).rows) {
    if (row.kind === 'code' || row.kind === 'fence' || row.kind === 'meta' || row.kind === 'blank') continue;
    const masked = maskProtected(row.raw);
    for (let index = 0; index < masked.length; index += 1) {
      if (masked[index] === '(' && JAPANESE.test(masked[index - 1] ?? '')) {
        record('S-JA-006', file, row.line, `( の前に空白がない: ${row.raw.trim().slice(0, 90)}`);
      } else if (masked[index] === ')' && JAPANESE.test(masked[index + 1] ?? '')) {
        record('S-JA-006', file, row.line, `) の後に空白がない: ${row.raw.trim().slice(0, 90)}`);
      }
    }
  }
}

// S-JA-007 常体
const politePattern = new RegExp(
  `(?:${config.politeEndings.map(escapeRegExp).join('|')})(?=[。、）)」』！？!?]|$)`, 'g');
for (const file of config.scope.manuscript) {
  for (const row of textRowsOf(file)) {
    const masked = maskQuoted(maskProtected(row.raw));
    for (const match of masked.matchAll(politePattern)) {
      record('S-JA-007', file, row.line, `${match[0]} : ${row.raw.trim().slice(0, 90)}`);
    }
  }
}

// ---------------------------------------------------------------- コード・図表のルール
const allowedLanguages = new Set(config.fenceLanguages);
for (const file of config.scope.manuscript) {
  const { fences, rows } = documents.get(file);
  for (const fence of fences) {
    if (fence.unterminated) {
      report('error', 'S-CODE-001', `閉じられていないコードブロックがある`, `${file}:${fence.line}`);
      continue;
    }
    if (!fence.info) {
      record('S-CODE-001', file, fence.line, '言語指定のないコードブロック');
      continue;
    }
    const language = fence.info.split(/\s+/)[0];
    if (!allowedLanguages.has(language)) {
      record('S-CODE-002', file, fence.line, `許可されていない言語指定: ${language}`);
    }
  }
  // S-CODE-003 表の区切り行
  let tableStart = null;
  let tableRows = [];
  const flushTable = () => {
    if (tableStart !== null && tableRows.length >= 2) {
      const hasSeparator = tableRows.some(row => /^\s*\|[\s:|-]+\|\s*$/.test(row.raw));
      if (!hasSeparator) record('S-CODE-003', file, tableStart, '区切り行のない表');
    }
    tableStart = null;
    tableRows = [];
  };
  for (const row of rows) {
    if (row.kind === 'table') {
      if (tableStart === null) tableStart = row.line;
      tableRows.push(row);
    } else {
      flushTable();
    }
  }
  flushTable();
  // S-CODE-004 図は画像ではなくテキスト図で置く
  for (const row of rows) {
    if (row.kind === 'code' || row.kind === 'fence') continue;
    if (/!\[[^\]]*\]\([^)]*\)/.test(row.raw)) {
      record('S-CODE-004', file, row.line, '画像記法が使われている');
    }
  }
  // S-CODE-005 注意・補足のラベル書式
  const anyLabel = config.noticeLabels.map(escapeRegExp).join('|');
  const labelOnly = new RegExp(`^\\*\\*(${anyLabel})\\s*[:：]?\\s*\\*\\*`);
  const labelWithBody = new RegExp(`^\\*\\*(${anyLabel})\\s*[:：]\\s*[^*]+\\*\\*`);
  const canonical = new Set(config.canonicalNoticeLabels);
  for (const row of rows) {
    if (row.generated || row.kind !== 'prose') continue;
    const bodyMatch = row.raw.match(labelWithBody);
    if (bodyMatch) {
      record('S-CODE-005', file, row.line,
        `ラベルの中に本文がある。\`**${bodyMatch[1]}**: 本文\` の形にする: ${row.raw.trim().slice(0, 80)}`);
      continue;
    }
    const onlyMatch = row.raw.match(labelOnly);
    if (!onlyMatch) continue;
    const normalized = row.raw.match(new RegExp(`^\\*\\*(${anyLabel})\\*\\*[:：]`));
    if (!normalized || !canonical.has(onlyMatch[1])) {
      record('S-CODE-005', file, row.line,
        `注意ラベルは ${[...canonical].map(label => `\`**${label}**:\``).join(' ')} のいずれかにする: ${row.raw.trim().slice(0, 80)}`);
    }
  }
}

// ---------------------------------------------------------------- 用語のルール
const glossaryVariants = [];
for (const term of glossary.terms) {
  for (const variant of term.variants ?? []) {
    glossaryVariants.push({
      canonical: term.canonical,
      text: variant.text,
      severity: variant.severity,
      regex: variantPattern(term.canonical, variant.text),
      exceptions: term.exceptions ?? [],
    });
  }
}
for (const file of config.scope.manuscript) {
  for (const row of documents.get(file).rows) {
    if (row.kind === 'code' || row.kind === 'fence') continue;
    const isIndexMetadata = /^<!--\s*handbook:index\s/.test(row.raw.trim());
    if (row.kind === 'meta' && !isIndexMetadata) continue;
    const masked = maskProtected(row.raw);
    for (const variant of glossaryVariants) {
      const target = maskLiterals(masked, variant.exceptions);
      for (const match of target.matchAll(variant.regex)) {
        const ruleId = variant.severity === 'error' ? 'S-TERM-001' : 'S-TERM-002';
        record(ruleId, file, row.line,
          `${variant.text} → ${variant.canonical} : ${row.raw.trim().slice(0, 90)}`);
      }
    }
  }
}

// S-EN-001 略語の初出併記
const abbreviations = glossary.terms.filter(term => term.expandOnFirstUse && term.expansion);
for (const term of abbreviations) {
  const regex = variantPattern(term.canonical, term.canonical);
  let found = null;
  outer: for (const file of config.scope.manuscript) {
    const { rows } = documents.get(file);
    for (const [position, row] of rows.entries()) {
      if (row.generated || row.kind !== 'prose') continue;
      const masked = maskProtected(row.raw);
      regex.lastIndex = 0;
      if (!regex.test(masked)) continue;
      // 段落（前後の空行に挟まれた範囲）に正式名称があるかを見る。
      let start = position;
      while (start > 0 && rows[start - 1].kind !== 'blank') start -= 1;
      let end = position;
      while (end < rows.length - 1 && rows[end + 1].kind !== 'blank') end += 1;
      const paragraph = rows.slice(start, end + 1).map(item => item.raw).join(' ');
      found = { file, line: row.line, paragraph, raw: row.raw };
      break outer;
    }
  }
  if (!found) continue;
  const normalized = found.paragraph.replace(/\s+/g, ' ');
  if (!normalized.includes(term.expansion)) {
    record('S-EN-001', found.file, found.line,
      `${term.canonical} の初出に「${term.expansion}」がない: ${found.raw.trim().slice(0, 80)}`);
  }
}

// S-VAGUE-001 曖昧表現
const evidenceRegexes = config.evidencePatterns.map(pattern => new RegExp(pattern));
for (const file of config.scope.manuscript) {
  const { rows } = documents.get(file);
  let blockStart = 0;
  for (let index = 0; index <= rows.length; index += 1) {
    const row = rows[index];
    if (row && row.kind !== 'blank' && row.kind !== 'code' && row.kind !== 'fence') continue;
    const block = rows.slice(blockStart, index).filter(item => !['code', 'fence', 'blank'].includes(item.kind));
    blockStart = index + 1;
    if (block.length === 0) continue;
    const blockText = block.map(item => item.raw).join('\n');
    const hasEvidence = evidenceRegexes.some(regex => regex.test(blockText));
    if (hasEvidence) continue;
    for (const item of block) {
      // 「最近傍」のように、曖昧語を部分文字列として含む専門用語は誤検出になる。
      // config.vagueExceptions に列挙した語は先に伏せる。
      const masked = maskLiterals(maskProtected(item.raw), config.vagueExceptions ?? []);
      for (const expression of config.vagueExpressions) {
        let from = 0;
        for (;;) {
          const at = masked.indexOf(expression, from);
          if (at < 0) break;
          record('S-VAGUE-001', file, item.line,
            `${expression} : ${item.raw.trim().slice(0, 90)}`);
          from = at + expression.length;
        }
      }
    }
  }
}

// ---------------------------------------------------------------- 索引のルール
const indexText = readFile(config.scope.index);
const indexTerms = [...indexText.matchAll(/^- (.+?) — /gm)].map(match => match[1].trim());
const indexTermSet = new Set(indexTerms);
for (const term of indexTerms) {
  for (const variant of glossaryVariants) {
    if (variant.severity !== 'error') continue;
    const target = maskLiterals(term, variant.exceptions);
    variant.regex.lastIndex = 0;
    if (variant.regex.test(target)) {
      record('S-IDX-001', config.scope.index, 0,
        `索引語「${term}」が非正規表記 ${variant.text} を含む (正: ${variant.canonical})`);
    }
  }
}
for (const term of glossary.terms) {
  if (!term.indexTerm) continue;
  if (!indexTermSet.has(term.canonical)) {
    record('S-IDX-002', config.scope.index, 0, `索引に見出し語「${term.canonical}」がない`);
  }
}

// ---------------------------------------------------------------- ルールIDの整合
const styleGuideText = fs.existsSync(path.join(root, config.document))
  ? readFile(config.document) : '';
if (!styleGuideText) {
  report('error', 'S-META-001', `${config.document} が存在しない`, config.document);
} else {
  const documented = new Set([...styleGuideText.matchAll(/\bS-[A-Z]+-\d{3}\b/g)].map(match => match[0]));
  for (const rule of config.rules) {
    if (!documented.has(rule.id)) {
      record('S-META-001', config.document, 0, `${rule.id} が ${config.document} に記載されていない`);
    }
  }
  const configured = new Set(config.rules.map(rule => rule.id));
  for (const id of documented) {
    if (!configured.has(id)) {
      record('S-META-001', config.document, 0, `${id} が config/style-guide.json に登録されていない`);
    }
  }
}

// ---------------------------------------------------------------- 集計と判定
const ruleById = new Map(config.rules.map(rule => [rule.id, rule]));
const counts = {};
for (const [ruleId, items] of findings) {
  counts[ruleId] = {};
  for (const item of items) counts[ruleId][item.file] = (counts[ruleId][item.file] ?? 0) + 1;
}

if (updateBaseline) {
  const baselines = {};
  for (const rule of config.rules) {
    if (rule.enforcement !== 'baseline') continue;
    baselines[rule.id] = counts[rule.id] ?? {};
  }
  config.baselines = baselines;
  fs.writeFileSync(path.join(root, 'config/style-guide.json'), `${JSON.stringify(config, null, 2)}\n`);
  console.log('ベースラインを更新した。');
}

for (const rule of config.rules) {
  const perFile = counts[rule.id] ?? {};
  const total = Object.values(perFile).reduce((sum, value) => sum + value, 0);
  if (rule.enforcement === 'error') {
    for (const [file, count] of Object.entries(perFile)) {
      for (const item of findings.get(rule.id).filter(entry => entry.file === file)) {
        report('error', rule.id, `${rule.title}: ${item.text}`,
          item.line ? `${item.file}:${item.line}` : item.file);
      }
      void count;
    }
    continue;
  }
  const baseline = config.baselines[rule.id] ?? {};
  for (const [file, count] of Object.entries(perFile)) {
    const allowed = baseline[file] ?? 0;
    if (count > allowed) {
      report('error', rule.id,
        `${rule.title}: ${file} の違反が ${count} 件でベースライン ${allowed} 件を超えた。新規混入を取り消すか、修正のうえベースラインを更新すること`,
        file);
    }
  }
  if (total > 0) {
    report('warning', rule.id,
      `${rule.title}: 既知の未修正 ${total} 件 (STYLE_BACKLOG.md 参照、KEN-59 で解消する)`);
  }
}

// ---------------------------------------------------------------- 引き継ぎ一覧
export function renderBacklog() {
  const lines = [
    '# スタイル未修正一覧',
    '',
    '<!-- handbook:generated; do not edit -->',
    '`node scripts/validate-style.mjs --backlog` で生成する。手で編集しない。',
    '',
    `基準日: ${config.updated}`,
    '',
    'KEN-58 で `STYLE_GUIDE.md` と `scripts/validate-style.mjs` を用意したが、本文へ機械適用しなかった違反をここに残す。',
    'KEN-59（全文の編集校正とリンク検査）が解消の担当とする。`config/style-guide.json` の `baselines` が',
    '各ファイルの上限として働くため、この一覧が増えると `validate:style` が失敗する。',
    '',
    '## 集計',
    '',
    '| ルール | 内容 | 件数 |',
    '|---|---|---:|',
  ];
  for (const rule of config.rules) {
    if (rule.enforcement !== 'baseline') continue;
    const perFile = counts[rule.id] ?? {};
    const total = Object.values(perFile).reduce((sum, value) => sum + value, 0);
    lines.push(`| ${rule.id} | ${rule.title} | ${total} |`);
  }
  lines.push('');
  for (const rule of config.rules) {
    if (rule.enforcement !== 'baseline') continue;
    const items = findings.get(rule.id) ?? [];
    lines.push(`## ${rule.id} ${rule.title}`, '');
    if (items.length === 0) {
      lines.push('未修正なし。', '');
      continue;
    }
    lines.push('| 箇所 | 内容 |', '|---|---|');
    for (const item of items) {
      const location = item.line ? `${item.file}:${item.line}` : item.file;
      lines.push(`| ${location} | ${item.text.replace(/\|/g, '\\|')} |`);
    }
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

if (writeBacklog) {
  const backlogPath = path.join(root, 'STYLE_BACKLOG.md');
  const rendered = renderBacklog();
  if (checkBacklog) {
    const current = fs.existsSync(backlogPath) ? fs.readFileSync(backlogPath, 'utf8') : null;
    if (current !== rendered) {
      report('error', 'S-META-001',
        'STYLE_BACKLOG.md が検査結果と一致しない。pnpm run report:style-backlog を実行すること',
        'STYLE_BACKLOG.md');
    } else {
      console.log('STYLE_BACKLOG.md は最新である。');
    }
  } else {
    fs.writeFileSync(backlogPath, rendered);
    console.log('STYLE_BACKLOG.md を生成した。');
  }
}

const formatItem = item => `[${item.code}] ${item.message}${item.location ? ` (${item.location})` : ''}`;
console.log('Style validation');
console.log(`- manuscript files: ${config.scope.manuscript.length}`);
console.log(`- glossary terms: ${glossary.terms.length}`);
console.log(`- glossary variants: ${glossaryVariants.length}`);
console.log(`- index terms: ${indexTerms.length}`);
console.log(`- rules: ${config.rules.length}`);
console.log(`- errors: ${errors.length}`);
console.log(`- warnings: ${warnings.length}`);
if (errors.length > 0) {
  console.log('\nErrors');
  for (const item of errors.slice(0, 200)) console.log(`- ${formatItem(item)}`);
  if (errors.length > 200) console.log(`- ... 他 ${errors.length - 200} 件`);
}
if (warnings.length > 0) {
  console.log('\nWarnings');
  for (const item of warnings) console.log(`- ${formatItem(item)}`);
}
if (errors.length > 0) process.exitCode = 1;

void ruleById;
