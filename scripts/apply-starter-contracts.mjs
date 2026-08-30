#!/usr/bin/env node
// KEN-61: 必須検証演習の starter へ「実装すべき公開APIの一覧」を追記する。
//
// なぜ必要か: ベータレビュー (BR-EXEC-01 / BR-EXEC-03) で、starter が
// `export const exerciseId` と `// TODO: implement the exercise.` の2行だけで、
// 完成条件が要求する型・クラス名・メソッド署名を一切与えていないことが報告された。
// その結果、読者の実装は模範解答および solutions.test.ts と別のAPIになり、
// 演習カードの「テスト方法」を自分の実装に対して実行できなくなる。
//
// 何をするか: 模範解答から export された宣言を抜き出し、starter の末尾へ
// コメントとして「この形で公開すること」を書き込む。コードは生成しない
// (読者が書く部分を奪わないため、また型検査を壊さないため)。
//
// 冪等性: 生成ブロックはマーカーで囲み、再実行時は中身を作り直して置き換える。
// 使い方: node scripts/apply-starter-contracts.mjs [--root <dir>] [--check]
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootArg = process.argv.indexOf('--root');
const root = path.resolve(rootArg >= 0 ? process.argv[rootArg + 1] : process.cwd());
const checkOnly = process.argv.includes('--check');

const START = '// --- 実装すべき公開API (KEN-61 生成。手で書き換えない) ---';
const END = '// --- ここまで ---';
const EXPORT_PATTERN = /^export\s+(?:async\s+)?(?:function|class|const|type|interface|enum)\s+[A-Za-z_$][\w$]*(?:\s*\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\))?[^\n{=]*/gm;

const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

// `export class X` だけでは、読者は何のメソッドを生やせばよいか分からない。
// クラス本体を波括弧の対応で切り出し、公開メソッドの署名まで拾う。
function classBody(source, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(openIndex + 1, i);
    }
  }
  return '';
}

function classMembers(source, className) {
  const declaration = new RegExp(`export\\s+class\\s+${className}\\b[^{]*`, 'm').exec(source);
  if (!declaration) return [];
  const openIndex = source.indexOf('{', declaration.index + declaration[0].length - 1);
  if (openIndex < 0) return [];
  const body = classBody(source, openIndex);
  const members = [];
  // メソッド宣言は「文の先頭から始まり、本体の { で終わる」。
  // この2つを必須にしないと、圧縮された模範解答では本体の中の呼び出し
  // (`new Date(...)`、`Error(...)` など) まで署名として拾ってしまう。
  // private / protected / # 始まりは実装の内側なので契約に含めない。
  const pattern = /(?:^|[;}])\s*((?:static\s+)?(?:async\s+)?(?:get\s+|set\s+)?[A-Za-z_$][\w$]*\s*(?:<[^<>]*>)?\s*\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)\s*(?::\s*[^;{]+?)?)\s*\{/g;
  const reserved = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'do', 'try']);
  for (const match of body.matchAll(pattern)) {
    const signature = match[1].replace(/\s+/g, ' ').trim();
    const name = /^(?:static\s+)?(?:async\s+)?(?:get\s+|set\s+)?([A-Za-z_$][\w$]*)/.exec(signature)?.[1];
    if (!name || reserved.has(name)) continue;
    // 直前に private / protected / # があるものは公開APIではない
    const at = body.indexOf(match[1], match.index);
    const preceding = body.slice(Math.max(0, at - 20), at);
    if (/(private|protected)\s+$/.test(preceding) || name.startsWith('#')) continue;
    if (!members.includes(signature)) members.push(signature);
  }
  return members;
}

export function extractExports(source) {
  const found = [];
  for (const match of source.matchAll(EXPORT_PATTERN)) {
    const signature = match[0].trim().replace(/\s+/g, ' ');
    // exerciseId は starter に既にあるので契約としては出さない
    if (/^export const exerciseId\b/.test(signature)) continue;
    if (!found.includes(signature)) found.push(signature);
    const asClass = /^export class ([A-Za-z_$][\w$]*)/.exec(signature);
    if (asClass) {
      for (const member of classMembers(source, asClass[1])) {
        const line = `  ${member}`;
        if (!found.includes(line)) found.push(line);
      }
    }
  }
  return found;
}

export function buildBlock(signatures, solutionFiles) {
  const lines = [START];
  lines.push('// 完成条件と章のテストは、次の名前と形が公開されている前提で書かれている。');
  lines.push('// 別の名前で実装すると、演習カードの「テスト方法」を自分の実装に対して実行できない。');
  lines.push('//');
  for (const signature of signatures) lines.push(`//   ${signature}`);
  lines.push('//');
  lines.push(`// 実装し終えてから読む模範解答: ${solutionFiles.join(', ')}`);
  lines.push(END);
  return lines.join('\n');
}

export function applyBlock(source, block) {
  const startIndex = source.indexOf(START);
  if (startIndex < 0) return `${source.trimEnd()}\n\n${block}\n`;
  const endIndex = source.indexOf(END, startIndex);
  if (endIndex < 0) return `${source.trimEnd()}\n\n${block}\n`;
  return `${source.slice(0, startIndex)}${block}${source.slice(endIndex + END.length)}`;
}

function main() {
  const scope = readJson('beta-review-scope.json');
  const manifest = readJson('config/exercises.json');
  const byId = new Map();
  for (const chapter of Object.values(manifest.chapters)) {
    for (const exercise of chapter.exercises) byId.set(exercise.id, exercise);
  }

  let updated = 0;
  let skipped = 0;
  const touched = [];
  for (const entry of scope.exercises) {
    const exercise = byId.get(entry.id);
    if (!exercise) continue;

    const signatures = [];
    const solutionFiles = [];
    for (const relative of exercise.solution ?? []) {
      if (!relative.endsWith('.ts') && !relative.endsWith('.mts')) continue;
      const absolute = path.join(root, relative);
      if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) continue;
      solutionFiles.push(relative);
      for (const signature of extractExports(fs.readFileSync(absolute, 'utf8'))) {
        if (!signatures.includes(signature)) signatures.push(signature);
      }
    }
    if (signatures.length === 0) { skipped += 1; continue; }

    const targets = (exercise.starter ?? []).filter((relative) => relative.endsWith('.ts') || relative.endsWith('.mts'));
    if (targets.length === 0) { skipped += 1; continue; }

    const block = buildBlock(signatures, solutionFiles);
    for (const relative of targets) {
      const absolute = path.join(root, relative);
      if (!fs.existsSync(absolute)) continue;
      const before = fs.readFileSync(absolute, 'utf8');
      const after = applyBlock(before, block);
      if (after === before) continue;
      if (!checkOnly) fs.writeFileSync(absolute, after);
      updated += 1;
      touched.push(relative);
    }
  }

  console.log('Starter contracts');
  console.log(`- mandatory exercises: ${scope.exercises.length}`);
  console.log(`- starters updated: ${updated}`);
  console.log(`- exercises without a TypeScript contract: ${skipped}`);
  for (const file of touched) console.log(`  ${file}`);
  if (checkOnly && updated > 0) {
    console.log('starter の公開API一覧が最新ではない。node scripts/apply-starter-contracts.mjs を実行すること。');
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
