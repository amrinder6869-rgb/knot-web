const fs = require('fs')
let content = fs.readFileSync('components/Composer.tsx', 'utf8')

// 1. Add photo state near the top moment state block
const oldMomentState = `  const [momentText, setMomentText] = useState('')
  const [posting, setPosting]       = useState(false)`

const newMomentState = `  const [momentText, setMomentText] = useState('')
  const [posting, setPosting]       = useState(false)
  const [momentPhoto, setMomentPhoto]               = useState<File | null>(null)
  const [momentPhotoPreview, setMomentPhotoPreview] = useState<string | null>(null)
  const momentPhotoInputRef = useRef<HTMLInputElement>(null)`

if (!content.includes(oldMomentState)) {
  console.log('ERROR: moment state block not found')
  process.exit(1)
}
content = content.replace(oldMomentState, newMomentState)

// 2. Add useRef to imports if not present
if (!content.includes("import { useState, useRef }")) {
  content = content.replace(
    "import { useState } from 'react'",
    "import { useState, useRef } from 'react'"
  )
}

// 3. Rewrite postMoment to support photo upload
const oldPostMoment = `  async function postMoment() {
    if (!momentText.trim() || posting) return
    setPosting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setPosting(false); return }
    await supabase.from('posts').insert({
      knot_id: knotId,
      author_id: user.id,
      content: momentText.trim(),
      post_type: 'moment',
    })
    const actorName = currentUser?.name || 'Someone'
    await notifyKnotMembers({
      knotId,
      actorId: user.id,
      type: 'new_post',
      message: \`\${actorName} posted: "\${momentText.trim().substring(0, 60)}"\`,
    })
    setPosting(false)
    reset()
    onPosted()
  }`

const newPostMoment = `  function handleMomentPhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setMomentPhoto(file)
    setMomentPhotoPreview(URL.createObjectURL(file))
  }

  async function postMoment() {
    if ((!momentText.trim() && !momentPhoto) || posting) return
    setPosting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setPosting(false); return }

    const { data: newPost, error: postError } = await supabase.from('posts').insert({
      knot_id: knotId,
      author_id: user.id,
      content: momentText.trim() || null,
      post_type: 'moment',
    }).select().single()

    if (postError || !newPost) { setPosting(false); return }

    if (momentPhoto) {
      const ext = momentPhoto.name.split('.').pop()
      const path = \`\${knotId}/\${user.id}/\${Date.now()}-\${Math.random().toString(36).substring(7)}.\${ext}\`
      const { error: uploadError } = await supabase.storage.from('knot-photos').upload(path, momentPhoto)
      if (!uploadError) {
        await supabase.from('photos').insert({
          knot_id:      knotId,
          post_id:      newPost.id,
          uploaded_by:  user.id,
          storage_path: path,
          file_name:    momentPhoto.name,
          file_size:    momentPhoto.size,
        })
      }
    }

    const actorName = currentUser?.name || 'Someone'
    await notifyKnotMembers({
      knotId,
      actorId: user.id,
      type: 'new_post',
      message: \`\${actorName} posted\${momentText.trim() ? \`: "\${momentText.trim().substring(0, 60)}"\` : ' a photo'}\`,
    })
    setPosting(false)
    setMomentPhoto(null)
    setMomentPhotoPreview(null)
    reset()
    onPosted()
  }`

if (!content.includes(oldPostMoment)) {
  console.log('ERROR: postMoment function not found')
  process.exit(1)
}
content = content.replace(oldPostMoment, newPostMoment)

// 4. Add photo attach button and preview to the Moment form UI
const oldMomentUI = `      {/* Moment form */}
      {activeType === 'moment' && (
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--yellow)', color: '#111', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {userInitials}
            </div>
            <input value={momentText} onChange={e => setMomentText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && postMoment()}
              placeholder="Share a moment with the group..."
              autoFocus
              style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
            <button onClick={postMoment} disabled={!momentText.trim() || posting}
              style={{ background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: !momentText.trim() || posting ? 0.5 : 1 }}>
              {posting ? '...' : 'Post'}
            </button>
          </div>
        </div>
      )}`

const newMomentUI = `      {/* Moment form */}
      {activeType === 'moment' && (
        <div style={{ padding: 16 }}>
          {momentPhotoPreview && (
            <div style={{ position: 'relative', marginBottom: 10, display: 'inline-block' }}>
              <img src={momentPhotoPreview} alt="" style={{ height: 100, borderRadius: 8, objectFit: 'cover', display: 'block' }} />
              <button onClick={() => { setMomentPhoto(null); setMomentPhotoPreview(null) }}
                style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>
                x
              </button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--yellow)', color: '#111', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {userInitials}
            </div>
            <input value={momentText} onChange={e => setMomentText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && postMoment()}
              placeholder="Share a moment with the group..."
              autoFocus
              style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
            <input type="file" accept="image/*" ref={momentPhotoInputRef} onChange={handleMomentPhotoSelect} style={{ display: 'none' }} />
            <button onClick={() => momentPhotoInputRef.current?.click()}
              style={{ width: 38, height: 38, borderRadius: 8, background: momentPhoto ? 'var(--yellow-soft)' : 'var(--bg3)', border: \`1px solid \${momentPhoto ? 'var(--yellow)' : 'var(--border2)'}\`, color: momentPhoto ? 'var(--yellow)' : 'var(--text3)', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'inherit' }}
              title="Add photo">
              P
            </button>
            <button onClick={postMoment} disabled={(!momentText.trim() && !momentPhoto) || posting}
              style={{ background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: (!momentText.trim() && !momentPhoto) || posting ? 0.5 : 1 }}>
              {posting ? '...' : 'Post'}
            </button>
          </div>
        </div>
      )}`

if (!content.includes(oldMomentUI)) {
  console.log('ERROR: moment UI block not found')
  process.exit(1)
}
content = content.replace(oldMomentUI, newMomentUI)

// 5. Also reset momentPhoto in the reset() function
const oldReset = `    setMomentText('')`
const newReset = `    setMomentText('')
    setMomentPhoto(null)
    setMomentPhotoPreview(null)`

if (content.includes(oldReset)) {
  content = content.replace(oldReset, newReset)
}

fs.writeFileSync('components/Composer.tsx', content, 'utf8')
console.log('Done. Moment composer now supports photo attachment.')
