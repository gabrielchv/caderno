import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { io as createClient, type Socket } from 'socket.io-client'
import type { AddressInfo } from 'node:net'
import type {
  ClientToServerEvents,
  JoinPayload,
  PresenceUser,
  ServerToClientEvents,
} from '@caderno/shared'
import { createCadernoServer, type CadernoServer } from './server'

type TestClient = Socket<ServerToClientEvents, ClientToServerEvents>

let srv: CadernoServer
let baseUrl: string

/** Resolve with the payload of a single-argument event. */
function waitFor<T>(socket: TestClient, event: keyof ServerToClientEvents): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timed out waiting for "${event}"`)),
      2000,
    )
    socket.once(event as never, ((payload: T) => {
      clearTimeout(timer)
      resolve(payload)
    }) as never)
  })
}

/** Resolve with the second argument of `doc:change` — the new document version. */
function waitForDocChangeVersion(socket: TestClient): Promise<number> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out waiting for doc:change')), 2000)
    socket.once('doc:change', ((_patch: unknown, version: number) => {
      clearTimeout(timer)
      resolve(version)
    }) as never)
  })
}

/** Resolve with both arguments of `presence:cursor`. */
function waitForPresenceCursor(
  socket: TestClient,
): Promise<{ clientId: string; offset: number }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out waiting for presence:cursor')), 2000)
    socket.once('presence:cursor', ((clientId: string, offset: number) => {
      clearTimeout(timer)
      resolve({ clientId, offset })
    }) as never)
  })
}

/** Resolve once the roster the client sees has at least `want` members. */
function waitUntilRoster(client: TestClient, want: number, timeout = 2500): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`roster never reached ${want} members`)),
      timeout,
    )
    const check = (users: PresenceUser[]) => {
      if (users.length >= want) {
        clearTimeout(timer)
        client.off('presence:update', check)
        resolve()
      }
    }
    client.on('presence:update', check)
  })
}

function connect(): Promise<TestClient> {
  const client = createClient(baseUrl, { transports: ['websocket'] })
  return new Promise((resolve, reject) => {
    client.once('connect', () => resolve(client))
    client.once('connect_error', reject)
  })
}

async function join(client: TestClient, roomId: string, user: JoinPayload): Promise<void> {
  const snapshot = waitFor(client, 'doc:snapshot')
  client.emit('room:join', roomId, user)
  await snapshot
}

beforeAll(async () => {
  srv = createCadernoServer()
  await new Promise<void>((resolve) => srv.httpServer.listen(0, '127.0.0.1', resolve))
  const { port } = srv.httpServer.address() as AddressInfo
  baseUrl = `http://127.0.0.1:${port}`
})

afterAll(async () => {
  await new Promise<void>((resolve) => srv.httpServer.close(() => resolve()))
  await new Promise<void>((resolve) => srv.io.close(() => resolve()))
})

describe('document sync over the wire', () => {
  it('joins a room, sees presence, edits converge, and stale patches are rejected', async () => {
    const alice = await connect()
    const bob = await connect()
    try {
      // Each member eventually sees the other. Attach the roster watchers
      // before Bob joins, otherwise Alice's "2 members" event can fire during
      // the join and be missed.
      await join(alice, 'integration-room', { clientId: 'alice', name: 'Alice', color: '#e53e3e' })
      const aliceSeesBob = waitUntilRoster(alice, 2)
      const bobSeesAlice = waitUntilRoster(bob, 2)
      await join(bob, 'integration-room', { clientId: 'bob', name: 'Bob', color: '#3182ce' })
      await Promise.all([aliceSeesBob, bobSeesAlice])

      // Alice edits from the initial version → ack + broadcast.
      const ackAlice = waitFor<{ version: number }>(alice, 'doc:ack')
      const bobChangeVersion = waitForDocChangeVersion(bob)
      alice.emit('doc:patch', {
        op: 'replace',
        baseVersion: 0,
        content: 'hello from alice',
        clientId: 'alice',
      })
      await expect(ackAlice).resolves.toEqual({ version: 1, clientId: 'alice' })
      await expect(bobChangeVersion).resolves.toBe(1)

      // Bob's edit is based on version 0, now stale → rejected with the
      // authoritative doc so he can resync.
      const rejectBob = waitFor<{ clientBaseVersion: number; server: { version: number } }>(
        bob,
        'doc:reject',
      )
      bob.emit('doc:patch', {
        op: 'replace',
        baseVersion: 0,
        content: 'bob was typing on a stale copy',
        clientId: 'bob',
      })
      const rejection = await rejectBob
      expect(rejection.clientBaseVersion).toBe(0)
      expect(rejection.server).toMatchObject({ version: 1, content: 'hello from alice' })

      // Bob resyncs onto version 1 and lands his edit.
      const ackBob = waitFor<{ version: number }>(bob, 'doc:ack')
      bob.emit('doc:patch', {
        op: 'replace',
        baseVersion: 1,
        content: 'hello from alice, then bob',
        clientId: 'bob',
      })
      await expect(ackBob).resolves.toEqual({ version: 2, clientId: 'bob' })

      // A cursor move reaches the other member without touching versions.
      const aliceCursor = waitForPresenceCursor(alice)
      bob.emit('presence:cursor', 7)
      await expect(aliceCursor).resolves.toEqual({ clientId: 'bob', offset: 7 })
    } finally {
      alice.disconnect()
      bob.disconnect()
    }
  })

  it('exposes health, readiness and metrics endpoints', async () => {
    await request(srv.app).get('/healthz').expect(200)
    await request(srv.app).get('/readyz').expect(200)

    const res = await request(srv.app).get('/metrics').expect(200)
    expect(res.text).toContain('caderno_doc_patches_accepted_total')
    expect(res.text).toContain('caderno_socket_connections')
  })
})
