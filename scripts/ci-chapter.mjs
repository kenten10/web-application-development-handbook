#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const plan = JSON.parse(readFileSync(join(root, 'config/ci-plan.json'), 'utf8'));
const chapter = process.argv[2];
const tasks = process.argv.slice(3).filter((value) => !value.startsWith('--'));
const selectedTasks = tasks.length > 0 ? tasks : plan.required.tasks;
const dryRun = process.argv.includes('--dry-run');

function countJavaScriptFiles(directory) {
  if (!existsSync(directory)) return 0;
  let count = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) count += countJavaScriptFiles(path);
    else if (/\.(?:c|m)?js$/.test(entry.name)) count += 1;
  }
  return count;
}

if (!plan.required.chapters.includes(chapter)) {
  console.error(`Usage: node scripts/ci-chapter.mjs <${plan.required.chapters.join('|')}> [task ...]`);
  process.exit(2);
}

const packagePath = join(root, 'code', chapter, 'package.json');
if (!existsSync(packagePath)) {
  console.error(`::error title=${chapter} package missing::code/${chapter}/package.json がありません。`);
  process.exit(1);
}

const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
const failures = [];

for (const task of selectedTasks) {
  if (!plan.required.tasks.includes(task)) {
    failures.push({ task, reason: 'CI計画で許可されていないタスクです。' });
    continue;
  }
  if (!packageJson.scripts?.[task]) {
    failures.push({ task, reason: 'package.jsonにスクリプトがありません。' });
    continue;
  }

  console.log(`::group::${chapter} / ${task}`);
  console.log(`[${chapter}] pnpm --filter ${packageJson.name} run ${task}`);
  if (!dryRun) {
    const distPath = join(root, 'code', chapter, 'dist');
    if (task === 'build') rmSync(distPath, { recursive: true, force: true });
    const result = spawnSync('pnpm', ['--filter', packageJson.name, 'run', task], {
      cwd: root,
      env: process.env,
      stdio: 'inherit',
    });
    if (result.status !== 0) {
      failures.push({ task, reason: `exit=${result.status ?? 'signal'}` });
    } else if (task === 'build' && countJavaScriptFiles(distPath) === 0) {
      failures.push({ task, reason: 'distにJavaScript成果物が生成されませんでした。tsconfigのnoEmit設定を確認してください。' });
    }
  }
  console.log('::endgroup::');
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`::error title=${chapter} / ${failure.task} failed::${failure.reason}`);
  }
  console.error(`[${chapter}] ${failures.length} task(s) failed.`);
  process.exit(1);
}

console.log(`[${chapter}] ${selectedTasks.length} task(s) passed.`);
