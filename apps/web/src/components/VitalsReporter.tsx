'use client'

import { useReportWebVitals } from 'next/web-vitals'

/**
 * Reports Core Web Vitals to POST /api/vitals, which forwards each metric to
 * the realtime service's Prometheus counter. sendBeacon so a navigation away
 * from the page does not drop the final report.
 */
export function VitalsReporter() {
  useReportWebVitals((metric) => {
    const body = JSON.stringify({
      name: metric.name,
      value: metric.name === 'CLS' ? metric.value : Math.round(metric.value),
    })
    try {
      navigator.sendBeacon(
        '/api/vitals',
        new Blob([body], { type: 'application/json' }),
      )
    } catch {
      void fetch('/api/vitals', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {
        // reporting is best-effort — never break the page over a beacon
      })
    }
  })
  return null
}
