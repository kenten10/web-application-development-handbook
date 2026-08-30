#!/usr/bin/env bash
set -euo pipefail
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/esm" "$TMP/cjs"
cat > "$TMP/esm/package.json" <<'JSON'
{"type":"module"}
JSON
cat > "$TMP/esm/value.js" <<'JS'
export const foo = 'esm named';
export default 'esm default';
JS
cat > "$TMP/esm/import-ok.js" <<'JS'
import value, { foo } from './value.js'; console.log(value, foo);
JS
cat > "$TMP/esm/require-fail.js" <<'JS'
require('./value.js');
JS
cat > "$TMP/cjs/package.json" <<'JSON'
{"type":"commonjs"}
JSON
cat > "$TMP/cjs/value.cjs" <<'JS'
module.exports = { foo: 'cjs property' };
JS
cat > "$TMP/cjs/require-ok.cjs" <<'JS'
console.log(require('./value.cjs').foo);
JS
cat > "$TMP/cjs/import-fail.cjs" <<'JS'
import { foo } from './value.cjs'; console.log(foo);
JS
cat > "$TMP/esm/import-cjs.js" <<JS
import cjs from '${TMP}/cjs/value.cjs'; console.log(cjs.foo);
JS

run() { echo "\n$ $*"; "$@" 2>&1 || echo "exit=$? (expected failure for this case)"; }
run node "$TMP/esm/import-ok.js"
run node "$TMP/esm/require-fail.js"
run node "$TMP/cjs/require-ok.cjs"
run node "$TMP/cjs/import-fail.cjs"
run node "$TMP/esm/import-cjs.js"
