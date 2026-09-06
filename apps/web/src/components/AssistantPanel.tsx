'use client'

import { useRef, useState, type RefObject } from 'react'
import type { AssistMode } from '@/lib/llm'

interface AssistantPanelProps {
  content: string
  editorRef: RefObject<HTMLTextAreaElement | null>
  onApplyEdit: (next: string) => void
  onClose: () => void
}

/**
 * BYO-key AI assistant. Summarize or polish the current selection — or the
 * whole document when nothing is selected. Output streams in as the provider
 * produces it; "Insert" writes the result back over the original selection.
 * The API key lives in server-side env, never in the browser.
 */
export function AssistantPanel({
  content,
  editorRef,
  onApplyEdit,
  onClose,
}: AssistantPanelProps) {
  const [output, setOutput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const rangeRef = useRef<{ start: number; end: number } | null>(null)
  const wholeDocRef = useRef(false)

  async function run(mode: AssistMode) {
    if (busy) return
    const el = editorRef.current
    if (!el) return

    const start = el.selectionStart ?? 0
    const end = el.selectionEnd ?? el.value.length
    const selection = el.value.slice(start, end).trim()
    let source = selection
    let range: { start: number; end: number } | null = null

    if (!source) {
      source = content.trim()
      if (!source) return
      range = null // whole document → insert at the end
    } else {
      range = { start, end }
    }
    rangeRef.current = range
    wholeDocRef.current = !range

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setBusy(true)
    setOutput('')
    setError(null)
    try {
      const res = await fetch('/api/assist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode, text: source }),
        signal: controller.signal,
      })
      if (!res.ok || !res.body) {
        throw new Error(`assistant request failed (${res.status})`)
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        setOutput(acc)
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      setBusy(false)
    }
  }

  function insert() {
    if (!output) return
    const el = editorRef.current
    if (!el) return
    const value = el.value
    const { start, end } = rangeRef.current ?? { start: value.length, end: value.length }
    const clampedStart = Math.min(start, value.length)
    const clampedEnd = Math.min(end, value.length)
    onApplyEdit(value.slice(0, clampedStart) + output + value.slice(clampedEnd))
    setOutput('')
    rangeRef.current = null
  }

  return (
    <aside
      aria-label="AI assistant"
      className="flex w-full flex-col rounded-lg border border-neutral-200 bg-white shadow-sm lg:w-80"
    >
      <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2">
        <h2 className="text-sm font-semibold text-neutral-800">AI assistant</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close AI assistant"
          className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-col gap-2 border-b border-neutral-200 p-3">
        <p className="text-xs text-neutral-500">
          {wholeDocRef.current
            ? 'Nothing selected — acts on the whole document.'
            : 'Acts on your current selection.'}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void run('summarize')}
            disabled={busy}
            className="flex-1 rounded-md bg-indigo-600 px-2 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
          >
            Summarize
          </button>
          <button
            type="button"
            onClick={() => void run('polish')}
            disabled={busy}
            className="flex-1 rounded-md border border-indigo-600 px-2 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Polish
          </button>
        </div>
        {busy && (
          <button
            type="button"
            onClick={() => abortRef.current?.abort()}
            className="text-xs font-medium text-rose-600 hover:underline"
          >
            Stop streaming
          </button>
        )}
      </div>

      <div className="min-h-32 flex-1 space-y-2 overflow-y-auto p-3">
        {error ? (
          <p role="alert" className="text-sm text-rose-600">
            {error}
          </p>
        ) : (
          <output aria-live="polite" className="block whitespace-pre-wrap text-sm text-neutral-800">
            {output ||
              (busy ? 'Thinking…' : 'Run summarize or polish to see output here.')}
          </output>
        )}
      </div>

      <div className="border-t border-neutral-200 p-2">
        <button
          type="button"
          onClick={insert}
          disabled={!output}
          className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          Insert into document
        </button>
      </div>
    </aside>
  )
}
