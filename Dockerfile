# syntax = docker/dockerfile:1

# Node + Express + better-sqlite3, per build brief §7. better-sqlite3 needs
# its native binding compiled against the exact image that runs it (§7a), so
# the build stage has toolchain + headers and the runtime stage is the same
# base image, just without them. Must serve HTTP on 0.0.0.0:$PORT (fly.toml
# sets PORT) and publish README.md at /readme/ (spec/README.md says what's
# checked) --- src/server.mjs renders it at request time.

FROM docker.io/library/node:24-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

FROM docker.io/library/node:24-slim
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
COPY src/ ./src/
COPY public/ ./public/
COPY content/ ./content/
COPY docs/guide.md ./docs/guide.md
COPY README.md ./
ENV NODE_ENV=production
ENV DATABASE_PATH=/data/app.db
CMD ["node", "src/main.mjs"]
