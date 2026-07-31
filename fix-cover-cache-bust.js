const fs = require('fs')
const path = require('path')

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web', 'app', 'dashboard', 'page.tsx')
let src = fs.readFileSync(filePath, 'utf8')

// 1. Append timestamp to public URL after upload so browser fetches fresh
src = src.replace(
  `const publicCoverUrl = 'https://vcrnktkttgprbnoyjeff.supabase.co/storage/v1/object/public/knot-covers/' + coverPath;`,
  `const publicCoverUrl = 'https://vcrnktkttgprbnoyjeff.supabase.co/storage/v1/object/public/knot-covers/' + coverPath + '?t=' + Date.now();`
)

// 2. When setting coverSignedUrl from an existing URL, strip old timestamp and add fresh one
src = src.replace(
  `  useEffect(() => {
    setCoverSignedUrl(activeKnot?.cover_url ?? null)
  }, [activeKnot?.cover_url])`,
  `  useEffect(() => {
    if (!activeKnot?.cover_url) { setCoverSignedUrl(null); return }
    const base = activeKnot.cover_url.split('?')[0]
    setCoverSignedUrl(base + '?t=' + Date.now())
  }, [activeKnot?.cover_url])`
)

fs.writeFileSync(filePath, src, 'utf8')
console.log('Done. Run: npm run build')
