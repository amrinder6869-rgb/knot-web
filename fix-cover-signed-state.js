const fs = require('fs')
const path = require('path')

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web', 'app', 'dashboard', 'page.tsx')
let src = fs.readFileSync(filePath, 'utf8')

// 1. Add coverSignedUrl state after recentMedia
src = src.replace(
  `  const [recentMedia, setRecentMedia]       = useState<{ id: string; url: string; media_type: string }[]>([])`,
  `  const [recentMedia, setRecentMedia]       = useState<{ id: string; url: string; media_type: string }[]>([])
  const [coverSignedUrl, setCoverSignedUrl] = useState<string | null>(null)`
)

// 2. Add useEffect to sign cover URL whenever activeKnot changes
//    Insert after the existing useEffect that saves active_tab to localStorage
src = src.replace(
  `  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('active_tab', active)
  }, [active])`,
  `  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('active_tab', active)
  }, [active])

  useEffect(() => {
    if (!activeKnot?.cover_url) { setCoverSignedUrl(null); return }
    const raw = activeKnot.cover_url
    if (raw.startsWith('http')) {
      // already a full URL — use as-is (legacy or freshly signed)
      setCoverSignedUrl(raw)
    } else {
      getSignedUrl(raw).then(url => setCoverSignedUrl(url ?? null))
    }
  }, [activeKnot?.cover_url])`
)

// 3. Upload handler: store path in state, not signed URL
src = src.replace(
  `; const signedCoverUrl = await getSignedUrl(path); if (!signedCoverUrl) { alert('Could not get cover URL'); return }; await supabase.from('knots').update({ cover_url: path }).eq('id', activeKnot.id); const updated = { ...activeKnot, cover_url: signedCoverUrl }; setActiveKnot(updated); setKnots(ks => ks.map(k => k.id === activeKnot.id ? updated : k))`,
  `; await supabase.from('knots').update({ cover_url: path }).eq('id', activeKnot.id); const updated = { ...activeKnot, cover_url: path }; setActiveKnot(updated); setKnots(ks => ks.map(k => k.id === activeKnot.id ? updated : k))`
)

// 4. Render: use coverSignedUrl for img src and conditional checks
src = src.replace(
  `<div style={{ height: 180, background: activeKnot.cover_url ? 'transparent' : 'linear-gradient(135deg, #F9F9F9 0%, #F2F2F2 50%, #E8E8E8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', borderRadius: 12 }}>
              {activeKnot.cover_url ? (<img src={activeKnot.cover_url} alt='' style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', position: 'absolute', top: 0, left: 0 }} />) : (<><div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 50%, rgba(248,189,3,0.2) 0%, transparent 60%)' }} /><div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 70% 50%, rgba(248,189,3,0.1) 0%, transparent 60%)' }} /></>)}
              {activeKnot.cover_url ? null : <span style={{ fontSize: 64 }}>{activeKnot.emoji}</span>}
              {activeKnot.created_by === user?.id && (<label style={{ position: 'absolute', bottom: 10, right: 10, padding: '6px 12px', background: 'rgba(0,0,0,0.5)', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{activeKnot.cover_url ? 'Change cover' : '+ Add cover'}`,
  `<div style={{ height: 180, background: coverSignedUrl ? 'transparent' : 'linear-gradient(135deg, #F9F9F9 0%, #F2F2F2 50%, #E8E8E8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', borderRadius: 12 }}>
              {coverSignedUrl ? (<img src={coverSignedUrl} alt='' style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', position: 'absolute', top: 0, left: 0 }} />) : (<><div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 50%, rgba(248,189,3,0.2) 0%, transparent 60%)' }} /><div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 70% 50%, rgba(248,189,3,0.1) 0%, transparent 60%)' }} /></>)}
              {coverSignedUrl ? null : <span style={{ fontSize: 64 }}>{activeKnot.emoji}</span>}
              {activeKnot.created_by === user?.id && (<label style={{ position: 'absolute', bottom: 10, right: 10, padding: '6px 12px', background: 'rgba(0,0,0,0.5)', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{activeKnot.cover_url ? 'Change cover' : '+ Add cover'}`
)

fs.writeFileSync(filePath, src, 'utf8')
console.log('Done. Run: npm run build')
