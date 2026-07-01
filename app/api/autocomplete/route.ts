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
  if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 })

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
