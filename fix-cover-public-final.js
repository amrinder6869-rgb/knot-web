const fs = require('fs')
const path = require('path')

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web', 'app', 'dashboard', 'page.tsx')
let src = fs.readFileSync(filePath, 'utf8')

// 1. useEffect: for covers, just use the URL directly (public) — no signing needed
src = src.replace(
  `  useEffect(() => {
    if (!activeKnot?.cover_url) { setCoverSignedUrl(null); return }
    const raw = activeKnot.cover_url
    // Always extract storage path — strip dead public URLs to path
    let storagePath = raw
    if (raw.includes('/object/public/knot-photos/')) {
      storagePath = raw.split('/object/public/knot-photos/')[1]
    } else if (raw.includes('/object/sign/knot-photos/')) {
      storagePath = raw.split('/object/sign/knot-photos/')[1].split('?')[0]
    }
    getSignedUrl(storagePath).then(url => setCoverSignedUrl(url ?? null))
  }, [activeKnot?.cover_url])`,
  `  useEffect(() => {
    if (!activeKnot?.cover_url) { setCoverSignedUrl(null); return }
    const raw = activeKnot.cover_url
    if (raw.startsWith('http')) {
      setCoverSignedUrl(raw)
    } else {
      // storage path — build public URL (covers bucket has open read policy)
      setCoverSignedUrl('https://vcrnktkttgprbnoyjeff.supabase.co/storage/v1/object/public/knot-photos/' + raw)
    }
  }, [activeKnot?.cover_url])`
)

// 2. Upload handler: store full public URL in DB and state
src = src.replace(
  `; await supabase.from('knots').update({ cover_url: path }).eq('id', activeKnot.id); const updated = { ...activeKnot, cover_url: path }; setActiveKnot(updated); setKnots(ks => ks.map(k => k.id === activeKnot.id ? updated : k))`,
  `; const publicCoverUrl = 'https://vcrnktkttgprbnoyjeff.supabase.co/storage/v1/object/public/knot-photos/' + path; await supabase.from('knots').update({ cover_url: publicCoverUrl }).eq('id', activeKnot.id); const updated = { ...activeKnot, cover_url: publicCoverUrl }; setActiveKnot(updated); setKnots(ks => ks.map(k => k.id === activeKnot.id ? updated : k))`
)

fs.writeFileSync(filePath, src, 'utf8')
console.log('Done. Run: npm run build')
