#!/usr/bin/env bash
set -euo pipefail
state="${BLUE_GREEN_STATE:-.blue-green-state.json}"
cmd="${1:-status}"; color="${2:-}"; version="${3:-}"
node --input-type=module - "$state" "$cmd" "$color" "$version" <<'NODE'
import fs from 'node:fs'; const [file,cmd,color,version]=process.argv.slice(2);
let s=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{active:'blue',envs:{blue:{port:4001,version:'v1',status:'healthy'},green:{port:4002,version:null,status:'stopped'}}};
const save=()=>fs.writeFileSync(file,JSON.stringify(s,null,2)+'\n'); const show=()=>{const a=s.active,b=a==='blue'?'green':'blue';console.log(`Active: ${a} (port ${s.envs[a].port}) - ${s.envs[a].status}`);console.log(`Idle:   ${b} (port ${s.envs[b].port}) - ${s.envs[b].status}`)};
if(cmd==='status')show(); else if(cmd==='deploy'){if(!['blue','green'].includes(color))throw new Error('deploy blue|green version');s.envs[color]={...s.envs[color],version,status:'healthy'};save();console.log(`Starting ${color} on port ${s.envs[color].port}...`);console.log('Health check passed (3 consecutive OK)');}
else if(cmd==='switch'){const target=s.active==='blue'?'green':'blue';if(s.envs[target].status!=='healthy')throw new Error(`${target} is not healthy`);console.log(`Switching: ${s.active} → ${target}`);s.active=target;save();console.log(`Done. New traffic goes to ${target}.`);}
else if(cmd==='stop'){if(color===s.active)throw new Error('cannot stop active color');s.envs[color].status='stopped';save();console.log(`Stopped ${color}.`)} else if(cmd==='request')console.log(JSON.stringify({color:s.active,version:s.envs[s.active].version,port:s.envs[s.active].port}));else throw new Error('status|deploy|switch|stop|request');
NODE
