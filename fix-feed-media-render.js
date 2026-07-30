const https = require('https')
const fs = require('fs')
const path = require('path')

const BASE = 'C:\\Users\\amrin\\Documents\\knot-web'

function fetchGH(filePath) {
  return new Promise((resolve, reject) => {
    https.get(
      `https://raw.githubusercontent.com/amrinder6869-rgb/knot-web/master/${filePath}`,
      res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)) }
    ).on('error', reject)
  })
}

async function main() {

  // 1. Extend signed URL default expiry from 1hr to 24hrs
  let supabase = await fetchGH('lib/supabase.ts')
  supabase = supabase.replace(
    `export async function getSignedUrl(storagePath: string | null | undefined, expiresIn = 3600): Promise<string | null> {`,
    `export async function getSignedUrl(storagePath: string | null | undefined, expiresIn = 86400): Promise<string | null> {`
  )
  fs.writeFileSync(path.join(BASE, 'lib', 'supabase.ts'), supabase, 'utf8')
  console.log('lib/supabase.ts: signed URL expiry extended to 24hrs')

  // 2. Replace IIFE render pattern in Feed.tsx with a clean variable-based conditional
  let feed = await fetchGH('components/Feed.tsx')

  feed = feed.replace(
    `                  {momentPhotos.get(p.id) && (() => {
                    const media = momentPhotos.get(p.id)!
                    return (
                      <div style={{ marginTop: 10, borderRadius: 10, overflow: 'hidden', aspectRatio: '4/5', background: '#000', maxWidth: 400 }}>
                        {media.media_type === 'video' ? (
                          <video src={media.url} controls playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        ) : (
                          <img src={media.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        )}
                      </div>
                    )
                  })()}`,
    `                  {momentPhotos.get(p.id) ? (
                    <div style={{ marginTop: 10, borderRadius: 10, overflow: 'hidden', aspectRatio: '4/5', background: '#000', maxWidth: 400 }}>
                      {momentPhotos.get(p.id)!.media_type === 'video' ? (
                        <video src={momentPhotos.get(p.id)!.url} controls playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      ) : (
                        <img src={momentPhotos.get(p.id)!.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      )}
                    </div>
                  ) : null}`
  )

  fs.writeFileSync(path.join(BASE, 'components', 'Feed.tsx'), feed, 'utf8')
  console.log('Feed.tsx: media render pattern simplified')

  console.log('Done. Run: npm run build')
}

main().catch(console.error)
