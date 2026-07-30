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

  // 1. Add recentMedia state after knotMembers state
  src = src.replace(
    `  const [knotMembers, setKnotMembers]       = useState<any[]>([])`,
    `  const [knotMembers, setKnotMembers]       = useState<any[]>([])
  const [recentMedia, setRecentMedia]       = useState<{ id: string; url: string; media_type: string }[]>([])`
  )

  // 2. Add loadRecentMedia function after loadKnotMembers function
  //    Find the end of loadKnotMembers by its closing brace pattern
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

  // 3. Call loadRecentMedia inside switchKnot after loadKnotMembers
  src = src.replace(
    `    await loadKnotMembers(k.id)
  }

  async function signOut()`,
    `    await loadKnotMembers(k.id)
    await loadRecentMedia(k.id)
  }

  async function signOut()`
  )

  // 4. Replace placeholder tiles with real media renders
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
