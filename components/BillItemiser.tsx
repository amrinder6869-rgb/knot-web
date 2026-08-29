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
  BILLS_TAX_PROPORTIONAL,
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

function isSharedItem(description: string): boolean {
  const lower = description.toLowerCase().trim()
  return ['tax', 'tip', 'gratuity', 'gst', 'hst', 'pst', 'vat', 'service charge', 'service fee'].some(
    keyword => lower.includes(keyword),
  )
}

type MemberSplitBreakdown = {
  items: number
  shared: number
  total: number
}

function computeTotals(items: LineItem[], members: { id: string }[]): Record<string, MemberSplitBreakdown> {
  const assignments: Record<string, string[]> = {}
  for (const item of items) assignments[item.id] = item.assignedUserIds

  const subtotals: Record<string, number> = {}
  let grandSubtotal = 0

  for (const item of items) {
    if (isSharedItem(item.description)) continue
    const assignedMembers = assignments[item.id] ?? []
    if (assignedMembers.length === 0) continue
    const share = item.amount / assignedMembers.length
    for (const memberId of assignedMembers) {
      subtotals[memberId] = (subtotals[memberId] || 0) + share
      grandSubtotal += share
    }
  }

  const totals: Record<string, MemberSplitBreakdown> = {}
  for (const member of members) {
    const itemsAmount = subtotals[member.id] || 0
    totals[member.id] = { items: itemsAmount, shared: 0, total: itemsAmount }
  }

  for (const item of items) {
    if (!isSharedItem(item.description)) continue
    if (grandSubtotal === 0) {
      const memberIds = Object.keys(subtotals)
      if (memberIds.length === 0) continue
      const share = item.amount / memberIds.length
      for (const memberId of memberIds) {
        totals[memberId].shared += share
        totals[memberId].total += share
      }
    } else {
      for (const [memberId, subtotal] of Object.entries(subtotals)) {
        const proportion = subtotal / grandSubtotal
        const share = item.amount * proportion
        totals[memberId].shared += share
        totals[memberId].total += share
      }
    }
  }

  return totals
}

function roundMemberTotals(
  raw: Record<string, MemberSplitBreakdown>,
  members: { id: string }[],
  targetSum: number,
): Record<string, MemberSplitBreakdown> {
  const rounded: Record<string, MemberSplitBreakdown> = {}
  let sum = 0
  let maxMemberId = members[0]?.id
  let maxTotal = -1

  for (const member of members) {
    const entry = raw[member.id] || { items: 0, shared: 0, total: 0 }
    const total = Math.round(entry.total * 100) / 100
    rounded[member.id] = {
      items: Math.round(entry.items * 100) / 100,
      shared: Math.round(entry.shared * 100) / 100,
      total,
    }
    sum += total
    if (total > maxTotal) {
      maxTotal = total
      maxMemberId = member.id
    }
  }

  const diff = Math.round((targetSum - sum) * 100) / 100
  if (diff !== 0 && maxMemberId && rounded[maxMemberId]) {
    const entry = rounded[maxMemberId]
    if (entry.shared > 0) {
      rounded[maxMemberId] = {
        ...entry,
        total: Math.round((entry.total + diff) * 100) / 100,
        shared: Math.round((entry.shared + diff) * 100) / 100,
      }
    } else {
      rounded[maxMemberId] = {
        ...entry,
        total: Math.round((entry.total + diff) * 100) / 100,
        items: Math.round((entry.items + diff) * 100) / 100,
      }
    }
  }

  return rounded
}

function sharedItemAssignments(
  item: LineItem,
  items: LineItem[],
  members: { id: string }[],
): { userId: string; share: number }[] {
  const subtotals: Record<string, number> = {}
  let grandSubtotal = 0
  for (const line of items) {
    if (isSharedItem(line.description)) continue
    if (line.assignedUserIds.length === 0) continue
    const share = line.amount / line.assignedUserIds.length
    for (const userId of line.assignedUserIds) {
      subtotals[userId] = (subtotals[userId] || 0) + share
      grandSubtotal += share
    }
  }

  if (grandSubtotal === 0) {
    const memberIds = Object.keys(subtotals)
    if (memberIds.length === 0) return []
    const share = Math.round((item.amount / memberIds.length) * 100) / 100
    return memberIds.map(userId => ({ userId, share }))
  }

  return Object.entries(subtotals).map(([userId, subtotal]) => ({
    userId,
    share: Math.round(item.amount * (subtotal / grandSubtotal) * 100) / 100,
  }))
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

  const memberBreakdowns = useMemo(() => {
    const raw = computeTotals(items, members)
    return roundMemberTotals(raw, members, itemsTotal)
  }, [items, members, itemsTotal])

  const hasAssignedRegularItems = items.some(
    item => !isSharedItem(item.description) && item.assignedUserIds.length > 0,
  )
  const allAssigned = items.length > 0 && items.every(
    item => isSharedItem(item.description) || item.assignedUserIds.length > 0,
  )
  const totalMatches = Math.abs(itemsTotal - totalAmount) <= 0.5
  const canConfirm = allAssigned && hasAssignedRegularItems && totalMatches && !saving && !alreadyItemised && !loading

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
      if (item.id !== itemId || isSharedItem(item.description)) return item
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

      const insertedItems: { id: string; amount: number; assignedUserIds: string[]; description: string }[] = []

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
        insertedItems.push({ id: row.id, amount: item.amount, assignedUserIds: item.assignedUserIds, description: item.description })
      }

      for (const item of insertedItems) {
        const assignmentRows = isSharedItem(item.description)
          ? sharedItemAssignments(
              { id: item.id, description: item.description, amount: item.amount, assignedUserIds: [] },
              items,
              members,
            ).map(({ userId, share }) => ({
              line_item_id: item.id,
              user_id: userId,
              share,
            }))
          : item.assignedUserIds.map(userId => ({
              line_item_id: item.id,
              user_id: userId,
              share: Math.round((item.amount / item.assignedUserIds.length) * 100) / 100,
            }))

        if (assignmentRows.length === 0) continue
        const { error: assignError } = await supabase.from('bill_line_item_assignments').insert(assignmentRows)
        if (assignError) {
          setError('Could not save item assignments. Try again.')
          setSaving(false)
          return
        }
      }

      const splitRows = members
        .map(m => ({
          user_id: m.id,
          amount: memberBreakdowns[m.id]?.total || 0,
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
              {items.map(item => {
                const shared = isSharedItem(item.description)
                return (
                <div key={item.id} style={{
                  border: '1px solid var(--border)', borderRadius: 10, padding: 12,
                  background: shared ? 'rgba(0,0,0,0.03)' : 'var(--bg2)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', fontStyle: shared ? 'italic' : 'normal' }}>{item.description}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>${item.amount.toFixed(2)}</span>
                  </div>
                  {shared ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text3)' }}>
                      <i className="ti ti-info-circle" style={{ fontSize: 14 }} />
                      <span>{BILLS_TAX_PROPORTIONAL} with other items</span>
                    </div>
                  ) : (
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
                  )}
                </div>
              )})}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Summary</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {members.map(m => {
                const breakdown = memberBreakdowns[m.id] || { items: 0, shared: 0, total: 0 }
                const total = breakdown.total
                return (
                  <div key={m.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <MemberAvatar name={m.name} avatarUrl={m.avatar_url || null} size={28} />
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{m.name}{m.id === currentUser?.id ? ' (you)' : ''}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: total > 0 ? 'var(--text)' : 'var(--text3)' }}>${total.toFixed(2)}</span>
                    </div>
                    {total > 0 && (
                      <div style={{ marginLeft: 38, marginTop: 2, fontSize: 11, color: 'var(--text3)' }}>
                        Items: ${breakdown.items.toFixed(2)}{breakdown.shared > 0 ? `  Tax: $${breakdown.shared.toFixed(2)}` : ''}
                      </div>
                    )}
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
