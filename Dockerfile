# syntax = docker/dockerfile:1

# Builds the Astro site, then serves its static output. Must serve HTTP on
# 0.0.0.0:$PORT (fly.toml sets PORT) and publish README.md at /readme/
# (spec/README.md says what's checked) --- src/pages/readme/index.astro reads
# README.md at build time, so that falls out of the build rather than needing
# a separate step here.

FROM docker.io/library/node:24-slim AS build
WORKDIR /app
# Pinned to match mise.toml's pnpm version, since corepack's default
# resolution would otherwise pick whatever pnpm ships with this Node image.
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM docker.io/library/node:24-slim
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY scripts/serve.mjs ./scripts/serve.mjs
CMD ["node", "scripts/serve.mjs"]
