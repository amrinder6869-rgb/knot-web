const fs = require('fs')
const path = require('path')

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web', 'app', 'dashboard', 'page.tsx')
let src = fs.readFileSync(filePath, 'utf8')

// Fix 1: knotList mount — replace sync publicUrl conversion with pass-through
// The useEffect will handle signing asynchronously
src = src.replace(
  `        const knotList = knotListRaw.map((k: any) => {
          if (k.cover_url && !k.cover_url.startsWith('http')) {
            const { data: { publicUrl } } = supabase.storage.from('knot-photos').getPublicUrl(k.cover_url)
            return { ...k, cover_url: publicUrl }
          }
          return k
        })`,
  `        const knotList = knotListRaw`
)

// Fix 2: useEffect — replace getPublicUrl with getSignedUrl
src = src.replace(
  `    if (raw.startsWith('http')) {
      setCoverSignedUrl(raw)
    } else {
      // storage path — get public URL for covers (covers are intentionally public)
      const { data: { publicUrl } } = supabase.storage.from('knot-photos').getPublicUrl(raw)
      setCoverSignedUrl(publicUrl)
    }`,
  `    // Always extract storage path — strip dead public URLs to path
    let storagePath = raw
    if (raw.includes('/object/public/knot-photos/')) {
      storagePath = raw.split('/object/public/knot-photos/')[1]
    } else if (raw.includes('/object/sign/knot-photos/')) {
      storagePath = raw.split('/object/sign/knot-photos/')[1].split('?')[0]
    }
    getSignedUrl(storagePath).then(url => setCoverSignedUrl(url ?? null))`
)

// Fix 3: upload handler — store path not publicUrl in DB and state
src = src.replace(
  `; const { data: { publicUrl: coverPublicUrl } } = supabase.storage.from('knot-photos').getPublicUrl(path); await supabase.from('knots').update({ cover_url: coverPublicUrl }).eq('id', activeKnot.id); const updated = { ...activeKnot, cover_url: coverPublicUrl }; setActiveKnot(updated); setKnots(ks => ks.map(k => k.id === activeKnot.id ? updated : k))`,
  `; await supabase.from('knots').update({ cover_url: path }).eq('id', activeKnot.id); const updated = { ...activeKnot, cover_url: path }; setActiveKnot(updated); setKnots(ks => ks.map(k => k.id === activeKnot.id ? updated : k))`
)

fs.writeFileSync(filePath, src, 'utf8')
console.log('Done. Run: npm run build')
