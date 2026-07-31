const fs = require('fs')
const path = require('path')

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web', 'app', 'api', 'venues', 'route.ts')
let src = fs.readFileSync(filePath, 'utf8')

// Replace single-type mapping with multi-type support
// First update the CATEGORY_TO_TYPE map to use arrays
src = src.replace(
  `const CATEGORY_TO_TYPE: Record<string, string> = {
  '13000': 'restaurant',
  '13003': 'bar',
  '10000': 'museum',
  '18000': 'park',
  '13059': 'cafe',
  '10032': 'bowling_alley',
  '13049': 'meal_takeaway',
  '13029': 'restaurant',
}`,
  `const CATEGORY_TO_TYPES: Record<string, string[]> = {
  '13000': ['restaurant'],
  '13003': ['bar', 'night_club'],
  '10000': ['museum', 'art_gallery', 'tourist_attraction'],
  '18000': ['park', 'campground', 'natural_feature', 'stadium'],
  '13059': ['cafe'],
  '10032': ['bowling_alley', 'amusement_park', 'gym', 'movie_theater', 'stadium', 'casino'],
  '13049': ['meal_takeaway', 'meal_delivery'],
  '13029': ['restaurant'],
}`
)

// Update ALLOWED_CATEGORIES to use new map name
src = src.replace(
  `const ALLOWED_CATEGORIES = new Set(Object.keys(CATEGORY_TO_TYPE))`,
  `const ALLOWED_CATEGORIES = new Set(Object.keys(CATEGORY_TO_TYPES))`
)

// Update the type variable extraction
src = src.replace(
  `  const type = CATEGORY_TO_TYPE[category]`,
  `  const types = CATEGORY_TO_TYPES[category] || ['establishment']
  const type = types[0]`
)

// Update Google Places request to include multiple types by making parallel requests
// Replace the single fetch with parallel fetches for each type, then merge and dedupe
src = src.replace(
  `  try {
    const body = await httpsGet(
      \`https://maps.googleapis.com/maps/api/place/nearbysearch/json?\${params}\`
    )
    const data = JSON.parse(body)

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS')
      return NextResponse.json({ error: 'Places API error' }, { status: 400 })

    let rawResults = (data.results || [])
      .sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0))`,
  `  try {
    // Fetch all types in parallel and merge results
    const allResults: any[] = []
    const seenIds = new Set<string>()

    await Promise.all(types.map(async (t: string) => {
      const typeParams = new URLSearchParams(params)
      typeParams.set('type', t)
      try {
        const body = await httpsGet(
          \`https://maps.googleapis.com/maps/api/place/nearbysearch/json?\${typeParams}\`
        )
        const data = JSON.parse(body)
        if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
          for (const r of (data.results || [])) {
            if (!seenIds.has(r.place_id)) {
              seenIds.add(r.place_id)
              allResults.push(r)
            }
          }
        }
      } catch {}
    }))

    if (allResults.length === 0)
      return NextResponse.json({ results: [] })

    let rawResults = allResults
      .sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0))`
)

// Remove the old error check that referenced single data object
src = src.replace(
  `    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS')
      return NextResponse.json({ error: 'Places API error' }, { status: 400 })

    let rawResults = (data.results || [])
      .sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0))`,
  `` // already replaced above
)

// Remove the old params.set('type') line since we handle it per-type now
src = src.replace(
  `  const params = new URLSearchParams({
    location: \`\${lat},\${lng}\`,
    radius: '8000',
    type,
    key: apiKey,
  })`,
  `  const params = new URLSearchParams({
    location: \`\${lat},\${lng}\`,
    radius: '8000',
    key: apiKey,
  })`
)

fs.writeFileSync(filePath, src, 'utf8')
console.log('Done. Run: npm run build')
