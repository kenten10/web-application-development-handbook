FROM node:24.18.0-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash ca-certificates chromium curl git openssl postgresql-client python3 redis-tools sqlite3 \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@11.15.1 --activate

WORKDIR /workspace
ENV CI=true
CMD ["sleep", "infinity"]
