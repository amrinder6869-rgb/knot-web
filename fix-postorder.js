const fs = require('fs')
let content = fs.readFileSync('components/Composer.tsx', 'utf8')

// The current order is: insert hangout -> insert post -> update hangout.post_id
// The 409 on the hangout update is because we're trying to set post_id on a record
// that may have an RLS issue or the update is conflicting
// Fix: insert post first without hangout_id, then update both

const oldBlock = `      const { error: postError } = await supabase.from('posts').insert({
        knot_id:    knotId,
        author_id:  authUser.id,
        hangout_id: h.id,
        content,
        post_type:  'hangout',
      })
      if (postError) console.error('Post insert error:', postError)

      await supabase.from('hangouts').update({ post_id: h.id }).eq('id', h.id)`

const newBlock = `      const { data: newPost, error: postError } = await supabase.from('posts').insert({
        knot_id:    knotId,
        author_id:  authUser.id,
        hangout_id: h.id,
        content,
        post_type:  'hangout',
      }).select('id').single()
      if (postError) {
        console.error('Post insert error:', JSON.stringify(postError))
      } else if (newPost) {
        const { error: updateError } = await supabase
          .from('hangouts')
          .update({ post_id: newPost.id })
          .eq('id', h.id)
        if (updateError) console.error('Hangout update error:', JSON.stringify(updateError))
      }`

const fixed = content.replace(oldBlock, newBlock)

if (fixed === content) {
  console.log('ERROR: Could not find the block to replace. Checking what is in the file...')
  const lines = content.split('\n')
  lines.forEach((line, i) => {
    if (line.includes('postError') || line.includes('post_id')) {
      console.log(`${i + 1}: ${line}`)
    }
  })
  process.exit(1)
}

fs.writeFileSync('components/Composer.tsx', fixed, 'utf8')
console.log('Done. Post insert now logs full error and hangout update order fixed.')
