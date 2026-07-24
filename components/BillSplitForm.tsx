'use client'
import { useState, useMemo } from 'react'

type Member = { id: string; name: string }
type SplitLine = { user_id: string; amount: number }

type BillSplitFormProps = {
  members: Member[]
  defaultSelectedIds?: string[]
  submitLabel?: string
  submitting?: boolean
  error?: string
  onSubmit: (desc: string, amount: number, splits: SplitLine[]) => void
  onCancel?: () => void
  theme?: 'light' | 'dark'
}

function getInitials(name: string) {
  return (name || 'U').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
}

export default function BillSplitForm({
  members,
  defaultSelectedIds,
  submitLabel = 'Post bill',
  submitting = false,
  error = '',
  onSubmit,
  onCancel,
  theme = 'light',
}: BillSplitFormProps) {
  const [desc, setDesc]     = useState('')
  const [amount, setAmount] = useState('')
  const [mode, setMode]     = useState<'equal' | 'percentage'>('equal')
  const [selected, setSelected] = useState<Set<string>>(
    new Set(defaultSelectedIds && defaultSelectedIds.length > 0 ? defaultSelectedIds : members.map(m => m.id))
  )
  const [percentages, setPercentages] = useState<Record<string, string>>({})

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

  const canSubmit = desc.trim() && validAmount && selectedMembers.length > 0 && (mode === 'equal' || percentageValid) && !submitting

  function handleSubmit() {
    if (!canSubmit) return
    onSubmit(desc.trim(), parsedAmount, splits)
  }

  return (
    <div>
      {error && (
        <div style={{ padding: '8px 12px', background: 'var(--yellow-soft)', border: '1px solid var(--yellow-dim)', borderRadius: 8, fontSize: 12, color: 'var(--yellow)', marginBottom: 10 }}>
          {error}
        </div>
      )}

      <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="What was the bill for?"
        style={{ width: '100%', padding: '9px 12px', background: inputBg, border: `1px solid ${borderCol}`, borderRadius: 8, color: textColor, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 8 }} />

      <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Total amount"
        style={{ width: '100%', padding: '9px 12px', background: inputBg, border: `1px solid ${borderCol}`, borderRadius: 8, color: textColor, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 10 }} />

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
          ${(parsedAmount / selectedMembers.length).toFixed(2)} each \u00B7 {selectedMembers.length} people
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
