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

  const { paymentIntentId, orderId } = await request.json()
  if (!paymentIntentId || !orderId) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  // Replay guard: this paymentIntentId column is written on every successful
  // verify below — if it's already stored on some order_items row, this
  // PaymentIntent has already been applied once and must not be reused
  // against a different (or the same) order.
  const { data: alreadyUsed } = await supabase
    .from('order_items')
    .select('id')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .limit(1)
  if (alreadyUsed && alreadyUsed.length > 0) {
    return NextResponse.json({ error: 'Payment already applied' }, { status: 400 })
  }

  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId)

    if (pi.status !== 'succeeded') {
      return NextResponse.json({ error: 'Payment not succeeded', status: pi.status }, { status: 400 })
    }

    // Verify this payment belongs to this user
    if (pi.metadata.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify this payment was created for this specific order
    if (pi.metadata.order_id !== orderId) {
      return NextResponse.json({ error: 'Payment does not match this order' }, { status: 400 })
    }

    // Mark order items as paid server-side
    const { error } = await supabase
      .from('order_items')
      .update({ payment_status: 'paid', stripe_payment_intent_id: paymentIntentId })
      .eq('order_id', orderId)
      .eq('user_id', user.id)
      .eq('payment_status', 'pending')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
