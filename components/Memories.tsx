'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
const MAX_FILES     = 20
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'])
const ALLOWED_EXTS  = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'])

export default function Memories({ members: _members, knotId }: { members: any[], knotId?: string }) {
  const [photos, setPhotos]         = useState<any[]>([])
  const [hangouts, setHangouts]     = useState<any[]>([])
  const [stats, setStats]           = useState({ hangs: 0, photos: 0, members: 0 })
  const [loading, setLoading]       = useState(true)
  const [uploading, setUploading]   = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedHangout, setSelectedHangout] = useState<string|null>(null)
  const [viewPhoto, setViewPhoto]   = useState<any|null>(null)
  const [uploadError, setUploadError] = useState('')
  const [user, setUser]             = useState<any>(null)
  const fileInputRef                = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) setUser(data.user) })
    if (knotId) loadMemories()
  }, [knotId])

  async function loadMemories() {
    if (!knotId) return

    const [{ count: hangCount }, { count: photoCount }, { count: memberCount }] = await Promise.all([
      supabase.from('hangouts').select('*', { count: 'exact', head: true }).eq('knot_id', knotId),
      supabase.from('photos').select('*', { count: 'exact', head: true }).eq('knot_id', knotId),
      supabase.from('knot_members').select('*', { count: 'exact', head: true }).eq('knot_id', knotId),
    ])

    setStats({ hangs: hangCount || 0, photos: photoCount || 0, members: memberCount || 0 })

    const { data: hangoutData } = await supabase
      .from('hangouts')
      .select('*')
      .eq('knot_id', knotId)
      .order('created_at', { ascending: false })

    if (hangoutData) setHangouts(hangoutData)

    const { data: photoData } = await supabase
      .from('photos')
      .select('*, profiles:uploaded_by(name)')
      .eq('knot_id', knotId)
      .order('created_at', { ascending: false })

    if (photoData) {
      const withUrls = await Promise.all(photoData.map(async (p: any) => {
        const { data: { publicUrl } } = supabase.storage.from('knot-photos').getPublicUrl(p.storage_path)
        return { ...p, url: publicUrl }
      }))
      setPhotos(withUrls)
    }

    setLoading(false)
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (!files.length || !knotId || !user) return

    // Cap batch size
    if (files.length > MAX_FILES) {
      setUploadError(`You can upload at most ${MAX_FILES} photos at once.`)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    // Validate type and size for every file
    const invalid = files.filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase() || ''
      return !ALLOWED_TYPES.has(f.type) || !ALLOWED_EXTS.has(ext)
    })
    if (invalid.length > 0) {
      setUploadError(`Only JPEG, PNG, GIF, WebP, and HEIC images are allowed.`)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    const oversized = files.filter(f => f.size > MAX_FILE_SIZE)
    if (oversized.length > 0) {
      setUploadError(`${oversized.length} file(s) exceed the 5 MB limit.`)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setUploadError('')
    setUploading(true)
    setUploadProgress(0)

    let uploaded = 0
    for (const file of files) {
      const ext  = (file.name.split('.').pop() || 'jpg').toLowerCase()
      // Use a safe, deterministic content type from the extension, not client-supplied
      const safeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
        : ext === 'png'  ? 'image/png'
        : ext === 'gif'  ? 'image/gif'
        : ext === 'webp' ? 'image/webp'
        : 'image/jpeg'
      const path = `${knotId}/${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('knot-photos')
        .upload(path, file, { contentType: safeType })

      if (uploadError) { continue }

      await supabase.from('photos').insert({
        knot_id:      knotId,
        hangout_id:   selectedHangout || null,
        uploaded_by:  user.id,
        storage_path: path,
        file_name:    file.name,
        file_size:    file.size,
      })

      uploaded++
      setUploadProgress(Math.round(uploaded / files.length * 100))
    }

    if (uploaded > 0) {
      await supabase.from('posts').insert({
        knot_id:   knotId,
        author_id: user.id,
        content:   `added ${uploaded} photo${uploaded > 1 ? 's' : ''} to memories`,
        post_type: 'moment'
      })
    }

    setUploading(false)
    setUploadProgress(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
    await loadMemories()
  }

  async function deletePhoto(photo: any) {
    if (!user) return
    // Only the uploader can delete â€” enforce in both the query and the UI
    if (photo.uploaded_by !== user.id) return
    if (!confirm('Delete this photo?')) return
    await supabase.storage.from('knot-photos').remove([photo.storage_path])
    await supabase.from('photos').delete().eq('id', photo.id).eq('uploaded_by', user.id)
    await loadMemories()
  }

  const ungrouped = photos.filter(p => !p.hangout_id)
  const byHangout = hangouts.map(h => ({
    ...h,
    photos: photos.filter(p => p.hangout_id === h.id)
  })).filter(h => h.photos.length > 0)

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })

  if (loading) return <div style={{ color: 'var(--text2)', fontSize: 13, padding: '20px 0' }}>Loading...</div>

  return (
    <div style={{ maxWidth: 800 }}>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--rust)', borderRadius: 12, padding: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--rust)' }}>{stats.hangs}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>Hangs together</div>
        </div>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--olive)', borderRadius: 12, padding: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--olive)' }}>{stats.photos}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>Photos saved</div>
        </div>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{stats.members}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>Members</div>
        </div>
      </div>

      {/* Upload */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: selectedHangout !== undefined ? 10 : 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Add photos</div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>Max 5MB per photo Â· stays private to this Knot forever</div>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleUpload}
            style={{ display: 'none' }} id="photo-upload" />
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            style={{ padding: '8px 16px', background: 'var(--rust)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: uploading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: uploading ? 0.7 : 1, whiteSpace: 'nowrap' }}>
            {uploading ? `Uploading ${uploadProgress}%` : 'Add photos'}
          </button>
        </div>

        {hangouts.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Link to a hangout (optional)</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <div onClick={() => setSelectedHangout(null)}
                style={{ padding: '4px 10px', borderRadius: 20, border: `1px solid ${!selectedHangout ? 'var(--rust)' : 'var(--border2)'}`, background: !selectedHangout ? 'var(--rust-soft)' : 'transparent', fontSize: 12, cursor: 'pointer', color: !selectedHangout ? 'var(--rust)' : 'var(--text2)' }}>
                General
              </div>
              {hangouts.slice(0, 5).map(h => (
                <div key={h.id} onClick={() => setSelectedHangout(h.id)}
                  style={{ padding: '4px 10px', borderRadius: 20, border: `1px solid ${selectedHangout === h.id ? 'var(--rust)' : 'var(--border2)'}`, background: selectedHangout === h.id ? 'var(--rust-soft)' : 'transparent', fontSize: 12, cursor: 'pointer', color: selectedHangout === h.id ? 'var(--rust)' : 'var(--text2)' }}>
                  {h.title || 'Hangout'} Â· {formatDate(h.created_at)}
                </div>
              ))}
            </div>
          </div>
        )}

        {uploadError && (
          <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--rust-soft)', border: '1px solid var(--rust-dim)', borderRadius: 8, fontSize: 12, color: 'var(--rust)' }}>
            {uploadError}
          </div>
        )}

        {uploading && (
          <div style={{ marginTop: 10 }}>
            <div style={{ height: 4, background: 'var(--bg4)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'var(--rust)', width: `${uploadProgress}%`, transition: 'width 0.3s', borderRadius: 2 }} />
            </div>
          </div>
        )}
      </div>

      {/* Privacy note */}
      <div style={{ padding: '10px 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, color: 'var(--text3)', marginBottom: 20 }}>
        Photos are permanently private to this Knot. No sharing outside, no public access, ever.
      </div>

      {/* Photo viewer modal */}
      {viewPhoto && (
        <div onClick={() => setViewPhoto(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: 800, width: '100%', position: 'relative' }}>
            <img src={viewPhoto.url} alt="" style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: 12 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
                Added by {viewPhoto.profiles?.name || 'someone'} Â· {formatDate(viewPhoto.created_at)}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {viewPhoto.uploaded_by === user?.id && (
                  <button onClick={() => { deletePhoto(viewPhoto); setViewPhoto(null) }}
                    style={{ padding: '6px 14px', background: 'var(--rust-soft)', border: '1px solid var(--rust-dim)', borderRadius: 8, color: 'var(--rust)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Delete
                  </button>
                )}
                <button onClick={() => setViewPhoto(null)}
                  style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No photos */}
      {photos.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text2)' }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>No photos yet</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>Add your first photo from a night out.</div>
          <button onClick={() => fileInputRef.current?.click()}
            style={{ padding: '10px 20px', background: 'var(--rust)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Add photos
          </button>
        </div>
      )}

      {/* Photos by hangout */}
      {byHangout.map(h => (
        <div key={h.id} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            {h.title || 'Hangout'}
            <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 400 }}>Â· {formatDate(h.created_at)} Â· {h.photos.length} photo{h.photos.length !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {h.photos.map((p: any) => (
              <div key={p.id} onClick={() => setViewPhoto(p)}
                style={{ aspectRatio: '1', borderRadius: 10, overflow: 'hidden', cursor: 'pointer', background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Ungrouped */}
      {ungrouped.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: 'var(--text2)' }}>
            General Â· {ungrouped.length} photo{ungrouped.length !== 1 ? 's' : ''}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {ungrouped.map((p: any) => (
              <div key={p.id} onClick={() => setViewPhoto(p)}
                style={{ aspectRatio: '1', borderRadius: 10, overflow: 'hidden', cursor: 'pointer', background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
