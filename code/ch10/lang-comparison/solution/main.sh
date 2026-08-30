#!/usr/bin/env bash
set -euo pipefail

TMP_DIR=$(mktemp -d)
trap 'jobs -p | xargs -r kill 2>/dev/null || true; rm -rf "$TMP_DIR"' EXIT
PORT_BASE="${PORT_BASE:-39100}"
REQUESTS="${REQUESTS:-30}"

cat > "$TMP_DIR/node.mjs" <<'JS'
import http from 'node:http';
const port = Number(process.argv[2]);
http.createServer((_req,res)=>{res.end('ok')}).listen(port, '127.0.0.1', ()=>console.log('ready'));
JS
cat > "$TMP_DIR/python.py" <<'PY'
from http.server import BaseHTTPRequestHandler, HTTPServer
import sys
class H(BaseHTTPRequestHandler):
    def do_GET(self):
        body=b'ok'; self.send_response(200); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)
    def log_message(self, *_): pass
HTTPServer(('127.0.0.1', int(sys.argv[1])), H).serve_forever()
PY
cat > "$TMP_DIR/main.go" <<'GO'
package main
import("fmt";"net/http";"os")
func main(){http.HandleFunc("/",func(w http.ResponseWriter,_ *http.Request){fmt.Fprint(w,"ok")}); http.ListenAndServe("127.0.0.1:"+os.Args[1],nil)}
GO

benchmark() {
  local name=$1 command=$2 port=$3
  bash -lc "$command" >"$TMP_DIR/$name.log" 2>&1 &
  local pid=$!
  for _ in $(seq 1 50); do curl -sf "http://127.0.0.1:$port/" >/dev/null && break; sleep 0.05; done
  local start end
  start=$(python3 -c 'import time; print(time.perf_counter_ns())')
  for _ in $(seq 1 "$REQUESTS"); do curl -sf "http://127.0.0.1:$port/" >/dev/null; done
  end=$(python3 -c 'import time; print(time.perf_counter_ns())')
  kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true
  python3 - "$name" "$REQUESTS" "$start" "$end" <<'PY'
import sys
name,n,start,end=sys.argv[1],int(sys.argv[2]),int(sys.argv[3]),int(sys.argv[4])
ms=(end-start)/1e6
print(f'{name}: requests={n} elapsed_ms={ms:.2f} approx_rps={n/(ms/1000):.1f}')
PY
}

benchmark node "node '$TMP_DIR/node.mjs' $PORT_BASE" "$PORT_BASE"
if command -v python3 >/dev/null 2>&1; then benchmark python "python3 '$TMP_DIR/python.py' $((PORT_BASE+1))" "$((PORT_BASE+1))"; else echo 'python: skipped (not installed)'; fi
if command -v go >/dev/null 2>&1; then benchmark go "cd '$TMP_DIR' && go run main.go $((PORT_BASE+2))" "$((PORT_BASE+2))"; else echo 'go: skipped (not installed)'; fi

echo 'Use these numbers only within the same machine and run; warm-up and runtime defaults affect results.'
