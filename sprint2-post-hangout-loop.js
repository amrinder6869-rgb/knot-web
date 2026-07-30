const fs = require('fs')
const path = require('path')

const BASE = 'C:\\Users\\amrin\\Documents\\knot-web'

function readLines(relPath) {
  return fs.readFileSync(path.join(BASE, relPath), 'utf8').split('\n')
}

function writeLines(relPath, lines) {
  fs.writeFileSync(path.join(BASE, relPath), lines.join('\n'), 'utf8')
  console.log('UPDATED: ' + relPath)
}

// ─── 1. HangoutCard.tsx — add live photo nudge ────────────────────────────────

const cardLines = readLines('components/HangoutCard.tsx')

// Find the line with PreOrderCard block and insert the live nudge after it
// Looking for: {isDone && !isCancelled && (
const doneIdx = cardLines.findIndex(l => l.includes('isDone && !isCancelled') && l.includes('PostHangoutLoop') === false && !l.includes('bill') && !l.includes('Bill'))

// Actually find the line that starts the PostHangoutLoop block
const postLoopIdx = cardLines.findIndex(l => l.includes('{isDone && !isCancelled && (') && cardLines[cardLines.indexOf(l) + 1]?.includes('PostHangoutLoop'))

// Better: find the blank line just before PostHangoutLoop render
const postLoopRenderIdx = cardLines.findIndex(l => l.includes('<PostHangoutLoop'))
if (postLoopRenderIdx === -1) {
  console.log('WARNING: could not find PostHangoutLoop render line')
} else {
  // Go back to find the {isDone && !isCancelled && ( line
  let insertBefore = postLoopRenderIdx
  for (let i = postLoopRenderIdx - 1; i >= postLoopRenderIdx - 5; i--) {
    if (cardLines[i].includes('isDone && !isCancelled')) {
      insertBefore = i
      break
    }
  }

  if (!cardLines.some(l => l.includes('Capture the night'))) {
    // Add live state photo nudge state variable — find useState declarations
    const lastUseStateIdx = cardLines.reduce((acc, l, i) => l.includes('useState') ? i : acc, 0)

    // Add state for live photo nudge
    cardLines.splice(lastUseStateIdx + 1, 0,
      `  const [livePhotoPosted, setLivePhotoPosted] = useState(false)\r`,
      `  const livePhotoInputRef = useRef<HTMLInputElement>(null)\r`
    )

    // Recalculate insertBefore after splice
    const newPostLoopRenderIdx = cardLines.findIndex(l => l.includes('<PostHangoutLoop'))
    let newInsertBefore = newPostLoopRenderIdx
    for (let i = newPostLoopRenderIdx - 1; i >= newPostLoopRenderIdx - 5; i--) {
      if (cardLines[i].includes('isDone && !isCancelled')) {
        newInsertBefore = i
        break
      }
    }

    // Find the handlePhotoUpload function to add a live photo handler after it
    const handlePhotoIdx = cardLines.findIndex(l => l.includes('async function handlePhotoUpload'))
    // Find its closing brace
    let handlePhotoEnd = handlePhotoIdx
    let braceDepth = 0
    for (let i = handlePhotoIdx; i < handlePhotoIdx + 50; i++) {
      for (const ch of cardLines[i]) {
        if (ch === '{') braceDepth++
        if (ch === '}') braceDepth--
      }
      if (braceDepth === 0 && i > handlePhotoIdx) {
        handlePhotoEnd = i
        break
      }
    }

    const livePhotoHandler = [
      `\r`,
      `  async function handleLivePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {\r`,
      `    const file = e.target.files?.[0]\r`,
      `    if (!file || !currentUser) return\r`,
      `    try {\r`,
      `      const { compressImage } = await import('@/lib/compressImage')\r`,
      `      const compressed = await compressImage(file)\r`,
      `      const ext = compressed.name.split('.').pop()\r`,
      `      const storagePath = \`moments/\${knotId}/\${hangout.id}/\${Date.now()}.\${ext}\`\r`,
      `      const { error: uploadError } = await supabase.storage.from('knot-photos').upload(storagePath, compressed)\r`,
      `      if (uploadError) return\r`,
      `      await supabase.from('photos').insert({ knot_id: knotId, hangout_id: hangout.id, uploaded_by: currentUser.id, storage_path: storagePath, caption: \`Live from \${hangout.venue_name || hangout.title}\` })\r`,
      `      await supabase.from('posts').insert({ knot_id: knotId, hangout_id: hangout.id, author_id: currentUser.id, content: \`Capturing the night at \${hangout.venue_name || hangout.title}\`, post_type: 'moment' })\r`,
      `      setLivePhotoPosted(true)\r`,
      `      onRefresh()\r`,
      `    } catch (err) {\r`,
      `      console.error('Live photo error:', err)\r`,
      `    }\r`,
      `  }\r`,
    ]
    cardLines.splice(handlePhotoEnd + 1, 0, ...livePhotoHandler)

    // Recalculate newInsertBefore after second splice
    const finalPostLoopRenderIdx = cardLines.findIndex(l => l.includes('<PostHangoutLoop'))
    let finalInsertBefore = finalPostLoopRenderIdx
    for (let i = finalPostLoopRenderIdx - 1; i >= finalPostLoopRenderIdx - 5; i--) {
      if (cardLines[i].includes('isDone && !isCancelled')) {
        finalInsertBefore = i
        break
      }
    }

    const liveNudge = [
      `      {isLive && !isCancelled && !livePhotoPosted && (\r`,
      `        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>\r`,
      `          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>Capture the night</span>\r`,
      `          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.65)' }}>\r`,
      `            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>\r`,
      `            Add photo\r`,
      `            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLivePhotoUpload} ref={livePhotoInputRef} />\r`,
      `          </label>\r`,
      `        </div>\r`,
      `      )}\r`,
      `      {isLive && !isCancelled && livePhotoPosted && (\r`,
      `        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14, marginBottom: 14 }}>\r`,
      `          <span style={{ fontSize: 13, color: '#4ade80' }}>Photo added to Memories</span>\r`,
      `        </div>\r`,
      `      )}\r`,
      `\r`,
    ]
    cardLines.splice(finalInsertBefore, 0, ...liveNudge)

    writeLines('components/HangoutCard.tsx', cardLines)
    console.log('Added live photo nudge to HangoutCard.tsx')
  } else {
    console.log('SKIP: live photo nudge already exists')
  }
}

// ─── 2. PostHangoutLoop.tsx — photo grid + prints chip ────────────────────────

const newPostHangoutLoop = `'use client'

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

  const [hangoutPhotos, setHangoutPhotos] = useState<{ id: string; url: string }[]>([])

  useEffect(() => {
    async function fetchPhotos() {
      const { data } = await supabase
        .from('photos')
        .select('id, storage_path')
        .eq('hangout_id', hangout.id)
        .order('created_at', { ascending: false })
        .limit(6)
      if (!data) return
      const withUrls = await Promise.all(
        data.map(async (p: any) => {
          const url = await getSignedUrl(p.storage_path)
          return { id: p.id, url: url ?? '' }
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
      })

      await supabase.from('posts').insert({
        knot_id: knotId,
        hangout_id: hangout.id,
        author_id: currentUserId,
        content: \`Added a photo from \${hangout.venue_name || hangout.title}\`,
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

  function buildPrintiqeLink() {
    return 'https://www.printique.com/product/photo-prints/'
  }

  function buildMixtilesLink() {
    return 'https://mixtiles.com/'
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

      {/* Rating */}
      {!ratingSubmitted ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 10 }}>
            Rate the hangout
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[1, 2, 3, 4, 5].map(r => (
              <button
                key={r}
                onClick={() => submitRating(r)}
                onMouseEnter={() => setHoverRating(r)}
                onMouseLeave={() => setHoverRating(null)}
                disabled={submittingRating}
                style={{
                  width: 40, height: 40,
                  borderRadius: 10,
                  border: \`1.5px solid \${displayRating && r <= displayRating ? 'var(--yellow)' : 'var(--border)'}\`,
                  background: displayRating && r <= displayRating ? 'var(--yellow-soft)' : 'var(--bg3)',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.1s',
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
          <span style={{ fontSize: 13, color: 'var(--text2)' }}>
            Rated {rating} star{rating !== 1 ? 's' : ''} — +5 Vibes earned
          </span>
        </div>
      )}

      {/* Photo grid */}
      {hangoutPhotos.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
            Photos from this hangout
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 12 }}>
            {hangoutPhotos.map(p => (
              <div key={p.id} style={{ aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: 'var(--bg3)' }}>
                <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <a
              href={buildPrintiqeLink()}
              target="_blank"
              rel="noreferrer"
              style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--bg3)', color: 'var(--text2)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}
            >
              Print with Printique
            </a>
            <a
              href={buildMixtilesLink()}
              target="_blank"
              rel="noreferrer"
              style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--bg3)', color: 'var(--text2)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}
            >
              Wall tiles — Mixtiles
            </a>
          </div>
        </div>
      )}

      {/* Photo prompt */}
      {!photoPosted ? (
        <div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8 }}>
            Add a photo to Memories
          </div>
          {photoError && (
            <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 8 }}>{photoError}</div>
          )}
          <label style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 8,
            border: '1.5px solid var(--border)',
            background: 'var(--bg3)',
            cursor: photoUploading ? 'default' : 'pointer',
            fontSize: 13, fontWeight: 600, color: 'var(--text2)',
            opacity: photoUploading ? 0.6 : 1,
          }}>
            <Camera size={14} strokeWidth={2} />
            {photoUploading ? 'Uploading...' : 'Upload photo'}
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handlePhotoUpload}
              disabled={photoUploading}
            />
          </label>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={16} color="#4ade80" strokeWidth={2} />
          <span style={{ fontSize: 13, color: 'var(--text2)' }}>Photo added to Memories</span>
        </div>
      )}
    </div>
  )
}
`

fs.writeFileSync(path.join(BASE, 'components/PostHangoutLoop.tsx'), newPostHangoutLoop, 'utf8')
console.log('UPDATED: components/PostHangoutLoop.tsx')

console.log('\nDone. Run: npm run build')
