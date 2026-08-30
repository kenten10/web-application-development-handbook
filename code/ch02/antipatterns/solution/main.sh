#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COUNT="${COUNT:-100}" node "$SCRIPT_DIR/benchmark.mjs"
