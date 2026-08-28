'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import MemberAvatar from '@/components/MemberAvatar'
import {
  BILLS_ITEMISER_TITLE,
  BILLS_ITEMISER_ADD,
  BILLS_ITEMISER_CONFIRM,
  BILLS_ITEMISER_TOTAL_MATCH,
  BILLS_ITEMISER_TOTAL_MISMATCH,
} from '@/lib/copy'

type LineItem = {
  id: string
  description: string
  amount: number
  assignedUserIds: string[]
}

export interface BillItemiserProps {
  billId?: string
  totalAmount: number
  members: any[]
  currentUser: any
  payerId?: string
  initialItems?: { description: string; amount: number }[]
  onComplete: () => void
  onCancel: () => void
}

function newItemId() {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export default function BillItemiser({
  billId,
  totalAmount,
  members,
  currentUser,
  payerId,
  initialItems,
  onComplete,
  onCancel,
}: BillItemiserProps) {
  const settledUserId = payerId || currentUser?.id
  const [items, setItems] = useState<LineItem[]>(() =>
    (initialItems || []).map(item => ({
      id: newItemId(),
      description: item.description,
      amount: item.amount,
      assignedUserIds: [],
    })),
  )
  const [descInput, setDescInput] = useState('')
  const [amountInput, setAmountInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(!!billId)
  const [alreadyItemised, setAlreadyItemised] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!billId) {
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      const { data, error: fetchError } = await supabase
        .from('bill_line_items')
        .select('id')
        .eq('bill_id', billId)
        .limit(1)
      if (cancelled) return
      if (fetchError) {
        setError('Could not load existing line items.')
        setLoading(false)
        return
      }
      if (data && data.length > 0) {
        setAlreadyItemised(true)
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [billId])

  const itemsTotal = useMemo(
    () => items.reduce((sum, item) => sum + item.amount, 0),
    [items],
  )

  const memberTotals = useMemo(() => {
    const totals = new Map<string, number>()
    for (const m of members) totals.set(m.id, 0)
    for (const item of items) {
      if (item.assignedUserIds.length === 0) continue
      const share = item.amount / item.assignedUserIds.length
      for (const userId of item.assignedUserIds) {
        totals.set(userId, (totals.get(userId) || 0) + share)
      }
    }
    return totals
  }, [items, members])

  const allAssigned = items.length > 0 && items.every(item => item.assignedUserIds.length > 0)
  const totalMatches = Math.abs(itemsTotal - totalAmount) <= 0.5
  const canConfirm = allAssigned && totalMatches && !saving && !alreadyItemised && !loading

  function addItem() {
    const description = descInput.trim()
    const amount = parseFloat(amountInput)
    if (!description || isNaN(amount) || amount <= 0) return
    setItems(prev => [...prev, { id: newItemId(), description, amount, assignedUserIds: [] }])
    setDescInput('')
    setAmountInput('')
  }

  function toggleAssign(itemId: string, userId: string) {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      const has = item.assignedUserIds.includes(userId)
      return {
        ...item,
        assignedUserIds: has
          ? item.assignedUserIds.filter(id => id !== userId)
          : [...item.assignedUserIds, userId],
      }
    }))
  }

  async function confirmSplit() {
    if (!canConfirm || !currentUser?.id || !billId) return
    setSaving(true)
    setError('')

    try {
      const { data: existing } = await supabase
        .from('bill_line_items')
        .select('id')
        .eq('bill_id', billId)
        .limit(1)
      if (existing && existing.length > 0) {
        setAlreadyItemised(true)
        setError('This bill has already been itemised.')
        setSaving(false)
        return
      }

      const insertedItems: { id: string; amount: number; assignedUserIds: string[] }[] = []

      for (const item of items) {
        const { data: row, error: insertError } = await supabase
          .from('bill_line_items')
          .insert({ bill_id: billId, description: item.description, amount: item.amount })
          .select('id')
          .single()
        if (insertError || !row) {
          setError('Could not save line items. Try again.')
          setSaving(false)
          return
        }
        insertedItems.push({ id: row.id, amount: item.amount, assignedUserIds: item.assignedUserIds })
      }

      for (const item of insertedItems) {
        const share = item.amount / item.assignedUserIds.length
        const assignments = item.assignedUserIds.map(userId => ({
          line_item_id: item.id,
          user_id: userId,
          share: Math.round(share * 100) / 100,
        }))
        const { error: assignError } = await supabase.from('bill_line_item_assignments').insert(assignments)
        if (assignError) {
          setError('Could not save item assignments. Try again.')
          setSaving(false)
          return
        }
      }

      const splitRows = members
        .map(m => ({
          user_id: m.id,
          amount: Math.round((memberTotals.get(m.id) || 0) * 100) / 100,
        }))
        .filter(row => row.amount > 0)

      await supabase.from('bill_splits').delete().eq('bill_id', billId)
      const { error: splitsError } = await supabase.from('bill_splits').insert(
        splitRows.map(row => ({
          bill_id: billId,
          user_id: row.user_id,
          amount: row.amount,
          settled: row.user_id === settledUserId,
        })),
      )
      if (splitsError) {
        setError('Items saved, but bill splits failed to update.')
        setSaving(false)
        return
      }

      await supabase.from('bills').update({ split_type: 'itemised' }).eq('id', billId)
      onComplete()
    } catch {
      setError('Something went wrong. Try again.')
      setSaving(false)
    }
  }

  return (
    <>
      <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 420 }} />
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 421,
        background: '#fff', borderRadius: '16px 16px 0 0', boxShadow: '0 -8px 32px rgba(0,0,0,0.18)',
        maxWidth: 480, margin: '0 auto', maxHeight: '85vh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '12px 16px 0', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)', margin: '4px auto 12px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{BILLS_ITEMISER_TITLE}</div>
            <button type="button" onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          </div>
          <div style={{ fontSize: 12, color: totalMatches ? 'var(--sage)' : 'var(--danger)', marginBottom: 12 }}>
            {totalMatches ? BILLS_ITEMISER_TOTAL_MATCH : BILLS_ITEMISER_TOTAL_MISMATCH} · Bill ${totalAmount.toFixed(2)} · Items ${itemsTotal.toFixed(2)}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
          {loading && <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12 }}>Loading…</div>}
          {alreadyItemised && (
            <div className="error-banner" style={{ marginBottom: 12 }}>
              This bill has already been itemised. Close and refresh to see the updated split.
            </div>
          )}
          {error && <div className="error-banner" style={{ marginBottom: 12 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input value={descInput} onChange={e => setDescInput(e.target.value)} placeholder="Item description"
              style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit' }} />
            <input type="number" value={amountInput} onChange={e => setAmountInput(e.target.value)} placeholder="0.00"
              style={{ width: 80, padding: '8px 10px', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit' }} />
            <button type="button" onClick={addItem}
              style={{ padding: '8px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              {BILLS_ITEMISER_ADD}
            </button>
          </div>

          {items.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text3)', padding: '12px 0 20px' }}>Add each receipt line, then tap who ordered it.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              {items.map(item => (
                <div key={item.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, background: 'var(--bg2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{item.description}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>${item.amount.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {members.map(m => {
                      const selected = item.assignedUserIds.includes(m.id)
                      return (
                        <button key={m.id} type="button" onClick={() => toggleAssign(item.id, m.id)}
                          style={{
                            padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                            border: `1px solid ${selected ? 'var(--yellow)' : 'var(--border2)'}`,
                            background: selected ? 'var(--yellow-soft)' : 'transparent',
                            color: selected ? 'var(--yellow)' : 'var(--text2)',
                          }}>
                          {m.name}{m.id === currentUser?.id ? ' (you)' : ''}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Summary</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {members.map(m => {
                const total = memberTotals.get(m.id) || 0
                return (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <MemberAvatar name={m.name} avatarUrl={m.avatar_url || null} size={28} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{m.name}{m.id === currentUser?.id ? ' (you)' : ''}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: total > 0 ? 'var(--text)' : 'var(--text3)' }}>${total.toFixed(2)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div style={{ padding: '12px 16px calc(16px + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <button type="button" onClick={confirmSplit} disabled={!canConfirm}
            style={{
              width: '100%', padding: '12px', background: 'var(--yellow)', border: 'none', borderRadius: 10,
              color: '#111', fontSize: 14, fontWeight: 700, cursor: canConfirm ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit', opacity: canConfirm ? 1 : 0.5,
            }}>
            {saving ? 'Saving…' : BILLS_ITEMISER_CONFIRM}
          </button>
        </div>
      </div>
    </>
  )
}
