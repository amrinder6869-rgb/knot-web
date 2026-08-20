import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-06-24.dahlia' })

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orderId, hangoutId, merchantName } = await request.json()

  // Server-side amount verification — never trust client amount
  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select('id, total_price')
    .eq('order_id', orderId)
    .eq('user_id', user.id)
    .eq('payment_status', 'pending')

  if (itemsError || !items || items.length === 0) {
    return NextResponse.json({ error: 'No pending items found for this order.' }, { status: 400 })
  }

  const itemIds = items.map(i => i.id)
  const amount = items.reduce((sum, i) => sum + parseFloat(i.total_price), 0)

  if (amount < 0.5) {
    return NextResponse.json({ error: 'Minimum amount is $0.50' }, { status: 400 })
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'cad',
      payment_method_types: ['card'],
      metadata: {
        order_id: orderId || '',
        hangout_id: hangoutId || '',
        user_id: user.id,
        merchant_name: merchantName || '',
        item_ids: JSON.stringify(itemIds),
      },
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount,
    })
  } catch (err: any) {
    console.error('Stripe error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
