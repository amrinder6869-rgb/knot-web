const fs = require('fs')
let route = fs.readFileSync('app/api/autocomplete/route.ts', 'utf8')

// Replace the biased params with IP-based location bias
route = route.replace(
  `const params = new URLSearchParams({
      input:      input.trim(),
      location:   '43.5890,-79.6441',
      radius:     '50000',
      components: 'country:ca',
      key:        apiKey,
    })`,
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
    })`
)

fs.writeFileSync('app/api/autocomplete/route.ts', route, 'utf8')
console.log('Done. Autocomplete now uses IP geolocation for global location bias.')
