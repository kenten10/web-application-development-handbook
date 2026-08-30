import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findArtifacts } from './clean-build-artifacts.mjs';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clean-artifacts-'));
  fs.mkdirSync(path.join(root, 'code', 'ch01', 'dist'), { recursive: true });
  fs.mkdirSync(path.join(root, 'code', 'ch02', 'coverage'), { recursive: true });
  fs.mkdirSync(path.join(root, 'code', 'ch03'), { recursive: true });
  fs.mkdirSync(path.join(root, 'code', 'notachapter', 'dist'), { recursive: true });
  return root;
}

test('finds dist and coverage under chapter directories only', () => {
  const root = fixture();
  const found = findArtifacts(path.join(root, 'code')).map(p => path.relative(root, p));
  assert.deepEqual(found, [path.join('code', 'ch01', 'dist'), path.join('code', 'ch02', 'coverage')]);
  fs.rmSync(root, { recursive: true, force: true });
});

test('returns nothing when the code directory is absent', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clean-artifacts-empty-'));
  assert.deepEqual(findArtifacts(path.join(root, 'code')), []);
  fs.rmSync(root, { recursive: true, force: true });
});

test('is idempotent: a cleaned tree reports no artifacts', () => {
  const root = fixture();
  for (const target of findArtifacts(path.join(root, 'code'))) fs.rmSync(target, { recursive: true, force: true });
  assert.deepEqual(findArtifacts(path.join(root, 'code')), []);
  fs.rmSync(root, { recursive: true, force: true });
});
