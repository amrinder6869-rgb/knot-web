const fs = require('fs')
const path = require('path')

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web', 'app', 'dashboard', 'page.tsx')
let src = fs.readFileSync(filePath, 'utf8')

// Remove the second (duplicate) declaration — keep the first one
const declaration = `  const [recentMedia, setRecentMedia]       = useState<{ id: string; url: string; media_type: string }[]>([])\n`
const first = src.indexOf(declaration)
const second = src.indexOf(declaration, first + declaration.length)

if (second === -1) {
  console.log('No duplicate found — nothing to do.')
  process.exit(0)
}

src = src.slice(0, second) + src.slice(second + declaration.length)
fs.writeFileSync(filePath, src, 'utf8')
console.log('Duplicate removed. Run: npm run build')
