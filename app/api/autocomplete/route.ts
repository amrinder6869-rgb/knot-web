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
      res.on('data', (chunk: string) => body += chunk)
      res.on('end', () => resolve(body))
    })
    req.on('error', reject)
    req.end()
  })
}

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
  const input   = searchParams.get('input')
  const placeId = searchParams.get('place_id')

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    // Demo fallback venues (Toronto) when Places key is not configured
    if (placeId) {
      const demos: Record<string, { name: string; formatted_address: string; lat: number; lng: number }> = {
        demo_bar_raval: { name: 'Bar Raval', formatted_address: '505 College St, Toronto, ON', lat: 43.6555, lng: -79.4120 },
        demo_pai: { name: 'Pai Northern Thai', formatted_address: '18 Duncan St, Toronto, ON', lat: 43.6479, lng: -79.3895 },
        demo_seven_lives: { name: 'Seven Lives Tacos', formatted_address: '69 Kensington Ave, Toronto, ON', lat: 43.6544, lng: -79.4005 },
      }
      const d = demos[placeId] || demos.demo_pai
      return NextResponse.json({ place: { place_id: placeId, ...d } })
    }
    const q = (input || '').toLowerCase()
    const all = [
      { place_id: 'demo_pai', description: 'Pai Northern Thai, Duncan St, Toronto', main_text: 'Pai Northern Thai', secondary_text: '18 Duncan St, Toronto' },
      { place_id: 'demo_bar_raval', description: 'Bar Raval, College St, Toronto', main_text: 'Bar Raval', secondary_text: '505 College St, Toronto' },
      { place_id: 'demo_seven_lives', description: 'Seven Lives Tacos, Kensington, Toronto', main_text: 'Seven Lives Tacos', secondary_text: '69 Kensington Ave, Toronto' },
    ]
    const suggestions = all.filter(s => !q || s.description.toLowerCase().includes(q) || s.main_text.toLowerCase().includes(q)).slice(0, 5)
    return NextResponse.json({ suggestions })
  }

  // Place details — get lat/lng from a place_id
  if (placeId) {
    const params = new URLSearchParams({ place_id: placeId, fields: 'geometry,formatted_address,name', key: apiKey })
    try {
      const body = await httpsGet(`https://maps.googleapis.com/maps/api/place/details/json?${params}`)
      const data = JSON.parse(body)
      if (data.status !== 'OK') return NextResponse.json({ error: 'Place not found' }, { status: 404 })
      const result = data.result
      return NextResponse.json({
        place: {
          place_id: placeId,
          name: result.name,
          formatted_address: result.formatted_address,
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng,
        }
      })
    } catch {
      return NextResponse.json({ error: 'Failed to fetch place details' }, { status: 500 })
    }
  }

  // Autocomplete — get suggestions from input text
  if (!input || input.trim().length < 2) return NextResponse.json({ suggestions: [] })

  const params = new URLSearchParams({ input: input.trim(), key: apiKey })
  try {
    const body = await httpsGet(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`)
    const data = JSON.parse(body)
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      return NextResponse.json({ suggestions: [] })
    }
    const suggestions = (data.predictions || []).slice(0, 5).map((p: any) => ({
      place_id:     p.place_id,
      description:  p.description,
      main_text:    p.structured_formatting?.main_text || p.description,
      secondary_text: p.structured_formatting?.secondary_text || '',
    }))
    return NextResponse.json({ suggestions })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch suggestions' }, { status: 500 })
  }
}
