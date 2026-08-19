'use client'
import { useState, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { compressImage } from '@/lib/compressImage'

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
  expectedHeadcount?: number
  restrictionsNote?: string
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
    recurringInterval: string,
    receiptHash?: string
  ) => void
  onCancel?: () => void
  theme?: 'light' | 'dark'
}

function getInitials(name: string) {
  return (name || 'U').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
}

// Simple djb2-style hash over the OCR'd item list plus total, used to flag
// likely-duplicate receipts. Not cryptographic — just needs to be stable and
// cheap to compute client-side.
function computeReceiptHash(items: string[], total: number): string {
  const input = items.join('|') + '|' + total.toFixed(2)
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(16)
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
  expectedHeadcount,
  restrictionsNote,
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
  const [photoUrl, setPhotoUrl]       = useState(defaultPhotoUrl)
  const [previewUrl, setPreviewUrl]   = useState(defaultPhotoUrl)
  const [uploading, setUploading]     = useState(false)
  const [scanning, setScanning]       = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [ocrItems, setOcrItems]       = useState<string[]>([])
  const [receiptHash, setReceiptHash] = useState<string>('')
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
    (mode === 'equal' || percentageValid) && !submitting && !uploading && !scanning

  function handleSubmit() {
    if (!canSubmit) return
    onSubmit(desc.trim(), parsedAmount, splits, category, note.trim(), photoUrl, isRecurring, recurringInterval, receiptHash || undefined)
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setScanning(true)
    setUploadError('')
    setOcrItems([])
    setPreviewUrl(URL.createObjectURL(file))

    try {
      const compressed = await compressImage(file)
      const reader = new FileReader()
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(compressed)
      })
      const res = await fetch('/api/parse-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mediaType: compressed.type }),
      })
      if (res.ok) {
        const parsed = await res.json()
        if (parsed.total && !isNaN(parsed.total)) setAmount(String(parsed.total))
        if (parsed.description && !desc) setDesc(parsed.description)
        if (parsed.category) setCategory(parsed.category as BillCategory)
        if (parsed.items?.length) {
          setOcrItems(parsed.items)
          setReceiptHash(computeReceiptHash(parsed.items, parsed.total && !isNaN(parsed.total) ? parsed.total : 0))
        }
      }
    } catch { /* silent */ }

    setScanning(false)

    const ext = file.name.split('.').pop()
    const fileName = `bill-receipts/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('knot-photos').upload(fileName, file, { upsert: true })
    if (upErr) { setUploadError('Photo upload failed. Scanned data was saved.'); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('knot-photos').getPublicUrl(fileName)
    setPhotoUrl(urlData.publicUrl)
    setUploading(false)
  }

  return (
    <div>
      {(error || uploadError) && (
        <div style={{ padding: '8px 12px', background: 'var(--yellow-soft)', border: '1px solid var(--yellow-dim)', borderRadius: 8, fontSize: 12, color: 'var(--yellow)', marginBottom: 12 }}>
          {error || uploadError}
        </div>
      )}

      {restrictionsNote && (
        <div style={{ padding: '8px 12px', background: inputBg, border: `1px solid ${borderCol}`, borderRadius: 8, fontSize: 12, color: subColor, marginBottom: 12 }}>
          {restrictionsNote}
        </div>
      )}

      {/* SCAN RECEIPT at top */}
      <div style={{ marginBottom: 16 }}>
        {scanning ? (
          <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--yellow-soft)', border: '1px solid var(--yellow-dim)', display: 'flex', alignItems: 'center', gap: 12 }}>
            {previewUrl && <img src={previewUrl} alt="Receipt" style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--yellow)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--yellow)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                Scanning receipt...
              </div>
              <div style={{ fontSize: 11, color: 'var(--yellow)', opacity: 0.7, marginTop: 2 }}>Filling in the details for you</div>
            </div>
          </div>
        ) : (photoUrl || previewUrl) ? (
          <div style={{ padding: '10px 12px', borderRadius: 10, background: inputBg, border: `1px solid ${borderCol}`, display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src={previewUrl || photoUrl} alt="Receipt" style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: textColor }}>Receipt attached</div>
              {ocrItems.length > 0 && (
                <div style={{ fontSize: 11, color: subColor, marginTop: 2 }}>
                  {String.fromCodePoint(0x2728)} {ocrItems.slice(0, 2).join(', ')}{ocrItems.length > 2 ? ` +${ocrItems.length - 2} more` : ''}
                </div>
              )}
            </div>
            <button onClick={() => { setPhotoUrl(''); setPreviewUrl(''); setOcrItems([]); setReceiptHash('') }}
              style={{ padding: '4px 10px', background: 'transparent', border: `1px solid ${borderCol}`, borderRadius: 6, color: subColor, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
              Remove
            </button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 10,
              border: `1.5px dashed ${borderCol}`, background: 'transparent',
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}>
            <span style={{ fontSize: 22 }}>{String.fromCodePoint(0x1F4F7)}</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: textColor }}>Scan receipt to autofill</div>
              <div style={{ fontSize: 11, color: subColor, marginTop: 1 }}>Or fill in the details below manually</div>
            </div>
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
      </div>

      {/* Category */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: subColor, marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Category</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => setCategory(cat.id as BillCategory)}
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

      {ocrItems.length > 0 && (
        <div style={{ padding: '8px 12px', background: inputBg, border: `1px solid ${borderCol}`, borderRadius: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: subColor, marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{String.fromCodePoint(0x2728)} Scanned items</div>
          {ocrItems.map((item, i) => (
            <div key={i} style={{ fontSize: 12, color: textColor, padding: '2px 0' }}>{item}</div>
          ))}
        </div>
      )}

      <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note (optional)" rows={2}
        style={{ width: '100%', padding: '9px 12px', background: inputBg, border: `1px solid ${borderCol}`, borderRadius: 8, color: textColor, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'none', marginBottom: 8 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '8px 10px', background: inputBg, border: `1px solid ${borderCol}`, borderRadius: 8 }}>
        <button onClick={() => setIsRecurring(v => !v)}
          style={{ width: 32, height: 18, borderRadius: 9, border: 'none', cursor: 'pointer', padding: 0, background: isRecurring ? 'var(--yellow)' : 'var(--border2)', position: 'relative', flexShrink: 0 }}>
          <span style={{ position: 'absolute', top: 2, left: isRecurring ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
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

      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {(['equal', 'percentage'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            style={{
              padding: '6px 12px', borderRadius: 6,
              border: `1px solid ${mode === m ? 'var(--yellow)' : borderCol}`,
              background: mode === m ? 'var(--yellow-soft)' : 'transparent',
              color: mode === m ? 'var(--yellow)' : subColor,
              fontSize: 12, fontWeight: mode === m ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit',
            }}>
            {m === 'equal' ? 'Split equally' : 'Split by percentage'}
          </button>
        ))}
      </div>

      <div style={{ marginBottom: 10 }}>
        {members.map(m => {
          const isSelected = selected.has(m.id)
          const share = splits.find(s => s.user_id === m.id)?.amount
          return (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', opacity: isSelected ? 1 : 0.4 }}>
              <button onClick={() => toggleMember(m.id)}
                style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, border: `1.5px solid ${isSelected ? 'var(--yellow)' : borderCol}`, background: isSelected ? 'var(--yellow)' : 'transparent', color: '#111', fontSize: 11, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', padding: 0 }}>
                {isSelected ? '\u2713' : ''}
              </button>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--yellow)', color: '#111', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {getInitials(m.name)}
              </div>
              <span style={{ flex: 1, fontSize: 12, color: textColor }}>{m.name}</span>
              {mode === 'percentage' && isSelected ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="number" value={percentages[m.id] || ''} onChange={e => setPercent(m.id, e.target.value)} placeholder="0"
                    style={{ width: 48, padding: '4px 6px', background: inputBg, border: `1px solid ${borderCol}`, borderRadius: 6, color: textColor, fontSize: 12, outline: 'none', fontFamily: 'inherit', textAlign: 'right' }} />
                  <span style={{ fontSize: 11, color: subColor }}>%</span>
                </div>
              ) : (
                isSelected && validAmount && <span style={{ fontSize: 12, color: subColor, fontWeight: 600 }}>${(share || 0).toFixed(2)}</span>
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
      {expectedHeadcount !== undefined && expectedHeadcount > members.length && (
        <div style={{ fontSize: 11, color: 'var(--yellow)', marginBottom: 10 }}>
          Party size is {expectedHeadcount} — includes guests
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

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
