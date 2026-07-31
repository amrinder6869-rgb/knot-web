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

const CATEGORY_TO_TYPES: Record<string, string[]> = {
  '13000': ['restaurant'],
  '13003': ['bar', 'night_club'],
  '10000': ['museum', 'art_gallery', 'tourist_attraction'],
  '18000': ['park', 'campground', 'natural_feature', 'stadium'],
  '13059': ['cafe'],
  '10032': ['bowling_alley', 'amusement_park', 'gym', 'movie_theater', 'stadium', 'casino'],
  '13049': ['meal_takeaway', 'meal_delivery'],
  '13029': ['restaurant'],
}

const ALLOWED_CATEGORIES = new Set(Object.keys(CATEGORY_TO_TYPES))

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
  const ll           = searchParams.get('ll')
  const category     = searchParams.get('categories')
  const priceLevel   = searchParams.get('price') ? parseInt(searchParams.get('price')!) : null
  const minGroupSize = searchParams.get('min_group') ? parseInt(searchParams.get('min_group')!) : null
  const openNow      = searchParams.get('open_now') === '1'

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

  const types = CATEGORY_TO_TYPES[category] || ['establishment']
  const type = types[0]

  // Use larger radius for categories that are less dense in suburban areas
  const sparseCategories = new Set(['18000', '10032', '10000'])
  const radius = sparseCategories.has(category) ? '15000' : '8000'

  const params = new URLSearchParams({
    location: `${lat},${lng}`,
    radius,
    key: apiKey,
  })
  if (priceLevel) params.set('maxprice', String(priceLevel))
  if (openNow) params.set('opennow', 'true')

  try {
    // Fetch all types in parallel and merge results
    const allResults: any[] = []
    const seenIds = new Set<string>()

    await Promise.all(types.map(async (t: string) => {
      const typeParams = new URLSearchParams(params)
      typeParams.set('type', t)
      try {
        const body = await httpsGet(
          `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${typeParams}`
        )
        const data = JSON.parse(body)
        if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
          for (const r of (data.results || [])) {
            if (!seenIds.has(r.place_id)) {
              seenIds.add(r.place_id)
              allResults.push(r)
            }
          }
        }
      } catch {}
    }))

    if (allResults.length === 0)
      return NextResponse.json({ results: [] })

    let rawResults = allResults
      .sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0))

    // Filter by price level if specified
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
    }

    const results = rawResults
      .slice(0, 10)
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
          ? `/api/place-photo?ref=${encodeURIComponent(p.photos[0].photo_reference)}`
          : null,
        google_maps_url: `https://www.google.com/maps/place/?q=place_id:${p.place_id}`,
        lat: p.geometry?.location?.lat || null,
        lng: p.geometry?.location?.lng || null,
      }))

    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch venues' }, { status: 500 })
  }
}
