'use client'
import { useState, useEffect } from 'react'
import MerchantSpecials from './MerchantSpecials'
import { supabase } from '@/lib/supabase'

interface Props {
  merchant: any
  user: any
  onUpdate: (m: any) => void
}

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (s < 60) return 'Just now'
  if (s < 3600) return Math.floor(s / 60) + 'm ago'
  if (s < 86400) return Math.floor(s / 3600) + 'h ago'
  return Math.floor(s / 86400) + 'd ago'
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function MerchantHome({ merchant, user, onUpdate }: Props) {
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'bookings' | 'specials' | 'profile'>('bookings')
  const [updatingBooking, setUpdatingBooking] = useState<string | null>(null)

  useEffect(() => {
    loadBookings()
    const channel = supabase
      .channel('merchant_bookings:' + merchant.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'merchant_bookings', filter: 'merchant_id=eq.' + merchant.id }, () => loadBookings())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [merchant.id])

  async function loadBookings() {
    const { data } = await supabase
      .from('merchant_bookings')
      .select('*, knot:knot_id(name, emoji)')
      .eq('merchant_id', merchant.id)
      .order('scheduled_for', { ascending: true })
    setBookings(data || [])
    setLoading(false)
  }

  async function updateBookingStatus(id: string, status: string) {
    setUpdatingBooking(id)
    await supabase.from('merchant_bookings').update({ status }).eq('id', id)
    setUpdatingBooking(null)
    loadBookings()
  }

  const pending = bookings.filter(b => b.status === 'pending')
  const confirmed = bookings.filter(b => b.status === 'confirmed')
  const past = bookings.filter(b => b.status === 'cancelled' || b.status === 'declined' || (b.scheduled_for && new Date(b.scheduled_for) < new Date()))

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px' }}>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Pending', value: pending.length, color: '#F8BD03' },
          { label: 'Confirmed upcoming', value: confirmed.length, color: '#22C55E' },
          { label: 'Total bookings', value: bookings.length, color: '#6366F1' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 12, padding: '16px' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #E5E5E5' }}>
        {([
          { id: 'bookings', label: 'Bookings' },
          { id: 'specials', label: 'Knot Specials' },
          { id: 'profile', label: 'Profile' },
        ] as { id: 'bookings' | 'specials' | 'profile', label: string }[]).map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ padding: '10px 16px', background: 'none', border: 'none', borderBottom: activeTab === t.id ? '2px solid #F8BD03' : '2px solid transparent', color: activeTab === t.id ? '#F8BD03' : '#888', fontSize: 14, fontWeight: activeTab === t.id ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', marginBottom: -1 }}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'bookings' && (
        <div>
          {loading && <div style={{ color: '#888', fontSize: 14 }}>Loading bookings...</div>}

          {!loading && pending.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#F8BD03', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Needs your response</div>
              {pending.map(b => (
                <div key={b.id} style={{ background: '#fff', border: '1.5px solid #F8BD03', borderRadius: 12, padding: '16px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>
                        {b.knot?.emoji} {b.knot?.name || 'Group booking'}
                      </div>
                      <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>
                        {b.group_size} people {b.scheduled_for ? '· ' + formatDate(b.scheduled_for) : ''}
                      </div>
                      {b.notes && <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{b.notes}</div>}
                    </div>
                    <div style={{ fontSize: 11, color: '#aaa' }}>{timeAgo(b.created_at)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => updateBookingStatus(b.id, 'confirmed')} disabled={updatingBooking === b.id}
                      style={{ flex: 1, padding: '9px', background: '#22C55E', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: updatingBooking === b.id ? 0.6 : 1 }}>
                      Confirm
                    </button>
                    <button onClick={() => updateBookingStatus(b.id, 'declined')} disabled={updatingBooking === b.id}
                      style={{ flex: 1, padding: '9px', background: 'transparent', border: '1px solid #E5E5E5', borderRadius: 8, color: '#DC2626', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', opacity: updatingBooking === b.id ? 0.6 : 1 }}>
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && confirmed.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#22C55E', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Confirmed upcoming</div>
              {confirmed.map(b => (
                <div key={b.id} style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 12, padding: '16px', marginBottom: 10 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>
                    {b.knot?.emoji} {b.knot?.name || 'Group booking'}
                  </div>
                  <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>
                    {b.group_size} people {b.scheduled_for ? '· ' + formatDate(b.scheduled_for) : ''}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && bookings.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 20px' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111', marginBottom: 6 }}>No bookings yet</div>
              <div style={{ fontSize: 13, color: '#888' }}>Bookings from Knot groups will appear here when they choose your restaurant.</div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'specials' && <MerchantSpecials merchant={merchant} />}

      {activeTab === 'profile' && (
        <div style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 12, padding: '20px' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 16 }}>Your profile</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Restaurant name', value: merchant.name },
              { label: 'Address', value: merchant.address || 'Not set' },
              { label: 'Cuisine', value: merchant.cuisine || 'Not set' },
              { label: 'Capacity', value: merchant.capacity ? merchant.capacity + ' seats' : 'Not set' },
              { label: 'Phone', value: merchant.phone || 'Not set' },
            ].map(f => (
              <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F5F5F5' }}>
                <span style={{ fontSize: 13, color: '#888' }}>{f.label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{f.value}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, padding: '10px 14px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, fontSize: 13, color: '#16A34A' }}>
            Your restaurant is live on Knot. Groups near you can discover and book you.
          </div>
        </div>
      )}
    </div>
  )
}
