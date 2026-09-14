export interface Identity {
  clientId: string
  name: string
  color: string
}

// Persisted in localStorage so a browser keeps its name/color across reloads
// and tabs. The key is namespaced to avoid colliding with other apps on the
// same origin.
const STORAGE_KEY = 'caderno:identity'
const NAMES = ['Ari', 'Bia', 'Caio', 'Duda', 'Erik', 'Fana', 'Guga', 'Hana', 'Ivo', 'Jade']
const COLORS = [
  '#e11d48',
  '#ea580c',
  '#ca8a04',
  '#4d7c0f',
  '#0d9488',
  '#2563eb',
  '#7c3aed',
  '#c026d3',
]

function randomClientId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  // Fallback for very old browsers / non-secure contexts without crypto.randomUUID.
  return `u-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

// Deterministic pick: a Java-style 31-multiplier hash over the seed selects the
// same name/color for the same clientId, so a user is not renamed mid-session.
function pick<T>(arr: T[], seed: string): T {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0
  return arr[Math.abs(h) % arr.length] ?? arr[0]!
}

function createIdentity(existing?: Partial<Identity>): Identity {
  const clientId = existing?.clientId ?? randomClientId()
  return {
    clientId,
    name: existing?.name ?? pick(NAMES, clientId),
    color: existing?.color ?? pick(COLORS, clientId),
  }
}

export function getIdentity(): Identity {
  // Server render has no localStorage and no stable user yet; a fresh identity
  // is fine because client render replaces it with the persisted one below.
  if (typeof window === 'undefined') return createIdentity()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Identity>
      if (parsed.clientId && typeof parsed.clientId === 'string') {
        return createIdentity(parsed)
      }
    }
  } catch {
    // corrupt entry — rebuild below
  }
  const identity = createIdentity()
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(identity))
  return identity
}

export function setIdentityName(name: string): Identity {
  const next = createIdentity({ ...getIdentity(), name: name.trim().slice(0, 24) })
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}
