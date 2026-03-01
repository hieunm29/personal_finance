# ═══════════════════════════════════════════════════════════
# Stage 1: Install dependencies
# ═══════════════════════════════════════════════════════════
FROM oven/bun:1.3-alpine AS deps
WORKDIR /app

COPY package.json bun.lock bunfig.toml ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/

RUN bun install --frozen-lockfile

# ═══════════════════════════════════════════════════════════
# Stage 2: Build frontend
# ═══════════════════════════════════════════════════════════
FROM deps AS build
WORKDIR /app

COPY . .
RUN bun run build

# ═══════════════════════════════════════════════════════════
# Stage 3: Production
# ═══════════════════════════════════════════════════════════
FROM oven/bun:1.3-alpine AS prod
WORKDIR /app

COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/apps/server/node_modules apps/server/node_modules
COPY --from=deps /app/packages/shared/node_modules packages/shared/node_modules

COPY package.json bunfig.toml ./
COPY apps/server apps/server
COPY packages/shared packages/shared
COPY --from=build /app/apps/web/dist apps/web/dist

RUN mkdir -p data

ENV NODE_ENV=production
EXPOSE 3000

CMD ["bun", "run", "apps/server/src/index.ts"]
