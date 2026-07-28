const fs = require('fs');
const path = require('path');

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web\\components\\PreOrderCard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace the entire CheckoutForm function
const oldForm = `function CheckoutForm({ amount, clientSecret: cs, onSuccess, onCancel }: { amount: number, clientSecret: string, onSuccess: () => void, onCancel: () => void }) {
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
          {processing ? 'Processing...' : \`Pay \${amount.toFixed(2)}\`}
        </button>
      </div>
    </div>
  )
}`;

const newForm = `function CheckoutForm({ amount, clientSecret: cs, onSuccess, onCancel }: { amount: number, clientSecret: string, onSuccess: () => void, onCancel: () => void }) {
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
      onSuccess()
    }
    setProcessing(false)
  }

  return (
    <div>
      <div style={{ padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 8, background: '#fff', marginBottom: 12 }}>
        <CardElement options={{ style: { base: { fontSize: '14px', fontFamily: 'Manrope, sans-serif', color: '#111', '::placeholder': { color: '#aaa' } } } }} />
      </div>
      {error && <div style={{ fontSize: 12, color: '#DC2626', marginBottom: 8 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel}
          style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          Cancel
        </button>
        <button onClick={handleSubmit} disabled={!stripe || processing}
          style={{ flex: 2, padding: '10px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: processing ? 0.6 : 1 }}>
          {processing ? 'Processing...' : 'Pay $' + amount.toFixed(2)}
        </button>
      </div>
    </div>
  )
}`;

if (content.includes(oldForm)) {
  content = content.replace(oldForm, newForm);
  console.log('Replaced CheckoutForm with CardElement version.');
} else {
  console.log('ERROR: CheckoutForm pattern not found exactly. Doing targeted fixes instead.');
  content = content.replace('<PaymentElement />', `<div style={{ padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 8, background: '#fff', marginBottom: 12 }}>
        <CardElement options={{ style: { base: { fontSize: '14px', fontFamily: 'Manrope, sans-serif', color: '#111', '::placeholder': { color: '#aaa' } } } }} />
      </div>`);
  
  content = content.replace(
    `const { error: submitError } = await elements.submit()
    if (submitError) { setError(submitError.message || 'Payment failed'); setProcessing(false); return }

    const { paymentIntent, error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    })`,
    `const cardElement = elements.getElement(CardElement)
    if (!cardElement) { setError('Card input not found.'); setProcessing(false); return }

    const { paymentIntent, error: confirmError } = await stripe.confirmCardPayment(cs, {
      payment_method: { card: cardElement },
    })`
  );

  content = content.replace(
    "Processing...' : `Pay ${amount.toFixed(2)}`",
    "Processing...' : 'Pay $' + amount.toFixed(2)"
  );
  console.log('Applied targeted fixes to CheckoutForm.');
}

// Fix upsert for order creation
content = content.replace(
  `.from('hangout_orders')
      .insert({ hangout_id: hangout.id, merchant_id: merchant.id, knot_id: knotId, status: 'open' })`,
  `.from('hangout_orders')
      .upsert({ hangout_id: hangout.id, merchant_id: merchant.id, knot_id: knotId, status: 'open' }, { onConflict: 'hangout_id' })`
);
console.log('Fixed order creation to use upsert.');

// Fix the Pay button text in the pre-order button
content = content.replace(
  "Pre-order and pay ${myTotal.toFixed(2)}",
  "Pre-order and pay $' + myTotal.toFixed(2) + '"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('PreOrderCard rewritten. Ready to test.');
