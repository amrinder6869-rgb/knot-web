'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const MAX_FILES     = 20
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'])
const ALLOWED_EXTS  = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'])

export default function Memories({ members: _members, knotId }: { members: any[], knotId?: string }) {
  const [photos, setPhotos]                 = useState<any[]>([])
  const [hangouts, setHangouts]             = useState<any[]>([])
  const [stats, setStats]                   = useState({ hangs: 0, photos: 0, members: 0 })
  const [loading, setLoading]               = useState(true)
  const [uploading, setUploading]           = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedHangout, setSelectedHangout] = useState<string|null>(null)
  const [uploadCaption, setUploadCaption]   = useState('')
  const [viewPhoto, setViewPhoto]           = useState<any|null>(null)
  const [uploadError, setUploadError]       = useState('')
  const [user, setUser]                     = useState<any>(null)
  const [comments, setComments]             = useState<any[]>([])
  const [newComment, setNewComment]         = useState('')
  const [postingComment, setPostingComment] = useState(false)
  const [editingCaption, setEditingCaption] = useState(false)
  const [captionDraft, setCaptionDraft]     = useState('')
  const fileInputRef                        = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) setUser(data.user) })
    if (knotId) loadMemories()
  }, [knotId])

  useEffect(() => {
    if (viewPhoto) {
      loadComments(viewPhoto.id)
      setCaptionDraft(viewPhoto.caption || '')
      setEditingCaption(false)
      setNewComment('')
    }
  }, [viewPhoto?.id])

  async function loadMemories() {
    if (!knotId) return

    const [{ count: hangCount }, { count: photoCount }, { count: memberCount }] = await Promise.all([
      supabase.from('hangouts').select('*', { count: 'exact', head: true }).eq('knot_id', knotId),
      supabase.from('photos').select('*', { count: 'exact', head: true }).eq('knot_id', knotId),
      supabase.from('knot_members').select('*', { count: 'exact', head: true }).eq('knot_id', knotId),
    ])

    setStats({ hangs: hangCount || 0, photos: photoCount || 0, members: memberCount || 0 })

    const { data: hangoutData } = await supabase
      .from('hangouts').select('*').eq('knot_id', knotId).order('created_at', { ascending: false })
    if (hangoutData) setHangouts(hangoutData)

    const { data: photoData } = await supabase
      .from('photos')
      .select('*, profiles:uploaded_by(name)')
      .eq('knot_id', knotId)
      .order('created_at', { ascending: false })

    const { data: knotPosts } = await supabase
      .from('posts')
      .select('id')
      .eq('knot_id', knotId)

    const postIds = (knotPosts || []).map((p) => p.id)
    let commentPhotos: any[] = []
    if (postIds.length > 0) {
      const { data: commentPhotoData, error: commentPhotoError } = await supabase
        .from('comments')
        .select('id, photo_path, created_at, author_id, profiles:author_id(name)')
        .in('post_id', postIds)
        .not('photo_path', 'is', null)

      if (commentPhotoError) console.error('Comment photo fetch error:', JSON.stringify(commentPhotoError))

      commentPhotos = (commentPhotoData || []).map((c) => ({
        id: 'comment-' + c.id,
        storage_path: c.photo_path,
        uploaded_by: c.author_id,
        profiles: c.profiles,
        created_at: c.created_at,
        caption: null,
        hangout_id: null,
        from_comment: true,
      }))
    }

    const allPhotoRecords = [...(photoData || []), ...commentPhotos]

    if (allPhotoRecords.length > 0) {
      const withUrls = await Promise.all(allPhotoRecords.map(async (p) => {
        const { data: { publicUrl } } = supabase.storage.from('knot-photos').getPublicUrl(p.storage_path)
        return { ...p, url: publicUrl }
      }))
      withUrls.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setPhotos(withUrls)
      setStats(s => ({ ...s, photos: withUrls.length }))
    }

    setLoading(false)
  }

  async function loadComments(photoId: string) {
    const { data } = await supabase
      .from('photo_comments')
      .select('*, profiles:user_id(name)')
      .eq('photo_id', photoId)
      .order('created_at', { ascending: true })
    setComments(data || [])
  }

  async function addComment() {
    if (!newComment.trim() || !user || !viewPhoto || postingComment) return
    setPostingComment(true)
    await supabase.from('photo_comments').insert({
      photo_id: viewPhoto.id,
      knot_id:  knotId,
      user_id:  user.id,
      content:  newComment.trim(),
    })
    setNewComment('')
    await loadComments(viewPhoto.id)
    setPostingComment(false)
  }

  async function deleteComment(commentId: string) {
    await supabase.from('photo_comments').delete().eq('id', commentId).eq('user_id', user.id)
    await loadComments(viewPhoto.id)
  }

  async function saveCaption() {
    if (!viewPhoto || !user) return
    await supabase.from('photos').update({ caption: captionDraft }).eq('id', viewPhoto.id).eq('uploaded_by', user.id)
    setViewPhoto({ ...viewPhoto, caption: captionDraft })
    setPhotos(ps => ps.map(p => p.id === viewPhoto.id ? { ...p, caption: captionDraft } : p))
    setEditingCaption(false)
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (!files.length || !knotId || !user) return

    if (files.length > MAX_FILES) {
      setUploadError(`You can upload at most ${MAX_FILES} photos at once.`)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    const invalid = files.filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase() || ''
      return !ALLOWED_TYPES.has(f.type) || !ALLOWED_EXTS.has(ext)
    })
    if (invalid.length > 0) {
      setUploadError('Only JPEG, PNG, GIF, WebP, and HEIC images are allowed.')
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
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const safeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
        : ext === 'png'  ? 'image/png'
        : ext === 'gif'  ? 'image/gif'
        : ext === 'webp' ? 'image/webp'
        : 'image/jpeg'
      const path = `${knotId}/${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('knot-photos').upload(path, file, { contentType: safeType })
      if (uploadErr) { continue }

      await supabase.from('photos').insert({
        knot_id:      knotId,
        hangout_id:   selectedHangout || null,
        uploaded_by:  user.id,
        storage_path: path,
        file_name:    file.name,
        file_size:    file.size,
        caption:      uploadCaption.trim() || null,
      })

      uploaded++
      setUploadProgress(Math.round(uploaded / files.length * 100))
    }

    if (uploaded > 0) {
      await supabase.from('posts').insert({
        knot_id:   knotId,
        author_id: user.id,
        content:   `added ${uploaded} photo${uploaded > 1 ? 's' : ''} to memories${uploadCaption.trim() ? ` — "${uploadCaption.trim()}"` : ''}`,
        post_type: 'moment',
      })
    }

    setUploading(false)
    setUploadProgress(0)
    setUploadCaption('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    await loadMemories()
  }

  async function deletePhoto(photo: any) {
    if (!user || photo.uploaded_by !== user.id) return
    if (!confirm('Delete this photo?')) return
    await supabase.storage.from('knot-photos').remove([photo.storage_path])
    await supabase.from('photos').delete().eq('id', photo.id).eq('uploaded_by', user.id)
    setViewPhoto(null)
    await loadMemories()
  }

  const ungrouped = photos.filter(p => !p.hangout_id)
  const byHangout = hangouts.map(h => ({
    ...h, photos: photos.filter(p => p.hangout_id === h.id)
  })).filter(h => h.photos.length > 0)

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
  const timeAgo = (d: string) => {
    const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
    if (s < 60) return 'Just now'
    if (s < 3600) return `${Math.floor(s / 60)}m ago`
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`
    return `${Math.floor(s / 86400)}d ago`
  }
  const getInitials = (name: string) => name?.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase() || '?'

  if (loading) return <div style={{ color: 'var(--text2)', fontSize: 13, padding: '20px 0' }}>Loading...</div>

  return (
    <div style={{ maxWidth: 800 }}>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { val: stats.hangs,   label: 'Hangs together', color: 'var(--yellow)',  border: 'var(--yellow)' },
          { val: stats.photos,  label: 'Photos saved',   color: 'var(--olive)',   border: 'var(--olive)'  },
          { val: stats.members, label: 'Members',        color: 'var(--text)',    border: 'var(--border)' },
        ].map(({ val, label, color, border }) => (
          <div key={label} style={{ background: 'var(--bg2)', border: `1px solid ${border}`, borderRadius: 12, padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color }}>{val}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Upload */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Add photos</div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>Max 5MB · stays private to this Knot forever</div>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleUpload}
            style={{ display: 'none' }} id="photo-upload" />
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            style={{ padding: '8px 16px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 600, cursor: uploading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: uploading ? 0.7 : 1, whiteSpace: 'nowrap' }}>
            {uploading ? `Uploading ${uploadProgress}%` : 'Add photos'}
          </button>
        </div>

        {/* Caption input */}
        <input
          value={uploadCaption}
          onChange={e => setUploadCaption(e.target.value)}
          placeholder="Add a caption (optional)..."
          style={{ width: '100%', padding: '8px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: hangouts.length > 0 ? 10 : 0 }}
        />

        {hangouts.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Link to a hangout (optional)</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <div onClick={() => setSelectedHangout(null)}
                style={{ padding: '4px 10px', borderRadius: 20, border: `1px solid ${!selectedHangout ? 'var(--yellow)' : 'var(--border2)'}`, background: !selectedHangout ? 'var(--yellow-soft)' : 'transparent', fontSize: 12, cursor: 'pointer', color: !selectedHangout ? 'var(--yellow)' : 'var(--text2)' }}>
                General
              </div>
              {hangouts.slice(0, 5).map(h => (
                <div key={h.id} onClick={() => setSelectedHangout(h.id)}
                  style={{ padding: '4px 10px', borderRadius: 20, border: `1px solid ${selectedHangout === h.id ? 'var(--yellow)' : 'var(--border2)'}`, background: selectedHangout === h.id ? 'var(--yellow-soft)' : 'transparent', fontSize: 12, cursor: 'pointer', color: selectedHangout === h.id ? 'var(--yellow)' : 'var(--text2)' }}>
                  {h.title || 'Hangout'} · {formatDate(h.created_at)}
                </div>
              ))}
            </div>
          </div>
        )}

        {uploadError && (
          <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--yellow-soft)', border: '1px solid var(--yellow-dim)', borderRadius: 8, fontSize: 12, color: 'var(--yellow)' }}>
            {uploadError}
          </div>
        )}

        {uploading && (
          <div style={{ marginTop: 10 }}>
            <div style={{ height: 4, background: 'var(--bg4)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'var(--yellow)', width: `${uploadProgress}%`, transition: 'width 0.3s', borderRadius: 2 }} />
            </div>
          </div>
        )}
      </div>

      {/* Privacy note */}
      <div style={{ padding: '10px 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, color: 'var(--text3)', marginBottom: 20 }}>
        Photos are permanently private to this Knot. No sharing outside, no public access, ever.
      </div>

      {/* Photo modal */}
      {viewPhoto && (
        <div onClick={() => setViewPhoto(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ maxWidth: 820, width: '100%', background: 'var(--bg)', borderRadius: 16, overflow: 'hidden' }}>

            {/* Image */}
            <img src={viewPhoto.url} alt="" style={{ width: '100%', maxHeight: '55vh', objectFit: 'contain', background: '#000', display: 'block' }} />

            <div style={{ padding: 16 }}>

              {/* Caption */}
              <div style={{ marginBottom: 12 }}>
                {editingCaption ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      value={captionDraft}
                      onChange={e => setCaptionDraft(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveCaption()}
                      autoFocus
                      placeholder="Add a caption..."
                      style={{ flex: 1, padding: '8px 12px', background: 'var(--bg3)', border: '1px solid var(--yellow)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
                    />
                    <button onClick={saveCaption}
                      style={{ padding: '8px 14px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Save
                    </button>
                    <button onClick={() => setEditingCaption(false)}
                      style={{ padding: '8px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, color: viewPhoto.caption ? 'var(--text)' : 'var(--text3)', flex: 1 }}>
                      {viewPhoto.caption || 'No caption'}
                    </span>
                    {viewPhoto.uploaded_by === user?.id && (
                      <button onClick={() => setEditingCaption(true)}
                        style={{ fontSize: 12, padding: '4px 10px', borderRadius: 8, background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit' }}>
                        {viewPhoto.caption ? 'Edit' : '+ Caption'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Meta */}
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
                Added by {viewPhoto.profiles?.name || 'someone'} · {formatDate(viewPhoto.created_at)}
              </div>

              {/* Comments */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
                  Comments {comments.length > 0 && <span style={{ color: 'var(--text3)', fontWeight: 400 }}>({comments.length})</span>}
                </div>

                {comments.length === 0 && (
                  <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12 }}>No comments yet — be the first.</div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                  {comments.map((c: any) => (
                    <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--olive-soft)', color: 'var(--olive)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {getInitials(c.profiles?.name || '?')}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13 }}>
                          <strong>{c.profiles?.name || 'Someone'}</strong>
                          <span style={{ color: 'var(--text2)', marginLeft: 6 }}>{c.content}</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{timeAgo(c.created_at)}</div>
                      </div>
                      {c.user_id === user?.id && (
                        <button onClick={() => deleteComment(c.id)}
                          style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontFamily: 'inherit' }}>
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add comment */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addComment()}
                    placeholder="Add a comment..."
                    style={{ flex: 1, padding: '8px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
                  />
                  <button onClick={addComment} disabled={postingComment || !newComment.trim()}
                    style={{ padding: '8px 14px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: postingComment ? 0.7 : 1 }}>
                    Post
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                {viewPhoto.uploaded_by === user?.id && (
                  <button onClick={() => deletePhoto(viewPhoto)}
                    style={{ padding: '6px 14px', background: 'var(--yellow-soft)', border: '1px solid var(--yellow-dim)', borderRadius: 8, color: 'var(--yellow)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Delete photo
                  </button>
                )}
                <button onClick={() => setViewPhoto(null)}
                  style={{ padding: '6px 14px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
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
            style={{ padding: '10px 20px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Add photos
          </button>
        </div>
      )}

      {/* Photos by hangout */}
      {byHangout.map(h => (
        <div key={h.id} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            {h.title || 'Hangout'}
            <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 400 }}>· {formatDate(h.created_at)} · {h.photos.length} photo{h.photos.length !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {h.photos.map((p: any) => (
              <div key={p.id} onClick={() => setViewPhoto(p)}
                style={{ aspectRatio: '1', borderRadius: 10, overflow: 'hidden', cursor: 'pointer', background: 'var(--bg3)', border: '1px solid var(--border)', position: 'relative' }}>
                <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                {p.caption && (
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 8px', background: 'rgba(0,0,0,0.55)', fontSize: 11, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.caption}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Ungrouped */}
      {ungrouped.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: 'var(--text2)' }}>
            General · {ungrouped.length} photo{ungrouped.length !== 1 ? 's' : ''}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {ungrouped.map((p: any) => (
              <div key={p.id} onClick={() => setViewPhoto(p)}
                style={{ aspectRatio: '1', borderRadius: 10, overflow: 'hidden', cursor: 'pointer', background: 'var(--bg3)', border: '1px solid var(--border)', position: 'relative' }}>
                <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                {p.caption && (
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 8px', background: 'rgba(0,0,0,0.55)', fontSize: 11, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.caption}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
