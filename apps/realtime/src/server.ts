import http from 'node:http'
import express from 'express'
import cors from 'cors'
import { Server } from 'socket.io'
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@caderno/shared'
import { registerHealthRoutes, metrics } from './health'
import { registerPresence, type IoServer } from './presence'
import { registerSync } from './sync'
import { RoomStore } from './store'
import { logger } from './logger'

export interface CadernoServer {
  app: express.Express
  httpServer: http.Server
  io: IoServer
  store: RoomStore
}

const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())

/**
 * Composition root. Everything a test or a runtime needs is built here; the
 * process wiring (tracing, Sentry, listen, shutdown) lives in main.ts so the
 * test suite can boot a real server without side effects.
 */
export function createCadernoServer(): CadernoServer {
  const app = express()
  app.disable('x-powered-by')
  app.use(cors({ origin: ALLOWED_ORIGINS }))
  app.use(express.json())

  registerHealthRoutes(app)

  const httpServer = http.createServer(app)
  const io: IoServer = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'] },
  })

  const store = new RoomStore()

  io.on('connection', (socket) => {
    metrics.connections.inc()
    metrics.rooms.set(store.size())
    logger.info({ clientId: socket.id }, 'socket connected')

    registerPresence(io, socket, store)
    registerSync(io, socket, store)

    socket.on('disconnect', () => {
      metrics.connections.dec()
      metrics.rooms.set(store.size())
      logger.info({ clientId: socket.id }, 'socket disconnected')
    })
  })

  return { app, httpServer, io, store }
}
