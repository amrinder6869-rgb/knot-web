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
  let src = await fetch('components/Composer.tsx')

  // 1. Add momentMediaType state after momentPhotoPreview
  src = src.replace(
    `  const [momentPhotoPreview, setMomentPhotoPreview] = useState<string | null>(null)`,
    `  const [momentPhotoPreview, setMomentPhotoPreview] = useState<string | null>(null)
  const [momentMediaType, setMomentMediaType] = useState<'image' | 'video'>('image')`
  )

  // 2. Replace handleMomentPhotoSelect with video-aware version
  src = src.replace(
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

  // 3. Replace the upload block in postMoment to handle video (skip compression)
  src = src.replace(
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

  // 4. Clear momentMediaType on reset after post
  src = src.replace(
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
  src = src.replace(
    `<input type="file" accept="image/*" ref={momentPhotoInputRef} onChange={handleMomentPhotoSelect} style={{ display: 'none' }} />`,
    `<input type="file" accept="image/*,video/*" ref={momentPhotoInputRef} onChange={handleMomentPhotoSelect} style={{ display: 'none' }} />`
  )

  // 6. Preview: video element or img, 4:5 aspect ratio
  src = src.replace(
    `          {momentPhotoPreview && (
            <div style={{ position: 'relative', marginBottom: 10, display: 'inline-block' }}>
              <img src={momentPhotoPreview} alt="" style={{ height: 100, borderRadius: 8, objectFit: 'cover', display: 'block' }} />
              <button onClick={() => { setMomentPhoto(null); setMomentPhotoPreview(null) }}
                style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>
                x
              </button>
            </div>
          )}`,
    `          {momentPhotoPreview && (
            <div style={{ position: 'relative', marginBottom: 10, borderRadius: 10, overflow: 'hidden', aspectRatio: '4/5', background: '#000', maxWidth: 320 }}>
              {momentMediaType === 'video' ? (
                <video src={momentPhotoPreview} controls style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : (
                <img src={momentPhotoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              )}
              <button onClick={() => { setMomentPhoto(null); setMomentPhotoPreview(null); setMomentMediaType('image'); if (momentPhotoInputRef.current) momentPhotoInputRef.current.value = '' }}
                style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>
                x
              </button>
            </div>
          )}`
  )

  // 7. Button tooltip
  src = src.replace(
    `title="Add photo">`,
    `title="Add photo or video">`
  )

  fs.writeFileSync(path.join(BASE, 'components', 'Composer.tsx'), src, 'utf8')
  console.log('Composer.tsx rewritten. Run: npm run build')
}

main().catch(console.error)
