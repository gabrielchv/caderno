import { applyPatch } from '@caderno/shared'
import { logger } from './logger'
import { tracer } from './tracing'
import { metrics } from './health'
import { RoomStore } from './store'
import type { IoClient, IoServer } from './presence'

/**
 * Server-authoritative document sync. The client sends a full-content patch
 * tagged with the version it based the edit on. Accepted → bump + ack sender +
 * broadcast to the room. Stale → reject with the authoritative doc, so the
 * client can resync. `applyPatch` lives in @caderno/shared and is the single
 * implementation of the rule — unit-tested there, exercised here.
 *
 * `_io` is unused by design (broadcasts go through `socket.to(roomId)`); the
 * underscore documents that while keeping the register* signatures uniform.
 */
export function registerSync(_io: IoServer, socket: IoClient, store: RoomStore): void {
  socket.on('doc:patch', (patch) => {
    const { roomId, user } = socket.data
    if (!roomId || !user) return
    const room = store.get(roomId)
    if (!room) return

    const span = tracer.startSpan('doc.patch', {
      attributes: {
        'room.id': roomId,
        'client.id': patch.clientId,
        'patch.baseVersion': patch.baseVersion,
        'patch.length': patch.content.length,
      },
    })

    const outcome = applyPatch(room.doc, patch)
    if (outcome.ok) {
      room.doc = outcome.doc
      metrics.patchesAccepted.inc()
      logger.info(
        {
          roomId,
          clientId: patch.clientId,
          baseVersion: patch.baseVersion,
          version: outcome.doc.version,
        },
        'patch accepted',
      )
      socket.emit('doc:ack', { version: outcome.doc.version, clientId: patch.clientId })
      socket.to(roomId).emit('doc:change', patch, outcome.doc.version)
    } else {
      metrics.patchesRejected.inc()
      logger.warn(
        {
          roomId,
          clientId: patch.clientId,
          baseVersion: patch.baseVersion,
          serverVersion: room.doc.version,
        },
        'patch rejected (stale)',
      )
      socket.emit('doc:reject', {
        clientBaseVersion: patch.baseVersion,
        server: room.doc,
        clientId: patch.clientId,
      })
    }

    span.end()
  })
}
