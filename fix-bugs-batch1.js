const fs = require('fs');
const path = require('path');

const BASE = 'C:\\Users\\amrin\\Documents\\knot-web';

function write(relPath, content) {
  const full = path.join(BASE, relPath);
  fs.writeFileSync(full, content, 'utf8');
  console.log('Fixed: ' + relPath);
}

function patch(relPath, oldStr, newStr, label) {
  const full = path.join(BASE, relPath);
  let content = fs.readFileSync(full, 'utf8');
  if (content.includes(oldStr)) {
    content = content.replace(oldStr, newStr);
    fs.writeFileSync(full, content, 'utf8');
    console.log('Fixed: ' + label);
  } else {
    console.log('SKIP: ' + label + ' (pattern not found)');
  }
}

// ─── FIX 1: Remove duplicate CrewSection in HangoutCard ──────────────────────
const cardPath = path.join(BASE, 'components\\HangoutCard.tsx');
let card = fs.readFileSync(cardPath, 'utf8');

const dupCrew = `      <CrewSection
        hangoutId={hangout.id}
        knotId={knotId}
        currentUserId={currentUser?.id || ''}
        isPlanner={hangout.created_by === currentUser?.id}
        isLive={isLive}
      />

      <CrewSection
        hangoutId={hangout.id}
        knotId={knotId}
        currentUserId={currentUser?.id || ''}
        isPlanner={hangout.created_by === currentUser?.id}
        isLive={isLive}
      />`;

const singleCrew = `      <CrewSection
        hangoutId={hangout.id}
        knotId={knotId}
        currentUserId={currentUser?.id || ''}
        isPlanner={hangout.created_by === currentUser?.id}
        isLive={isLive}
      />`;

if (card.includes(dupCrew)) {
  card = card.replace(dupCrew, singleCrew);
  fs.writeFileSync(cardPath, card, 'utf8');
  console.log('Fixed: duplicate CrewSection removed from HangoutCard');
} else {
  console.log('SKIP: duplicate CrewSection (pattern not found)');
}

// ─── FIX 2: Auth callback — use cookie-based client ──────────────────────────
write('app/auth/callback/route.ts', `import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(\`\${origin}/dashboard\`)
}
`);

// ─── FIX 3: Stripe — verify amount server-side from order_items ──────────────
write('app/api/stripe/create-payment-intent/route.ts', `import { NextResponse } from 'next/server'
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

  const { orderId, hangoutId, merchantName } = await request.json()

  // Server-side amount verification — never trust client amount
  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select('total_price')
    .eq('order_id', orderId)
    .eq('user_id', user.id)
    .eq('payment_status', 'pending')

  if (itemsError || !items || items.length === 0) {
    return NextResponse.json({ error: 'No pending items found for this order.' }, { status: 400 })
  }

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
`);

// ─── FIX 4: BillSplit zero guard ─────────────────────────────────────────────
const billPath = path.join(BASE, 'components\\BillSplit.tsx');
if (fs.existsSync(billPath)) {
  let bill = fs.readFileSync(billPath, 'utf8');
  // Find addBill or the division and add guard
  if (bill.includes('knotMembers.length') && !bill.includes('knotMembers.length === 0')) {
    bill = bill.replace(
      /const perPerson\s*=\s*total\s*\/\s*knotMembers\.length/,
      `if (knotMembers.length === 0) { setError('Cannot split \u2014 no members loaded'); return; }\n    const perPerson = total / knotMembers.length`
    );
    fs.writeFileSync(billPath, bill, 'utf8');
    console.log('Fixed: BillSplit zero guard added');
  } else {
    console.log('SKIP: BillSplit zero guard (pattern not found or already fixed)');
  }
} else {
  console.log('SKIP: BillSplit.tsx not found');
}

// ─── FIX 5: brief_budget raw IDs — show labels instead ───────────────────────
const BUDGET_LABELS = `const BRIEF_BUDGET_LABELS: Record<string, string> = {
  free: 'Free',
  cheap: 'Cheap',
  mid: 'Mid',
  splurge: 'Splurge',
}

`;

patch(
  'components/HangoutCard.tsx',
  `function getInitials(name: string) {`,
  BUDGET_LABELS + `function getInitials(name: string) {`,
  'brief_budget labels added to HangoutCard'
);

patch(
  'components/HangoutCard.tsx',
  `{hangout.brief_budget && <span style={{ padding: '3px 8px', borderRadius: 20, background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.2)', fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>{hangout.brief_budget}</span>}`,
  `{hangout.brief_budget && <span style={{ padding: '3px 8px', borderRadius: 20, background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.2)', fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>{BRIEF_BUDGET_LABELS[hangout.brief_budget] || hangout.brief_budget}</span>}`,
  'brief_budget display now shows label not raw ID'
);

// ─── FIX 6: Hangout notify type new_poll → new_hangout ───────────────────────
patch(
  'components/Composer.tsx',
  `type:     'new_poll',`,
  `type:     'new_hangout',`,
  'Composer notification type changed from new_poll to new_hangout'
);

// ─── FIX 7: Add new_hangout to Notifications TYPE_LABEL ──────────────────────
patch(
  'components/Notifications.tsx',
  `  role_assigned: 'Role assigned',`,
  `  role_assigned: 'Role assigned',\n  new_hangout: 'New hangout',`,
  'Notifications TYPE_LABEL updated with new_hangout'
);

// ─── FIX 8: Members.tsx — prefix unused members prop ─────────────────────────
const membersPath = path.join(BASE, 'components\\Members.tsx');
if (fs.existsSync(membersPath)) {
  let members = fs.readFileSync(membersPath, 'utf8');
  // Check if members prop is destructured but unused
  if (members.includes('{ members,') || members.includes('{ members }')) {
    members = members
      .replace('{ members,', '{ members: _members,')
      .replace('{ members }', '{ members: _members }');
    fs.writeFileSync(membersPath, members, 'utf8');
    console.log('Fixed: Members.tsx unused members prop prefixed with _');
  } else {
    console.log('SKIP: Members.tsx members prop (pattern not found)');
  }
}

// ─── FIX 9: Ludo.tsx — prefix unused knotId prop ─────────────────────────────
const ludoPath = path.join(BASE, 'components\\Ludo.tsx');
if (fs.existsSync(ludoPath)) {
  let ludo = fs.readFileSync(ludoPath, 'utf8');
  if (ludo.includes('knotId') && !ludo.includes('_knotId')) {
    ludo = ludo.replace(/\bknotId\b/g, '_knotId');
    fs.writeFileSync(ludoPath, ludo, 'utf8');
    console.log('Fixed: Ludo.tsx knotId prefixed with _');
  } else {
    console.log('SKIP: Ludo.tsx knotId (already prefixed or not found)');
  }
}

// ─── FIX 10: Install @supabase/ssr if needed ─────────────────────────────────
console.log('\nAll fixes applied.');
console.log('Run: npm install @supabase/ssr');
console.log('Then: git add . && git commit -m "Bug fixes batch 1" && git push');
