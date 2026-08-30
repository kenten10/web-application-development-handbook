#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
MODE="${1:-full}"

node -e 'const [major,minor]=process.versions.node.split(".").map(Number); if(major!==24 || minor<18){console.error(`Node.js 24.18.0以上24.xが必要です。現在: ${process.version}`); process.exit(1)}'
corepack enable
corepack prepare pnpm@11.15.1 --activate
[[ "$(pnpm --version)" == "11.15.1" ]] || { echo "pnpm 11.15.1が必要です" >&2; exit 1; }

pnpm install
[[ -f pnpm-lock.yaml ]] || { echo "pnpm-lock.yamlが生成されませんでした" >&2; exit 1; }
pnpm install --frozen-lockfile

if [[ "$MODE" == "--install-only" ]]; then
  node scripts/validate-clean-environment.mjs --runtime
  exit 0
fi

mkdir -p .verification/certs
bash code/ch03/cert-gen.solution.sh .verification/certs
pnpm run check:handbook
pnpm run check:workspace
node scripts/validate-clean-environment.mjs --runtime

# check:workspace の build が各章へ dist/ を残す。そのままにすると、演習カードの
# 自己採点手順 `pnpm --filter @handbook/chXX run test` が FORBIDDEN_ARTIFACT で必ず失敗する
node scripts/clean-build-artifacts.mjs

printf '\n固定環境検証が完了しました。外部サービス・ブラウザ手動項目は CLEAN_ENVIRONMENT.md の台帳に従って確認してください。\n'
