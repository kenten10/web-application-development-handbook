import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, '..');
const validator = path.join(scriptDirectory, 'validate-style.mjs');
const fixer = path.join(scriptDirectory, 'apply-style-fixes.mjs');
const glossaryGenerator = path.join(scriptDirectory, 'generate-glossary.mjs');

const styleModule = await import('./validate-style.mjs');
const fixModule = await import('./apply-style-fixes.mjs');
const glossaryModule = await import('./generate-glossary.mjs');

const config = JSON.parse(fs.readFileSync(path.join(root, 'config/style-guide.json'), 'utf8'));
const glossary = JSON.parse(fs.readFileSync(path.join(root, 'config/glossary.json'), 'utf8'));

function runValidator(workspace) {
  try {
    return {
      status: 0,
      output: execFileSync(process.execPath, [validator, '--root', workspace], { encoding: 'utf8' }),
    };
  } catch (error) {
    return { status: error.status ?? 1, output: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  }
}

function createWorkspace() {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'style-'));
  fs.mkdirSync(path.join(workspace, 'config'));
  for (const file of ['config/style-guide.json', 'config/glossary.json', 'STYLE_GUIDE.md', '10-index.md']) {
    fs.copyFileSync(path.join(root, file), path.join(workspace, file));
  }
  const minimal = JSON.parse(fs.readFileSync(path.join(workspace, 'config/style-guide.json'), 'utf8'));
  minimal.scope.manuscript = ['02-part1-foundations.md'];
  minimal.baselines = {};
  fs.writeFileSync(path.join(workspace, 'config/style-guide.json'), `${JSON.stringify(minimal, null, 2)}\n`);
  return workspace;
}

function writeBody(workspace, body) {
  fs.writeFileSync(path.join(workspace, '02-part1-foundations.md'), body);
}

const cleanBody = [
  '# 第I部 基礎編',
  '',
  '<a id="chapter-1"></a>',
  '## 第1章 Webとは何か',
  '',
  'この節は表記規約に従っている。補足は半角括弧 (このように) で書く。',
  '',
  '```text',
  '[A] -> [B]',
  '```',
  '',
].join('\n');

test('規約に従う本文はエラーを出さない', () => {
  const workspace = createWorkspace();
  writeBody(workspace, cleanBody);
  const result = runValidator(workspace);
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /- errors: 0/);
});

test('S-JA-001 全角カンマ・ピリオドを検出する', () => {
  const workspace = createWorkspace();
  writeBody(workspace, cleanBody.replace('補足は半角括弧', 'これは誤りである．補足は半角括弧'));
  const result = runValidator(workspace);
  assert.equal(result.status, 1);
  assert.match(result.output, /S-JA-001/);
});

test('S-JA-004 全角括弧を検出する', () => {
  const workspace = createWorkspace();
  writeBody(workspace, cleanBody.replace('(このように)', '（このように）'));
  const result = runValidator(workspace);
  assert.equal(result.status, 1);
  assert.match(result.output, /S-JA-004/);
});

test('S-JA-006 和文と半角括弧の間の空白欠落を検出する', () => {
  const workspace = createWorkspace();
  writeBody(workspace, cleanBody.replace('補足は半角括弧 (このように) で書く。', '補足は半角括弧(このように)で書く。'));
  const result = runValidator(workspace);
  assert.equal(result.status, 1);
  assert.match(result.output, /S-JA-006/);
});

test('S-JA-007 敬体の文末を検出する', () => {
  const workspace = createWorkspace();
  writeBody(workspace, cleanBody.replace('従っている。', '従っています。'));
  const result = runValidator(workspace);
  assert.equal(result.status, 1);
  assert.match(result.output, /S-JA-007/);
});

test('S-JA-007 かぎ括弧内のUI文言は敬体でも許容する', () => {
  const workspace = createWorkspace();
  writeBody(workspace, cleanBody.replace('従っている。', '従っている。画面には「メールアドレスを入力してください」と出す。'));
  const result = runValidator(workspace);
  assert.equal(result.status, 0, result.output);
});

test('S-SYM-001 EM DASH を検出する', () => {
  const workspace = createWorkspace();
  writeBody(workspace, cleanBody.replace('## 第1章 Webとは何か', '## 第1章 Webとは何か — 全体像'));
  const result = runValidator(workspace);
  assert.equal(result.status, 1);
  assert.match(result.output, /S-SYM-001/);
});

test('S-CODE-001 言語指定のないコードブロックを検出する', () => {
  const workspace = createWorkspace();
  writeBody(workspace, cleanBody.replace('```text', '```'));
  const result = runValidator(workspace);
  assert.equal(result.status, 1);
  assert.match(result.output, /S-CODE-001/);
});

test('S-CODE-002 許可されていない言語指定を検出する', () => {
  const workspace = createWorkspace();
  writeBody(workspace, cleanBody.replace('```text', '```brainfuck'));
  const result = runValidator(workspace);
  assert.equal(result.status, 1);
  assert.match(result.output, /S-CODE-002/);
});

test('S-CODE-003 区切り行のない表を検出する', () => {
  const workspace = createWorkspace();
  writeBody(workspace, `${cleanBody}\n| 列A | 列B |\n| 値1 | 値2 |\n`);
  const result = runValidator(workspace);
  assert.equal(result.status, 1);
  assert.match(result.output, /S-CODE-003/);
});

test('S-CODE-004 画像記法を検出する', () => {
  const workspace = createWorkspace();
  writeBody(workspace, `${cleanBody}\n![図1](figure.png)\n`);
  const result = runValidator(workspace);
  assert.equal(result.status, 1);
  assert.match(result.output, /S-CODE-004/);
});

test('S-CODE-005 非正規の注意ラベルを検出する', () => {
  const workspace = createWorkspace();
  writeBody(workspace, `${cleanBody}\n**注意点:**\n`);
  const result = runValidator(workspace);
  assert.equal(result.status, 1);
  assert.match(result.output, /S-CODE-005/);
});

test('S-TERM-001 用語集の非正規表記を検出する', () => {
  const workspace = createWorkspace();
  writeBody(workspace, cleanBody.replace('この節は', 'この節のサーバーは'));
  const result = runValidator(workspace);
  assert.equal(result.status, 1);
  assert.match(result.output, /S-TERM-001/);
});

test('S-TERM-001 用語集の例外文字列は検出しない', () => {
  const workspace = createWorkspace();
  writeBody(workspace, cleanBody.replace('この節は', 'この節のサーバーレス構成は'));
  const result = runValidator(workspace);
  assert.equal(result.status, 0, result.output);
});

test('S-TERM-001 インラインコードの中は検出しない', () => {
  const workspace = createWorkspace();
  writeBody(workspace, cleanBody.replace('この節は', 'この節の `Postgres` は'));
  const result = runValidator(workspace);
  assert.equal(result.status, 0, result.output);
});

test('S-TERM-002 非推奨表記はベースラインを超えたときだけ失敗する', () => {
  const workspace = createWorkspace();
  writeBody(workspace, cleanBody.replace('この節は', 'この節の再試行処理は'));
  const failing = runValidator(workspace);
  assert.equal(failing.status, 1);
  assert.match(failing.output, /S-TERM-002/);

  const config2 = JSON.parse(fs.readFileSync(path.join(workspace, 'config/style-guide.json'), 'utf8'));
  config2.baselines = { 'S-TERM-002': { '02-part1-foundations.md': 1 } };
  fs.writeFileSync(path.join(workspace, 'config/style-guide.json'), `${JSON.stringify(config2, null, 2)}\n`);
  const passing = runValidator(workspace);
  assert.equal(passing.status, 0, passing.output);
  assert.match(passing.output, /warnings: 1/);
});

test('S-VAGUE-001 根拠のない曖昧表現を検出し、時点を添えると通る', () => {
  const workspace = createWorkspace();
  writeBody(workspace, cleanBody.replace('この節は表記規約に従っている。', 'モダンな構成が主流である。'));
  const failing = runValidator(workspace);
  assert.equal(failing.status, 1);
  assert.match(failing.output, /S-VAGUE-001/);

  writeBody(workspace, cleanBody.replace('この節は表記規約に従っている。', '2026年時点ではモダンな構成が主流である。'));
  const passing = runValidator(workspace);
  assert.equal(passing.status, 0, passing.output);
});

test('S-IDX-001 索引語の非正規表記を検出する', () => {
  const workspace = createWorkspace();
  writeBody(workspace, cleanBody);
  fs.appendFileSync(path.join(workspace, '10-index.md'), '\n### Z\n\n- Postgres — 1.1\n');
  const result = runValidator(workspace);
  assert.equal(result.status, 1);
  assert.match(result.output, /S-IDX-001/);
});

test('S-IDX-002 索引にない必須用語を検出する', () => {
  const workspace = createWorkspace();
  writeBody(workspace, cleanBody);
  const model = JSON.parse(fs.readFileSync(path.join(workspace, 'config/glossary.json'), 'utf8'));
  model.terms.push({
    id: 'テスト専用語', canonical: 'テスト専用語', category: 'japanese', reading: 'てすとせんようご',
    definition: 'テスト用。', variants: [], exceptions: [], indexTerm: true,
  });
  fs.writeFileSync(path.join(workspace, 'config/glossary.json'), `${JSON.stringify(model, null, 2)}\n`);
  const result = runValidator(workspace);
  assert.equal(result.status, 1);
  assert.match(result.output, /S-IDX-002/);
});

test('S-META-001 未記載のルールIDを検出する', () => {
  const workspace = createWorkspace();
  writeBody(workspace, cleanBody);
  const model = JSON.parse(fs.readFileSync(path.join(workspace, 'config/style-guide.json'), 'utf8'));
  model.rules.push({ id: 'S-TEST-999', title: 'テスト専用', enforcement: 'error' });
  fs.writeFileSync(path.join(workspace, 'config/style-guide.json'), `${JSON.stringify(model, null, 2)}\n`);
  const result = runValidator(workspace);
  assert.equal(result.status, 1);
  assert.match(result.output, /S-META-001/);
});

test('variantPattern は正表記の前方一致を除外する', () => {
  const pattern = styleModule.variantPattern('ユーザー', 'ユーザ');
  assert.equal('ユーザ操作'.match(pattern)?.length, 1);
  pattern.lastIndex = 0;
  assert.equal('ユーザー操作'.match(pattern), null);
});

test('maskProtected はインラインコードとリンク先を伏せる', () => {
  const masked = styleModule.maskProtected('本文 `（コード）` と [表示](./a（b）.md) の外側（ここ）');
  assert.ok(!masked.includes('コード'));
  assert.ok(masked.includes('（ここ）'));
});

test('apply-style-fixes は規約違反を修正し、二度目は変化しない', () => {
  const source = 'サーバーの説明（補足）は Postgres と — で書く。\n';
  const once = fixModule.fixMarkdown(source, {});
  assert.equal(once, 'サーバの説明 (補足) は PostgreSQL と ― で書く。\n');
  assert.equal(fixModule.fixMarkdown(once, {}), once);
});

test('apply-style-fixes は言語指定のないコードブロックへ text を付ける', () => {
  const source = ['```', '[A] -> [B]', '```', ''].join('\n');
  assert.equal(fixModule.fixMarkdown(source, {}), ['```text', '[A] -> [B]', '```', ''].join('\n'));
});

test('apply-style-fixes はコードブロックの中身を書き換えない', () => {
  const source = ['```text', 'サーバー（全角）', '```', ''].join('\n');
  assert.equal(fixModule.fixMarkdown(source, {}), source);
});

test('apply-style-fixes はパス文字列を書き換えない', () => {
  assert.equal(fixModule.isPathLike('code/ch11/mini-express.ts'), true);
  assert.equal(fixModule.isPathLike('サーバーの説明'), false);
  assert.equal(fixModule.fixManifestString('`code/ch20/mini-terraform/` を使う', {}),
    '`code/ch20/mini-terraform/` を使う');
});

test('apply-style-fixes は注意ラベルを整形する', () => {
  assert.equal(fixModule.applyNoticeLabels('**注意点:**', {}), '**注意**:');
  assert.equal(fixModule.applyNoticeLabels('**注意: 本文である。**', {}), '**注意**: 本文である。');
});

test('generate-glossary は正本と一致する GLOSSARY.md を作る', () => {
  const rendered = glossaryModule.renderGlossary(glossary);
  assert.equal(rendered, fs.readFileSync(path.join(root, 'GLOSSARY.md'), 'utf8'));
  assert.equal(glossaryModule.kanaRow('さーば'), 'さ行');
});

test('generate-glossary --check は差分を検出する', () => {
  const workspace = createWorkspace();
  fs.writeFileSync(path.join(workspace, 'GLOSSARY.md'), '# 用語集\n');
  let status = 0;
  try {
    execFileSync(process.execPath, [glossaryGenerator, '--check', '--root', workspace], { encoding: 'utf8' });
  } catch (error) {
    status = error.status ?? 1;
  }
  assert.equal(status, 1);
});

test('用語集の別表記は正表記と重複しない', () => {
  const canonicals = new Set(glossary.terms.map(term => term.canonical));
  for (const term of glossary.terms) {
    for (const variant of term.variants ?? []) {
      assert.notEqual(variant.text, term.canonical, `${term.canonical} の別表記が正表記と同じ`);
      assert.ok(['error', 'warn'].includes(variant.severity), `${variant.text} の severity が不正`);
    }
  }
  assert.equal(canonicals.size, glossary.terms.length, '正表記が重複している');
});

test('ルール定義は STYLE_GUIDE.md と1対1で対応する', () => {
  const documented = new Set(
    [...fs.readFileSync(path.join(root, 'STYLE_GUIDE.md'), 'utf8').matchAll(/\bS-[A-Z]+-\d{3}\b/g)]
      .map(match => match[0]));
  const configured = new Set(config.rules.map(rule => rule.id));
  assert.deepEqual([...configured].sort(), [...documented].sort());
});

test('ベースラインは baseline 分類のルールにだけ存在する', () => {
  const baselineRules = new Set(config.rules.filter(rule => rule.enforcement === 'baseline').map(rule => rule.id));
  for (const id of Object.keys(config.baselines)) {
    assert.ok(baselineRules.has(id), `${id} は baseline 分類ではない`);
  }
});

test('fixer と validator の変異形パターンが一致する', () => {
  for (const term of glossary.terms) {
    for (const variant of term.variants ?? []) {
      assert.equal(
        fixModule.variantPattern(term.canonical, variant.text).source,
        styleModule.variantPattern(term.canonical, variant.text).source,
      );
    }
  }
  assert.ok(fs.existsSync(fixer));
});
