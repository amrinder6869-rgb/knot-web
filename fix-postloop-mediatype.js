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
  let src = await fetchGH('components/PostHangoutLoop.tsx')

  // 1. Extend state type
  src = src.replace(
    `  const [hangoutPhotos, setHangoutPhotos] = useState<{ id: string; url: string }[]>([])`,
    `  const [hangoutPhotos, setHangoutPhotos] = useState<{ id: string; url: string; media_type: string }[]>([])`
  )

  // 2. Select media_type in query
  src = src.replace(
    `.select('id, storage_path')`,
    `.select('id, storage_path, media_type')`
  )

  // 3. Include media_type in the map return
  src = src.replace(
    `          return { id: p.id, url: url ?? '' }`,
    `          return { id: p.id, url: url ?? '', media_type: p.media_type ?? 'image' }`
  )

  // 4. Grid: render video or img based on media_type
  src = src.replace(
    `            {hangoutPhotos.map(p => (
              <div key={p.id} style={{ aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: 'var(--bg3)' }}>
                <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}`,
    `            {hangoutPhotos.map(p => (
              <div key={p.id} style={{ aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: '#000', position: 'relative' }}>
                {p.media_type === 'video' ? (
                  <video src={p.url} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
              </div>
            ))}`
  )

  // 5. handlePhotoUpload: skip compression for video, write media_type, 100MB guard
  src = src.replace(
    `  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !currentUserId) return
    setPhotoUploading(true)
    setPhotoError('')

    try {
      const compressed = await compressImage(file)
      const ext = compressed.name.split('.').pop()
      const storagePath = \`memories/\${knotId}/\${hangout.id}/\${Date.now()}.\${ext}\`

      const { error: uploadError } = await supabase.storage
        .from('knot-photos')
        .upload(storagePath, compressed)

      if (uploadError) { setPhotoError('Upload failed. Try again.'); setPhotoUploading(false); return }

      await supabase.from('photos').insert({
        knot_id: knotId,
        hangout_id: hangout.id,
        uploaded_by: currentUserId,
        storage_path: storagePath,
        caption: \`From \${hangout.venue_name || hangout.title}\`,
      })`,
    `  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !currentUserId) return
    if (file.size > 100 * 1024 * 1024) { setPhotoError('File is too large. Maximum size is 100 MB.'); return }
    setPhotoUploading(true)
    setPhotoError('')

    try {
      const isVideo = file.type.startsWith('video/')
      const uploadFile = isVideo ? file : await compressImage(file)
      const ext = uploadFile.name.split('.').pop()
      const storagePath = \`memories/\${knotId}/\${hangout.id}/\${Date.now()}.\${ext}\`

      const { error: uploadError } = await supabase.storage
        .from('knot-photos')
        .upload(storagePath, uploadFile)

      if (uploadError) { setPhotoError('Upload failed. Try again.'); setPhotoUploading(false); return }

      await supabase.from('photos').insert({
        knot_id: knotId,
        hangout_id: hangout.id,
        uploaded_by: currentUserId,
        storage_path: storagePath,
        media_type: isVideo ? 'video' : 'image',
        caption: \`From \${hangout.venue_name || hangout.title}\`,
      })`
  )

  // 6. Upload button: accept video
  src = src.replace(
    `            {photoUploading ? 'Uploading...' : 'Upload photo'}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} disabled={photoUploading} />`,
    `            {photoUploading ? 'Uploading...' : 'Upload photo or video'}
            <input type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handlePhotoUpload} disabled={photoUploading} />`
  )

  // 7. Section and prompt labels
  src = src.replace(
    `            Photos from this hangout`,
    `            Media from this hangout`
  )
  src = src.replace(
    `<div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8 }}>Add a photo to Memories</div>`,
    `<div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8 }}>Add a photo or video to Memories</div>`
  )
  src = src.replace(
    `<span style={{ fontSize: 13, color: 'var(--text2)' }}>Photo added to Memories</span>`,
    `<span style={{ fontSize: 13, color: 'var(--text2)' }}>Added to Memories</span>`
  )

  fs.writeFileSync(path.join(BASE, 'components', 'PostHangoutLoop.tsx'), src, 'utf8')
  console.log('PostHangoutLoop.tsx fixed. Run: npm run build')
}

main().catch(console.error)
