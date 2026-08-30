#!/usr/bin/env bash
# 課題19.1 の模範解答。
# 3つの Dockerfile (naive / cached / multi) と、それらを比較するための最小アプリを生成する。
# RUN_DOCKER_BENCH=1 かつ Docker が使えるときは実際に build して、サイズと再ビルド時間まで測る。
set -euo pipefail
WORK="${1:-$(mktemp -d)}"
mkdir -p "$WORK/app/src" "$WORK/naive" "$WORK/cached" "$WORK/multi"

# --- 計測対象になる最小のアプリ。依存インストール層とソース層を分けて観察するために置く
cat > "$WORK/app/package.json" <<'JSON'
{
  "name": "dockerfile-bench",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": { "build": "mkdir -p dist && cp src/index.js dist/index.js" }
}
JSON
cat > "$WORK/app/src/index.js" <<'JS'
console.log('dockerfile-bench v1');
JS
cat > "$WORK/app/.dockerignore" <<'IGNORE'
node_modules
dist
.git
IGNORE

# --- naive: 先に全部 COPY するのでソースを1文字変えると install からやり直しになる
cat > "$WORK/naive/Dockerfile" <<'DOCKER'
FROM node:24-bookworm
WORKDIR /app
COPY . .
RUN npm install --omit=dev
RUN npm run build
CMD ["node", "dist/index.js"]
DOCKER

# --- cached: 依存の宣言だけ先に COPY するので、ソース変更では install 層が CACHED になる
cat > "$WORK/cached/Dockerfile" <<'DOCKER'
FROM node:24-bookworm
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
RUN npm run build
CMD ["node", "dist/index.js"]
DOCKER

# --- multi: 実行に要らないものを最終イメージへ持ち込まない
cat > "$WORK/multi/Dockerfile" <<'DOCKER'
FROM node:24-bookworm AS deps
WORKDIR /app
COPY package.json ./
# 依存が0件でも node_modules を作っておく。後段の COPY --from=deps が失敗しないようにするため
RUN npm install --omit=dev && mkdir -p node_modules

FROM deps AS build
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
USER node
CMD ["node", "dist/index.js"]
DOCKER

naive_layers=$(grep -cE '^(RUN|COPY|ADD)' "$WORK/naive/Dockerfile" | tr -d ' ')
optimized_stages=$(grep -c '^FROM ' "$WORK/multi/Dockerfile" | tr -d ' ')
printf 'naive_mutating_layers=%s\noptimized_stages=%s\n' "$naive_layers" "$optimized_stages"
printf 'workdir=%s\n' "$WORK"

if ! command -v docker >/dev/null 2>&1 || [[ "${RUN_DOCKER_BENCH:-0}" != "1" ]]; then
  echo 'docker_benchmark=skipped (Docker unavailable or RUN_DOCKER_BENCH!=1)'
  exit 0
fi
if ! docker info >/dev/null 2>&1; then
  echo 'docker_benchmark=skipped (Docker daemon not reachable)'
  exit 0
fi

# --- 実ビルド。初回ビルド時間 → ソース1行変更 → 再ビルド時間、の順に測る
build_once() {
  local tag="$1" dockerfile="$2" started elapsed
  started=$(date +%s)
  # --progress=plain は CACHED 行を目視するための指定。--quiet とは併用できない
  if ! docker build --progress=plain --file "$dockerfile" --tag "$tag" "$WORK/app" > "$WORK/build-${tag//:/-}.log" 2>&1; then
    echo "docker_build_failed=$tag (see $WORK/build-${tag//:/-}.log)" >&2
    return 1
  fi
  elapsed=$(( $(date +%s) - started ))
  printf '%s' "$elapsed"
}

echo 'docker_benchmark=running'
for variant in naive cached multi; do
  first=$(build_once "app:$variant" "$WORK/$variant/Dockerfile")
  printf 'build_first_%s_sec=%s\n' "$variant" "$first"
done

echo "console.log('dockerfile-bench v2');" > "$WORK/app/src/index.js"
for variant in naive cached multi; do
  again=$(build_once "app:$variant" "$WORK/$variant/Dockerfile")
  printf 'rebuild_after_source_change_%s_sec=%s\n' "$variant" "$again"
done

for variant in naive cached multi; do
  size=$(docker image inspect "app:$variant" --format '{{.Size}}')
  printf 'image_size_bytes_%s=%s\n' "$variant" "$size"
done
echo 'docker_benchmark=done'
echo 'cleanup: docker rmi app:naive app:cached app:multi && docker builder prune -f'
