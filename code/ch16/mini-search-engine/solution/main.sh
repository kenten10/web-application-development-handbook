#!/usr/bin/env bash
set -euo pipefail
PORT="${PORT:-3004}"
MODE="${1:---self-test}"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
cat > "$TMP/server.mjs" <<'JS'
import http from 'node:http';
const docs = [
  {id:1,title:'Node event loop',body:'node javascript event loop asynchronous io'},
  {id:2,title:'Database indexes',body:'btree database query index performance'},
  {id:3,title:'Search ranking',body:'search engine inverted index bm25 ranking'},
];
const tokenize=s=>(s.toLowerCase().match(/[a-z0-9]+/g)||[]);
const search=q=>{const terms=tokenize(q);return docs.map(d=>({id:d.id,title:d.title,score:terms.reduce((n,t)=>n+tokenize(d.title+' '+d.body).filter(x=>x===t).length,0)})).filter(x=>x.score).sort((a,b)=>b.score-a.score)};
if(process.argv[2]==='--self-test'){const r=search('search index');if(r[0]?.id!==3)process.exit(1);console.log(JSON.stringify(r));process.exit(0)}
http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');if(url.pathname!='/search'){res.writeHead(404).end('not found');return}res.setHeader('content-type','application/json');res.end(JSON.stringify(search(url.searchParams.get('q')||'')))}).listen(Number(process.env.PORT||3004),'127.0.0.1',()=>console.log(`mini-search listening on 127.0.0.1:${process.env.PORT||3004}`));
JS
if [[ "$MODE" == "--self-test" ]]; then node "$TMP/server.mjs" --self-test; else PORT="$PORT" node "$TMP/server.mjs"; fi
