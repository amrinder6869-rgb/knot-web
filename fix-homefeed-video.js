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
  let src = await fetchGH('components/HomeFeed.tsx')

  // 1. Select media_type in photos query
  src = src.replace(
    `.select('*, profiles:uploaded_by(name), knots:knot_id(id, name, emoji)')`,
    `.select('id, storage_path, media_type, caption, created_at, post_id, hangout_id, knot_id, uploaded_by, profiles:uploaded_by(name), knots:knot_id(id, name, emoji)')`
  )

  // 2. Include media_type in photosWithUrls map
  src = src.replace(
    `      return { ...p, url: signedUrl ?? '' }`,
    `      return { ...p, url: signedUrl ?? '', media_type: p.media_type ?? 'image' }`
  )

  // 3. Single photo: render video or img
  src = src.replace(
    `                {item.photos.length === 1 ? (
                  <div style={{ width: '100%', aspectRatio: '16/9', overflow: 'hidden' }}>
                    <img src={item.photos[0].url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </div>`,
    `                {item.photos.length === 1 ? (
                  <div style={{ width: '100%', aspectRatio: item.photos[0].media_type === 'video' ? '16/9' : '4/5', overflow: 'hidden', background: '#000' }}>
                    {item.photos[0].media_type === 'video' ? (
                      <video src={item.photos[0].url} controls playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    ) : (
                      <img src={item.photos[0].url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    )}
                  </div>`
  )

  // 4. Two photos grid: render video or img per item
  src = src.replace(
    `                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, aspectRatio: '16/9' }}>
                    {item.photos.slice(0, 2).map((p: any) => (
                      <img key={p.id} src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    ))}
                  </div>`,
    `                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, aspectRatio: '16/9' }}>
                    {item.photos.slice(0, 2).map((p: any) => (
                      p.media_type === 'video'
                        ? <video key={p.id} src={p.url} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        : <img key={p.id} src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    ))}
                  </div>`
  )

  fs.writeFileSync(path.join(BASE, 'components', 'HomeFeed.tsx'), src, 'utf8')
  console.log('HomeFeed.tsx updated. Run: npm run build')
}

main().catch(console.error)
