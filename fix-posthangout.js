const fs = require('fs')
const lines = fs.readFileSync('components/Composer.tsx', 'utf8').split('\n')

// Find the postHangout function and add auth check + error handling
// Replace the hangout post insert block to fetch auth user directly
const content = lines.join('\n')

// Replace the posts insert block in postHangout to use getUser and log errors
const oldBlock = `    const { data: h } = await supabase.from('hangouts').insert({
      knot_id:          knotId,
      created_by:       currentUser.id,`

const newBlock = `    // Re-fetch authenticated user to ensure we have a valid session
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) { setCreating(false); return }

    const { data: h, error: hangoutError } = await supabase.from('hangouts').insert({
      knot_id:          knotId,
      created_by:       authUser.id,`

const fixed = content.replace(oldBlock, newBlock)

if (fixed === content) {
  console.log('ERROR: Could not find the hangout insert block to replace')
  process.exit(1)
}

// Also fix the posts insert to use authUser.id and log errors
const oldPostInsert = `      await supabase.from('posts').insert({
        knot_id:    knotId,
        author_id:  currentUser.id,
        hangout_id: h.id,
        content,
        post_type:  'hangout',
      })`

const newPostInsert = `      const { error: postError } = await supabase.from('posts').insert({
        knot_id:    knotId,
        author_id:  authUser.id,
        hangout_id: h.id,
        content,
        post_type:  'hangout',
      })
      if (postError) console.error('Post insert error:', postError)`

const fixed2 = fixed.replace(oldPostInsert, newPostInsert)

if (fixed2 === fixed) {
  console.log('ERROR: Could not find the posts insert block to replace')
  process.exit(1)
}

// Fix notifyKnotMembers to use authUser.id
const fixed3 = fixed2.replace(
  `      await notifyKnotMembers({
        knotId,
        actorId:  currentUser.id,`,
  `      await notifyKnotMembers({
        knotId,
        actorId:  authUser.id,`
)

fs.writeFileSync('components/Composer.tsx', fixed3, 'utf8')
console.log('Done. postHangout now uses authUser and logs errors.')
