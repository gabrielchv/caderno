// Canonical wire + domain types for Caderno.
// Single source of truth — both apps import these; keep changes additive.

export interface Doc {
  /** Monotonic, server-authoritative. Bumped once per accepted patch. */
  version: number
  content: string
}

export type PatchOp = 'replace'

export interface DocPatch {
  op: PatchOp
  /** The version the client believed current when it produced `content`. */
  baseVersion: number
  /** Full new document content (LWW whole-doc by design in v1). */
  content: string
  clientId: string
}

export interface PresenceUser {
  clientId: string
  name: string
  color: string
  /** Character offset of the user's caret in the doc, if known. */
  cursor: number | null
  typing: boolean
  joinedAt: number
}

/** Payload a client sends when joining a room. */
export type JoinPayload = Omit<PresenceUser, 'joinedAt' | 'cursor' | 'typing'>

export interface AckPayload {
  /** The patch that was accepted, tagged with the new document version. */
  version: number
  clientId: string
}

export interface RejectPayload {
  /** The version the client based its patch on (why it was rejected). */
  clientBaseVersion: number
  /** Authoritative document the client must resync to. */
  server: Doc
  clientId: string
}

// ---------------------------------------------------------------------------
// Socket.IO typed event maps.

export interface ServerToClientEvents {
  'doc:snapshot': (doc: Doc) => void
  'doc:ack': (payload: AckPayload) => void
  'doc:reject': (payload: RejectPayload) => void
  /** A patch accepted from another client in the room. */
  'doc:change': (patch: DocPatch, version: number) => void
  'presence:update': (users: PresenceUser[]) => void
  'presence:typing': (clientId: string, typing: boolean) => void
  'presence:cursor': (clientId: string, offset: number) => void
}

export interface ClientToServerEvents {
  'room:join': (roomId: string, user: JoinPayload) => void
  'presence:cursor': (offset: number) => void
  'presence:typing': (typing: boolean) => void
  'doc:patch': (patch: DocPatch) => void
}

export interface InterServerEvents {}

/** Set on the socket by the server once it has joined a room. */
export interface SocketData {
  roomId?: string
  user?: PresenceUser
}
