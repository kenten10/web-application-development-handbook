#!/usr/bin/env node
// 公開形式・ライセンス・版管理・更新方針の正本（config/release.json）と、
// 運用文書・README・前付け・issueテンプレート・workflowの一致を検証する。
// BETA_REVIEW_PLAN.md の RB-10（公開・利用条件が未確定である）の機械判定に対応する。

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootArgIndex = process.argv.indexOf('--root');
const root = path.resolve(rootArgIndex >= 0 ? process.argv[rootArgIndex + 1] : import.meta.dirname + '/..');

const errors = [];
const warnings = [];
const fail = (code, message) => errors.push(`[${code}] ${message}`);
const warn = (code, message) => warnings.push(`[${code}] ${message}`);

const exists = (relative) => fs.existsSync(path.join(root, relative));
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const readJson = (relative) => JSON.parse(read(relative));

// --------------------------------------------------------------- 正本の読み込み

let release;
try {
  release = readJson('config/release.json');
} catch (error) {
  console.error(`ERROR: [RELEASE_CONFIG_INVALID] config/release.json を読み込めません: ${error.message}`);
  process.exit(1);
}

const chapterGuides = readJson('config/chapter-guides.json');
const packageJson = readJson('package.json');

if (release.schemaVersion !== 1) fail('SCHEMA_VERSION', 'config/release.json の schemaVersion は1にしてください。');

// ------------------------------------------------------------------ 必須ファイル

const requiredFiles = [
  'LICENSE',
  'LICENSE-TEXT',
  'LICENSING.md',
  'CHANGELOG.md',
  'ERRATA.md',
  'RELEASE_POLICY.md',
  'scripts/build-site.mjs',
  '.github/workflows/pages.yml',
  ...release.errata.intakeTemplates,
  release.errata.intakeConfig,
];
for (const file of requiredFiles) {
  if (!exists(file)) fail('REQUIRED_FILE_MISSING', `${file} がありません。`);
}

// -------------------------------------------------------------------- 版番号

const changelog = exists('CHANGELOG.md') ? read('CHANGELOG.md') : '';
const versionHeadingPattern = /^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})$/gm;
const changelogEntries = [...changelog.matchAll(versionHeadingPattern)].map((match) => ({
  version: match[1],
  date: match[2],
}));

if (!/^## \[Unreleased\]$/m.test(changelog)) {
  fail('CHANGELOG_UNRELEASED_MISSING', 'CHANGELOG.md に `## [Unreleased]` の見出しがありません。');
}
if (changelogEntries.length === 0) {
  fail('CHANGELOG_NO_RELEASE', 'CHANGELOG.md に `## [X.Y.Z] - YYYY-MM-DD` 形式の版見出しがありません。');
} else {
  const latest = changelogEntries[0];
  if (latest.version !== release.version) {
    fail(
      'VERSION_MISMATCH_CHANGELOG',
      `CHANGELOG.md の最新版 ${latest.version} が config/release.json の ${release.version} と一致しません。`,
    );
  }
  if (latest.date !== release.releaseDate) {
    fail(
      'RELEASE_DATE_MISMATCH',
      `CHANGELOG.md の最新版の日付 ${latest.date} が config/release.json の releaseDate ${release.releaseDate} と一致しません。`,
    );
  }
}
if (packageJson.version !== release.version) {
  fail(
    'VERSION_MISMATCH_PACKAGE',
    `package.json の version ${packageJson.version} が config/release.json の ${release.version} と一致しません。`,
  );
}
if (!Object.keys(release.stateValues ?? {}).includes(release.state)) {
  fail('RELEASE_STATE_INVALID', `state ${release.state} は stateValues に定義されていません。`);
}

const allowedSections = new Set(release.changelog.sections);
for (const match of changelog.matchAll(/^### (.+)$/gm)) {
  if (!allowedSections.has(match[1])) {
    fail('CHANGELOG_SECTION_INVALID', `CHANGELOG.md の分類 "${match[1]}" は許可されていません。`);
  }
}

const releasedVersions = new Set(changelogEntries.map((entry) => entry.version));

// -------------------------------------------------------- ライセンス判定規則

function globToRegExp(pattern) {
  let source = '';
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === '*') {
      if (pattern[index + 1] === '*') {
        if (pattern[index + 2] === '/') {
          source += '(?:.*/)?';
          index += 2;
        } else {
          source += '.*';
          index += 1;
        }
        continue;
      }
      source += '[^/]*';
      continue;
    }
    if (char === '?') {
      source += '[^/]';
      continue;
    }
    source += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${source}$`);
}

const ignorePatterns = (release.licensing.ignore ?? []).map((pattern) => ({
  pattern,
  regexp: globToRegExp(pattern),
  dirBase: pattern.endsWith('/**') ? pattern.slice(0, -3) : null,
}));
const licenseRules = release.licensing.rules.map((rule) => ({ ...rule, regexp: globToRegExp(rule.pattern) }));

for (const rule of licenseRules) {
  if (!release.licensing.categories[rule.category]) {
    fail('LICENSE_CATEGORY_UNKNOWN', `判定規則 ${rule.pattern} の区分 ${rule.category} が categories に定義されていません。`);
  }
}

const isIgnoredDir = (relative) =>
  relative === '.git' ||
  ignorePatterns.some((entry) => entry.dirBase && (relative === entry.dirBase || relative.startsWith(`${entry.dirBase}/`)));
const isIgnoredFile = (relative) => ignorePatterns.some((entry) => entry.regexp.test(relative));

const unmatched = [];
const categoryCounts = new Map();
function walk(relativeDir) {
  const absolute = relativeDir ? path.join(root, relativeDir) : root;
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (isIgnoredDir(relative)) continue;
      walk(relative);
      continue;
    }
    if (!entry.isFile()) continue;
    if (isIgnoredFile(relative)) continue;
    const rule = licenseRules.find((candidate) => candidate.regexp.test(relative));
    if (!rule) {
      unmatched.push(relative);
      continue;
    }
    categoryCounts.set(rule.category, (categoryCounts.get(rule.category) ?? 0) + 1);
  }
}
walk('');

for (const file of unmatched.slice(0, 20)) {
  fail('LICENSE_RULE_UNMATCHED', `${file} に一致するライセンス判定規則がありません。config/release.json と LICENSING.md を更新してください。`);
}
if (unmatched.length > 20) {
  fail('LICENSE_RULE_UNMATCHED', `ほか${unmatched.length - 20}件のファイルが判定規則に一致しません。`);
}

// LICENSING.md の対応表と正本の一致
const licensingMd = exists('LICENSING.md') ? read('LICENSING.md') : '';
const categoryLabels = { notice: '告知', code: 'コード', text: '本文' };
const tableRows = [...licensingMd.matchAll(/^\|\s*(\d+)\s*\|\s*`([^`]+)`\s*\|\s*(告知|コード|本文)\s*\|/gm)].map((match) => ({
  order: Number(match[1]),
  pattern: match[2],
  label: match[3],
}));

if (tableRows.length !== licenseRules.length) {
  fail(
    'LICENSING_TABLE_LENGTH',
    `LICENSING.md の判定規則表は${tableRows.length}行ですが、config/release.json の規則は${licenseRules.length}件です。`,
  );
}
licenseRules.forEach((rule, index) => {
  const row = tableRows[index];
  if (!row) return;
  if (row.order !== index + 1) {
    fail('LICENSING_TABLE_ORDER', `LICENSING.md の${index + 1}番目の行の順序番号が ${row.order} になっています。`);
  }
  if (row.pattern !== rule.pattern) {
    fail('LICENSING_TABLE_PATTERN', `LICENSING.md の${index + 1}行目のパターン ${row.pattern} が正本の ${rule.pattern} と一致しません。`);
  }
  if (row.label !== categoryLabels[rule.category]) {
    fail('LICENSING_TABLE_CATEGORY', `LICENSING.md の ${rule.pattern} の区分 ${row.label} が正本の ${categoryLabels[rule.category]} と一致しません。`);
  }
});

for (const [key, category] of Object.entries(release.licensing.categories)) {
  if (!category.file) continue;
  if (!exists(category.file)) {
    fail('LICENSE_FILE_MISSING', `区分 ${key} のライセンス全文 ${category.file} がありません。`);
    continue;
  }
  const text = read(category.file);
  if (key === 'code' && !text.includes('MIT License')) {
    fail('LICENSE_TEXT_INVALID', 'LICENSE に "MIT License" の記載がありません。');
  }
  if (key === 'text' && !(text.includes('CC BY-NC-SA 4.0') && text.includes(category.spdx))) {
    fail('LICENSE_TEXT_INVALID', `LICENSE-TEXT に "CC BY-NC-SA 4.0" または SPDX識別子 ${category.spdx} の記載がありません。`);
  }
  if (key === 'text' && !text.includes('creativecommons.org/licenses/by-nc-sa/4.0/legalcode')) {
    fail('LICENSE_TEXT_INVALID', 'LICENSE-TEXT に拘束力を持つリーガルコードのURLがありません。');
  }
}

// -------------------------------------------------------------- 見直し周期

const guideChapters = Object.keys(chapterGuides.chapters ?? {});
const cycleChapters = Object.keys(release.reviewCycle.chapters ?? {});
const tierNames = new Set(Object.keys(release.reviewCycle.tiers ?? {}));
const policyMd = exists('RELEASE_POLICY.md') ? read('RELEASE_POLICY.md') : '';

for (const chapter of guideChapters) {
  const cycle = release.reviewCycle.chapters[chapter];
  if (!cycle) {
    fail('REVIEW_CYCLE_MISSING', `第${chapter}章に見直し周期が割り当てられていません。`);
    continue;
  }
  if (!tierNames.has(cycle.tier)) {
    fail('REVIEW_CYCLE_TIER_INVALID', `第${chapter}章の tier ${cycle.tier} は定義されていません。`);
    continue;
  }
  if (!Array.isArray(cycle.drivers) || cycle.drivers.length === 0) {
    fail('REVIEW_CYCLE_DRIVERS_MISSING', `第${chapter}章に変化を駆動する要素の記載がありません。`);
  }
  if (!cycle.reason || cycle.reason.length < 10) {
    fail('REVIEW_CYCLE_REASON_MISSING', `第${chapter}章に周期の判断理由がありません。`);
  }
  const tier = release.reviewCycle.tiers[cycle.tier];
  const rowPattern = new RegExp(`^\\| 第${chapter}章 \\|.*\\| ${tier.label}（${tier.months}か月） \\|`, 'm');
  if (!rowPattern.test(policyMd)) {
    fail(
      'REVIEW_CYCLE_DOC_MISSING',
      `RELEASE_POLICY.md 第5.2節に第${chapter}章の行（${tier.label}（${tier.months}か月））がありません。`,
    );
  }
}
for (const chapter of cycleChapters) {
  if (!guideChapters.includes(chapter)) {
    fail('REVIEW_CYCLE_UNKNOWN_CHAPTER', `見直し周期に存在しない第${chapter}章が定義されています。`);
  }
}
if ((release.reviewCycle.triggers ?? []).length === 0) {
  fail('REVIEW_CYCLE_TRIGGER_MISSING', '周期によらない随時見直しのトリガーが定義されていません。');
}

// ------------------------------------------------------------ サポート範囲

for (const chapter of release.support.educationalOnly.chapters) {
  if (!guideChapters.includes(String(chapter))) {
    fail('SUPPORT_CHAPTER_UNKNOWN', `本番利用不可として挙げた第${chapter}章が config/chapter-guides.json にありません。`);
  }
}
if (packageJson.engines?.node !== release.support.toolchain.node.range) {
  fail(
    'SUPPORT_NODE_RANGE',
    `package.json の engines.node ${packageJson.engines?.node} が正本の ${release.support.toolchain.node.range} と一致しません。`,
  );
}
if (packageJson.engines?.pnpm !== release.support.toolchain.pnpm.range) {
  fail(
    'SUPPORT_PNPM_RANGE',
    `package.json の engines.pnpm ${packageJson.engines?.pnpm} が正本の ${release.support.toolchain.pnpm.range} と一致しません。`,
  );
}
if (!packageJson.packageManager?.includes(release.support.toolchain.pnpm.pinned)) {
  fail(
    'SUPPORT_PNPM_PINNED',
    `package.json の packageManager が pnpm ${release.support.toolchain.pnpm.pinned} に固定されていません。`,
  );
}
if (exists('.node-version') && read('.node-version').trim() !== release.support.toolchain.node.pinned) {
  fail('SUPPORT_NODE_PINNED', `.node-version が ${release.support.toolchain.node.pinned} ではありません。`);
}
const levels = new Set(['guaranteed', 'best-effort', 'unsupported']);
for (const environment of release.support.environments) {
  if (!levels.has(environment.level)) {
    fail('SUPPORT_LEVEL_INVALID', `対象環境 ${environment.id} の水準 ${environment.level} は定義されていません。`);
  }
}
if (!release.support.environments.some((environment) => environment.level === 'unsupported')) {
  warn('SUPPORT_NO_UNSUPPORTED', '対象外環境が1つも定義されていません。サポート範囲の境界が曖昧になります。');
}

// -------------------------------------------------------------------- 正誤表

const errata = exists('ERRATA.md') ? read('ERRATA.md') : '';
const errataHeader = errata.match(/^\|\s*ID\s*\|.*$/m);
if (!errataHeader) {
  fail('ERRATA_TABLE_MISSING', 'ERRATA.md に正誤一覧の表がありません。');
} else {
  const columns = errataHeader[0]
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
  const expected = release.errata.columns;
  if (columns.length !== expected.length || expected.some((name, index) => columns[index] !== name)) {
    fail('ERRATA_COLUMNS_MISMATCH', `ERRATA.md の列 [${columns.join(', ')}] が正本 [${expected.join(', ')}] と一致しません。`);
  }
}
for (const value of [...release.errata.states, ...release.errata.severities]) {
  if (!errata.includes(value)) fail('ERRATA_VOCABULARY_MISSING', `ERRATA.md に状態・重大度 "${value}" の説明がありません。`);
}
for (const template of release.errata.intakeTemplates) {
  if (!errata.includes(path.basename(template))) {
    fail('ERRATA_INTAKE_MISSING', `ERRATA.md に受付テンプレート ${path.basename(template)} への案内がありません。`);
  }
}

// 正誤一覧の各行が参照する版がCHANGELOGに存在するか
const errataTableSection = (errata.split(/^## /m).find((section) => section.startsWith('2. 正誤一覧')) ?? '')
  // 記入例はフェンス付きコードブロックで示すため、登録済みの行としては数えない。
  .replace(/^```[\s\S]*?^```$/gm, '');
const errataRows = [...errataTableSection.matchAll(/^\|\s*(E-\d{4}-\d{3})\s*\|\s*([^|]*)\|\s*([^|]*)\|/gm)];
const idPattern = /^E-\d{4}-\d{3}$/;
for (const row of errataRows) {
  const id = row[1].trim();
  const targetVersion = row[3].trim();
  if (!idPattern.test(id)) fail('ERRATA_ID_FORMAT', `正誤ID ${id} が ${release.errata.idFormat} の書式ではありません。`);
  if (!releasedVersions.has(targetVersion)) {
    fail('ERRATA_VERSION_UNKNOWN', `${id} の対象版 ${targetVersion} が CHANGELOG.md にありません。`);
  }
}

// ------------------------------------------------------ READMEと前付けの記載

for (const target of release.disclosure.targets) {
  if (!exists(target.file)) {
    fail('DISCLOSURE_FILE_MISSING', `${target.file} がありません。`);
    continue;
  }
  const lines = read(target.file).split('\n');
  const level = target.heading.match(/^#+/)[0].length;
  const start = lines.findIndex((line) => line.trim() === target.heading);
  if (start < 0) {
    fail('DISCLOSURE_HEADING_MISSING', `${target.file} に見出し "${target.heading}" がありません。`);
    continue;
  }
  const boundary = new RegExp(`^#{1,${level}} `);
  let end = start + 1;
  while (end < lines.length && !boundary.test(lines[end])) end += 1;
  const section = lines.slice(start + 1, end).join('\n');
  for (const token of release.disclosure.requiredTokens) {
    if (!section.includes(token)) {
      fail('DISCLOSURE_TOKEN_MISSING', `${target.file} の "${target.heading}" 節に "${token}" の記載がありません。`);
    }
  }
}

// ------------------------------------------------------------------ 公開形式

const inScopeFormats = release.distribution.formats.filter((format) => format.inScope);
if (inScopeFormats.length === 0) fail('DISTRIBUTION_EMPTY', '公開形式が1つも定義されていません。');
for (const format of release.distribution.formats) {
  if (!format.fixedBy) fail('DISTRIBUTION_FIX_MISSING', `公開形式 ${format.id} に固定方法の定義がありません。`);
}
for (const format of release.distribution.outOfScope) {
  if (!format.reason || !format.futurePolicy) {
    fail('DISTRIBUTION_OUT_OF_SCOPE', `スコープ外の形式 ${format.id} に理由または将来方針の記載がありません。`);
  }
}

const outputs = new Set();
for (const page of release.site.pages) {
  if (!exists(page.source)) fail('SITE_SOURCE_MISSING', `サイト生成対象 ${page.source} がありません。`);
  if (outputs.has(page.output)) fail('SITE_OUTPUT_DUPLICATE', `出力先 ${page.output} が重複しています。`);
  outputs.add(page.output);
  if (!page.label || !page.group) fail('SITE_PAGE_METADATA', `${page.source} に label または group がありません。`);
}
for (const copy of release.site.copies ?? []) {
  if (!exists(copy.source)) fail('SITE_COPY_MISSING', `サイトへ複製する ${copy.source} がありません。`);
  if (outputs.has(copy.output)) fail('SITE_OUTPUT_DUPLICATE', `出力先 ${copy.output} が重複しています。`);
  outputs.add(copy.output);
}
for (const source of release.fixedArtifacts.manuscript) {
  if (!release.site.pages.some((page) => page.source === source)) {
    fail('SITE_MANUSCRIPT_MISSING', `固定成果物の ${source} が静的サイトの生成対象に含まれていません。`);
  }
}
for (const file of [...release.fixedArtifacts.manuscript, ...release.fixedArtifacts.policyDocuments]) {
  if (!exists(file)) fail('FIXED_ARTIFACT_MISSING', `固定成果物 ${file} がありません。`);
}
if ((release.fixedArtifacts.reproduceCommands ?? []).length === 0) {
  fail('REPRODUCE_COMMANDS_MISSING', 'v1.0の再現手順が定義されていません。');
}
for (const log of release.fixedArtifacts.verificationLogs) {
  if (!log.command || !log.evidence) fail('VERIFICATION_LOG_INCOMPLETE', `検証ログ ${log.id} にコマンドまたは証跡の定義がありません。`);
}

// --------------------------------------------------------- Pages workflow

if (exists('.github/workflows/pages.yml')) {
  const workflow = read('.github/workflows/pages.yml');
  if (!/^permissions:\n  contents: read/m.test(workflow)) {
    fail('PAGES_PERMISSIONS', '.github/workflows/pages.yml の既定 permissions が contents: read に限定されていません。');
  }
  if (!workflow.includes('persist-credentials: false')) {
    fail('PAGES_CHECKOUT', '.github/workflows/pages.yml の checkout に persist-credentials: false がありません。');
  }
  if (!workflow.includes('scripts/build-site.mjs')) {
    fail('PAGES_BUILD_STEP', '.github/workflows/pages.yml がサイト生成スクリプトを実行していません。');
  }
  if (!workflow.includes('scripts/build-site.mjs --check')) {
    fail('PAGES_CHECK_STEP', '.github/workflows/pages.yml が生成の決定性検証を実行していません。');
  }
  if (!workflow.includes('pages: write') || !workflow.includes('id-token: write')) {
    fail('PAGES_DEPLOY_PERMISSIONS', '.github/workflows/pages.yml のデプロイジョブに pages: write と id-token: write がありません。');
  }
  for (const match of workflow.matchAll(/^\s*uses:\s*([\w.-]+\/[\w.-]+)@([^\s#]+)/gm)) {
    if (!/^[0-9a-f]{40}$/.test(match[2])) {
      fail('PAGES_ACTION_NOT_PINNED', `.github/workflows/pages.yml: ${match[1]}@${match[2]} が完全なcommit SHAへ固定されていません。`);
    }
  }
}

// ----------------------------------------------------- issueテンプレート

for (const template of release.errata.intakeTemplates) {
  if (!exists(template)) continue;
  const text = read(template);
  for (const key of ['name:', 'description:', 'body:']) {
    if (!text.includes(key)) fail('ISSUE_TEMPLATE_INVALID', `${template} に ${key} がありません。`);
  }
  if (!/labels:/.test(text)) fail('ISSUE_TEMPLATE_LABEL', `${template} に labels の定義がありません。`);
  if (!text.includes('氏名・メールアドレス・所属')) {
    fail('ISSUE_TEMPLATE_PRIVACY', `${template} に個人情報を含めない旨の確認項目がありません。`);
  }
}
if (exists('.github/ISSUE_TEMPLATE/errata-report.yml')) {
  const text = read('.github/ISSUE_TEMPLATE/errata-report.yml');
  for (const field of ['id: version', 'id: location', 'id: severity']) {
    if (!text.includes(field)) fail('ERRATA_TEMPLATE_FIELD', `正誤報告テンプレートに ${field} の項目がありません。`);
  }
  for (const severity of release.errata.severities) {
    if (!text.includes(severity)) fail('ERRATA_TEMPLATE_SEVERITY', `正誤報告テンプレートに重大度 ${severity} の選択肢がありません。`);
  }
}
if (exists(release.errata.intakeConfig)) {
  const text = read(release.errata.intakeConfig);
  if (!text.includes('blank_issues_enabled: false')) {
    warn('ISSUE_CONFIG_BLANK', `${release.errata.intakeConfig} で空のIssueを禁止していません。テンプレートを迂回した報告が届きます。`);
  }
}

// -------------------------------------------------- リリースゲートとの対応

const blockerIds = new Set((release.releaseGateMapping?.blockers ?? []).map((blocker) => blocker.id));
if (!blockerIds.has('RB-10')) {
  fail('RELEASE_GATE_RB10', 'releaseGateMapping に RB-10 の対応が定義されていません。');
}
if (exists('BETA_REVIEW_PLAN.md')) {
  const plan = read('BETA_REVIEW_PLAN.md');
  for (const id of blockerIds) {
    if (!plan.includes(id)) fail('RELEASE_GATE_UNKNOWN', `${id} は BETA_REVIEW_PLAN.md に定義されていません。`);
  }
  if (!plan.includes(release.releaseGateMapping.ken63Gate)) {
    fail('RELEASE_GATE_TEXT', `BETA_REVIEW_PLAN.md に KEN-63 のゲート "${release.releaseGateMapping.ken63Gate}" の記載がありません。`);
  }
}

// ------------------------------------------------------------------ 出力

console.log('Release policy validation');
console.log(`- version: ${release.version} (${release.releaseDate}, ${release.state})`);
console.log(`- distribution formats: ${inScopeFormats.map((format) => format.id).join(', ')}`);
console.log(`- site pages: ${release.site.pages.length} (+${(release.site.copies ?? []).length} copies)`);
console.log(`- licensed files: ${[...categoryCounts.entries()].map(([key, count]) => `${key}=${count}`).join(', ')}`);
console.log(`- review cycles: ${cycleChapters.length}/${guideChapters.length} chapters`);
console.log(`- changelog releases: ${changelogEntries.length}`);
console.log(`- errata entries: ${errataRows.length}`);
console.log(`- errors: ${errors.length}`);
console.log(`- warnings: ${warnings.length}`);
for (const warning of warnings) console.warn(`WARN: ${warning}`);
for (const error of errors) console.error(`ERROR: ${error}`);
if (errors.length > 0) {
  console.error(`Release policy validation failed: ${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(1);
}
console.log(`Release policy validation passed: ${warnings.length} warning(s)`);
