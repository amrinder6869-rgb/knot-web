const fs = require('fs')
let content = fs.readFileSync('components/Composer.tsx', 'utf8')

content = content.replace(
  "import Discover from '@/components/Discover'",
  "import Discover from '@/components/Discover'\nimport { compressImage } from '@/lib/compressImage'"
)

const oldUpload = `    if (momentPhoto) {
      const ext = momentPhoto.name.split('.').pop()
      const path = \`\${knotId}/\${user.id}/\${Date.now()}-\${Math.random().toString(36).substring(7)}.\${ext}\`
      const { error: uploadError } = await supabase.storage.from('knot-photos').upload(path, momentPhoto)
      if (!uploadError) {
        await supabase.from('photos').insert({
          knot_id:      knotId,
          post_id:      newPost.id,
          uploaded_by:  user.id,
          storage_path: path,
          file_name:    momentPhoto.name,
          file_size:    momentPhoto.size,
        })
      }
    }`

const newUpload = `    if (momentPhoto) {
      const compressed = await compressImage(momentPhoto)
      const ext = compressed.name.split('.').pop()
      const path = \`\${knotId}/\${user.id}/\${Date.now()}-\${Math.random().toString(36).substring(7)}.\${ext}\`
      const { error: uploadError } = await supabase.storage.from('knot-photos').upload(path, compressed)
      if (!uploadError) {
        await supabase.from('photos').insert({
          knot_id:      knotId,
          post_id:      newPost.id,
          uploaded_by:  user.id,
          storage_path: path,
          file_name:    compressed.name,
          file_size:    compressed.size,
        })
      }
    }`

if (!content.includes(oldUpload)) {
  console.log('ERROR: moment photo upload block not found')
  process.exit(1)
}
content = content.replace(oldUpload, newUpload)

fs.writeFileSync('components/Composer.tsx', content, 'utf8')
console.log('Done. Composer moment photo upload now compresses first.')
