const https = require('https')
const fs = require('fs')
const path = require('path')

const BASE = 'C:\\Users\\amrin\\Documents\\knot-web'

function fetchGH(filePath) {
  return new Promise((resolve, reject) => {
    require('https').get(
      `https://raw.githubusercontent.com/amrinder6869-rgb/knot-web/master/${filePath}`,
      res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)) }
    ).on('error', reject)
  })
}

async function main() {

  // ── Discover.tsx ─────────────────────────────────────────────────────────────

  let disc = await fetchGH('components/Discover.tsx')

  // 1. Add openNow state after groupSize state
  disc = disc.replace(
    `  const [groupSize, setGroupSize] = useState<number>(4)`,
    `  const [groupSize, setGroupSize] = useState<number>(4)
  const [openNow, setOpenNow]       = useState<boolean>(false)`
  )

  // 2. Pass openNow to searchVenues API call
  disc = disc.replace(
    `    const params = new URLSearchParams({ ll: \`\${loc.lat},\${loc.lng}\`, categories: category, limit: '10' })
    if (budget) params.set('price', String(budget))
    if (groupSize) params.set('min_group', String(groupSize))`,
    `    const params = new URLSearchParams({ ll: \`\${loc.lat},\${loc.lng}\`, categories: category, limit: '10' })
    if (budget) params.set('price', String(budget))
    if (groupSize) params.set('min_group', String(groupSize))
    if (openNow) params.set('open_now', '1')`
  )

  // 3. Add Open now toggle UI after group size section and before search button
  disc = disc.replace(
    `      {/* Group size */}
      <div style={{ marginBottom: 16 }}>`,
    `      {/* Open now toggle */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>Availability</div>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>Only show places open right now</div>
        </div>
        <div onClick={() => setOpenNow(v => !v)} style={{
          width: 44, height: 24, borderRadius: 12, cursor: 'pointer', flexShrink: 0,
          background: openNow ? 'var(--yellow)' : 'var(--bg3)',
          border: \`1px solid \${openNow ? 'var(--yellow)' : 'var(--border2)'}\`,
          position: 'relative', transition: 'background 0.2s'
        }}>
          <div style={{
            position: 'absolute', top: 3, left: openNow ? 22 : 3,
            width: 16, height: 16, borderRadius: '50%',
            background: openNow ? '#111' : 'var(--text3)',
            transition: 'left 0.2s'
          }} />
        </div>
      </div>

      {/* Group size */}
      <div style={{ marginBottom: 16 }}>`
  )

  // 4. Client-side filter: after venues load, hide "Closed" venues when openNow is on
  disc = disc.replace(
    `        setVenues(data.results)`,
    `        const filtered = openNow
          ? data.results.filter((v: any) => v.closed_bucket === 'VeryLikelyOpen')
          : data.results
        setVenues(filtered.length > 0 ? filtered : data.results)`
  )

  fs.writeFileSync(path.join(BASE, 'components', 'Discover.tsx'), disc, 'utf8')
  console.log('Discover.tsx updated')

  // ── venues API route ─────────────────────────────────────────────────────────

  let api = await fetchGH('app/api/venues/route.ts')

  // 1. Read open_now param
  api = api.replace(
    `  const minGroupSize = searchParams.get('min_group') ? parseInt(searchParams.get('min_group')!) : null`,
    `  const minGroupSize = searchParams.get('min_group') ? parseInt(searchParams.get('min_group')!) : null
  const openNow      = searchParams.get('open_now') === '1'`
  )

  // 2. Add opennow to Google Places request
  api = api.replace(
    `  if (priceLevel) params.set('maxprice', String(priceLevel))`,
    `  if (priceLevel) params.set('maxprice', String(priceLevel))
  if (openNow) params.set('opennow', 'true')`
  )

  fs.writeFileSync(path.join(BASE, 'app', 'api', 'venues', 'route.ts'), api, 'utf8')
  console.log('venues/route.ts updated')

  console.log('Done. Run: npm run build')
}

main().catch(console.error)
