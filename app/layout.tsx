import type { Metadata } from 'next'
import { Manrope } from 'next/font/google'
import { ToastProvider } from '@/components/ToastProvider'
import { ServiceWorkerRegistration } from '@/lib/ServiceWorkerRegistration'
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
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#F8BD03" />
        {/* Tabler Icons — the only icon set used in this codebase (ti ti-* classes). */}
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3/dist/tabler-icons.min.css" />
      </head>
      <body className={manrope.className}>
        <ToastProvider>{children}</ToastProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  )
}