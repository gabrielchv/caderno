import { Room } from '@/components/Room'

export default async function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>
}) {
  const { roomId } = await params
  // Re-sanitize the URL segment server-side: strip anything that is not a
  // letter/digit/dash and cap length, so a hand-edited URL cannot inject
  // characters into the room key or bloat the in-memory room map.
  const slug =
    roomId
      .replace(/[^a-zA-Z0-9-]/g, '')
      .slice(0, 80) || 'room'
  return <Room roomId={slug} />
}
