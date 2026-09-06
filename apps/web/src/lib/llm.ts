export type AssistMode = 'summarize' | 'polish'

export interface AssistRequest {
  text: string
  mode: AssistMode
}

const SYSTEM: Record<AssistMode, string> = {
  summarize:
    'You are an assistant inside a collaborative notes editor. Summarize the user\'s ' +
    'notes into a tight, well-structured summary. Preserve every factual point. Do not add ' +
    'information that is not in the source text. Output plain text only, no markdown headers.',
  polish:
    'You are an assistant inside a collaborative notes editor. Rewrite the user\'s notes ' +
    'for clarity and flow without changing their meaning, length or voice. Keep all facts. ' +
    'Output plain text only, no markdown headers.',
}

export function providerConfig() {
  return {
    baseUrl: (process.env.LLM_BASE_URL ?? 'https://api.deepseek.com/v1').replace(/\/$/, ''),
    model: process.env.LLM_MODEL ?? 'deepseek-chat',
    apiKey: process.env.LLM_API_KEY,
  }
}

/** Yield the `data:` payloads of a Server-Sent Events byte stream, tolerating
 *  chunk boundaries that split a line anywhere (the normal case over HTTP). */
export async function* decodeSse(chunks: AsyncIterable<string>): AsyncGenerator<string> {
  let buffer = ''
  for await (const chunk of chunks) {
    buffer += chunk
    let newlineIndex = buffer.search(/\r?\n/)
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).replace(/\r$/, '')
      buffer = buffer.slice(newlineIndex + 1)
      if (line.startsWith('data:')) {
        const data = line.slice(5).trim()
        if (data === '[DONE]') return
        if (data) yield data
      }
      newlineIndex = buffer.search(/\r?\n/)
    }
  }
  // A final line without a trailing newline is still valid SSE.
  if (buffer.startsWith('data:')) {
    const data = buffer.slice(5).trim()
    if (data && data !== '[DONE]') yield data
  }
}

export interface Delta {
  content: string
  finishReason: string | null
}

/** Streaming chat completion against any OpenAI-compatible endpoint. */
export async function* streamAssist(
  req: AssistRequest,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const { baseUrl, model, apiKey } = providerConfig()
  if (!apiKey) throw new Error('LLM_API_KEY is not set on the server')

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
      accept: 'text/event-stream',
    },
    body: JSON.stringify({
      model,
      stream: true,
      temperature: 0.2,
      messages: [
        { role: 'system', content: SYSTEM[req.mode] },
        { role: 'user', content: req.text },
      ],
    }),
  })

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '')
    throw new Error(`assistant provider ${res.status}: ${detail.slice(0, 200)}`)
  }

  const decoder = new TextDecoder()
  const byteChunks: AsyncGenerator<string> = (async function* () {
    const reader = res.body!.getReader()
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        yield decoder.decode(value, { stream: true })
      }
      yield decoder.decode()
    } finally {
      reader.releaseLock()
    }
  })()

  for await (const data of decodeSse(byteChunks)) {
    if (!data) continue
    let payload: unknown
    try {
      payload = JSON.parse(data)
    } catch {
      continue // keepalive comments / partial keepalives are not JSON
    }
    const delta = (payload as { choices?: { delta?: { content?: string } }[] }).choices?.[0]
    const content = delta?.delta?.content
    if (content) yield content
  }
}
