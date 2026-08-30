// Seed a sample test account covering every Knot scenario.
//
// Usage: node scripts/seed-demo-account.js
// Optional: --force  (wipe this demo user's Sample* knots and re-seed)
//
// Login (also printed at the end):
//   URL:      https://knot-web-am-woad.vercel.app/
//   Email:    knotdemo@gmail.com
//   Username: knotdemo
//   Password: KnotSample2026!
//
// Friend accounts share the same password so you can inspect other seats.

/* eslint-disable @typescript-eslint/no-require-imports */
const { createClient } = require('@supabase/supabase-js')
const crypto = require('crypto')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vcrnktkttgprbnoyjeff.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjcm5rdGt0dGdwcmJub3lqZWZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0NzA3MzUsImV4cCI6MjA5NzA0NjczNX0.1Mpba0djT5Y0_WOgu_BcEw5LvoXNrQnp1hYeW-xApZg'

const FORCE = process.argv.includes('--force')
const PASSWORD = 'KnotSample2026!'

const DEMO = {
  email: 'knotdemo@gmail.com',
  password: PASSWORD,
  name: 'Avery Sample',
  username: 'knotdemo',
  bio: 'Sample test account — fictional data for walking through every Knot flow.',
  city: 'San Francisco',
  dob: '1994-04-12',
  budget: 'mid',
  privacy: 'public',
  dietary: ['vegetarian'],
  accessibility: [],
  tastes: ['restaurants', 'bars', 'live_music', 'outdoors', 'coffee'],
  groupSize: 'small',
  spend: '20_50',
  dietaryPreferences: { vegetarian: 'prefer', vegan: 'unset', halal: 'unset' },
}

const FRIENDS = [
  {
    key: 'jordan',
    email: 'jordan.sample.knot@gmail.com',
    name: 'Jordan Sample',
    username: 'jordansample',
    bio: 'Sample co-planner. Always down for tacos.',
    city: 'San Francisco',
    dietary: ['gluten-free'],
    accessibility: [],
    tastes: ['restaurants', 'movies', 'gaming'],
    groupSize: 'small',
    spend: '50_100',
    dietaryPreferences: { 'gluten-free': 'avoid' },
  },
  {
    key: 'maya',
    email: 'maya.sample.knot@gmail.com',
    name: 'Maya Sample',
    username: 'mayasample',
    bio: 'Sample treasurer. Brings the spreadsheet energy.',
    city: 'Oakland',
    dietary: ['vegan'],
    accessibility: ['wheelchair-access'],
    tastes: ['coffee', 'arts', 'outdoors'],
    groupSize: 'pair',
    spend: 'under_20',
    dietaryPreferences: { vegan: 'prefer' },
  },
  {
    key: 'sam',
    email: 'sam.sample.knot@gmail.com',
    name: 'Sam Sample',
    username: 'samsample',
    bio: 'Sample hype person. Will RSVP yes to everything.',
    city: 'San Francisco',
    dietary: ['nut allergy'],
    accessibility: [],
    tastes: ['bars', 'live_music', 'sports'],
    groupSize: 'big',
    spend: 'splurge',
    dietaryPreferences: { 'nut allergy': 'avoid' },
  },
  {
    key: 'priya',
    email: 'priya.sample.knot@gmail.com',
    name: 'Priya Sample',
    username: 'priyasample',
    bio: 'Sample photographer. Posts the recap the next morning.',
    city: 'Berkeley',
    dietary: ['halal'],
    accessibility: ['hearing-loop'],
    tastes: ['restaurants', 'arts', 'movies'],
    groupSize: 'small',
    spend: '20_50',
    dietaryPreferences: { halal: 'prefer' },
  },
  {
    key: 'alex',
    email: 'alex.sample.knot@gmail.com',
    name: 'Alex Sample',
    username: 'alexsample',
    bio: 'Sample plus-one energy. Sometimes maybe.',
    city: 'San Jose',
    dietary: ['dairy-free'],
    accessibility: ['step-free-entry'],
    tastes: ['fitness', 'outdoors', 'coffee'],
    groupSize: 'varies',
    spend: '20_50',
    dietaryPreferences: { 'dairy-free': 'avoid' },
  },
]

const VENUES = {
  agricole: {
    venue_name: 'Bar Agricole',
    venue_address: '1145 17th St, San Francisco, CA 94107',
    venue_lat: 37.7648,
    venue_lng: -122.3986,
    venue_category: 'bar',
    venue_rating: 4.5,
    price_level: 3,
    venue_maps_url: 'https://maps.google.com/?q=Bar+Agricole+San+Francisco',
  },
  zuni: {
    venue_name: 'Zuni Cafe',
    venue_address: '1658 Market St, San Francisco, CA 94102',
    venue_lat: 37.7736,
    venue_lng: -122.4217,
    venue_category: 'restaurant',
    venue_rating: 4.6,
    price_level: 3,
    venue_maps_url: 'https://maps.google.com/?q=Zuni+Cafe+San+Francisco',
  },
  tartine: {
    venue_name: 'Tartine Inner Sunset',
    venue_address: '1226 9th Ave, San Francisco, CA 94122',
    venue_lat: 37.7652,
    venue_lng: -122.4662,
    venue_category: 'cafe',
    venue_rating: 4.4,
    price_level: 2,
    venue_maps_url: 'https://maps.google.com/?q=Tartine+Inner+Sunset',
  },
  goldenGate: {
    venue_name: 'Golden Gate Park — Stow Lake',
    venue_address: '50 Stow Lake Dr, San Francisco, CA 94118',
    venue_lat: 37.7683,
    venue_lng: -122.4756,
    venue_category: 'outdoors',
    venue_rating: 4.7,
    price_level: 1,
    venue_maps_url: 'https://maps.google.com/?q=Stow+Lake+San+Francisco',
  },
  alamo: {
    venue_name: 'Alamo Drafthouse New Mission',
    venue_address: '2550 Mission St, San Francisco, CA 94110',
    venue_lat: 37.7565,
    venue_lng: -122.4191,
    venue_category: 'movies',
    venue_rating: 4.5,
    price_level: 2,
    venue_maps_url: 'https://maps.google.com/?q=Alamo+Drafthouse+New+Mission',
  },
  liholiho: {
    venue_name: 'Liholiho Yacht Club',
    venue_address: '871 Sutter St, San Francisco, CA 94109',
    venue_lat: 37.7886,
    venue_lng: -122.4143,
    venue_category: 'restaurant',
    venue_rating: 4.7,
    price_level: 3,
    venue_maps_url: 'https://maps.google.com/?q=Liholiho+Yacht+Club',
  },
}

const stats = { ok: 0, fail: 0, skip: 0 }
const failures = []

function client() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function iso(daysFromNow, hour = 19, minute = 0) {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

function ymd(daysFromNow) {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d.toISOString().slice(0, 10)
}

function log(ok, label, extra) {
  if (ok) {
    stats.ok++
    console.log(`  ok   ${label}${extra ? ' — ' + extra : ''}`)
  } else {
    stats.fail++
    failures.push({ label, extra })
    console.log(`  FAIL ${label}${extra ? ' — ' + extra : ''}`)
  }
}

function skip(label, extra) {
  stats.skip++
  console.log(`  skip ${label}${extra ? ' — ' + extra : ''}`)
}

async function report(label, result) {
  if (result?.error) {
    log(false, label, result.error.message)
    return null
  }
  log(true, label)
  return result?.data ?? true
}

async function ensureUser(spec) {
  const sb = client()
  const { data: signUpData, error: signUpError } = await sb.auth.signUp({
    email: spec.email,
    password: spec.password || PASSWORD,
    options: { data: { name: spec.name } },
  })
  if (signUpData?.session && signUpData.user) {
    return { sb, user: signUpData.user, created: true }
  }
  const { data: signInData, error: signInError } = await sb.auth.signInWithPassword({
    email: spec.email,
    password: spec.password || PASSWORD,
  })
  if (signInData?.session && signInData.user) {
    return { sb, user: signInData.user, created: false }
  }
  throw new Error(`Could not auth ${spec.email}: ${signUpError?.message || signInError?.message}`)
}

async function waitForProfile(sb, userId) {
  for (let i = 0; i < 12; i++) {
    const { data } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle()
    if (data) return data
    await new Promise(r => setTimeout(r, 250))
  }
  return null
}

async function completeProfile(account, spec) {
  const profile = await waitForProfile(account.sb, account.user.id)
  if (!profile) {
    log(false, `profile ${spec.username}`, 'row missing after signup')
    return
  }
  const { error } = await account.sb.from('profiles').update({
    name: spec.name,
    username: spec.username,
    bio: spec.bio || null,
    resident_city: spec.city || null,
    dob: spec.dob || '1992-06-15',
    budget_tier: spec.budget || 'mid',
    privacy_tier: spec.privacy || 'members_only',
    dietary_restrictions: spec.dietary || [],
    accessibility_needs: spec.accessibility || [],
    taste_categories: spec.tastes || [],
    typical_group_size: spec.groupSize || 'small',
    typical_spend: spec.spend || '20_50',
    dietary_preferences: spec.dietaryPreferences || {},
    onboarding_completed: true,
  }).eq('id', account.user.id)
  if (error && error.code === '23505') {
    const fallback = spec.username + 'sf'
    const retry = await account.sb.from('profiles').update({
      name: spec.name,
      username: fallback,
      bio: spec.bio || null,
      resident_city: spec.city || null,
      onboarding_completed: true,
      privacy_tier: spec.privacy || 'members_only',
      dietary_restrictions: spec.dietary || [],
      accessibility_needs: spec.accessibility || [],
      taste_categories: spec.tastes || [],
    }).eq('id', account.user.id)
    spec.username = fallback
    log(!retry.error, `profile ${spec.username}`, retry.error?.message)
    return
  }
  log(!error, `profile ${spec.username}`, error?.message)
}

async function asUser(account, fn) {
  return fn(account.sb, account.user)
}

async function createKnot(sb, userId, name, emoji) {
  const { data, error } = await sb.from('knots').insert({
    name, emoji, created_by: userId,
  }).select().single()
  if (error || !data) {
    log(false, `knot ${name}`, error?.message)
    return null
  }
  const member = await sb.from('knot_members').insert({
    knot_id: data.id, user_id: userId, role: 'founder',
  })
  log(!member.error, `knot ${name}`, member.error?.message)
  return data
}

async function joinKnot(sb, userId, knotId, role = 'member') {
  const { data: existing } = await sb.from('knot_members')
    .select('user_id').eq('knot_id', knotId).eq('user_id', userId).maybeSingle()
  if (existing) { skip(`join ${role}`, userId.slice(0, 8)); return true }
  const { error } = await sb.from('knot_members').insert({ knot_id: knotId, user_id: userId, role })
  if (error) {
    const token = crypto.randomUUID()
    // founder must have created an invite; try self-insert again then redeem later
    log(false, `join knot as ${role}`, error.message)
    return false
  }
  log(true, `join knot as ${role}`)
  return true
}

async function inviteAndRedeem(founder, joiner, knotId) {
  const token = crypto.randomUUID()
  const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await founder.sb.from('invites').insert({
    knot_id: knotId,
    created_by: founder.user.id,
    token,
    expires_at,
  }).select('token').single()
  if (error || !data) {
    // Fall back to a direct membership insert as the joiner (RLS typically allows self-insert).
    return joinKnot(joiner.sb, joiner.user.id, knotId, 'member')
  }
  const redeemed = await joiner.sb.rpc('redeem_invite', { p_token: data.token })
  if (redeemed.error || redeemed.data?.error) {
    return joinKnot(joiner.sb, joiner.user.id, knotId, 'member')
  }
  log(true, `redeem invite ${joiner.user.email}`)
  return true
}

async function createHangout(sb, pInput) {
  const { data, error } = await sb.rpc('create_hangout', { p_input: pInput })
  if (error || !data || data.error) {
    log(false, `hangout ${pInput.title}`, error?.message || data?.error)
    return null
  }
  log(true, `hangout ${pInput.title}`, data.hangout_id)
  return data
}

async function patchHangout(sb, hangoutId, patch, label) {
  const { error } = await sb.from('hangouts').update(patch).eq('id', hangoutId)
  log(!error, label || `patch hangout`, error?.message)
}

async function rsvp(account, hangoutId, status, extra = {}) {
  const { error } = await account.sb.from('hangout_rsvps').upsert({
    hangout_id: hangoutId,
    user_id: account.user.id,
    status,
    ...extra,
  }, { onConflict: 'hangout_id,user_id' })
  log(!error, `rsvp ${status} ${account.user.email.split('@')[0]}`, error?.message)
}

async function message(account, hangoutId, content) {
  const { error } = await account.sb.from('hangout_messages').insert({
    hangout_id: hangoutId,
    author_id: account.user.id,
    content,
  })
  log(!error, `chat "${content.slice(0, 32)}"`, error?.message)
}

async function postMoment(account, knotId, content, hangoutId) {
  const { data, error } = await account.sb.from('posts').insert({
    knot_id: knotId,
    hangout_id: hangoutId || null,
    author_id: account.user.id,
    content,
    post_type: 'moment',
  }).select().single()
  log(!error, `moment "${content.slice(0, 40)}"`, error?.message)
  return data
}

async function fetchJpeg(seed) {
  const res = await fetch(`https://picsum.photos/seed/${encodeURIComponent(seed)}/800/600.jpg`)
  if (!res.ok) throw new Error(`picsum ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

async function uploadSamplePhoto(account, { knotId, hangoutId, postId, seed, caption, fileName }) {
  let buf
  try {
    buf = await fetchJpeg(seed)
  } catch (err) {
    log(false, `download photo ${seed}`, err.message)
    return null
  }
  const storagePath = `${knotId}/${account.user.id}/${Date.now()}-${seed}.jpg`
  const up = await account.sb.storage.from('knot-photos').upload(storagePath, buf, {
    contentType: 'image/jpeg',
    upsert: true,
  })
  if (up.error) {
    log(false, `upload photo ${seed}`, up.error.message)
    return null
  }
  const { data, error } = await account.sb.from('photos').insert({
    knot_id: knotId,
    hangout_id: hangoutId || null,
    post_id: postId || null,
    uploaded_by: account.user.id,
    storage_path: storagePath,
    file_name: fileName || `${seed}.jpg`,
    file_size: buf.length,
    media_type: 'image',
    caption: caption || null,
  }).select().single()
  log(!error, `photo ${seed}`, error?.message)
  return data
}

async function addBill(account, {
  knotId, hangoutId, description, amount, splitType, splitIds, settledIds, category, note, isRecurring, recurringInterval,
}) {
  const { data: bill, error } = await account.sb.from('bills').insert({
    knot_id: knotId,
    hangout_id: hangoutId || null,
    added_by: account.user.id,
    total_amount: amount,
    description,
    split_type: splitType || 'equal',
    category: category || 'food',
    note: note || null,
    is_recurring: !!isRecurring,
    recurring_interval: isRecurring ? (recurringInterval || 'monthly') : null,
  }).select().single()
  if (error || !bill) {
    log(false, `bill ${description}`, error?.message)
    return null
  }
  const share = amount / splitIds.length
  const splits = splitIds.map((uid, i) => ({
    bill_id: bill.id,
    user_id: uid,
    amount: i === splitIds.length - 1
      ? parseFloat((amount - share * (splitIds.length - 1)).toFixed(2))
      : parseFloat(share.toFixed(2)),
    settled: (settledIds || []).includes(uid) || uid === account.user.id,
  }))
  const splitRes = await account.sb.from('bill_splits').insert(splits)
  if (splitRes.error) log(false, `bill splits ${description}`, splitRes.error.message)
  else log(true, `bill ${description} $${amount}`)
  await account.sb.from('posts').insert({
    knot_id: knotId,
    hangout_id: hangoutId || null,
    author_id: account.user.id,
    content: `added a bill — $${amount.toFixed(2)} for ${description}, split ${splitIds.length} ways`,
    post_type: 'bill',
    bill_id: bill.id,
  })
  return bill
}

async function notify(from, toUserId, knotId, type, message, entityId) {
  const { error } = await from.sb.from('notifications').insert({
    user_id: toUserId,
    knot_id: knotId,
    type,
    actor_id: from.user.id,
    entity_id: entityId || null,
    message,
    read: false,
  })
  log(!error, `notify ${type}`, error?.message)
}

async function main() {
  console.log(`Seeding sample Knot account against ${SUPABASE_URL}`)
  console.log(`Force re-seed: ${FORCE}`)

  const demo = await ensureUser(DEMO)
  console.log(`Demo user ${demo.created ? 'created' : 'signed in'}: ${demo.user.id}`)
  await completeProfile(demo, DEMO)

  const friends = {}
  for (const spec of FRIENDS) {
    const acct = await ensureUser(spec)
    await completeProfile(acct, spec)
    friends[spec.key] = acct
    console.log(`Friend ${spec.name} ${acct.created ? 'created' : 'signed in'}: ${acct.user.id}`)
  }

  const { data: existingKnots } = await demo.sb
    .from('knots')
    .select('id, name, created_by')
    .eq('created_by', demo.user.id)

  const sampleKnots = (existingKnots || []).filter(k => String(k.name).startsWith('Sample '))
  if (sampleKnots.length && !FORCE) {
    console.log('\nSample knots already exist for this account. Pass --force to wipe and re-seed.')
    printCredentials()
    return
  }

  if (FORCE && sampleKnots.length) {
    for (const k of sampleKnots) {
      const { error } = await demo.sb.from('knots').delete().eq('id', k.id).eq('created_by', demo.user.id)
      log(!error, `delete knot ${k.name}`, error?.message)
    }
  }

  const friday = await createKnot(demo.sb, demo.user.id, 'Sample Friday Crew', '🍻')
  const brunch = await createKnot(demo.sb, demo.user.id, 'Sample Brunch Club', '🥞')
  if (!friday || !brunch) throw new Error('Could not create sample knots')

  for (const key of Object.keys(friends)) {
    await inviteAndRedeem(demo, friends[key], friday.id)
  }
  await inviteAndRedeem(demo, friends.maya, brunch.id)
  await inviteAndRedeem(demo, friends.jordan, brunch.id)

  // Second knot owned by Maya, demo is a member (non-founder seat).
  const office = await createKnot(friends.maya.sb, friends.maya.user.id, 'Sample Office Lunch', '🥗')
  if (office) {
    await inviteAndRedeem(friends.maya, demo, office.id)
    await inviteAndRedeem(friends.maya, friends.priya, office.id)
  }

  const ids = {
    avery: demo.user.id,
    jordan: friends.jordan.user.id,
    maya: friends.maya.user.id,
    sam: friends.sam.user.id,
    priya: friends.priya.user.id,
    alex: friends.alex.user.id,
  }
  const allFriday = [ids.avery, ids.jordan, ids.maya, ids.sam, ids.priya, ids.alex]

  // Unused invite the tester can share.
  const unusedToken = crypto.randomUUID()
  await report('unused invite', await demo.sb.from('invites').insert({
    knot_id: friday.id,
    created_by: demo.user.id,
    token: unusedToken,
    expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
  }))

  // ---- Hangouts covering every lifecycle ----

  // 1. Planning + venue poll + availability poll
  const planning = await createHangout(demo.sb, {
    knot_id: friday.id,
    title: 'Sample: Friday drinks poll',
    type: 'drinks',
    scheduled_for: null,
    brief: 'Need a bar that can take 6 and is not too loud.',
    brief_vibe: 'casual',
    brief_budget: '$$',
    brief_headcount: 6,
    invite_mode: 'all',
    is_surprise: false,
    poll_mode: true,
    poll_title: 'When works for Friday drinks?',
    poll_options: [
      { date: ymd(6), time: '18:30', sort_order: 0 },
      { date: ymd(6), time: '20:00', sort_order: 1 },
      { date: ymd(7), time: '19:00', sort_order: 2 },
    ],
    venue_options: [
      { ...VENUES.agricole, restriction_notes: 'Standing room after 9pm' },
      { ...VENUES.zuni, restriction_notes: 'Waitlist on Fridays' },
      { venue_name: 'Trick Dog', venue_address: '3010 20th St, San Francisco, CA', venue_lat: 37.7589, venue_lng: -122.4108, venue_category: 'bar', venue_rating: 4.4, price_level: 2 },
    ],
    post_content: 'Avery Sample started a plan: Friday drinks poll',
    post_type: 'hangout',
    planning_status: 'planning',
  })
  if (planning?.hangout_id) {
    await patchHangout(demo.sb, planning.hangout_id, { status: 'voting', planning_status: 'planning' }, 'planning status voting')
    const { data: options } = await demo.sb.from('hangout_options').select('id, venue_name').eq('hangout_id', planning.hangout_id)
    const { data: poll } = await demo.sb.from('availability_polls').select('id').eq('hangout_id', planning.hangout_id).maybeSingle()
    const { data: pollOpts } = poll
      ? await demo.sb.from('availability_poll_options').select('id').eq('poll_id', poll.id)
      : { data: [] }
    if (options?.[0]) {
      await report('venue vote jordan', await friends.jordan.sb.from('hangout_option_votes').insert({
        hangout_id: planning.hangout_id, option_id: options[0].id, user_id: ids.jordan,
      }))
      await report('venue vote maya', await friends.maya.sb.from('hangout_option_votes').insert({
        hangout_id: planning.hangout_id, option_id: options[0].id, user_id: ids.maya,
      }))
    }
    if (options?.[1]) {
      await report('venue vote sam', await friends.sam.sb.from('hangout_option_votes').insert({
        hangout_id: planning.hangout_id, option_id: options[1].id, user_id: ids.sam,
      }))
    }
    if (poll && pollOpts?.[0]) {
      for (const [acct, avail] of [
        [demo, 'yes'], [friends.jordan, 'yes'], [friends.maya, 'maybe'], [friends.sam, 'no'],
      ]) {
        await report(`poll ${avail}`, await acct.sb.from('availability_poll_responses').insert({
          poll_id: poll.id, option_id: pollOpts[0].id, user_id: acct.user.id, available: avail,
        }))
      }
    }
    await rsvp(demo, planning.hangout_id, 'yes')
    await rsvp(friends.jordan, planning.hangout_id, 'yes')
    await rsvp(friends.maya, planning.hangout_id, 'maybe')
    await message(demo, planning.hangout_id, 'Thinking Bar Agricole unless anyone hates standing.')
    await message(friends.jordan, planning.hangout_id, 'Agricole works. Can we do 7:30 so I can come from work?')
    await message(friends.maya, planning.hangout_id, 'Need step-free entry if we go somewhere else.')
  }

  // 2. Draft untitled-ish plan
  const draft = await createHangout(demo.sb, {
    knot_id: friday.id,
    title: 'Sample: untitled draft',
    type: 'planned',
    scheduled_for: null,
    brief: 'Just jotting this down. Not ready to lock.',
    invite_mode: 'all',
    post_content: 'Avery Sample started a draft plan',
    post_type: 'hangout',
    planning_status: 'draft',
  })
  if (draft?.hangout_id) {
    await patchHangout(demo.sb, draft.hangout_id, { planning_status: 'draft', status: 'voting' }, 'mark draft')
    await message(demo, draft.hangout_id, 'Parking this until we pick a weekend.')
  }

  // 3. Locked / confirmed dinner with roles and mixed RSVPs
  const dinner = await createHangout(demo.sb, {
    knot_id: friday.id,
    title: 'Sample: Zuni roast chicken',
    type: 'dinner',
    scheduled_for: iso(6, 19, 30),
    ...VENUES.zuni,
    brief: 'Table for 6. Priya is booking. Vegetarian sides for Avery.',
    brief_vibe: 'nice dinner',
    brief_budget: '$$$',
    brief_headcount: 6,
    event_restrictions: ['adults-only'],
    invite_mode: 'all',
    post_content: 'Avery Sample locked in Zuni roast chicken',
    post_type: 'hangout',
    planning_status: 'locked',
  })
  if (dinner?.hangout_id) {
    await patchHangout(demo.sb, dinner.hangout_id, {
      status: 'confirmed',
      planning_status: 'locked',
      cover_image_url: 'https://picsum.photos/seed/zunidinner/1200/600',
    }, 'confirm dinner')
    await rsvp(demo, dinner.hangout_id, 'yes', { guest_type: 'just_me', guest_count: 1 })
    await rsvp(friends.jordan, dinner.hangout_id, 'yes', { guest_type: 'plus_one', guest_count: 2, guest_dietary: ['gluten-free'] })
    await rsvp(friends.maya, dinner.hangout_id, 'yes', { guest_type: 'just_me', guest_accessibility: ['wheelchair-access'] })
    await rsvp(friends.sam, dinner.hangout_id, 'maybe')
    await rsvp(friends.priya, dinner.hangout_id, 'yes')
    await rsvp(friends.alex, dinner.hangout_id, 'no')
    const roles = [
      [ids.jordan, 'co_planner'],
      [ids.maya, 'treasurer'],
      [ids.sam, 'hype_person'],
      [ids.priya, 'table_booker'],
      [ids.priya, 'photographer'],
      [ids.alex, 'playlist_curator'],
      [ids.jordan, 'ride_coordinator'],
      [ids.maya, 'food_orderer'],
    ]
    for (const [userId, role] of roles) {
      await report(`role ${role}`, await demo.sb.from('hangout_member_roles').insert({
        hangout_id: dinner.hangout_id, user_id: userId, role, assigned_by: ids.avery,
        completed: role === 'table_booker',
        completed_at: role === 'table_booker' ? new Date().toISOString() : null,
      }))
    }
    await message(friends.priya, dinner.hangout_id, 'Reservation is under Sample, 7:30pm, table on the mezzanine.')
    await message(friends.jordan, dinner.hangout_id, 'I can pick Maya up in Oakland at 6:45.')
    await notify(friends.priya, ids.avery, friday.id, 'hangout_confirmed', 'Priya Sample locked the Zuni table for Saturday.', dinner.hangout_id)
  }

  // 4. Live in-person hangout
  const live = await createHangout(demo.sb, {
    knot_id: friday.id,
    title: 'Sample: live at Bar Agricole',
    type: 'drinks',
    scheduled_for: iso(0, 18, 0),
    ...VENUES.agricole,
    brief: 'We are here now. Come whenever.',
    invite_mode: 'all',
    post_content: 'Avery Sample is at Bar Agricole — the night is on!',
    post_type: 'moment',
    planning_status: 'locked',
  })
  if (live?.hangout_id) {
    await patchHangout(demo.sb, live.hangout_id, {
      status: 'live', is_live: true, planning_status: 'locked',
      cover_image_url: 'https://picsum.photos/seed/agricolelive/1200/600',
    }, 'go live')
    await rsvp(demo, live.hangout_id, 'yes')
    await rsvp(friends.sam, live.hangout_id, 'yes')
    await rsvp(friends.jordan, live.hangout_id, 'yes')
    await rsvp(friends.alex, live.hangout_id, 'maybe')
    await message(demo, live.hangout_id, "I'm here — back patio table.")
    await message(friends.sam, live.hangout_id, 'Two minutes out!')
    const liveMoment = await postMoment(friends.sam, friday.id, 'Live from Bar Agricole — patio is packed.', live.hangout_id)
    await uploadSamplePhoto(friends.sam, {
      knotId: friday.id, hangoutId: live.hangout_id, postId: liveMoment?.id,
      seed: 'agricolenight', caption: 'Patio lights at Agricole', fileName: 'agricole.jpg',
    })
  }

  // 5. Live online hangout
  const online = await createHangout(demo.sb, {
    knot_id: friday.id,
    title: 'Sample: online game night',
    type: 'online',
    scheduled_for: iso(0, 21, 0),
    meeting_url: 'https://meet.google.com/sample-knot-demo',
    brief: 'Jackbox + hanging out. Link is sample-only.',
    invite_mode: 'all',
    post_content: 'Avery Sample started an online hangout',
    post_type: 'hangout',
    planning_status: 'locked',
  })
  if (online?.hangout_id) {
    await patchHangout(demo.sb, online.hangout_id, {
      status: 'live', is_live: true, planning_status: 'locked', meeting_url: 'https://meet.google.com/sample-knot-demo',
    }, 'online live')
    await rsvp(demo, online.hangout_id, 'yes')
    await rsvp(friends.alex, online.hangout_id, 'yes')
    await rsvp(friends.jordan, online.hangout_id, 'yes')
    await message(friends.alex, online.hangout_id, 'Mic check. I can host Quiplash.')
  }

  // 6. Ended hangout with memories, bills, ratings
  const ended = await createHangout(demo.sb, {
    knot_id: friday.id,
    title: 'Sample: Stow Lake picnic',
    type: 'outdoors',
    scheduled_for: iso(-6, 12, 0),
    ...VENUES.goldenGate,
    brief: 'Blankets, snacks, and a boat if the line is short.',
    invite_mode: 'all',
    post_content: 'Avery Sample planned a picnic',
    post_type: 'hangout',
    planning_status: 'locked',
  })
  if (ended?.hangout_id) {
    await patchHangout(demo.sb, ended.hangout_id, {
      status: 'ended', is_live: false, planning_status: 'locked',
      cover_image_url: 'https://picsum.photos/seed/stowlake/1200/600',
    }, 'end picnic')
    await rsvp(demo, ended.hangout_id, 'yes')
    await rsvp(friends.maya, ended.hangout_id, 'yes')
    await rsvp(friends.priya, ended.hangout_id, 'yes')
    await rsvp(friends.jordan, ended.hangout_id, 'yes')
    const picnicMoment = await postMoment(friends.priya, friday.id, 'Golden hour at Stow Lake. Sample recap photo.', ended.hangout_id)
    const picnicPhoto = await uploadSamplePhoto(friends.priya, {
      knotId: friday.id, hangoutId: ended.hangout_id, postId: picnicMoment?.id,
      seed: 'stowlakepicnic', caption: 'Sample picnic recap', fileName: 'picnic.jpg',
    })
    const picnicPhoto2 = await uploadSamplePhoto(demo, {
      knotId: friday.id, hangoutId: ended.hangout_id,
      seed: 'stowboat', caption: 'Sample boat photo', fileName: 'boat.jpg',
    })
    if (picnicPhoto) {
      await report('highlight picnic', await demo.sb.from('profile_highlights').insert({
        profile_id: ids.avery, photo_id: picnicPhoto.id,
      }))
      await report('photo comment', await friends.jordan.sb.from('photo_comments').insert({
        photo_id: picnicPhoto.id, knot_id: friday.id, user_id: ids.jordan,
        content: 'This light is illegal. (Sample comment.)',
      }))
    }
    for (const acct of [demo, friends.maya, friends.priya]) {
      await report('hangout rating', await acct.sb.from('hangout_signals').upsert({
        hangout_id: ended.hangout_id,
        user_id: acct.user.id,
        knot_id: friday.id,
        rating: acct.user.id === ids.avery ? 5 : 4,
        venue_name: VENUES.goldenGate.venue_name,
        group_size: 4,
        scheduled_at: iso(-6, 12, 0),
        day_of_week: new Date(iso(-6, 12, 0)).getDay(),
        hour_of_day: 12,
      }, { onConflict: 'hangout_id,user_id' }))
      await report('vibes attend', await acct.sb.from('point_transactions').insert({
        user_id: acct.user.id, knot_id: friday.id, amount: 5, reason: 'hangout_attended', reference_id: ended.hangout_id,
      }))
    }
    await addBill(demo, {
      knotId: friday.id, hangoutId: ended.hangout_id,
      description: 'Picnic snacks (sample)',
      amount: 48.60,
      splitType: 'equal',
      splitIds: [ids.avery, ids.maya, ids.priya, ids.jordan],
      settledIds: [ids.avery, ids.maya],
      category: 'food',
    })
  }

  // 7. Cancelled / abandoned
  const cancelled = await createHangout(demo.sb, {
    knot_id: friday.id,
    title: 'Sample: cancelled karaoke',
    type: 'music',
    scheduled_for: iso(-1, 21, 0),
    venue_name: 'The Mint Karaoke Lounge',
    venue_address: '1942 Market St, San Francisco, CA',
    brief: 'Rain check — half the crew got stuck at work.',
    invite_mode: 'all',
    post_content: 'Avery Sample cancelled karaoke',
    post_type: 'hangout',
    planning_status: 'abandoned',
  })
  if (cancelled?.hangout_id) {
    await patchHangout(demo.sb, cancelled.hangout_id, {
      status: 'cancelled', is_live: false, planning_status: 'abandoned',
    }, 'cancel karaoke')
    await rsvp(demo, cancelled.hangout_id, 'yes')
    await rsvp(friends.sam, cancelled.hangout_id, 'yes')
    await message(demo, cancelled.hangout_id, 'Calling it. Next week instead. (Sample)')
  }

  // 8. Surprise birthday, selected invite list
  const surprise = await createHangout(demo.sb, {
    knot_id: friday.id,
    title: 'Sample: surprise for Sam',
    type: 'birthday',
    scheduled_for: iso(14, 19, 0),
    ...VENUES.liholiho,
    brief: 'Do not tell Sam. Reveal after dessert.',
    is_surprise: true,
    reveal_at: iso(14, 18, 30),
    invite_mode: 'selected',
    selected_member_ids: [ids.jordan, ids.maya, ids.priya, ids.alex, ids.sam],
    surprise_member_ids: [ids.sam],
    event_restrictions: ['adults-only'],
    post_content: 'Avery Sample planned a surprise',
    post_type: 'hangout',
    planning_status: 'planning',
  })
  if (surprise?.hangout_id) {
    await rsvp(demo, surprise.hangout_id, 'yes')
    await rsvp(friends.jordan, surprise.hangout_id, 'yes')
    await rsvp(friends.maya, surprise.hangout_id, 'yes')
    await message(demo, surprise.hangout_id, 'Cake is ordered. Nobody text the group chat.')
  }

  // 9. Movie night
  const movie = await createHangout(demo.sb, {
    knot_id: friday.id,
    title: 'Sample: movie night',
    type: 'movies',
    scheduled_for: iso(9, 19, 45),
    ...VENUES.alamo,
    movie_title: 'Sample Feature: The Grand Budapest Hotel',
    movie_showtime: iso(9, 19, 45),
    brief: 'Assigned seats. Maya needs an aisle.',
    invite_mode: 'all',
    post_content: 'Avery Sample planned a movie night',
    post_type: 'hangout',
    planning_status: 'locked',
  })
  if (movie?.hangout_id) {
    await patchHangout(demo.sb, movie.hangout_id, { status: 'confirmed', planning_status: 'locked' }, 'confirm movie')
    await rsvp(demo, movie.hangout_id, 'yes')
    await rsvp(friends.maya, movie.hangout_id, 'yes', { guest_accessibility: ['wheelchair-access'] })
    await rsvp(friends.alex, movie.hangout_id, 'yes')
  }

  // 10. Brunch club (second knot) confirmed
  const tartine = await createHangout(demo.sb, {
    knot_id: brunch.id,
    title: 'Sample: Tartine morning',
    type: 'brunch',
    scheduled_for: iso(2, 10, 30),
    ...VENUES.tartine,
    brief: 'Pastries and coffee. Sample brunch plan.',
    invite_mode: 'all',
    post_content: 'Avery Sample planned brunch',
    post_type: 'hangout',
    planning_status: 'locked',
  })
  if (tartine?.hangout_id) {
    await patchHangout(demo.sb, tartine.hangout_id, { status: 'confirmed', planning_status: 'locked' }, 'confirm brunch')
    await rsvp(demo, tartine.hangout_id, 'yes')
    await rsvp(friends.maya, tartine.hangout_id, 'yes')
    await rsvp(friends.jordan, tartine.hangout_id, 'maybe')
  }

  // 11. Office lunch in Maya's knot (demo is a member, not founder)
  if (office) {
    const lunch = await createHangout(friends.maya.sb, {
      knot_id: office.id,
      title: 'Sample: Tuesday salad club',
      type: 'lunch',
      scheduled_for: iso(4, 12, 15),
      venue_name: 'The Sentinel',
      venue_address: '37 New Montgomery St, San Francisco, CA',
      venue_lat: 37.7886,
      venue_lng: -122.4014,
      brief: 'Maya is organizing. Avery is just a member here.',
      invite_mode: 'all',
      post_content: 'Maya Sample planned lunch',
      post_type: 'hangout',
      planning_status: 'locked',
    })
    if (lunch?.hangout_id) {
      await patchHangout(friends.maya.sb, lunch.hangout_id, { status: 'confirmed', planning_status: 'locked' }, 'confirm office lunch')
      await rsvp(friends.maya, lunch.hangout_id, 'yes')
      await rsvp(demo, lunch.hangout_id, 'yes')
      await rsvp(friends.priya, lunch.hangout_id, 'yes')
    }
  }

  // 12. Standalone event (no knot)
  const standaloneToken = crypto.randomUUID()
  const standalone = await demo.sb.from('hangouts').insert({
    created_by: ids.avery,
    knot_id: null,
    title: 'Sample: rooftop pop-up',
    type: 'planned',
    status: 'confirmed',
    is_live: false,
    scheduled_for: iso(16, 17, 0),
    venue_name: 'Sample Rooftop, SoMa',
    venue_address: '2nd & Folsom, San Francisco, CA',
    brief: 'One-off event outside a Knot. Sample data only.',
    is_standalone: true,
    standalone_token: standaloneToken,
  }).select().single()
  log(!standalone.error, 'standalone event', standalone.error?.message)
  if (standalone.data) {
    await report('standalone attendee jordan', await friends.jordan.sb.from('standalone_attendees').insert({
      hangout_id: standalone.data.id, user_id: ids.jordan, status: 'going',
    }))
    await report('standalone attendee alex', await friends.alex.sb.from('standalone_attendees').insert({
      hangout_id: standalone.data.id, user_id: ids.alex, status: 'maybe',
    }))
  }

  // ---- Feed posts, comments, reactions ----
  const moment1 = await postMoment(demo, friday.id, 'Sample moment: found a new taco truck on Valencia.')
  const moment2 = await postMoment(friends.jordan, friday.id, 'Sample moment: who is around this Thursday?')
  const moment3 = await postMoment(friends.maya, friday.id, 'Sample recap: still thinking about that picnic.')
  await postMoment(friends.sam, friday.id, 'Sample hype: karaoke rain check is still on my mind.')

  if (moment1) {
    const { data: c1 } = await friends.jordan.sb.from('comments').insert({
      post_id: moment1.id, author_id: ids.jordan, content: 'Send the pin? (Sample comment)',
    }).select().single()
    await report('comment maya', await friends.maya.sb.from('comments').insert({
      post_id: moment1.id, author_id: ids.maya, content: 'If they have a vegan option I am in.',
    }))
    if (c1) {
      await report('comment reaction', await demo.sb.from('comment_reactions').insert({
        comment_id: c1.id, user_id: ids.avery, emoji: '👍',
      }))
    }
    await report('react fire', await friends.sam.sb.from('reactions').insert({
      post_id: moment1.id, user_id: ids.sam, emoji: '🔥',
    }))
    await report('react heart', await friends.priya.sb.from('reactions').insert({
      post_id: moment1.id, user_id: ids.priya, emoji: '❤️',
    }))
  }
  if (moment2) {
    await report('react laugh', await demo.sb.from('reactions').insert({
      post_id: moment2.id, user_id: ids.avery, emoji: '😂',
    }))
  }

  await report('group chat', await demo.sb.from('posts').insert({
    knot_id: friday.id, author_id: ids.avery,
    content: 'Sample group chat: anyone free after Zuni for a nightcap?',
    post_type: 'chat',
  }))

  // ---- Bills: equal unpaid, custom, itemised, recurring, settlement ----
  const equalBill = await addBill(friends.maya, {
    knotId: friday.id,
    description: 'Uber from picnic (sample)',
    amount: 36.00,
    splitType: 'equal',
    splitIds: [ids.maya, ids.avery, ids.jordan],
    settledIds: [ids.maya],
    category: 'transport',
  })
  const customBill = await addBill(demo, {
    knotId: friday.id,
    description: 'Concert tickets (sample)',
    amount: 120.00,
    splitType: 'custom',
    splitIds: [ids.avery, ids.sam, ids.alex],
    settledIds: [ids.avery],
    category: 'entertainment',
    note: 'Sam took the extra ticket.',
  })
  if (customBill) {
    // overwrite equal shares with custom amounts
    await demo.sb.from('bill_splits').delete().eq('bill_id', customBill.id)
    await report('custom splits', await demo.sb.from('bill_splits').insert([
      { bill_id: customBill.id, user_id: ids.avery, amount: 40, settled: true },
      { bill_id: customBill.id, user_id: ids.sam, amount: 40, settled: false },
      { bill_id: customBill.id, user_id: ids.alex, amount: 40, settled: false },
    ]))
  }
  const itemised = await addBill(friends.jordan, {
    knotId: friday.id,
    hangoutId: dinner?.hangout_id,
    description: 'Sample itemised dinner',
    amount: 92.50,
    splitType: 'itemised',
    splitIds: [ids.jordan, ids.avery, ids.maya],
    settledIds: [ids.jordan],
    category: 'food',
  })
  if (itemised) {
    const items = [
      { description: 'Roast chicken', amount: 58.00, users: [ids.jordan, ids.avery] },
      { description: 'Shoestring fries', amount: 12.50, users: [ids.jordan, ids.avery, ids.maya] },
      { description: 'Sparkling water', amount: 22.00, users: [ids.maya] },
    ]
    for (const item of items) {
      const { data: row, error } = await friends.jordan.sb.from('bill_line_items')
        .insert({ bill_id: itemised.id, description: item.description, amount: item.amount })
        .select().single()
      if (error || !row) { log(false, `line item ${item.description}`, error?.message); continue }
      const share = item.amount / item.users.length
      await report(`assign ${item.description}`, await friends.jordan.sb.from('bill_line_item_assignments').insert(
        item.users.map(uid => ({ line_item_id: row.id, user_id: uid, share: parseFloat(share.toFixed(2)) }))
      ))
    }
  }
  await addBill(demo, {
    knotId: friday.id,
    description: 'Shared music plan (sample recurring)',
    amount: 15.99,
    splitType: 'equal',
    splitIds: [ids.avery, ids.jordan, ids.sam],
    settledIds: [ids.avery],
    category: 'other',
    isRecurring: true,
    recurringInterval: 'monthly',
  })
  // Avery pays Maya back for part of the Uber
  await report('settlement', await demo.sb.from('settlements').insert({
    knot_id: friday.id,
    from_user_id: ids.avery,
    to_user_id: ids.maya,
    amount: 12.00,
    note: 'Partial sample settlement for picnic Uber',
  }))
  if (equalBill) {
    await notify(friends.maya, ids.avery, friday.id, 'bill_reminder',
      'You owe Maya Sample $12.00. Settle up in Knot. (Sample reminder)', equalBill.id)
  }

  // ---- Games ----
  const ludo = await demo.sb.from('games').insert({
    knot_id: friday.id, created_by: ids.avery, game_type: 'ludo', status: 'waiting',
  }).select().single()
  log(!ludo.error, 'ludo lobby', ludo.error?.message)
  if (ludo.data) {
    await report('ludo host', await demo.sb.from('game_players').insert({
      game_id: ludo.data.id, user_id: ids.avery, color: 'var(--yellow)', alive: true,
    }))
    await report('ludo jordan', await friends.jordan.sb.from('game_players').insert({
      game_id: ludo.data.id, user_id: ids.jordan, color: '#B85C38', alive: true,
    }))
  }
  const imposter = await demo.sb.from('games').insert({
    knot_id: friday.id, created_by: ids.avery, game_type: 'among_us', status: 'waiting',
  }).select().single()
  log(!imposter.error, 'imposter lobby', imposter.error?.message)
  if (imposter.data) {
    for (const [acct, color] of [[demo, 'var(--yellow)'], [friends.sam, '#6B705C'], [friends.alex, '#4A7C5F'], [friends.jordan, '#B85C38']]) {
      await report('imposter player', await acct.sb.from('game_players').insert({
        game_id: imposter.data.id, user_id: acct.user.id, color, alive: true,
      }))
    }
  }
  await report('snake score avery', await demo.sb.from('game_scores').insert({
    knot_id: friday.id, user_id: ids.avery, game_id: 'snake', score: 42,
  }))
  await report('snake score jordan', await friends.jordan.sb.from('game_scores').insert({
    knot_id: friday.id, user_id: ids.jordan, game_id: 'snake', score: 61,
  }))
  await report('tetris score', await friends.alex.sb.from('game_scores').insert({
    knot_id: friday.id, user_id: ids.alex, game_id: 'tetris', score: 1800,
  }))

  // ---- Nominations ----
  await report('nomination', await demo.sb.from('nominations').insert({
    knot_id: friday.id,
    nominated_by: ids.avery,
    nominee_name: 'Riley Sample',
    nominee_email: 'riley.sample.knot@gmail.com',
    status: 'pending',
  }))

  // ---- Connections / follows ----
  await report('follow request', await friends.alex.sb.from('connections').insert({
    requester_id: ids.alex, addressee_id: ids.avery, type: 'follow',
  }))
  await report('connection', await friends.jordan.sb.from('connections').insert({
    requester_id: ids.jordan, addressee_id: ids.avery, type: 'connection',
  }))
  await notify(friends.alex, ids.avery, friday.id, 'follow_request',
    'Alex Sample sent you a follow request', null)

  // ---- Extra notifications so the bell is not empty ----
  await notify(friends.sam, ids.avery, friday.id, 'new_moment',
    'Sam Sample posted: "Live from Bar Agricole — patio is packed."', live?.hangout_id)
  await notify(friends.jordan, ids.avery, friday.id, 'new_hangout',
    'Jordan Sample is in for Zuni roast chicken.', dinner?.hangout_id)
  await notify(friends.maya, ids.avery, friday.id, 'rsvp_momentum',
    'Maya Sample RSVP’d yes to Tartine morning.', tartine?.hangout_id)
  await notify(demo, ids.avery, friday.id, 'hangout_live',
    'Sample: live at Bar Agricole is happening now.', live?.hangout_id)

  // Vibes for the demo user so the rewards shop is not empty.
  await report('vibes seed', await demo.sb.from('point_transactions').insert({
    user_id: ids.avery, knot_id: friday.id, amount: 80, reason: 'sample_seed',
  }))

  // Orient card already seen so first-run overlay does not block the tour.
  await report('orient friday', await demo.sb.from('orient_card_seen').insert({
    user_id: ids.avery, knot_id: friday.id,
  }))
  await report('orient brunch', await demo.sb.from('orient_card_seen').insert({
    user_id: ids.avery, knot_id: brunch.id,
  }))
  if (office) {
    await report('orient office', await demo.sb.from('orient_card_seen').insert({
      user_id: ids.avery, knot_id: office.id,
    }))
  }

  console.log('\n--- seed summary ---')
  console.log(`ok=${stats.ok} fail=${stats.fail} skip=${stats.skip}`)
  if (failures.length) {
    console.log('failures:')
    for (const f of failures) console.log(`  - ${f.label}: ${f.extra}`)
  }
  printCredentials({ unusedToken, standaloneToken })
}

function printCredentials(extra = {}) {
  console.log('\n========================================')
  console.log('SAMPLE TEST ACCOUNT')
  console.log('========================================')
  console.log('App:      https://knot-web-am-woad.vercel.app/')
  console.log(`Email:    ${DEMO.email}`)
  console.log(`Username: ${DEMO.username}`)
  console.log(`Password: ${DEMO.password}`)
  console.log('')
  console.log('Friend logins (same password):')
  for (const f of FRIENDS) {
    console.log(`  ${f.name.padEnd(16)}  ${f.email.padEnd(32)}  @${f.username}`)
  }
  if (extra.unusedToken) {
    console.log(`\nUnused knot invite: https://knot-web-am-woad.vercel.app/invite/${extra.unusedToken}`)
  }
  if (extra.standaloneToken) {
    console.log(`Standalone event:  https://knot-web-am-woad.vercel.app/event/${extra.standaloneToken}`)
  }
  console.log('========================================\n')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
