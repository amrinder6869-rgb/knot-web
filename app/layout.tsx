import type { Metadata } from 'next'
import { Manrope } from 'next/font/google'
import './globals.css'

const manrope = Manrope({ subsets: ['latin'], weight: ['400','500','600','700','800'] })

export const metadata: Metadata = {
  title: 'Knot – Your Private Circle',
  description: 'The private social layer for people who actually know each other.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={manrope.className}>{children}</body>
    </html>
  )
}