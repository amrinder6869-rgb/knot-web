const fs = require('fs')
let content = fs.readFileSync('components/Memories.tsx', 'utf8')

// Add compressImage import
content = content.replace(
  "import { supabase } from '@/lib/supabase'",
  "import { supabase } from '@/lib/supabase'\nimport { compressImage } from '@/lib/compressImage'"
)

// Raise the hard limit and update the copy — this is now a safety net after compression, not the primary gate
content = content.replace(
  'const MAX_FILE_SIZE = 5 * 1024 * 1024',
  'const MAX_FILE_SIZE = 15 * 1024 * 1024 // safety net after client-side compression'
)

// Update the upload loop to compress each file before checking size / uploading
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
      if (uploadErr) { continue }`

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
      if (uploadErr) { continue }`

if (!content.includes(oldLoop)) {
  console.log('ERROR: upload loop block not found')
  process.exit(1)
}
content = content.replace(oldLoop, newLoop)

// Remove the old pre-upload oversized rejection block since compression handles this now (only reject truly extreme originals over 30MB before even trying to compress, to avoid hanging the browser)
const oldOversizedCheck = `    const oversized = files.filter(f => f.size > MAX_FILE_SIZE)
    if (oversized.length > 0) {
      setUploadError(\`\${oversized.length} file(s) exceed the 5 MB limit.\`)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }`

const newOversizedCheck = `    const extremelyOversized = files.filter(f => f.size > 30 * 1024 * 1024)
    if (extremelyOversized.length > 0) {
      setUploadError(\`\${extremelyOversized.length} file(s) are too large to process (over 30 MB).\`)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }`

if (content.includes(oldOversizedCheck)) {
  content = content.replace(oldOversizedCheck, newOversizedCheck)
} else {
  console.log('WARNING: oversized check block not found, skipped (not fatal)')
}

fs.writeFileSync('components/Memories.tsx', content, 'utf8')
console.log('Done. Memories.tsx now compresses images client-side before upload.')
