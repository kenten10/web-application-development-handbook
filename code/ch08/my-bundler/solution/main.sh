#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
WORK="$DIR/demo"
rm -rf "$WORK"
mkdir -p "$WORK/src" "$WORK/dist"
cat > "$WORK/src/math.js" <<'JS'
export const add = (a, b) => a + b;
export function double(value) { return value * 2; }
JS
cat > "$WORK/src/index.js" <<'JS'
import { add, double } from './math.js';
console.log(`bundle-result=${double(add(20, 1))}`);
JS
node "$DIR/bundler.mjs" "$WORK/src/index.js" "$WORK/dist/bundle.js"
OUTPUT="$(node "$WORK/dist/bundle.js")"
echo "$OUTPUT"
[[ "$OUTPUT" == "bundle-result=42" ]]
