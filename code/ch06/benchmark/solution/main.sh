#!/usr/bin/env bash
set -euo pipefail

node --input-type=module <<'JS'
import { performance } from 'node:perf_hooks';
const rounds = 50_000;
const strategies = {
  'mutable-array': () => { const list=[]; for(let i=0;i<rounds;i++) list.push(i); return list.length; },
  'immutable-copy': () => { let list=[]; for(let i=0;i<2_000;i++) list=[...list,i]; return list.length; },
  'signal-style': () => { let value=0; const listeners=[()=>{}]; for(let i=0;i<rounds;i++){ value=i; for(const l of listeners) l(value); } return value; },
};
for (const [name, run] of Object.entries(strategies)) {
  const start=performance.now(); const result=run(); const ms=performance.now()-start;
  console.log(`${name.padEnd(16)} ${ms.toFixed(2)} ms result=${result}`);
}
console.log('Compare algorithmic work, not framework marketing claims. Browser DOM costs require a separate benchmark.');
JS
