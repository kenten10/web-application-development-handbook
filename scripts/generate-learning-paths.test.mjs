import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));
const run = (cwd, args = ['--check']) => spawnSync(process.execPath, ['scripts/generate-learning-paths.mjs', ...args], { cwd, encoding: 'utf8' });

function copyFixture() {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'handbook-learning-paths-'));
  fs.mkdirSync(path.join(target, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(target, 'config'), { recursive: true });
  for (const file of [
    '02-part1-foundations.md','03-part2-frontend.md','04-part3-backend.md',
    '05-part4-data.md','06-part5-infrastructure.md','07-part6-quality.md','08-part7-practice.md',
    'LEARNING_PATHS.md',
  ]) fs.copyFileSync(path.join(root, file), path.join(target, file));
  for (const file of ['learning-levels.json','learning-paths.json']) {
    fs.copyFileSync(path.join(root, 'config', file), path.join(target, 'config', file));
  }
  fs.copyFileSync(path.join(root, 'scripts/generate-learning-paths.mjs'), path.join(target, 'scripts/generate-learning-paths.mjs'));
  return target;
}

test('generated learning paths are current', () => {
  const result = run(root);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('six routes and the standard 24-hour route are exposed', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'config/learning-paths.json'), 'utf8'));
  assert.equal(manifest.routes.length, 6);
  assert.deepEqual(manifest.routes.map(route => route.id), ['standard','frontend','backend-db','infra-sre','security','tech-lead']);
  const guide = fs.readFileSync(path.join(root, 'LEARNING_PATHS.md'), 'utf8');
  assert.match(guide, /標準通読[^\n]*199[^\n]*24時間5分/);
  assert.match(guide, /途中参加チェック/);
});


test('front matter and generated TOC link to every route', () => {
  const front = fs.readFileSync(path.join(root, '00-front-matter.md'), 'utf8');
  const toc = fs.readFileSync(path.join(root, '01-toc.md'), 'utf8');
  assert.match(toc, /\[学習ルート\]\(LEARNING_PATHS\.md\)/);
  for (const id of ['standard','frontend','backend-db','infra-sre','security','tech-lead']) {
    assert.match(front, new RegExp(`LEARNING_PATHS\.md#route-${id}`));
  }
});

test('unknown section references fail generation', () => {
  const fixture = copyFixture();
  const file = path.join(fixture, 'config/learning-paths.json');
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  manifest.routes[0].stages[0].selectors.push({ sections: ['99.99'] });
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2));
  const result = run(fixture, []);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unknown section 99\.99/);
});

test('check mode detects generated document drift', () => {
  const fixture = copyFixture();
  fs.appendFileSync(path.join(fixture, 'LEARNING_PATHS.md'), '\nmanual edit\n');
  const result = run(fixture);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /out of date/);
});
