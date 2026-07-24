'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { SimplifiedDebt } from '@/lib/ledger'

function getInitials(name: string) {
  return (name || 'U').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
}

type LedgerViewProps = {
  debts: SimplifiedDebt[]
  currentUser: any
  knotId: string
  onSettled: () => void
}

export default function LedgerView({ debts, currentUser, knotId, onSettled }: LedgerViewProps) {
  const [settlingId, setSettlingId] = useState<string | null>(null)
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

    setSettlingId(null)
    setPartialKey(null)
    setPartialAmount('')
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
        <div style={{ padding: '10px 14px', background: 'var(--yellow-soft)', border: '1px solid var(--yellow-dim)', borderRadius: 8, fontSize: 13, color: 'var(--yellow)', marginBottom: 14 }}>
          {error}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {debts.map((debt, i) => {
          const key = debt.from.id + debt.to.id
          const isMine = debt.from.id === currentUser?.id
          const isOwedToMe = debt.to.id === currentUser?.id
          const canSettle = isMine || isOwedToMe
          const isPartialOpen = partialKey === key

          return (
            <div key={i} style={{
              padding: '14px 16px',
              background: 'var(--bg2)', border: `1px solid ${isMine ? 'var(--yellow-dim)' : 'var(--border)'}`, borderRadius: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--yellow)', color: '#111', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {getInitials(debt.from.name)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: 'var(--text)' }}>
                    <strong>{isMine ? 'You' : debt.from.name}</strong>
                    <span style={{ color: 'var(--text2)' }}> owe{isMine ? '' : 's'} </span>
                    <strong>{isOwedToMe ? 'you' : debt.to.name}</strong>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--yellow)', marginTop: 2 }}>
                    ${debt.amount.toFixed(2)}
                  </div>
                </div>
                {canSettle && !isPartialOpen && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => startPartial(key, debt.amount)}
                      style={{ padding: '8px 12px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
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
