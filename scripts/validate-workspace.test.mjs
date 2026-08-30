import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

function run(script, args = []) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: 'utf8',
  });
}

test('workspace structure and pinned versions are valid', () => {
  const result = run('scripts/validate-workspace.mjs', ['--structure-only']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Workspace validation passed/);
  assert.match(result.stdout, /Workspace packages: 30/);
});

test('lint is scheduled for all chapter packages', () => {
  const result = run('scripts/run-workspace-task.mjs', ['lint', '--dry-run']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /executed=30/);
  assert.match(result.stdout, /skipped=0/);
});

test('typecheck is scheduled for the chapter package', () => {
  const result = run('scripts/run-workspace-task.mjs', ['typecheck', '--dry-run']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /pnpm --filter @handbook\/ch07 run typecheck/);
  assert.match(result.stdout, /executed=30/);
});

test('unknown workspace tasks are rejected', () => {
  const result = run('scripts/run-workspace-task.mjs', ['deploy', '--dry-run']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage:/);
});
