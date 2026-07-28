'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import MerchantOnboarding from '@/components/merchant/MerchantOnboarding'
import MerchantHome from '@/components/merchant/MerchantHome'

export default function MerchantDashboard() {
  const [user, setUser] = useState<any>(null)
  const [merchant, setMerchant] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = '/merchant'; return }
      setUser(data.user)

      const { data: m } = await supabase
        .from('merchants')
        .select('*')
        .eq('owner_id', data.user.id)
        .single()

      setMerchant(m || null)
      setLoading(false)
    })
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/merchant'
  }

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Manrope, sans-serif', color: '#666', fontSize: 14 }}>
      Loading...
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFA', fontFamily: 'Manrope, sans-serif' }}>
      {/* Top nav */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E5E5E5', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="20" height="20" viewBox="0 0 44 44" fill="none">
            <circle cx="17" cy="17" r="10" stroke="#F8BD03" strokeWidth="3" fill="none"/>
            <circle cx="27" cy="27" r="10" stroke="#F8BD03" strokeWidth="3" fill="none" opacity="0.5"/>
          </svg>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#111' }}>
            kn<span style={{ color: '#F8BD03' }}>o</span>t <span style={{ fontSize: 12, fontWeight: 500, color: '#888' }}>for business</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {merchant && <span style={{ fontSize: 13, color: '#555', fontWeight: 500 }}>{merchant.name}</span>}
          <button onClick={signOut}
            style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #E5E5E5', borderRadius: 6, color: '#555', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            Sign out
          </button>
        </div>
      </div>

      {/* Content */}
      {!merchant || !merchant.onboarded
        ? <MerchantOnboarding user={user} onComplete={(m) => setMerchant(m)} />
        : <MerchantHome merchant={merchant} user={user} onUpdate={(m) => setMerchant(m)} />
      }
    </div>
  )
}
