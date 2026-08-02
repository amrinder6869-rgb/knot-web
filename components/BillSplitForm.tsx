'use client'
import { useState, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'

type Member = { id: string; name: string }
type SplitLine = { user_id: string; amount: number }

export type BillCategory = 'dinner' | 'drinks' | 'transport' | 'accommodation' | 'activities' | 'other'

const CATEGORIES: { id: BillCategory; label: string; icon: string }[] = [
  { id: 'dinner',        label: 'Dinner',        icon: String.fromCodePoint(0x1F37D) },
  { id: 'drinks',        label: 'Drinks',        icon: String.fromCodePoint(0x1F37A) },
  { id: 'transport',     label: 'Transport',     icon: String.fromCodePoint(0x1F697) },
  { id: 'accommodation', label: 'Stay',          icon: String.fromCodePoint(0x1F3E8) },
  { id: 'activities',    label: 'Activities',    icon: String.fromCodePoint(0x1F3A8) },
  { id: 'other',         label: 'Other',         icon: String.fromCodePoint(0x1F4CB) },
]

type BillSplitFormProps = {
  members: Member[]
  defaultSelectedIds?: string[]
  defaultDesc?: string
  defaultAmount?: number
  defaultCategory?: BillCategory
  defaultNote?: string
  defaultPhotoUrl?: string
  defaultIsRecurring?: boolean
  defaultRecurringInterval?: string
  submitLabel?: string
  submitting?: boolean
  error?: string
  onSubmit: (
    desc: string,
    amount: number,
    splits: SplitLine[],
    category: BillCategory,
    note: string,
    photoUrl: string,
    isRecurring: boolean,
    recurringInterval: string
  ) => void
  onCancel?: () => void
  theme?: 'light' | 'dark'
}

function getInitials(name: string) {
  return (name || 'U').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
}

export default function BillSplitForm({
  members,
  defaultSelectedIds,
  defaultDesc = '',
  defaultAmount,
  defaultCategory = 'other',
  defaultNote = '',
  defaultPhotoUrl = '',
  defaultIsRecurring = false,
  defaultRecurringInterval = 'monthly',
  submitLabel = 'Post bill',
  submitting = false,
  error = '',
  onSubmit,
  onCancel,
  theme = 'light',
}: BillSplitFormProps) {
  const [desc, setDesc]         = useState(defaultDesc)
  const [amount, setAmount]     = useState(defaultAmount !== undefined ? String(defaultAmount) : '')
  const [category, setCategory] = useState<BillCategory>(defaultCategory)
  const [note, setNote]         = useState(defaultNote)
  const [photoUrl, setPhotoUrl] = useState(defaultPhotoUrl)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [isRecurring, setIsRecurring] = useState(defaultIsRecurring)
  const [recurringInterval, setRecurringInterval] = useState(defaultRecurringInterval)
  const [mode, setMode]         = useState<'equal' | 'percentage'>('equal')
  const [selected, setSelected] = useState<Set<string>>(
    new Set(defaultSelectedIds && defaultSelectedIds.length > 0 ? defaultSelectedIds : members.map(m => m.id))
  )
  const [percentages, setPercentages] = useState<Record<string, string>>({})
  const fileRef = useRef<HTMLInputElement>(null)

  const isDark = theme === 'dark'
  const textColor = isDark ? '#fff' : 'var(--text)'
  const subColor  = isDark ? 'rgba(255,255,255,0.45)' : 'var(--text3)'
  const inputBg   = isDark ? 'rgba(255,255,255,0.06)' : 'var(--bg2)'
  const borderCol = isDark ? 'rgba(255,255,255,0.12)' : 'var(--border)'

  const parsedAmount = parseFloat(amount)
  const validAmount  = !isNaN(parsedAmount) && parsedAmount > 0
  const selectedMembers = members.filter(m => selected.has(m.id))

  function toggleMember(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function setPercent(id: string, val: string) {
    setPercentages(prev => ({ ...prev, [id]: val }))
  }

  const percentageSum = useMemo(() => {
    return selectedMembers.reduce((sum, m) => sum + (parseFloat(percentages[m.id]) || 0), 0)
  }, [percentages, selectedMembers])

  const percentageValid = Math.abs(percentageSum - 100) < 0.5

  const splits: SplitLine[] = useMemo(() => {
    if (!validAmount || selectedMembers.length === 0) return []
    if (mode === 'equal') {
      const share = parsedAmount / selectedMembers.length
      return selectedMembers.map(m => ({ user_id: m.id, amount: Math.round(share * 100) / 100 }))
    }
    return selectedMembers.map(m => {
      const pct = parseFloat(percentages[m.id]) || 0
      return { user_id: m.id, amount: Math.round((parsedAmount * pct / 100) * 100) / 100 }
    })
  }, [mode, parsedAmount, validAmount, selectedMembers, percentages])

  const canSubmit = desc.trim() && validAmount && selectedMembers.length > 0 &&
    (mode === 'equal' || percentageValid) && !submitting && !uploading

  function handleSubmit() {
    if (!canSubmit) return
    onSubmit(desc.trim(), parsedAmount, splits, category, note.trim(), photoUrl, isRecurring, recurringInterval)
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError('')
    const ext = file.name.split('.').pop()
    const fileName = `bill-receipts/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('knot-photos').upload(fileName, file, { upsert: true })
    if (upErr) {
      setUploadError('Photo upload failed. Try again.')
      setUploading(false)
      return
    }
    const { data: urlData } = supabase.storage.from('knot-photos').getPublicUrl(fileName)
    setPhotoUrl(urlData.publicUrl)
    setUploading(false)
  }

  return (
    <div>
      {(error || uploadError) && (
        <div style={{ padding: '8px 12px', background: 'var(--yellow-soft)', border: '1px solid var(--yellow-dim)', borderRadius: 8, fontSize: 12, color: 'var(--yellow)', marginBottom: 10 }}>
          {error || uploadError}
        </div>
      )}

      {/* Category picker */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: subColor, marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Category</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => setCategory(cat.id)}
              style={{
                padding: '5px 10px', borderRadius: 20,
                border: `1px solid ${category === cat.id ? 'var(--yellow)' : borderCol}`,
                background: category === cat.id ? 'var(--yellow-soft)' : 'transparent',
                color: category === cat.id ? 'var(--yellow)' : subColor,
                fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
              <span>{cat.icon}</span>
              <span style={{ fontWeight: category === cat.id ? 700 : 400 }}>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="What was the bill for?"
        style={{ width: '100%', padding: '9px 12px', background: inputBg, border: `1px solid ${borderCol}`, borderRadius: 8, color: textColor, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 8 }} />

      <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Total amount"
        style={{ width: '100%', padding: '9px 12px', background: inputBg, border: `1px solid ${borderCol}`, borderRadius: 8, color: textColor, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 8 }} />

      {/* Note */}
      <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note (optional)"
        rows={2}
        style={{ width: '100%', padding: '9px 12px', background: inputBg, border: `1px solid ${borderCol}`, borderRadius: 8, color: textColor, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'none', marginBottom: 8 }} />

      {/* Photo upload */}
      <div style={{ marginBottom: 10 }}>
        {photoUrl ? (
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <img src={photoUrl} alt="Receipt" style={{ height: 64, borderRadius: 8, objectFit: 'cover', display: 'block' }} />
            <button onClick={() => setPhotoUrl('')}
              style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: 'var(--danger)', color: '#fff', border: 'none', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontFamily: 'inherit' }}>
              {String.fromCodePoint(0x00D7)}
            </button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            style={{ padding: '6px 12px', background: 'transparent', border: `1px solid ${borderCol}`, borderRadius: 8, color: subColor, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            {uploading ? 'Uploading...' : String.fromCodePoint(0x1F4F7) + ' Attach receipt'}
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
      </div>

      {/* Recurring toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '8px 10px', background: inputBg, border: `1px solid ${borderCol}`, borderRadius: 8 }}>
        <button onClick={() => setIsRecurring(v => !v)}
          style={{
            width: 32, height: 18, borderRadius: 9, border: 'none', cursor: 'pointer', padding: 0,
            background: isRecurring ? 'var(--yellow)' : 'var(--border2)',
            position: 'relative', flexShrink: 0,
          }}>
          <span style={{
            position: 'absolute', top: 2, left: isRecurring ? 16 : 2,
            width: 14, height: 14, borderRadius: '50%', background: '#fff',
            transition: 'left 0.15s',
          }} />
        </button>
        <span style={{ fontSize: 12, color: textColor }}>Recurring bill</span>
        {isRecurring && (
          <select value={recurringInterval} onChange={e => setRecurringInterval(e.target.value)}
            style={{ marginLeft: 'auto', padding: '4px 8px', background: inputBg, border: `1px solid ${borderCol}`, borderRadius: 6, color: textColor, fontSize: 12, fontFamily: 'inherit', outline: 'none' }}>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Biweekly</option>
            <option value="monthly">Monthly</option>
          </select>
        )}
      </div>

      {/* Split mode toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {(['equal', 'percentage'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            style={{
              padding: '6px 12px', borderRadius: 6,
              border: `1px solid ${mode === m ? 'var(--yellow)' : borderCol}`,
              background: mode === m ? 'var(--yellow-soft)' : 'transparent',
              color: mode === m ? 'var(--yellow)' : subColor,
              fontSize: 12, fontWeight: mode === m ? 700 : 500,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
            {m === 'equal' ? 'Split equally' : 'Split by percentage'}
          </button>
        ))}
      </div>

      {/* Member list */}
      <div style={{ marginBottom: 10 }}>
        {members.map(m => {
          const isSelected = selected.has(m.id)
          const share = splits.find(s => s.user_id === m.id)?.amount
          return (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', opacity: isSelected ? 1 : 0.4 }}>
              <button onClick={() => toggleMember(m.id)}
                style={{
                  width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                  border: `1.5px solid ${isSelected ? 'var(--yellow)' : borderCol}`,
                  background: isSelected ? 'var(--yellow)' : 'transparent',
                  color: '#111', fontSize: 11, fontWeight: 800,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', padding: 0,
                }}>
                {isSelected ? '\u2713' : ''}
              </button>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--yellow)', color: '#111', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {getInitials(m.name)}
              </div>
              <span style={{ flex: 1, fontSize: 12, color: textColor }}>{m.name}</span>

              {mode === 'percentage' && isSelected ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    type="number"
                    value={percentages[m.id] || ''}
                    onChange={e => setPercent(m.id, e.target.value)}
                    placeholder="0"
                    style={{ width: 48, padding: '4px 6px', background: inputBg, border: `1px solid ${borderCol}`, borderRadius: 6, color: textColor, fontSize: 12, outline: 'none', fontFamily: 'inherit', textAlign: 'right' }}
                  />
                  <span style={{ fontSize: 11, color: subColor }}>%</span>
                </div>
              ) : (
                isSelected && validAmount && (
                  <span style={{ fontSize: 12, color: subColor, fontWeight: 600 }}>${(share || 0).toFixed(2)}</span>
                )
              )}
            </div>
          )
        })}
      </div>

      {mode === 'percentage' && (
        <div style={{ fontSize: 11, color: percentageValid ? subColor : 'var(--yellow)', marginBottom: 10 }}>
          Total: {percentageSum.toFixed(0)}% {!percentageValid && '(must add up to 100%)'}
        </div>
      )}

      {mode === 'equal' && validAmount && selectedMembers.length > 0 && (
        <div style={{ fontSize: 11, color: subColor, marginBottom: 10 }}>
          ${(parsedAmount / selectedMembers.length).toFixed(2)} each {String.fromCodePoint(0x00B7)} {selectedMembers.length} people
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        {onCancel && (
          <button onClick={onCancel} style={{ padding: '8px 14px', background: 'transparent', border: `1px solid ${borderCol}`, borderRadius: 8, color: subColor, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancel
          </button>
        )}
        <button onClick={handleSubmit} disabled={!canSubmit}
          style={{ flex: 1, padding: '8px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: canSubmit ? 'pointer' : 'not-allowed', fontFamily: 'inherit', opacity: canSubmit ? 1 : 0.5 }}>
          {submitting ? 'Posting...' : submitLabel}
        </button>
      </div>
    </div>
  )
}
