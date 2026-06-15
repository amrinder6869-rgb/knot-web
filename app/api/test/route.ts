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

export async function GET() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'No API key', keyFound: false })

  try {
    const body = await httpsGet(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=43.593,-79.756&radius=2000&type=bar&key=${apiKey}`
    )
    const data = JSON.parse(body)
    return NextResponse.json({
      status: data.status,
      count: data.results?.length,
      first: data.results?.[0]?.name,
      error: data.error_message,
      keyPrefix: apiKey.substring(0, 6),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message })
  }
}