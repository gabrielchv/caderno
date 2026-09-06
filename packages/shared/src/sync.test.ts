import { describe, expect, it } from 'vitest'
import { applyPatch, initialDoc, isStale } from './sync'
import type { DocPatch } from './types'

function patch(baseVersion: number, content: string, clientId = 'c1'): DocPatch {
  return { op: 'replace', baseVersion, content, clientId }
}

describe('applyPatch', () => {
  it('accepts a patch based on the current version and bumps the version', () => {
    const doc = initialDoc('hello')
    const out = applyPatch(doc, patch(0, 'hello world'))
    expect(out.ok).toBe(true)
    if (out.ok) {
      expect(out.doc.version).toBe(1)
      expect(out.doc.content).toBe('hello world')
    }
  })

  it('rejects a stale patch (baseVersion behind current) as stale', () => {
    const doc = { version: 5, content: 'authoritative' }
    const out = applyPatch(doc, patch(4, 'from-a-lagging-client'))
    expect(out).toEqual({ ok: false, reason: 'stale', doc })
  })

  it('rejects a patch from the future (baseVersion ahead)', () => {
    const doc = initialDoc('x')
    const out = applyPatch(doc, patch(99, 'from-the-future'))
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.reason).toBe('stale')
  })

  it('keeps the authoritative doc untouched when rejecting', () => {
    const doc = { version: 2, content: 'keep' }
    applyPatch(doc, patch(1, 'nope'))
    expect(doc).toEqual({ version: 2, content: 'keep' })
  })

  it('rejects when two concurrent edits are based on the same version — only the first lands', () => {
    let doc = initialDoc('a')
    const alice = applyPatch(doc, patch(0, 'alice wrote'))
    expect(alice.ok).toBe(true)
    if (alice.ok) doc = alice.doc

    const bob = applyPatch(doc, patch(0, 'bob wrote'))
    expect(bob.ok).toBe(false)
    if (!bob.ok) {
      expect(bob.reason).toBe('stale')
      expect(bob.doc.content).toBe('alice wrote') // server did not regress
    }
  })

  it('accepts a retry once the client rebases on the accepted version', () => {
    let doc = initialDoc('')
    const alice = applyPatch(doc, patch(0, 'alice'))
    if (alice.ok) doc = alice.doc

    // Bob's first attempt was stale; he resyncs to version 1 then retries.
    const bobRetry = applyPatch(doc, patch(1, 'bob after alice'))
    expect(bobRetry.ok).toBe(true)
    if (bobRetry.ok) expect(bobRetry.doc).toEqual({ version: 2, content: 'bob after alice' })
  })

  it('accepts consecutive patches from the same client', () => {
    let doc = initialDoc('')
    for (let i = 1; i <= 3; i++) {
      const out = applyPatch(doc, patch(doc.version, `v${i}`))
      expect(out.ok).toBe(true)
      if (out.ok) doc = out.doc
    }
    expect(doc.version).toBe(3)
    expect(doc.content).toBe('v3')
  })
})

describe('isStale', () => {
  it('flags only a base/current mismatch', () => {
    expect(isStale(3, 3)).toBe(false)
    expect(isStale(2, 3)).toBe(true)
    expect(isStale(4, 3)).toBe(true)
  })
})
