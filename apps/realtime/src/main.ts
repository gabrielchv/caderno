import { createCadernoServer } from './server'
import { initTracing, shutdownTracing } from './tracing'
import { initSentry, Sentry } from './sentry'
import { logger } from './logger'

const PORT = Number(process.env.PORT ?? 3001)
const HOST = process.env.HOST ?? '0.0.0.0'

initSentry()
initTracing()

const { httpServer, io } = createCadernoServer()

httpServer.listen(PORT, HOST, () => {
  logger.info(`caderno-realtime listening on http://${HOST}:${PORT}`)
})

let shuttingDown = false

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true
  logger.info({ signal }, 'shutting down')
  try {
    await new Promise<void>((resolve) => io.close(() => resolve()))
    httpServer.close()
    await shutdownTracing()
  } finally {
    process.exit(0)
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('unhandledRejection', (reason) => {
  Sentry.captureException(reason)
  logger.error({ err: reason }, 'unhandledRejection')
})
process.on('uncaughtException', (err) => {
  Sentry.captureException(err)
  logger.error({ err }, 'uncaughtException')
})
