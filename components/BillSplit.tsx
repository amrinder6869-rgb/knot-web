'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import BillSplitForm from '@/components/BillSplitForm'
import LedgerView from '@/components/LedgerView'
import { computeNetBalances, simplifyDebts, Bill, BillSplit as BillSplitRow, Settlement, Member } from '@/lib/ledger'

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

export default function BillSplit({ members, knotId, currentUser }: { members: any[], knotId?: string, currentUser?: any }) {
  const [view, setView] = useState<'ledger' | 'activity'>('ledger')
  const [bills, setBills]           = useState<any[]>([])
  const [settlements, setSettlements] = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [loadError, setLoadError]   = useState('')
  const [showAdd, setShowAdd]       = useState(false)
  const [adding, setAdding]         = useState(false)
  const [addError, setAddError]     = useState('')
  const [undoingId, setUndoingId]   = useState<string | null>(null)
  const [undoError, setUndoError]   = useState('')
  const [editingBillId, setEditingBillId] = useState<string | null>(null)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError]   = useState('')
  const [deletingBillId, setDeletingBillId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    if (knotId) loadAll()
  }, [knotId])

  async function loadAll() {
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
      const { data: splitData, error: splitsErr } = await supabase
        .from('bill_splits')
        .select('*, profiles:user_id(name)')
        .eq('bill_id', bill.id)
      if (splitsErr) return { ...bill, splits: [] }
      return { ...bill, splits: splitData || [] }
    }))

    setBills(withSplits)
    setSettlements(settlementData || [])
    setLoading(false)
  }

  async function handleAddBill(desc: string, amount: number, splits: { user_id: string; amount: number }[]) {
    if (!knotId || !currentUser) return
    setAdding(true)
    setAddError('')

    const { data: bill, error: billInsertError } = await supabase
      .from('bills')
      .insert({ knot_id: knotId, added_by: currentUser.id, total_amount: amount, description: desc, split_type: 'custom' })
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

    const { error: postError } = await supabase.from('posts').insert({
      knot_id:   knotId,
      author_id: currentUser.id,
      content:   `added a bill \u2014 $${amount.toFixed(2)} for ${desc}, split ${splits.length} ways`,
      post_type: 'bill',
    })
    if (postError && !splitsError) setAddError('Bill saved, but it could not be posted to the feed.')

    setAdding(false)
    if (!splitsError) setShowAdd(false)
    await loadAll()
  }

  async function handleEditBill(billId: string, desc: string, amount: number, splits: { user_id: string; amount: number }[]) {
    if (!currentUser) return
    setEditSubmitting(true)
    setEditError('')

    const { error: updateError } = await supabase
      .from('bills')
      .update({ description: desc, total_amount: amount })
      .eq('id', billId)
      .eq('added_by', currentUser.id)

    if (updateError) {
      setEditError('Could not update the bill. Please try again.')
      setEditSubmitting(false)
      return
    }

    const { error: deleteSplitsError } = await supabase.from('bill_splits').delete().eq('bill_id', billId)
    if (deleteSplitsError) {
      setEditError('Bill updated, but the old split could not be replaced.')
      setEditSubmitting(false)
      return
    }

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
    if (error) {
      setDeleteError('Could not delete the bill. Please try again.')
      setDeletingBillId(null)
      return
    }
    setDeletingBillId(null)
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
    if (error) {
      setUndoError('Could not undo the settlement. Please try again.')
      setUndoingId(null)
      return
    }
    setUndoingId(null)
    await loadAll()
  }

  if (loading) return <div style={{ color: 'var(--text2)', fontSize: 13, padding: '20px 0' }}>Loading...</div>

  const memberList: Member[] = members.map(m => ({ id: m.id, name: m.name }))
  const billsForLedger: Bill[] = bills.map(b => ({ id: b.id, added_by: b.added_by, total_amount: parseFloat(b.total_amount) }))
  const splitsForLedger: BillSplitRow[] = bills.flatMap(b => (b.splits || []).map((s: any) => ({ bill_id: b.id, user_id: s.user_id, amount: parseFloat(s.amount) })))
  const settlementsForLedger: Settlement[] = settlements.map(s => ({ from_user_id: s.from_user_id, to_user_id: s.to_user_id, amount: parseFloat(s.amount) }))

  const balances = computeNetBalances(billsForLedger, splitsForLedger, settlementsForLedger, memberList)
  const simplified = simplifyDebts(balances, memberList)

  const myBalance = balances.get(currentUser?.id) || 0
  const undoableIds = latestSettlementIdsByPair(settlements)

  return (
    <div style={{ maxWidth: 720 }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Bills</div>
          <div style={{ fontSize: 13, marginTop: 2 }}>
            {myBalance > 0.01
              ? <span style={{ color: 'var(--sage)', fontWeight: 600 }}>You are owed ${myBalance.toFixed(2)} total</span>
              : myBalance < -0.01
              ? <span style={{ color: 'var(--yellow)', fontWeight: 600 }}>You owe ${Math.abs(myBalance).toFixed(2)} total</span>
              : <span style={{ color: 'var(--sage)', fontWeight: 600 }}>All settled up</span>}
          </div>
        </div>
        <button onClick={() => setShowAdd(true)} style={{ background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          Add bill
        </button>
      </div>

      {loadError && (
        <div style={{ padding: '10px 14px', background: 'var(--yellow-soft)', border: '1px solid var(--yellow-dim)', borderRadius: 8, fontSize: 13, color: 'var(--yellow)', marginBottom: 16 }}>
          {loadError}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {(['ledger', 'activity'] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            style={{
              padding: '6px 14px', borderRadius: 6,
              border: `1px solid ${view === v ? 'var(--yellow)' : 'var(--border2)'}`,
              background: view === v ? 'var(--yellow-soft)' : 'transparent',
              color: view === v ? 'var(--yellow)' : 'var(--text2)',
              fontSize: 12, fontWeight: view === v ? 700 : 500,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
            {v === 'ledger' ? 'Balances' : 'Activity'}
          </button>
        ))}
      </div>

      {showAdd && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--yellow)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Add a bill</div>
          <BillSplitForm
            members={memberList}
            submitting={adding}
            error={addError}
            onSubmit={handleAddBill}
            onCancel={() => { setShowAdd(false); setAddError('') }}
          />
        </div>
      )}

      {view === 'ledger' && (
        <LedgerView debts={simplified} currentUser={currentUser} knotId={knotId!} onSettled={loadAll} />
      )}

      {view === 'activity' && (
        <div>
          {undoError && (
            <div style={{ padding: '10px 14px', background: 'var(--yellow-soft)', border: '1px solid var(--yellow-dim)', borderRadius: 8, fontSize: 13, color: 'var(--yellow)', marginBottom: 16 }}>
              {undoError}
            </div>
          )}
          {deleteError && (
            <div style={{ padding: '10px 14px', background: 'var(--yellow-soft)', border: '1px solid var(--yellow-dim)', borderRadius: 8, fontSize: 13, color: 'var(--yellow)', marginBottom: 16 }}>
              {deleteError}
            </div>
          )}

          {settlements.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Settlements</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {settlements.map((s: any) => {
                  const canUndo = undoableIds.has(s.id)
                  return (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10 }}>
                      <div style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>
                        <strong>{s.from_profile?.name || 'Someone'}</strong>
                        <span style={{ color: 'var(--text2)' }}> paid </span>
                        <strong>{s.to_profile?.name || 'someone'}</strong>
                        <span style={{ color: 'var(--sage)', fontWeight: 700, marginLeft: 6 }}>${parseFloat(s.amount).toFixed(2)}</span>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>{timeAgo(s.created_at)}</span>
                      {canUndo && (
                        <button onClick={() => undoSettlement(s.id)} disabled={undoingId === s.id}
                          style={{ padding: '5px 10px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--text3)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', opacity: undoingId === s.id ? 0.5 : 1, whiteSpace: 'nowrap' }}>
                          {undoingId === s.id ? '...' : 'Undo'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {bills.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text2)' }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>No bills yet</div>
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>Bills from hangouts and standalone expenses show up here.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {bills.map((bill: any) => {
                const settledCount = bill.splits?.filter((s: any) => s.settled).length || 0
                const progress = bill.splits?.length > 0 ? Math.round(settledCount / bill.splits.length * 100) : 0
                const linkedHangout = bill.hangouts?.venue_name || bill.hangouts?.title
                const isMine = bill.added_by === currentUser?.id
                const isEditing = editingBillId === bill.id

                return (
                  <div key={bill.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>

                    {isEditing ? (
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Edit bill</div>
                        <BillSplitForm
                          members={memberList}
                          defaultSelectedIds={bill.splits?.map((s: any) => s.user_id)}
                          defaultDesc={bill.description}
                          defaultAmount={parseFloat(bill.total_amount)}
                          submitLabel="Save changes"
                          submitting={editSubmitting}
                          error={editError}
                          onSubmit={(desc, amount, splits) => handleEditBill(bill.id, desc, amount, splits)}
                          onCancel={() => { setEditingBillId(null); setEditError('') }}
                        />
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 700 }}>${parseFloat(bill.total_amount).toFixed(2)}</div>
                            <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>{bill.description} \u00B7 {timeAgo(bill.created_at)}</div>
                            {linkedHangout && <div style={{ fontSize: 12, color: 'var(--yellow)', marginTop: 2 }}>From {linkedHangout}</div>}
                            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Paid by {bill.profiles?.name || 'someone'}</div>
                          </div>
                          <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, background: progress === 100 ? 'var(--sage-soft)' : 'var(--amber-soft)', color: progress === 100 ? 'var(--sage)' : 'var(--amber)', fontWeight: 600 }}>
                            {progress === 100 ? 'All settled' : `${settledCount}/${bill.splits?.length} settled`}
                          </span>
                        </div>

                        {bill.splits?.map((split: any) => {
                          const isMe = split.user_id === currentUser?.id
                          return (
                            <div key={split.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--yellow)', color: '#111', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {getInitials(split.profiles?.name || 'U')}
                              </div>
                              <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{split.profiles?.name || 'Unknown'}{isMe ? ' (you)' : ''}</span>
                              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text3)' }}>
                                ${parseFloat(split.amount).toFixed(2)}
                              </span>
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
                              style={{ padding: '6px 14px', background: 'transparent', border: '1px solid var(--yellow-dim)', borderRadius: 8, color: 'var(--yellow)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', opacity: deletingBillId === bill.id ? 0.5 : 1 }}>
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
