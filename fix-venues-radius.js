const fs = require('fs')
const path = require('path')

const BASE = 'C:\\Users\\amrin\\Documents\\knot-web'

// Fix 1: venues API — increase radius to 15km for outdoor/activity categories
const apiPath = path.join(BASE, 'app', 'api', 'venues', 'route.ts')
let api = fs.readFileSync(apiPath, 'utf8')

api = api.replace(
  `  const params = new URLSearchParams({
    location: \`\${lat},\${lng}\`,
    radius: '8000',
    key: apiKey,
  })`,
  `  // Use larger radius for categories that are less dense in suburban areas
  const sparseCategories = new Set(['18000', '10032', '10000'])
  const radius = sparseCategories.has(category) ? '15000' : '8000'

  const params = new URLSearchParams({
    location: \`\${lat},\${lng}\`,
    radius,
    key: apiKey,
  })`
)

fs.writeFileSync(apiPath, api, 'utf8')
console.log('venues/route.ts updated')

// Fix 2: Discover.tsx — better empty state when Open now is on
const discPath = path.join(BASE, 'components', 'Discover.tsx')
let disc = fs.readFileSync(discPath, 'utf8')

disc = disc.replace(
  `      } else {
        setError('No venues found nearby. Try a different category or location.')
      }`,
  `      } else {
        setError(openNow ? 'No open venues found right now. Try turning off the Open now filter.' : 'No venues found nearby. Try a different category or location.')
      }`
)

fs.writeFileSync(discPath, disc, 'utf8')
console.log('Discover.tsx updated')

console.log('Done. Run: npm run build')
