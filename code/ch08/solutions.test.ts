import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
// @ts-expect-error educational .mjs module has no declaration file
import { bundle } from './my-bundler/solution/bundler.mjs';
// @ts-expect-error educational .mjs module has no declaration file
import { shake } from './tree-shaking/solution/shake.mjs';
import { createClientScript, startHmrServer } from './mini-hmr/solution/main.js';
import { createRouteLoader } from './code-splitting/solution/main.js';

test('minimal bundler builds dependency graph and executable bundle', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bundler-'));
  fs.writeFileSync(path.join(dir, 'dep.js'), 'export const answer = 42;');
  fs.writeFileSync(path.join(dir, 'entry.js'), "import { answer } from './dep.js'; globalThis.__bundleAnswer = answer;");
  const outfile = path.join(dir, 'bundle.js');
  const result = bundle(path.join(dir, 'entry.js'), outfile);
  assert.equal(result.modules, 2);
  await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);
  assert.equal((globalThis as { __bundleAnswer?: number }).__bundleAnswer, 42);
});

test('tree shaker removes unused exported functions', () => {
  const output = shake('export function used(){return 1}\nexport function dead(){return 2}\n', ['used']);
  assert.match(output, /function used/);
  assert.doesNotMatch(output, /function dead/);
});

test('HMR server serves module and client avoids full reload', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hmr-'));
  const moduleFile = path.join(dir, 'module.js');
  fs.writeFileSync(moduleFile, 'export function render(){ return 42 }');
  const running = await startHmrServer(moduleFile);
  try {
    const source = await fetch(`http://127.0.0.1:${running.port}/module.js`).then((response) => response.text());
    assert.match(source, /return 42/);
    assert.match(createClientScript(), /EventSource/);
    assert.doesNotMatch(createClientScript(), /location\.reload/);
  } finally { await running.close(); }
});

test('code splitting loader loads once and caches chunk', async () => {
  let calls = 0;
  const load = createRouteLoader({ '/admin': async () => { calls += 1; return { render: () => 'admin' }; } });
  const [a, b] = await Promise.all([load('/admin'), load('/admin')]);
  assert.equal(a.render(), 'admin'); assert.equal(b.render(), 'admin'); assert.equal(calls, 1);
});

import { pathToFileURL } from 'node:url';
