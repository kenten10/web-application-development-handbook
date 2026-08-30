#!/usr/bin/env node
// リンク検査。config/links.json を正本として次を検査する。
//   L-INT-001 内部Markdownリンクの参照先ファイルが実在する
//   L-ANC-001 リンクのアンカーが参照先に実在する
//   L-SEC-001 節アンカー #section-X-Y が実在する節を指す
//   L-XREF-001 本文の「第N章」「N.M」参照が実在する章節を指す
//   L-CODE-001 本文が参照する code/ のパスが実在する
//   L-CODE-002 コード集の使い方のコマンドが実在するファイル・スクリプトを指す
//   L-URL-001 外部URLの形式が妥当である
//   L-URL-002 同一URLの表記が揺れていない (警告)
//   L-REACH-001 外部URLの到達性 (--check-external のときだけ。失敗しても終了コードを変えない)
//
// 外部npmパッケージは使わない。Node.js 標準ライブラリだけで動く。
// 使い方: node scripts/validate-links.mjs [--root <dir>] [--check-external] [--json]
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootArg = process.argv.indexOf('--root');
const root = path.resolve(rootArg >= 0 ? process.argv[rootArg + 1] : process.cwd());
const checkExternal = process.argv.includes('--check-external');
const asJson = process.argv.includes('--json');

const config = JSON.parse(fs.readFileSync(path.join(root, 'config/links.json'), 'utf8'));

const findings = [];
const stats = {
  documents: 0,
  markdownLinks: 0,
  internalFileLinks: 0,
  anchorLinks: 0,
  sectionAnchors: 0,
  chapterReferences: 0,
  sectionReferences: 0,
  codePathReferences: 0,
  codeCommands: 0,
  externalUrls: 0,
  externalUrlOccurrences: 0,
  reachabilityChecked: 0,
  reachabilityFailed: 0,
};

function record(severity, ruleId, message, where) {
  findings.push({ severity, ruleId, message, where });
}
const error = (ruleId, message, where) => record('error', ruleId, message, where);
const warn = (ruleId, message, where) => record('warning', ruleId, message, where);

const readIfExists = file => {
  const absolute = path.join(root, file);
  return fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : null;
};

// ------------------------------------------------------------------ 前処理
// GitHub と同じ規則で見出しからアンカー候補を作る。
export function githubSlug(title) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// 行をコードフェンス内外へ分ける。フェンス内の見出し・リンクは検査対象にしない。
export function splitFences(text) {
  const rows = [];
  let inFence = false;
  let fenceMarker = '';
  for (const [index, raw] of text.split('\n').entries()) {
    const fence = raw.match(/^\s*(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (!inFence) {
        inFence = true;
        fenceMarker = fence[1][0].repeat(3);
      } else if (fence[1].startsWith(fenceMarker) && fence[2].trim() === '') {
        inFence = false;
      }
      rows.push({ line: index + 1, raw, inFence: true });
      continue;
    }
    rows.push({ line: index + 1, raw, inFence });
  }
  return rows;
}

// インラインコード span を空白へ潰す。リンク記法の誤検出を避ける。
function maskInlineCode(line) {
  return line.replace(/(`+)[^`]*?\1/g, match => ' '.repeat(match.length));
}

const documents = new Map();
for (const file of config.scope.documents) {
  const text = readIfExists(file);
  if (text === null) {
    error('L-INT-001', `検査対象の文書が存在しない: ${file}`, 'config/links.json');
    continue;
  }
  documents.set(file, { text, rows: splitFences(text) });
  stats.documents += 1;
}

// 各文書のアンカー集合を作る。明示アンカー <a id="..."> と見出しの自動 slug。
const anchorsByFile = new Map();
for (const [file, { rows }] of documents) {
  const anchors = new Set();
  const slugCounts = new Map();
  for (const row of rows) {
    for (const match of row.raw.matchAll(/<a\s+id="([^"]+)"\s*>/g)) anchors.add(match[1]);
    if (row.inFence) continue;
    const heading = row.raw.match(/^#{1,6}\s+(.+?)\s*$/);
    if (!heading) continue;
    const slug = githubSlug(heading[1]);
    if (!slug) continue;
    const count = (slugCounts.get(slug) ?? 0) + 1;
    slugCounts.set(slug, count);
    anchors.add(count === 1 ? slug : `${slug}-${count - 1}`);
  }
  anchorsByFile.set(file, anchors);
}

// 本文の章と節を集める。章間参照の実在検査に使う。
const chapterNumbers = new Set();
const sectionIds = new Set();
for (const file of config.scope.manuscript) {
  const document = documents.get(file);
  if (!document) continue;
  for (const row of document.rows) {
    if (row.inFence) continue;
    const chapter = row.raw.match(/^##\s+第(\d+)章\s/);
    if (chapter) chapterNumbers.add(Number(chapter[1]));
    const section = row.raw.match(/^#{3,6}\s+(\d+)\.(\d+)(?:\.(\d+))?\s/);
    if (section) {
      sectionIds.add(`${section[1]}.${section[2]}`);
      if (section[3]) sectionIds.add(`${section[1]}.${section[2]}.${section[3]}`);
    }
  }
}

// ------------------------------------------------- L-INT-001 / L-ANC-001 / L-SEC-001
const externalUrlOccurrences = new Map();

function noteExternalUrl(url, where) {
  const list = externalUrlOccurrences.get(url) ?? [];
  list.push(where);
  externalUrlOccurrences.set(url, list);
  stats.externalUrlOccurrences += 1;
}

for (const [file, { rows }] of documents) {
  for (const row of rows) {
    if (row.inFence) continue;
    const line = maskInlineCode(row.raw);
    const where = `${file}:${row.line}`;

    for (const match of line.matchAll(/\[(?:[^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      stats.markdownLinks += 1;
      const target = match[1];
      if (config.ignoredAnchorPrefixes.some(prefix => target.startsWith(prefix))) {
        if (/^https?:\/\//.test(target)) noteExternalUrl(target, where);
        continue;
      }
      const [rawPath, anchor] = target.split('#');
      let targetFile = file;
      if (rawPath !== '') {
        stats.internalFileLinks += 1;
        const resolved = path.normalize(path.join(path.dirname(file), rawPath));
        if (!fs.existsSync(path.join(root, resolved))) {
          error('L-INT-001', `参照先が存在しない: ${target}`, where);
          continue;
        }
        targetFile = resolved;
      }
      if (anchor === undefined || anchor === '') continue;
      stats.anchorLinks += 1;
      const decoded = decodeURIComponent(anchor);
      const sectionAnchor = decoded.match(/^section-(\d+)-(\d+)(?:-(\d+))?$/);
      if (sectionAnchor) {
        stats.sectionAnchors += 1;
        const id = sectionAnchor[3]
          ? `${sectionAnchor[1]}.${sectionAnchor[2]}.${sectionAnchor[3]}`
          : `${sectionAnchor[1]}.${sectionAnchor[2]}`;
        if (!sectionIds.has(id)) {
          error('L-SEC-001', `節アンカー #${decoded} に対応する節 ${id} が本文にない`, where);
          continue;
        }
      }
      const known = anchorsByFile.get(targetFile);
      if (!known) {
        // 検査対象外の文書へのアンカーは実在検査できない。ファイル実在のみで足りる。
        continue;
      }
      if (!known.has(decoded)) {
        error('L-ANC-001', `アンカーが参照先 ${targetFile} に存在しない: #${decoded}`, where);
      }
    }

    for (const match of line.matchAll(/<(https?:\/\/[^>\s]+)>/g)) noteExternalUrl(match[1], where);
    for (const match of line.matchAll(/(?<![(<[\]"'])\bhttps?:\/\/[^\s<>()[\]"'`、。，]+/g)) {
      noteExternalUrl(match[0].replace(/[.,;:]+$/, ''), where);
    }
  }
}

// -------------------------------------------------------------- L-XREF-001
for (const file of config.scope.manuscript) {
  const document = documents.get(file);
  if (!document) continue;
  for (const row of document.rows) {
    if (row.inFence) continue;
    const line = maskInlineCode(row.raw);
    const where = `${file}:${row.line}`;
    for (const match of line.matchAll(/第(\d+)章/g)) {
      stats.chapterReferences += 1;
      const number = Number(match[1]);
      if (!chapterNumbers.has(number)) {
        error('L-XREF-001', `存在しない章を参照している: 第${number}章`, where);
      }
    }
    // 「12.4 の」「(17.13)」のように節番号だけで参照する形を拾う。
    // バージョン番号 (HTTP/1.1、OAuth 2.0、Python 3.14、semver) を節参照と取り違えないよう、
    // 直前が英字語・スラッシュ・節記号のものと、0 を含む組を除く。
    for (const match of line.matchAll(/(\d{1,2})\.(\d{1,2})(?:\.(\d{1,2}))?/g)) {
      const before = line.slice(0, match.index);
      const after = line.slice(match.index + match[0].length);
      if (/[\d./§v-]$/.test(before)) continue;
      if (/[A-Za-z][ 　]$/.test(before)) continue; // 「OAuth 2.0」「Python 3.14」
      if (/^[-\d.A-Za-z]/.test(after)) continue; // semver の prerelease や続きの数字
      if (!/^\s*(?:の|を|で|に|へ|と|は|が|も|節|参照|\)|、|。|」|\]|$)/.test(after)) continue;
      const parts = [match[1], match[2], match[3]].filter(part => part !== undefined);
      if (parts.some(part => Number(part) === 0)) continue;
      const chapter = Number(match[1]);
      if (!chapterNumbers.has(chapter)) continue; // 章番号でなければ数値表現とみなす
      const id = parts.join('.');
      stats.sectionReferences += 1;
      if (!sectionIds.has(id)) {
        error('L-XREF-001', `存在しない節を参照している: ${id}`, where);
      }
    }
  }
}

// -------------------------------------------------------------- L-CODE-001
for (const file of config.scope.manuscript) {
  const document = documents.get(file);
  if (!document) continue;
  for (const row of document.rows) {
    if (row.inFence) continue;
    for (const span of row.raw.matchAll(/`([^`\n]+)`/g)) {
      for (const match of span[1].matchAll(/\bcode\/ch\d+[A-Za-z0-9._/-]*/g)) {
        const target = match[0].replace(/[.,)]+$/, '');
        stats.codePathReferences += 1;
        if (!fs.existsSync(path.join(root, target))) {
          error('L-CODE-001', `参照している成果物が存在しない: ${target}`, `${file}:${row.line}`);
        }
      }
    }
  }
}

// -------------------------------------------------------------- L-CODE-002
const blockHeading = new RegExp(config.codeCommands.blockHeadingPattern);
const runners = new Set(config.codeCommands.runners);
const ignoredCommands = new Set(config.codeCommands.ignoredCommands);
const packageScriptCache = new Map();

function packageScripts(directory) {
  if (packageScriptCache.has(directory)) return packageScriptCache.get(directory);
  const manifest = path.join(root, directory, 'package.json');
  let scripts = null;
  if (fs.existsSync(manifest)) {
    try {
      scripts = new Set(Object.keys(JSON.parse(fs.readFileSync(manifest, 'utf8')).scripts ?? {}));
    } catch {
      scripts = null;
    }
  }
  packageScriptCache.set(directory, scripts);
  return scripts;
}

// 引数がファイルらしいか。フラグ・URL・数値・任意文字列は対象外。
function looksLikePath(token) {
  if (!token || token.startsWith('-')) return false;
  if (/^https?:\/\//.test(token)) return false;
  if (/^["']/.test(token)) return false;
  return /[./]/.test(token) && /\.[A-Za-z0-9]+$/.test(token);
}

for (const file of config.scope.manuscript) {
  const document = documents.get(file);
  if (!document) continue;
  const { rows } = document;
  for (const [index, row] of rows.entries()) {
    if (row.inFence || !blockHeading.test(row.raw)) continue;
    // 直後の bash フェンスを読む。
    let cursor = index + 1;
    while (cursor < rows.length && !/^\s*```/.test(rows[cursor].raw)) {
      if (/^#{1,6}\s/.test(rows[cursor].raw) || /^---\s*$/.test(rows[cursor].raw)) break;
      cursor += 1;
    }
    if (cursor >= rows.length || !/^\s*```/.test(rows[cursor].raw)) continue;
    let cwd = '.';
    for (let scan = cursor + 1; scan < rows.length; scan += 1) {
      const body = rows[scan].raw;
      if (/^\s*```\s*$/.test(body)) break;
      const where = `${file}:${rows[scan].line}`;
      // コメントを落とし、&& で連結された各コマンドを個別に見る。
      const stripped = body.replace(/\s+#.*$/, '').replace(/^\s*#.*$/, '').trim();
      if (stripped === '') continue;
      for (const piece of stripped.split(/\s*&&\s*|\s*;\s*/)) {
        const tokens = piece.trim().split(/\s+/).filter(Boolean);
        if (tokens.length === 0) continue;
        stats.codeCommands += 1;
        const [command, ...args] = tokens;
        if (command === 'cd') {
          const destination = args[0] ?? '.';
          cwd = path.normalize(path.join(cwd, destination));
          if (!fs.existsSync(path.join(root, cwd))) {
            error('L-CODE-002', `cd 先のディレクトリが存在しない: ${cwd}`, where);
            cwd = '.';
          }
          continue;
        }
        // pnpm --filter @handbook/chNN run <script> / exec <runner> <file>
        if (command === 'pnpm' && args[0] === '--filter') {
          const workspace = args[1] ?? '';
          const chapter = workspace.match(/^@handbook\/(ch\d+)$/);
          if (!chapter) {
            error('L-CODE-002', `未知のワークスペース指定: ${piece.trim()}`, where);
            continue;
          }
          const directory = `code/${chapter[1]}`;
          const scripts = packageScripts(directory);
          if (scripts === null) {
            error('L-CODE-002', `${directory} に package.json がない`, where);
            continue;
          }
          const verb = args[2];
          if (verb === 'run') {
            const scriptName = args[3];
            if (scriptName && !scripts.has(scriptName)) {
              error('L-CODE-002', `${directory}/package.json に scripts.${scriptName} がない`, where);
            }
            continue;
          }
          if (verb === 'exec') {
            const target = args.slice(3).find(token => looksLikePath(token));
            if (target && !fs.existsSync(path.join(root, directory, target))) {
              error('L-CODE-002', `pnpm exec が参照するファイルが存在しない: ${path.join(directory, target)}`, where);
            }
            continue;
          }
          continue;
        }
        if ((command === 'npm' || command === 'pnpm' || command === 'yarn') && args[0] === 'run') {
          const scriptName = args[1];
          const scripts = packageScripts(cwd);
          if (scripts === null) {
            error('L-CODE-002', `${cwd} に package.json がなく ${command} run ${scriptName} を実行できない`, where);
          } else if (scriptName && !scripts.has(scriptName)) {
            error('L-CODE-002', `${cwd}/package.json に scripts.${scriptName} がない`, where);
          }
          continue;
        }
        if (command.startsWith('./')) {
          if (!fs.existsSync(path.join(root, cwd, command))) {
            error('L-CODE-002', `実行ファイルが存在しない: ${path.join(cwd, command)}`, where);
          }
          continue;
        }
        if (ignoredCommands.has(command)) continue;
        if (!runners.has(command)) continue;
        const target = args.find(token => looksLikePath(token));
        if (!target) continue;
        const resolved = path.normalize(path.join(cwd, target));
        if (!fs.existsSync(path.join(root, resolved))) {
          error('L-CODE-002', `${command} が参照するファイルが存在しない: ${resolved}`, where);
        }
      }
    }
  }
}

// -------------------------------------------------------------- L-CITE-001
// 本文の [著者, 年] / [RFC nnnn] 形式の引用キーが 09-references.md に登録されているか。
const referencesText = readIfExists('09-references.md') ?? '';
const referenceKeys = new Set(
  [...referencesText.matchAll(/^\[([^\]]+)\]\s/gm)].map(match => match[1].trim()),
);
stats.citationKeys = referenceKeys.size;
stats.citations = 0;
const seenCitations = new Set();
for (const file of config.scope.manuscript) {
  const document = documents.get(file);
  if (!document) continue;
  for (const row of document.rows) {
    if (row.inFence) continue;
    const line = maskInlineCode(row.raw);
    // Markdown リンク [text](target) と、チェックボックス [ ] / [x] は引用ではない。
    for (const match of line.matchAll(/\[([^\]\n]{2,80})\](?!\()/g)) {
      const key = match[1].trim();
      if (!/(?:,\s*(?:19|20)\d{2}\s*$)|^RFC\s+\d+$|^(?:IETF|W3C|ISO|NIST|OWASP|ECMA)\b.*$/.test(key)) continue;
      if (/^[x ]$/i.test(key)) continue;
      stats.citations += 1;
      if (referenceKeys.has(key) || seenCitations.has(key)) continue;
      seenCitations.add(key);
      error('L-CITE-001', `引用キーが 09-references.md にない: [${key}]`, `${file}:${row.line}`);
    }
  }
}

// ------------------------------------------------------- L-URL-001 / L-URL-002
const httpAllowlist = config.external.httpAllowlist ?? [];
stats.externalUrls = externalUrlOccurrences.size;
for (const [url, occurrences] of externalUrlOccurrences) {
  const where = occurrences[0];
  let parsed = null;
  try {
    parsed = new URL(url);
  } catch {
    error('L-URL-001', `URLとして解釈できない: ${url}`, where);
    continue;
  }
  if (!config.external.allowedSchemes.includes(parsed.protocol.replace(':', ''))) {
    error('L-URL-001', `許可されていないスキーム: ${url}`, where);
    continue;
  }
  if (parsed.protocol === 'http:' && config.external.requireHttps) {
    const allowed = httpAllowlist.some(prefix => url.startsWith(prefix));
    if (!allowed) error('L-URL-001', `httpsで書くべきURL: ${url}`, where);
  }
  if (/[\s<>"]/.test(url) || /[、。]/.test(url)) {
    error('L-URL-001', `URLに不正な文字が混じっている: ${url}`, where);
  }
  if (parsed.hostname === '' || !parsed.hostname.includes('.')) {
    if (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(parsed.hostname)) {
      error('L-URL-001', `ホスト名が不正: ${url}`, where);
    }
  }
}
// 末尾スラッシュだけが違うURLは表記揺れとして警告する。
const normalizedUrls = new Map();
for (const url of externalUrlOccurrences.keys()) {
  const key = url.replace(/\/+$/, '');
  const list = normalizedUrls.get(key) ?? [];
  list.push(url);
  normalizedUrls.set(key, list);
}
for (const [key, variants] of normalizedUrls) {
  if (variants.length > 1) {
    warn('L-URL-002', `同じURLが複数の表記で現れる: ${variants.join(' / ')}`, externalUrlOccurrences.get(variants[0])[0]);
  }
}

// -------------------------------------------------------------- L-REACH-001
if (checkExternal) {
  const urls = [...externalUrlOccurrences.keys()].filter(url => !/localhost|127\.0\.0\.1|example\.(com|org)/.test(url));
  const { timeoutMs, concurrency } = config.external.reachability;
  const queue = [...urls];
  async function worker() {
    for (;;) {
      const url = queue.shift();
      if (!url) return;
      stats.reachabilityChecked += 1;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        // HEAD を拒否するホストが多い。4xx/5xx はすべて GET で確かめ直す。
        let response = await fetch(url, { method: 'HEAD', signal: controller.signal, redirect: 'follow' });
        if (response.status >= 400) {
          response = await fetch(url, { method: 'GET', signal: controller.signal, redirect: 'follow' });
        }
        if (response.status >= 400) {
          stats.reachabilityFailed += 1;
          warn('L-REACH-001', `HTTP ${response.status}: ${url}`, externalUrlOccurrences.get(url)[0]);
        }
      } catch (cause) {
        stats.reachabilityFailed += 1;
        warn('L-REACH-001', `到達できない (${cause.name}): ${url}`, externalUrlOccurrences.get(url)[0]);
      } finally {
        clearTimeout(timer);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
}

// ------------------------------------------------------------------ 報告
const errors = findings.filter(item => item.severity === 'error');
const warnings = findings.filter(item => item.severity === 'warning');

if (asJson) {
  console.log(JSON.stringify({ stats, findings }, null, 2));
} else {
  console.log('Link validation');
  console.log(`- documents: ${stats.documents}`);
  console.log(`- markdown links: ${stats.markdownLinks}`);
  console.log(`- internal file links: ${stats.internalFileLinks}`);
  console.log(`- anchor links: ${stats.anchorLinks} (section anchors: ${stats.sectionAnchors})`);
  console.log(`- chapter references: ${stats.chapterReferences}`);
  console.log(`- section references: ${stats.sectionReferences}`);
  console.log(`- code path references: ${stats.codePathReferences}`);
  console.log(`- code usage commands: ${stats.codeCommands}`);
  console.log(`- external urls: ${stats.externalUrls} (occurrences: ${stats.externalUrlOccurrences})`);
  if (checkExternal) {
    console.log(`- reachability checked: ${stats.reachabilityChecked}, unreachable: ${stats.reachabilityFailed}`);
  }
  console.log(`- errors: ${errors.length}`);
  console.log(`- warnings: ${warnings.length}`);
  if (errors.length > 0) {
    console.log('\nErrors');
    for (const item of errors) console.log(`- [${item.ruleId}] ${item.message} (${item.where})`);
  }
  if (warnings.length > 0) {
    console.log('\nWarnings');
    for (const item of warnings) console.log(`- [${item.ruleId}] ${item.message} (${item.where})`);
  }
}

process.exitCode = errors.length > 0 ? 1 : 0;
