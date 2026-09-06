# syntax=docker/dockerfile:1
# Caderno realtime — Socket.IO service run through tsx (sources are TypeScript).
# Context: repo root. Build: docker build -f apps/realtime/Dockerfile .

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/realtime/package.json apps/realtime/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile --filter @caderno/realtime...

# Sources (needed at runtime too — this service runs TypeScript via tsx).
COPY apps/realtime apps/realtime
COPY packages/shared packages/shared

FROM base AS runtime
# Copy the whole pnpm tree: per-package node_modules symlinks need the root
# virtual store (.pnpm) and the workspace sources they point at.
COPY --from=build /app ./

ENV NODE_ENV=production
ENV PORT=8080
ENV CORS_ORIGIN=http://localhost:3000

# Runtime needs tsx (a devDependency) to load TypeScript sources — acceptable
# v1 trade, documented in WRITEUP; the compiled-output upgrade is trivial.
WORKDIR /app/apps/realtime
EXPOSE 8080
CMD ["node", "--import", "tsx", "src/main.ts"]
