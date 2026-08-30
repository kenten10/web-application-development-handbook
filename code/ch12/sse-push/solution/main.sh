#!/usr/bin/env bash
set -euo pipefail
DIR=$(cd "$(dirname "$0")" && pwd)
LOG=$(mktemp)
node "$DIR/server.mjs" 0 >"$LOG" &
PID=$!
trap 'kill "$PID" 2>/dev/null || true; rm -f "$LOG"' EXIT
for _ in $(seq 1 50); do [ -s "$LOG" ] && break; sleep 0.05; done
PORT=$(head -n1 "$LOG")
OUTPUT=$(curl --fail --silent --no-buffer --max-time 3 -H 'Last-Event-ID: 40' "http://127.0.0.1:$PORT/events")
printf '%s\n' "$OUTPUT"
for expected in 'id: 41' 'event: stock-update' 'event: user-online' 'event: notification'; do grep -q "$expected" <<<"$OUTPUT"; done
