'use client'

import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

interface EditorAreaProps {
  content: string
  onChange: (next: string) => void
  onCursor: (offset: number) => void
  onTyping: (typing: boolean) => void
  editorRef: RefObject<HTMLTextAreaElement | null>
  disabled?: boolean
}

const TYPING_IDLE_MS = 1500

/**
 * The document surface. A <textarea> rather than a contenteditable on purpose:
 * native caret handling and full accessibility for free, at the cost of remote
 * live-caret overlays (the documented upgrade path in WRITEUP).
 *
 * Typing is reported over presence with an idle timeout, so the room sees
 * "X is typing" without a server round-trip per keystroke.
 */
export function EditorArea({
  content,
  onChange,
  onCursor,
  onTyping,
  editorRef,
  disabled = false,
}: EditorAreaProps) {
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current)
    }
  }, [])

  function markTyping() {
    onTyping(true)
    if (idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => onTyping(false), TYPING_IDLE_MS)
  }

  function reportCursor(e: React.SyntheticEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget
    onCursor(el.selectionStart ?? 0)
  }

  return (
    <textarea
      ref={editorRef}
      aria-label="Document body"
      aria-describedby="editor-help"
      value={content}
      disabled={disabled}
      onChange={(e) => {
        onChange(e.target.value)
        markTyping()
      }}
      onKeyUp={reportCursor}
      onClick={reportCursor}
      onSelect={reportCursor}
      spellCheck={true}
      className="h-full w-full resize-none rounded-lg border border-neutral-300 bg-white p-4 text-neutral-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:bg-neutral-100"
    />
  )
}
