const fs = require('fs')
const path = require('path')

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web', 'app', 'dashboard', 'page.tsx')
let src = fs.readFileSync(filePath, 'utf8')

// 1. Upload handler: after upload, get public URL and store full URL in DB and state
src = src.replace(
  `; await supabase.from('knots').update({ cover_url: path }).eq('id', activeKnot.id); const updated = { ...activeKnot, cover_url: path }; setActiveKnot(updated); setKnots(ks => ks.map(k => k.id === activeKnot.id ? updated : k))`,
  `; const { data: { publicUrl: coverPublicUrl } } = supabase.storage.from('knot-photos').getPublicUrl(path); await supabase.from('knots').update({ cover_url: coverPublicUrl }).eq('id', activeKnot.id); const updated = { ...activeKnot, cover_url: coverPublicUrl }; setActiveKnot(updated); setKnots(ks => ks.map(k => k.id === activeKnot.id ? updated : k))`
)

// 2. useEffect: if it's a storage path, get public URL instead of signed URL
src = src.replace(
  `  useEffect(() => {
    if (!activeKnot?.cover_url) { setCoverSignedUrl(null); return }
    const raw = activeKnot.cover_url
    if (raw.startsWith('http')) {
      // already a full URL — use as-is (legacy or freshly signed)
      setCoverSignedUrl(raw)
    } else {
      getSignedUrl(raw).then(url => setCoverSignedUrl(url ?? null))
    }
  }, [activeKnot?.cover_url])`,
  `  useEffect(() => {
    if (!activeKnot?.cover_url) { setCoverSignedUrl(null); return }
    const raw = activeKnot.cover_url
    if (raw.startsWith('http')) {
      setCoverSignedUrl(raw)
    } else {
      // storage path — get public URL for covers (covers are intentionally public)
      const { data: { publicUrl } } = supabase.storage.from('knot-photos').getPublicUrl(raw)
      setCoverSignedUrl(publicUrl)
    }
  }, [activeKnot?.cover_url])`
)

// 3. Also fix the knotList mount signing to use public URL for covers
src = src.replace(
  `        const knotList = await Promise.all(knotListRaw.map(async (k: any) => {
          if (k.cover_url && !k.cover_url.startsWith('http')) {
            const signed = await getSignedUrl(k.cover_url)
            return { ...k, cover_url: signed ?? null }
          }
          return k
        }))`,
  `        const knotList = knotListRaw.map((k: any) => {
          if (k.cover_url && !k.cover_url.startsWith('http')) {
            const { data: { publicUrl } } = supabase.storage.from('knot-photos').getPublicUrl(k.cover_url)
            return { ...k, cover_url: publicUrl }
          }
          return k
        })`
)

fs.writeFileSync(filePath, src, 'utf8')
console.log('Done. Run: npm run build')
