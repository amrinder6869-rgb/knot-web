const https = require('https')
const fs = require('fs')
const path = require('path')

const BASE = 'C:\\Users\\amrin\\Documents\\knot-web'

function fetchGH(filePath) {
  return new Promise((resolve, reject) => {
    https.get(
      `https://raw.githubusercontent.com/amrinder6869-rgb/knot-web/master/${filePath}`,
      res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)) }
    ).on('error', reject)
  })
}

async function main() {
  let src = await fetchGH('app/dashboard/page.tsx')

  // 1. Add recentMedia state
  src = src.replace(
    `  const [knotMembers, setKnotMembers]       = useState<any[]>([])`,
    `  const [knotMembers, setKnotMembers]       = useState<any[]>([])
  const [recentMedia, setRecentMedia]       = useState<{ id: string; url: string; media_type: string }[]>([])`
  )

  // 2. Add loadRecentMedia function before switchKnot
  src = src.replace(
    `async function switchKnot(k: any) {`,
    `  async function loadRecentMedia(knotId: string) {
    const { data } = await supabase
      .from('photos')
      .select('id, storage_path, media_type')
      .eq('knot_id', knotId)
      .order('created_at', { ascending: false })
      .limit(6)
    if (!data) { setRecentMedia([]); return }
    const withUrls = await Promise.all(
      data.map(async (p: any) => {
        const url = await getSignedUrl(p.storage_path)
        return { id: p.id, url: url ?? '', media_type: p.media_type ?? 'image' }
      })
    )
    setRecentMedia(withUrls.filter(p => p.url))
  }

  async function switchKnot(k: any) {`
  )

  // 3. Call loadRecentMedia on mount after loadKnotMembers
  src = src.replace(
    `await loadKnotMembers(startKnot.id, data.user.id)`,
    `await loadKnotMembers(startKnot.id, data.user.id)
      await loadRecentMedia(startKnot.id)`
  )

  // 4. Call loadRecentMedia in switchKnot
  src = src.replace(
    `    await loadKnotMembers(k.id)
    await loadRecentMedia(k.id)
  }

  async function signOut()`,
    `    await loadKnotMembers(k.id)
    await loadRecentMedia(k.id)
  }

  async function signOut()`
  )
  // If switchKnot doesn't have it yet (first run), add it
  if (!src.includes(`await loadKnotMembers(k.id)\n    await loadRecentMedia(k.id)`)) {
    src = src.replace(
      `    await loadKnotMembers(k.id)\n  }\n\n  async function signOut()`,
      `    await loadKnotMembers(k.id)\n    await loadRecentMedia(k.id)\n  }\n\n  async function signOut()`
    )
  }

  // 5. Logo: make it a button that navigates home, remove separate Home button
  src = src.replace(
    `        </div>

        <button onClick={() => { setShowHome(true); setActiveKnot(null); localStorage.setItem('show_home', 'true') }}
          style={{ padding: '6px 14px', background: showHome ? 'var(--yellow)' : 'var(--bg3)', border: \`1px solid \${showHome ? 'var(--yellow)' : 'var(--border)'}\`, borderRadius: 8, color: showHome ? '#111' : 'var(--text2)', fontSize: 13, fontWeight: showHome ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
          Home
        </button>`,
    `        </div>`
  )

  // Make the logo div clickable
  src = src.replace(
    `        <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'default' }}>`,
    `        <div onClick={() => { setShowHome(true); setActiveKnot(null); localStorage.setItem('show_home', 'true') }} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>`
  )

  // 6. Replace About section content with group-specific info, remove duplicate Invite button
  src = src.replace(
    `              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>About</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: 'var(--text2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'var(--yellow)' }}>⊕</span>
                    <span>Private · Invite only</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'var(--yellow)' }}>⊕</span>
                    <span>No algorithm · Chronological</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'var(--yellow)' }}>⊕</span>
                    <span>No ads · Ever</span>
                  </div>
                </div>
                <button onClick={() => setActive('members')}
                  style={{ width: '100%', marginTop: 14, padding: '9px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Invite someone
                </button>
              </div>`,
    `              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>About</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: 'var(--text2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20 }}>{activeKnot.emoji}</span>
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>{activeKnot.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'var(--yellow)' }}>⊕</span>
                    <span>Private · Invite only</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'var(--yellow)' }}>⊕</span>
                    <span>{activeKnot.count} member{activeKnot.count !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>`
  )

  // 7. Replace placeholder Recent media tiles with real media
  src = src.replace(
    `                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                  {[1,2,3,4,5,6].map(i => (
                    <div key={i} onClick={() => setActive('memories')} style={{ aspectRatio: '1', borderRadius: 6, background: 'var(--bg3)', cursor: 'pointer', border: '1px solid var(--border)' }} />
                  ))}
                </div>`,
    `                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                  {recentMedia.length > 0 ? recentMedia.map(p => (
                    <div key={p.id} onClick={() => setActive('memories')} style={{ aspectRatio: '1', borderRadius: 6, overflow: 'hidden', background: '#000', cursor: 'pointer', border: '1px solid var(--border)' }}>
                      {p.media_type === 'video' ? (
                        <video src={p.url} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      ) : (
                        <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      )}
                    </div>
                  )) : [1,2,3,4,5,6].map(i => (
                    <div key={i} onClick={() => setActive('memories')} style={{ aspectRatio: '1', borderRadius: 6, background: 'var(--bg3)', cursor: 'pointer', border: '1px solid var(--border)' }} />
                  ))}
                </div>`
  )

  fs.writeFileSync(path.join(BASE, 'app', 'dashboard', 'page.tsx'), src, 'utf8')
  console.log('Done. Run: npm run build')
}

main().catch(console.error)
