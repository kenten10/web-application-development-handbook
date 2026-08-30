#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootArg = process.argv.indexOf('--root');
const root = path.resolve(rootArg >= 0 ? process.argv[rootArg + 1] : process.cwd());
const check = process.argv.includes('--check');
const migrate = process.argv.includes('--migrate-index');
const bodyFiles = [
  '02-part1-foundations.md','03-part2-frontend.md','04-part3-backend.md',
  '05-part4-data.md','06-part5-infrastructure.md','07-part6-quality.md','08-part7-practice.md',
];
const learningManifest = JSON.parse(fs.readFileSync(path.join(root, 'config/learning-levels.json'), 'utf8'));
const learningSections = learningManifest.sections;
const formatMinutes = minutes => {
  const hours = Math.floor(minutes / 60); const rest = minutes % 60;
  if (!hours) return `${rest}分`;
  if (!rest) return `${hours}時間`;
  return `${hours}時間${rest}分`;
};
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const write = (f, s) => fs.writeFileSync(path.join(root, f), s);
const normalize = s => s.replace(/\s+/g, ' ').trim();
const anchorFor = id => id.includes('.') ? `section-${id.replaceAll('.', '-')}` : `chapter-${id}`;

function scanBody() {
  const parts=[]; const chapters=[]; const sections=new Map();
  for (const file of bodyFiles) {
    const lines=read(file).split('\n'); let inFence=false; let currentPart=null;
    for (let i=0;i<lines.length;i++) {
      const line=lines[i]; if (/^```/.test(line.trim())) { inFence=!inFence; continue; } if(inFence) continue;
      const pm=line.match(/^#\s+(第[IVX]+部\s+.+)$/); if(pm){currentPart={title:normalize(pm[1]),file};parts.push(currentPart);continue;}
      const cm=line.match(/^##\s+第(\d+)章\s+(.+)$/); if(cm){chapters.push({number:+cm[1],title:normalize(cm[2]),file,part:currentPart});continue;}
      const sm=line.match(/^###\s+(\d+\.\d+)\s+(.+)$/); if(sm){sections.set(sm[1],{id:sm[1],title:normalize(sm[2]),file,line:i});}
    }
  }
  return {parts,chapters,sections};
}

function parseExistingIndex() {
  const lines=read('10-index.md').split('\n'); let group=null; const out=[];
  for(const line of lines){
    const gm=line.match(/^###\s+(.+)$/); if(gm){group=gm[1];continue;}
    const em=line.match(/^-\s+(.+?)\s+—\s+(.+)$/); if(!em||!group)continue;
    const refs=[...em[2].matchAll(/\b\d+\.\d+(?:\.\d+)?\b/g)].map(m=>m[0]);
    for(const ref of refs) out.push({group,term:em[1].trim(),ref});
  }
  return out;
}

function migrateIndexMetadata(model) {
  const byFile=new Map();
  for(const item of parseExistingIndex()){
    const base=item.ref.split('.').slice(0,2).join('.'); const section=model.sections.get(base); if(!section) continue;
    const arr=byFile.get(section.file)??[]; arr.push({...item,line:section.line}); byFile.set(section.file,arr);
  }
  for(const [file,items] of byFile){
    const lines=read(file).split('\n');
    // remove prior generated metadata
    const cleaned=lines.filter(l=>!/^<!-- handbook:index /.test(l));
    // rescan heading positions after cleanup
    const positions=new Map(); let inFence=false;
    cleaned.forEach((line,i)=>{if(/^```/.test(line.trim())){inFence=!inFence;return;}if(inFence)return;const m=line.match(/^###\s+(\d+\.\d+)\s+/);if(m)positions.set(m[1],i);});
    const grouped=new Map();
    for(const item of items){const base=item.ref.split('.').slice(0,2).join('.');const a=grouped.get(base)??[];a.push(item);grouped.set(base,a);}
    const inserts=[];
    for(const [id,vals] of grouped){const pos=positions.get(id);if(pos==null)continue;const unique=[...new Map(vals.map(v=>[`${v.group}\0${v.term}`,v])).values()];
      inserts.push({pos:pos+1,lines:unique.sort((a,b)=>a.term.localeCompare(b.term,'ja')).map(v=>`<!-- handbook:index ${JSON.stringify({group:v.group,term:v.term})} -->`)});
    }
    inserts.sort((a,b)=>b.pos-a.pos).forEach(x=>cleaned.splice(x.pos,0,...x.lines));
    write(file,cleaned.join('\n'));
  }
}

function addAnchors() {
  for(const file of bodyFiles){
    const lines=read(file).split('\n').filter(l=>!/^<a id="(?:chapter|section)-/.test(l));
    const out=[];let inFence=false;
    for(const line of lines){
      if(/^```/.test(line.trim())){inFence=!inFence;out.push(line);continue;}
      if(!inFence){
        const cm=line.match(/^##\s+第(\d+)章\s+/); if(cm) out.push(`<a id="${anchorFor(cm[1])}"></a>`);
        const sm=line.match(/^###\s+(\d+\.\d+)\s+/); if(sm) out.push(`<a id="${anchorFor(sm[1])}"></a>`);
      }
      out.push(line);
    }
    write(file,out.join('\n'));
  }
}

function generateToc(model){
  const lines=[
    '# 目次','',
    '<!-- handbook:generated; do not edit -->',
    '本文見出しと学習レベル定義から自動生成されています。','',
    '学習レベル: **必修** = 初回通読、**実務選択** = 担当領域に応じて選択、**発展** = 専門・内部実装、**展望** = 変化が速い領域。','',
    '詳細な基準と章別時間は [学習レベルと推定時間](LEARNING_LEVELS.md) を参照してください。','',
    '推奨順序と目的別の途中参加方法は [学習ルート](LEARNING_PATHS.md) を参照してください。','',
    '## 目次','',
  ];
  let lastPart=null;
  for(const ch of model.chapters.sort((a,b)=>a.number-b.number)){
    if(ch.part?.title!==lastPart){lastPart=ch.part?.title; lines.push(`### ${lastPart}`,'');}
    const chapterEntries=Object.entries(learningSections).filter(([id])=>id.startsWith(`${ch.number}.`));
    const requiredMinutes=chapterEntries.filter(([,e])=>e.level==='required').reduce((sum,[,e])=>sum+e.minutes,0);
    const allMinutes=chapterEntries.reduce((sum,[,e])=>sum+e.minutes,0);
    lines.push(`- [第${ch.number}章 ${ch.title}](${ch.file}#${anchorFor(String(ch.number))}) — 必修 ${formatMinutes(requiredMinutes)} / 全体 ${formatMinutes(allMinutes)}`);
    for(const section of [...model.sections.values()].filter(section=>section.id.startsWith(`${ch.number}.`)).sort((a,b)=>Number(a.id.split('.')[1])-Number(b.id.split('.')[1]))){
      const learning=learningSections[section.id];
      if(!learning) throw new Error(`Learning metadata missing for ${section.id}`);
      const label=learningManifest.levels[learning.level].label;
      lines.push(`  - [${section.id} ${section.title}](${section.file}#${anchorFor(section.id)}) — **${label}** / ${formatMinutes(learning.minutes)}`);
    }
  }
  return lines.join('\n')+'\n';
}

function collectMetadata(){
  const entries=new Map();
  for(const file of bodyFiles){
    const text=read(file); let current=null; let inFence=false;
    for(const line of text.split('\n')){
      if(/^```/.test(line.trim())){inFence=!inFence;continue;} if(inFence)continue;
      const sm=line.match(/^###\s+(\d+\.\d+)\s+/); if(sm){current=sm[1];continue;}
      const mm=line.match(/^<!-- handbook:index (.+) -->$/); if(mm&&current){try{const x=JSON.parse(mm[1]);const key=`${x.group}\0${x.term}`;const e=entries.get(key)??{group:x.group,term:x.term,refs:new Set()};e.refs.add(current);entries.set(key,e);}catch{}}
    }
  }
  return [...entries.values()];
}

function generateIndex(){
  const entries=collectMetadata(); const groups=new Map();
  for(const e of entries){const a=groups.get(e.group)??[];a.push(e);groups.set(e.group,a);}
  const alpha=[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']; const jp=['あ行','か行','さ行','た行','な行','は行','ま行','や行','ら行','わ行'];
  const ordered=[...alpha,...jp,...[...groups.keys()].filter(g=>!alpha.includes(g)&&!jp.includes(g)).sort((a,b)=>a.localeCompare(b,'ja'))];
  const lines=['# 索引','','<!-- handbook:generated; do not edit -->','本文中の `handbook:index` メタデータから自動生成されています。','','## アルファベット順',''];
  let japaneseStarted=false;
  for(const g of ordered){const vals=groups.get(g);if(!vals?.length)continue;if(jp.includes(g)&&!japaneseStarted){lines.push('## 日本語（五十音順）','');japaneseStarted=true;}
    lines.push(`### ${g}`,'');
    vals.sort((a,b)=>a.term.localeCompare(b.term,'ja')).forEach(e=>lines.push(`- ${e.term} — ${[...e.refs].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).join(', ')}`));lines.push('');
  }
  return lines.join('\n').trimEnd()+'\n';
}

let model=scanBody(); if(migrate){migrateIndexMetadata(model);model=scanBody();}
addAnchors(); model=scanBody();
const outputs=new Map([['01-toc.md',generateToc(model)],['10-index.md',generateIndex()]]);
let changed=false;
for(const [file,content] of outputs){const old=read(file);if(old!==content){changed=true;if(!check)write(file,content);}}
if(check&&changed){console.error('Generated handbook files are out of date. Run: npm run generate:handbook');process.exit(1);}
console.log(check?'Generated files are up to date.':'Generated table of contents, anchors, and index.');
