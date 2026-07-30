const fs = require('fs')
const path = require('path')
const https = require('https')

const LOCAL = path.join('C:\\Users\\amrin\\Documents\\knot-web', 'components', 'HangoutCard.tsx')

function fetchRaw(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => resolve(data))
    }).on('error', reject)
  })
}

async function main() {
  const lines = fs.readFileSync(LOCAL, 'utf8').split('\n')

  // Find the insert block inside addComment
  const insertIdx = lines.findIndex(l => l.includes(".from('comments')") && lines[lines.indexOf(l) + 1]?.includes('.insert('))

  // Find the line: const { data: newC, error } = await supabase
  const supabaseInsertIdx = lines.findIndex(l => l.includes('const { data: newC, error }') && l.includes('await supabase'))
  if (supabaseInsertIdx === -1) { console.log('ERROR: could not find insert line'); process.exit(1) }

  // Find the .select().single() line — it should be 3 lines after
  let selectIdx = -1
  for (let i = supabaseInsertIdx; i < supabaseInsertIdx + 6; i++) {
    if (lines[i] && lines[i].includes('.select()') && lines[i].includes('.single()')) {
      selectIdx = i
      break
    }
  }

  console.log('supabaseInsertIdx line', supabaseInsertIdx + 1, ':', lines[supabaseInsertIdx].trim())
  if (selectIdx !== -1) console.log('selectIdx line', selectIdx + 1, ':', lines[selectIdx].trim())

  // Replace the whole block: from const { data: newC, error } to .single()
  // with a version that does not use select().single()
  // Find end of the insert call
  let insertCallEnd = supabaseInsertIdx
  for (let i = supabaseInsertIdx; i < supabaseInsertIdx + 8; i++) {
    if (lines[i] && (lines[i].includes('.single()') || (lines[i].includes(')') && i > supabaseInsertIdx + 2))) {
      if (lines[i].includes('.single()')) {
        insertCallEnd = i
        break
      }
    }
  }

  console.log('Replacing lines', supabaseInsertIdx + 1, 'to', insertCallEnd + 1)

  // New lines: insert without select, handle error separately
  const newInsert = [
    `    const { error } = await supabase\r`,
    `      .from('comments')\r`,
    `      .insert({ post_id: post.id, author_id: currentUser.id, content: parts.join(' ') || null, photo_path: photoPath })\r`,
  ]

  // Remove old lines and insert new ones
  lines.splice(supabaseInsertIdx, insertCallEnd - supabaseInsertIdx + 1, ...newInsert)

  // Now find the line that uses newC: setComments(prev => [...prev, { ...newC, ...
  const newCIdx = lines.findIndex(l => l.includes('...newC,'))
  if (newCIdx !== -1) {
    console.log('Replacing newC reference at line', newCIdx + 1)
    lines[newCIdx] = lines[newCIdx].replace(
      '...newC,',
      `id: crypto.randomUUID(), post_id: post.id, author_id: currentUser.id, content: parts.join(' ') || null, photo_path: photoPath, created_at: new Date().toISOString(),`
    )
  }

  fs.writeFileSync(LOCAL, lines.join('\n'), 'utf8')
  console.log('Fixed. Run: npm run build')
}

main().catch(console.error)
