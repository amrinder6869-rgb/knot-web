const fs = require('fs')
let content = fs.readFileSync('components/Memories.tsx', 'utf8')

content = content.replace(
  'let commentPhotos = []',
  'let commentPhotos: any[] = []'
)

fs.writeFileSync('components/Memories.tsx', content, 'utf8')
console.log('Done. Fixed commentPhotos type annotation.')
