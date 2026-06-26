import { NextResponse } from 'next/server'
import https from 'https'
import { createClient } from '@supabase/supabase-js'

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: { Accept: 'application/json' },
    }, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => resolve(body))
    })
    req.on('error', reject)
    req.end()
  })
}

const CATEGORY_TO_TYPE: Record<string, string> = {
  '13000': 'restaurant',
  '13003': 'bar',
  '10000': 'museum',
  '18000': 'park',
  '13059': 'cafe',
  '10032': 'bowling_alley',
  '13049': 'meal_takeaway',
  '13029': 'restaurant',
}

const ALLOWED_CATEGORIES = new Set(Object.keys(CATEGORY_TO_TYPE))

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
  const ll       = searchParams.get('ll')
  const category = searchParams.get('categories')

  if (!ll || !category) return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })

  const parts = ll.split(',')
  if (parts.length !== 2) return NextResponse.json({ error: 'Invalid ll format' }, { status: 400 })
  const lat = parseFloat(parts[0])
  const lng = parseFloat(parts[1])
  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180)
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 })

  if (!ALLOWED_CATEGORIES.has(category))
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 })

  const type = CATEGORY_TO_TYPE[category]

  const params = new URLSearchParams({
    location: `${lat},${lng}`,
    radius: '8000',
    type,
    key: apiKey,
  })

  try {
    const body = await httpsGet(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params}`
    )
    const data = JSON.parse(body)

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS')
      return NextResponse.json({ error: 'Places API error' }, { status: 400 })

    const results = (data.results || [])
      .slice(0, 10)
      .sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0))
      .map((p: any) => ({
        fsq_id:   p.place_id,
        name:     p.name,
        location: {
          formatted_address: p.vicinity,
          address:           p.vicinity,
        },
        categories:   [{ id: p.place_id, name: p.types?.[0]?.replace(/_/g, ' ') || type }],
        price:        p.price_level,
        distance:     null,
        closed_bucket: p.opening_hours?.open_now ? 'VeryLikelyOpen' : null,
        rating:        p.rating,
        rating_count:  p.user_ratings_total,
        photo_url:     p.photos?.[0]?.photo_reference
          ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${p.photos[0].photo_reference}&key=${apiKey}`
          : null,
        google_maps_url: `https://www.google.com/maps/place/?q=place_id:${p.place_id}`,
      }))

    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch venues' }, { status: 500 })
  }
}
