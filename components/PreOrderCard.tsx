'use client'
import { useState, useEffect } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { supabase } from '@/lib/supabase'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface PreOrderCardProps {
  hangout: any
  knotId: string
  currentUserId: string
  isLive?: boolean
}

function CheckoutForm({
  amount,
  clientSecret: cs,
  onSuccess,
  onCancel,
}: {
  amount: number
  clientSecret: string
  onSuccess: (paymentIntentId: string) => void
  onCancel: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!stripe || !elements) return
    setProcessing(true)
    setError('')

    const cardElement = elements.getElement(CardElement)
    if (!cardElement) {
      setError('Card input not found.')
      setProcessing(false)
      return
    }

    const { paymentIntent, error: confirmError } = await stripe.confirmCardPayment(cs, {
      payment_method: { card: cardElement },
    })

    if (confirmError) {
      setError(confirmError.message || 'Payment failed')
      setProcessing(false)
      return
    }

    if (paymentIntent?.status === 'succeeded') {
      onSuccess(paymentIntent.id)
    }
    setProcessing(false)
  }

  const payLabel = 'Pay $' + amount.toFixed(2)

  return (
    <div>
      <div style={{ padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 8, background: '#fff', marginBottom: 12 }}>
        <CardElement options={{ style: { base: { fontSize: '14px', fontFamily: 'Manrope, sans-serif', color: '#111' } } }} />
      </div>
      {error && <div style={{ fontSize: 12, color: '#DC2626', marginBottom: 8 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          Cancel
        </button>
        <button onClick={handleSubmit} disabled={!stripe || processing} style={{ flex: 2, padding: '10px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: processing ? 0.6 : 1 }}>
          {processing ? 'Processing...' : payLabel}
        </button>
      </div>
    </div>
  )
}

export function PreOrderCard({ hangout, knotId, currentUserId, isLive = false }: PreOrderCardProps) {
  const [merchant, setMerchant] = useState<any>(null)
  const [menuItems, setMenuItems] = useState<any[]>([])
  const [order, setOrder] = useState<any>(null)
  const [myItems, setMyItems] = useState<Record<string, number>>({})
  const [allOrderItems, setAllOrderItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [clientSecret, setClientSecret] = useState('')
  const [showPayment, setShowPayment] = useState(false)
  const [paid, setPaid] = useState(false)
  const [error, setError] = useState('')

  const borderSep = isLive ? 'rgba(255,255,255,0.1)' : 'var(--border)'
  const textColor = isLive ? 'rgba(255,255,255,0.9)' : 'var(--text)'
  const subColor = isLive ? 'rgba(255,255,255,0.5)' : 'var(--text3)'

  useEffect(() => {
    if (!hangout.venue_place_id) { setLoading(false); return }
    let cancelled = false
    loadMerchantData().then(() => { if (cancelled) return })
    return () => { cancelled = true }
  }, [hangout.id, hangout.venue_place_id])

  async function loadMerchantData() {
    // Use limit(1) — never .single()/.maybeSingle() — so 0 or many merchants
    // never produce a PostgREST 406 in the browser network log.
    const { data: rows, error } = await supabase
      .from('merchants')
      .select('*')
      .eq('place_id', hangout.venue_place_id)
      .eq('active', true)
      .limit(1)

    if (error) {
      console.warn('Merchant lookup failed:', error.message)
      setLoading(false)
      return
    }

    const m = rows?.[0]
    if (!m) { setLoading(false); return }
    setMerchant(m)

    const { data: items } = await supabase
      .from('menu_items')
      .select('*')
      .eq('merchant_id', m.id)
      .eq('available', true)
      .order('category')

    setMenuItems(items || [])

    const { data: orderRows } = await supabase
      .from('hangout_orders')
      .select('*, order_items(*, menu_item:menu_item_id(name, price), profile:user_id(name))')
      .eq('hangout_id', hangout.id)
      .limit(1)

    const existingOrder = orderRows?.[0]
    if (existingOrder) {
      setOrder(existingOrder)
      setAllOrderItems(existingOrder.order_items || [])
      const myExisting = existingOrder.order_items?.filter((i: any) => i.user_id === currentUserId) || []
      const myMap: Record<string, number> = {}
      myExisting.forEach((i: any) => { myMap[i.menu_item_id] = i.quantity })
      setMyItems(myMap)
      if (myExisting.some((i: any) => i.payment_status === 'paid')) setPaid(true)
    }

    setLoading(false)
  }

  function getMyTotal() {
    return Object.entries(myItems).reduce((sum, [itemId, qty]) => {
      const item = menuItems.find(m => m.id === itemId)
      return sum + (item ? item.price * qty : 0)
    }, 0)
  }

  async function createOrGetOrder() {
    if (order) return order
    const { data, error: upsertError } = await supabase
      .from('hangout_orders')
      .upsert(
        { hangout_id: hangout.id, merchant_id: merchant.id, knot_id: knotId, status: 'open' },
        { onConflict: 'hangout_id' }
      )
      .select()
      .single()
    if (upsertError) throw upsertError
    setOrder(data)
    return data
  }

  async function saveItems() {
    if (Object.keys(myItems).filter(k => myItems[k] > 0).length === 0) {
      setError('Select at least one item.')
      return
    }
    setError('')
    try {
      const currentOrder = await createOrGetOrder()

      await supabase.from('order_items')
        .delete()
        .eq('order_id', currentOrder.id)
        .eq('user_id', currentUserId)

      const itemsToInsert = Object.entries(myItems)
        .filter(([, qty]) => qty > 0)
        .map(([itemId, qty]) => {
          const item = menuItems.find(m => m.id === itemId)
          return {
            order_id: currentOrder.id,
            user_id: currentUserId,
            menu_item_id: itemId,
            quantity: qty,
            unit_price: item.price,
            total_price: item.price * qty,
            payment_status: 'pending',
          }
        })

      await supabase.from('order_items').insert(itemsToInsert)

      const myTotal = getMyTotal()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/stripe/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session?.access_token },
        body: JSON.stringify({ amount: myTotal, orderId: currentOrder.id, hangoutId: hangout.id, merchantName: merchant.name }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setClientSecret(data.clientSecret)
      setShowPayment(true)
    } catch (err: any) {
      setError(err.message || 'Something went wrong.')
    }
  }

  async function onPaymentSuccess(paymentIntentId: string) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch('/api/stripe/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session?.access_token },
        body: JSON.stringify({ paymentIntentId, orderId: order.id }),
      })
    } catch (err) {
      console.error('Payment verification error:', err)
    }
    setPaid(true)
    setShowPayment(false)
    loadMerchantData()
  }

  if (loading || !merchant || menuItems.length === 0) return null

  const myTotal = getMyTotal()
  const paidMembers = [...new Set(allOrderItems.filter(i => i.payment_status === 'paid').map((i: any) => i.profile?.name))]
  const pendingMembers = [...new Set(allOrderItems.filter(i => i.payment_status === 'pending').map((i: any) => i.profile?.name))]
  const preOrderLabel = 'Pre-order and pay $' + myTotal.toFixed(2)

  return (
    <div style={{ borderTop: '1px solid ' + borderSep, paddingTop: 14, marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: subColor, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
        Pre-order from {merchant.name}
      </div>

      {paid ? (
        <div style={{ padding: '10px 14px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#16A34A' }}>Your order is paid</div>
          <div style={{ fontSize: 12, color: subColor, marginTop: 2 }}>
            {Object.entries(myItems).map(([itemId, qty]) => {
              const item = menuItems.find(m => m.id === itemId)
              return item ? qty + 'x ' + item.name : ''
            }).filter(Boolean).join(', ')}
          </div>
        </div>
      ) : (
        <>
          {error && <div style={{ fontSize: 12, color: '#DC2626', marginBottom: 8 }}>{error}</div>}

          {!showPayment ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                {menuItems.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid ' + borderSep }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: textColor }}>{item.name}</div>
                      {item.description && <div style={{ fontSize: 11, color: subColor }}>{item.description}</div>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: textColor }}>{'$' + parseFloat(item.price).toFixed(2)}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button onClick={() => setMyItems(prev => ({ ...prev, [item.id]: Math.max(0, (prev[item.id] || 0) - 1) }))}
                          style={{ width: 24, height: 24, borderRadius: '50%', border: '1px solid ' + borderSep, background: 'none', color: textColor, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          -
                        </button>
                        <span style={{ fontSize: 13, fontWeight: 600, color: textColor, minWidth: 16, textAlign: 'center' }}>{myItems[item.id] || 0}</span>
                        <button onClick={() => setMyItems(prev => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }))}
                          style={{ width: 24, height: 24, borderRadius: '50%', border: '1px solid ' + borderSep, background: 'none', color: textColor, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {myTotal > 0 && (
                <button onClick={saveItems} style={{ width: '100%', padding: '10px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {preOrderLabel}
                </button>
              )}
            </>
          ) : (
            clientSecret ? (
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <CheckoutForm amount={myTotal} clientSecret={clientSecret} onSuccess={onPaymentSuccess} onCancel={() => setShowPayment(false)} />
              </Elements>
            ) : null
          )}
        </>
      )}

      {allOrderItems.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 12, color: subColor }}>
          {paidMembers.length > 0 && <div style={{ color: '#16A34A' }}>{paidMembers.join(', ')} paid</div>}
          {pendingMembers.length > 0 && <div>{pendingMembers.join(', ')} selecting</div>}
        </div>
      )}
    </div>
  )
}
