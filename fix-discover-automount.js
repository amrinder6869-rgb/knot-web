const fs = require('fs')
let discover = fs.readFileSync('components/Discover.tsx', 'utf8')

// Add useEffect import if not already there
if (!discover.includes('useEffect')) {
  discover = discover.replace(
    `import { useState } from 'react'`,
    `import { useState, useEffect } from 'react'`
  )
}

// Add auto-detect on mount after the state declarations
// Find the line after the last useState declaration and before the getLocation function
discover = discover.replace(
  `  async function getLocation(): Promise<{lat:number,lng:number,name:string}|null> {`,
  `  // Silently attempt GPS on mount for autocomplete bias
  useEffect(() => {
    if (!location && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async pos => {
          const lat = pos.coords.latitude
          const lng = pos.coords.longitude
          let name = 'Your location'
          try {
            const res = await fetch(\`https://nominatim.openstreetmap.org/reverse?lat=\${lat}&lon=\${lng}&format=json\`)
            const geo = await res.json()
            const addr = geo.address
            name = addr.city || addr.town || addr.village || addr.county || 'Your location'
          } catch {}
          setLocation({ lat, lng, name })
        },
        () => {} // silently ignore if denied
      )
    }
  }, [])

  async function getLocation(): Promise<{lat:number,lng:number,name:string}|null> {`
)

fs.writeFileSync('components/Discover.tsx', discover, 'utf8')
console.log('Done. Discover now auto-detects GPS on mount for autocomplete bias.')
console.log('Run: npm run build')
