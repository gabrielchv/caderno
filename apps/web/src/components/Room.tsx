'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useDocSync } from '@/hooks/useDocSync'
import { EditorArea } from '@/components/EditorArea'
import { PresenceBar, StatusPill } from '@/components/Presence'
import { AssistantPanel } from '@/components/AssistantPanel'

export function Room({ roomId }: { roomId: string }) {
  const sync = useDocSync(roomId)
  const editorRef = useRef<HTMLTextAreaElement | null>(null)
  const [assistantOpen, setAssistantOpen] = useState(false)

  const nameOf = (clientId: string) =>
    sync.presence.roster.find((u) => u.clientId === clientId)?.name ?? 'Someone'

  const typingNames = sync.presence.typingIds
    .filter((id) => id !== sync.myId)
    .map(nameOf)
  const remoteCursors = sync.presence.roster
    .filter((u) => u.clientId !== sync.myId && u.cursor !== null)
    .map((u) => ({ name: u.name, at: u.cursor as number }))

  // Precedence for the footer line: active typing > a remote cursor > version.
  const footerText =
    typingNames.length > 0
      ? `${typingNames.join(', ')} ${typingNames.length > 1 ? 'are' : 'is'} typing…`
      : remoteCursors[0]
        ? `${remoteCursors[0].name} is at character ${remoteCursors[0].at}`
        : `Version ${sync.doc.version} · everyone is synced`

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 py-4 lg:px-6">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-neutral-200 pb-3">
        <Link
          href="/"
          className="text-lg font-bold tracking-tight text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
        >
          Caderno
        </Link>
        <code className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
          room/{roomId}
        </code>
        <StatusPill status={sync.status} />
        <div className="ms-auto flex items-center gap-3">
          <PresenceBar roster={sync.presence.roster} myId={sync.myId} />
          <button
            type="button"
            onClick={() => setAssistantOpen((open) => !open)}
            aria-expanded={assistantOpen}
            aria-controls="assistant-panel"
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            {assistantOpen ? 'Hide assistant' : 'AI assistant'}
          </button>
        </div>
      </header>

      {!sync.connected && (
        <p
          role="alert"
          className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800"
        >
          Not connected to the realtime service. Check that it is running and the page has been
          reloaded.
        </p>
      )}

      <div className="flex flex-1 flex-col gap-4 py-4 lg:flex-row">
        <section aria-label="Editor" className="flex min-h-[60dvh] flex-1 flex-col">
          <div className="flex-1">
            <EditorArea
              editorRef={editorRef}
              content={sync.doc.content}
              onChange={sync.handleTextChange}
              onCursor={sync.reportCursor}
              onTyping={sync.reportTyping}
              disabled={!sync.connected}
            />
          </div>
          <p id="editor-help" className="sr-only">
            Edits sync live to everyone in the room.
          </p>
          <footer
            aria-live="polite"
            className="mt-2 min-h-6 text-sm text-neutral-500"
          >
            {footerText}
          </footer>
        </section>

        {assistantOpen && (
          <div id="assistant-panel" className="shrink-0 lg:w-80">
            <AssistantPanel
              content={sync.doc.content}
              editorRef={editorRef}
              onApplyEdit={sync.handleTextChange}
              onClose={() => setAssistantOpen(false)}
            />
          </div>
        )}
      </div>
    </main>
  )
}
