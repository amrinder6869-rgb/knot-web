'use client'

import { useState, useEffect } from 'react'
import { Star, Camera, CheckCircle } from 'lucide-react'
import { supabase, getSignedUrl } from '@/lib/supabase'
import { compressImage } from '@/lib/compressImage'

interface PostHangoutLoopProps {
  hangout: any
  knotId: string
  currentUserId: string
  goingCount: number
  onPhotoPosted: () => void
}

export function PostHangoutLoop({
  hangout,
  knotId,
  currentUserId,
  goingCount,
  onPhotoPosted,
}: PostHangoutLoopProps) {
  const [rating, setRating] = useState<number | null>(null)
  const [hoverRating, setHoverRating] = useState<number | null>(null)
  const [ratingSubmitted, setRatingSubmitted] = useState(false)
  const [submittingRating, setSubmittingRating] = useState(false)

  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoPosted, setPhotoPosted] = useState(false)
  const [photoError, setPhotoError] = useState('')

  const [hangoutPhotos, setHangoutPhotos] = useState<{ id: string; url: string; media_type: string }[]>([])

  useEffect(() => {
    async function fetchPhotos() {
      const { data } = await supabase
        .from('photos')
        .select('id, storage_path, media_type')
        .eq('hangout_id', hangout.id)
        .order('created_at', { ascending: false })
        .limit(6)
      if (!data) return
      const withUrls = await Promise.all(
        data.map(async (p: any) => {
          const url = await getSignedUrl(p.storage_path)
          return { id: p.id, url: url ?? '', media_type: p.media_type ?? 'image' }
        })
      )
      setHangoutPhotos(withUrls.filter(p => p.url))
    }
    fetchPhotos()
  }, [hangout.id, photoPosted])

  async function submitRating(r: number) {
    if (submittingRating || ratingSubmitted) return
    setRating(r)
    setSubmittingRating(true)

    const scheduledAt = hangout.scheduled_for ? new Date(hangout.scheduled_for) : new Date()

    try {
      await supabase.from('hangout_signals').upsert({
        hangout_id: hangout.id,
        user_id: currentUserId,
        knot_id: knotId,
        rating: r,
        venue_name: hangout.venue_name ?? hangout.title ?? null,
        venue_place_id: hangout.venue_place_id ?? null,
        group_size: goingCount,
        scheduled_at: scheduledAt.toISOString(),
        day_of_week: scheduledAt.getDay(),
        hour_of_day: scheduledAt.getHours(),
      }, { onConflict: 'hangout_id,user_id' })

      await supabase.from('point_transactions').insert({
        user_id: currentUserId,
        knot_id: knotId,
        amount: 5,
        reason: 'hangout_attended',
        reference_id: hangout.id,
      })

      setRatingSubmitted(true)
    } catch (err) {
      console.error('Rating submit error:', err)
    } finally {
      setSubmittingRating(false)
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !currentUserId) return
    if (file.size > 100 * 1024 * 1024) { setPhotoError('File is too large. Maximum size is 100 MB.'); return }
    setPhotoUploading(true)
    setPhotoError('')

    try {
      const isVideo = file.type.startsWith('video/')
      const uploadFile = isVideo ? file : await compressImage(file)
      const ext = uploadFile.name.split('.').pop()
      const storagePath = `memories/${knotId}/${hangout.id}/${Date.now()}.${ext}`

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
        caption: `From ${hangout.venue_name || hangout.title}`,
      })

      await supabase.from('posts').insert({
        knot_id: knotId,
        hangout_id: hangout.id,
        author_id: currentUserId,
        content: `Added a photo from ${hangout.venue_name || hangout.title}`,
        post_type: 'moment',
      })

      await supabase.from('hangout_signals')
        .update({ photo_posted: true })
        .eq('hangout_id', hangout.id)
        .eq('user_id', currentUserId)

      setPhotoPosted(true)
      onPhotoPosted()
    } catch (err) {
      console.error('Photo upload error:', err)
      setPhotoError('Something went wrong. Try again.')
    } finally {
      setPhotoUploading(false)
    }
  }

  const displayRating = hoverRating ?? rating

  return (
    <div style={{
      borderTop: '1px solid var(--border)',
      paddingTop: 16,
      marginTop: 4,
      marginBottom: 16,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--text3)',
        letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12
      }}>
        How was it?
      </div>

      {!ratingSubmitted ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 10 }}>Rate the hangout</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[1, 2, 3, 4, 5].map(r => (
              <button
                key={r}
                onClick={() => submitRating(r)}
                onMouseEnter={() => setHoverRating(r)}
                onMouseLeave={() => setHoverRating(null)}
                disabled={submittingRating}
                style={{
                  width: 40, height: 40, borderRadius: 10,
                  border: `1.5px solid ${displayRating && r <= displayRating ? 'var(--yellow)' : 'var(--border)'}`,
                  background: displayRating && r <= displayRating ? 'var(--yellow-soft)' : 'var(--bg3)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.1s',
                }}
              >
                <Star
                  size={18}
                  strokeWidth={2}
                  fill={displayRating && r <= displayRating ? 'var(--yellow)' : 'none'}
                  color={displayRating && r <= displayRating ? 'var(--yellow)' : 'var(--text3)'}
                />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span style={{ color: '#4ade80', display: 'flex' }}><CheckCircle size={16} strokeWidth={2} /></span>
          <span style={{ fontSize: 13, color: 'var(--text2)' }}>Rated {rating} star{rating !== 1 ? 's' : ''} &#183; +5 Vibes earned</span>
        </div>
      )}

      {hangoutPhotos.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
            Media from this hangout
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 12 }}>
            {hangoutPhotos.map(p => (
              <div key={p.id} style={{ aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: '#000', position: 'relative' }}>
                {p.media_type === 'video' ? (
                  <video src={p.url} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a href="https://www.printique.com/product/photo-prints/" target="_blank" rel="noreferrer"
              style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--bg3)', color: 'var(--text2)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
              Print with Printique
            </a>
            <a href="https://mixtiles.com/" target="_blank" rel="noreferrer"
              style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--bg3)', color: 'var(--text2)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
              Wall tiles &#183; Mixtiles
            </a>
          </div>
        </div>
      )}

      {!photoPosted ? (
        <div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8 }}>Add a photo or video to Memories</div>
          {photoError && <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 8 }}>{photoError}</div>}
          <label style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 8,
            border: '1.5px solid var(--border)', background: 'var(--bg3)',
            cursor: photoUploading ? 'default' : 'pointer',
            fontSize: 13, fontWeight: 600, color: 'var(--text2)',
            opacity: photoUploading ? 0.6 : 1,
          }}>
            <Camera size={14} strokeWidth={2} />
            {photoUploading ? 'Uploading...' : 'Upload photo or video'}
            <input type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handlePhotoUpload} disabled={photoUploading} />
          </label>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={16} color="#4ade80" strokeWidth={2} />
          <span style={{ fontSize: 13, color: 'var(--text2)' }}>Added to Memories</span>
        </div>
      )}
    </div>
  )
}
