const fs = require('fs')
const path = require('path')

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web', 'components', 'Composer.tsx')
let src = fs.readFileSync(filePath, 'utf8')

// Check if already fixed
if (src.includes('setMomentMediaType') && src.includes('momentMediaType,')) {
  console.log('State already declared — nothing to do.')
  process.exit(0)
}

// Inject the missing state declaration after momentPhotoPreview line
// Use the exact spacing from the file
src = src.replace(
  `  const [momentPhotoPreview, setMomentPhotoPreview] = useState<string | null>(null)`,
  `  const [momentPhotoPreview, setMomentPhotoPreview] = useState<string | null>(null)
  const [momentMediaType, setMomentMediaType] = useState<'image' | 'video'>('image')`
)

if (!src.includes(`useState<'image' | 'video'>`)) {
  console.error('FAILED: could not find insertion point. Check Composer.tsx manually.')
  process.exit(1)
}

fs.writeFileSync(filePath, src, 'utf8')
console.log('Fixed. Run: npm run build')
