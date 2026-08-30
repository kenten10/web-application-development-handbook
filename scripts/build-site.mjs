#!/usr/bin/env node
// 静的Webサイト（GitHub Pages）生成パイプライン。
// Node.jsの標準ライブラリだけで完結させ、外部依存を追加しない。
// 理由と対応記法は RELEASE_POLICY.md 第1節を参照。

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');
const readText = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const release = JSON.parse(readText('config/release.json'));

// ---------------------------------------------------------------- インライン

const escapeHtml = (value) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const CODE_PLACEHOLDER = '\u0000CODE';

function rewriteHref(href, context) {
  if (/^(?:https?:|mailto:|tel:|data:|#)/i.test(href)) return href;
  const [target, anchor] = href.split('#');
  if (!target) return href;
  const normalized = target.replace(/^\.\//, '');
  const page = context.pageBySource.get(normalized);
  if (page) return page.output + (anchor ? `#${anchor}` : '');
  if (context.repoLinkBase) {
    const base = context.repoLinkBase.replace(/\/+$/, '');
    return `${base}/${normalized}${anchor ? `#${anchor}` : ''}`;
  }
  context.unresolvedLinks.add(normalized);
  return href;
}

function renderInline(text, context) {
  const codeSpans = [];
  let working = text.replace(/(`+)([\s\S]*?)\1/g, (_match, _ticks, code) => {
    codeSpans.push(code.replace(/^ (.*) $/, '$1'));
    return `${CODE_PLACEHOLDER}${codeSpans.length - 1}\u0000`;
  });

  working = escapeHtml(working);

  // 画像 → リンク → 自動リンクの順に処理する。
  working = working.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, (_m, alt, src, title) => {
    const href = rewriteHref(src, context);
    const titleAttr = title ? ` title="${title}"` : '';
    return `<img src="${href}" alt="${alt}"${titleAttr} loading="lazy">`;
  });
  working = working.replace(/\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, (_m, label, href, title) => {
    const resolved = rewriteHref(href, context);
    const external = /^https?:/i.test(resolved);
    const titleAttr = title ? ` title="${title}"` : '';
    const relAttr = external ? ' rel="noopener noreferrer" target="_blank"' : '';
    return `<a href="${resolved}"${titleAttr}${relAttr}>${label}</a>`;
  });
  working = working.replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g, '<a href="$1" rel="noopener noreferrer" target="_blank">$1</a>');

  working = working.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  working = working.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  working = working.replace(/(^|[^*\w])\*([^*\n]+)\*(?![*\w])/g, '$1<em>$2</em>');
  working = working.replace(/~~([^~]+)~~/g, '<del>$1</del>');

  working = working.replace(new RegExp(`${CODE_PLACEHOLDER}(\\d+)\\u0000`, 'g'), (_m, index) =>
    `<code>${escapeHtml(codeSpans[Number(index)])}</code>`,
  );
  return working;
}

// ------------------------------------------------------------------ ブロック

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const FENCE = /^\s*(`{3,}|~{3,})\s*([A-Za-z0-9+#.-]*)\s*$/;
const HR = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const ANCHOR_ONLY = /^\s*<a\s+id="([A-Za-z0-9_.:-]+)"><\/a>\s*$/;
const TABLE_DELIMITER = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function slugify(text, used) {
  const base = text
    .replace(/<[^>]*>/g, '')
    .replace(/[`*_~]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s　]+/g, '-')
    .replace(/[^\p{L}\p{N}._-]/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
  const candidate = base || 'section';
  const count = used.get(candidate) ?? 0;
  used.set(candidate, count + 1);
  return count === 0 ? candidate : `${candidate}-${count}`;
}

function splitRow(line) {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells = [];
  let current = '';
  let escaped = false;
  for (const char of trimmed) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '|') {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function alignmentOf(cell) {
  const value = cell.trim();
  if (value.startsWith(':') && value.endsWith(':')) return 'center';
  if (value.endsWith(':')) return 'right';
  if (value.startsWith(':')) return 'left';
  return '';
}

function renderBlocks(lines, context) {
  const out = [];
  let index = 0;

  const paragraphBreak = (line) =>
    line.trim() === '' ||
    HEADING.test(line) ||
    FENCE.test(line) ||
    HR.test(line) ||
    LIST_ITEM.test(line) ||
    line.startsWith('>') ||
    line.trimStart().startsWith('<!--') ||
    ANCHOR_ONLY.test(line) ||
    line.trim().startsWith('|');

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim() === '') {
      index += 1;
      continue;
    }

    // HTMLコメント（handbook:* の生成メタデータ）は表示せず保持する。
    if (line.trimStart().startsWith('<!--')) {
      const buffer = [];
      while (index < lines.length) {
        buffer.push(lines[index]);
        if (lines[index].includes('-->')) {
          index += 1;
          break;
        }
        index += 1;
      }
      out.push(buffer.join('\n'));
      continue;
    }

    const anchor = ANCHOR_ONLY.exec(line);
    if (anchor) {
      out.push(`<a id="${anchor[1]}" class="anchor"></a>`);
      index += 1;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence) {
      const marker = fence[1][0];
      const lang = fence[2];
      const buffer = [];
      index += 1;
      while (index < lines.length && !new RegExp(`^\\s*${marker}{3,}\\s*$`).test(lines[index])) {
        buffer.push(lines[index]);
        index += 1;
      }
      index += 1;
      const classAttr = lang ? ` class="language-${lang}"` : '';
      const dataAttr = lang ? ` data-lang="${lang}"` : '';
      out.push(`<pre${dataAttr}><code${classAttr}>${escapeHtml(buffer.join('\n'))}\n</code></pre>`);
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      const level = heading[1].length;
      const id = slugify(heading[2], context.usedIds);
      out.push(`<h${level} id="${id}">${renderInline(heading[2], context)}</h${level}>`);
      index += 1;
      continue;
    }

    if (HR.test(line)) {
      out.push('<hr>');
      index += 1;
      continue;
    }

    // 表
    if (line.trim().startsWith('|') && index + 1 < lines.length && TABLE_DELIMITER.test(lines[index + 1])) {
      const header = splitRow(line);
      const aligns = splitRow(lines[index + 1]).map(alignmentOf);
      index += 2;
      const rows = [];
      while (index < lines.length && lines[index].trim().startsWith('|')) {
        rows.push(splitRow(lines[index]));
        index += 1;
      }
      const cell = (tag, value, column) => {
        const align = aligns[column] ? ` style="text-align:${aligns[column]}"` : '';
        return `<${tag}${align}>${renderInline(value ?? '', context)}</${tag}>`;
      };
      const head = header.map((value, column) => cell('th', value, column)).join('');
      const body = rows
        .map((row) => `<tr>${header.map((_h, column) => cell('td', row[column], column)).join('')}</tr>`)
        .join('\n');
      out.push(
        `<div class="table-scroll"><table>\n<thead><tr>${head}</tr></thead>\n<tbody>\n${body}\n</tbody>\n</table></div>`,
      );
      continue;
    }

    // 引用
    if (line.startsWith('>')) {
      const buffer = [];
      while (index < lines.length && (lines[index].startsWith('>') || (buffer.length > 0 && lines[index].trim() !== '' && !paragraphBreak(lines[index])))) {
        buffer.push(lines[index].replace(/^>\s?/, ''));
        index += 1;
      }
      out.push(`<blockquote>\n${renderBlocks(buffer, context)}\n</blockquote>`);
      continue;
    }

    // リスト
    const listStart = LIST_ITEM.exec(line);
    if (listStart) {
      const baseIndent = listStart[1].length;
      const buffer = [];
      while (index < lines.length) {
        const current = lines[index];
        if (current.trim() === '') {
          const next = lines[index + 1] ?? '';
          const nextItem = LIST_ITEM.exec(next);
          const continues = (nextItem && nextItem[1].length >= baseIndent) || /^\s{2,}\S/.test(next);
          if (!continues) break;
          buffer.push(current);
          index += 1;
          continue;
        }
        const item = LIST_ITEM.exec(current);
        if (item && item[1].length < baseIndent) break;
        if (!item && !/^\s{2,}\S/.test(current)) break;
        buffer.push(current);
        index += 1;
      }
      out.push(renderList(buffer, baseIndent, context));
      continue;
    }

    // 段落
    const buffer = [];
    while (index < lines.length && !paragraphBreak(lines[index])) {
      buffer.push(lines[index]);
      index += 1;
    }
    if (buffer.length === 0) {
      buffer.push(lines[index]);
      index += 1;
    }
    out.push(`<p>${renderParagraph(buffer, context)}</p>`);
  }

  return out.join('\n');
}

function renderParagraph(bufferLines, context) {
  return bufferLines
    .map((line, position) => {
      const hardBreak = /\s{2,}$/.test(line) && position < bufferLines.length - 1;
      return renderInline(line.trimEnd(), context) + (hardBreak ? '<br>' : '');
    })
    .join('\n');
}

function renderList(bufferLines, baseIndent, context) {
  const first = LIST_ITEM.exec(bufferLines[0]);
  const ordered = /\d/.test(first[2]);
  const items = [];
  for (const line of bufferLines) {
    const item = LIST_ITEM.exec(line);
    if (item && item[1].length === baseIndent) {
      items.push([item[3]]);
      continue;
    }
    if (items.length === 0) continue;
    const dedented = line.startsWith(' '.repeat(baseIndent + 2))
      ? line.slice(baseIndent + 2)
      : line.trimStart() === ''
        ? ''
        : line.slice(baseIndent);
    items[items.length - 1].push(dedented);
  }

  const rendered = items.map((itemLines) => {
    const trimmed = [...itemLines];
    while (trimmed.length > 0 && trimmed[trimmed.length - 1].trim() === '') trimmed.pop();
    const isSimple =
      trimmed.length >= 1 &&
      trimmed.slice(1).every((line) => line.trim() !== '' && !LIST_ITEM.test(line) && !FENCE.test(line) && !line.startsWith('>'));
    if (isSimple) return `<li>${renderParagraph(trimmed, context)}</li>`;
    return `<li>${renderBlocks(trimmed, context)}</li>`;
  });

  const tag = ordered ? 'ol' : 'ul';
  const startAttr = ordered && first[2].replace(/[.)]/, '') !== '1' ? ` start="${first[2].replace(/[.)]/, '')}"` : '';
  return `<${tag}${startAttr}>\n${rendered.join('\n')}\n</${tag}>`;
}

// -------------------------------------------------------------------- ページ

const STYLE = `:root {
  color-scheme: light dark;
  --bg: #ffffff;
  --fg: #1a1c20;
  --muted: #5b6270;
  --border: #d8dce3;
  --accent: #1f5fa8;
  --code-bg: #f5f6f8;
  --quote-bg: #f7f8fa;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #14161a;
    --fg: #e6e8ec;
    --muted: #9aa2b1;
    --border: #333842;
    --accent: #79b1f0;
    --code-bg: #1d2027;
    --quote-bg: #1a1d23;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font-family: "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", Meiryo, system-ui, sans-serif;
  line-height: 1.85;
  font-size: 16px;
}
.site-header, .site-footer {
  border-bottom: 1px solid var(--border);
  padding: 0.75rem 1.25rem;
  font-size: 0.875rem;
  color: var(--muted);
}
.site-footer { border-bottom: none; border-top: 1px solid var(--border); margin-top: 3rem; }
.site-header nav a { margin-right: 1rem; }
main { max-width: 46rem; margin: 0 auto; padding: 1.5rem 1.25rem 4rem; }
a { color: var(--accent); }
h1, h2, h3, h4, h5, h6 { line-height: 1.45; margin: 2.25rem 0 0.9rem; }
h1 { font-size: 1.85rem; }
h2 { font-size: 1.5rem; border-bottom: 1px solid var(--border); padding-bottom: 0.35rem; }
h3 { font-size: 1.2rem; }
h4, h5, h6 { font-size: 1.02rem; }
p { margin: 0 0 1.1rem; }
ul, ol { margin: 0 0 1.1rem; padding-left: 1.6rem; }
li { margin-bottom: 0.35rem; }
code {
  background: var(--code-bg);
  border-radius: 4px;
  padding: 0.1em 0.35em;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 0.88em;
}
pre {
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.9rem 1rem;
  overflow-x: auto;
  margin: 0 0 1.3rem;
  position: relative;
}
pre code { background: none; padding: 0; font-size: 0.84rem; line-height: 1.65; }
pre[data-lang]::before {
  content: attr(data-lang);
  position: absolute;
  top: 0;
  right: 0;
  padding: 0.1rem 0.5rem;
  font-size: 0.68rem;
  color: var(--muted);
  border-left: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  border-radius: 0 6px 0 6px;
}
blockquote {
  margin: 0 0 1.3rem;
  padding: 0.6rem 1rem;
  border-left: 3px solid var(--border);
  background: var(--quote-bg);
}
blockquote > :last-child { margin-bottom: 0; }
.table-scroll { overflow-x: auto; margin: 0 0 1.4rem; }
table { border-collapse: collapse; width: 100%; font-size: 0.92rem; }
th, td { border: 1px solid var(--border); padding: 0.4rem 0.7rem; text-align: left; vertical-align: top; }
th { background: var(--quote-bg); }
hr { border: none; border-top: 1px solid var(--border); margin: 2rem 0; }
img { max-width: 100%; height: auto; }
.anchor { display: block; position: relative; top: -0.5rem; visibility: hidden; }
.page-index { list-style: none; padding-left: 0; }
.page-index li { margin-bottom: 0.45rem; }
.page-index .group { font-weight: 700; margin: 1.6rem 0 0.6rem; }
.license-note { font-size: 0.82rem; color: var(--muted); }
@media (max-width: 640px) {
  body { font-size: 15px; }
  main { padding: 1rem 0.9rem 3rem; }
}
`;

function pageHtml({ title, bodyHtml, navHtml, footerHtml }) {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<header class="site-header"><nav>${navHtml}</nav></header>
<main>
${bodyHtml}
</main>
<footer class="site-footer">
${footerHtml}
</footer>
</body>
</html>
`;
}

function buildFooter() {
  const text = release.licensing.categories.text;
  const code = release.licensing.categories.code;
  return [
    `<p class="license-note">${escapeHtml(release.title)} ${escapeHtml(release.subtitle)} — v${release.version}（${release.releaseDate}）／ ${escapeHtml(release.author)}</p>`,
    `<p class="license-note">本文: <a href="${text.url}" rel="noopener noreferrer" target="_blank">${text.spdx}</a>　サンプルコード: <a href="${code.url}" rel="noopener noreferrer" target="_blank">${code.spdx}</a>　対応表: <a href="LICENSING.html">LICENSING</a></p>`,
    '<p class="license-note"><a href="CHANGELOG.html">変更履歴</a>　<a href="ERRATA.html">正誤表</a>　<a href="RELEASE_POLICY.html">公開・版管理方針</a></p>',
  ].join('\n');
}

function buildNav() {
  return [
    '<a href="index.html">目次一覧</a>',
    '<a href="01-toc.html">目次</a>',
    '<a href="10-index.html">索引</a>',
    '<a href="LEARNING_PATHS.html">学習ルート</a>',
    '<a href="ERRATA.html">正誤表</a>',
  ].join('');
}

function buildIndexPage() {
  const groups = new Map();
  for (const page of release.site.pages) {
    if (!groups.has(page.group)) groups.set(page.group, []);
    groups.get(page.group).push(page);
  }
  const sections = [...groups.entries()]
    .map(([group, pages]) => {
      const items = pages
        .map((page) => `<li><a href="${page.output}">${escapeHtml(page.label)}</a> <span class="license-note">（${escapeHtml(page.source)}）</span></li>`)
        .join('\n');
      return `<p class="group">${escapeHtml(group)}</p>\n<ul class="page-index">\n${items}\n</ul>`;
    })
    .join('\n');

  const body = [
    `<h1>${escapeHtml(release.title)}</h1>`,
    `<p>${escapeHtml(release.subtitle)}</p>`,
    `<p>版: <strong>v${release.version}</strong>（${release.releaseDate}）　著者: ${escapeHtml(release.author)}</p>`,
    '<p>本サイトはMarkdown正本から生成した閲覧用の複製である。正本はGitHubリポジトリのMarkdownであり、記述が食い違う場合はMarkdownを正とする。</p>',
    sections,
    `<p class="group">ライセンス</p>\n<ul class="page-index">\n${(release.site.copies ?? [])
      .map((copy) => `<li><a href="${copy.output}">${escapeHtml(copy.label)}</a> <span class="license-note">（${escapeHtml(copy.source)}）</span></li>`)
      .join('\n')}\n</ul>`,
  ].join('\n');

  return pageHtml({
    title: `${release.site.baseTitle} — 目次一覧`,
    bodyHtml: body,
    navHtml: buildNav(),
    footerHtml: buildFooter(),
  });
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function build(outDir) {
  const copies = release.site.copies ?? [];
  const context = {
    pageBySource: new Map([...release.site.pages, ...copies].map((page) => [page.source, page])),
    repoLinkBase: release.site.repoLinkBase ?? '',
    unresolvedLinks: new Set(),
    usedIds: new Map(),
  };

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const inputs = [];
  const outputs = [];
  const writeOutput = (name, content) => {
    const buffer = Buffer.from(content, 'utf8');
    fs.writeFileSync(path.join(outDir, name), buffer);
    outputs.push({ path: name, bytes: buffer.byteLength, sha256: sha256(buffer) });
  };

  for (const page of release.site.pages) {
    const sourceBuffer = fs.readFileSync(path.join(root, page.source));
    inputs.push({ path: page.source, bytes: sourceBuffer.byteLength, sha256: sha256(sourceBuffer) });
    context.usedIds = new Map();
    const markdown = sourceBuffer.toString('utf8').replace(/\r\n/g, '\n');
    const bodyHtml = renderBlocks(markdown.split('\n'), context);
    writeOutput(
      page.output,
      pageHtml({
        title: `${page.label} — ${release.site.baseTitle}`,
        bodyHtml,
        navHtml: buildNav(),
        footerHtml: buildFooter(),
      }),
    );
  }

  for (const copy of copies) {
    const sourceBuffer = fs.readFileSync(path.join(root, copy.source));
    inputs.push({ path: copy.source, bytes: sourceBuffer.byteLength, sha256: sha256(sourceBuffer) });
    writeOutput(copy.output, sourceBuffer.toString('utf8'));
  }

  writeOutput('index.html', buildIndexPage());
  writeOutput('style.css', STYLE);

  const releaseBuffer = fs.readFileSync(path.join(root, 'config/release.json'));
  inputs.push({ path: 'config/release.json', bytes: releaseBuffer.byteLength, sha256: sha256(releaseBuffer) });

  const manifest = {
    schemaVersion: 1,
    generator: 'scripts/build-site.mjs',
    version: release.version,
    releaseDate: release.releaseDate,
    state: release.state,
    toolchain: release.support.toolchain,
    licensing: {
      text: release.licensing.categories.text.spdx,
      code: release.licensing.categories.code.spdx,
    },
    inputs: inputs.sort((a, b) => a.path.localeCompare(b.path)),
    outputs: outputs.sort((a, b) => a.path.localeCompare(b.path)),
    unresolvedMarkdownLinks: [...context.unresolvedLinks].sort(),
  };
  const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
  fs.writeFileSync(path.join(outDir, 'release-manifest.json'), manifestJson, 'utf8');
  return manifest;
}

function manifestFingerprint(manifest) {
  return JSON.stringify({
    version: manifest.version,
    releaseDate: manifest.releaseDate,
    inputs: manifest.inputs,
    outputs: manifest.outputs,
  });
}

function reportUnresolved(links) {
  if (links.length === 0) return;
  console.warn(`WARN: サイトへ含めないリポジトリ内パスへのリンク: ${links.length}件（相対パスのまま残した）`);
  for (const link of links.slice(0, 5)) console.warn(`  - ${link}`);
  if (links.length > 5) console.warn(`  - ほか${links.length - 5}件（release-manifest.jsonのunresolvedMarkdownLinksを参照）`);
  console.warn('  config/release.json の site.repoLinkBase を設定すると、リポジトリのURLへ書き換える。');
}

// ---------------------------------------------------------------------- CLI

const checkMode = process.argv.includes('--check');
const outArgIndex = process.argv.indexOf('--out');
const configuredOut = outArgIndex >= 0 ? process.argv[outArgIndex + 1] : release.distribution.siteOutputDir;

if (checkMode) {
  const first = fs.mkdtempSync(path.join(os.tmpdir(), 'handbook-site-a-'));
  const second = fs.mkdtempSync(path.join(os.tmpdir(), 'handbook-site-b-'));
  let failed = false;
  try {
    const a = build(first);
    const b = build(second);
    if (manifestFingerprint(a) !== manifestFingerprint(b)) {
      console.error('ERROR: 同じ入力から異なる出力が生成されました。生成が決定的ではありません。');
      failed = true;
    } else {
      console.log('Deterministic build: ok');
    }

    const existingPath = path.resolve(root, configuredOut, 'release-manifest.json');
    if (fs.existsSync(existingPath)) {
      const existing = JSON.parse(fs.readFileSync(existingPath, 'utf8'));
      if (manifestFingerprint(existing) !== manifestFingerprint(a)) {
        console.error(`ERROR: ${configuredOut} の生成物が現在の入力と一致しません。pnpm run build:site を実行してください。`);
        failed = true;
      } else {
        console.log(`Existing artifacts match: ${configuredOut}`);
      }
    } else {
      console.log(`Existing artifacts: not found (${configuredOut})`);
    }

    console.log(`Pages: ${a.outputs.length}`);
    console.log(`Version: ${a.version} (${a.releaseDate})`);
    reportUnresolved(a.unresolvedMarkdownLinks);
  } finally {
    fs.rmSync(first, { recursive: true, force: true });
    fs.rmSync(second, { recursive: true, force: true });
  }
  if (failed) process.exit(1);
  console.log('Site build check passed.');
} else {
  const manifest = build(path.resolve(root, configuredOut));
  console.log(`Static site: ${configuredOut}`);
  console.log(`Pages: ${manifest.outputs.length}`);
  console.log(`Version: ${manifest.version} (${manifest.releaseDate})`);
  console.log(`Inputs: ${manifest.inputs.length}`);
  reportUnresolved(manifest.unresolvedMarkdownLinks);
  console.log('Site build completed.');
}
