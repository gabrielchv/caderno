'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { initialDoc, type Doc, type PresenceUser } from '@caderno/shared'
import { createCadernoSocket, type CadernoSocket } from '@/lib/socket'
import { getIdentity } from '@/lib/identity'

export type SyncStatus = 'connecting' | 'synced' | 'syncing' | 'conflict'

export interface PresenceState {
  roster: PresenceUser[]
  typingIds: string[]
  cursors: Record<string, number>
}

const EMPTY_PRESENCE: PresenceState = { roster: [], typingIds: [], cursors: {} }

export interface DocSync {
  doc: Doc
  status: SyncStatus
  connected: boolean
  presence: PresenceState
  myId: string
  handleTextChange: (next: string) => void
  reportCursor: (offset: number) => void
  reportTyping: (on: boolean) => void
}

/**
 * Server-authoritative document sync with optimistic updates.
 *
 * The client types into the textarea immediately (optimistic), sends a patch
 * carrying the version it based the edit on, and holds any further keystrokes
 * until the previous patch is acknowledged. Two outcomes matter:
 *   - doc:ack     → the edit landed; bump the known version, send what was queued.
 *   - doc:reject  → the edit was based on a stale version; adopt the server's
 *                   authoritative document (no silent divergence) and resync.
 * A single patch is in flight at a time; everything newer is coalesced into
 * one `pending` content string, which is what makes fast typing collapse into
 * few network round-trips instead of one request per keystroke.
 */
export function useDocSync(roomId: string): DocSync {
  const identity = getIdentity()
  const socketRef = useRef<CadernoSocket | null>(null)
  const versionRef = useRef(0)
  const sendingRef = useRef(false)
  const pendingRef = useRef<string | null>(null)

  const [doc, setDoc] = useState<Doc>(() => initialDoc())
  const [status, setStatus] = useState<SyncStatus>('connecting')
  const [connected, setConnected] = useState(false)
  const [presence, setPresence] = useState<PresenceState>(EMPTY_PRESENCE)

  useEffect(() => {
    const socket = createCadernoSocket()
    socketRef.current = socket
    setConnected(socket.connected)

    socket.on('connect', () => {
      setConnected(true)
      setStatus('syncing')
      socket.emit('room:join', roomId, {
        clientId: identity.clientId,
        name: identity.name,
        color: identity.color,
      })
    })
    socket.on('disconnect', () => {
      setConnected(false)
      setStatus('connecting')
    })

    socket.on('doc:snapshot', (snapshot) => {
      versionRef.current = snapshot.version
      pendingRef.current = null
      sendingRef.current = false
      setDoc(snapshot)
      setStatus('synced')
    })

    socket.on('doc:ack', ({ version }) => {
      versionRef.current = version
      sendingRef.current = false
      setDoc((prev) => ({ ...prev, version }))
      setStatus('synced')
      flushPending()
    })

    socket.on('doc:reject', ({ server }) => {
      versionRef.current = server.version
      sendingRef.current = false
      setDoc(server)
      setStatus('conflict')
      flushPending()
    })

    socket.on('doc:change', (patch, version) => {
      if (patch.clientId === identity.clientId) return
      versionRef.current = version
      setDoc({ version, content: patch.content })
      setStatus('synced')
    })

    socket.on('presence:update', (roster) => {
      setPresence((prev) => {
        const memberIds = new Set(roster.map((u) => u.clientId))
        return {
          roster,
          typingIds: prev.typingIds.filter((id) => memberIds.has(id)),
          cursors: Object.fromEntries(
            Object.entries(prev.cursors).filter(([id]) => memberIds.has(id)),
          ),
        }
      })
    })
    socket.on('presence:typing', (clientId, typing) => {
      setPresence((prev) => {
        const typingIds = new Set(prev.typingIds)
        if (typing) typingIds.add(clientId)
        else typingIds.delete(clientId)
        return { ...prev, typingIds: [...typingIds] }
      })
    })
    socket.on('presence:cursor', (clientId, offset) => {
      setPresence((prev) => ({ ...prev, cursors: { ...prev.cursors, [clientId]: offset } }))
    })

    return () => {
      socket.removeAllListeners()
      socket.disconnect()
      socketRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- identity is stable per session
  }, [roomId])

  // Function declaration (not const) on purpose: it is referenced inside the
  // `useEffect` above, and declarations hoist. Reads socketRef/sendingRef/
  // pendingRef/versionRef so it always sees the latest values without being a
  // dependency of the effect.
  function flushPending() {
    const socket = socketRef.current
    if (!socket || sendingRef.current) return
    const next = pendingRef.current
    if (next === null) return
    pendingRef.current = null
    sendingRef.current = true
    socket.emit('doc:patch', {
      op: 'replace',
      baseVersion: versionRef.current,
      content: next,
      clientId: identity.clientId,
    })
    setStatus('syncing')
  }

  const handleTextChange = useCallback((next: string) => {
    pendingRef.current = next
    setDoc((prev) => ({ ...prev, content: next }))
    flushPending()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reportCursor = useCallback((offset: number) => {
    socketRef.current?.emit('presence:cursor', offset)
  }, [])

  const reportTyping = useCallback((on: boolean) => {
    socketRef.current?.emit('presence:typing', on)
  }, [])

  return {
    doc,
    status,
    connected,
    presence,
    myId: identity.clientId,
    handleTextChange,
    reportCursor,
    reportTyping,
  }
}
