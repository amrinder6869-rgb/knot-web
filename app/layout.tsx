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
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.34.1/dist/tabler-icons.min.css" />
        <meta name="theme-color" content="#F8BD03" />
      </head>
      <body className={manrope.className}>
        <ToastProvider>{children}</ToastProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  )
}