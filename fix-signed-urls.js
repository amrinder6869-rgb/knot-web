const fs = require('fs')
const path = require('path')

const BASE = 'C:\\Users\\amrin\\Documents\\knot-web'

function readFile(relPath) {
  return fs.readFileSync(path.join(BASE, relPath), 'utf8')
}

function writeFile(relPath, content) {
  fs.writeFileSync(path.join(BASE, relPath), content, 'utf8')
  console.log('UPDATED: ' + relPath)
}

function replaceLines(content, oldLine, newLine) {
  if (!content.includes(oldLine)) {
    console.warn('WARNING: could not find line to replace: ' + oldLine.trim())
    return content
  }
  return content.split(oldLine).join(newLine)
}

// ─── lib/supabase.ts ──────────────────────────────────────────────────────────
// Add a getSignedUrl helper

let supabaseLib = readFile('lib/supabase.ts')
if (!supabaseLib.includes('getSignedUrl')) {
  supabaseLib = supabaseLib.trimEnd() + `

export async function getSignedUrl(storagePath: string | null | undefined, expiresIn = 3600): Promise<string | null> {
  if (!storagePath) return null
  // If already a full URL (legacy data), extract the path after /knot-photos/
  let resolvedPath = storagePath
  if (storagePath.startsWith('http')) {
    const match = storagePath.match(/knot-photos\\/(.+)$/)
    if (!match) return null
    resolvedPath = match[1]
  }
  const { data, error } = await supabase.storage.from('knot-photos').createSignedUrl(resolvedPath, expiresIn)
  if (error || !data) return null
  return data.signedUrl
}
`
  writeFile('lib/supabase.ts', supabaseLib)
} else {
  console.log('SKIP: lib/supabase.ts already has getSignedUrl')
}

// ─── components/Memories.tsx ──────────────────────────────────────────────────

let memories = readFile('components/Memories.tsx')

if (!memories.includes('getSignedUrl')) {
  memories = memories.replace(
    `import { supabase } from '@/lib/supabase'`,
    `import { supabase, getSignedUrl } from '@/lib/supabase'`
  )
  memories = memories.replace(
    `const { data: { publicUrl } } = supabase.storage.from('knot-photos').getPublicUrl(p.storage_path)\n        photoMap.set(p.post_id, { id: p.id, storage_path: p.storage_path, url: publicUrl })`,
    `const signedUrl = await getSignedUrl(p.storage_path)\n        photoMap.set(p.post_id, { id: p.id, storage_path: p.storage_path, url: signedUrl ?? '' })`
  )
  // Second getPublicUrl in Memories (if any)
  memories = memories.replace(
    /const \{ data: \{ publicUrl \} \} = supabase\.storage\.from\('knot-photos'\)\.getPublicUrl\(([^)]+)\)/g,
    (match, arg) => `const signedUrl = await getSignedUrl(${arg})`
  ).replace(
    /url: publicUrl/g,
    'url: signedUrl ?? \'\''
  ).replace(
    /photoUrl: publicUrl/g,
    'photoUrl: signedUrl ?? \'\''
  )
  writeFile('components/Memories.tsx', memories)
}

// ─── components/Feed.tsx ──────────────────────────────────────────────────────

let feed = readFile('components/Feed.tsx')

if (!feed.includes('getSignedUrl')) {
  feed = feed.replace(
    `import { supabase } from '@/lib/supabase'`,
    `import { supabase, getSignedUrl } from '@/lib/supabase'`
  )
  // Replace all getPublicUrl calls in Feed
  feed = feed.replace(
    /const \{ data: \{ publicUrl \} \} = supabase\.storage\.from\('knot-photos'\)\.getPublicUrl\(([^)]+)\)/g,
    (match, arg) => `const signedUrl = await getSignedUrl(${arg})`
  )
  feed = feed.replace(/url: publicUrl/g, 'url: signedUrl ?? \'\'')
  feed = feed.replace(/photo_url: publicUrl/g, 'photo_url: signedUrl ?? \'\'')
  feed = feed.replace(/return \{ \.\.\.c, photo_url: publicUrl \}/g, 'return { ...c, photo_url: signedUrl ?? \'\' }')
  writeFile('components/Feed.tsx', feed)
}

// ─── components/HangoutCard.tsx ───────────────────────────────────────────────

let hangoutCard = readFile('components/HangoutCard.tsx')

if (!hangoutCard.includes('getSignedUrl')) {
  hangoutCard = hangoutCard.replace(
    `import { supabase } from '@/lib/supabase'`,
    `import { supabase, getSignedUrl } from '@/lib/supabase'`
  )
  // HangoutCard uploads and then immediately displays — change to store path, get signed URL
  hangoutCard = hangoutCard.replace(
    `const { data: { publicUrl } } = supabase.storage.from('knot-photos').getPublicUrl(path)`,
    `const signedUrl = await getSignedUrl(path)`
  )
  hangoutCard = hangoutCard.replace(/photo_url: publicUrl/g, 'photo_url: signedUrl ?? \'\'')
  hangoutCard = hangoutCard.replace(/url: publicUrl/g, 'url: signedUrl ?? \'\'')
  writeFile('components/HangoutCard.tsx', hangoutCard)
}

// ─── components/HomeFeed.tsx ──────────────────────────────────────────────────

let homeFeed = readFile('components/HomeFeed.tsx')

if (!homeFeed.includes('getSignedUrl')) {
  homeFeed = homeFeed.replace(
    `import { supabase } from '@/lib/supabase'`,
    `import { supabase, getSignedUrl } from '@/lib/supabase'`
  )
  homeFeed = homeFeed.replace(
    /const \{ data: \{ publicUrl \} \} = supabase\.storage\.from\('knot-photos'\)\.getPublicUrl\(([^)]+)\)/g,
    (match, arg) => `const signedUrl = await getSignedUrl(${arg})`
  )
  homeFeed = homeFeed.replace(/url: publicUrl/g, 'url: signedUrl ?? \'\'')
  writeFile('components/HomeFeed.tsx', homeFeed)
}

// ─── components/PostHangoutLoop.tsx ──────────────────────────────────────────

let postHangout = readFile('components/PostHangoutLoop.tsx')

if (!postHangout.includes('getSignedUrl')) {
  postHangout = postHangout.replace(
    `import { supabase } from '@/lib/supabase'`,
    `import { supabase, getSignedUrl } from '@/lib/supabase'`
  )
  postHangout = postHangout.replace(
    /const \{ data: \{ publicUrl \} \} = supabase\.storage\.from\('knot-photos'\)\.getPublicUrl\(([^)]+)\)/g,
    (match, arg) => `const signedUrl = await getSignedUrl(${arg})`
  )
  postHangout = postHangout.replace(/url: publicUrl/g, 'url: signedUrl ?? \'\'')
  postHangout = postHangout.replace(/photoUrl: publicUrl/g, 'photoUrl: signedUrl ?? \'\'')
  writeFile('components/PostHangoutLoop.tsx', postHangout)
}

// ─── components/PostComments.tsx ──────────────────────────────────────────────

let postComments = readFile('components/PostComments.tsx')

if (!postComments.includes('getSignedUrl')) {
  postComments = postComments.replace(
    `import { supabase } from '@/lib/supabase'`,
    `import { supabase, getSignedUrl } from '@/lib/supabase'`
  )
  postComments = postComments.replace(
    /const \{ data: \{ publicUrl \} \} = supabase\.storage\.from\('knot-photos'\)\.getPublicUrl\(([^)]+)\)/g,
    (match, arg) => `const signedUrl = await getSignedUrl(${arg})`
  )
  postComments = postComments.replace(/photo_url: publicUrl/g, 'photo_url: signedUrl ?? \'\'')
  postComments = postComments.replace(/url: publicUrl/g, 'url: signedUrl ?? \'\'')
  writeFile('components/PostComments.tsx', postComments)
}

// ─── lib/hangoutBundle.ts ─────────────────────────────────────────────────────

let bundle = readFile('lib/hangoutBundle.ts')

if (!bundle.includes('getSignedUrl')) {
  bundle = bundle.replace(
    `import { supabase } from '@/lib/supabase'`,
    `import { supabase, getSignedUrl } from '@/lib/supabase'`
  )
  bundle = bundle.replace(
    `const { data: { publicUrl } } = supabase.storage.from('knot-photos').getPublicUrl(c.photo_path)\n      c.photo_url = publicUrl`,
    `const signedUrl = await getSignedUrl(c.photo_path)\n      c.photo_url = signedUrl ?? ''`
  )
  writeFile('lib/hangoutBundle.ts', bundle)
}

// ─── app/dashboard/page.tsx ───────────────────────────────────────────────────
// Two fixes:
// 1. Avatar upload: store path not full URL
// 2. Cover upload: store path not full URL
// 3. Display: use getSignedUrl on avatar_url and cover_url at fetch time

let dashboard = readFile('app/dashboard/page.tsx')

if (!dashboard.includes('getSignedUrl')) {
  dashboard = dashboard.replace(
    `import { supabase } from '@/lib/supabase'`,
    `import { supabase, getSignedUrl } from '@/lib/supabase'`
  )

  // Avatar upload — store path, then get signed URL for display
  dashboard = dashboard.replace(
    `const safePath = \`avatars/\${user.id}.\${ext}\``,
    `const safePath = \`avatars/\${user.id}.\${ext}\``
  )
  dashboard = dashboard.replace(
    `await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id)\n                    setProfile((p: any) => ({ ...p, avatar_url: publicUrl }))`,
    `const signedAvatarUrl = await getSignedUrl(safePath)\n                    await supabase.from('profiles').update({ avatar_url: safePath }).eq('id', user.id)\n                    setProfile((p: any) => ({ ...p, avatar_url: signedAvatarUrl ?? safePath }))`
  )

  // Cover upload — store path, then get signed URL for display
  dashboard = dashboard.replace(
    `const { data: { publicUrl } } = supabase.storage.from('knot-photos').getPublicUrl(path);\n await supabase.from('knots').update({ cover_url: publicUrl }).eq('id', activeKnot.id); const updated = { ...activeKnot, cover_url: publicUrl }`,
    `const signedCoverUrl = await getSignedUrl(path);\n await supabase.from('knots').update({ cover_url: path }).eq('id', activeKnot.id); const updated = { ...activeKnot, cover_url: signedCoverUrl ?? path }`
  )

  // Second cover upload (the safePath one)
  dashboard = dashboard.replace(
    /const \{ data: \{ publicUrl \} \} = supabase\.storage\.from\('knot-photos'\)\.getPublicUrl\(safePath\)\s*\n(\s*)await supabase\.from\('profiles'\)/,
    `const signedUrl = await getSignedUrl(safePath)\n$1await supabase.from('profiles')`
  )
  dashboard = dashboard.replace(
    `await supabase.from('profiles').update({ avatar_url: publicUrl })`,
    `await supabase.from('profiles').update({ avatar_url: safePath })`
  )
  dashboard = dashboard.replace(
    `setProfile((p: any) => ({ ...p, avatar_url: publicUrl }))`,
    `setProfile((p: any) => ({ ...p, avatar_url: signedUrl ?? safePath }))`
  )

  writeFile('app/dashboard/page.tsx', dashboard)
}

// ─── Done ─────────────────────────────────────────────────────────────────────

console.log('\nAll files patched.')
console.log('Run: npm run build')
console.log('If build passes, run: git add -A && "C:\\Program Files\\Git\\bin\\git.exe" commit -m "fix: migrate storage to signed URLs, make knot-photos bucket private" && "C:\\Program Files\\Git\\bin\\git.exe" push')
