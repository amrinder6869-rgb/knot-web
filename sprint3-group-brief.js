const fs = require('fs')
const path = require('path')
const https = require('https')

const LOCAL = path.join('C:\\Users\\amrin\\Documents\\knot-web', 'components', 'HangoutCard.tsx')
const RAW_URL = 'https://raw.githubusercontent.com/amrinder6869-rgb/knot-web/master/components/HangoutCard.tsx'

function fetchRaw(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => resolve(data))
    }).on('error', reject)
  })
}

async function main() {
  console.log('Fetching latest HangoutCard from GitHub...')
  const source = await fetchRaw(RAW_URL)
  if (!source.includes("'use client'")) { console.log('ERROR: bad fetch'); process.exit(1) }

  const lines = source.split('\n')
  console.log('Fetched', lines.length, 'lines')

  // ── 1. Add state variables ────────────────────────────────────────────────
  // Find deletingBillId useState line to insert after it
  const deletingBillIdx = lines.findIndex(l => l.includes('deletingBillId') && l.includes('useState'))
  if (deletingBillIdx === -1) { console.log('ERROR: deletingBillId not found'); process.exit(1) }

  const newState = [
    `  const [memberBriefs, setMemberBriefs] = useState<any[]>([])`,
    `  const [myBriefNote, setMyBriefNote] = useState('')`,
    `  const [briefSubmitting, setBriefSubmitting] = useState(false)`,
    `  const [myBriefId, setMyBriefId] = useState<string | null>(null)`,
    `  const [livePhotoPosted, setLivePhotoPosted] = useState(false)`,
  ]
  lines.splice(deletingBillIdx + 1, 0, ...newState)
  console.log('Added state variables after line', deletingBillIdx + 1)

  // ── 2. Add useEffect to fetch member briefs (after the existing useEffect) ─
  const existingUseEffectIdx = lines.findIndex(l => l.includes('useEffect(() => {') && l.includes('setHangout'))
  // Find the closing of that useEffect
  let useEffectEnd = existingUseEffectIdx
  let depth = 0
  for (let i = existingUseEffectIdx; i < existingUseEffectIdx + 15; i++) {
    for (const ch of (lines[i] || '')) {
      if (ch === '{') depth++
      if (ch === '}') depth--
    }
    if (depth === 0 && i > existingUseEffectIdx) { useEffectEnd = i; break }
  }

  const briefFetchEffect = [
    ``,
    `  useEffect(() => {`,
    `    async function fetchBriefs() {`,
    `      const { data } = await supabase`,
    `        .from('hangout_briefs')`,
    `        .select('id, user_id, note, profiles:user_id(name)')`,
    `        .eq('hangout_id', hangout.id)`,
    `        .order('created_at', { ascending: true })`,
    `      if (!data) return`,
    `      setMemberBriefs(data)`,
    `      const mine = data.find((b: any) => b.user_id === currentUser?.id)`,
    `      if (mine) { setMyBriefId(mine.id); setMyBriefNote(mine.note || '') }`,
    `    }`,
    `    fetchBriefs()`,
    `  }, [hangout.id, currentUser?.id])`,
  ]
  lines.splice(useEffectEnd + 1, 0, ...briefFetchEffect)
  console.log('Added brief fetch useEffect after line', useEffectEnd + 1)

  // ── 3. Add submitBrief function before handleLivePhotoUpload or before render ─
  const ifNotHangoutIdx = lines.findIndex(l => l.includes('if (!hangout) return null'))
  if (ifNotHangoutIdx === -1) { console.log('ERROR: if (!hangout) not found'); process.exit(1) }

  const submitBriefFn = [
    ``,
    `  async function submitBrief() {`,
    `    if (!myBriefNote.trim() || !currentUser || briefSubmitting) return`,
    `    setBriefSubmitting(true)`,
    `    try {`,
    `      if (myBriefId) {`,
    `        await supabase.from('hangout_briefs').update({ note: myBriefNote.trim() }).eq('id', myBriefId)`,
    `        setMemberBriefs(prev => prev.map(b => b.id === myBriefId ? { ...b, note: myBriefNote.trim() } : b))`,
    `      } else {`,
    `        const { data } = await supabase.from('hangout_briefs')`,
    `          .insert({ hangout_id: hangout.id, user_id: currentUser.id, knot_id: knotId, note: myBriefNote.trim() })`,
    `          .select('id, user_id, note, profiles:user_id(name)')`,
    `          .single()`,
    `        if (data) { setMyBriefId(data.id); setMemberBriefs(prev => [...prev, data]) }`,
    `      }`,
    `    } catch (err) { console.error('Brief submit error:', err) }`,
    `    setBriefSubmitting(false)`,
    `  }`,
    ``,
  ]
  lines.splice(ifNotHangoutIdx, 0, ...submitBriefFn)
  console.log('Added submitBrief function before render')

  // ── 4. Add handleLivePhotoUpload ──────────────────────────────────────────
  const newIfNotHangoutIdx = lines.findIndex(l => l.includes('if (!hangout) return null'))
  const liveHandler = [
    `  async function handleLivePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {`,
    `    const file = e.target.files?.[0]`,
    `    if (!file || !currentUser) return`,
    `    try {`,
    `      const compressed = await compressImage(file)`,
    `      const ext = compressed.name.split('.').pop()`,
    `      const storagePath = \`moments/\${knotId}/\${hangout.id}/\${Date.now()}.\${ext}\``,
    `      const { error: uploadError } = await supabase.storage.from('knot-photos').upload(storagePath, compressed)`,
    `      if (uploadError) return`,
    `      await supabase.from('photos').insert({ knot_id: knotId, hangout_id: hangout.id, uploaded_by: currentUser.id, storage_path: storagePath, caption: \`Live from \${hangout.venue_name || hangout.title}\` })`,
    `      await supabase.from('posts').insert({ knot_id: knotId, hangout_id: hangout.id, author_id: currentUser.id, content: \`Capturing the night at \${hangout.venue_name || hangout.title}\`, post_type: 'moment' })`,
    `      setLivePhotoPosted(true)`,
    `      onRefresh()`,
    `    } catch (err) { console.error('Live photo error:', err) }`,
    `  }`,
    ``,
  ]
  lines.splice(newIfNotHangoutIdx, 0, ...liveHandler)
  console.log('Added handleLivePhotoUpload')

  // ── 5. Insert group brief UI after the creator brief block ────────────────
  // Find the closing of the creator brief block: }) after brief_budget span
  const creatorBriefEnd = lines.findIndex(l => l.includes('BRIEF_BUDGET_LABELS[hangout.brief_budget]'))
  // Find the )} that closes this block — look 3-5 lines after
  let creatorBriefClose = creatorBriefEnd
  for (let i = creatorBriefEnd + 1; i < creatorBriefEnd + 8; i++) {
    if (lines[i] && (lines[i].trim() === ')}' || lines[i].trim() === ')}\r')) {
      creatorBriefClose = i
      break
    }
  }
  console.log('Creator brief block ends at line', creatorBriefClose + 1)

  const groupBriefUI = [
    ``,
    `      {!isCancelled && (isVoting || isConfirmed) && (`,
    `        <div style={{ marginBottom: 14 }}>`,
    `          <div style={{ fontSize: 10, fontWeight: 700, color: subColor, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Group input</div>`,
    `          {memberBriefs.filter(b => b.user_id !== currentUser?.id).map(b => (`,
    `            <div key={b.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>`,
    `              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--yellow)', color: '#111', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>`,
    `                {(b.profiles?.name || 'U').split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()}`,
    `              </div>`,
    `              <div style={{ flex: 1, background: 'var(--bg3)', border: \`1px solid \${borderSep}\`, borderRadius: 8, padding: '7px 10px', fontSize: 12, color: textColor, lineHeight: 1.5 }}>`,
    `                <span style={{ fontWeight: 600, color: subColor, marginRight: 6 }}>{b.profiles?.name?.split(' ')[0] || 'Member'}</span>`,
    `                {b.note}`,
    `              </div>`,
    `            </div>`,
    `          ))}`,
    `          <div style={{ display: 'flex', gap: 6 }}>`,
    `            <input`,
    `              value={myBriefNote}`,
    `              onChange={e => setMyBriefNote(e.target.value)}`,
    `              onKeyDown={e => e.key === 'Enter' && submitBrief()}`,
    `              placeholder={myBriefId ? 'Update your note...' : 'Add a note for the group...'}`,
    `              style={{ flex: 1, padding: '7px 10px', background: 'var(--bg3)', border: \`1px solid \${borderSep}\`, borderRadius: 8, color: textColor, fontSize: 12, outline: 'none', fontFamily: 'inherit' }}`,
    `            />`,
    `            <button`,
    `              onClick={submitBrief}`,
    `              disabled={!myBriefNote.trim() || briefSubmitting}`,
    `              style={{ padding: '7px 14px', background: myBriefNote.trim() ? 'var(--yellow)' : 'var(--bg3)', border: 'none', borderRadius: 8, color: myBriefNote.trim() ? '#111' : subColor, fontSize: 12, fontWeight: 700, cursor: myBriefNote.trim() ? 'pointer' : 'default', fontFamily: 'inherit', opacity: briefSubmitting ? 0.5 : 1 }}`,
    `            >`,
    `              {myBriefId ? 'Update' : 'Add'}`,
    `            </button>`,
    `          </div>`,
    `        </div>`,
    `      )}`,
  ]

  lines.splice(creatorBriefClose + 1, 0, ...groupBriefUI)
  console.log('Added group brief UI after line', creatorBriefClose + 1)

  // ── 6. Add live nudge before PostHangoutLoop ──────────────────────────────
  const postLoopIdx = lines.findIndex(l => l.includes('<PostHangoutLoop'))
  let nudgeInsertAt = postLoopIdx
  for (let i = postLoopIdx - 1; i >= postLoopIdx - 6; i--) {
    if (lines[i] && lines[i].includes('isDone && !isCancelled')) { nudgeInsertAt = i; break }
  }

  const liveNudge = [
    `      {isLive && !isCancelled && !livePhotoPosted && (`,
    `        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>`,
    `          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>Capture the night</span>`,
    `          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.65)' }}>`,
    `            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
    `            Add photo`,
    `            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLivePhotoUpload} />`,
    `          </label>`,
    `        </div>`,
    `      )}`,
    `      {isLive && !isCancelled && livePhotoPosted && (`,
    `        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14, marginBottom: 14 }}>`,
    `          <span style={{ fontSize: 13, color: '#4ade80' }}>Photo added to Memories</span>`,
    `        </div>`,
    `      )}`,
    ``,
  ]
  lines.splice(nudgeInsertAt, 0, ...liveNudge)
  console.log('Added live nudge UI')

  fs.writeFileSync(LOCAL, lines.join('\n'), 'utf8')
  console.log('\nHangoutCard.tsx written. Run: npm run build')
}

main().catch(console.error)
