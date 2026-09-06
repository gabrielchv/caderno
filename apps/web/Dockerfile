# syntax=docker/dockerfile:1
# Caderno web — Next.js standalone build.
# Context: repo root. Build: docker build -f apps/web/Dockerfile .

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS build
# Manifests first so layer caching survives source edits.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile --filter @caderno/web...

COPY apps/web apps/web
COPY packages/shared packages/shared

# Baked at build time: the public URL of the realtime service the browser
# connects to. Localhost default is fine for a same-host dev deploy only.
ARG NEXT_PUBLIC_REALTIME_URL=http://localhost:3001
ENV NEXT_PUBLIC_REALTIME_URL=$NEXT_PUBLIC_REALTIME_URL

RUN pnpm --filter @caderno/web build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static

EXPOSE 8080
CMD ["node", "apps/web/server.js"]
