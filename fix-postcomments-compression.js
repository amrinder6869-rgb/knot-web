const fs = require('fs')
let content = fs.readFileSync('components/PostComments.tsx', 'utf8')

content = content.replace(
  "import { supabase } from '@/lib/supabase'",
  "import { supabase } from '@/lib/supabase'\nimport { compressImage } from '@/lib/compressImage'"
)

const oldUpload = `    let photoPath: string | null = null
    let photoUrl: string | null = null
    if (commentPhoto) {
      const ext = commentPhoto.name.split('.').pop()
      const path = \`comments/\${postId}/\${Date.now()}.\${ext}\`
      const { error: uploadError } = await supabase.storage.from('knot-photos').upload(path, commentPhoto)
      if (uploadError) {
        setError('Photo upload failed. Comment not posted.')
        setSubmitting(false)
        return
      }
      photoPath = path
      const { data: { publicUrl } } = supabase.storage.from('knot-photos').getPublicUrl(path)
      photoUrl = publicUrl
    }`

const newUpload = `    let photoPath: string | null = null
    let photoUrl: string | null = null
    if (commentPhoto) {
      const compressed = await compressImage(commentPhoto)
      const ext = compressed.name.split('.').pop()
      const path = \`comments/\${postId}/\${Date.now()}.\${ext}\`
      const { error: uploadError } = await supabase.storage.from('knot-photos').upload(path, compressed)
      if (uploadError) {
        setError('Photo upload failed. Comment not posted.')
        setSubmitting(false)
        return
      }
      photoPath = path
      const { data: { publicUrl } } = supabase.storage.from('knot-photos').getPublicUrl(path)
      photoUrl = publicUrl
    }`

if (!content.includes(oldUpload)) {
  console.log('ERROR: PostComments photo upload block not found')
  process.exit(1)
}
content = content.replace(oldUpload, newUpload)

fs.writeFileSync('components/PostComments.tsx', content, 'utf8')
console.log('Done. PostComments photo upload now compresses first.')
