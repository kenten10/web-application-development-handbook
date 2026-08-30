#!/usr/bin/env bash
set -euo pipefail
state="${CANARY_STATE:-.canary-state.json}"; cmd="${1:-status}"; value="${2:-0}"
node --input-type=module - "$state" "$cmd" "$value" <<'NODE'
import fs from 'node:fs';const [file,cmd,valueRaw]=process.argv.slice(2);let s=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{stableVersion:'v1',canaryVersion:'v2',canaryPercent:0,metrics:{stable:{requests:0,errors:0,totalLatency:0},canary:{requests:0,errors:0,totalLatency:0}}};const save=()=>fs.writeFileSync(file,JSON.stringify(s,null,2)+'\n');
const status=()=>console.log(`stable: ${100-s.canaryPercent}% / canary: ${s.canaryPercent}%`);
if(cmd==='start'||cmd==='status')status();else if(cmd==='shift'){const p=Number(valueRaw);if(!Number.isFinite(p)||p<0||p>100)throw new Error('shift must be 0..100');s.canaryPercent=p;save();status();}
else if(cmd==='route'){const n=Number(valueRaw);const target=(n%100)<s.canaryPercent?'canary':'stable';const m=s.metrics[target];m.requests++;m.totalLatency+=target==='canary'?45:40;save();console.log(target);}
else if(cmd==='record-error'){const target=valueRaw==='canary'?'canary':'stable';s.metrics[target].requests++;s.metrics[target].errors++;save();}
else if(cmd==='evaluate'){const c=s.metrics.canary;const rate=c.requests?c.errors/c.requests:0;if(rate>0.05){s.canaryPercent=0;save();console.log(`rollback: canary error rate ${(rate*100).toFixed(2)}%`);}else console.log(`healthy: canary error rate ${(rate*100).toFixed(2)}%`);}
else if(cmd==='promote'){s.stableVersion=s.canaryVersion;s.canaryPercent=0;s.metrics={stable:{requests:0,errors:0,totalLatency:0},canary:{requests:0,errors:0,totalLatency:0}};save();console.log('stable ← canary (100% traffic)');}else throw new Error('start|status|shift|route|record-error|evaluate|promote');
NODE
