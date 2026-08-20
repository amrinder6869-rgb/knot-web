import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Knot for Business',
  description: 'Manage your restaurant on Knot',
}

export default function MerchantLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'Manrope, sans-serif' }}>
      {children}
    </div>
  )
}
