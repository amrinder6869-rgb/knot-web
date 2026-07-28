import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
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
