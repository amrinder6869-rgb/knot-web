const fs = require('fs')
let discover = fs.readFileSync('components/Discover.tsx', 'utf8')

// Add useRef to the import
discover = discover.replace(
  `import { useState, useEffect } from 'react'`,
  `import { useState, useEffect, useRef } from 'react'`
)

// Add a locationRef after the location state declaration
discover = discover.replace(
  `  const [location, setLocation] = useState<{lat:number,lng:number,name:string}|null>(null)`,
  `  const [location, setLocation] = useState<{lat:number,lng:number,name:string}|null>(null)
  const locationRef = useRef<{lat:number,lng:number,name:string}|null>(null)`
)

// Keep locationRef in sync whenever location changes - add after the existing useEffect
discover = discover.replace(
  `  // Silently attempt GPS on mount for autocomplete bias
  useEffect(() => {`,
  `  // Keep locationRef in sync with location state
  useEffect(() => { locationRef.current = location }, [location])

  // Silently attempt GPS on mount for autocomplete bias
  useEffect(() => {`
)

// Also update setLocation calls in getLocation and useEffect to use locationRef
// Replace the fetchSuggestions function to use locationRef.current instead of location
discover = discover.replace(
  `      const ll = location ? \`&lat=\${location.lat}&lng=\${location.lng}\` : ''`,
  `      const ll = locationRef.current ? \`&lat=\${locationRef.current.lat}&lng=\${locationRef.current.lng}\` : ''`
)

fs.writeFileSync('components/Discover.tsx', discover, 'utf8')
console.log('Done. Fixed stale closure - locationRef now used in fetchSuggestions.')
console.log('Run: npm run build')
