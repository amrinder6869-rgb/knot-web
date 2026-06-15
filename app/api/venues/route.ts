import { NextResponse } from 'next/server'
import axios from 'axios'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const ll       = searchParams.get('ll')
  const category = searchParams.get('categories')
  const price    = searchParams.get('price')
  const limit    = searchParams.get('limit') || '10'

  if (!ll || !category) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
  }

  const apiKey = process.env.FOURSQUARE_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  const params: Record<string, string> = { ll, categories: category, limit, sort: 'RELEVANCE' }
  if (price) params.price = price

  try {
    const { data } = await axios.get('https://api.foursquare.com/v3/places/search', {
      headers: { Authorization: apiKey, Accept: 'application/json' },
      params,
      timeout: 10000,
    })
    return NextResponse.json(data)
  } catch (e: any) {
    const msg = e.response?.data || e.message
    console.error('Foursquare error:', msg)
    return NextResponse.json({ error: JSON.stringify(msg) }, { status: 500 })
  }
}