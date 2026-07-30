const fs = require('fs')
const path = require('path')

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web', 'app', 'dashboard', 'page.tsx')
let src = fs.readFileSync(filePath, 'utf8')

// Fix 1: make logo div clickable
src = src.replace(
  `        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>`,
  `        <div onClick={() => { setShowHome(true); setActiveKnot(null); localStorage.setItem('show_home', 'true') }} style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, cursor: 'pointer' }}>`
)

// Fix 2: cover upload — replace getPublicUrl with getSignedUrl after upload
src = src.replace(
  `; const { data: { publicUrl } } = supabase.storage.from('knot-photos').getPublicUrl(path); await supabase.from('knots').update({ cover_url: publicUrl }).eq('id', activeKnot.id); const updated = { ...activeKnot, cover_url: publicUrl }; setActiveKnot(updated); setKnots(ks => ks.map(k => k.id === activeKnot.id ? updated : k)) }}`,
  `; const signedCoverUrl = await getSignedUrl(path); if (!signedCoverUrl) { alert('Could not get cover URL'); return }; await supabase.from('knots').update({ cover_url: path }).eq('id', activeKnot.id); const updated = { ...activeKnot, cover_url: signedCoverUrl }; setActiveKnot(updated); setKnots(ks => ks.map(k => k.id === activeKnot.id ? updated : k)) }}`
)

// Fix 3: on mount, resolve cover_url to signed URL for each knot loaded from DB
// The knots are loaded and cover_url stored as a path — sign it when setting activeKnot
// We do this by adding a helper that resolves cover URLs after knots load
// Find where knots are set after fetch and sign cover URLs
src = src.replace(
  `const knotList = (data || []).map((k: any) => ({
          id: k.id, name: k.name, emoji: k.emoji || '🔗',
          count: k.knot_members?.[0]?.count ?? 0,
          created_by: k.created_by,
          cover_url: k.cover_url,
        }))`,
  `const knotListRaw = (data || []).map((k: any) => ({
          id: k.id, name: k.name, emoji: k.emoji || '🔗',
          count: k.knot_members?.[0]?.count ?? 0,
          created_by: k.created_by,
          cover_url: k.cover_url,
        }))
        const knotList = await Promise.all(knotListRaw.map(async (k: any) => {
          if (k.cover_url && !k.cover_url.startsWith('http')) {
            const signed = await getSignedUrl(k.cover_url)
            return { ...k, cover_url: signed ?? k.cover_url }
          }
          return k
        }))`
)

fs.writeFileSync(filePath, src, 'utf8')
console.log('Done. Run: npm run build')
