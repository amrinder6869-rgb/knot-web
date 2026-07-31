const https = require('https')
const fs = require('fs')
const path = require('path')

const BASE = 'C:\\Users\\amrin\\Documents\\knot-web'

function fetchGH(filePath) {
  return new Promise((resolve, reject) => {
    https.get(
      `https://raw.githubusercontent.com/amrinder6869-rgb/knot-web/master/${filePath}`,
      res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)) }
    ).on('error', reject)
  })
}

async function main() {
  let src = await fetchGH('app/dashboard/page.tsx')

  // Add cache-bust to useEffect
  src = src.replace(
    `    setCoverSignedUrl(url)
  }, [activeKnot?.cover_url])`,
    `    setCoverSignedUrl(url ? url.split('?')[0] + '?t=' + Date.now() : null)
  }, [activeKnot?.cover_url])`
  )

  // Add cache-bust to upload handler
  src = src.replace(
    `const publicCoverUrl = 'https://vcrnktkttgprbnoyjeff.supabase.co/storage/v1/object/public/knot-covers/' + coverPath;`,
    `const publicCoverUrl = 'https://vcrnktkttgprbnoyjeff.supabase.co/storage/v1/object/public/knot-covers/' + coverPath + '?t=' + Date.now();`
  )

  if (src.includes('<<<<<<<')) {
    console.error('FAILED: conflict markers in remote source. Aborting.')
    process.exit(1)
  }

  fs.writeFileSync(path.join(BASE, 'app', 'dashboard', 'page.tsx'), src, 'utf8')
  console.log('Done. Run: npm run build')
}

main().catch(console.error)
