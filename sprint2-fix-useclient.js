const fs = require('fs')
const path = require('path')

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web', 'components', 'HangoutCard.tsx')
const content = fs.readFileSync(filePath, 'utf8')

if (!content.startsWith("'use client'")) {
  fs.writeFileSync(filePath, "'use client'\n" + content, 'utf8')
  console.log('Prepended use client. Run: npm run build')
} else {
  console.log('Already has use client on line 1.')
}
