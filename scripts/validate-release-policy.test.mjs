import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const validator = path.join(root, 'scripts/validate-release-policy.mjs');
const builder = path.join(root, 'scripts/build-site.mjs');

const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const release = readJson('config/release.json');
const chapterGuides = readJson('config/chapter-guides.json');

// 検証に必要な最小構成だけを一時ディレクトリへ複製する。
const fixturePaths = [
  'config/release.json',
  'config/chapter-guides.json',
  'package.json',
  '.node-version',
  'LICENSE',
  'LICENSE-TEXT',
  'LICENSING.md',
  'CHANGELOG.md',
  'ERRATA.md',
  'RELEASE_POLICY.md',
  'README.md',
  '00-front-matter.md',
  'BETA_REVIEW_PLAN.md',
  '.github',
  'scripts/build-site.mjs',
  'scripts/validate-release-policy.mjs',
];

function makeFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-policy-'));
  for (const relative of fixturePaths) {
    const source = path.join(root, relative);
    if (!fs.existsSync(source)) continue;
    const destination = path.join(dir, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.cpSync(source, destination, { recursive: true });
  }
  // 本文Markdownは容量が大きいため、存在確認だけに使う空のプレースホルダを置く。
  for (const page of release.site.pages) {
    const destination = path.join(dir, page.source);
    if (fs.existsSync(destination)) continue;
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, `# ${page.label}\n`, 'utf8');
  }
  return dir;
}

function runValidator(cwdRoot) {
  return spawnSync(process.execPath, [validator, '--root', cwdRoot ?? root], { cwd: root, encoding: 'utf8' });
}

function patchFixture(dir, relative, transform) {
  const file = path.join(dir, relative);
  fs.writeFileSync(file, transform(fs.readFileSync(file, 'utf8')), 'utf8');
}

function patchJsonFixture(dir, relative, transform) {
  const file = path.join(dir, relative);
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  transform(value);
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function withFixture(callback) {
  const dir = makeFixture();
  try {
    return callback(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('リポジトリ全体で公開方針の検証が成功する', () => {
  const result = runValidator();
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('最小構成のfixtureでも検証が成功する', () => {
  withFixture((dir) => {
    const result = runValidator(dir);
    assert.equal(result.status, 0, result.stderr || result.stdout);
  });
});

test('CHANGELOGの最新版が正本とずれると検出する', () => {
  withFixture((dir) => {
    patchFixture(dir, 'CHANGELOG.md', (text) => text.replace(/^## \[1\.0\.0\] - /m, '## [1.2.3] - '));
    const result = runValidator(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /VERSION_MISMATCH_CHANGELOG/);
  });
});

test('CHANGELOGの日付が releaseDate とずれると検出する', () => {
  withFixture((dir) => {
    patchFixture(dir, 'CHANGELOG.md', (text) => text.replace(/^(## \[1\.0\.0\]) - \d{4}-\d{2}-\d{2}$/m, '$1 - 2099-01-01'));
    const result = runValidator(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /RELEASE_DATE_MISMATCH/);
  });
});

test('package.jsonの版番号がずれると検出する', () => {
  withFixture((dir) => {
    patchJsonFixture(dir, 'package.json', (value) => {
      value.version = '9.9.9';
    });
    const result = runValidator(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /VERSION_MISMATCH_PACKAGE/);
  });
});

test('ライセンス判定規則に一致しないファイルを検出する', () => {
  withFixture((dir) => {
    fs.writeFileSync(path.join(dir, 'unclassified.bin'), 'binary', 'utf8');
    const result = runValidator(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /LICENSE_RULE_UNMATCHED/);
    assert.match(result.stderr, /unclassified\.bin/);
  });
});

test('LICENSING.mdの対応表が正本とずれると検出する', () => {
  withFixture((dir) => {
    patchFixture(dir, 'LICENSING.md', (text) => text.replace('| 3 | `code/**` | コード |', '| 3 | `sample/**` | コード |'));
    const result = runValidator(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /LICENSING_TABLE_PATTERN/);
  });
});

test('ライセンス全文からSPDX識別子が消えると検出する', () => {
  withFixture((dir) => {
    patchFixture(dir, 'LICENSE-TEXT', (text) => text.replace('SPDX-License-Identifier: CC-BY-NC-SA-4.0', ''));
    const result = runValidator(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /LICENSE_TEXT_INVALID/);
  });
});

test('見直し周期が割り当てられていない章を検出する', () => {
  withFixture((dir) => {
    patchJsonFixture(dir, 'config/release.json', (value) => {
      delete value.reviewCycle.chapters['17'];
    });
    const result = runValidator(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /REVIEW_CYCLE_MISSING/);
  });
});

test('RELEASE_POLICY.mdの周期表と正本の不一致を検出する', () => {
  withFixture((dir) => {
    patchJsonFixture(dir, 'config/release.json', (value) => {
      value.reviewCycle.chapters['1'].tier = 'volatile';
    });
    const result = runValidator(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /REVIEW_CYCLE_DOC_MISSING/);
  });
});

test('READMEから利用条件の記載が欠けると検出する', () => {
  withFixture((dir) => {
    patchFixture(dir, 'README.md', (text) => text.replace('CC BY-NC-SA 4.0', 'なんらかのライセンス'));
    const result = runValidator(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /DISCLOSURE_TOKEN_MISSING/);
  });
});

test('前付けから公開・利用条件の見出しが消えると検出する', () => {
  withFixture((dir) => {
    patchFixture(dir, '00-front-matter.md', (text) => text.replace('### 公開・利用条件', '### 利用について'));
    const result = runValidator(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /DISCLOSURE_HEADING_MISSING/);
  });
});

test('正誤表の列が正本とずれると検出する', () => {
  withFixture((dir) => {
    patchFixture(dir, 'ERRATA.md', (text) =>
      text.replace('| ID | 報告日 | 対象版 |', '| ID | 対象版 | 報告日 |'),
    );
    const result = runValidator(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /ERRATA_COLUMNS_MISMATCH/);
  });
});

test('未公開の版を参照する正誤行を検出する', () => {
  withFixture((dir) => {
    patchFixture(dir, 'ERRATA.md', (text) =>
      text.replace(
        '| ID | 報告日 | 対象版 | 対象箇所 | 誤 | 正 | 重大度 | 状態 | 修正版 |\n|---|---|---|---|---|---|---|---|---|\n',
        '| ID | 報告日 | 対象版 | 対象箇所 | 誤 | 正 | 重大度 | 状態 | 修正版 |\n|---|---|---|---|---|---|---|---|---|\n| E-2026-001 | 2026-09-05 | 0.9.0 | 3.4 節 | 誤 | 正 | Minor | 確認済 | - |\n',
      ),
    );
    const result = runValidator(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /ERRATA_VERSION_UNKNOWN/);
  });
});

test('Pages workflowのactionが固定SHAでないと検出する', () => {
  withFixture((dir) => {
    patchFixture(dir, '.github/workflows/pages.yml', (text) => text.replace(/actions\/checkout@[0-9a-f]{40}/, 'actions/checkout@v4'));
    const result = runValidator(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /PAGES_ACTION_NOT_PINNED/);
  });
});

test('Pages workflowの権限が広がると検出する', () => {
  withFixture((dir) => {
    patchFixture(dir, '.github/workflows/pages.yml', (text) =>
      text.replace('permissions:\n  contents: read', 'permissions:\n  contents: write'),
    );
    const result = runValidator(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /PAGES_PERMISSIONS/);
  });
});

test('正誤報告テンプレートから必須項目が消えると検出する', () => {
  withFixture((dir) => {
    patchFixture(dir, '.github/ISSUE_TEMPLATE/errata-report.yml', (text) => text.replace('id: severity', 'id: level'));
    const result = runValidator(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /ERRATA_TEMPLATE_FIELD/);
  });
});

test('全章に見直し周期と判断理由がある', () => {
  const chapters = Object.keys(chapterGuides.chapters);
  assert.ok(chapters.length > 0);
  for (const chapter of chapters) {
    const cycle = release.reviewCycle.chapters[chapter];
    assert.ok(cycle, `第${chapter}章の見直し周期がありません`);
    assert.ok(release.reviewCycle.tiers[cycle.tier], `第${chapter}章のtierが未定義です`);
    assert.ok(cycle.drivers.length > 0, `第${chapter}章のdriversが空です`);
    assert.ok(cycle.reason.length >= 10, `第${chapter}章のreasonが短すぎます`);
  }
  assert.equal(Object.keys(release.reviewCycle.chapters).length, chapters.length);
});

test('見直し周期の区分は月数の昇順に定義されている', () => {
  const months = Object.values(release.reviewCycle.tiers).map((tier) => tier.months);
  assert.deepEqual(months, [...months].sort((a, b) => a - b));
  assert.equal(new Set(months).size, months.length);
});

test('SemVerの規則が本文とコードの両方について定義されている', () => {
  const levels = release.versioning.rules.map((rule) => rule.level);
  assert.deepEqual(levels, ['MAJOR', 'MINOR', 'PATCH']);
  for (const rule of release.versioning.rules) {
    assert.ok(rule.text.length > 0, `${rule.level}: 本文側の定義がありません`);
    assert.ok(rule.code.length > 0, `${rule.level}: コード側の定義がありません`);
    assert.ok(rule.readerImpact, `${rule.level}: 読者への影響が未記載です`);
  }
});

test('公開形式はGitHubリポジトリと静的サイトの2形式で、PDFとEPUBは理由付きで対象外である', () => {
  const inScope = release.distribution.formats.filter((format) => format.inScope).map((format) => format.id);
  assert.deepEqual(inScope, ['git-repository', 'static-site']);
  const outOfScope = release.distribution.outOfScope.map((format) => format.id);
  assert.deepEqual(outOfScope.sort(), ['epub', 'pdf']);
  for (const format of release.distribution.outOfScope) {
    assert.ok(format.reason.length > 10, `${format.id}: 理由が不十分です`);
    assert.ok(format.futurePolicy.length > 10, `${format.id}: 将来方針が不十分です`);
  }
});

test('静的サイト生成は決定的である', () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'release-check-')), 'site');
  try {
    const result = spawnSync(process.execPath, [builder, '--check', '--out', out], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Deterministic build: ok/);
  } finally {
    fs.rmSync(path.dirname(out), { recursive: true, force: true });
  }
});

test('生成したHTMLはライセンス表示と版番号を含む', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'release-site-'));
  try {
    const result = spawnSync(process.execPath, [builder, '--out', out], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const manifest = JSON.parse(fs.readFileSync(path.join(out, 'release-manifest.json'), 'utf8'));
    assert.equal(manifest.version, release.version);
    assert.equal(manifest.licensing.text, 'CC-BY-NC-SA-4.0');
    assert.equal(manifest.licensing.code, 'MIT');
    assert.ok(manifest.inputs.length >= release.site.pages.length);
    for (const page of release.site.pages) {
      const html = fs.readFileSync(path.join(out, page.output), 'utf8');
      assert.match(html, /CC-BY-NC-SA-4\.0/, `${page.output}: 本文ライセンス表示がありません`);
      assert.match(html, new RegExp(`v${release.version.replace(/\./g, '\\.')}`), `${page.output}: 版番号がありません`);
      assert.match(html, /<html lang="ja">/, `${page.output}: 言語指定がありません`);
    }
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test('生成したHTMLは本文の章アンカーを保持する', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'release-site-'));
  try {
    spawnSync(process.execPath, [builder, '--out', out], { cwd: root, encoding: 'utf8' });
    const html = fs.readFileSync(path.join(out, '02-part1-foundations.html'), 'utf8');
    assert.match(html, /<a id="chapter-1" class="anchor"><\/a>/);
    assert.match(html, /<a id="section-1-1" class="anchor"><\/a>/);
    // Markdown間のリンクはHTMLへ書き換える。
    const toc = fs.readFileSync(path.join(out, '01-toc.html'), 'utf8');
    assert.match(toc, /href="02-part1-foundations\.html#/);
    assert.doesNotMatch(toc, /href="\.\/02-part1-foundations\.md/);
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test('固定成果物の一覧と再現手順が定義されている', () => {
  assert.ok(release.fixedArtifacts.reproduceCommands.includes('pnpm run build:site'));
  assert.ok(release.fixedArtifacts.reproduceCommands.includes('pnpm run check:handbook'));
  for (const file of [...release.fixedArtifacts.manuscript, ...release.fixedArtifacts.policyDocuments]) {
    assert.ok(fs.existsSync(path.join(root, file)), `${file} がありません`);
  }
  assert.ok(release.fixedArtifacts.verificationLogs.length >= 3);
});
