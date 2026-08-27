'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import BillSplitForm, { BillCategory } from '@/components/BillSplitForm'
import LedgerView from '@/components/LedgerView'
import { computeNetBalances, simplifyDebts, Bill, BillSplit as BillSplitRow, Settlement, Member, SimplifiedDebt } from '@/lib/ledger'
import { createNotification } from '@/lib/notify'
import { useToast } from '@/components/ToastProvider'
import { getRandom, LOADING, EMPTY, TOAST_ERROR, TOAST_NUDGED } from '@/lib/copy'
import { track } from '@/lib/track'
import { ICON_SIZE } from '@/lib/constants'

// icon holds a Tabler ti-* class suffix, not raw glyph content — see AGENTS.md icon audit notes.
const CATEGORIES: { id: string; label: string; icon: string }[] = [
  { id: 'all',           label: 'All',           icon: '' },
  { id: 'dinner',        label: 'Dinner',        icon: 'ti-glass-full' },
  { id: 'drinks',        label: 'Drinks',        icon: 'ti-beer' },
  { id: 'transport',     label: 'Transport',     icon: 'ti-car' },
  { id: 'accommodation', label: 'Stay',          icon: 'ti-bed' },
  { id: 'activities',    label: 'Activities',    icon: 'ti-palette' },
  { id: 'other',         label: 'Other',         icon: 'ti-clipboard' },
]

function getCatIcon(cat: string) {
  return CATEGORIES.find(c => c.id === cat)?.icon || 'ti-clipboard'
}

function timeAgo(date: string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function getInitials(name: string) {
  return (name || 'U').split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()
}

function BalanceCard({ myBalance, myDebts, currentUserId, onSettleUp }: {
  myBalance: number
  myDebts: SimplifiedDebt[] | null | undefined
  currentUserId?: string
  onSettleUp: () => void
}) {
  const debts = myDebts ?? []
  const isOwed = myBalance > 0.01
  const isOwing = myBalance < -0.01
  const amountColor = isOwing ? 'var(--danger)' : 'var(--sage)'

  return (
    <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderRadius: 16, padding: 24, marginBottom: 20, textAlign: 'center' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
        {isOwed ? 'You are owed' : isOwing ? 'You owe' : 'Your balance'}
      </div>
      <div style={{ fontSize: 40, fontWeight: 800, color: amountColor, letterSpacing: '-1px', marginBottom: debts.length > 0 ? 20 : 4 }}>
        {isOwing ? '-' : isOwed ? '+' : ''}${Math.abs(myBalance).toFixed(2)}
      </div>
      {debts.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--sage)', fontWeight: 600 }}>All settled up</div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left', marginBottom: 20 }}>
            {debts.map((d, i) => {
              const iOwe = d.from.id === currentUserId
              const other = iOwe ? d.to : d.from
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg3)', borderRadius: 12 }}>
                  <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{other.name}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: iOwe ? 'var(--danger)' : 'var(--sage)' }}>
                    {iOwe ? '-' : '+'}${d.amount.toFixed(2)}
                  </span>
                </div>
              )
            })}
          </div>
          <button onClick={onSettleUp}
            style={{ width: '100%', padding: '12px', background: '#F8BD03', border: 'none', borderRadius: 12, color: '#111', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Settle up
          </button>
        </>
      )}
    </div>
  )
}

export default function BillSplit({ members, knotId, currentUser, hangoutId }: { members: any[], knotId?: string, currentUser?: any, hangoutId?: string }) {
  const toast = useToast()
  const [view, setView]           = useState<'ledger' | 'activity'>('ledger')
  const [hangoutGuestDietary, setHangoutGuestDietary] = useState<string[][]>([])
  const [bills, setBills]         = useState<any[]>([])
  const [settlements, setSettlements] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [loadError, setLoadError] = useState('')
  const [showAdd, setShowAdd]     = useState(false)
  const [adding, setAdding]       = useState(false)
  const [addError, setAddError]   = useState('')
  const [undoingId, setUndoingId] = useState<string | null>(null)
  const [confirmingUndoId, setConfirmingUndoId] = useState<string | null>(null)
  const [undoError, setUndoError] = useState('')
  const [editingBillId, setEditingBillId]     = useState<string | null>(null)
  const [editSubmitting, setEditSubmitting]   = useState(false)
  const [editError, setEditError]             = useState('')
  const [deletingBillId, setDeletingBillId]   = useState<string | null>(null)
  const [deleteError, setDeleteError]         = useState('')
  const [remindingId, setRemindingId]         = useState<string | null>(null)
  const [remindError, setRemindError]         = useState('')

  // Filters
  const [search, setSearch]         = useState('')
  const [filterCat, setFilterCat]   = useState('all')

  const loadAll = useCallback(async () => {
    if (!knotId) return
    setLoadError('')

    const [{ data: billData, error: billsErr }, { data: settlementData, error: settlementsErr }] = await Promise.all([
      supabase
        .from('bills')
        .select('*, profiles:added_by(name), hangouts:hangout_id(title, venue_name)')
        .eq('knot_id', knotId)
        .order('created_at', { ascending: false }),
      supabase
        .from('settlements')
        .select('*, from_profile:from_user_id(name), to_profile:to_user_id(name)')
        .eq('knot_id', knotId)
        .order('created_at', { ascending: false }),
    ])

    if (billsErr || settlementsErr) {
      setLoadError('Could not load bills. Try refreshing.')
      setLoading(false)
      return
    }

    const withSplits = await Promise.all((billData || []).map(async (bill: any) => {
      const { data: splitData } = await supabase
        .from('bill_splits')
        .select('*, profiles:user_id(name), last_reminded_at, reminder_sent_at')
        .eq('bill_id', bill.id)
      return { ...bill, splits: splitData || [] }
    }))

    setBills(withSplits)
    setSettlements(settlementData || [])
    setLoading(false)
  }, [knotId])

  useEffect(() => {
    if (knotId) loadAll()
  }, [knotId, loadAll])

  useEffect(() => {
    if (!hangoutId) { setHangoutGuestDietary([]); return }
    let cancelled = false
    supabase
      .from('hangout_rsvps')
      .select('guest_dietary')
      .eq('hangout_id', hangoutId)
      .eq('status', 'yes')
      .then(({ data }) => {
        if (cancelled) return
        setHangoutGuestDietary((data || []).map((r: any) => r.guest_dietary || []))
      })
    return () => { cancelled = true }
  }, [hangoutId])

  async function handleAddBill(
    desc: string, amount: number, splits: { user_id: string; amount: number }[],
    category: BillCategory, note: string, photoUrl: string,
    isRecurring: boolean, recurringInterval: string, receiptHash?: string
  ) {
    if (!knotId || !currentUser) return
    if (splits.length === 0) { setAddError('Cannot split with no members selected.'); return }
    setAddError('')

    if (receiptHash) {
      const { data: hashMatches } = await supabase
        .from('bills')
        .select('id')
        .eq('knot_id', knotId)
        .eq('receipt_hash', receiptHash)
        .limit(1)
      if (hashMatches && hashMatches.length > 0) {
        toast.actionable({
          message: 'This receipt may already be added. Post anyway?',
          actionLabel: 'Post anyway',
          onAction: () => insertBill(desc, amount, splits, category, note, photoUrl, isRecurring, recurringInterval, receiptHash),
        })
        return
      }
    }

    const sixtySecondsAgo = new Date(Date.now() - 60_000).toISOString()
    const { data: recentMatches } = await supabase
      .from('bills')
      .select('id')
      .eq('knot_id', knotId)
      .eq('added_by', currentUser.id)
      .eq('total_amount', amount)
      .gte('created_at', sixtySecondsAgo)
      .limit(1)
    if (recentMatches && recentMatches.length > 0) {
      toast.actionable({
        message: 'A bill for this amount was just added. Post anyway?',
        actionLabel: 'Post anyway',
        onAction: () => insertBill(desc, amount, splits, category, note, photoUrl, isRecurring, recurringInterval, receiptHash),
      })
      return
    }

    await insertBill(desc, amount, splits, category, note, photoUrl, isRecurring, recurringInterval, receiptHash)
  }

  async function insertBill(
    desc: string, amount: number, splits: { user_id: string; amount: number }[],
    category: BillCategory, note: string, photoUrl: string,
    isRecurring: boolean, recurringInterval: string, receiptHash?: string
  ) {
    if (!knotId || !currentUser) return
    setAdding(true)
    setAddError('')

    const { data: bill, error: billInsertError } = await supabase
      .from('bills')
      .insert({
        knot_id: knotId, added_by: currentUser.id,
        total_amount: amount, description: desc, split_type: 'custom',
        category, note: note || null, photo_url: photoUrl || null,
        is_recurring: isRecurring, recurring_interval: isRecurring ? recurringInterval : null,
        receipt_hash: receiptHash || null,
      })
      .select().single()

    if (billInsertError || !bill) {
      setAddError('Could not add the bill. Please try again.')
      setAdding(false)
      return
    }

    const { error: splitsError } = await supabase.from('bill_splits').insert(
      splits.map(s => ({ bill_id: bill.id, user_id: s.user_id, amount: s.amount, settled: s.user_id === currentUser.id }))
    )
    if (splitsError) setAddError('Bill added, but the split failed to save.')

    await supabase.from('posts').insert({
      knot_id:   knotId,
      author_id: currentUser.id,
      content:   `added a bill ${String.fromCodePoint(0x2014)} $${amount.toFixed(2)} for ${desc}, split ${splits.length} ways`,
      post_type: 'bill',
    })

    track(supabase, 'bill_added', { hangout_id: hangoutId ?? null, amount }, knotId)

    setAdding(false)
    if (!splitsError) setShowAdd(false)
    await loadAll()
  }

  async function handleEditBill(
    billId: string, desc: string, amount: number, splits: { user_id: string; amount: number }[],
    category: BillCategory, note: string, photoUrl: string,
    isRecurring: boolean, recurringInterval: string
  ) {
    if (!currentUser) return
    setEditSubmitting(true)
    setEditError('')

    const { error: updateError } = await supabase
      .from('bills')
      .update({
        description: desc, total_amount: amount,
        category, note: note || null, photo_url: photoUrl || null,
        is_recurring: isRecurring, recurring_interval: isRecurring ? recurringInterval : null,
      })
      .eq('id', billId).eq('added_by', currentUser.id)

    if (updateError) { setEditError('Could not update the bill.'); setEditSubmitting(false); return }

    await supabase.from('bill_splits').delete().eq('bill_id', billId)
    const { error: insertSplitsError } = await supabase.from('bill_splits').insert(
      splits.map(s => ({ bill_id: billId, user_id: s.user_id, amount: s.amount, settled: s.user_id === currentUser.id }))
    )
    if (insertSplitsError) setEditError('Bill updated, but the new split failed to save.')

    setEditSubmitting(false)
    if (!insertSplitsError) setEditingBillId(null)
    await loadAll()
  }

  async function handleDeleteBill(billId: string) {
    if (!confirm('Delete this bill? This cannot be undone.')) return
    setDeletingBillId(billId)
    setDeleteError('')
    const { error } = await supabase.from('bills').delete().eq('id', billId).eq('added_by', currentUser?.id)
    if (error) { setDeleteError('Could not delete the bill.'); setDeletingBillId(null); return }
    setDeletingBillId(null)
    await loadAll()
  }

  async function sendReminder(splitId: string, targetUserId: string, amount: number, lastRemindedAt?: string | null) {
    const lastRaw = lastRemindedAt
    const last = lastRaw ? new Date(lastRaw).getTime() : 0
    if (last && Date.now() - last < 24 * 60 * 60 * 1000) {
      toast.error('Already nudged recently.')
      return
    }
    setRemindingId(splitId)
    setRemindError('')
    const now = new Date().toISOString()
    let { error } = await supabase
      .from('bill_splits')
      .update({ last_reminded_at: now })
      .eq('id', splitId)
    if (error) {
      const retry = await supabase.from('bill_splits').update({ reminder_sent_at: now }).eq('id', splitId)
      error = retry.error
    }
    if (error) { setRemindError('Could not send reminder.'); toast.error(TOAST_ERROR); setRemindingId(null); return }
    const creditorName = currentUser?.name || 'a friend'
    if (targetUserId) {
      await createNotification(supabase, {
        userId: targetUserId,
        knotId,
        type: 'bill_reminder',
        actorId: currentUser?.id,
        entityId: splitId,
        message: `You owe ${creditorName} $${amount.toFixed(2)}. Settle up in Knot.`,
      })
    }
    toast.success(TOAST_NUDGED)
    setRemindingId(null)
    await loadAll()
  }

  function latestSettlementIdsByPair(list: any[]): Set<string> {
    const latestByPair = new Map<string, any>()
    for (const s of list) {
      const key = s.from_user_id + '->' + s.to_user_id
      const existing = latestByPair.get(key)
      if (!existing || new Date(s.created_at) > new Date(existing.created_at)) {
        latestByPair.set(key, s)
      }
    }
    return new Set(Array.from(latestByPair.values()).map(s => s.id))
  }

  async function undoSettlement(settlementId: string) {
    setUndoingId(settlementId)
    setUndoError('')
    const { error } = await supabase.from('settlements').delete().eq('id', settlementId)
    if (error) { setUndoError('Could not undo the settlement.'); setUndoingId(null); return }
    setUndoingId(null)
    await loadAll()
  }

  const memberList: Member[] = useMemo(() => members.map(m => ({ id: m.id, name: m.name })), [members])

  const dietarySummary = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const m of members) {
      for (const r of (m.dietary_restrictions || [])) counts[r] = (counts[r] || 0) + 1
    }
    for (const guestList of hangoutGuestDietary) {
      for (const r of guestList) counts[r] = (counts[r] || 0) + 1
    }
    const parts = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([label, count]) => `${count} ${label}`)
    return parts.length > 0 ? `Dietary notes: ${parts.join(', ')}` : ''
  }, [members, hangoutGuestDietary])
  const billsForLedger: Bill[] = useMemo(() => bills.map(b => ({ id: b.id, added_by: b.added_by, total_amount: parseFloat(b.total_amount) })), [bills])
  const splitsForLedger: BillSplitRow[] = useMemo(() => bills.flatMap(b => (b.splits || []).map((s: any) => ({ bill_id: b.id, user_id: s.user_id, amount: parseFloat(s.amount) }))), [bills])
  const settlementsForLedger: Settlement[] = useMemo(() => settlements.map(s => ({ from_user_id: s.from_user_id, to_user_id: s.to_user_id, amount: parseFloat(s.amount) })), [settlements])

  const balances = useMemo(() => computeNetBalances(billsForLedger, splitsForLedger, settlementsForLedger, memberList), [billsForLedger, splitsForLedger, settlementsForLedger, memberList])
  const simplified = useMemo(() => simplifyDebts(balances, memberList) ?? [], [balances, memberList])
  const myBalance = balances.get(currentUser?.id) || 0
  const myDebts = (simplified ?? []).filter(d => d.from.id === currentUser?.id || d.to.id === currentUser?.id)
  const undoableIds = latestSettlementIdsByPair(settlements)

  // Filtered bills for activity view
  const filteredBills = useMemo(() => {
    return bills.filter(b => {
      const matchCat = filterCat === 'all' || b.category === filterCat
      const q = search.toLowerCase()
      const matchSearch = !q || b.description?.toLowerCase().includes(q) || b.note?.toLowerCase().includes(q)
      return matchCat && matchSearch
    })
  }, [bills, filterCat, search])

  if (loading) return <div style={{ color: 'var(--text2)', fontSize: 13, padding: '20px 0' }}>{getRandom(LOADING.bills.pool, LOADING.bills.rare)}</div>

  return (
    <div style={{ maxWidth: 720 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Bills</div>
        <button onClick={() => setShowAdd(true)} style={{ background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          Add bill
        </button>
      </div>

      <BalanceCard myBalance={myBalance} myDebts={myDebts} currentUserId={currentUser?.id} onSettleUp={() => setView('ledger')} />

      {loadError && <div className="error-banner" style={{ marginBottom: 16 }}>{loadError}</div>}

      {/* View toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {(['ledger', 'activity'] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            style={{
              padding: '6px 14px', borderRadius: 999,
              border: view === v ? 'none' : '1px solid var(--border2)',
              background: view === v ? '#111' : 'transparent',
              color: view === v ? '#fff' : 'var(--text2)',
              fontSize: 12, fontWeight: view === v ? 700 : 500,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
            {v === 'ledger' ? 'Balances' : 'Activity'}
          </button>
        ))}
      </div>

      {/* Add bill form */}
      {showAdd && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--yellow)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Add a bill</div>
          <BillSplitForm
            members={memberList}
            restrictionsNote={dietarySummary}
            submitting={adding}
            error={addError}
            onSubmit={(desc, amount, splits, category, note, photoUrl, isRecurring, recurringInterval, receiptHash) =>
              handleAddBill(desc, amount, splits, category, note, photoUrl, isRecurring, recurringInterval, receiptHash)
            }
            onCancel={() => { setShowAdd(false); setAddError('') }}
          />
        </div>
      )}

      {view === 'ledger' && (
        <LedgerView debts={simplified} currentUser={currentUser} knotId={knotId!} bills={bills} onSettled={loadAll} />
      )}

      {view === 'activity' && (
        <div>
          {/* Search and filter */}
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search bills..."
            style={{ width: '100%', padding: '8px 12px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 10 }}
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => setFilterCat(cat.id)}
                style={{
                  padding: '4px 10px', borderRadius: 20,
                  border: `1px solid ${filterCat === cat.id ? 'var(--yellow)' : 'var(--border2)'}`,
                  background: filterCat === cat.id ? 'var(--yellow-soft)' : 'transparent',
                  color: filterCat === cat.id ? 'var(--yellow)' : 'var(--text3)',
                  fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontWeight: filterCat === cat.id ? 700 : 400,
                }}>
                {cat.icon && <i className={`ti ${cat.icon}`} style={{ fontSize: ICON_SIZE.inline, color: filterCat === cat.id ? 'var(--yellow)' : 'var(--text3)' }} />}
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          {(undoError || remindError || deleteError) && (
            <div className="error-banner" style={{ marginBottom: 16 }}>
              {undoError || remindError || deleteError}
            </div>
          )}

          {settlements.length > 0 && filterCat === 'all' && !search && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Settlements</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {settlements.map((s: any) => {
                  const canUndo = undoableIds.has(s.id)
                  return (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>
                        <strong>{s.from_profile?.name || 'Someone'}</strong>
                        <span style={{ color: 'var(--text2)' }}> paid </span>
                        <strong>{s.to_profile?.name || 'someone'}</strong>
                        <span style={{ color: 'var(--sage)', fontWeight: 700, marginLeft: 6 }}>${parseFloat(s.amount).toFixed(2)}</span>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>{timeAgo(s.created_at)}</span>
                      {canUndo && (
                        confirmingUndoId === s.id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11, color: 'var(--text2)' }}>Undo this settlement?</span>
                            <button onClick={() => { setConfirmingUndoId(null); undoSettlement(s.id) }} disabled={undoingId === s.id}
                              style={{ padding: '5px 10px', background: 'var(--danger)', border: 'none', borderRadius: 6, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: undoingId === s.id ? 0.5 : 1 }}>
                              {undoingId === s.id ? '...' : 'Confirm'}
                            </button>
                            <button onClick={() => setConfirmingUndoId(null)}
                              style={{ padding: '5px 10px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--text3)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmingUndoId(s.id)} disabled={undoingId === s.id}
                            style={{ padding: '5px 10px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--text3)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', opacity: undoingId === s.id ? 0.5 : 1 }}>
                            {undoingId === s.id ? '...' : 'Undo'}
                          </button>
                        )
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {filteredBills.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text2)' }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{bills.length === 0 ? EMPTY.BILLS : 'No results'}</div>
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>
                {bills.length === 0 ? 'Bills from hangouts and standalone expenses show up here.' : 'Try a different search or category.'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {filteredBills.map((bill: any) => {
                const billSplits = bill.splits ?? []
                const settledCount = billSplits.filter((s: any) => s.settled).length || 0
                const progress = billSplits.length > 0 ? Math.round(settledCount / billSplits.length * 100) : 0
                const linkedHangout = bill.hangouts?.venue_name || bill.hangouts?.title
                const isMine = bill.added_by === currentUser?.id
                const isEditing = editingBillId === bill.id
                const catIcon = getCatIcon(bill.category || 'other')

                return (
                  <div key={bill.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                    {isEditing ? (
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Edit bill</div>
                        <BillSplitForm
                          members={memberList}
                          defaultSelectedIds={billSplits.map((s: any) => s.user_id)}
                          defaultDesc={bill.description}
                          defaultAmount={parseFloat(bill.total_amount)}
                          defaultCategory={bill.category || 'other'}
                          defaultNote={bill.note || ''}
                          defaultPhotoUrl={bill.photo_url || ''}
                          defaultIsRecurring={bill.is_recurring || false}
                          defaultRecurringInterval={bill.recurring_interval || 'monthly'}
                          submitLabel="Save changes"
                          submitting={editSubmitting}
                          error={editError}
                          onSubmit={(desc, amount, splits, category, note, photoUrl, isRecurring, recurringInterval) =>
                            handleEditBill(bill.id, desc, amount, splits, category, note, photoUrl, isRecurring, recurringInterval)
                          }
                          onCancel={() => { setEditingBillId(null); setEditError('') }}
                        />
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <i className={`ti ${catIcon}`} style={{ fontSize: ICON_SIZE.card, color: 'var(--text3)' }} />
                              <span style={{ fontSize: 16, fontWeight: 700 }}>${parseFloat(bill.total_amount).toFixed(2)}</span>
                              {bill.is_recurring && (
                                <span style={{ fontSize: 10, padding: '2px 6px', background: 'var(--yellow-soft)', color: 'var(--yellow)', borderRadius: 4, fontWeight: 700, letterSpacing: '0.04em' }}>
                                  {(bill.recurring_interval || 'recurring').toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2, lineHeight: 1.5 }}>{bill.description} {String.fromCodePoint(0x00B7)} {timeAgo(bill.created_at)}</div>
                            {linkedHangout && <div style={{ fontSize: 12, color: 'var(--yellow)', marginTop: 2 }}>From {linkedHangout}</div>}
                            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Paid by {bill.profiles?.name || 'someone'}</div>
                            {bill.note && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4, fontStyle: 'italic', lineHeight: 1.5 }}>{bill.note}</div>}
                          </div>
                          <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, background: progress === 100 ? 'var(--sage-soft)' : 'var(--amber-soft)', color: progress === 100 ? 'var(--sage)' : 'var(--amber)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {progress === 100 ? 'All settled' : `${settledCount}/${billSplits.length} settled`}
                          </span>
                        </div>

                        {bill.photo_url && (
                          <div style={{ marginBottom: 12 }}>
                            <img src={bill.photo_url} alt="Receipt" style={{ height: 80, borderRadius: 8, objectFit: 'cover' }} />
                          </div>
                        )}

                        {billSplits.map((split: any) => {
                          const isMe = split.user_id === currentUser?.id
                          const isCreditor = bill.added_by === currentUser?.id
                          const splitKey = split.id
                          const canRemind = isCreditor && !split.settled && !isMe
                          return (
                            <div key={split.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--yellow)', color: '#111', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {getInitials(split.profiles?.name || 'U')}
                              </div>
                              <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{split.profiles?.name || 'Unknown'}{isMe ? ' (you)' : ''}</span>
                              {split.settled && <span style={{ fontSize: 10, color: 'var(--sage)', fontWeight: 700 }}>Settled</span>}
                              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text3)' }}>
                                ${parseFloat(split.amount).toFixed(2)}
                              </span>
                              {canRemind && (
                                <button
                                  type="button"
                                  onClick={() => sendReminder(splitKey, split.user_id, parseFloat(split.amount), split.last_reminded_at || split.reminder_sent_at)}
                                  disabled={remindingId === splitKey}
                                  title="Send reminder"
                                  style={{ padding: '4px 8px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--text2)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', opacity: remindingId === splitKey ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
                                  {remindingId === splitKey ? '...' : (
                                    <>
                                      <i className="ti ti-bell" style={{ fontSize: 13, color: 'var(--text3)' }} />
                                      Remind
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          )
                        })}

                        {isMine && (
                          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                            <button onClick={() => { setEditingBillId(bill.id); setEditError('') }}
                              style={{ padding: '6px 14px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                              Edit
                            </button>
                            <button onClick={() => handleDeleteBill(bill.id)} disabled={deletingBillId === bill.id}
                              style={{ padding: '6px 14px', background: 'transparent', border: '1px solid var(--danger-dim)', borderRadius: 8, color: 'var(--danger)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', opacity: deletingBillId === bill.id ? 0.5 : 1 }}>
                              {deletingBillId === bill.id ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
