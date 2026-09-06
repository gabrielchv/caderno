import type { Server, Socket } from 'socket.io'
import {
  type ClientToServerEvents,
  type InterServerEvents,
  type PresenceUser,
  type ServerToClientEvents,
  type SocketData,
} from '@caderno/shared'
import { logger } from './logger'
import { tracer } from './tracing'
import { metrics } from './health'
import { RoomStore, type Room } from './store'

export type IoServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>

export type IoClient = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>

const MAX_ROOM_ID_LENGTH = 200

export function roster(room: Room): PresenceUser[] {
  return [...room.users.values()].sort((a, b) => a.joinedAt - b.joinedAt)
}

/**
 * Ephemeral presence: join/leave/cursor/typing. Presence never touches the doc
 * version — a cursor moving is not an edit. All state is in-memory per room.
 */
export function registerPresence(io: IoServer, socket: IoClient, store: RoomStore): void {
  socket.on('room:join', (rawRoomId, user) => {
    const roomId = rawRoomId.trim().slice(0, MAX_ROOM_ID_LENGTH)
    const room = store.getOrCreate(roomId)
    const self: PresenceUser = {
      ...user,
      cursor: null,
      typing: false,
      joinedAt: Date.now(),
    }
    socket.data.roomId = roomId
    socket.data.user = self
    room.users.set(self.clientId, self)
    void socket.join(roomId)
    metrics.rooms.set(store.size())

    // The newcomer gets the authoritative doc and full roster; the room learns
    // about the newcomer. Order matters: snapshot first so the editor has text
    // to show before presence arrives.
    socket.emit('doc:snapshot', room.doc)
    socket.emit('presence:update', roster(room))
    socket.to(roomId).emit('presence:update', roster(room))

    logger.info({ roomId, clientId: self.clientId, name: self.name }, 'client joined room')
  })

  socket.on('presence:cursor', (offset) => {
    const { roomId, user } = socket.data
    if (!roomId || !user) return
    const room = store.get(roomId)
    const self = room?.users.get(user.clientId)
    if (!room || !self) return
    self.cursor = offset
    socket.to(roomId).emit('presence:cursor', self.clientId, offset)
  })

  socket.on('presence:typing', (typing) => {
    const { roomId, user } = socket.data
    if (!roomId || !user) return
    const room = store.get(roomId)
    const self = room?.users.get(user.clientId)
    if (!room || !self) return
    self.typing = typing
    socket.to(roomId).emit('presence:typing', self.clientId, typing)
  })

  socket.on('disconnect', () => {
    const { roomId, user } = socket.data
    if (roomId && user) {
      const room = store.get(roomId)
      if (room) {
        const span = tracer.startSpan('presence.leave', {
          attributes: { 'room.id': roomId, 'client.id': user.clientId },
        })
        store.leave(room, user.clientId)
        metrics.rooms.set(store.size())
        io.to(roomId).emit('presence:update', roster(room))
        logger.info({ roomId, clientId: user.clientId, name: user.name }, 'client left room')
        span.end()
      }
    }
  })
}
