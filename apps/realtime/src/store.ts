import { initialDoc, type Doc, type PresenceUser } from '@caderno/shared'

export interface Room {
  roomId: string
  doc: Doc
  users: Map<string, PresenceUser>
}

/**
 * In-memory room store. Rooms are ephemeral by design (v1): when the last
 * member disconnects the room is dropped and its document resets. Persistence
 * and CRDT history are the documented upgrades; they are not v1 scope.
 */
export class RoomStore {
  private readonly rooms = new Map<string, Room>()

  getOrCreate(roomId: string): Room {
    const existing = this.rooms.get(roomId)
    if (existing) return existing
    const room: Room = { roomId, doc: initialDoc(), users: new Map() }
    this.rooms.set(roomId, room)
    return room
  }

  get(roomId: string): Room | undefined {
    return this.rooms.get(roomId)
  }

  size(): number {
    return this.rooms.size
  }

  /** Remove a user from a room; drop the room entirely when it empties. */
  leave(room: Room, clientId: string): void {
    room.users.delete(clientId)
    if (room.users.size === 0) {
      this.rooms.delete(room.roomId)
    }
  }
}
