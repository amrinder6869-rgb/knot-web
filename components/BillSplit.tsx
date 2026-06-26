'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

function timeAgo(date: string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export default function BillSplit({ members, knotId }: { members: any[], knotId?: string }) {
  const [bills, setBills]             = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [showAdd, setShowAdd]         = useState(false)
  const [amount, setAmount]           = useState('')
  const [description, setDescription] = useState('')
  const [adding, setAdding]           = useState(false)
  const [user, setUser]               = useState<any>(null)
  const [knotMembers, setKnotMembers] = useState<any[]>([])

  useEffect(() => {
  async function init() {
    const { data: { user: u } } = await supabase.auth.getUser()
    if (u) setUser(u)
    if (knotId) {
      setBills([])
      setLoading(true)
      await loadKnotMembers()
      await loadBills()
    }
  }
  init()
}, [knotId])

  async function loadKnotMembers() {
    const { data } = await supabase
      .from('knot_members')
      .select('user_id, profiles:user_id(id, name)')
      .eq('knot_id', knotId)
    if (data) setKnotMembers(data.map((m: any) => m.profiles))
  }

  async function loadBills() {
    if (!knotId) return
    const { data: billData } = await supabase
      .from('bills')
      .select('*, profiles:added_by(name)')
      .eq('knot_id', knotId)
      .order('created_at', { ascending: false })

    if (!billData) { setLoading(false); return }

    const billsWithSplits = await Promise.all(billData.map(async (bill: any) => {
      const { data: splitData } = await supabase
        .from('bill_splits')
        .select('*, profiles:user_id(name)')
        .eq('bill_id', bill.id)
      return { ...bill, splits: splitData || [] }
    }))

    setBills(billsWithSplits)
    setLoading(false)
  }

  async function addBill() {
    if (!knotId || !user || !amount || adding) return
    if (knotMembers.length === 0) { alert('Cannot split — no members loaded'); return }
    const total = parseFloat(amount)
    if (isNaN(total) || total <= 0) { alert('Enter a valid amount'); return }
    setAdding(true)

    const { data: bill } = await supabase
      .from('bills')
      .insert({ knot_id: knotId, added_by: user.id, total_amount: total, description: description || 'Bill', split_type: 'equal' })
      .select().single()

    if (bill) {
      const perPerson = total / knotMembers.length
      const splitInserts = knotMembers.map((m: any) => ({
        bill_id:  bill.id,
        user_id:  m.id,
        amount:   Math.round(perPerson * 100) / 100,
        is_treat: false,
        settled:  m.id === user.id,
      }))
      await supabase.from('bill_splits').insert(splitInserts)
      await supabase.from('posts').insert({
        knot_id:   knotId,
        author_id: user.id,
        content:   `added a bill â€” $${total.toFixed(2)} for ${description || 'tonight'}, split ${knotMembers.length} ways`,
        post_type: 'moment'
      })
      setAmount('')
      setDescription('')
      setShowAdd(false)
      await loadBills()
    }
    setAdding(false)
  }

  async function settleUp(splitId: string) {
    if (!user) return
    // Enforce that only the current user can settle their own split
    await supabase
      .from('bill_splits')
      .update({ settled: true, settled_at: new Date().toISOString() })
      .eq('id', splitId)
      .eq('user_id', user.id)
    await loadBills()
  }

  const getInitials = (name: string) => name?.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase() || '?'

  const myOpenBalance = bills.reduce((total, bill) => {
    const mySplit = bill.splits?.find((s: any) => s.user_id === user?.id)
    if (mySplit && !mySplit.settled) return total + mySplit.amount
    return total
  }, 0)

  if (loading) return <div style={{ color: 'var(--text2)', fontSize: 13, padding: '20px 0' }}>Loading...</div>

  return (
    <div style={{ maxWidth: 720 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Bills</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>
            {myOpenBalance > 0
              ? <span style={{ color: 'var(--rust)' }}>You owe ${myOpenBalance.toFixed(2)} total</span>
              : <span style={{ color: 'var(--sage)' }}>All settled up</span>}
          </div>
        </div>
        <button onClick={() => setShowAdd(true)}
          style={{ background: 'var(--rust)', border: 'none', borderRadius: 8, color: '#fff', padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          Add bill
        </button>
      </div>

      {/* Add Bill */}
      {showAdd && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--rust)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Add a bill</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <input value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="Total amount ($)"
              type="number"
              style={{ flex: 1, padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
            <input value={description} onChange={e => setDescription(e.target.value)}
              placeholder="What for? (e.g. Dinner)"
              style={{ flex: 2, padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
            Split equally between {knotMembers.length} members Â· ${knotMembers.length > 0 && amount ? (parseFloat(amount) / knotMembers.length).toFixed(2) : '0.00'} each
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={addBill} disabled={adding || !amount}
              style={{ flex: 1, padding: '9px', background: 'var(--rust)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: adding ? 0.7 : 1 }}>
              {adding ? 'Adding...' : 'Add & split'}
            </button>
            <button onClick={() => { setShowAdd(false); setAmount(''); setDescription('') }}
              style={{ padding: '9px 14px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Bills */}
      {bills.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text2)' }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>No bills yet</div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>Add a bill after your next hangout.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {bills.map(bill => {
            const settledCount = bill.splits?.filter((s: any) => s.settled).length || 0
            const progress = bill.splits?.length > 0 ? Math.round(settledCount / bill.splits.length * 100) : 0

            return (
              <div key={bill.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>${bill.total_amount.toFixed(2)}</div>
                    <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>{bill.description} Â· {timeAgo(bill.created_at)}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Added by {bill.profiles?.name || 'someone'}</div>
                  </div>
                  <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: progress === 100 ? 'var(--sage-soft)' : 'var(--amber-soft)', color: progress === 100 ? 'var(--sage)' : 'var(--amber)' }}>
                    {progress === 100 ? 'All settled' : `${settledCount}/${bill.splits?.length} settled`}
                  </span>
                </div>

                {bill.splits?.map((split: any) => {
                  const isMe = split.user_id === user?.id
                  return (
                    <div key={split.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--olive-soft)', color: 'var(--olive)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {getInitials(split.profiles?.name || '?')}
                      </div>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>
                        {split.profiles?.name || 'Unknown'}{isMe ? ' (you)' : ''}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: split.settled ? 'var(--text3)' : 'var(--rust)', textDecoration: split.settled ? 'line-through' : 'none' }}>
                        ${split.amount.toFixed(2)}
                      </span>
                      {split.settled ? (
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--sage-soft)', color: 'var(--sage)' }}>Paid</span>
                      ) : isMe ? (
                        <button onClick={() => settleUp(split.id)}
                          style={{ fontSize: 12, padding: '4px 12px', borderRadius: 8, background: 'var(--sage-soft)', border: '1px solid var(--sage-dim)', color: 'var(--sage)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                          Settle up
                        </button>
                      ) : (
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--amber-soft)', color: 'var(--amber)' }}>Pending</span>
                      )}
                    </div>
                  )
                })}

                <div style={{ height: 4, background: 'var(--bg4)', borderRadius: 2, overflow: 'hidden', marginTop: 12 }}>
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
