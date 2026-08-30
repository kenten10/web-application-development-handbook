#!/usr/bin/env node
// KEN-59 の全文校正で確定した個別修正を、config/editorial-fixes.json から一括適用する。
// 手作業での大量置換を避け、何をどこへ直したかを正本として残すのが目的。
//
// 冪等性: `from` が見つからず `to` が既にある場合は「適用済み」として数え、変更しない。
// 安全性: 適用時に `from` がファイル内で一意であることを確認する。複数一致は失敗させる。
//
// 使い方: node scripts/apply-editorial-fixes.mjs [--root <dir>] [--check] [--verbose]
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootArg = process.argv.indexOf('--root');
const root = path.resolve(rootArg >= 0 ? process.argv[rootArg + 1] : process.cwd());
const checkOnly = process.argv.includes('--check');
const verbose = process.argv.includes('--verbose');

const config = JSON.parse(fs.readFileSync(path.join(root, 'config/editorial-fixes.json'), 'utf8'));

// JSON 正本の文字列を書き換えるための経路指定。"chapters.23.exercises[0].services" のような形。
function getByPath(node, segments) {
  let current = node;
  for (const segment of segments) {
    if (current === undefined || current === null) return undefined;
    current = current[segment];
  }
  return current;
}

// "a.b[0].c" のほか、キー自体がドットを含む場合の `a["13.26"].c` にも対応する。
// config/learning-levels.json の sections は "13.26" のようなキーを持つため、
// 素朴なドット分割では到達できない。
export function parsePath(pointer) {
  const segments = [];
  const pattern = /\["([^"]+)"\]|\['([^']+)'\]|\[(\d+)\]|([^.[\]]+)/g;
  let match;
  while ((match = pattern.exec(pointer)) !== null) {
    const segment = match[1] ?? match[2] ?? match[3] ?? match[4];
    if (segment !== undefined && segment !== '') segments.push(segment);
  }
  return segments;
}

function applyToText(text, fix) {
  // `to` が `from` を含む (末尾へ注記を足すなど) 場合、適用済み判定を先に行わないと二重適用になる。
  // 削除 (`to` が空) のときは常に含まれてしまうので、`from` の有無だけで判断する。
  if (fix.to !== '' && text.includes(fix.to)) return { status: 'already', text };
  const occurrences = text.split(fix.from).length - 1;
  if (occurrences === 0) return { status: text.includes(fix.to) ? 'already' : 'missing', text };
  if (occurrences > 1 && fix.allowMultiple !== true) {
    return { status: 'ambiguous', text, occurrences };
  }
  return { status: 'applied', text: text.split(fix.from).join(fix.to), occurrences };
}

function main() {
  const counters = { applied: 0, already: 0, missing: 0, ambiguous: 0 };
  const problems = [];
  const touched = new Set();

  // ---- Markdown / テキストファイルへの置換
  const textFixes = new Map();
  for (const fix of config.fixes) {
    if (fix.json) continue;
    const list = textFixes.get(fix.file) ?? [];
    list.push(fix);
    textFixes.set(fix.file, list);
  }
  for (const [file, fixes] of textFixes) {
    const absolute = path.join(root, file);
    const before = fs.readFileSync(absolute, 'utf8');
    let text = before;
    for (const fix of fixes) {
      const result = applyToText(text, fix);
      text = result.text;
      counters[result.status] += 1;
      if (result.status === 'missing') problems.push(`[missing] ${file} :: ${fix.id}`);
      if (result.status === 'ambiguous') {
        problems.push(`[ambiguous ${result.occurrences}] ${file} :: ${fix.id}`);
      }
      if (verbose && result.status === 'applied') console.log(`  applied ${fix.id} (${file})`);
    }
    if (text !== before) {
      touched.add(file);
      if (!checkOnly) fs.writeFileSync(absolute, text);
    }
  }

  // ---- JSON 正本への置換 (演習カードなど生成物の元)
  const jsonFixes = new Map();
  for (const fix of config.fixes) {
    if (!fix.json) continue;
    const list = jsonFixes.get(fix.file) ?? [];
    list.push(fix);
    jsonFixes.set(fix.file, list);
  }
  for (const [file, fixes] of jsonFixes) {
    const absolute = path.join(root, file);
    const before = fs.readFileSync(absolute, 'utf8');
    const document = JSON.parse(before);
    for (const fix of fixes) {
      if (fix.set !== undefined) {
        // 値の差し替え (services の是正など)
        const segments = parsePath(fix.path);
        const key = segments.pop();
        const parent = getByPath(document, segments);
        if (parent === undefined) {
          counters.missing += 1;
          problems.push(`[missing path] ${file} :: ${fix.id} (${fix.path})`);
          continue;
        }
        const current = JSON.stringify(parent[key]);
        if (current === JSON.stringify(fix.set)) {
          counters.already += 1;
          continue;
        }
        if (fix.expect !== undefined && current !== JSON.stringify(fix.expect)) {
          counters.missing += 1;
          problems.push(`[unexpected] ${file} :: ${fix.id} 現在値 ${current}`);
          continue;
        }
        parent[key] = fix.set;
        counters.applied += 1;
        if (verbose) console.log(`  set ${fix.id} (${fix.path})`);
        continue;
      }
      // 文字列置換 (JSON 全体を対象にした素朴な走査)
      // `to` が `from` を含む場合 (末尾へ注記を足すなど)、適用済み判定を先に行わないと
      // 実行のたびに追記が重なる。テキスト側と同じ順序で判定する。
      if (fix.to !== '' && JSON.stringify(document).includes(JSON.stringify(fix.to).slice(1, -1))) {
        counters.already += 1;
        continue;
      }
      const walk = node => {
        if (typeof node === 'string') {
          if (!node.includes(fix.from)) return { value: node, hit: 0 };
          return { value: node.split(fix.from).join(fix.to), hit: node.split(fix.from).length - 1 };
        }
        if (Array.isArray(node)) {
          let hit = 0;
          const value = node.map(item => {
            const result = walk(item);
            hit += result.hit;
            return result.value;
          });
          return { value, hit };
        }
        if (node && typeof node === 'object') {
          let hit = 0;
          const value = {};
          for (const [key, item] of Object.entries(node)) {
            const result = walk(item);
            hit += result.hit;
            value[key] = result.value;
          }
          return { value, hit };
        }
        return { value: node, hit: 0 };
      };
      const result = walk(document);
      if (result.hit === 0) {
        counters[JSON.stringify(document).includes(fix.to) ? 'already' : 'missing'] += 1;
        if (!JSON.stringify(document).includes(fix.to)) problems.push(`[missing] ${file} :: ${fix.id}`);
        continue;
      }
      if (result.hit > 1 && fix.allowMultiple !== true) {
        counters.ambiguous += 1;
        problems.push(`[ambiguous ${result.hit}] ${file} :: ${fix.id}`);
        continue;
      }
      for (const key of Object.keys(document)) delete document[key];
      Object.assign(document, result.value);
      counters.applied += 1;
      if (verbose) console.log(`  applied ${fix.id} (${file})`);
    }
    const after = `${JSON.stringify(document, null, 2)}\n`;
    if (after !== before) {
      touched.add(file);
      if (!checkOnly) fs.writeFileSync(absolute, after);
    }
  }

  console.log('Editorial fixes');
  console.log(`- fixes in manifest: ${config.fixes.length}`);
  console.log(`- applied: ${counters.applied}`);
  console.log(`- already applied: ${counters.already}`);
  console.log(`- not found: ${counters.missing}`);
  console.log(`- ambiguous: ${counters.ambiguous}`);
  console.log(`- changed files: ${touched.size}`);
  for (const file of touched) console.log(`  ${file}`);
  for (const problem of problems) console.log(`  ! ${problem}`);
  if (counters.missing > 0 || counters.ambiguous > 0) process.exitCode = 1;
  if (checkOnly && touched.size > 0) {
    console.log('config/editorial-fixes.json の内容が本文へ反映されていない。');
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
