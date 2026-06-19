'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Skeleton } from '@/components/Skeleton'

const MAX_FILE_SIZE = 5 * 1024 * 1024

export default function Memories({ members, knotId }: { members: any[], knotId?: string }) {
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
      const path = `${knotId}/${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`

      const { error: upErr } = await supabase.storage
        .from('knot-photos')
        .upload(path, file, { contentType: file.type })

      if (upErr) { continue }

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
    if (!user || photo.uploaded_by !== user.id) return
    await supabase.storage.from('knot-photos').remove([photo.storage_path])
    await supabase.from('photos').delete().eq('id', photo.id).eq('uploaded_by', user.id)
    setViewPhoto(null)
    await loadMemories()
  }

  const ungrouped = photos.filter(p => !p.hangout_id)
  const byHangout = hangouts.map(h => ({
    ...h,
    photos: photos.filter(p => p.hangout_id === h.id)
  })).filter(h => h.photos.length > 0)

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })

  if (loading) return (
      <div style={{ maxWidth: 800 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[0,1,2].map(i => <Skeleton key={i} height={72} borderRadius={12} />)}
      </div>
      <Skeleton height={80} borderRadius={12} />
      <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {[0,1,2,3,4,5].map(i => (
          <div key={i} style={{ aspectRatio: '1', borderRadius: 10, background: 'linear-gradient(90deg, var(--bg3) 25%, var(--bg4) 50%, var(--bg3) 75%)', backgroundSize: '200% 100%', animation: 'skeleton-shimmer 1.4s ease infinite' }} />
        ))}
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth: 800 }}>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <div className="card-hover" style={{ background: 'var(--bg2)', border: '1px solid var(--rust-dim)', borderRadius: 12, padding: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--rust)', letterSpacing: '-0.5px' }}>{stats.hangs}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, fontWeight: 500 }}>Hangs</div>
        </div>
        <div className="card-hover" style={{ background: 'var(--bg2)', border: '1px solid var(--olive-dim)', borderRadius: 12, padding: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--olive)', letterSpacing: '-0.5px' }}>{stats.photos}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, fontWeight: 500 }}>Photos</div>
        </div>
        <div className="card-hover" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>{stats.members}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, fontWeight: 500 }}>Members</div>
        </div>
      </div>

      {/* Upload */}
      <div className="card-hover" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Add photos</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>Max 5 MB · private to this Knot forever</div>
          </div>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={handleUpload}
            style={{ display: 'none' }} id="photo-upload" />
          <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
            {uploading ? `Uploading ${uploadProgress}%` : 'Add photos'}
          </button>
        </div>

        {hangouts.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Link to a hangout (optional)</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <div onClick={() => setSelectedHangout(null)} style={{ padding: '4px 10px', borderRadius: 20, border: `1px solid ${!selectedHangout ? 'var(--rust)' : 'var(--border2)'}`, background: !selectedHangout ? 'var(--rust-soft)' : 'transparent', fontSize: 12, cursor: 'pointer', color: !selectedHangout ? 'var(--rust)' : 'var(--text2)', transition: 'all 0.15s' }}>
                General
              </div>
              {hangouts.slice(0, 5).map(h => (
                <div key={h.id} onClick={() => setSelectedHangout(h.id)} style={{ padding: '4px 10px', borderRadius: 20, border: `1px solid ${selectedHangout === h.id ? 'var(--rust)' : 'var(--border2)'}`, background: selectedHangout === h.id ? 'var(--rust-soft)' : 'transparent', fontSize: 12, cursor: 'pointer', color: selectedHangout === h.id ? 'var(--rust)' : 'var(--text2)', transition: 'all 0.15s' }}>
                  {h.title || 'Hangout'} · {formatDate(h.created_at)}
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
            <div style={{ height: 3, background: 'var(--bg4)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'var(--rust)', width: `${uploadProgress}%`, transition: 'width 0.3s', borderRadius: 2 }} />
            </div>
          </div>
        )}
      </div>

      {/* Photo viewer modal */}
      {viewPhoto && (
        <div onClick={() => setViewPhoto(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'modal-in 0.18s ease both' }}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: 800, width: '100%' }}>
            <img src={viewPhoto.url} alt="" style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: 12 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                {viewPhoto.profiles?.name || 'Someone'} · {formatDate(viewPhoto.created_at)}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {viewPhoto.uploaded_by === user?.id && (
                  <button className="btn btn-destructive" onClick={() => { deletePhoto(viewPhoto); setViewPhoto(null) }} style={{ fontSize: 12, padding: '6px 14px' }}>
                    Delete
                  </button>
                )}
                <button onClick={() => setViewPhoto(null)} style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {photos.length === 0 && (
        <div style={{ textAlign: 'center', padding: '56px 20px' }}>
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none" style={{ marginBottom: 16, opacity: 0.2 }}>
            <rect x="4" y="10" width="36" height="28" rx="4" stroke="var(--text)" strokeWidth="2"/>
            <circle cx="15" cy="20" r="4" stroke="var(--text)" strokeWidth="2"/>
            <path d="M4 30l9-8 7 7 5-5 11 9" stroke="var(--text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, letterSpacing: '-0.3px' }}>No memories yet.</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20, lineHeight: 1.6 }}>Add your first photo from a night out.</div>
          <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()} style={{ fontSize: 13 }}>
            Add photos
          </button>
        </div>
      )}

      {/* Photos by hangout */}
      {byHangout.map(h => (
        <div key={h.id} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            {h.title || 'Hangout'}
            <span style={{ fontWeight: 400 }}>· {formatDate(h.created_at)} · {h.photos.length} photo{h.photos.length !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {h.photos.map((p: any) => (
              <div key={p.id} onClick={() => setViewPhoto(p)}
                style={{ aspectRatio: '1', borderRadius: 10, overflow: 'hidden', cursor: 'pointer', background: 'var(--bg3)', border: '1px solid var(--border)', transition: 'transform 0.15s, box-shadow 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none' }}>
                <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Ungrouped */}
      {ungrouped.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
            General · {ungrouped.length} photo{ungrouped.length !== 1 ? 's' : ''}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {ungrouped.map((p: any) => (
              <div key={p.id} onClick={() => setViewPhoto(p)}
                style={{ aspectRatio: '1', borderRadius: 10, overflow: 'hidden', cursor: 'pointer', background: 'var(--bg3)', border: '1px solid var(--border)', transition: 'transform 0.15s, box-shadow 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none' }}>
                <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}