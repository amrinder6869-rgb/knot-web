import { NextResponse } from 'next/server'
import https from 'https'
import crypto from 'crypto'

function verifySig(ref: string, exp: string, sig: string, secret: string): boolean {
  const expiry = parseInt(exp, 10)
  if (!expiry || Date.now() > expiry) return false
  const expected = crypto.createHmac('sha256', secret).update(`${ref}.${exp}`).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))
  } catch {
    return false
  }
}

function httpsGetBuffer(url: string): Promise<{ status: number; contentType: string; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
    }, (res) => {
      // Follow one redirect (Places photo always redirects to the image CDN)
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        httpsGetBuffer(res.headers.location).then(resolve).catch(reject)
        res.resume()
        return
      }
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => resolve({
        status: res.statusCode || 500,
        contentType: res.headers['content-type'] || 'image/jpeg',
        body: Buffer.concat(chunks),
      }))
    })
    req.on('error', reject)
    req.end()
  })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const ref = searchParams.get('ref')
  const exp = searchParams.get('exp')
  const sig = searchParams.get('sig')

  if (!ref || !exp || !sig) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 })

  if (!verifySig(ref, exp, sig, apiKey)) {
    return NextResponse.json({ error: 'Invalid or expired signature' }, { status: 403 })
  }

  const params = new URLSearchParams({
    maxwidth: '400',
    photo_reference: ref,
    key: apiKey,
  })

  try {
    const result = await httpsGetBuffer(
      `https://maps.googleapis.com/maps/api/place/photo?${params}`
    )
    return new NextResponse(new Uint8Array(result.body), {
      status: result.status,
      headers: {
        'Content-Type': result.contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch photo' }, { status: 500 })
  }
}
