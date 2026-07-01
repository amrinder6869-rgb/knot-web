const fs = require('fs')

// 1. Fix the API route to accept lat/lng query params from the frontend
let route = fs.readFileSync('app/api/autocomplete/route.ts', 'utf8')

route = route.replace(
  `// Get approximate location from IP for bias
    let biasLat = '43.5890'
    let biasLng = '-79.6441'
    try {
      const ip =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        ''
      if (ip && ip !== '127.0.0.1' && ip !== '::1') {
        const geoRes = await fetch(\`https://ipapi.co/\${ip}/json/\`)
        const geo = await geoRes.json()
        if (geo.latitude && geo.longitude) {
          biasLat = String(geo.latitude)
          biasLng = String(geo.longitude)
        }
      }
    } catch {}

    const params = new URLSearchParams({
      input:    input.trim(),
      location: \`\${biasLat},\${biasLng}\`,
      radius:   '50000',
      key:      apiKey,
    })`,
  `// Use lat/lng from frontend if provided, otherwise no bias
    const lat = searchParams.get('lat')
    const lng = searchParams.get('lng')

    const params = new URLSearchParams({ input: input.trim(), key: apiKey })
    if (lat && lng) {
      params.set('location', \`\${lat},\${lng}\`)
      params.set('radius', '50000')
    }`
)

fs.writeFileSync('app/api/autocomplete/route.ts', route, 'utf8')
console.log('Fixed: autocomplete route now accepts lat/lng from frontend')

// 2. Fix Discover.tsx to pass GPS coordinates to fetchSuggestions
let discover = fs.readFileSync('components/Discover.tsx', 'utf8')

// Pass location coords to the autocomplete fetch
discover = discover.replace(
  `      const res = await fetch('/api/autocomplete?input=' + encodeURIComponent(value), {`,
  `      const ll = location ? \`&lat=\${location.lat}&lng=\${location.lng}\` : ''
      const res = await fetch('/api/autocomplete?input=' + encodeURIComponent(value) + ll, {`
)

fs.writeFileSync('components/Discover.tsx', discover, 'utf8')
console.log('Fixed: Discover now passes GPS coords to autocomplete')
console.log('\nRun: npm run build')
