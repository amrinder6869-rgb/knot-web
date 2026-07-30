const fs = require('fs')
const path = require('path')

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web', 'app', 'dashboard', 'page.tsx')
let src = fs.readFileSync(filePath, 'utf8')

// 1. useEffect: just use cover_url directly — it will always be a full public URL
src = src.replace(
  `  useEffect(() => {
    if (!activeKnot?.cover_url) { setCoverSignedUrl(null); return }
    const raw = activeKnot.cover_url
    if (raw.startsWith('http')) {
      setCoverSignedUrl(raw)
    } else {
      // storage path — build public URL (covers bucket has open read policy)
      setCoverSignedUrl('https://vcrnktkttgprbnoyjeff.supabase.co/storage/v1/object/public/knot-photos/' + raw)
    }
  }, [activeKnot?.cover_url])`,
  `  useEffect(() => {
    setCoverSignedUrl(activeKnot?.cover_url ?? null)
  }, [activeKnot?.cover_url])`
)

// 2. Upload handler: target knot-covers bucket, store full public URL
src = src.replace(
  `const path = 'covers/' + activeKnot.id + '.' + ext; const { error: upErr } = await supabase.storage.from('knot-photos').upload(path, file, { upsert: true, contentType: safeType }); if (upErr) { alert('Upload failed'); return }; const publicCoverUrl = 'https://vcrnktkttgprbnoyjeff.supabase.co/storage/v1/object/public/knot-photos/' + path; await supabase.from('knots').update({ cover_url: publicCoverUrl }).eq('id', activeKnot.id); const updated = { ...activeKnot, cover_url: publicCoverUrl }; setActiveKnot(updated); setKnots(ks => ks.map(k => k.id === activeKnot.id ? updated : k))`,
  `const coverPath = activeKnot.id + '.' + ext; const { error: upErr } = await supabase.storage.from('knot-covers').upload(coverPath, file, { upsert: true, contentType: safeType }); if (upErr) { alert('Upload failed'); return }; const publicCoverUrl = 'https://vcrnktkttgprbnoyjeff.supabase.co/storage/v1/object/public/knot-covers/' + coverPath; await supabase.from('knots').update({ cover_url: publicCoverUrl }).eq('id', activeKnot.id); const updated = { ...activeKnot, cover_url: publicCoverUrl }; setActiveKnot(updated); setKnots(ks => ks.map(k => k.id === activeKnot.id ? updated : k))`
)

fs.writeFileSync(filePath, src, 'utf8')
console.log('Done. Run: npm run build')
