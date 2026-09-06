import { Room } from '@/components/Room'

export default async function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>
}) {
  const { roomId } = await params
  const slug =
    roomId
      .replace(/[^a-zA-Z0-9-]/g, '')
      .slice(0, 80) || 'room'
  return <Room roomId={slug} />
}
