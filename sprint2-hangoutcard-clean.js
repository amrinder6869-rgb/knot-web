const fs = require('fs')
const path = require('path')
const https = require('https')

const LOCAL = path.join('C:\\Users\\amrin\\Documents\\knot-web', 'components', 'HangoutCard.tsx')
const RAW_URL = 'https://raw.githubusercontent.com/amrinder6869-rgb/knot-web/master/components/HangoutCard.tsx'

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => resolve(data))
    }).on('error', reject)
  })
}

async function main() {
  console.log('Fetching clean HangoutCard from GitHub...')
  const source = await fetch(RAW_URL)

  if (!source.includes("'use client'")) {
    console.log('ERROR: fetched content looks wrong')
    process.exit(1)
  }

  const lines = source.split('\n')
  console.log('Fetched', lines.length, 'lines')

  // ── 1. Add livePhotoPosted state after deletingBillId useState ────────────
  const deletingBillIdx = lines.findIndex(l => l.includes('deletingBillId') && l.includes('useState'))
  if (deletingBillIdx === -1) { console.log('ERROR: deletingBillId not found'); process.exit(1) }

  lines.splice(deletingBillIdx + 1, 0,
    `  const [livePhotoPosted, setLivePhotoPosted] = useState(false)`
  )
  console.log('Added livePhotoPosted state after line', deletingBillIdx + 1)

  // ── 2. Add handleLivePhotoUpload after handleDeleteBill function ──────────
  // Find handleDeleteBill closing — look for the line after its closing brace
  // which is the blank line before the component render (if (!hangout) return null)
  const ifNotHangoutIdx = lines.findIndex(l => l.includes('if (!hangout) return null'))
  if (ifNotHangoutIdx === -1) { console.log('ERROR: if (!hangout) not found'); process.exit(1) }

  // Walk back to find the closing brace of handleDeleteBill
  let insertHandlerAt = ifNotHangoutIdx
  for (let i = ifNotHangoutIdx - 1; i >= ifNotHangoutIdx - 5; i--) {
    if (lines[i] && (lines[i].trim() === '' || lines[i].trim() === '}')) {
      insertHandlerAt = i + 1
      break
    }
  }

  const handler = [
    ``,
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

  lines.splice(insertHandlerAt, 0, ...handler)
  console.log('Added handleLivePhotoUpload at line', insertHandlerAt + 1)

  // ── 3. Add live nudge UI before {isDone && !isCancelled && (<PostHangoutLoop ──
  const postLoopIdx = lines.findIndex(l => l.includes('<PostHangoutLoop'))
  if (postLoopIdx === -1) { console.log('ERROR: PostHangoutLoop not found'); process.exit(1) }

  let nudgeInsertAt = postLoopIdx
  for (let i = postLoopIdx - 1; i >= postLoopIdx - 6; i--) {
    if (lines[i] && lines[i].includes('isDone && !isCancelled')) {
      nudgeInsertAt = i
      break
    }
  }

  const nudge = [
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

  lines.splice(nudgeInsertAt, 0, ...nudge)
  console.log('Added live nudge UI at line', nudgeInsertAt + 1)

  fs.writeFileSync(LOCAL, lines.join('\n'), 'utf8')
  console.log('\nHangoutCard.tsx restored and updated. Run: npm run build')
}

main().catch(console.error)
