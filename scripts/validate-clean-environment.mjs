#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const runtime = process.argv.includes('--runtime');
const errors = [];
const readJson = (file) => JSON.parse(readFileSync(join(root, file), 'utf8'));
const manifest = readJson('config/exercises.json');
const plan = readJson('config/clean-environment-plan.json');
const expectedIds = new Set(Object.values(manifest.chapters).flatMap((chapter) => chapter.exercises.map((exercise) => exercise.id)));
const actualIds = new Set(plan.exercises.map((exercise) => exercise.id));

if (plan.schemaVersion !== 1) errors.push('clean environment plan schemaVersionは1にしてください。');
if (expectedIds.size !== 143) errors.push(`演習正本は143件である必要があります。現在: ${expectedIds.size}`);
if (actualIds.size !== expectedIds.size) errors.push(`検証台帳の件数が一致しません: ${actualIds.size}/${expectedIds.size}`);
for (const id of expectedIds) if (!actualIds.has(id)) errors.push(`検証台帳に演習${id}がありません。`);
for (const exercise of plan.exercises) {
  if (!['local-automated','local-tls','browser-manual','external-service'].includes(exercise.category)) errors.push(`${exercise.id}: categoryが不正です。`);
  if (!exercise.requiredEvidence?.length) errors.push(`${exercise.id}: requiredEvidenceがありません。`);
  if (!exercise.safety) errors.push(`${exercise.id}: safetyがありません。`);
}
for (const file of ['.devcontainer/Dockerfile','.devcontainer/docker-compose.yml','.devcontainer/devcontainer.json','scripts/bootstrap-clean-environment.sh','CLEAN_ENVIRONMENT.md']) {
  if (!existsSync(join(root,file))) errors.push(`${file}がありません。`);
}
const dockerfile = readFileSync(join(root,'.devcontainer/Dockerfile'),'utf8');
if (!dockerfile.includes('node:24.18.0-bookworm-slim')) errors.push('devcontainerのNode.jsイメージが24.18.0で固定されていません。');
if (!dockerfile.includes('pnpm@11.15.1')) errors.push('devcontainerのpnpmが11.15.1で固定されていません。');
const compose = readFileSync(join(root,'.devcontainer/docker-compose.yml'),'utf8');
if (!compose.includes('postgres:18-alpine')) errors.push('devcontainerにPostgreSQL 18 serviceがありません。');
if (!compose.includes('redis:8-alpine')) errors.push('devcontainerにRedis 8 serviceがありません。');
try {
  const devcontainer = JSON.parse(readFileSync(join(root,'.devcontainer/devcontainer.json'),'utf8'));
  for (const port of [3000,3443,5432,6379,8080]) if (!devcontainer.forwardPorts?.includes(port)) errors.push(`devcontainer forwardPortsに${port}がありません。`);
} catch (error) { errors.push(`devcontainer.jsonを解析できません: ${error.message}`); }
const categoryTotal = Object.values(plan.counts).reduce((sum, value) => sum + value, 0);
if (categoryTotal !== 143) errors.push(`カテゴリ集計が143件ではありません: ${categoryTotal}`);

if (runtime) {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major !== 24 || minor < 18) errors.push(`Node.js 24.18.0以上24.xが必要です。現在: ${process.version}`);
  let pnpm = 'unavailable';
  try { pnpm = execFileSync('pnpm',['--version'],{encoding:'utf8'}).trim(); } catch {}
  if (pnpm !== '11.15.1') errors.push(`pnpm 11.15.1が必要です。現在: ${pnpm}`);
  if (!existsSync(join(root,'pnpm-lock.yaml'))) errors.push('pnpm-lock.yamlがありません。');
}

console.log(`Clean environment exercises: ${actualIds.size}`);
for (const [category,count] of Object.entries(plan.counts)) console.log(`${category}: ${count}`);
console.log(`Mode: ${runtime ? 'runtime' : 'structure'}`);
for (const error of errors) console.error(`ERROR: ${error}`);
if (errors.length) process.exit(1);
console.log('Clean environment validation passed.');
