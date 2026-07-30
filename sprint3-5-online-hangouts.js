const fs = require('fs')
const path = require('path')
const https = require('https')

const BASE = 'C:\\Users\\amrin\\Documents\\knot-web'

function fetchRaw(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => resolve(data))
    }).on('error', reject)
  })
}

// ─── Composer.tsx ─────────────────────────────────────────────────────────────

async function patchComposer() {
  const url = 'https://raw.githubusercontent.com/amrinder6869-rgb/knot-web/master/components/Composer.tsx'
  console.log('Fetching Composer.tsx from GitHub...')
  let src = await fetchRaw(url)
  if (!src.includes("'use client'")) { console.log('ERROR: bad fetch'); process.exit(1) }

  // 1. Add 'online' to whereMode type
  src = src.replace(
    `useState<'none' | 'tbd' | 'discover' | 'manual' | 'home' | 'search'>('none')`,
    `useState<'none' | 'tbd' | 'discover' | 'manual' | 'home' | 'search' | 'online'>('none')`
  )

  // 2. Add meetingUrl state after whereMode state
  src = src.replace(
    `  const [selectedVenue, setSelectedVenue] = useState<any>(null)`,
    `  const [selectedVenue, setSelectedVenue] = useState<any>(null)\n  const [meetingUrl, setMeetingUrl] = useState('')`
  )

  // 3. Add meetingUrl to reset()
  src = src.replace(
    `    setHangoutTitle('')\n    setHangoutError('')`,
    `    setHangoutTitle('')\n    setHangoutError('')\n    setMeetingUrl('')`
  )

  // 4. Add meeting_url to hangout insert
  src = src.replace(
    `      venue_category:     selectedVenue?.category_id || null,`,
    `      venue_category:     selectedVenue?.category_id || null,\n      meeting_url:       whereMode === 'online' ? (meetingUrl.trim() || null) : null,`
  )

  // 5. Add Online button to the where options list
  src = src.replace(
    `                  { id: 'discover', label: 'Browse Discover' },`,
    `                  { id: 'discover', label: 'Browse Discover' },\n                  { id: 'online', label: 'Online / Virtual' },`
  )

  // 6. Add online to the click handler
  src = src.replace(
    `                      else if (id === 'discover') setWhereMode('discover')`,
    `                      else if (id === 'discover') setWhereMode('discover')\n                      else if (id === 'online') setWhereMode('online')`
  )

  // 7. Add online UI block after the home block
  const onlineBlock = `
            {whereMode === 'online' && (
              <div>
                <input
                  value={meetingUrl}
                  onChange={e => setMeetingUrl(e.target.value)}
                  placeholder="Paste a Zoom, Meet, or FaceTime link (optional)"
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 6 }}
                />
                <button onClick={() => { setWhereMode('none'); setMeetingUrl('') }} style={{ width: '100%', padding: '8px', background: 'transparent', border: '1px dashed var(--border2)', borderRadius: 8, color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Cancel
                </button>
              </div>
            )}`

  src = src.replace(
    `            {whereMode === 'home' && (`,
    `${onlineBlock}\n\n            {whereMode === 'home' && (`
  )

  // 8. Add venue name for online hangouts
  src = src.replace(
    `    if (whereMode === 'home') return 'Someone\\'s place'`,
    `    if (whereMode === 'home') return 'Someone\\'s place'\n    if (whereMode === 'online') return 'Online hangout'`
  )

  fs.writeFileSync(path.join(BASE, 'components/Composer.tsx'), src, 'utf8')
  console.log('UPDATED: components/Composer.tsx')
}

// ─── HangoutCard.tsx ──────────────────────────────────────────────────────────

async function patchHangoutCard() {
  const url = 'https://raw.githubusercontent.com/amrinder6869-rgb/knot-web/master/components/HangoutCard.tsx'
  console.log('Fetching HangoutCard.tsx from GitHub...')
  let src = await fetchRaw(url)
  if (!src.includes("'use client'")) { console.log('ERROR: bad fetch'); process.exit(1) }

  // 1. Add livePhotoPosted state (already in GitHub from Sprint 2 — skip if present)
  // It should already be there, verify
  if (!src.includes('livePhotoPosted')) {
    src = src.replace(
      `  const [deletingBillId, setDeletingBillId] = useState<string | null>(null)`,
      `  const [deletingBillId, setDeletingBillId] = useState<string | null>(null)\n  const [livePhotoPosted, setLivePhotoPosted] = useState(false)`
    )
  }

  // 2. Add brief state variables
  if (!src.includes('memberBriefs')) {
    src = src.replace(
      `  const [deletingBillId, setDeletingBillId] = useState<string | null>(null)`,
      `  const [deletingBillId, setDeletingBillId] = useState<string | null>(null)\n  const [memberBriefs, setMemberBriefs] = useState<any[]>([])\n  const [myBriefNote, setMyBriefNote] = useState('')\n  const [briefSubmitting, setBriefSubmitting] = useState(false)\n  const [myBriefId, setMyBriefId] = useState<string | null>(null)`
    )
  }

  // 3. Add Join call button after Directions link
  const joinCallBtn = `
        {hangout.meeting_url && (isConfirmed || isLive) && (
          <a href={hangout.meeting_url} target="_blank" rel="noreferrer" style={{ padding: '8px 14px', background: isLive ? 'rgba(74,222,128,0.15)' : 'var(--sage-soft)', border: \`1px solid \${isLive ? 'rgba(74,222,128,0.3)' : 'var(--sage-dim)'}\`, borderRadius: 8, color: isLive ? '#4ade80' : 'var(--sage)', fontSize: 12, fontWeight: 700, textDecoration: 'none', fontFamily: 'inherit' }}>Join call</a>
        )}`

  src = src.replace(
    `        {hangout.venue_maps_url && (isConfirmed || isLive) && (`,
    `${joinCallBtn}\n        {hangout.venue_maps_url && (isConfirmed || isLive) && (`
  )

  // 4. Add Viator virtual experiences chip for online hangouts
  const viatorVirtualChip = `
        {(isConfirmed || isLive) && hangout.meeting_url && (
          <a href="https://www.viator.com/searchResults/all?text=virtual+experiences" target="_blank" rel="noreferrer" style={{ padding: '8px 14px', background: isLive ? 'rgba(255,255,255,0.06)' : 'var(--bg3)', border: \`1px solid \${isLive ? 'rgba(255,255,255,0.15)' : 'var(--border2)'}\`, borderRadius: 8, color: isLive ? 'rgba(255,255,255,0.65)' : 'var(--text2)', fontSize: 12, textDecoration: 'none', fontFamily: 'inherit' }}>Virtual experiences</a>
        )}`

  // Insert after the existing Viator/GetYourGuide block — find GetYourGuide chip closing
  src = src.replace(
    `        {isDone && !showBill && bills.length === 0 && (`,
    `${viatorVirtualChip}\n        {isDone && !showBill && bills.length === 0 && (`
  )

  // 5. Add handleLivePhotoUpload if not already present
  if (!src.includes('handleLivePhotoUpload')) {
    src = src.replace(
      `  if (!hangout) return null`,
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
  }

  if (!hangout) return null`
    )
  }

  // 6. Add live nudge if not already present
  if (!src.includes('Capture the night')) {
    src = src.replace(
      `      {isDone && !isCancelled && (`,
      `      {isLive && !isCancelled && !livePhotoPosted && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>Capture the night</span>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.65)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            Add photo
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLivePhotoUpload} />
          </label>
        </div>
      )}
      {isLive && !isCancelled && livePhotoPosted && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14, marginBottom: 14 }}>
          <span style={{ fontSize: 13, color: '#4ade80' }}>Photo added to Memories</span>
        </div>
      )}

      {isDone && !isCancelled && (`
    )
  }

  // 7. Add brief state and fetch/submit if not already present
  if (!src.includes('memberBriefs')) {
    src = src.replace(
      `  const [deletingBillId, setDeletingBillId] = useState<string | null>(null)`,
      `  const [deletingBillId, setDeletingBillId] = useState<string | null>(null)\n  const [memberBriefs, setMemberBriefs] = useState<any[]>([])\n  const [myBriefNote, setMyBriefNote] = useState('')\n  const [briefSubmitting, setBriefSubmitting] = useState(false)\n  const [myBriefId, setMyBriefId] = useState<string | null>(null)`
    )
  }

  if (!src.includes('fetchBriefs')) {
    src = src.replace(
      `  if (!hangout) return null`,
      `  async function submitBrief() {
    if (!myBriefNote.trim() || !currentUser || briefSubmitting) return
    setBriefSubmitting(true)
    try {
      if (myBriefId) {
        await supabase.from('hangout_briefs').update({ note: myBriefNote.trim() }).eq('id', myBriefId)
        setMemberBriefs(prev => prev.map(b => b.id === myBriefId ? { ...b, note: myBriefNote.trim() } : b))
      } else {
        const { data } = await supabase.from('hangout_briefs')
          .insert({ hangout_id: hangout.id, user_id: currentUser.id, knot_id: knotId, note: myBriefNote.trim() })
          .select('id, user_id, note, profiles:user_id(name)')
          .single()
        if (data) { setMyBriefId(data.id); setMemberBriefs(prev => [...prev, data]) }
      }
    } catch (err) { console.error('Brief submit error:', err) }
    setBriefSubmitting(false)
  }

  if (!hangout) return null`
    )
  }

  fs.writeFileSync(path.join(BASE, 'components/HangoutCard.tsx'), src, 'utf8')
  console.log('UPDATED: components/HangoutCard.tsx')
}

async function main() {
  await patchComposer()
  await patchHangoutCard()
  console.log('\nDone. Run: npm run build')
}

main().catch(console.error)
