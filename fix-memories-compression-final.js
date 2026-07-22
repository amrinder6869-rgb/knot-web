const fs = require('fs')
let content = fs.readFileSync('components/Memories.tsx', 'utf8')

// Add compressImage import
if (!content.includes("compressImage")) {
  content = content.replace(
    "import { supabase } from '@/lib/supabase'",
    "import { supabase } from '@/lib/supabase'\nimport { compressImage } from '@/lib/compressImage'"
  )
}

// Raise the safety-net limit (compression now handles the real constraint)
content = content.replace(
  'const MAX_FILE_SIZE = 5 * 1024 * 1024',
  'const MAX_FILE_SIZE = 15 * 1024 * 1024 // safety net after client-side compression'
)

// Replace the pre-upload oversized rejection with a much higher sanity check
const oldOversized = `    const oversized = files.filter(f => f.size > MAX_FILE_SIZE)
    if (oversized.length > 0) {
      setUploadError(\`\${oversized.length} file(s) exceed the 5 MB limit.\`)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }`

const newOversized = `    const extremelyOversized = files.filter(f => f.size > 30 * 1024 * 1024)
    if (extremelyOversized.length > 0) {
      setUploadError(\`\${extremelyOversized.length} file(s) are too large to process (over 30 MB).\`)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }`

if (!content.includes(oldOversized)) {
  console.log('ERROR: oversized block not found on second attempt either')
  process.exit(1)
}
content = content.replace(oldOversized, newOversized)

// Replace the upload loop to compress each file first
const oldLoop = `    let uploaded = 0
    for (const file of files) {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const safeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
        : ext === 'png'  ? 'image/png'
        : ext === 'gif'  ? 'image/gif'
        : ext === 'webp' ? 'image/webp'
        : 'image/jpeg'
      const path = \`\${knotId}/\${user.id}/\${Date.now()}-\${Math.random().toString(36).substring(7)}.\${ext}\`

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
    }`

const newLoop = `    let uploaded = 0
    for (const rawFile of files) {
      const file = await compressImage(rawFile)
      if (file.size > MAX_FILE_SIZE) { continue }

      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const safeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
        : ext === 'png'  ? 'image/png'
        : ext === 'gif'  ? 'image/gif'
        : ext === 'webp' ? 'image/webp'
        : 'image/jpeg'
      const path = \`\${knotId}/\${user.id}/\${Date.now()}-\${Math.random().toString(36).substring(7)}.\${ext}\`

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
    }`

if (!content.includes(oldLoop)) {
  console.log('ERROR: upload loop block not found on second attempt either')
  process.exit(1)
}
content = content.replace(oldLoop, newLoop)

fs.writeFileSync('components/Memories.tsx', content, 'utf8')
console.log('Done. Memories.tsx now compresses images client-side before upload.')
