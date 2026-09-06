# Caderno — real-time collaborative AI notebook

Web-dev flagship closing four portfolio gaps: observability, real-time/WebSockets,
performance+accessibility, testing rigor. Stays coherent with the AI Engineer positioning
via a thin, BYO-key LLM assistant.

Status: approved 2026-09-06. Decisions in the plan below are binding unless a task
records a deviation.

## Architecture

pnpm monorepo:

- `apps/web` — Next.js 15 (App Router), React 19, Tailwind 3, TypeScript. Editor UI,
  presence, AI assistant route, vitals reporting.
- `apps/realtime` — Node + Express + Socket.IO, TypeScript. Presence, server-authoritative
  doc sync, structured logs (pino), OpenTelemetry tracing, prom-client metrics, health
  endpoints, Sentry.
- `packages/shared` — types + pure sync logic (`applyPatch`/`isStale`) + Vitest unit tests.
  Single source of truth; both apps consume it.

Sync model: one in-memory doc per room. Monotonic `version`. Client sends full-content
patch with its `baseVersion`. Server accepts iff `baseVersion === version` (bump, ack,
broadcast); otherwise rejects with authoritative doc → client resyncs. LWW whole-doc is a
deliberate simplification; OT/CRDT is the documented upgrade path, not the v1 scope.

Transport: self-hosted Socket.IO (no Pusher/Ably). Cloud Run deploy needs
`min-instances=1` + session affinity.

## Tasks

### Phase 0 — scaffold
1. Root: `pnpm-workspace.yaml`, `package.json`, `tsconfig.base.json`, `.gitignore`,
   `.npmrc`, prettier config. Done when `pnpm install` at root succeeds.
2. `packages/shared`: `src/types.ts` (Doc/Patch/Presence/Cursor/socket event names),
   `src/sync.ts` (`applyPatch`, `isStale`, `patchWith`). Done when typechecks.
3. `apps/realtime`: `package.json`, `tsconfig.json`, `src/server.ts` (Express + Socket.IO
   bootstrap + module wiring point). Done when it boots.
4. `apps/web`: Next.js scaffold (layout, home page, room page). Done when it renders.

### Phase 1 — real-time core
5. `apps/realtime/src/presence.ts` — join/leave/cursor, ephemeral in-memory.
6. `apps/realtime/src/sync.ts` — doc handlers: patch accept/broadcast/reject, resync.
7. `packages/shared/src/sync.test.ts` — Vitest: accept, reject-stale, concurrent-edit.
8. `apps/web/src/lib/socket.ts` + `useDocSync.ts` — client + optimistic update + resync.
9. `apps/web` editor UI + presence (avatars, typing/remote-position indicator).
   Checkpoint: two tabs edit one room, presence + conflict resync visible.

### Phase 2 — observability (realtime service)
10. `src/logger.ts` — pino structured JSON; every socket event logs a structured line.
11. `src/tracing.ts` — OTel SDK, manual spans around socket handlers + HTTP middleware,
    Console exporter by default, OTLP HTTP when `OTEL_EXPORTER_OTLP_ENDPOINT` is set.
12. `src/sentry.ts` — @sentry/node init, no-op when `SENTRY_DSN` unset.
13. `src/health.ts` — `/healthz`, `/readyz`, `/metrics` (prom-client counters).

### Phase 3 — perf + a11y
14. `apps/web/src/lib/vitals.ts` — report `web-vitals` to `POST /api/vitals`.
15. a11y pass + `@axe-core/playwright` scan spec — semantic markup, keyboard/focus,
    `prefers-reduced-motion`.
16. Lighthouse CI (`lighthouserc.json`, ≥95 gates).

### Phase 4 — testing rigor
17. `apps/realtime/src/sync.integration.test.ts` — real server + `socket.io-client` +
    supertest: connect/join/edit/stale-reject/presence.
18. `apps/web/e2e/collab.spec.ts` — two browser contexts: presence visible, concurrent
    edits converge, versions consistent.
19. `.github/workflows/ci.yml` — typecheck all, lint web, unit shared+realtime, E2E web.

### Phase 5 — AI hook + deploy + docs
20. `apps/web/src/app/api/assist/route.ts` + `src/lib/llm.ts` — BYO-key, OpenAI-compatible
    provider-shaped client; summarize/rewrite selection, streamed into a panel with Insert.
21. Dockerfiles (web + realtime) + `terraform/` Cloud Run (realtime min-instances=1 +
    session affinity) + CD workflow.
22. `README.md` + `WRITEUP.md` — run + design notes per pillar.

## Verify

```bash
pnpm install
pnpm -r typecheck
pnpm --filter web lint
pnpm -r test            # shared + realtime unit/integration green
pnpm --filter web test:e2e   # two-context collab + a11y
```

## Risks / deviations
- Sentry frontend (`@sentry/nextjs` build plugin) is a known footgun across Next versions.
  v1 ships Sentry on `apps/realtime` only; frontend error capture is a documented follow-up.
- Editor uses `<textarea>` not contenteditable — native caret handling and a11y for free;
  remote-caret overlay is the documented upgrade. Presence shows avatars + typing + last
  remote position instead of a live caret.
- LWW whole-doc conflict is honest v1; WRITEUP names the OT/CRDT upgrade path.
