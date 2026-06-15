import { NextResponse } from 'next/server'
import https from 'https'

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
  '10000': 'art_gallery',
  '18000': 'park',
  '13059': 'cafe',
  '10032': 'bowling_alley',
  '13049': 'meal_takeaway',
  '13029': 'restaurant',
}

const PRICE_TO_GOOGLE: Record<string, string> = {
  '1': '1',
  '2': '2',
  '3': '3',
  '4': '4',
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const ll       = searchParams.get('ll')
  const category = searchParams.get('categories')
  const price    = searchParams.get('price')

  if (!ll || !category) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  const [lat, lng] = ll.split(',')
  const type = CATEGORY_TO_TYPE[category] || 'restaurant'

  const params = new URLSearchParams({
    location: `${lat},${lng}`,
    radius: '5000',
    type,
    key: apiKey,
    ...(price ? { minprice: PRICE_TO_GOOGLE[price] || '1', maxprice: PRICE_TO_GOOGLE[price] || '4' } : {}),
  })

  try {
    const body = await httpsGet(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params}`
    )
    const data = JSON.parse(body)

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      return NextResponse.json({ error: data.status, message: data.error_message }, { status: 400 })
    }

    // Normalize to match our UI expectations
    const results = (data.results || []).slice(0, 10).map((p: any) => ({
      fsq_id: p.place_id,
      name: p.name,
      location: {
        formatted_address: p.vicinity,
        address: p.vicinity,
      },
      categories: [{ id: p.place_id, name: p.types?.[0]?.replace(/_/g, ' ') || type }],
      price: p.price_level,
      distance: null,
      closed_bucket: p.opening_hours?.open_now ? 'VeryLikelyOpen' : null,
      rating: p.rating,
      rating_count: p.user_ratings_total,
      photo_ref: p.photos?.[0]?.photo_reference || null,
      google_maps_url: `https://www.google.com/maps/place/?q=place_id:${p.place_id}`,
    }))

    return NextResponse.json({ results })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}