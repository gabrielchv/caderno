import type { PresenceUser } from '@caderno/shared'
import type { SyncStatus } from '@/hooks/useDocSync'

const STATUS_STYLE: Record<SyncStatus, { label: string; dot: string; text: string }> = {
  connecting: { label: 'Connecting', dot: 'bg-neutral-400', text: 'text-neutral-600' },
  synced: { label: 'Synced', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  syncing: { label: 'Syncing', dot: 'bg-amber-500', text: 'text-amber-700' },
  conflict: { label: 'Conflict — resyncing', dot: 'bg-rose-500', text: 'text-rose-700' },
}

export function StatusPill({ status }: { status: SyncStatus }) {
  const style = STATUS_STYLE[status]
  return (
    <span
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2.5 py-0.5 text-xs font-medium ${style.text}`}
    >
      <span aria-hidden="true" className={`size-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  )
}

export function PresenceBar({
  roster,
  myId,
}: {
  roster: PresenceUser[]
  myId: string
}) {
  return (
    <div className="flex items-center gap-2">
      <ul
        aria-label="People in this room"
        className="flex items-center -space-x-1.5"
      >
        {roster.map((user) => {
          const isMe = user.clientId === myId
          return (
            <li
              key={user.clientId}
              title={`${user.name}${isMe ? ' (you)' : ''}`}
              className={`flex size-7 items-center justify-center rounded-full text-xs font-semibold text-white ring-2 ring-white ${
                isMe ? 'ring-indigo-300' : ''
              }`}
              style={{ backgroundColor: user.color }}
            >
              <span aria-hidden="true">{user.name.charAt(0).toUpperCase()}</span>
              <span className="sr-only">{user.name}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
