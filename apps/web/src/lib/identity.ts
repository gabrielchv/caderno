export interface Identity {
  clientId: string
  name: string
  color: string
}

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
  return `u-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

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
