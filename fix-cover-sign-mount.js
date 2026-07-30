const fs = require('fs')
const path = require('path')

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web', 'app', 'dashboard', 'page.tsx')
let src = fs.readFileSync(filePath, 'utf8')

// Replace the knotList build to sign storage-path cover URLs
src = src.replace(
  `        const knotList = memberships.map((m: any) => {
          const k = m.knots
          const count = (memberCounts || []).filter((mc: any) => mc.knot_id === k.id).length
          return { id: k.id, name: k.name, emoji: k.emoji, count: count || 1, created_by: k.created_by, cover_url: k.cover_url || null }
        })
        setKnots(knotList)`,
  `        const knotListRaw = memberships.map((m: any) => {
          const k = m.knots
          const count = (memberCounts || []).filter((mc: any) => mc.knot_id === k.id).length
          return { id: k.id, name: k.name, emoji: k.emoji, count: count || 1, created_by: k.created_by, cover_url: k.cover_url || null }
        })
        const knotList = await Promise.all(knotListRaw.map(async (k: any) => {
          if (k.cover_url && !k.cover_url.startsWith('http')) {
            const signed = await getSignedUrl(k.cover_url)
            return { ...k, cover_url: signed ?? null }
          }
          return k
        }))
        setKnots(knotList)`
)

fs.writeFileSync(filePath, src, 'utf8')
console.log('Done. Run: npm run build')
