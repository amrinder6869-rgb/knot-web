const fs = require('fs');
const path = require('path');

const BASE = 'C:\\Users\\amrin\\Documents\\knot-web';

function write(relPath, content) {
  const full = path.join(BASE, relPath);
  const dir = path.dirname(full);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  console.log('Created: ' + relPath);
}

// ─── 1. Stripe payment intent API route ──────────────────────────────────────
write('app/api/stripe/create-payment-intent/route.ts', `import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-12-18.acacia' })

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: \`Bearer \${token}\` } } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { amount, orderId, hangoutId, merchantName } = await request.json()

  if (!amount || amount < 50) return NextResponse.json({ error: 'Minimum amount is $0.50' }, { status: 400 })

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'cad',
      metadata: {
        order_id: orderId || '',
        hangout_id: hangoutId || '',
        user_id: user.id,
        merchant_name: merchantName || '',
      },
      automatic_payment_methods: { enabled: true },
    })

    return NextResponse.json({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
`);

// ─── 2. Menu management in merchant dashboard ─────────────────────────────────
write('components/merchant/MerchantMenu.tsx', `'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Props {
  merchant: any
}

const CATEGORIES = ['Starters', 'Mains', 'Sides', 'Desserts', 'Drinks', 'Packages', 'Other']

export default function MerchantMenu({ merchant }: Props) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState('Mains')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { loadItems() }, [])

  async function loadItems() {
    const { data } = await supabase
      .from('menu_items')
      .select('*')
      .eq('merchant_id', merchant.id)
      .order('category')
      .order('name')
    setItems(data || [])
    setLoading(false)
  }

  async function saveItem() {
    if (!name.trim()) { setError('Please enter item name.'); return }
    if (!price || isNaN(parseFloat(price))) { setError('Please enter a valid price.'); return }
    setSaving(true); setError('')
    const { error: insertError } = await supabase.from('menu_items').insert({
      merchant_id: merchant.id,
      name: name.trim(),
      description: description.trim() || null,
      price: parseFloat(parseFloat(price).toFixed(2)),
      category,
      available: true,
    })
    if (insertError) { setError(insertError.message); setSaving(false); return }
    setSaving(false)
    setShowForm(false)
    setName(''); setDescription(''); setPrice(''); setCategory('Mains')
    loadItems()
  }

  async function toggleItem(id: string, available: boolean) {
    await supabase.from('menu_items').update({ available: !available }).eq('id', id)
    loadItems()
  }

  async function deleteItem(id: string) {
    await supabase.from('menu_items').delete().eq('id', id)
    loadItems()
  }

  const grouped = CATEGORIES.reduce((acc, cat) => {
    const catItems = items.filter(i => i.category === cat)
    if (catItems.length > 0) acc[cat] = catItems
    return acc
  }, {} as Record<string, any[]>)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>Menu</div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>Group members will select from these items when pre-ordering.</div>
        </div>
        <button onClick={() => setShowForm(true)}
          style={{ padding: '9px 16px', background: '#F8BD03', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Add Item
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#fff', border: '1.5px solid #F8BD03', borderRadius: 12, padding: '20px', marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 16 }}>Add menu item</div>
          {error && <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13, color: '#DC2626', marginBottom: 12 }}>{error}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>Item name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Butter Chicken"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #E5E5E5', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>Price (CAD)</label>
              <input value={price} onChange={e => setPrice(e.target.value)} type="number" min="0" step="0.01" placeholder="e.g. 14.99"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #E5E5E5', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>Description (optional)</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Ingredients or details..."
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #E5E5E5', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 8 }}>Category</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setCategory(c)}
                  style={{ padding: '5px 12px', borderRadius: 20, border: category === c ? '1px solid #F8BD03' : '1px solid #E5E5E5', background: category === c ? '#FFFBEB' : 'transparent', color: category === c ? '#D97706' : '#555', fontSize: 12, fontWeight: category === c ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setShowForm(false); setError('') }}
              style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid #E5E5E5', borderRadius: 8, color: '#555', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancel
            </button>
            <button onClick={saveItem} disabled={saving}
              style={{ flex: 2, padding: '10px', background: '#F8BD03', border: 'none', borderRadius: 8, color: '#111', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving...' : 'Add to menu'}
            </button>
          </div>
        </div>
      )}

      {loading && <div style={{ color: '#888', fontSize: 14 }}>Loading menu...</div>}

      {!loading && items.length === 0 && !showForm && (
        <div style={{ textAlign: 'center', padding: '48px 20px', background: '#fff', border: '1px solid #E5E5E5', borderRadius: 12 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🍽️</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111', marginBottom: 6 }}>No menu items yet</div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>Add your menu so groups can pre-order before they arrive.</div>
          <button onClick={() => setShowForm(true)}
            style={{ padding: '10px 20px', background: '#F8BD03', border: 'none', borderRadius: 8, color: '#111', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Add first item
          </button>
        </div>
      )}

      {Object.entries(grouped).map(([cat, catItems]) => (
        <div key={cat} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#888', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>{cat}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {catItems.map((item: any) => (
              <div key={item.id} style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: item.available ? 1 : 0.5 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{item.name}</div>
                  {item.description && <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{item.description}</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>\${parseFloat(item.price).toFixed(2)}</span>
                  <button onClick={() => toggleItem(item.id, item.available)}
                    style={{ padding: '4px 10px', background: item.available ? '#F0FDF4' : '#F5F5F5', border: item.available ? '1px solid #BBF7D0' : '1px solid #E5E5E5', borderRadius: 6, color: item.available ? '#16A34A' : '#888', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {item.available ? 'On' : 'Off'}
                  </button>
                  <button onClick={() => deleteItem(item.id)}
                    style={{ padding: '4px 8px', background: 'transparent', border: '1px solid #E5E5E5', borderRadius: 6, color: '#DC2626', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Del
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
`);

// ─── 3. Update MerchantHome to add Menu tab ───────────────────────────────────
const homePath = path.join(BASE, 'components\\merchant\\MerchantHome.tsx');
let homeContent = fs.readFileSync(homePath, 'utf8');

homeContent = homeContent.replace(
  `import MerchantSpecials from './MerchantSpecials'`,
  `import MerchantSpecials from './MerchantSpecials'\nimport MerchantMenu from './MerchantMenu'`
);

homeContent = homeContent.replace(
  `  const [activeTab, setActiveTab] = useState<'bookings' | 'specials' | 'profile'>('bookings')`,
  `  const [activeTab, setActiveTab] = useState<'bookings' | 'specials' | 'menu' | 'profile'>('bookings')`
);

homeContent = homeContent.replace(
  `          { id: 'specials', label: 'Knot Specials' },
          { id: 'profile', label: 'Profile' },
        ] as { id: 'bookings' | 'specials' | 'profile', label: string }[])`,
  `          { id: 'specials', label: 'Knot Specials' },
          { id: 'menu', label: 'Menu' },
          { id: 'profile', label: 'Profile' },
        ] as { id: 'bookings' | 'specials' | 'menu' | 'profile', label: string }[])`
);

homeContent = homeContent.replace(
  `      {activeTab === 'specials' && <MerchantSpecials merchant={merchant} />}`,
  `      {activeTab === 'specials' && <MerchantSpecials merchant={merchant} />}\n\n      {activeTab === 'menu' && <MerchantMenu merchant={merchant} />}`
);

fs.writeFileSync(homePath, homeContent, 'utf8');
console.log('Updated: MerchantHome with Menu tab');

// ─── 4. PreOrderCard component for HangoutCard ───────────────────────────────
write('components/PreOrderCard.tsx', `'use client'
import { useState, useEffect } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { supabase } from '@/lib/supabase'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface PreOrderCardProps {
  hangout: any
  knotId: string
  currentUserId: string
  isLive?: boolean
}

function CheckoutForm({ amount, onSuccess, onCancel }: { amount: number, onSuccess: () => void, onCancel: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!stripe || !elements) return
    setProcessing(true); setError('')

    const { error: submitError } = await elements.submit()
    if (submitError) { setError(submitError.message || 'Payment failed'); setProcessing(false); return }

    const { paymentIntent, error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    })

    if (confirmError) {
      setError(confirmError.message || 'Payment failed')
      setProcessing(false)
      return
    }

    if (paymentIntent?.status === 'succeeded') {
      onSuccess()
    }
    setProcessing(false)
  }

  return (
    <div>
      <PaymentElement />
      {error && <div style={{ fontSize: 12, color: '#DC2626', marginTop: 8 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button onClick={onCancel}
          style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          Cancel
        </button>
        <button onClick={handleSubmit} disabled={!stripe || processing}
          style={{ flex: 2, padding: '10px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: processing ? 0.6 : 1 }}>
          {processing ? 'Processing...' : \`Pay \$\${amount.toFixed(2)}\`}
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
  const bgColor = isLive ? 'rgba(255,255,255,0.04)' : 'var(--bg3)'

  useEffect(() => {
    if (!hangout.venue_place_id) { setLoading(false); return }
    loadMerchantData()
  }, [hangout.id])

  async function loadMerchantData() {
    const { data: m } = await supabase
      .from('merchants')
      .select('*')
      .eq('place_id', hangout.venue_place_id)
      .eq('active', true)
      .single()

    if (!m) { setLoading(false); return }
    setMerchant(m)

    const { data: items } = await supabase
      .from('menu_items')
      .select('*')
      .eq('merchant_id', m.id)
      .eq('available', true)
      .order('category')

    setMenuItems(items || [])

    const { data: existingOrder } = await supabase
      .from('hangout_orders')
      .select('*, order_items(*, menu_item:menu_item_id(name, price), profile:user_id(name))')
      .eq('hangout_id', hangout.id)
      .single()

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
    const { data, error } = await supabase
      .from('hangout_orders')
      .insert({ hangout_id: hangout.id, merchant_id: merchant.id, knot_id: knotId, status: 'open' })
      .select()
      .single()
    if (error) throw error
    setOrder(data)
    return data
  }

  async function saveItems() {
    if (Object.keys(myItems).length === 0) { setError('Select at least one item.'); return }
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

  async function onPaymentSuccess() {
    await supabase.from('order_items')
      .update({ payment_status: 'paid' })
      .eq('order_id', order.id)
      .eq('user_id', currentUserId)
    setPaid(true)
    setShowPayment(false)
    loadMerchantData()
  }

  if (loading || !merchant || menuItems.length === 0) return null

  const myTotal = getMyTotal()
  const paidMembers = [...new Set(allOrderItems.filter(i => i.payment_status === 'paid').map(i => i.profile?.name))]
  const pendingMembers = [...new Set(allOrderItems.filter(i => i.payment_status === 'pending').map(i => i.profile?.name))]

  return (
    <div style={{ borderTop: \`1px solid \${borderSep}\`, paddingTop: 14, marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: subColor, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
        Pre-order from {merchant.name}
      </div>

      {paid ? (
        <div style={{ padding: '10px 14px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#16A34A' }}>Your order is paid</div>
          <div style={{ fontSize: 12, color: subColor, marginTop: 2 }}>
            {Object.entries(myItems).map(([itemId, qty]) => {
              const item = menuItems.find(m => m.id === itemId)
              return item ? \`\${qty}x \${item.name}\` : ''
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
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: \`1px solid \${borderSep}\` }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: textColor }}>{item.name}</div>
                      {item.description && <div style={{ fontSize: 11, color: subColor }}>{item.description}</div>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: textColor }}>\$\${parseFloat(item.price).toFixed(2)}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button onClick={() => setMyItems(prev => ({ ...prev, [item.id]: Math.max(0, (prev[item.id] || 0) - 1) }))}
                          style={{ width: 24, height: 24, borderRadius: '50%', border: \`1px solid \${borderSep}\`, background: 'none', color: textColor, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          -
                        </button>
                        <span style={{ fontSize: 13, fontWeight: 600, color: textColor, minWidth: 16, textAlign: 'center' }}>{myItems[item.id] || 0}</span>
                        <button onClick={() => setMyItems(prev => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }))}
                          style={{ width: 24, height: 24, borderRadius: '50%', border: \`1px solid \${borderSep}\`, background: 'none', color: textColor, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {myTotal > 0 && (
                <button onClick={saveItems}
                  style={{ width: '100%', padding: '10px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Pre-order and pay \$\${myTotal.toFixed(2)}
                </button>
              )}
            </>
          ) : (
            clientSecret && (
              <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
                <CheckoutForm amount={myTotal} onSuccess={onPaymentSuccess} onCancel={() => setShowPayment(false)} />
              </Elements>
            )
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
`);

// ─── 5. Patch HangoutCard to show PreOrderCard on confirmed and live states ───
const cardPath = path.join(BASE, 'components\\HangoutCard.tsx');
let cardContent = fs.readFileSync(cardPath, 'utf8');

if (!cardContent.includes('PreOrderCard')) {
  cardContent = cardContent.replace(
    `import { PostHangoutLoop } from '@/components/PostHangoutLoop'`,
    `import { PostHangoutLoop } from '@/components/PostHangoutLoop'\nimport { PreOrderCard } from '@/components/PreOrderCard'`
  );

  cardContent = cardContent.replace(
    `      {isDone && !isCancelled && (
        <PostHangoutLoop`,
    `      {(isConfirmed || isLive) && !isCancelled && hangout.venue_place_id && (
        <PreOrderCard
          hangout={hangout}
          knotId={knotId}
          currentUserId={currentUser?.id || ''}
          isLive={isLive}
        />
      )}

      {isDone && !isCancelled && (
        <PostHangoutLoop`
  );

  fs.writeFileSync(cardPath, cardContent, 'utf8');
  console.log('Updated: HangoutCard with PreOrderCard');
} else {
  console.log('SKIP: PreOrderCard already in HangoutCard');
}

console.log('\nSprint 3C complete.');
console.log('Stripe payment intent API route created.');
console.log('Menu management tab added to merchant dashboard.');
console.log('PreOrderCard component built with Stripe Elements checkout.');
console.log('Pre-order appears on confirmed and live hangout cards when venue has a Knot merchant profile.');
