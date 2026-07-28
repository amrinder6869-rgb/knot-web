const fs = require('fs');
const path = require('path');

const BASE = 'C:\\Users\\amrin\\Documents\\knot-web';

// ─── 1. Fix PostHangoutLoop to capture venue_place_id ────────────────────────

const loopPath = path.join(BASE, 'components\\PostHangoutLoop.tsx');
let loopContent = fs.readFileSync(loopPath, 'utf8');

const oldUpsert = `      await supabase.from('hangout_signals').upsert({
        hangout_id: hangout.id,
        user_id: currentUserId,
        knot_id: knotId,
        rating: r,
        venue_name: hangout.venue_name ?? hangout.title ?? null,
        venue_place_id: hangout.venue_place_id ?? null,
        group_size: goingCount,
        scheduled_at: scheduledAt.toISOString(),
        day_of_week: scheduledAt.getDay(),
        hour_of_day: scheduledAt.getHours(),
      }, { onConflict: 'hangout_id,user_id' })`;

const newUpsert = `      await supabase.from('hangout_signals').upsert({
        hangout_id: hangout.id,
        user_id: currentUserId,
        knot_id: knotId,
        rating: r,
        venue_name: hangout.venue_name ?? hangout.title ?? null,
        venue_place_id: hangout.venue_place_id ?? hangout.venue_place_id ?? null,
        group_size: goingCount,
        scheduled_at: scheduledAt.toISOString(),
        day_of_week: scheduledAt.getDay(),
        hour_of_day: scheduledAt.getHours(),
      }, { onConflict: 'hangout_id,user_id' })`;

if (loopContent.includes(oldUpsert)) {
  loopContent = loopContent.replace(oldUpsert, newUpsert);
  fs.writeFileSync(loopPath, loopContent, 'utf8');
  console.log('PostHangoutLoop venue_place_id confirmed');
} else {
  console.log('SKIP: PostHangoutLoop upsert pattern not found');
}

// ─── 2. Create recommendations API route ─────────────────────────────────────

const apiDir = path.join(BASE, 'app\\api\\recommendations');
if (!fs.existsSync(apiDir)) fs.mkdirSync(apiDir, { recursive: true });

const apiContent = `import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url)
  const knotId = searchParams.get('knot_id')
  if (!knotId) return NextResponse.json({ error: 'Missing knot_id' }, { status: 400 })

  try {
    // Get the last 20 signals for this knot
    const { data: signals } = await supabase
      .from('hangout_signals')
      .select('venue_name, venue_place_id, day_of_week, hour_of_day, rating, group_size')
      .eq('knot_id', knotId)
      .not('venue_name', 'is', null)
      .order('created_at', { ascending: false })
      .limit(20)

    if (!signals || signals.length === 0) {
      return NextResponse.json({ suggestions: [], hasHistory: false })
    }

    // Find top rated venues
    const venueMap: Record<string, { name: string; place_id: string | null; totalRating: number; count: number }> = {}
    signals.forEach((s: any) => {
      const key = s.venue_place_id || s.venue_name
      if (!venueMap[key]) {
        venueMap[key] = { name: s.venue_name, place_id: s.venue_place_id, totalRating: 0, count: 0 }
      }
      venueMap[key].totalRating += s.rating || 3
      venueMap[key].count += 1
    })

    const topVenues = Object.values(venueMap)
      .map(v => ({ ...v, avgRating: v.totalRating / v.count }))
      .filter(v => v.avgRating >= 3.5)
      .sort((a, b) => b.avgRating - a.avgRating)
      .slice(0, 3)

    // Find preferred day and time
    const dayCount: Record<number, number> = {}
    const hourCount: Record<number, number> = {}
    signals.forEach((s: any) => {
      if (s.day_of_week !== null) dayCount[s.day_of_week] = (dayCount[s.day_of_week] || 0) + 1
      if (s.hour_of_day !== null) hourCount[s.hour_of_day] = (hourCount[s.hour_of_day] || 0) + 1
    })

    const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const preferredDay = Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0]
    const preferredHour = Object.entries(hourCount).sort((a, b) => b[1] - a[1])[0]

    const avgGroupSize = Math.round(signals.reduce((s: number, r: any) => s + (r.group_size || 4), 0) / signals.length)

    return NextResponse.json({
      hasHistory: true,
      topVenues,
      preferredDay: preferredDay ? DAYS[parseInt(preferredDay[0])] : null,
      preferredHour: preferredHour ? parseInt(preferredHour[0]) : null,
      avgGroupSize,
      totalHangouts: signals.length,
    })
  } catch (err) {
    console.error('Recommendations error:', err)
    return NextResponse.json({ error: 'Failed to generate recommendations' }, { status: 500 })
  }
}
`;

fs.writeFileSync(path.join(apiDir, 'route.ts'), apiContent, 'utf8');
console.log('Created: app/api/recommendations/route.ts');

// ─── 3. Add GroupBrief suggestion chip to Composer ───────────────────────────

const composerPath = path.join(BASE, 'components\\Composer.tsx');
let composerContent = fs.readFileSync(composerPath, 'utf8');

// Add useEffect import if not there
if (!composerContent.includes('useEffect')) {
  composerContent = composerContent.replace(
    `import { useState, useRef } from 'react'`,
    `import { useState, useRef, useEffect } from 'react'`
  );
  console.log('Added useEffect import to Composer');
}

// Add recommendation state after briefBudget state
const oldBriefState = `  const [briefBudget, setBriefBudget]     = useState('')`;
const newBriefState = `  const [briefBudget, setBriefBudget]     = useState('')
  const [suggestions, setSuggestions2]    = useState<any>(null)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)`;

if (composerContent.includes(oldBriefState)) {
  composerContent = composerContent.replace(oldBriefState, newBriefState);
  console.log('Added suggestion state to Composer');
} else { console.log('SKIP: briefBudget state not found'); }

// Add useEffect to load suggestions when hangout tab opens
const oldActiveType = `  const userName  = currentUser?.name || 'You'`;
const newActiveType = `  useEffect(() => {
    if (activeType !== 'hangout' || !knotId) return
    setLoadingSuggestions(true)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setLoadingSuggestions(false); return }
      fetch('/api/recommendations?knot_id=' + knotId, {
        headers: { Authorization: 'Bearer ' + session.access_token }
      })
        .then(r => r.json())
        .then(data => { if (data.hasHistory) setSuggestions2(data) })
        .catch(() => {})
        .finally(() => setLoadingSuggestions(false))
    })
  }, [activeType, knotId])

  const userName  = currentUser?.name || 'You'`;

if (composerContent.includes(oldActiveType)) {
  composerContent = composerContent.replace(oldActiveType, newActiveType);
  console.log('Added useEffect for recommendations in Composer');
} else { console.log('SKIP: userName anchor not found'); }

// Add suggestion chip at top of hangout composer, after error block
const oldHangoutTitle = `          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>What</div>`;

const newHangoutTitle = `          {suggestions2 && suggestions2.topVenues?.length > 0 && (
            <div style={{ marginBottom: 14, padding: '10px 12px', background: 'var(--yellow-soft)', border: '1px solid var(--yellow-dim)', borderRadius: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--yellow)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                Your group loves
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {suggestions2.topVenues.map((v: any) => (
                  <button key={v.name}
                    onClick={() => setHangoutTitle(v.name)}
                    style={{ padding: '5px 10px', borderRadius: 20, border: '1px solid var(--yellow)', background: 'transparent', color: 'var(--yellow)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {v.name}
                  </button>
                ))}
              </div>
              {suggestions2.preferredDay && (
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
                  Your group usually hangs on {suggestions2.preferredDay}s
                </div>
              )}
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>What</div>`;

if (composerContent.includes(oldHangoutTitle)) {
  composerContent = composerContent.replace(oldHangoutTitle, newHangoutTitle);
  fs.writeFileSync(composerPath, composerContent, 'utf8');
  console.log('Added group suggestions chip to Composer');
} else { console.log('SKIP: What section anchor not found in Composer'); }

console.log('\nSprint 2B complete.');
console.log('Recommendations API route created.');
console.log('Composer shows top venues and preferred day from group history.');
console.log('Tapping a suggestion fills in the What field automatically.');
