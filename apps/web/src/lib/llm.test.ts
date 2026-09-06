import { describe, expect, it } from 'vitest'
import { decodeSse } from './llm'

async function collect(...chunks: string[]): Promise<string[]> {
  const out: string[] = []
  async function* source() {
    for (const c of chunks) yield c
  }
  for await (const data of decodeSse(source())) {
    out.push(data)
  }
  return out
}

describe('decodeSse', () => {
  it('yields each data line in order', async () => {
    const chunk = 'data: {"a":1}\n\ndata: {"a":2}\n\n'
    expect(await collect(chunk)).toEqual(['{"a":1}', '{"a":2}'])
  })

  it('tolerates a token split across any chunk boundary', async () => {
    // Split "content" mid-way and split an event across two chunks.
    const frag = ['data: {"delta":{"co', 'ntent":"hel', 'lo"}}\n\ndata: {"delta":{"con', 'tent":" world"}}\n\n']
    expect(await collect(...frag)).toEqual([
      '{"delta":{"content":"hello"}}',
      '{"delta":{"content":" world"}}',
    ])
  })

  it('handles CRLF line endings', async () => {
    expect(await collect('data: x\r\ndata: y\r\n')).toEqual(['x', 'y'])
  })

  it('stops at [DONE] and ignores keepalive comments', async () => {
    expect(
      await collect(': keepalive\n\ndata: first\n\ndata: [DONE]\n\ndata: never\n\n'),
    ).toEqual(['first'])
  })

  it('yields a final data line without a trailing newline', async () => {
    expect(await collect('data: {"done":true}')).toEqual(['{"done":true}'])
  })

  it('ignores non-data lines', async () => {
    expect(await collect('event: message\ndata: {"ok":1}\n\nretry: 1000\n')).toEqual([
      '{"ok":1}',
    ])
  })
})
