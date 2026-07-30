const https = require('https')
const fs = require('fs')
const path = require('path')

const BASE = 'C:\\Users\\amrin\\Documents\\knot-web'

function fetch(filePath) {
  return new Promise((resolve, reject) => {
    https.get(
      `https://raw.githubusercontent.com/amrinder6869-rgb/knot-web/master/${filePath}`,
      res => {
        let data = ''
        res.on('data', c => data += c)
        res.on('end', () => resolve(data))
      }
    ).on('error', reject)
  })
}

async function main() {
  // ─── COMPOSER.TSX ───────────────────────────────────────────────────────────

  let composer = await fetch('components/Composer.tsx')

  // 1. Add momentVideo/momentVideoPreview state after momentPhoto state declarations
  composer = composer.replace(
    `  const [momentPhoto, setMomentPhoto] = useState<File | null>(null)
  const [momentPhotoPreview, setMomentPhotoPreview] = useState<string | null>(null)`,
    `  const [momentPhoto, setMomentPhoto] = useState<File | null>(null)
  const [momentPhotoPreview, setMomentPhotoPreview] = useState<string | null>(null)
  const [momentMediaType, setMomentMediaType] = useState<'image' | 'video'>('image')`
  )

  // 2. Update handleMomentPhotoSelect to handle video too and enforce 100MB limit
  composer = composer.replace(
    `  function handleMomentPhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setMomentPhoto(file)
    setMomentPhotoPreview(URL.createObjectURL(file))
  }`,
    `  function handleMomentPhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 100 * 1024 * 1024) {
      setMomentError('File is too large. Maximum size is 100 MB.')
      return
    }
    const isVideo = file.type.startsWith('video/')
    setMomentMediaType(isVideo ? 'video' : 'image')
    setMomentPhoto(file)
    setMomentPhotoPreview(URL.createObjectURL(file))
  }`
  )

  // 3. Update postMoment to skip compression for video and write media_type
  composer = composer.replace(
    `    if (momentPhoto) {
      const compressed = await compressImage(momentPhoto)
      const ext = compressed.name.split('.').pop()
      const path = \`\${knotId}/\${user.id}/\${Date.now()}-\${Math.random().toString(36).substring(7)}.\${ext}\`
      const { error: uploadError } = await supabase.storage.from('knot-photos').upload(path, compressed)
      if (uploadError) {
        setMomentError('Post shared, but the photo failed to upload.')
      } else {
        const { error: photoInsertError } = await supabase.from('photos').insert({
          knot_id:      knotId,
          post_id:      newPost.id,
          uploaded_by:  user.id,
          storage_path: path,
          file_name:    compressed.name,
          file_size:    compressed.size,
        })
        if (photoInsertError) setMomentError('Post shared, but the photo failed to save.')
      }
    }`,
    `    if (momentPhoto) {
      const isVideo = momentMediaType === 'video'
      const uploadFile = isVideo ? momentPhoto : await compressImage(momentPhoto)
      const ext = uploadFile.name.split('.').pop()
      const storagePath = \`\${knotId}/\${user.id}/\${Date.now()}-\${Math.random().toString(36).substring(7)}.\${ext}\`
      const { error: uploadError } = await supabase.storage.from('knot-photos').upload(storagePath, uploadFile)
      if (uploadError) {
        setMomentError('Post shared, but the media failed to upload.')
      } else {
        const { error: photoInsertError } = await supabase.from('photos').insert({
          knot_id:      knotId,
          post_id:      newPost.id,
          uploaded_by:  user.id,
          storage_path: storagePath,
          file_name:    uploadFile.name,
          file_size:    uploadFile.size,
          media_type:   momentMediaType,
        })
        if (photoInsertError) setMomentError('Post shared, but the media failed to save.')
      }
    }`
  )

  // 4. Clear momentMediaType on reset
  composer = composer.replace(
    `    setMomentPhoto(null)
    setMomentPhotoPreview(null)
    reset()
    onPosted()`,
    `    setMomentPhoto(null)
    setMomentPhotoPreview(null)
    setMomentMediaType('image')
    reset()
    onPosted()`
  )

  // 5. File input: accept image and video
  composer = composer.replace(
    `<input type="file" accept="image/*" ref={momentPhotoInputRef} onChange={handleMomentPhotoSelect} style={{ display: 'none' }} />`,
    `<input type="file" accept="image/*,video/*" ref={momentPhotoInputRef} onChange={handleMomentPhotoSelect} style={{ display: 'none' }} />`
  )

  // 6. Preview in composer: show video element if video, img if image
  //    The current preview is a simple img in the moment section — find it
  composer = composer.replace(
    `{momentPhotoPreview && (
              <div style={{ position: 'relative', marginBottom: 8, display: 'inline-block' }}>
                <img src={momentPhotoPreview} alt="" style={{ maxWidth: '100%', borderRadius: 10, objectFit: 'cover', display: 'block' }} />
                <button onClick={() => { setMomentPhoto(null); setMomentPhotoPreview(null); if (momentPhotoInputRef.current) momentPhotoInputRef.current.value = '' }}`,
    `{momentPhotoPreview && (
              <div style={{ position: 'relative', marginBottom: 8, display: 'inline-block', width: '100%' }}>
                {momentMediaType === 'video' ? (
                  <video src={momentPhotoPreview} controls style={{ width: '100%', aspectRatio: '4/5', borderRadius: 10, objectFit: 'cover', display: 'block', background: '#000' }} />
                ) : (
                  <img src={momentPhotoPreview} alt="" style={{ width: '100%', aspectRatio: '4/5', borderRadius: 10, objectFit: 'cover', display: 'block' }} />
                )}
                <button onClick={() => { setMomentPhoto(null); setMomentPhotoPreview(null); setMomentMediaType('image'); if (momentPhotoInputRef.current) momentPhotoInputRef.current.value = '' }}`
  )

  // Close the extra div we opened — find the closing of the preview block to add closing tag
  // The original has one </div> after the remove button — we need one more for the conditional wrapper
  // We do this by replacing the specific close sequence
  composer = composer.replace(
    `                  style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>
                  ×
                </button>
              </div>
            )}`,
    `                  style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>
                  ×
                </button>
              </div>
            )}`
  )

  // 7. Camera button label: "Photo / Video" tooltip
  composer = composer.replace(
    `title="Add photo">`,
    `title="Add photo or video">`
  )

  fs.writeFileSync(path.join(BASE, 'components', 'Composer.tsx'), composer, 'utf8')
  console.log('Composer.tsx updated')

  // ─── FEED.TSX ───────────────────────────────────────────────────────────────

  let feed = await fetch('components/Feed.tsx')

  // 1. Extend MomentPhoto type to include media_type
  feed = feed.replace(
    `interface MomentPhoto { id: string; storage_path: string; url: string }`,
    `interface MomentPhoto { id: string; storage_path: string; url: string; media_type: string }`
  )

  // If the interface is inline (no separate declaration), patch the type inline in the map
  // Also patch the photoMap.set line to include media_type
  feed = feed.replace(
    `        photoMap.set(p.post_id, { id: p.id, storage_path: p.storage_path, url: signedUrl ?? '' })`,
    `        photoMap.set(p.post_id, { id: p.id, storage_path: p.storage_path, url: signedUrl ?? '', media_type: p.media_type ?? 'image' })`
  )

  // 2. Fetch media_type from photos table
  feed = feed.replace(
    `.from('photos')`,
    `.from('photos').select('id, post_id, storage_path, media_type')`
  )
  // The above may replace multiple occurrences — be surgical
  // Undo that and do a targeted replacement on the batch-load query
  feed = feed.replace(
    `.from('photos').select('id, post_id, storage_path, media_type')
        .select('id, post_id, storage_path, media_type')`,
    `.from('photos')
        .select('id, post_id, storage_path, media_type')`
  )

  // More surgical approach: find the specific photos query in batch load
  // The batch load section selects from photos with .in('post_id', ...)
  feed = feed.replace(
    `      const { data: postPhotos } = await supabase
        .from('photos')
        .select('*')
        .in('post_id', postIds)`,
    `      const { data: postPhotos } = await supabase
        .from('photos')
        .select('id, post_id, storage_path, media_type')
        .in('post_id', postIds)`
  )

  // 3. Feed render: 4:5 aspect ratio on photo display, video support
  //    Replace the img in the feed post view
  feed = feed.replace(
    `                  {momentPhotos.get(p.id) && (
                    <div style={{ marginTop: 10 }}>
                      <img src={momentPhotos.get(p.id)!.url} alt="" style={{ maxWidth: '100%', maxHeight: 360, borderRadius: 10, objectFit: 'cover', display: 'block' }} />
                    </div>
                  )}`,
    `                  {momentPhotos.get(p.id) && (() => {
                    const media = momentPhotos.get(p.id)!
                    return (
                      <div style={{ marginTop: 10, borderRadius: 10, overflow: 'hidden', aspectRatio: '4/5', background: '#000' }}>
                        {media.media_type === 'video' ? (
                          <video src={media.url} controls playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        ) : (
                          <img src={media.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        )}
                      </div>
                    )
                  })()}`
  )

  // 4. Edit mode photo preview: also 4:5
  feed = feed.replace(
    `<img src={editPhotoPreview} alt="" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 10, objectFit: 'cover', display: 'block' }} />`,
    `<img src={editPhotoPreview} alt="" style={{ width: '100%', aspectRatio: '4/5', borderRadius: 10, objectFit: 'cover', display: 'block' }} />`
  )
  feed = feed.replace(
    `<img src={momentPhotos.get(p.id)!.url} alt="" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 10, objectFit: 'cover', display: 'block' }} />`,
    `<img src={momentPhotos.get(p.id)!.url} alt="" style={{ width: '100%', aspectRatio: '4/5', borderRadius: 10, objectFit: 'cover', display: 'block' }} />`
  )

  fs.writeFileSync(path.join(BASE, 'components', 'Feed.tsx'), feed, 'utf8')
  console.log('Feed.tsx updated')

  console.log('Done. Run: npm run build')
}

main().catch(console.error)
