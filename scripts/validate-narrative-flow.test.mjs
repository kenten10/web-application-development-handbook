import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const validator = path.join(root, 'scripts', 'validate-narrative-flow.mjs');

function run(cwd) {
  return spawnSync(process.execPath, [validator], { cwd, encoding: 'utf8' });
}

function copyFixture(prefix) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const dir = path.join(parent, 'repo');
  fs.cpSync(root, dir, {
    recursive: true,
    filter: (src) => !src.includes(`${path.sep}node_modules${path.sep}`) && !src.includes(`${path.sep}dist${path.sep}`)
  });
  return dir;
}

test('current narrative manifest is valid', () => {
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /chapters=30/);
});

test('completed chapter without bridges is rejected', () => {
  const dir = copyFixture('narrative-flow-');
  const target = path.join(dir, '02-part1-foundations.md');
  const text = fs.readFileSync(target, 'utf8').replaceAll(
    '<!-- handbook:narrative-bridge {"section":"1.',
    '<!-- removed-narrative-bridge {"section":"1.'
  );
  fs.writeFileSync(target, text);
  const result = run(dir);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /NARRATIVE_BRIDGE_MISSING chapter=1/);
});

test('manifest must cover all 30 chapters', () => {
  const dir = copyFixture('narrative-flow-count-');
  const target = path.join(dir, 'config', 'narrative-flow.json');
  const data = JSON.parse(fs.readFileSync(target, 'utf8'));
  data.chapters.pop();
  fs.writeFileSync(target, JSON.stringify(data, null, 2));
  const result = run(dir);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /NARRATIVE_CHAPTER_COUNT/);
});
