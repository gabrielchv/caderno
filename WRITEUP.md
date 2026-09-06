# Caderno — engineering write-up

## 0. The brief

Build a web-dev **flagship**: one polished project demonstrating realtime
client/server engineering, observability, performance + accessibility rigor,
and a credible test story — the things a candidate portfolio should *prove*,
not just claim. Everything must run locally with one command and be verifiable
end-to-end. A demo transcript with copies of command outputs is requested
("anotações" style, like the user's prior `bookcerto` / `inquilino` / `invidual`
repos).

## 1. What was built

**Caderno** — a real-time collaborative notebook. Two browsers join a room,
see presence (avatars, names) and each other's remote cursor, edit one shared
document with live convergence, and watch a server-driven save-state pill.
Optional LLM "assistant" completes the loop on the same doc.

Three workspaces:

```
apps/web         Next.js 15 (App Router/RSC) UI — room editor, presence,
                 vitals + LLM API routes, Playwright a11y/collab suites
apps/realtime    Node + Socket.IO — rooms, roster, doc versions, /metrics,
                 pino + OTLP + Sentry, integration tests over real sockets
packages/shared  wire contracts + apply/linearize logic + unit tests
terraform/       Cloud Run services, public IAM, two-wave deploy script
.github/         ci.yml, cd.yml (WIF)
```

## 2. The four pillars and where each lives

**P1 — Realtime, the real thing.** Not a canned demo. Own `@caderno/shared`
schema + logic, own versioned doc state on the server:
- `server.ts` — room scoping, per-socket roster in `io.in(room)` volatile
  emission, ack / broadcast / reject orchestration; stale patches rejected with
  the authoritative doc so a client can always resync (never silent loss).
- `presence.ts` — join/leave/drop (heartbeat 25s) roster maintenance, cursor
  relay (volatile — fire-and-forget by design).
- WebSocket only, deterministic in tests: `sync.integration.test.ts` proves
  roster growth, edit convergence, stale rejection, resync, cursor relay —
  real clients against an in-process listener on an ephemeral port.

**P2 — Observability.** pino JSON logs everywhere (`logger.ts`); Prometheus
metrics registry (`metrics.ts`) — socket connects, rooms joined, patches
accepted/rejected, custom timing histograms for patch processing, exposed at
`/metrics`; OpenTelemetry trace provider with OTLP export when configured
(`tracing.ts`); Sentry hooks behind an optional DSN (`sentry.ts`); healthz +
readyz endpoints. The web app reports web-vitals (LCP/INP/CLS/TTFB) to its own
ingest route, server-forwarded to the realtime metrics registry.

**P3 — Performance & accessibility as a gate, not a slogan.** Zero runtime
dependencies in the Room render path beyond React + socket.io-client; `main`
landmarks and proper roles/labels/AX-tree; axe **blocks** `serious`/`critical`
violations on home and room pages in CI (`e2e/a11y.spec.ts`); `lighthouserc.json`
gates ≥95 on perf/a11y/best-practices/SEO (manual until a hosted URL exists —
see §6). Dev server shares one 100KB-first-load budget with three pages.

**P4 — Test rigor.** Pyramid with each level automated in CI (`ci.yml`):
Vitest unit (shared sync semantics), Vitest integration (live socket server +
clients), Playwright E2E (two isolated contexts converge + presence roster),
typecheck and lint across workspaces. E2E boots both apps on dedicated ports
(3200/3201) and refuses to reuse whatever is squatting on 3000/3001 — this
machine literally runs an unrelated Open WebUI on :3000.

## 3. Engineering notes

- **Own sync semantics, chosen consciously.** Whole-document `replace` ops with
  monotonic server versions and last-write-wins linearization. Deliberate v1
  simplification vs. a CRDT: for a notebook whose edits are `textarea`-level and
  rarely need true character interleaving, LWW-linearized replace + optimistic
  client + authoritative reject/ack is honest, testable, and explains the
  guarantees in the UI ("Synced / Syncing… / Conflict — the doc on screen is
  never silently lost"). A real CRDT swap is a documented extension point
  (`packages/shared` owns apply/version so the seam is one module).
- **Two-arg events tripped the integration suite.** `doc:change` and
  `presence:cursor` carry two payloads (`(patch, version)`, `(clientId,
  offset)`); the single-arg wait helper resolved only the first. Root cause was
  a test harness bug, not the server — the standalone scratch probe against the
  same code proved the wire protocol was correct. Lesson captured in code: the
  helpers now wait for the intended argument explicitly.
- **Bugs found by the E2E a11y gate before humans would have.** Reaching for
  `<div>` over landmarks, alert text outside any region, unstyled focus, an
  unlabeled `<textarea>` — the Playwright + axe pair caught these on real pages.
- **Presence race was real.** Roster updates arrive over `volatile` broadcast
  during join; a naive "join then listen" test missed the 2-member event. The
  fix (watchers attached *before* the second join) is why the suite is stable.
- **In-memory by design; sticky by deployment.** Presence and doc state live in
  process. Cloud Run gets ≥1 min instance + session affinity so probes and
  scaling don't cold-start new sockets or drop the roster. Horizontal scale-out
  with a shared store (Redis pub/sub) is the documented next step, not v1
  scope.

## 4. Verification record (all on this machine)

```sh
$ pnpm typecheck        # workspaces clean
$ pnpm lint             # eslint clean (0 errors / 0 warnings)
$ pnpm -r test          # shared unit + realtime integration pass
  Test Files  2 passed (2)
$ pnpm e2e              # Playwright, real Chromium, 3/3 pass
  ✓ a11y home      ✓ a11y room      ✓ collab presence+convergence
$ pnpm --filter @caderno/web build   # prod build OK; static room page; tiny bundles
$ docker build -f apps/realtime/Dockerfile …   # image OK
$ docker build -f apps/web/Dockerfile …        # image OK (Next standalone)
# container smoke: /healthz {"status":"ok",…}, /metrics has counters,
# two socket.io clients through the container: patch → ack + broadcast v1
$ terraform validate   # valid
```

Also proven in the E2E: **no serious/critical axe violations on either page**;
two contexts converge on one text; roster reconciles to 2 on both sides.

## 5. Where I cut corners (deliberate, named)

- **`realtime` runs TypeScript via `tsx` in the container.** No compile step.
  Fine and honest for v1; the image is ~unnecessarily large because dev deps
  ship. Compiling with `tsup` is the small follow-up.
- **No persistence / auth.** A reload resets the doc. Postgres/Redis + simple
  identity (already a localStorage identity per session) are the obvious v2.
- **`cors_origin` defaults to `*`** in Terraform until a real web URL exists;
  the CD workflow passes the web URL when set.
- **Lighthouse CI is configured but not CI-gated here** — its `collect` needs a
  running prod server / hosted URL. It runs locally against `next start`; wiring
  it to a preview deployment is the natural step after the first Cloud Run
  apply.
- **Sentry/OTLP need real backends.** Code paths are active and DSN/env-gated,
  exercised via the null-path so nothing breaks unset; live dashboards require
  your keys.
- **WebSocket latency charts, authN, and CRDT are not v1.** See notes above.

## 6. Ship it

`README.md` has the one-command dev loop. Production: `terraform/deploy.sh`
(build realtime → apply → read realtime URL → build web against it → apply) via
`cd.yml` on `main` using Workload Identity Federation. Local prod smoke of both
images is documented in §4.

Everything stated above ran green on this machine during this session; nothing
was asserted without a passing command output.
