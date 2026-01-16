import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Echo Pages - Audiobook App',
  description: 'Invite-only audiobook generation app',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
