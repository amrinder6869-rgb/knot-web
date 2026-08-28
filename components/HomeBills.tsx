'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { computeNetBalances, simplifyDebts, Bill, BillSplit as BillSplitRow, Settlement, Member } from '@/lib/ledger'
import KnotIcon from '@/components/KnotIcon'

function getInitials(name: string) {
  return (name || 'U').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
}

type KnotRef = { id: string; name: string; emoji?: string }

export default function HomeBills({ knots, currentUser, onOpenKnotTab, onOpenCrossKnot }: {
  knots: KnotRef[]
  currentUser: any
  onOpenKnotTab: (knot: KnotRef, tabId: string) => void
  onOpenCrossKnot?: () => void
}) {
  const [rows, setRows]     = useState<{ knot: KnotRef; debts: any[] }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')

  useEffect(() => {
    if (knots.length > 0 && currentUser) load()
    else setLoading(false)
  }, [knots.map(k => k.id).join(','), currentUser?.id])

  async function load() {
    setError('')
    const results: { knot: KnotRef; debts: any[] }[] = []

    for (const knot of knots) {
      const [{ data: knotMembers }, { data: billData }, { data: settlementData }] = await Promise.all([
        supabase.from('knot_members').select('user_id, profiles:user_id(id, name)').eq('knot_id', knot.id),
        supabase.from('bills').select('id, added_by, total_amount').eq('knot_id', knot.id),
        supabase.from('settlements').select('from_user_id, to_user_id, amount').eq('knot_id', knot.id),
      ])

      if (!billData || billData.length === 0) continue

      const members: Member[] = (knotMembers || []).map((m: any) => ({ id: m.profiles?.id || m.user_id, name: m.profiles?.name || 'Someone' }))
      const billIds = billData.map((b: any) => b.id)
      const { data: splitData } = billIds.length > 0
        ? await supabase.from('bill_splits').select('bill_id, user_id, amount').in('bill_id', billIds)
        : { data: [] as any[] }

      const bills: Bill[] = billData.map((b: any) => ({ id: b.id, added_by: b.added_by, total_amount: parseFloat(b.total_amount) }))
      const splits: BillSplitRow[] = (splitData || []).map((s: any) => ({ bill_id: s.bill_id, user_id: s.user_id, amount: parseFloat(s.amount) }))
      const settlements: Settlement[] = (settlementData || []).map((s: any) => ({ from_user_id: s.from_user_id, to_user_id: s.to_user_id, amount: parseFloat(s.amount) }))

      const balances = computeNetBalances(bills, splits, settlements, members)
      const simplified = simplifyDebts(balances, members)
      const myDebts = simplified.filter(d => d.from.id === currentUser.id || d.to.id === currentUser.id)

      if (myDebts.length > 0) results.push({ knot, debts: myDebts })
    }

    setRows(results)
    setLoading(false)
  }

  if (loading) return <div style={{ color: 'var(--text2)', fontSize: 13, padding: '20px 0' }}>Loading...</div>
  if (error) return <div className="error-banner">{error}</div>

  const totalOwed = rows.reduce((sum, r) => sum + r.debts.filter(d => d.to.id === currentUser?.id).reduce((s, d) => s + d.amount, 0), 0)
  const totalOwe  = rows.reduce((sum, r) => sum + r.debts.filter(d => d.from.id === currentUser?.id).reduce((s, d) => s + d.amount, 0), 0)

  if (rows.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 20px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--sage)', marginBottom: 6 }}>All settled up everywhere</div>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>No outstanding balances across any of your Knots.</div>
      </div>
    )
  }

  return (
    <div>
      <div
        onClick={onOpenCrossKnot}
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20, cursor: onOpenCrossKnot ? 'pointer' : 'default' }}
        role={onOpenCrossKnot ? 'button' : undefined}
        tabIndex={onOpenCrossKnot ? 0 : undefined}
        onKeyDown={onOpenCrossKnot ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenCrossKnot() } } : undefined}
      >
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--sage)', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, color: 'var(--sage)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>You are owed</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--sage)' }}>${totalOwed.toFixed(2)}</div>
        </div>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--yellow)', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, color: 'var(--yellow)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>You owe</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--yellow)' }}>${totalOwe.toFixed(2)}</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {rows.map(({ knot, debts }) => (
          <div key={knot.id}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <KnotIcon value={knot.emoji} size={20} iconSize={11} />
              {knot.name}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {debts.map((debt, i) => {
                const isMine = debt.from.id === currentUser?.id
                return (
                  <div key={i} onClick={() => onOpenKnotTab(knot, 'split')}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'var(--bg2)', border: `1px solid ${isMine ? 'var(--yellow-dim)' : 'var(--border)'}`, borderRadius: 10, cursor: 'pointer' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--yellow)', color: '#111', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {getInitials(isMine ? debt.to.name : debt.from.name)}
                    </div>
                    <div style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>
                      {isMine
                        ? <>You owe <strong>{debt.to.name}</strong></>
                        : <><strong>{debt.from.name}</strong> owes you</>}
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 800, color: isMine ? 'var(--yellow)' : 'var(--sage)' }}>${debt.amount.toFixed(2)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
