import * as Sentry from '@sentry/node'
import { logger } from './logger'

export { Sentry }

/**
 * Initialize error capture. No-op (with a log line) when SENTRY_DSN is unset,
 * so local dev and the test suite run without a Sentry account.
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) {
    logger.info('SENTRY_DSN not set — Sentry disabled')
    return
  }
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 1.0,
  })
  logger.info('Sentry enabled')
}
