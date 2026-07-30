const fs = require('fs')
const path = require('path')

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web', 'app', 'dashboard', 'page.tsx')
let src = fs.readFileSync(filePath, 'utf8')

// Replace the full-width cover container with a content-width constrained version
src = src.replace(
  `          <div style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
            <div style={{ height: 180, background: activeKnot.cover_url ? 'transparent' : 'linear-gradient(135deg, #F9F9F9 0%, #F2F2F2 50%, #E8E8E8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>`,
  `          <div style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
            <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 20px 0 20px' }}>
            <div style={{ height: 180, background: activeKnot.cover_url ? 'transparent' : 'linear-gradient(135deg, #F9F9F9 0%, #F2F2F2 50%, #E8E8E8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', borderRadius: 12 }}>`
)

// Close the extra wrapper div we opened — find the line after the cover div closes and before the header row
src = src.replace(
  `            </div>

            <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 20px',`,
  `            </div>
            </div>

            <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 20px',`
)

// Also fix objectFit on the image while we are here
src = src.replace(
  `objectFit: 'contain', display: 'block', position: 'absolute', top: 0, left: 0, background: '#000'`,
  `objectFit: 'cover', display: 'block', position: 'absolute', top: 0, left: 0`
)

fs.writeFileSync(filePath, src, 'utf8')
console.log('Done. Run: npm run build')
