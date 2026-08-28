'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Props {
  merchant: any
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function MerchantSpecials({ merchant }: Props) {
  const [specials, setSpecials] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [discount, setDiscount] = useState('')
  const [minGroup, setMinGroup] = useState('4')
  const [availableDays, setAvailableDays] = useState<number[]>([1, 2, 3, 4])
  const [availableTimes, setAvailableTimes] = useState('')
  const [terms, setTerms] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { loadSpecials() }, [])

  async function loadSpecials() {
    const { data } = await supabase
      .from('knot_specials')
      .select('*')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false })
    setSpecials(data || [])
    setLoading(false)
  }

  function toggleDay(day: number) {
    setAvailableDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    )
  }

  async function saveSpecial() {
    if (!title.trim()) { setError('Please enter a title for the special.'); return }
    if (!discount || isNaN(parseInt(discount))) { setError('Please enter a valid discount percentage.'); return }
    setSaving(true); setError('')
    const { error: insertError } = await supabase.from('knot_specials').insert({
      merchant_id: merchant.id,
      title: title.trim(),
      description: description.trim() || null,
      discount_percent: parseInt(discount),
      min_group_size: parseInt(minGroup) || 4,
      available_days: availableDays.sort(),
      available_times: availableTimes.trim() || null,
      terms: terms.trim() || null,
      active: true,
    })
    if (insertError) { setError(insertError.message); setSaving(false); return }
    setSaving(false)
    setShowForm(false)
    setTitle(''); setDescription(''); setDiscount(''); setMinGroup('4')
    setAvailableDays([1,2,3,4]); setAvailableTimes(''); setTerms('')
    loadSpecials()
  }

  async function toggleSpecial(id: string, active: boolean) {
    await supabase.from('knot_specials').update({ active: !active }).eq('id', id)
    loadSpecials()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Knot Specials</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>Exclusive deals for confirmed Knot groups. Only visible inside the app.</div>
        </div>
        <button onClick={() => setShowForm(true)}
          style={{ padding: '9px 16px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: 'var(--text)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          + New Special
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'var(--bg2)', border: '1.5px solid var(--yellow)', borderRadius: 12, padding: '20px', marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Create a Knot Special</div>

          {error && (
            <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>Special title</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. 15% off for groups of 4+"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>Description (optional)</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Any details about what is included..."
              rows={2}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>Discount %</label>
              <input value={discount} onChange={e => setDiscount(e.target.value)}
                type="number" min="1" max="100" placeholder="e.g. 15"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>Minimum group size</label>
              <input value={minGroup} onChange={e => setMinGroup(e.target.value)}
                type="number" min="2" max="50" placeholder="e.g. 4"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 8 }}>Available days</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {DAYS.map((d, i) => (
                <button key={d} onClick={() => toggleDay(i)}
                  style={{ flex: 1, padding: '7px 4px', borderRadius: 6, border: availableDays.includes(i) ? '1px solid var(--yellow)' : '1px solid var(--border)', background: availableDays.includes(i) ? '#FFFBEB' : 'transparent', color: availableDays.includes(i) ? '#D97706' : 'var(--text3)', fontSize: 11, fontWeight: availableDays.includes(i) ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>Available times (optional)</label>
            <input value={availableTimes} onChange={e => setAvailableTimes(e.target.value)}
              placeholder="e.g. 5pm - 8pm only"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>Terms and conditions (optional)</label>
            <input value={terms} onChange={e => setTerms(e.target.value)}
              placeholder="e.g. Dine-in only. Not valid on public holidays."
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setShowForm(false); setError('') }}
              style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text2)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancel
            </button>
            <button onClick={saveSpecial} disabled={saving}
              style={{ flex: 2, padding: '10px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: 'var(--text)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving...' : 'Publish Special'}
            </button>
          </div>
        </div>
      )}

      {loading && <div style={{ color: 'var(--text3)', fontSize: 14 }}>Loading...</div>}

      {!loading && specials.length === 0 && !showForm && (
        <div style={{ textAlign: 'center', padding: '48px 20px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 32, marginBottom: 12, color: 'var(--text3)' }}><i className="ti ti-target" /></div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>No Specials yet</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>Create your first Knot Special to attract group bookings on your slow nights.</div>
          <button onClick={() => setShowForm(true)}
            style={{ padding: '10px 20px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: 'var(--text)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Create your first Special
          </button>
        </div>
      )}

      {!loading && specials.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {specials.map(s => (
            <div key={s.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px', opacity: s.active ? 1 : 0.5, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ padding: '2px 8px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 20, fontSize: 12, fontWeight: 700, color: '#D97706' }}>
                      {s.discount_percent}% off
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{s.title}</span>
                  </div>
                  {s.description && <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 4 }}>{s.description}</div>}
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                    Min {s.min_group_size} people
                    {s.available_times ? ' · ' + s.available_times : ''}
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                    {DAYS.map((d, i) => (
                      s.available_days?.includes(i) && (
                        <span key={d} style={{ padding: '2px 6px', background: '#F5F5F5', borderRadius: 4, fontSize: 11, color: 'var(--text2)' }}>{d}</span>
                      )
                    ))}
                  </div>
                </div>
                <button onClick={() => toggleSpecial(s.id, s.active)}
                  style={{ padding: '6px 12px', background: s.active ? '#F0FDF4' : '#F5F5F5', border: s.active ? '1px solid #BBF7D0' : '1px solid var(--border)', borderRadius: 6, color: s.active ? 'var(--sage)' : 'var(--text3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, marginLeft: 12 }}>
                  {s.active ? 'Live' : 'Paused'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
