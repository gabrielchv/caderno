'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()
  const [roomId, setRoomId] = useState('')

  // Turn free text into a URL-safe room slug: lowercase, non-alphanumerics
  // collapse to a single dash, edges trimmed, capped to a sane length.
  const slugify = (raw: string) =>
    raw
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)

  function openRoom(e: React.FormEvent) {
    e.preventDefault()
    const slug = slugify(roomId)
    if (slug) router.push(`/rooms/${slug}`)
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6">
      <p className="text-sm font-medium uppercase tracking-widest text-indigo-600">
        Caderno
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        A real-time notebook for two or twenty people.
      </h1>
      <p className="mt-3 text-neutral-600">
        Everyone in the room sees the same document. Edits are server-authoritative:
        a stale edit is rejected and the client resyncs — no silent divergence.
      </p>

      <form onSubmit={openRoom} className="mt-8 flex gap-2">
        <label className="sr-only" htmlFor="room">
          Room name
        </label>
        <input
          id="room"
          type="text"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          placeholder="e.g. weekly-planning"
          className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          Open room
        </button>
      </form>

      <button
        type="button"
        onClick={() => router.push(`/rooms/${slugify(`demo-${Date.now().toString(36)}`)}`)}
        className="mt-4 justify-self-start text-sm font-medium text-indigo-600 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded focus-visible:ring-offset-2"
      >
        Start a throwaway demo room
      </button>
    </main>
  )
}
