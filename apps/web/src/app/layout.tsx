import type { Metadata, Viewport } from 'next'
import './globals.css'
import { VitalsReporter } from '@/components/VitalsReporter'

export const metadata: Metadata = {
  title: 'Caderno — real-time collaborative notes',
  description:
    'A real-time collaborative notebook with presence, conflict-aware sync and an AI assistant.',
}

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        {children}
        <VitalsReporter />
      </body>
    </html>
  )
}
