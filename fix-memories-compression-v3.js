const fs = require('fs')

// Normalize line endings first — CRLF vs LF was likely breaking the exact string match
let raw = fs.readFileSync('components/Memories.tsx', 'utf8')
const hadCRLF = raw.includes('\r\n')
raw = raw.replace(/\r\n/g, '\n')

let lines = raw.split('\n')

// Add compressImage import if not already present
if (!raw.includes('compressImage')) {
  const importLineIdx = lines.findIndex(l => l.includes("import { supabase } from '@/lib/supabase'"))
  if (importLineIdx === -1) {
    console.log('ERROR: could not find supabase import line')
    process.exit(1)
  }
  lines.splice(importLineIdx + 1, 0, "import { compressImage } from '@/lib/compressImage'")
}

raw = lines.join('\n')
lines = raw.split('\n')

// Bump MAX_FILE_SIZE
raw = raw.replace(
  'const MAX_FILE_SIZE = 5 * 1024 * 1024',
  'const MAX_FILE_SIZE = 15 * 1024 * 1024 // safety net after client-side compression'
)
lines = raw.split('\n')

// Find the oversized-rejection block by locating the line containing "files.filter(f => f.size > MAX_FILE_SIZE)"
const oversizedIdx = lines.findIndex(l => l.includes('files.filter(f => f.size > MAX_FILE_SIZE)'))
if (oversizedIdx === -1) {
  console.log('ERROR: could not locate oversized filter line')
  process.exit(1)
}
// That block spans from oversizedIdx to oversizedIdx+5 (the closing brace), based on confirmed structure:
// const oversized = ...
// if (oversized.length > 0) {
//   setUploadError(...)
//   if (fileInputRef...) ...
//   return
// }
const oversizedBlock = lines.slice(oversizedIdx, oversizedIdx + 6).join('\n')
console.log('--- Block found at line ' + (oversizedIdx + 1) + ' ---')
console.log(oversizedBlock)

const newOversizedBlock = [
  '    const extremelyOversized = files.filter(f => f.size > 30 * 1024 * 1024)',
  '    if (extremelyOversized.length > 0) {',
  "      setUploadError(`${extremelyOversized.length} file(s) are too large to process (over 30 MB).`)",
  "      if (fileInputRef.current) fileInputRef.current.value = ''",
  '      return',
  '    }',
].join('\n')

lines.splice(oversizedIdx, 6, ...newOversizedBlock.split('\n'))
raw = lines.join('\n')
lines = raw.split('\n')

// Find the upload loop start
const loopStartIdx = lines.findIndex(l => l.trim() === 'for (const file of files) {')
if (loopStartIdx === -1) {
  console.log('ERROR: could not locate the upload for-loop line')
  process.exit(1)
}
console.log('--- Loop starts at line ' + (loopStartIdx + 1) + ' ---')

// Replace just that one line to compress before processing
lines[loopStartIdx] = '    for (const rawFile of files) {\n      const file = await compressImage(rawFile)\n      if (file.size > MAX_FILE_SIZE) { continue }'

raw = lines.join('\n')

if (hadCRLF) raw = raw.replace(/\n/g, '\r\n')

fs.writeFileSync('components/Memories.tsx', raw, 'utf8')
console.log('Done. Memories.tsx patched successfully.')
