const fs = require('fs')
const path = require('path')

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web', 'app', 'api', 'place-photo', 'route.ts')

const content = `import { NextResponse } from 'next/server'
import https from 'https'
import http from 'http'

function fetchFollowingRedirects(url: string, maxRedirects = 5): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http
    lib.get(url, res => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (maxRedirects === 0) { reject(new Error('Too many redirects')); return }
        fetchFollowingRedirects(res.headers.location, maxRedirects - 1).then(resolve).catch(reject)
        return
      }
      const chunks: Buffer[] = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks)))
    }).on('error', reject)
  })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const ref = searchParams.get('ref')
  if (!ref) return NextResponse.json({ error: 'Missing ref' }, { status: 400 })

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Not configured' }, { status: 500 })

  try {
    const url = \`https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=\${encodeURIComponent(ref)}&key=\${apiKey}\`
    const buffer = await fetchFollowingRedirects(url)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch photo' }, { status: 500 })
  }
}
`

fs.writeFileSync(filePath, content, 'utf8')
console.log('Done. Run: npm run build')
