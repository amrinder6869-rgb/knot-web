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
  let src = await fetchGH('components/Feed.tsx')

  // 1. Extend MomentPhoto type
  src = src.replace(
    `type MomentPhoto = { id: string; storage_path: string; url: string }`,
    `type MomentPhoto = { id: string; storage_path: string; url: string; media_type: string }`
  )

  // 2. Select media_type from photos query
  src = src.replace(
    `.select('id, post_id, storage_path')`,
    `.select('id, post_id, storage_path, media_type')`
  )

  // 3. Include media_type in photoMap.set
  src = src.replace(
    `photoMap.set(p.post_id, { id: p.id, storage_path: p.storage_path, url: signedUrl ?? '' })`,
    `photoMap.set(p.post_id, { id: p.id, storage_path: p.storage_path, url: signedUrl ?? '', media_type: p.media_type ?? 'image' })`
  )

  // 4. Feed render: 4:5 aspect ratio with video support
  src = src.replace(
    `                  {momentPhotos.get(p.id) && (
                    <div style={{ marginTop: 10 }}>
                      <img src={momentPhotos.get(p.id)!.url} alt="" style={{ maxWidth: '100%', maxHeight: 360, borderRadius: 10, objectFit: 'cover', display: 'block' }} />
                    </div>
                  )}`,
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
                  })()}`
  )

  // 5. Edit mode preview: 4:5 on existing photo
  src = src.replace(
    `<img src={momentPhotos.get(p.id)!.url} alt="" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 10, objectFit: 'cover', display: 'block' }} />`,
    `<img src={momentPhotos.get(p.id)!.url} alt="" style={{ width: '100%', aspectRatio: '4/5', borderRadius: 10, objectFit: 'cover', display: 'block' }} />`
  )

  // 6. Edit mode preview: 4:5 on new photo selection
  src = src.replace(
    `<img src={editPhotoPreview} alt="" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 10, objectFit: 'cover', display: 'block' }} />`,
    `<img src={editPhotoPreview} alt="" style={{ width: '100%', aspectRatio: '4/5', borderRadius: 10, objectFit: 'cover', display: 'block' }} />`
  )

  fs.writeFileSync(path.join(BASE, 'components', 'Feed.tsx'), src, 'utf8')
  console.log('Feed.tsx rewritten. Run: npm run build')
}

main().catch(console.error)
