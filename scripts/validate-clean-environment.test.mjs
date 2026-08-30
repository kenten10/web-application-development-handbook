import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));

test('clean environment plan is structurally valid', () => {
  const result = spawnSync(process.execPath,['scripts/validate-clean-environment.mjs'],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr || result.stdout);
});

test('all 143 exercises have evidence and safety records', () => {
  const plan = JSON.parse(fs.readFileSync(path.join(root,'config/clean-environment-plan.json'),'utf8'));
  assert.equal(plan.exercises.length,143);
  assert.equal(new Set(plan.exercises.map((exercise) => exercise.id)).size,143);
  for (const exercise of plan.exercises) {
    assert.ok(exercise.requiredEvidence.length >= 2, exercise.id);
    assert.ok(exercise.safety, exercise.id);
  }
});

test('manual and external exercises cannot silently pass as local automated', () => {
  const plan = JSON.parse(fs.readFileSync(path.join(root,'config/clean-environment-plan.json'),'utf8'));
  assert.equal(plan.counts['browser-manual'],6);
  assert.equal(plan.counts['external-service'],17);
  assert.equal(plan.counts['local-tls'],7);
  assert.equal(plan.counts['local-automated'],113);
});
