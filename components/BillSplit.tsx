'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Skeleton } from '@/components/Skeleton'

function timeAgo(date: string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function focusInput(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = 'var(--rust)'
  e.currentTarget.style.boxShadow   = '0 0 0 3px var(--rust-dim)'
}
function blurInput(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = 'var(--border2)'
  e.currentTarget.style.boxShadow   = 'none'
}

export default function BillSplit({ members, knotId }: { members: any[], knotId?: string }) {
  const [bills, setBills]             = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [showAdd, setShowAdd]         = useState(false)
  const [amount, setAmount]           = useState('')
  const [description, setDescription] = useState('')
  const [adding, setAdding]           = useState(false)
  const [addError, setAddError]       = useState('')
  const [user, setUser]               = useState<any>(null)
  const [knotMembers, setKnotMembers] = useState<any[]>([])
  const [confirmSettle, setConfirmSettle] = useState<string|null>(null)

  useEffect(() => {
    async function init() {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (u) setUser(u)
      if (knotId) { setBills([]); setLoading(true); await loadKnotMembers(); await loadBills() }
    }
    init()
  }, [knotId])

  async function loadKnotMembers() {
    const { data } = await supabase.from('knot_members').select('user_id, profiles:user_id(id, name)').eq('knot_id', knotId)
    if (data) setKnotMembers(data.map((m: any) => m.profiles))
  }

  async function loadBills() {
    if (!knotId) return
    const { data: billData } = await supabase.from('bills').select('*, profiles:added_by(name)').eq('knot_id', knotId).order('created_at', { ascending: false })
    if (!billData) { setLoading(false); return }
    const billsWithSplits = await Promise.all(billData.map(async (bill: any) => {
      const { data: splitData } = await supabase.from('bill_splits').select('*, profiles:user_id(name)').eq('bill_id', bill.id)
      return { ...bill, splits: splitData || [] }
    }))
    setBills(billsWithSplits)
    setLoading(false)
  }

  async function addBill() {
    if (!knotId || !user || !amount || adding) return
    const total = parseFloat(amount)
    if (isNaN(total) || total <= 0) { setAddError('Enter a valid amount'); return }
    setAddError('')
    setAdding(true)
    const { data: bill } = await supabase.from('bills')
      .insert({ knot_id: knotId, added_by: user.id, total_amount: total, description: description || 'Bill', split_type: 'equal' })
      .select().single()
    if (bill) {
      const perPerson = total / knotMembers.length
      await supabase.from('bill_splits').insert(knotMembers.map((m: any) => ({
        bill_id: bill.id, user_id: m.id,
        amount: Math.round(perPerson * 100) / 100,
        is_treat: false, settled: m.id === user.id,
      })))
      await supabase.from('posts').insert({ knot_id: knotId, author_id: user.id, content: `added a bill — $${total.toFixed(2)} for ${description || 'tonight'}, split ${knotMembers.length} ways`, post_type: 'moment' })
      setAmount(''); setDescription(''); setShowAdd(false); await loadBills()
    }
    setAdding(false)
  }

  async function settleUp(splitId: string) {
    if (!user) return
    await supabase.from('bill_splits').update({ settled: true, settled_at: new Date().toISOString() }).eq('id', splitId).eq('user_id', user.id)
    setConfirmSettle(null)
    await loadBills()
  }

  const getInitials = (name: string) => name?.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase() || '?'

  const myOpenBalance = bills.reduce((total, bill) => {
    const mySplit = bill.splits?.find((s: any) => s.user_id === user?.id)
    if (mySplit && !mySplit.settled) return total + mySplit.amount
    return total
  }, 0)

  if (loading) return (
    <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {[0, 1].map(i => (
        <div key={i} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Skeleton height={18} width={80} />
              <Skeleton height={12} width={140} />
            </div>
            <Skeleton height={22} width={90} borderRadius={20} />
          </div>
          {[0, 1, 2].map(j => (
            <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <Skeleton width={28} height={28} borderRadius={14} />
              <Skeleton height={12} width="45%" />
              <Skeleton height={14} width={50} />
              <Skeleton height={24} width={72} borderRadius={20} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )

  return (
    <div style={{ maxWidth: 720 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.3px' }}>Bills</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>
            {myOpenBalance > 0
              ? <span style={{ color: 'var(--rust)', fontWeight: 600 }}>You owe ${myOpenBalance.toFixed(2)}</span>
              : <span style={{ color: 'var(--sage)', fontWeight: 600 }}>All settled up</span>}
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)} style={{ fontSize: 13 }}>
          Add bill
        </button>
      </div>

      {/* Add Bill form */}
      {showAdd && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--rust-dim)', borderRadius: 12, padding: 16, marginBottom: 20, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, letterSpacing: '-0.3px' }}>Add a bill</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>Split equally among all members</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <input value={amount} onChange={e => setAmount(e.target.value)}
              onFocus={focusInput} onBlur={blurInput}
              placeholder="Amount ($)"
              type="number"
              style={{ flex: 1, padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s, box-shadow 0.15s' }} />
            <input value={description} onChange={e => setDescription(e.target.value)}
              onFocus={focusInput} onBlur={blurInput}
              placeholder="What for? (e.g. Dinner)"
              style={{ flex: 2, padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s, box-shadow 0.15s' }} />
          </div>
          {knotMembers.length > 0 && amount && (
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
              {knotMembers.length} members · <strong style={{ color: 'var(--text2)' }}>${(parseFloat(amount) / knotMembers.length).toFixed(2)}</strong> each
            </div>
          )}
          {addError && <div style={{ padding: '8px 12px', background: 'var(--rust-soft)', border: '1px solid var(--rust-dim)', borderRadius: 8, fontSize: 12, color: 'var(--rust)', marginBottom: 10 }}>{addError}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={addBill} disabled={adding || !amount} style={{ flex: 1, fontSize: 13, padding: '9px' }}>
              {adding ? 'Adding...' : 'Add & split'}
            </button>
            <button className="btn btn-secondary" onClick={() => { setShowAdd(false); setAmount(''); setDescription(''); setAddError('') }} style={{ fontSize: 13, padding: '9px 14px' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {bills.length === 0 && (
        <div style={{ textAlign: 'center', padding: '56px 20px' }}>
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none" style={{ marginBottom: 16, opacity: 0.2 }}>
            <rect x="10" y="6" width="24" height="32" rx="3" stroke="var(--text)" strokeWidth="2"/>
            <line x1="16" y1="16" x2="28" y2="16" stroke="var(--text)" strokeWidth="2" strokeLinecap="round"/>
            <line x1="16" y1="22" x2="28" y2="22" stroke="var(--text)" strokeWidth="2" strokeLinecap="round"/>
            <line x1="16" y1="28" x2="22" y2="28" stroke="var(--text)" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, letterSpacing: '-0.3px' }}>You&apos;re all square.</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20, lineHeight: 1.6 }}>Add a bill after your next night out.</div>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)} style={{ fontSize: 13 }}>
            Add bill
          </button>
        </div>
      )}

      {/* Bills list */}
      {bills.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {bills.map(bill => {
            const settledCount = bill.splits?.filter((s: any) => s.settled).length || 0
            const progress = bill.splits?.length > 0 ? Math.round(settledCount / bill.splits.length * 100) : 0

            return (
              <div key={bill.id} className="card-hover" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.3px' }}>${bill.total_amount.toFixed(2)}</div>
                    <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>{bill.description}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{timeAgo(bill.created_at)} · Added by {bill.profiles?.name || 'someone'}</div>
                  </div>
                  <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: progress === 100 ? 'var(--sage-soft)' : 'var(--amber-soft)', color: progress === 100 ? 'var(--sage)' : 'var(--amber)', fontWeight: 600 }}>
                    {progress === 100 ? 'All settled' : `${settledCount}/${bill.splits?.length}`}
                  </span>
                </div>

                {bill.splits?.map((split: any) => {
                  const isMe = split.user_id === user?.id
                  const isConfirming = confirmSettle === split.id
                  return (
                    <div key={split.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--olive-soft)', color: 'var(--olive)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {getInitials(split.profiles?.name || '?')}
                      </div>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>
                        {split.profiles?.name || 'Unknown'}{isMe ? <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}> (you)</span> : ''}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: split.settled ? 'var(--text3)' : 'var(--rust)', textDecoration: split.settled ? 'line-through' : 'none' }}>
                        ${split.amount.toFixed(2)}
                      </span>
                      {split.settled ? (
                        <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 20, background: 'var(--sage-soft)', color: 'var(--sage)', fontWeight: 600 }}>Paid</span>
                      ) : isMe ? (
                        isConfirming ? (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span style={{ fontSize: 12, color: 'var(--text2)' }}>Confirm?</span>
                            <button className="btn btn-secondary" onClick={() => setConfirmSettle(null)} style={{ fontSize: 11, padding: '3px 8px' }}>No</button>
                            <button className="btn btn-primary" onClick={() => settleUp(split.id)} style={{ fontSize: 11, padding: '3px 8px', background: 'var(--sage)', boxShadow: 'none' }}>Yes</button>
                          </div>
                        ) : (
                          <button className="btn btn-secondary" onClick={() => setConfirmSettle(split.id)} style={{ fontSize: 11, padding: '4px 10px', color: 'var(--sage)', borderColor: 'var(--sage-dim)' }}>
                            Settle up
                          </button>
                        )
                      ) : (
                        <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 20, background: 'var(--amber-soft)', color: 'var(--amber)', fontWeight: 600 }}>Pending</span>
                      )}
                    </div>
                  )
                })}

                <div style={{ height: 3, background: 'var(--bg4)', borderRadius: 2, overflow: 'hidden', marginTop: 12 }}>
                  <div style={{ height: '100%', borderRadius: 2, background: 'var(--sage)', width: `${progress}%`, transition: 'width 0.4s' }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{settledCount} of {bill.splits?.length} settled</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
