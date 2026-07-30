const fs = require('fs')
const path = require('path')

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web', 'components', 'HangoutCard.tsx')
const lines = fs.readFileSync(filePath, 'utf8').split('\n')

// Find handleLivePhotoUpload to confirm it is missing
const alreadyExists = lines.some(l => l.includes('async function handleLivePhotoUpload'))
if (alreadyExists) {
  console.log('handleLivePhotoUpload already exists — nothing to do')
  process.exit(0)
}

// Find the end of handlePhotoUpload — look for the line after its closing brace
// handlePhotoUpload ends before 'const displayRating'
const displayRatingIdx = lines.findIndex(l => l.includes('const displayRating'))
if (displayRatingIdx === -1) { console.log('ERROR: could not find const displayRating'); process.exit(1) }

// Walk back from displayRating to find the blank line / closing brace just before it
let insertAt = displayRatingIdx
for (let i = displayRatingIdx - 1; i >= displayRatingIdx - 5; i--) {
  if (lines[i] && (lines[i].trim() === '' || lines[i].trim() === '\r')) {
    insertAt = i + 1
    break
  }
}

console.log('Inserting handleLivePhotoUpload before line', insertAt + 1)

const handler = [
  `  async function handleLivePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {\r`,
  `    const file = e.target.files?.[0]\r`,
  `    if (!file || !currentUser) return\r`,
  `    try {\r`,
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
  `\r`,
]

lines.splice(insertAt, 0, ...handler)

fs.writeFileSync(filePath, lines.join('\n'), 'utf8')
console.log('Done. Run: npm run build')
