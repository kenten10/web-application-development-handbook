#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
WORK="$DIR/demo"
rm -rf "$WORK"
mkdir -p "$WORK"
cat > "$WORK/library.js" <<'JS'
export function used(value) { return value * 2; }
export function unusedLargeFeature(value) { return value ** 8 + 999999; }
export function anotherUnusedFeature() { return 'dead code'; }
JS
node "$DIR/shake.mjs" "$WORK/library.js" "$WORK/shaken.js" used
cat >> "$WORK/shaken.js" <<'JS'
console.log(`tree-shaken-result=${used(21)}`);
JS
OUTPUT="$(node "$WORK/shaken.js")"
echo "$OUTPUT"
[[ "$OUTPUT" == "tree-shaken-result=42" ]]
if grep -q 'unusedLargeFeature' "$WORK/shaken.js"; then echo 'unused export remained' >&2; exit 1; fi
