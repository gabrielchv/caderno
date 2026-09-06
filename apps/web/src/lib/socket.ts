import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '@caderno/shared'

export type CadernoSocket = Socket<ServerToClientEvents, ClientToServerEvents>

/**
 * A typed Socket.IO client for the Caderno realtime service.
 * The URL comes from NEXT_PUBLIC_REALTIME_URL so it can be pointed at the
 * deployed Cloud Run service; localhost:3001 is the dev default.
 */
export function createCadernoSocket(): CadernoSocket {
  const url = process.env.NEXT_PUBLIC_REALTIME_URL ?? 'http://localhost:3001'
  return io(url, {
    transports: ['websocket'],
    timeout: 10_000,
  })
}
