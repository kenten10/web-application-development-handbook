#!/usr/bin/env bash
set -euo pipefail
command_name="${1:-plan}"
resources_file="${2:-resources.json}"
node --input-type=module - "$command_name" "$resources_file" <<'NODE'
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const [command, resourcesPath] = process.argv.slice(2);
if (!['plan','apply'].includes(command)) throw new Error('usage: main.sh plan|apply [resources.json]');
const statePath = '.terraform.state.json';
const desired = JSON.parse(fs.readFileSync(resourcesPath,'utf8'));
const oldState = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath,'utf8')) : { files: [], directories: [] };
const desiredFiles = new Map((desired.files ?? []).map(x => [x.name, x.content]));
const oldFiles = new Map((oldState.files ?? []).map(x => [x.name, x.content]));
const desiredDirs = new Set((desired.directories ?? []).map(x => x.name));
const oldDirs = new Set((oldState.directories ?? []).map(x => x.name));
const changes=[];
for (const [name,content] of desiredFiles) {
  if (!fs.existsSync(name)) changes.push({op:'create-file',name,content});
  else if (fs.readFileSync(name,'utf8') !== content) changes.push({op:'update-file',name,content,old:fs.readFileSync(name,'utf8')});
}
for (const name of oldFiles.keys()) if (!desiredFiles.has(name) && fs.existsSync(name)) changes.push({op:'delete-file',name});
for (const name of desiredDirs) if (!fs.existsSync(name)) changes.push({op:'create-dir',name});
for (const name of oldDirs) if (!desiredDirs.has(name) && fs.existsSync(name)) changes.push({op:'delete-dir',name});
const render=(c)=>({
 'create-file':`+ create file:    ${c.name}`,'update-file':`~ update file:    ${c.name}`,
 'delete-file':`- delete file:    ${c.name}`,'create-dir':`+ create dir:     ${c.name}`,'delete-dir':`- delete dir:     ${c.name}`
}[c.op]);
if (command === 'plan') {
  if (!changes.length) console.log('No changes. Infrastructure is up-to-date.');
  for (const c of changes) { console.log(render(c)); if(c.op==='update-file'){console.log(`  - ${JSON.stringify(c.old)}`);console.log(`  + ${JSON.stringify(c.content)}`);} }
  process.exit(0);
}
let createdFiles=0,updatedFiles=0,deletedFiles=0,createdDirs=0,deletedDirs=0;
for (const c of changes) {
  if(c.op==='create-file'||c.op==='update-file'){fs.mkdirSync(path.dirname(c.name),{recursive:true});fs.writeFileSync(c.name,c.content); c.op==='create-file'?createdFiles++:updatedFiles++;}
  if(c.op==='delete-file'){fs.rmSync(c.name,{force:true});deletedFiles++;}
  if(c.op==='create-dir'){fs.mkdirSync(c.name,{recursive:true});createdDirs++;}
  if(c.op==='delete-dir'){fs.rmSync(c.name,{recursive:true,force:true});deletedDirs++;}
}
const state={...desired,appliedAt:new Date().toISOString(),fingerprint:crypto.createHash('sha256').update(JSON.stringify(desired)).digest('hex')};
fs.writeFileSync(statePath,JSON.stringify(state,null,2)+'\n');
console.log(`Created ${createdFiles} files, ${createdDirs} directories; updated ${updatedFiles}; deleted ${deletedFiles} files, ${deletedDirs} directories.`);
console.log(`State saved to ${statePath}`);
NODE
