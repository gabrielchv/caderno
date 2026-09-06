import type { Doc, DocPatch } from './types'

export function initialDoc(content = ''): Doc {
  return { version: 0, content }
}

/** A patch whose baseVersion differs from the current doc version is stale. */
export function isStale(baseVersion: number, currentVersion: number): boolean {
  return baseVersion !== currentVersion
}

export type PatchOutcome =
  | { ok: true; doc: Doc }
  | { ok: false; reason: 'stale'; doc: Doc }

/**
 * Apply a client patch to the authoritative document.
 *
 * Whole-document LWW in v1: the patch carries the full content the client
 * believes the doc should hold. It is accepted only if the client based it on
 * the current version; otherwise the patch is stale and the authoritative doc
 * is returned so the client can resync. Acceptance bumps the version by one.
 */
export function applyPatch(current: Doc, patch: DocPatch): PatchOutcome {
  if (isStale(patch.baseVersion, current.version)) {
    return { ok: false, reason: 'stale', doc: current }
  }
  return { ok: true, doc: { version: current.version + 1, content: patch.content } }
}
