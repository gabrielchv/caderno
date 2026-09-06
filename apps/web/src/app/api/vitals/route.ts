import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const ALLOWED = new Set(['CLS', 'INP', 'LCP', 'FCP', 'TTFB'])
const REALTIME_URL = process.env.REALTIME_URL

/**
 * Ingestion endpoint for web-vitals reports. Forwarding each metric to the
 * realtime service's /ingest/vitals turns frontend performance into a
 * Prometheus counter (caderno_web_vitals_total{name}) — the same scrape the
 * service health page exposes. Falls back to a structured log line when the
 * realtime URL is not configured (local dev).
 */
export async function POST(req: NextRequest) {
  let body: { name?: unknown; value?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name : ''
  const value = typeof body.value === 'number' ? body.value : NaN
  if (!ALLOWED.has(name) || !Number.isFinite(value)) {
    return NextResponse.json({ error: 'name must be in the allowed set and value numeric' }, { status: 400 })
  }

  if (REALTIME_URL) {
    await fetch(`${REALTIME_URL.replace(/\/$/, '')}/ingest/vitals`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, value }),
    }).catch((err) => {
      console.error(`[vitals] forward failed: ${(err as Error).message}`)
    })
  } else {
    console.info(JSON.stringify({ event: 'web-vital', name, value }))
  }

  return new NextResponse(null, { status: 204 })
}
