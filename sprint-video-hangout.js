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

  // ─── HangoutCard.tsx ────────────────────────────────────────────────────────

  let card = await fetchGH('components/HangoutCard.tsx')

  // 1. Update handleLivePhotoUpload: skip compression for video, write media_type, 100MB guard
  card = card.replace(
    `  async function handleLivePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !currentUser) return
    try {
      const compressed = await compressImage(file)
      const ext = compressed.name.split('.').pop()
      const storagePath = \`moments/\${knotId}/\${hangout.id}/\${Date.now()}.\${ext}\`
      const { error: uploadError } = await supabase.storage.from('knot-photos').upload(storagePath, compressed)
      if (uploadError) return
      await supabase.from('photos').insert({ knot_id: knotId, hangout_id: hangout.id, uploaded_by: currentUser.id, storage_path: storagePath, caption: \`Live from \${hangout.venue_name || hangout.title}\` })
      await supabase.from('posts').insert({ knot_id: knotId, hangout_id: hangout.id, author_id: currentUser.id, content: \`Capturing the night at \${hangout.venue_name || hangout.title}\`, post_type: 'moment' })
      setLivePhotoPosted(true)
      onRefresh()
    } catch (err) { console.error('Live photo error:', err) }
  }`,
    `  async function handleLivePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !currentUser) return
    if (file.size > 100 * 1024 * 1024) return
    try {
      const isVideo = file.type.startsWith('video/')
      const uploadFile = isVideo ? file : await compressImage(file)
      const ext = uploadFile.name.split('.').pop()
      const storagePath = \`moments/\${knotId}/\${hangout.id}/\${Date.now()}.\${ext}\`
      const { error: uploadError } = await supabase.storage.from('knot-photos').upload(storagePath, uploadFile)
      if (uploadError) return
      await supabase.from('photos').insert({ knot_id: knotId, hangout_id: hangout.id, uploaded_by: currentUser.id, storage_path: storagePath, media_type: isVideo ? 'video' : 'image', caption: \`Live from \${hangout.venue_name || hangout.title}\` })
      await supabase.from('posts').insert({ knot_id: knotId, hangout_id: hangout.id, author_id: currentUser.id, content: \`Capturing the night at \${hangout.venue_name || hangout.title}\`, post_type: 'moment' })
      setLivePhotoPosted(true)
      onRefresh()
    } catch (err) { console.error('Live media error:', err) }
  }`
  )

  // 2. Live capture UI: accept video too, update label
  card = card.replace(
    `            Add photo
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLivePhotoUpload} />`,
    `            Add photo / video
            <input type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleLivePhotoUpload} />`
  )

  // 3. Confirmed text after upload
  card = card.replace(
    `<span style={{ fontSize: 13, color: '#4ade80' }}>Photo added to Memories</span>`,
    `<span style={{ fontSize: 13, color: '#4ade80' }}>Added to Memories</span>`
  )

  fs.writeFileSync(path.join(BASE, 'components', 'HangoutCard.tsx'), card, 'utf8')
  console.log('HangoutCard.tsx updated')

  // ─── PostHangoutLoop.tsx ─────────────────────────────────────────────────────

  let loop = await fetchGH('components/PostHangoutLoop.tsx')

  // 1. Extend photo state type to include media_type
  loop = loop.replace(
    `  const [hangoutPhotos, setHangoutPhotos] = useState<{ id: string; url: string }[]>([])`,
    `  const [hangoutPhotos, setHangoutPhotos] = useState<{ id: string; url: string; media_type: string }[]>([])`
  )

  // 2. Select media_type in fetchPhotos query
  loop = loop.replace(
    `.select('id, storage_path')`,
    `.select('id, storage_path, media_type')`
  )

  // 3. Include media_type when building withUrls array
  loop = loop.replace(
    `          const url = await getSignedUrl(p.storage_path)`,
    `          const url = await getSignedUrl(p.storage_path)
          const media_type = p.media_type ?? 'image'`
  )
  loop = loop.replace(
    `          if (url) withUrls.push({ id: p.id, url })`,
    `          if (url) withUrls.push({ id: p.id, url, media_type })`
  )

  // 4. handlePhotoUpload: skip compression for video, write media_type, 100MB guard
  loop = loop.replace(
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

  // 5. Grid: render video element for video items, img for photos
  loop = loop.replace(
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

  // 6. Upload button: accept video, update labels
  loop = loop.replace(
    `            {photoUploading ? 'Uploading...' : 'Upload photo'}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} disabled={photoUploading} />`,
    `            {photoUploading ? 'Uploading...' : 'Upload photo or video'}
            <input type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handlePhotoUpload} disabled={photoUploading} />`
  )

  // 7. Section label
  loop = loop.replace(
    `            Photos from this hangout`,
    `            Media from this hangout`
  )

  // 8. Success message
  loop = loop.replace(
    `<span style={{ fontSize: 13, color: 'var(--text2)' }}>Photo added to Memories</span>`,
    `<span style={{ fontSize: 13, color: 'var(--text2)' }}>Added to Memories</span>`
  )

  // 9. Add a photo label
  loop = loop.replace(
    `<div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8 }}>Add a photo to Memories</div>`,
    `<div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8 }}>Add a photo or video to Memories</div>`
  )

  fs.writeFileSync(path.join(BASE, 'components', 'PostHangoutLoop.tsx'), loop, 'utf8')
  console.log('PostHangoutLoop.tsx updated')

  // ─── Memories.tsx ────────────────────────────────────────────────────────────

  let mem = await fetchGH('components/Memories.tsx')

  // Memories already selects '*, profiles:uploaded_by(name)' so media_type comes through
  // Just update the grid img tags to conditionally render video

  // Grid render — there are two img tags in the grid (lines ~591 and ~612)
  // Both are inside a div with aspectRatio: '1'
  // Replace both occurrences
  mem = mem.split(
    `<img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />`
  ).join(
    `{p.media_type === 'video' ? (
                  <video src={p.url} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}`
  )

  // Lightbox full view — also support video
  mem = mem.replace(
    `<img src={viewPhoto.url} alt="" style={{ width: '100%', maxHeight: '55vh', objectFit: 'contain', background: '#000', display: 'block' }} />`,
    `{viewPhoto.media_type === 'video' ? (
                <video src={viewPhoto.url} controls playsInline style={{ width: '100%', maxHeight: '55vh', objectFit: 'contain', background: '#000', display: 'block' }} />
              ) : (
                <img src={viewPhoto.url} alt="" style={{ width: '100%', maxHeight: '55vh', objectFit: 'contain', background: '#000', display: 'block' }} />
              )}`
  )

  fs.writeFileSync(path.join(BASE, 'components', 'Memories.tsx'), mem, 'utf8')
  console.log('Memories.tsx updated')

  console.log('All done. Run: npm run build')
}

main().catch(console.error)
