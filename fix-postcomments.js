const fs = require('fs')
const path = require('path')

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web', 'components', 'PostComments.tsx')
let content = fs.readFileSync(filePath, 'utf8')

content = content.replace(
  'photoUrl = publicUrl',
  'photoUrl = signedUrl ?? \'\''
)

fs.writeFileSync(filePath, content, 'utf8')
console.log('Fixed. Run: npm run build')
