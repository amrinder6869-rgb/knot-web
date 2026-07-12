const fs = require('fs')
const path = require('path')

const libDir = path.join('lib')
if (!fs.existsSync(libDir)) fs.mkdirSync(libDir, { recursive: true })

fs.copyFileSync('hangoutBundle.ts', path.join('lib', 'hangoutBundle.ts'))
console.log('Installed: lib/hangoutBundle.ts')

fs.copyFileSync('HangoutCard.tsx', path.join('components', 'HangoutCard.tsx'))
console.log('Installed: components/HangoutCard.tsx')

fs.copyFileSync('Feed.tsx', path.join('components', 'Feed.tsx'))
console.log('Installed: components/Feed.tsx')

fs.copyFileSync('Hangout.tsx', path.join('components', 'Hangout.tsx'))
console.log('Installed: components/Hangout.tsx')

console.log('\nAll done. Run: npm run build')
