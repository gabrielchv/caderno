import { NextRequest } from 'next/server'
import { streamAssist, type AssistMode } from '@/lib/llm'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_TEXT = 12_000
const MODES = new Set<AssistMode>(['summarize', 'polish'])

/**
 * Streaming assistant endpoint. Reads a selection from the editor, streams the
 * provider's token deltas straight to the client as plain text. Aborts the
 * upstream fetch when the client disconnects so a closed tab does not keep
 * burning tokens.
 */
export async function POST(req: NextRequest) {
  let body: { text?: unknown; mode?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return new Response('invalid JSON', { status: 400 })
  }

  const text = typeof body.text === 'string' ? body.text.trim() : ''
  const mode = body.mode as AssistMode
  if (!MODES.has(mode) || !text) {
    return new Response('mode must be summarize|polish and text non-empty', { status: 400 })
  }
  if (text.length > MAX_TEXT) {
    return new Response(`text exceeds ${MAX_TEXT} characters`, { status: 413 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const token of streamAssist({ text, mode }, req.signal)) {
          controller.enqueue(encoder.encode(token))
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[assist] ${message}`)
        controller.enqueue(encoder.encode(`\n\n[assistant error: ${message}]`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-accel-buffering': 'no',
    },
  })
}
