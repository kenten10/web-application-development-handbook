#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const errors = [];
const warnings = [];
const read = (path) => readFileSync(join(root, path), 'utf8');
const plan = JSON.parse(read('config/ci-plan.json'));
const exercises = JSON.parse(read('config/exercises.json'));
const baseTsconfig = JSON.parse(read('tsconfig.base.json'));
const requiredWorkflow = read(plan.policy.requiredWorkflow);
const extendedWorkflow = read(plan.policy.extendedWorkflow);


if (baseTsconfig.compilerOptions?.noEmit === true) {
  errors.push('tsconfig.base.jsonのnoEmit: trueはbuildを無効化します。typecheck側で--noEmitを指定してください。');
}

const chapterDirs = readdirSync(join(root, 'code'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /^ch\d{2}$/.test(entry.name))
  .map((entry) => entry.name)
  .sort();

if (JSON.stringify(chapterDirs) !== JSON.stringify([...plan.required.chapters].sort())) {
  errors.push('required.chaptersがcode/chXXの全章と一致しません。');
}
if (new Set(plan.required.chapters).size !== plan.required.chapters.length) {
  errors.push('required.chaptersに重複があります。');
}
for (const chapter of plan.required.chapters) {
  const packagePath = `code/${chapter}/package.json`;
  if (!existsSync(join(root, packagePath))) {
    errors.push(`${packagePath}がありません。`);
    continue;
  }
  const packageJson = JSON.parse(read(packagePath));
  const chapterTsconfigPath = `code/${chapter}/tsconfig.json`;
  if (!existsSync(join(root, chapterTsconfigPath))) {
    errors.push(`${chapterTsconfigPath}がありません。`);
  } else {
    const chapterTsconfig = JSON.parse(read(chapterTsconfigPath));
    if (chapterTsconfig.compilerOptions?.noEmit === true) {
      errors.push(`${chapterTsconfigPath}: noEmit: trueはbuildを無効化します。`);
    }
  }
  for (const task of plan.required.tasks) {
    if (!packageJson.scripts?.[task]) errors.push(`${packagePath}: ${task}がありません。`);
  }
  if (!requiredWorkflow.includes(`- ${chapter}`)) {
    errors.push(`${plan.policy.requiredWorkflow}: matrixに${chapter}がありません。`);
  }
}

for (const task of ['lint', 'typecheck', 'test', 'build']) {
  if (!plan.required.tasks.includes(task)) errors.push(`required.tasksに${task}がありません。`);
}

const actionPins = new Map([
  ['actions/checkout', '3d3c42e5aac5ba805825da76410c181273ba90b1'],
  ['actions/setup-node', '820762786026740c76f36085b0efc47a31fe5020'],
  ['actions/cache', '27d5ce7f107fe9357f9df03efb73ab90386fccae'],
]);
for (const [workflowPath, workflow] of [
  [plan.policy.requiredWorkflow, requiredWorkflow],
  [plan.policy.extendedWorkflow, extendedWorkflow],
]) {
  const uses = [...workflow.matchAll(/^\s*uses:\s*(actions\/(?:checkout|setup-node|cache))@([^\s#]+)/gm)];
  const requiredActions = workflowPath === plan.policy.requiredWorkflow
    ? ['actions/checkout', 'actions/setup-node', 'actions/cache']
    : ['actions/checkout', 'actions/setup-node'];
  for (const action of requiredActions) {
    if (!uses.some((match) => match[1] === action)) {
      errors.push(`${workflowPath}: ${action}がありません。`);
    }
  }
  for (const match of uses) {
    const action = match[1];
    const ref = match[2];
    const expectedRef = actionPins.get(action);
    if (ref !== expectedRef) {
      errors.push(`${workflowPath}: ${action}@${ref}は固定SHA ${expectedRef}ではありません。`);
    }
  }
  if (!/^permissions:\n  contents: read/m.test(workflow)) {
    errors.push(`${workflowPath}: permissionsがcontents: readに限定されていません。`);
  }
}

for (const token of ['pull_request:', 'push:', 'branches: [main]', 'strategy:', 'fail-fast: false', 'max-parallel: 6', 'pnpm store path --silent', 'actions/cache@27d5ce7f107fe9357f9df03efb73ab90386fccae']) {
  if (!requiredWorkflow.includes(token)) errors.push(`required workflowに${token}がありません。`);
}
for (const token of ['postgres:18-alpine', 'redis:8-alpine', 'ci-service-smoke.mjs']) {
  if (!requiredWorkflow.includes(token)) errors.push(`required workflowにservice設定 ${token} がありません。`);
}
for (const token of ['workflow_dispatch:', 'schedule:', 'ci-extended-checks.mjs inventory', 'ci-extended-checks.mjs shell-syntax']) {
  if (!extendedWorkflow.includes(token)) errors.push(`extended workflowに${token}がありません。`);
}

const knownServices = new Set(['なし', 'localhost', 'SQLite', 'PostgreSQL', 'Redis', 'Docker', 'Linux', 'AWS', 'Kafka', 'Kubernetes', 'OpenSSL/TLS', 'Chrome']);
for (const [chapter, detail] of Object.entries(exercises.chapters)) {
  for (const exercise of detail.exercises ?? []) {
    for (const service of exercise.services ?? []) {
      if (!knownServices.has(service)) warnings.push(`${chapter}/${exercise.id}: 未分類サービス ${service}`);
    }
  }
}

console.log(`CI chapters: ${plan.required.chapters.length}`);
console.log(`Required tasks: ${plan.required.tasks.join(', ')}`);
console.log(`Service containers: ${Object.keys(plan.serviceContainers).join(', ')}`);
for (const warning of warnings) console.warn(`WARN: ${warning}`);
for (const error of errors) console.error(`ERROR: ${error}`);
if (errors.length > 0) {
  console.error(`CI validation failed: ${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(1);
}
console.log(`CI validation passed: ${warnings.length} warning(s)`);
