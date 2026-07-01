const fs = require('fs')
let route = fs.readFileSync('app/api/autocomplete/route.ts', 'utf8')

// Change types from (regions) to geocode to support cities, addresses, and postal codes
route = route.replace(
  `const params = new URLSearchParams({ input: input.trim(), types: '(regions)', key: apiKey })`,
  `const params = new URLSearchParams({ input: input.trim(), key: apiKey })`
)

fs.writeFileSync('app/api/autocomplete/route.ts', route, 'utf8')
console.log('Done. Autocomplete now returns cities, addresses, and postal codes.')
