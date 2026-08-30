#!/usr/bin/env node
// KEN-61: ビルド成果物 (code/chXX/dist、coverage) を削除する。
//
// なぜ必要か: `pnpm run build` は各章へ dist/ を作るが、`scripts/validate-exercises.mjs` は
// 教材ツリーに成果物が残っていることを FORBIDDEN_ARTIFACT として失敗させる。
// bootstrap-clean-environment.sh は build まで実行するため、後始末をしないと
// 演習カードの自己採点手順 `pnpm --filter @handbook/chXX run test` が必ず失敗する。
//
// 冪等性: 対象が無ければ何もしない。何度実行しても同じ状態になる。
// 使い方: node scripts/clean-build-artifacts.mjs [--root <dir>] [--check]
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootArg = process.argv.indexOf('--root');
const root = path.resolve(rootArg >= 0 ? process.argv[rootArg + 1] : process.cwd());
const checkOnly = process.argv.includes('--check');

const ARTIFACTS = ['dist', 'coverage'];

export function findArtifacts(codeDir) {
  if (!fs.existsSync(codeDir)) return [];
  const found = [];
  for (const entry of fs.readdirSync(codeDir).sort()) {
    if (!/^ch\d{2}$/.test(entry)) continue;
    for (const artifact of ARTIFACTS) {
      const target = path.join(codeDir, entry, artifact);
      if (fs.existsSync(target)) found.push(target);
    }
  }
  return found;
}

function main() {
  const codeDir = path.join(root, 'code');
  const targets = findArtifacts(codeDir);
  for (const target of targets) {
    if (!checkOnly) fs.rmSync(target, { recursive: true, force: true });
    console.log(`${checkOnly ? 'found' : 'removed'} ${path.relative(root, target)}`);
  }
  console.log(`Build artifacts: ${targets.length}`);
  if (checkOnly && targets.length > 0) {
    console.log('ビルド成果物が残っている。node scripts/clean-build-artifacts.mjs で削除すること。');
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
