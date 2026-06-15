import { NextResponse } from 'next/server'
import axios from 'axios'

export async function GET() {
  const apiKey = process.env.FOURSQUARE_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'No API key' })

  try {
    const { data } = await axios.get('https://api.foursquare.com/v3/places/search', {
      headers: { Authorization: apiKey, Accept: 'application/json' },
      params: { ll: '43.593,-79.756', categories: '13003', limit: '3' },
      timeout: 10000,
    })
    return NextResponse.json({ status: 200, results: data.results?.length, first: data.results?.[0]?.name })
  } catch (e: any) {
    const msg = e.response?.data || e.message
    return NextResponse.json({ error: JSON.stringify(msg) })
  }
}