import pino from 'pino'

/**
 * Structured JSON logger. Every line is an object with timestamp, level and
 * message plus whatever context the caller attaches — no free-text console.
 * Ship-level log lines carry `roomId`/`clientId` so a room's whole lifecycle
 * is greppable.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { service: 'caderno-realtime' },
})
