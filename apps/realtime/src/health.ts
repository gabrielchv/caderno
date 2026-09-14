import { Router, type Express } from 'express'
import { collectDefaultMetrics, Counter, Gauge, Registry } from 'prom-client'

export const registry = new Registry()
collectDefaultMetrics({ register: registry })

export const metrics = {
  connections: new Gauge({
    name: 'caderno_socket_connections',
    help: 'Current number of connected Socket.IO clients',
    registers: [registry],
  }),
  rooms: new Gauge({
    name: 'caderno_rooms',
    help: 'Current number of in-memory rooms',
    registers: [registry],
  }),
  patchesAccepted: new Counter({
    name: 'caderno_doc_patches_accepted_total',
    help: 'Document patches accepted (version bumped)',
    registers: [registry],
  }),
  patchesRejected: new Counter({
    name: 'caderno_doc_patches_rejected_total',
    help: 'Document patches rejected as stale',
    registers: [registry],
  }),
  webVitals: new Counter({
    name: 'caderno_web_vitals_total',
    help: 'Web Vitals events reported by the frontend',
    labelNames: ['name'] as const,
    registers: [registry],
  }),
}

export function registerHealthRoutes(app: Express): void {
  const router = Router()

  router.get('/healthz', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() })
  })

  router.get('/readyz', (_req, res) => {
    // v1 has no external dependencies to probe; a booted server is ready.
    res.json({ status: 'ready' })
  })

  router.get('/metrics', async (_req, res) => {
    res.set('Content-Type', registry.contentType)
    res.end(await registry.metrics())
  })

  router.post('/ingest/vitals', (req, res) => {
    const { name, value } = (req.body ?? {}) as { name?: unknown; value?: unknown }
    if (typeof name !== 'string' || typeof value !== 'number' || !Number.isFinite(value)) {
      res.status(400).json({ error: 'name:string and value:number required' })
      return
    }
    // Counter.inc(label, value) adds the magnitude — a CLS of 0.31 sums as 0.31,
    // not 1 — so rate() over this counter gives an average, not a count.
    metrics.webVitals.inc({ name }, value)
    res.status(204).end()
  })

  app.use(router)
}
