'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { SimplifiedDebt } from '@/lib/ledger'
import { track } from '@/lib/track'
import { createNotification } from '@/lib/notify'
import { useToast } from '@/components/ToastProvider'
import { TOAST_ERROR, TOAST_NUDGED } from '@/lib/copy'
import MemberAvatar from '@/components/MemberAvatar'

type LedgerViewProps = {
  debts: SimplifiedDebt[]
  currentUser: any
  knotId: string
  bills?: any[]
  onSettled: () => void
}

const DAY_MS = 24 * 60 * 60 * 1000
const ghostBtn: React.CSSProperties = {
  padding: '8px 12px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8,
  color: 'var(--text2)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
  display: 'inline-flex', alignItems: 'center', gap: 5,
}

export default function LedgerView({ debts, currentUser, knotId, bills = [], onSettled }: LedgerViewProps) {
  const toast = useToast()
  const [settlingId, setSettlingId] = useState<string | null>(null)
  const [remindingKey, setRemindingKey] = useState<string | null>(null)
  const [partialKey, setPartialKey] = useState<string | null>(null)
  const [partialAmount, setPartialAmount] = useState('')
  const [error, setError] = useState('')

  async function settleDebt(debt: SimplifiedDebt, amount: number) {
    const key = debt.from.id + debt.to.id
    setSettlingId(key)
    setError('')

    const { error: insertError } = await supabase.from('settlements').insert({
      knot_id: knotId,
      from_user_id: debt.from.id,
      to_user_id: debt.to.id,
      amount,
      note: amount < debt.amount ? 'Partial settlement' : 'Settled up',
    })

    if (insertError) {
      setError('Could not record the settlement. Please try again.')
      setSettlingId(null)
      return
    }

    track(supabase, 'settlement_sent', { amount }, knotId)

    setSettlingId(null)
    setPartialKey(null)
    setPartialAmount('')
    onSettled()
  }

  function findUnsettledSplit(debt: SimplifiedDebt) {
    for (const bill of bills) {
      if (bill.added_by !== debt.to.id) continue
      for (const s of bill.splits || []) {
        if (s.user_id === debt.from.id && !s.settled) return s
      }
    }
    return null
  }

  async function remindDebt(debt: SimplifiedDebt) {
    const split = findUnsettledSplit(debt)
    if (!split) { toast.error(TOAST_ERROR); return }
    const lastRaw = split.last_reminded_at || split.reminder_sent_at
    const last = lastRaw ? new Date(lastRaw).getTime() : 0
    if (last && Date.now() - last < DAY_MS) {
      toast.error('Already nudged recently.')
      return
    }
    const key = debt.from.id + debt.to.id
    setRemindingKey(key)
    const now = new Date().toISOString()
    let { error: updateError } = await supabase.from('bill_splits').update({ last_reminded_at: now }).eq('id', split.id)
    if (updateError) {
      const retry = await supabase.from('bill_splits').update({ reminder_sent_at: now }).eq('id', split.id)
      updateError = retry.error
    }
    if (updateError) { toast.error(TOAST_ERROR); setRemindingKey(null); return }
    const creditorName = currentUser?.name || 'a friend'
    await createNotification(supabase, {
      userId: debt.from.id,
      knotId,
      type: 'bill_reminder',
      actorId: currentUser?.id,
      entityId: split.id,
      message: `You owe ${creditorName} $${parseFloat(split.amount).toFixed(2)}. Settle up in Knot.`,
    })
    toast.success(TOAST_NUDGED)
    setRemindingKey(null)
    onSettled()
  }

  function startPartial(key: string, fullAmount: number) {
    setPartialKey(key)
    setPartialAmount(fullAmount.toFixed(2))
  }

  function confirmPartial(debt: SimplifiedDebt) {
    const amount = parseFloat(partialAmount)
    if (isNaN(amount) || amount <= 0) { setError('Enter a valid amount.'); return }
    if (amount > debt.amount + 0.01) { setError(`Amount can't exceed $${debt.amount.toFixed(2)}.`); return }
    settleDebt(debt, Math.round(amount * 100) / 100)
  }

  if (debts.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text2)' }}>
        <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--sage)' }}>Everyone is settled up</div>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>No outstanding balances in this Knot.</div>
      </div>
    )
  }

  return (
    <div>
      {error && (
        <div className="error-banner" style={{ marginBottom: 14 }}>
          {error}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {debts.map((debt, i) => {
          const key = debt.from.id + debt.to.id
          const isMine = debt.from.id === currentUser?.id
          const isOwedToMe = debt.to.id === currentUser?.id
          const canSettle = isMine || isOwedToMe
          const canRemind = isOwedToMe && !isMine && !!findUnsettledSplit(debt)
          const isPartialOpen = partialKey === key

          return (
            <div key={i} style={{
              padding: '14px 16px',
              background: 'var(--bg2)', border: `1px solid ${isMine ? 'var(--yellow-dim)' : 'var(--border)'}`, borderRadius: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <MemberAvatar name={debt.from.name} avatarUrl={debt.from.avatar_url || null} size={32} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: 'var(--text)' }}>
                    <strong>{isMine ? 'You' : debt.from.name}</strong>
                    <span style={{ color: 'var(--text2)' }}> owe{isMine ? '' : 's'} </span>
                    <strong>{isOwedToMe ? 'you' : debt.to.name}</strong>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: isOwedToMe ? 'var(--sage)' : 'var(--yellow)', marginTop: 2 }}>
                    ${debt.amount.toFixed(2)}
                  </div>
                </div>
                {canSettle && !isPartialOpen && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    {canRemind && (
                      <button type="button" onClick={() => remindDebt(debt)} disabled={remindingKey === key}
                        style={{ ...ghostBtn, opacity: remindingKey === key ? 0.6 : 1 }}>
                        <i className="ti ti-bell" style={{ fontSize: 13, color: 'var(--text3)' }} />
                        {remindingKey === key ? '...' : 'Remind'}
                      </button>
                    )}
                    <button onClick={() => startPartial(key, debt.amount)}
                      style={ghostBtn}>
                      Partial
                    </button>
                    <button onClick={() => settleDebt(debt, debt.amount)} disabled={settlingId === key}
                      style={{ padding: '8px 16px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: settlingId === key ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                      {settlingId === key ? '...' : isMine ? 'Settle up' : 'Mark as received'}
                    </button>
                  </div>
                )}
              </div>

              {isPartialOpen && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text3)' }}>$</span>
                  <input
                    type="number"
                    value={partialAmount}
                    onChange={e => setPartialAmount(e.target.value)}
                    autoFocus
                    style={{ width: 90, padding: '7px 10px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>of ${debt.amount.toFixed(2)}</span>
                  <div style={{ flex: 1 }} />
                  <button onClick={() => { setPartialKey(null); setPartialAmount(''); setError('') }}
                    style={{ padding: '7px 12px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Cancel
                  </button>
                  <button onClick={() => confirmPartial(debt)} disabled={settlingId === key}
                    style={{ padding: '7px 14px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: settlingId === key ? 0.6 : 1 }}>
                    {settlingId === key ? '...' : 'Confirm'}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
