#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const plan = JSON.parse(readFileSync(join(root, 'config/ci-plan.json'), 'utf8'));
const exercises = JSON.parse(readFileSync(join(root, 'config/exercises.json'), 'utf8'));
const mode = process.argv[2] ?? 'inventory';

const allExercises = Object.values(exercises.chapters).flatMap((chapter) => chapter.exercises ?? []);

if (mode === 'inventory') {
  const manual = allExercises.filter((exercise) =>
    (exercise.services ?? []).some((service) => plan.extended.manualServices.includes(service)),
  );
  console.log(`Manual/external-service exercises: ${manual.length}`);
  for (const exercise of manual) {
    console.log(`- ${exercise.id}: ${(exercise.services ?? []).join(', ')} — ${exercise.title}`);
  }
  if (manual.length === 0) {
    console.error('::error title=manual inventory empty::手動・外部サービス演習が台帳化されていません。');
    process.exit(1);
  }
  process.exit(0);
}

if (mode === 'shell-syntax') {
  const files = new Set();
  for (const exercise of allExercises) {
    for (const path of [...(exercise.starter ?? []), ...(exercise.solution ?? [])]) {
      if (extname(path) === '.sh') files.add(path);
    }
  }
  let failed = 0;
  for (const relativePath of [...files].sort()) {
    const path = join(root, relativePath);
    if (!existsSync(path)) {
      console.error(`::error title=missing shell exercise::${relativePath}`);
      failed += 1;
      continue;
    }
    const result = spawnSync('bash', ['-n', path], { cwd: root, encoding: 'utf8' });
    if (result.status !== 0) {
      console.error(`::error file=${relativePath},title=shell syntax::${result.stderr.trim()}`);
      failed += 1;
    } else {
      console.log(`OK: ${relativePath}`);
    }
  }
  if (failed > 0) process.exit(1);
  console.log(`Shell syntax passed: ${files.size}`);
  process.exit(0);
}

console.error('Usage: node scripts/ci-extended-checks.mjs <inventory|shell-syntax>');
process.exit(2);
