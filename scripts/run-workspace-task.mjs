#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const allowedTasks = new Set(['lint', 'typecheck', 'test', 'build']);
const task = process.argv[2];
const dryRun = process.argv.includes('--dry-run');
if (!allowedTasks.has(task)) {
  console.error(`Usage: node scripts/run-workspace-task.mjs <${[...allowedTasks].join('|')}>`);
  process.exit(2);
}

const root = resolve(import.meta.dirname, '..');
const codeRoot = join(root, 'code');
const exceptions = JSON.parse(readFileSync(join(root, 'config/workspace-exceptions.json'), 'utf8'));
const packages = [];

for (const entry of readdirSync(codeRoot, { withFileTypes: true })) {
  if (!entry.isDirectory() || !/^ch\d{2}$/.test(entry.name)) continue;
  const packagePath = join(codeRoot, entry.name, 'package.json');
  if (!existsSync(packagePath)) continue;
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
  packages.push({ directory: entry.name, packageJson });
}
packages.sort((a, b) => a.directory.localeCompare(b.directory));

let executed = 0;
let skipped = 0;
let failed = 0;

for (const { directory, packageJson } of packages) {
  const packageName = packageJson.name;
  if (packageJson.scripts?.[task]) {
    console.log(`\n[${directory}] ${task}: ${packageJson.scripts[task]}`);
    if (dryRun) {
      console.log(`[${directory}] DRY RUN: pnpm --filter ${packageName} run ${task}`);
      executed += 1;
      continue;
    }
    const result = spawnSync('pnpm', ['--filter', packageName, 'run', task], {
      cwd: root,
      stdio: 'inherit',
      env: process.env,
    });
    executed += 1;
    if (result.status !== 0) failed += 1;
    continue;
  }

  const exception = exceptions.packages?.[packageName]?.[task];
  if (exception) {
    console.log(`[${directory}] SKIP ${task}: ${exception.issue} — ${exception.reason}`);
    skipped += 1;
    continue;
  }

  console.error(`[${directory}] ERROR: ${task} scriptがなく、例外登録もありません。`);
  failed += 1;
}

console.log(`\nWorkspace ${task}: executed=${executed}, skipped=${skipped}, failed=${failed}`);
if (failed > 0) process.exit(1);
