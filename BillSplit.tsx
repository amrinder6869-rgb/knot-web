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

function getInitials(name: string) {
  return (name || 'U').split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()
}

export default function BillSplit({ members, knotId, currentUser }: { members: any[], knotId?: string, currentUser?: any }) {
  const [bills, setBills]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [amount, setAmount]   = useState('')
  const [description, setDescription] = useState('')
  const [adding, setAdding]   = useState(false)
  const [addError, setAddError] = useState('')
  const [settleError, setSettleError] = useState('')

  useEffect(() => {
    if (knotId) loadBills()
  }, [knotId])

  async function loadBills() {
    if (!knotId) return
    setLoadError('')
    const { data: billData, error: billsFetchError } = await supabase
      .from('bills')
      .select('*, profiles:added_by(name), hangouts:hangout_id(title, venue_name)')
      .eq('knot_id', knotId)
      .order('created_at', { ascending: false })

    if (billsFetchError) {
      setLoadError('Could not load bills. Try refreshing.')
      setLoading(false)
      return
    }

    if (!billData) { setLoading(false); return }

    const withSplits = await Promise.all(billData.map(async (bill: any) => {
      const { data: splitData, error: splitsFetchError } = await supabase
        .from('bill_splits')
        .select('*, profiles:user_id(name)')
        .eq('bill_id', bill.id)
      if (splitsFetchError) return { ...bill, splits: [] }
      return { ...bill, splits: splitData || [] }
    }))

    setBills(withSplits)
    setLoading(false)
  }

  async function addStandaloneBill() {
    if (!knotId || !currentUser || !amount || adding) return
    if (members.length === 0) { setAddError('No members in this Knot to split with.'); return }
    const total = parseFloat(amount)
    if (isNaN(total) || total <= 0) { setAddError('Enter a valid amount.'); return }
    setAdding(true)
    setAddError('')

    const { data: bill, error: billInsertError } = await supabase
      .from('bills')
      .insert({ knot_id: knotId, added_by: currentUser.id, total_amount: total, description: description || 'Bill', split_type: 'equal' })
      .select().single()

    if (billInsertError || !bill) {
      setAddError('Could not add the bill. Please try again.')
      setAdding(false)
      return
    }

    const perPerson = total / members.length
    const { error: splitsError } = await supabase.from('bill_splits').insert(
      members.map((m: any) => ({
        bill_id: bill.id,
        user_id: m.id,
        amount:  Math.round(perPerson * 100) / 100,
        settled: m.id === currentUser.id,
      }))
    )
    if (splitsError) setAddError('Bill added, but the split failed to save.')

    const { error: postInsertError } = await supabase.from('posts').insert({
      knot_id:   knotId,
      author_id: currentUser.id,
      content:   `added a bill \u2014 $${total.toFixed(2)} for ${description || 'tonight'}, split ${members.length} ways`,
      post_type: 'bill',
    })
    if (postInsertError && !splitsError) setAddError('Bill added, but it could not be posted to the feed.')

    setAmount('')
    setDescription('')
    setShowAdd(false)
    setAdding(false)
    await loadBills()
  }

  async function settleUp(splitId: string) {
    if (!currentUser) return
    setSettleError('')
    const { error } = await supabase.from('bill_splits').update({ settled: true, settled_at: new Date().toISOString() }).eq('id', splitId).eq('user_id', currentUser.id)
    if (error) { setSettleError('Could not mark as paid. Please try again.'); return }
    await loadBills()
  }

  const myOpenBalance = bills.reduce((total, bill) => {
    const mySplit = bill.splits?.find((s: any) => s.user_id === currentUser?.id)
    if (mySplit && !mySplit.settled) return total + parseFloat(mySplit.amount)
    return total
  }, 0)

  if (loading) return <div style={{ color: 'var(--text2)', fontSize: 13, padding: '20px 0' }}>Loading...</div>

  return (
    <div style={{ maxWidth: 720 }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Bills</div>
          <div style={{ fontSize: 13, marginTop: 2 }}>
            {myOpenBalance > 0
              ? <span style={{ color: 'var(--yellow)', fontWeight: 600 }}>You owe ${myOpenBalance.toFixed(2)} total</span>
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

      {settleError && (
        <div style={{ padding: '10px 14px', background: 'var(--yellow-soft)', border: '1px solid var(--yellow-dim)', borderRadius: 8, fontSize: 13, color: 'var(--yellow)', marginBottom: 16 }}>
          {settleError}
        </div>
      )}

      {showAdd && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--yellow)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Add a bill</div>
          {addError && (
            <div style={{ padding: '8px 12px', background: 'var(--yellow-soft)', border: '1px solid var(--yellow-dim)', borderRadius: 8, fontSize: 12, color: 'var(--yellow)', marginBottom: 10 }}>
              {addError}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <input value={amount} onChange={e => setAmount(e.target.value)} type="number" placeholder="Total amount ($)"
              style={{ flex: 1, padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="What for?"
              style={{ flex: 2, padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
            Split equally between {members.length} members {amount && !isNaN(parseFloat(amount)) ? `\u00B7 $${(parseFloat(amount) / members.length).toFixed(2)} each` : ''}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={addStandaloneBill} disabled={adding || !amount}
              style={{ flex: 1, padding: '9px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: adding ? 0.7 : 1 }}>
              {adding ? 'Adding...' : 'Add & split'}
            </button>
            <button onClick={() => { setShowAdd(false); setAmount(''); setDescription(''); setAddError('') }}
              style={{ padding: '9px 14px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancel
            </button>
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

            return (
              <div key={bill.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>${parseFloat(bill.total_amount).toFixed(2)}</div>
                    <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>{bill.description} \u00B7 {timeAgo(bill.created_at)}</div>
                    {linkedHangout && <div style={{ fontSize: 12, color: 'var(--yellow)', marginTop: 2 }}>From {linkedHangout}</div>}
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Added by {bill.profiles?.name || 'someone'}</div>
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
                      <span style={{ fontSize: 14, fontWeight: 700, color: split.settled ? 'var(--text3)' : 'var(--yellow)', textDecoration: split.settled ? 'line-through' : 'none' }}>
                        ${parseFloat(split.amount).toFixed(2)}
                      </span>
                      {split.settled ? (
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'var(--sage-soft)', color: 'var(--sage)', fontWeight: 600 }}>Paid</span>
                      ) : isMe ? (
                        <button onClick={() => settleUp(split.id)} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 8, background: 'var(--sage-soft)', border: '1px solid var(--sage-dim)', color: 'var(--sage)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                          Mark paid
                        </button>
                      ) : (
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'var(--amber-soft)', color: 'var(--amber)' }}>Pending</span>
                      )}
                    </div>
                  )
                })}

                <div style={{ height: 3, background: 'var(--bg4)', borderRadius: 2, overflow: 'hidden', marginTop: 12 }}>
                  <div style={{ height: '100%', borderRadius: 2, background: 'var(--sage)', width: `${progress}%`, transition: 'width 0.3s' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
