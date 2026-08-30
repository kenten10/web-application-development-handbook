#!/usr/bin/env bash
# KEN-66: ブラウザ演習6件 (1.4 / 4.1 / 4.2 / 6.4 / 9.2 / 24.5) を
# 実 Chrome + DevTools Protocol で自動検証する。
#
# 前提:
#   - Google Chrome (既定パス /Applications/Google Chrome.app/... 、CHROME_BIN で上書き可)
#   - Node.js 24 以上 (グローバル WebSocket / fetch を使うため。npm 依存は追加しない)
#   - localhost のみ使用。外部ネットワークへは接続しない。
#
# 使い方:
#   bash .verification/ken66/run-ken66.sh
#   KEN66_HEADFUL=1 bash .verification/ken66/run-ken66.sh   # headful Chrome で実行
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HERE="$ROOT/.verification/ken66"
LOG="$HERE/logs"
BUILD="$HERE/build"
CHROME_BIN="${CHROME_BIN:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
MEASURE_PORT=8647

mkdir -p "$LOG" "$HERE/screenshots"

cleanup() {
  # 起動したサーバ/ブラウザを必ず落とす (ゾンビを残さない)
  if [[ -n "${MEASURE_PID:-}" ]] && kill -0 "$MEASURE_PID" 2>/dev/null; then
    kill "$MEASURE_PID" 2>/dev/null
    wait "$MEASURE_PID" 2>/dev/null
  fi
  pkill -f 'ken66-chrome-' 2>/dev/null
  {
    echo "cleanup at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "残存 chrome (ken66 プロファイル): $(pgrep -f 'ken66-chrome-' | wc -l | tr -d ' ')"
    echo "残存 python http.server (port $MEASURE_PORT): $(pgrep -f "http.server $MEASURE_PORT" | wc -l | tr -d ' ')"
    for p in 8641 8642 8643 8644 8645 8646 "$MEASURE_PORT"; do
      echo "port $p listener: $(lsof -nP -iTCP:"$p" -sTCP:LISTEN 2>/dev/null | wc -l | tr -d ' ')"
    done
  } > "$LOG/cleanup.txt"
  cat "$LOG/cleanup.txt"
}
trap cleanup EXIT

echo "=== KEN-66 browser verification $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
"$CHROME_BIN" --version | tee "$LOG/chrome-version.txt"
node -v

############################################
# 事前準備: 4.2 の TypeScript を tsc でブラウザ向けに出力する
# (code/ch04/todo-vanilla/solution/README.md の手順と同じ。出力先だけ .verification 配下へ変更)
############################################
echo "--- tsc で ch04 をビルド ---"
rm -rf "$BUILD/ch04"
"$ROOT/code/ch04/node_modules/.bin/tsc" -p "$ROOT/code/ch04/tsconfig.json" --outDir "$BUILD/ch04" 2>&1 | tee "$LOG/4.2-tsc.out"
cp "$ROOT/code/ch04/todo-vanilla/solution/index.html" "$BUILD/ch04/todo-vanilla/solution/index.html"

############################################
# 課題1.4 の HTTP 計測パート (measure-http.solution.sh)
# 教材の既定引数は外部URLなので、localhost 固定で実行する
############################################
echo "--- 1.4 measure-http.solution.sh を localhost に対して実行 ---"
python3 -m http.server "$MEASURE_PORT" --bind 127.0.0.1 --directory "$HERE/fixtures/ex1_4" > "$LOG/1.4-http-server.out" 2>&1 &
MEASURE_PID=$!
for _ in $(seq 1 40); do
  curl -sS -o /dev/null "http://localhost:$MEASURE_PORT/index.html" && break
  sleep 0.25
done
{
  echo "# 課題1.4 HTTP計測 (localhost のみ。外部URLは使用しない)"
  echo "# port=$MEASURE_PORT root=.verification/ken66/fixtures/ex1_4"
  bash "$ROOT/code/ch01/measure-http.solution.sh" \
    "http://localhost:$MEASURE_PORT/index.html" \
    "http://localhost:$MEASURE_PORT/static.html" \
    "http://localhost:$MEASURE_PORT/spa.html"
} 2>&1 | tee "$LOG/1.4-measure-http.out"
kill "$MEASURE_PID" 2>/dev/null; wait "$MEASURE_PID" 2>/dev/null; MEASURE_PID=""

############################################
# 6演習のブラウザ検証本体 (CDP)
############################################
echo "--- Chrome + CDP で6演習を検証 ---"
node "$HERE/verify.mjs"
STATUS=$?

echo "=== done (exit=$STATUS) ==="
exit "$STATUS"
