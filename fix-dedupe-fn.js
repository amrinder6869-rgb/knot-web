const fs = require('fs')
const path = require('path')

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web', 'app', 'dashboard', 'page.tsx')
let src = fs.readFileSync(filePath, 'utf8')

const fn = `  async function loadRecentMedia(knotId: string) {
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
  }\n`

const first = src.indexOf(fn)
const second = src.indexOf(fn, first + fn.length)

if (second === -1) {
  console.log('No duplicate found — nothing to do.')
  process.exit(0)
}

src = src.slice(0, second) + src.slice(second + fn.length)
fs.writeFileSync(filePath, src, 'utf8')
console.log('Duplicate loadRecentMedia removed. Run: npm run build')
