# Caderno — real-time collaborative AI notebook

A pnpm monorepo flagship: two people edit one document in a browser, see each
other's presence and remote cursor live, and get server-driven save-state —
wrapped in the practices recruiters actually check: observability, performance
budgets, accessibility gating, and a test pyramid that runs in CI.

## Stack

| Layer    | Tech                                                                  |
| -------- | --------------------------------------------------------------------- |
| UI       | Next.js 15 (App Router, RSC), React 19, Tailwind                      |
| Realtime | Node 22 + Socket.IO (own presence + versioned doc sync)               |
| Shared   | `@caderno/shared` — wire types + linearization logic, unit-tested     |
| Observability | pino, Prometheus metrics, OpenTelemetry traces, Sentry, web-vitals |
| Tests    | Vitest (unit + integration), Playwright (collab + axe a11y)           |
| Infra    | Docker, Terraform → Cloud Run, GitHub Actions (CI + CD via WIF)       |

## Layout

```
apps/web/          Next.js UI: room editor, presence, assistant panel
apps/realtime/     Socket.IO service: rooms, presence, doc versions, metrics
packages/shared/   DocPatch types + apply/versioning + conflict tests
terraform/         Cloud Run services + public IAM + two-wave deploy script
.github/workflows/ ci.yml (typecheck/lint/unit/e2e), cd.yml (deploy)
```

## Run it

```sh
pnpm install
pnpm dev          # web on :3000, realtime on :3001 (pick two browser tabs)
```

Open `http://localhost:3000`, click into a room, then open the same room URL in
a second tab. Same page: two cursors, a presence roster, live edits, and a
"Synced / Syncing… / Conflict" save-state pill. Editor page also offers the AI
assistant (enable by setting `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`).

## Scripts

```sh
pnpm dev              # run both apps
pnpm typecheck        # all workspaces
pnpm lint             # eslint (Next core-web-vitals + typescript)
pnpm -r test          # unit + realtime integration (two clients over the wire)
pnpm e2e              # Playwright: presence+convergence and axe a11y gates
pnpm --filter @caderno/web build && pnpm --filter @caderno/web start  # prod mode
```

Local e2e uses ports 3200/3201 to avoid clobbering whatever already listens on
3000/3001.

## The test pyramid (all green, CI-enforced)

1. **Unit** — `packages/shared` patch application + stale/conflict semantics
   (`shared/src/sync.test.ts`).
2. **Integration** — real Socket.IO server in-process, real clients join a room,
   roster grows, edits converge, a stale patch is rejected with the
   authoritative doc (`apps/realtime/src/sync.integration.test.ts`).
3. **E2E** — two isolated browser contexts converge on one document; presence
   roster reconciles; axe blocks any `serious`/`critical` violation on home and
   room (`apps/web/e2e/*`).
4. **Perf budget** — Lighthouse CI gates ≥95 in perf/a11y/best-practices/SEO
   (`lighthouserc.json`; run manually until a hosted preview URL exists).

## Observability

- `apps/realtime` — pino JSON logs, `http://localhost:3001/metrics`
  (Prometheus: sockets, rooms, patches, custom timing histograms), OTLP trace
  export, Sentry hooks (DSN optional).
- `apps/web` — web-vitals (LCP, INP, CLS, TTFB) reported to
  `/_ingest/vitals` and server-forwarded to the realtime service for the same
  metrics registry; optional AI assistant with streaming SSE.

## Deploy

Terraform → two Cloud Run services (realtime pinned ≥1 instance with session
affinity so live in-memory room state is sticky; web public). Dockerfiles at
`apps/*/Dockerfile` are production-ready and smoke-tested. `cd.yml` authenticates
via Workload Identity Federation and runs `terraform/deploy.sh`, which performs a
two-wave deploy because the browser socket URL must be baked into the web image
after the realtime URL exists.

See **WRITEUP.md** for the design story, decisions, and verification record.
