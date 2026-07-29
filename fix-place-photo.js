const fs = require('fs')
const path = require('path')

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web', 'app', 'api', 'place-photo', 'route.ts')
let content = fs.readFileSync(filePath, 'utf8')

content = content.replace(
  'return new NextResponse(buffer, {',
  'return new NextResponse(new Uint8Array(buffer), {'
)

fs.writeFileSync(filePath, content, 'utf8')
console.log('Fixed. Run: npm run build')
