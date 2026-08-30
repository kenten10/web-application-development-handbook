#!/usr/bin/env bash
set -euo pipefail

URL="${1:-http://127.0.0.1:3000/echo}"
REQUESTS="${REQUESTS:-100}"
CONCURRENCY="${CONCURRENCY:-10}"
PAYLOAD="${PAYLOAD:-hello}"

if ! command -v curl >/dev/null 2>&1; then
  echo 'curl is required' >&2
  exit 1
fi

start_ns=$(date +%s%N 2>/dev/null || python3 - <<'PY'
import time
print(time.time_ns())
PY
)
export URL PAYLOAD
seq "$REQUESTS" | xargs -P "$CONCURRENCY" -I{} sh -c \
  'curl --fail --silent --show-error -X POST --data "$PAYLOAD" "$URL" >/dev/null'
end_ns=$(date +%s%N 2>/dev/null || python3 - <<'PY'
import time
print(time.time_ns())
PY
)
elapsed_ms=$(( (end_ns - start_ns) / 1000000 ))
if [ "$elapsed_ms" -le 0 ]; then elapsed_ms=1; fi
rps=$(( REQUESTS * 1000 / elapsed_ms ))
printf 'requests=%s concurrency=%s elapsed_ms=%s approx_rps=%s\n' "$REQUESTS" "$CONCURRENCY" "$elapsed_ms" "$rps"
printf 'cpu_block_probe='; curl --fail --silent -X POST --data "$PAYLOAD" "${URL}?work=500000"; printf '\n'
