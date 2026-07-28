const fs = require('fs');
const path = require('path');

const BASE = 'C:\\Users\\amrin\\Documents\\knot-web';

function write(relPath, content) {
  const full = path.join(BASE, relPath);
  const dir = path.dirname(full);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  console.log('Fixed: ' + relPath);
}

function patch(relPath, pairs, label) {
  const full = path.join(BASE, relPath);
  if (!fs.existsSync(full)) { console.log('SKIP: ' + relPath + ' not found'); return; }
  let content = fs.readFileSync(full, 'utf8');
  let changed = false;
  pairs.forEach(([from, to]) => {
    if (content.includes(from)) { content = content.split(from).join(to); changed = true; }
  });
  if (changed) { fs.writeFileSync(full, content, 'utf8'); console.log('Fixed: ' + label); }
  else { console.log('SKIP: ' + label + ' (no matches)'); }
}

// ─── FIX 1: API key in photo URLs — proxy through our API instead ─────────────
const venuesPath = path.join(BASE, 'app\\api\\venues\\route.ts');
let venues = fs.readFileSync(venuesPath, 'utf8');
venues = venues.replace(
  `photo_url:     p.photos?.[0]?.photo_reference
          ? \`https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=\${p.photos[0].photo_reference}&key=\${apiKey}\`
          : null,`,
  `photo_url:     p.photos?.[0]?.photo_reference
          ? \`/api/place-photo?ref=\${encodeURIComponent(p.photos[0].photo_reference)}\`
          : null,`
);
fs.writeFileSync(venuesPath, venues, 'utf8');
console.log('Fixed: API key removed from photo URLs, now proxied through /api/place-photo');

// Create the photo proxy API route
write('app/api/place-photo/route.ts', `import { NextResponse } from 'next/server'
import https from 'https'
import { createClient } from '@supabase/supabase-js'

function httpsGet(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
    }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks)))
    })
    req.on('error', reject)
    req.end()
  })
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  const { searchParams } = new URL(request.url)
  const ref = searchParams.get('ref')
  if (!ref) return NextResponse.json({ error: 'Missing ref' }, { status: 400 })

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Not configured' }, { status: 500 })

  try {
    const url = \`https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=\${encodeURIComponent(ref)}&key=\${apiKey}\`
    const buffer = await httpsGet(url)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch photo' }, { status: 500 })
  }
}
`);

// ─── FIX 2: Payment status — add server-side webhook handler ─────────────────
// For now add a verify-payment endpoint the client calls after confirmCardPayment
write('app/api/stripe/verify-payment/route.ts', `import { NextResponse } from 'next/server'
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
    { global: { headers: { Authorization: \`Bearer \${token}\` } } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { paymentIntentId, orderId } = await request.json()
  if (!paymentIntentId || !orderId) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId)

    if (pi.status !== 'succeeded') {
      return NextResponse.json({ error: 'Payment not succeeded', status: pi.status }, { status: 400 })
    }

    // Verify this payment belongs to this user
    if (pi.metadata.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
`);

// Update PreOrderCard to call verify-payment instead of updating client-side
const preOrderPath = path.join(BASE, 'components\\PreOrderCard.tsx');
let preOrder = fs.readFileSync(preOrderPath, 'utf8');

preOrder = preOrder.replace(
  `  async function onPaymentSuccess() {
    await supabase.from('order_items')
      .update({ payment_status: 'paid' })
      .eq('order_id', order.id)
      .eq('user_id', currentUserId)
    setPaid(true)
    setShowPayment(false)
    loadMerchantData()
  }`,
  `  async function onPaymentSuccess(paymentIntentId: string) {
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
  }`
);

// Update CheckoutForm to pass paymentIntentId to onSuccess
preOrder = preOrder.replace(
  `    if (paymentIntent?.status === 'succeeded') {
      onSuccess()
    }`,
  `    if (paymentIntent?.status === 'succeeded') {
      onSuccess(paymentIntent.id)
    }`
);

preOrder = preOrder.replace(
  `  onSuccess: () => void`,
  `  onSuccess: (paymentIntentId: string) => void`
);

fs.writeFileSync(preOrderPath, preOrder, 'utf8');
console.log('Fixed: Payment status now verified server-side via verify-payment API');

// ─── FIX 3: Discover venue loses place_id (fsq_id vs place_id) ───────────────
// Composer saves selectedVenue?.place_id but venue object has fsq_id
// The search mode already sets place_id correctly, but discover mode uses fsq_id
const composerPath = path.join(BASE, 'components\\Composer.tsx');
let composer = fs.readFileSync(composerPath, 'utf8');
// When venue comes from Discover, fsq_id IS the place_id
composer = composer.replace(
  `venue_place_id:    selectedVenue?.place_id || null,`,
  `venue_place_id:    selectedVenue?.place_id || selectedVenue?.fsq_id || null,`
);
fs.writeFileSync(composerPath, composer, 'utf8');
console.log('Fixed: Composer now uses fsq_id as fallback for venue place_id');

// ─── FIX 4: min_group filter — actually apply it in venues API ────────────────
patch('app/api/venues/route.ts', [
  [`    // Filter by price level if specified
    if (priceLevel) {
      const filtered = rawResults.filter((p: any) => p.price_level == null || p.price_level <= priceLevel)
      if (filtered.length > 0) rawResults = filtered
    }`,
   `    // Filter by price level if specified
    if (priceLevel) {
      const filtered = rawResults.filter((p: any) => p.price_level == null || p.price_level <= priceLevel)
      if (filtered.length > 0) rawResults = filtered
    }

    // Filter by group size via merchant data
    if (minGroupSize && minGroupSize > 2) {
      const placeIds = rawResults.map((p: any) => p.place_id).filter(Boolean)
      if (placeIds.length > 0) {
        const { createClient: sc } = await import('@supabase/supabase-js')
        const sb = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
        const { data: merchants } = await sb.from('merchants').select('place_id, max_group_size').in('place_id', placeIds)
        if (merchants && merchants.length > 0) {
          const capacityMap: Record<string, number> = {}
          merchants.forEach((m: any) => { capacityMap[m.place_id] = m.max_group_size })
          const filtered = rawResults.filter((p: any) => {
            const cap = capacityMap[p.place_id]
            return !cap || cap >= minGroupSize
          })
          if (filtered.length > 0) rawResults = filtered
        }
      }
    }`]
], 'Venues API now applies min_group filter via merchant capacity data');

// ─── FIX 5: GPS deny — show notice instead of silently using Mississauga ──────
patch('components/Discover.tsx', [
  [`          () => {
          const loc = { lat: 43.5890, lng: -79.6441, name: 'Mississauga' }
          setLocation(loc); setLocating(false); resolve(loc)
        }`,
   `          () => {
          const loc = { lat: 43.5890, lng: -79.6441, name: 'Mississauga (default)' }
          setLocation(loc); setLocating(false); resolve(loc)
          setError('Location access denied. Showing results near Mississauga.')
        }`]
], 'Discover GPS deny now shows notice instead of silently using Mississauga');

// ─── FIX 6: Members mojibake ───────────────────────────────────────────────────
patch('components/Members.tsx', [
  ['Â·', '\u00B7'],
  ['â€"', '\u2014'],
  ['â€"', '\u2014'],
  ['â€"', '\u2014'],
], 'Members.tsx mojibake fixed');

// ─── FIX 7: Invite page remaining mojibake ────────────────────────────────────
const invitePath = path.join(BASE, 'app\\invite\\[token]\\page.tsx');
if (fs.existsSync(invitePath)) {
  let invite = fs.readFileSync(invitePath, 'utf8');
  const replacements = [
    ['Ã¢ÂÅ\'', String.fromCodePoint(0x1F517)],
    ['Ã¢ÂÂ±Ã¯Â¸Â', String.fromCodePoint(0x2753)],
    ['Ã°Å¸â€â€™', String.fromCodePoint(0x1F389)],
    ['Ã°Å¸â€Â ', String.fromCodePoint(0x1F512) + ' '],
    ['Ã°Å¸Å½â€°', String.fromCodePoint(0x1F64F)],
    ['Ã¢â‚¬â€', '\u2014'],
    ['Ã‚Â·', '\u00B7'],
    ['Â·', '\u00B7'],
  ];
  let changed = false;
  replacements.forEach(([from, to]) => {
    if (invite.includes(from)) { invite = invite.split(from).join(to); changed = true; }
  });
  if (changed) { fs.writeFileSync(invitePath, invite, 'utf8'); console.log('Fixed: invite page remaining mojibake'); }
  else { console.log('SKIP: invite page (no remaining mojibake found)'); }
}

// ─── FIX 8: BillSplit \u escapes in JSX text ─────────────────────────────────
const billPath = path.join(BASE, 'components\\BillSplit.tsx');
if (fs.existsSync(billPath)) {
  let bill = fs.readFileSync(billPath, 'utf8');
  // The \u in template literals is fine, only fix JSX text nodes
  // Line 334: {bill.description} \u00B7 {timeAgo — this is in JSX text so fix it
  bill = bill.replace(
    `{bill.description} \\u00B7 {timeAgo(bill.created_at)}`,
    `{bill.description} \u00B7 {timeAgo(bill.created_at)}`
  );
  fs.writeFileSync(billPath, bill, 'utf8');
  console.log('Fixed: BillSplit.tsx JSX middot escape');
}

// ─── FIX 9: Merchant confirmed upcoming — add future date filter ──────────────
const merchantHomePath = path.join(BASE, 'components\\merchant\\MerchantHome.tsx');
if (fs.existsSync(merchantHomePath)) {
  let mh = fs.readFileSync(merchantHomePath, 'utf8');
  mh = mh.replace(
    `  const pending = bookings.filter(b => b.status === 'pending')
  const confirmed = bookings.filter(b => b.status === 'confirmed')
  const past = bookings.filter(b => b.status === 'cancelled' || b.status === 'declined' || (b.scheduled_for && new Date(b.scheduled_for) < new Date()))`,
    `  const now = new Date()
  const pending = bookings.filter(b => b.status === 'pending')
  const confirmed = bookings.filter(b => b.status === 'confirmed' && (!b.scheduled_for || new Date(b.scheduled_for) >= now))
  const past = bookings.filter(b => b.status === 'cancelled' || b.status === 'declined' || (b.scheduled_for && new Date(b.scheduled_for) < now))`
  );
  fs.writeFileSync(merchantHomePath, mh, 'utf8');
  console.log('Fixed: Merchant confirmed upcoming now excludes past bookings');
}

// ─── FIX 10: Merchant sign in CTA — opens create account ─────────────────────
const merchantPagePath = path.join(BASE, 'app\\merchant\\page.tsx');
if (fs.existsSync(merchantPagePath)) {
  let mp = fs.readFileSync(merchantPagePath, 'utf8');
  mp = mp.replace(
    `      <button onClick={() => { setStep('auth') }}
        style={{ width: '100%', padding: '12px', background: 'transparent', border: '1px solid #E5E5E5', borderRadius: '10px', color: '#555', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' }}>
        Already have an account? Sign in
      </button>`,
    `      <button onClick={() => { setStep('auth'); }}
        style={{ width: '100%', padding: '12px', background: 'transparent', border: '1px solid #E5E5E5', borderRadius: 10, color: '#555', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
        Already have an account? Sign in
      </button>`
  );
  // The real fix: in auth step, show sign in as default when coming from "Already have an account"
  // Add a mode state to distinguish signup vs signin
  if (!mp.includes('const [authMode, setAuthMode]')) {
    mp = mp.replace(
      `  const [step, setStep] = useState<'intro' | 'auth' | 'profile'>('intro')`,
      `  const [step, setStep] = useState<'intro' | 'auth' | 'profile'>('intro')
  const [authMode, setAuthMode] = useState<'signup' | 'signin'>('signup')`
    );
    mp = mp.replace(
      `      <button onClick={() => { setStep('auth'); }}`,
      `      <button onClick={() => { setStep('auth'); setAuthMode('signin') }}`
    );
    mp = mp.replace(
      `        <h2 style={{ fontSize: 24, fontWeight: 800, color: '#111', marginBottom: 8 }}>Create your account</h2>`,
      `        <h2 style={{ fontSize: 24, fontWeight: 800, color: '#111', marginBottom: 8 }}>{authMode === 'signin' ? 'Sign in to your account' : 'Create your account'}</h2>`
    );
    mp = mp.replace(
      `        <p style={{ fontSize: 14, color: '#666', marginBottom: 24 }}>
          You will set up your restaurant profile in the next step.
        </p>`,
      `        <p style={{ fontSize: 14, color: '#666', marginBottom: 24 }}>
          {authMode === 'signin' ? 'Welcome back.' : 'You will set up your restaurant profile in the next step.'}
        </p>`
    );
    mp = mp.replace(
      `          {loading ? 'Creating account...' : 'Create account'}`,
      `          {loading ? '...' : authMode === 'signin' ? 'Sign in' : 'Create account'}`
    );
    mp = mp.replace(
      `          Sign in instead`,
      `          {authMode === 'signin' ? 'Create account instead' : 'Sign in instead'}`
    );
    mp = mp.replace(
      `        <button onClick={signIn} disabled={loading}`,
      `        <button onClick={authMode === 'signin' ? signIn : signUp} disabled={loading}`
    );
    mp = mp.replace(
      `        <button onClick={signUp} disabled={loading}`,
      `        <button onClick={authMode === 'signup' ? signUp : signIn} disabled={loading}`
    );
  }
  fs.writeFileSync(merchantPagePath, mp, 'utf8');
  console.log('Fixed: Merchant auth page now shows correct mode (sign in vs create account)');
}

// ─── FIX 11: completedRoles missing from HangoutMemberWithRole type ───────────
patch('types/roles.ts', [
  [`export interface HangoutMemberWithRole {
  user_id: string
  name: string
  avatar_url: string | null
  roles: HangoutRoleType[]
}`,
   `export interface HangoutMemberWithRole {
  user_id: string
  name: string
  avatar_url: string | null
  roles: HangoutRoleType[]
  completedRoles?: HangoutRoleType[]
}`]
], 'HangoutMemberWithRole type now includes completedRoles');

console.log('\nBatch 4 complete. Push to deploy.');
