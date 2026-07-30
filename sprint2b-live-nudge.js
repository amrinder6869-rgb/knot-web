const fs = require('fs')
const path = require('path')

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web', 'components', 'HangoutCard.tsx')
const lines = fs.readFileSync(filePath, 'utf8').split('\n')

// Find the line that starts {isDone && !isCancelled && ( for PostHangoutLoop
const postLoopIdx = lines.findIndex(l => l.includes('<PostHangoutLoop'))
if (postLoopIdx === -1) { console.log('ERROR: could not find PostHangoutLoop'); process.exit(1) }

// Walk back to find the opening condition line
let insertAt = postLoopIdx
for (let i = postLoopIdx - 1; i >= postLoopIdx - 6; i--) {
  if (lines[i] && lines[i].includes('isDone && !isCancelled')) {
    insertAt = i
    break
  }
}

console.log('Inserting live nudge before line', insertAt + 1, ':', lines[insertAt].trim())

if (lines.some(l => l.includes('Capture the night'))) {
  console.log('SKIP: live nudge already exists')
  process.exit(0)
}

// Also add livePhotoPosted state — find last useState line
const lastUseStateIdx = lines.reduce((acc, l, i) => l.includes('useState(') ? i : acc, 0)
console.log('Adding state after line', lastUseStateIdx + 1)

lines.splice(lastUseStateIdx + 1, 0,
  `  const [livePhotoPosted, setLivePhotoPosted] = useState(false)\r`,
)

// Recalculate insertAt after splice
const newPostLoopIdx = lines.findIndex(l => l.includes('<PostHangoutLoop'))
let newInsertAt = newPostLoopIdx
for (let i = newPostLoopIdx - 1; i >= newPostLoopIdx - 6; i--) {
  if (lines[i] && lines[i].includes('isDone && !isCancelled')) {
    newInsertAt = i
    break
  }
}

// Add live photo upload handler — find handlePhotoUpload function end by finding next 'async function' after it
const handlePhotoStart = lines.findIndex(l => l.includes('async function handlePhotoUpload'))
let handlerEnd = handlePhotoStart
// Find next async function or end of component
for (let i = handlePhotoStart + 1; i < lines.length; i++) {
  if (lines[i] && (lines[i].includes('async function ') || lines[i].includes('function ') || lines[i].includes('const display'))) {
    handlerEnd = i - 1
    break
  }
}

console.log('Adding live photo handler after line', handlerEnd + 1)

const liveHandler = [
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
  `    } catch (err) { console.error('Live photo error:', err) }\r`,
  `  }\r`,
]

lines.splice(handlerEnd + 1, 0, ...liveHandler)

// Recalculate newInsertAt after third splice
const finalPostLoopIdx = lines.findIndex(l => l.includes('<PostHangoutLoop'))
let finalInsertAt = finalPostLoopIdx
for (let i = finalPostLoopIdx - 1; i >= finalPostLoopIdx - 6; i--) {
  if (lines[i] && lines[i].includes('isDone && !isCancelled')) {
    finalInsertAt = i
    break
  }
}

console.log('Final insert at line', finalInsertAt + 1)

const liveNudge = [
  `      {isLive && !isCancelled && !livePhotoPosted && (\r`,
  `        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>\r`,
  `          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>Capture the night</span>\r`,
  `          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.65)' }}>\r`,
  `            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>\r`,
  `            Add photo\r`,
  `            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLivePhotoUpload} />\r`,
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

lines.splice(finalInsertAt, 0, ...liveNudge)

fs.writeFileSync(filePath, lines.join('\n'), 'utf8')
console.log('HangoutCard.tsx updated with live photo nudge.')
console.log('Run: npm run build')
