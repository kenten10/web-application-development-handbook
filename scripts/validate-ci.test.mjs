import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');

function run(cwd) {
  return spawnSync(process.execPath, ['scripts/validate-ci.mjs'], { cwd, encoding: 'utf8' });
}

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'handbook-ci-'));
  for (const path of ['scripts', 'config', 'code', '.github']) cpSync(join(root, path), join(dir, path), { recursive: true });
  copyFileSync(join(root, 'tsconfig.base.json'), join(dir, 'tsconfig.base.json'));
  return dir;
}

test('current CI plan is valid', () => {
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
});

test('missing chapter in matrix is detected', () => {
  const dir = fixture();
  try {
    const path = join(dir, '.github/workflows/ci.yml');
    writeFileSync(path, readFileSync(path, 'utf8').replace('          - ch30\n', ''));
    const result = run(dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /matrixにch30/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('unpinned action is detected', () => {
  const dir = fixture();
  try {
    const path = join(dir, '.github/workflows/ci.yml');
    writeFileSync(path, readFileSync(path, 'utf8').replace('actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1', 'actions/checkout@v7'));
    const result = run(dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /固定SHA/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('unpinned cache action is detected', () => {
  const dir = fixture();
  try {
    const path = join(dir, '.github/workflows/ci.yml');
    writeFileSync(path, readFileSync(path, 'utf8').replace('actions/cache@27d5ce7f107fe9357f9df03efb73ab90386fccae', 'actions/cache@v5'));
    const result = run(dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /actions\/cache@v5/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('noEmit build configuration is detected', () => {
  const dir = fixture();
  try {
    const path = join(dir, 'code/ch01/tsconfig.json');
    const tsconfig = JSON.parse(readFileSync(path, 'utf8'));
    tsconfig.compilerOptions.noEmit = true;
    writeFileSync(path, `${JSON.stringify(tsconfig, null, 2)}
`);
    const result = run(dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /noEmit: true/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('missing chapter task is detected', () => {
  const dir = fixture();
  try {
    const path = join(dir, 'code/ch01/package.json');
    const packageJson = JSON.parse(readFileSync(path, 'utf8'));
    delete packageJson.scripts.build;
    writeFileSync(path, `${JSON.stringify(packageJson, null, 2)}\n`);
    const result = run(dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /buildがありません/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
