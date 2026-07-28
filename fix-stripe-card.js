const fs = require('fs');
const path = require('path');

const BASE = 'C:\\Users\\amrin\\Documents\\knot-web';

// Fix 1: Stripe API route
const apiPath = path.join(BASE, 'app\\api\\stripe\\create-payment-intent\\route.ts');
const apiContent = `import { NextResponse } from 'next/server'
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

  if (!amount || amount < 0.5) return NextResponse.json({ error: 'Minimum amount is $0.50' }, { status: 400 })

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
      },
    })

    return NextResponse.json({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id })
  } catch (err: any) {
    console.error('Stripe error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
`;
fs.writeFileSync(apiPath, apiContent, 'utf8');
console.log('Fixed: Stripe API route with explicit card payment method');

// Fix 2: Update PreOrderCard to use CardElement instead of PaymentElement
const preOrderPath = path.join(BASE, 'components\\PreOrderCard.tsx');
let preOrder = fs.readFileSync(preOrderPath, 'utf8');

// Replace PaymentElement import with CardElement
preOrder = preOrder.replace(
  `import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'`,
  `import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'`
);

// Replace CheckoutForm to use CardElement
const oldCheckoutForm = `function CheckoutForm({ amount, onSuccess, onCancel }: { amount: number, onSuccess: () => void, onCancel: () => void }) {
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
          {processing ? 'Processing...' : \`Pay $\${amount.toFixed(2)}\`}
        </button>
      </div>
    </div>
  )
}`;

const newCheckoutForm = `function CheckoutForm({ amount, onSuccess, onCancel }: { amount: number, onSuccess: () => void, onCancel: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!stripe || !elements) return
    setProcessing(true); setError('')

    const cardElement = elements.getElement(CardElement)
    if (!cardElement) { setError('Card element not found'); setProcessing(false); return }

    const { paymentIntent, error: confirmError } = await stripe.confirmCardPayment(
      (elements as any)._commonOptions?.clientSecret || '',
      { payment_method: { card: cardElement } }
    )

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
      <div style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 12, background: '#fff' }}>
        <CardElement options={{ style: { base: { fontSize: '14px', color: '#111', '::placeholder': { color: '#aaa' } } } }} />
      </div>
      {error && <div style={{ fontSize: 12, color: '#DC2626', marginBottom: 8 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel}
          style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          Cancel
        </button>
        <button onClick={handleSubmit} disabled={!stripe || processing}
          style={{ flex: 2, padding: '10px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: processing ? 0.6 : 1 }}>
          {processing ? 'Processing...' : \`Pay $\${amount.toFixed(2)}\`}
        </button>
      </div>
    </div>
  )
}`;

if (preOrder.includes(oldCheckoutForm)) {
  preOrder = preOrder.replace(oldCheckoutForm, newCheckoutForm);
  console.log('Updated: CheckoutForm now uses CardElement');
} else {
  console.log('SKIP: CheckoutForm pattern not found, may need manual update');
}

// Fix Elements options — CardElement does not use clientSecret in options
preOrder = preOrder.replace(
  `<Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
                <CheckoutForm amount={myTotal} onSuccess={onPaymentSuccess} onCancel={() => setShowPayment(false)} />
              </Elements>`,
  `<Elements stripe={stripePromise} options={{ clientSecret }}>
                <CheckoutForm amount={myTotal} onSuccess={onPaymentSuccess} onCancel={() => setShowPayment(false)} />
              </Elements>`
);

// Pass clientSecret via context properly using confirmCardPayment directly
// Actually the cleanest fix is to pass clientSecret as a prop to CheckoutForm
preOrder = preOrder.replace(
  `function CheckoutForm({ amount, onSuccess, onCancel }: { amount: number, onSuccess: () => void, onCancel: () => void })`,
  `function CheckoutForm({ amount, clientSecret: cs, onSuccess, onCancel }: { amount: number, clientSecret: string, onSuccess: () => void, onCancel: () => void })`
);

preOrder = preOrder.replace(
  `      (elements as any)._commonOptions?.clientSecret || '',`,
  `      cs,`
);

preOrder = preOrder.replace(
  `<CheckoutForm amount={myTotal} onSuccess={onPaymentSuccess} onCancel={() => setShowPayment(false)} />`,
  `<CheckoutForm amount={myTotal} clientSecret={clientSecret} onSuccess={onPaymentSuccess} onCancel={() => setShowPayment(false)} />`
);

fs.writeFileSync(preOrderPath, preOrder, 'utf8');
console.log('Fixed: PreOrderCard uses CardElement with confirmCardPayment');
console.log('\nAll Stripe fixes applied.');
