import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));

test('generated files are current',()=>{
  const r=spawnSync(process.execPath,['scripts/generate-handbook.mjs','--check'],{cwd:root,encoding:'utf8'});
  assert.equal(r.status,0,r.stderr||r.stdout);
});
test('TOC contains explicit links, levels, and time estimates',()=>{
  const toc=fs.readFileSync(path.join(root,'01-toc.md'),'utf8');
  assert.match(toc,/\[第1章 .+\]\(02-part1-foundations\.md#chapter-1\) — 必修 45分 \/ 全体 3時間5分/);
  assert.match(toc,/\[1\.1 .+\]\(02-part1-foundations\.md#section-1-1\) — \*\*必修\*\* \/ 5分/);
  assert.match(toc,/\[学習レベルと推定時間\]\(LEARNING_LEVELS\.md\)/);
});
test('body contains explicit stable anchors and learning metadata',()=>{
  const body=fs.readFileSync(path.join(root,'02-part1-foundations.md'),'utf8');
  assert.match(body,/<a id="chapter-1"><\/a>\n## 第1章/);
  assert.match(body,/<a id="section-1-1"><\/a>\n### 1\.1[^\n]+\n<!-- handbook:learning \{"level":"required","minutes":5\} -->/);
});
test('index is generated from body metadata',()=>{
  const index=fs.readFileSync(path.join(root,'10-index.md'),'utf8');
  assert.match(index,/handbook:generated/);
  assert.match(index,/- HTTP\/3 — 2\.7/);
});
