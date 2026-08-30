#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const structureOnly = process.argv.includes('--structure-only');
const errors = [];
const warnings = [];

function readJson(relativePath) {
  const path = join(root, relativePath);
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    errors.push(`${relativePath}を読み込めません: ${error.message}`);
    return null;
  }
}

function versionTuple(value) {
  const match = String(value).match(/(\d+)\.(\d+)\.(\d+)/);
  return match ? match.slice(1).map(Number) : null;
}

function compareVersion(a, b) {
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

const rootPackage = readJson('package.json');
const exceptions = readJson('config/workspace-exceptions.json');
const workspacePath = join(root, 'pnpm-workspace.yaml');
const workspaceText = existsSync(workspacePath) ? readFileSync(workspacePath, 'utf8') : '';

if (!rootPackage) process.exit(1);

const expectedNode = [24, 18, 0];
const currentNode = versionTuple(process.version);
if (!structureOnly && (!currentNode || currentNode[0] !== 24 || compareVersion(currentNode, expectedNode) < 0)) {
  errors.push(`Node.js 24.18.0以上24.xが必要です。現在: ${process.version}`);
}

if (rootPackage.packageManager !== 'pnpm@11.15.1') {
  errors.push(`packageManagerはpnpm@11.15.1で固定してください。現在: ${rootPackage.packageManager ?? '未設定'}`);
}

let pnpmVersion = null;
if (!structureOnly) {
  try {
    pnpmVersion = execFileSync('pnpm', ['--version'], { encoding: 'utf8' }).trim();
  } catch (error) {
    errors.push(`pnpmを実行できません: ${error.message}`);
  }
  if (pnpmVersion && pnpmVersion !== '11.15.1') {
    errors.push(`pnpm 11.15.1が必要です。現在: ${pnpmVersion}`);
  }
}

if (!workspaceText.includes("'code/ch*'") && !workspaceText.includes('code/ch*')) {
  errors.push('pnpm-workspace.yamlにcode/ch*が含まれていません。');
}
if (!workspaceText.includes('typescript: 6.0.3')) {
  errors.push('pnpm catalogのTypeScriptを6.0.3で固定してください。');
}

for (const required of ['.node-version', '.nvmrc', 'tsconfig.base.json', 'CODE_TOOLCHAIN.md']) {
  if (!existsSync(join(root, required))) errors.push(`${required}がありません。`);
}

const codeRoot = join(root, 'code');
const packageDirs = existsSync(codeRoot)
  ? readdirSync(codeRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^ch\d{2}$/.test(entry.name))
      .map((entry) => entry.name)
      .sort()
  : [];

if (packageDirs.length === 0) {
  errors.push('code/chXX形式の章ディレクトリがありません。');
}

const packageNames = new Set();
for (const directory of packageDirs) {
  const relativePackagePath = `code/${directory}/package.json`;
  const packagePath = join(root, relativePackagePath);
  if (!existsSync(packagePath)) {
    warnings.push(`${relativePackagePath}がありません。コード追加時にKEN-54で整備します。`);
    continue;
  }

  const packageJson = readJson(relativePackagePath);
  if (!packageJson) continue;

  const expectedName = `@handbook/${directory}`;
  if (packageJson.name !== expectedName) {
    errors.push(`${relativePackagePath}: nameは${expectedName}にしてください。`);
  }
  if (packageJson.private !== true) {
    errors.push(`${relativePackagePath}: 教材パッケージはprivate: trueにしてください。`);
  }
  if (packageJson.engines?.node !== '>=24.18.0 <25') {
    errors.push(`${relativePackagePath}: engines.nodeを>=24.18.0 <25にしてください。`);
  }
  if (packageNames.has(packageJson.name)) {
    errors.push(`workspace package nameが重複しています: ${packageJson.name}`);
  }
  packageNames.add(packageJson.name);
}

const validTasks = new Set(['lint', 'typecheck', 'test', 'build']);
for (const [packageName, taskMap] of Object.entries(exceptions?.packages ?? {})) {
  if (!packageNames.has(packageName)) {
    errors.push(`workspace例外が存在しないpackageを参照しています: ${packageName}`);
  }
  for (const [task, detail] of Object.entries(taskMap)) {
    if (!validTasks.has(task)) errors.push(`${packageName}: 不明な例外タスク ${task}`);
    if (!detail?.issue || !detail?.reason) {
      errors.push(`${packageName}/${task}: issueとreasonが必要です。`);
    }
  }
}

console.log(`Workspace packages: ${packageNames.size}`);
console.log(`Mode: ${structureOnly ? 'structure-only' : 'full'}`);
console.log(`Node.js: ${process.version}`);
console.log(`pnpm: ${pnpmVersion ?? (structureOnly ? 'not checked' : 'unavailable')}`);

for (const warning of warnings) console.warn(`WARN: ${warning}`);
for (const error of errors) console.error(`ERROR: ${error}`);

if (errors.length > 0) {
  console.error(`Workspace validation failed: ${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(1);
}

console.log(`Workspace validation passed: ${warnings.length} warning(s)`);
