const fs = require('fs')
const path = require('path')

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web', 'app', 'dashboard', 'page.tsx')
let src = fs.readFileSync(filePath, 'utf8')

// Resolve conflict 1: useEffect for coverSignedUrl — take Cursor's version and add cache-bust
src = src.replace(
  `<<<<<<< HEAD
    if (!activeKnot?.cover_url) { setCoverSignedUrl(null); return }
    const base = activeKnot.cover_url.split('?')[0]
    setCoverSignedUrl(base + '?t=' + Date.now())
=======
    const url = activeKnot?.cover_url
    // Only render an <img> for real public http(s) URLs. Null/empty/legacy
    // storage paths must keep coverSignedUrl null so the placeholder shows.`,
  `    const url = activeKnot?.cover_url
    // Only render an <img> for real public http(s) URLs. Null/empty/legacy
    // storage paths must keep coverSignedUrl null so the placeholder shows.`
)

// Remove the end of conflict marker 1
src = src.replace(
  `    setCoverSignedUrl(url)
>>>>>>> f816de81582477cdc272308964d26b166330f9ed
  }, [activeKnot?.cover_url])`,
  `    // Add cache-bust timestamp to force fresh fetch on every cover change
    setCoverSignedUrl(url ? url.split('?')[0] + '?t=' + Date.now() : null)
  }, [activeKnot?.cover_url])`
)

// Resolve conflict 2: cover render block — take Cursor's version (after >>>>>>>)
// Find the conflict block around line 358
const conflictStart = src.indexOf('<<<<<<< HEAD\n', src.indexOf('maxWidth: 1100'))
const conflictEnd = src.indexOf('>>>>>>> f816de81582477cdc272308964d26b166330f9ed\n', conflictStart)

if (conflictStart !== -1 && conflictEnd !== -1) {
  const fullConflict = src.slice(conflictStart, conflictEnd + '>>>>>>> f816de81582477cdc272308964d26b166330f9ed\n'.length)
  const separator = '=======\n'
  const sepIdx = fullConflict.indexOf(separator)
  const remoteSection = fullConflict.slice(sepIdx + separator.length, fullConflict.lastIndexOf('>>>>>>> f816de81582477cdc272308964d26b166330f9ed\n'))
  src = src.slice(0, conflictStart) + remoteSection + src.slice(conflictEnd + '>>>>>>> f816de81582477cdc272308964d26b166330f9ed\n'.length)
}

// Also add cache-bust to upload handler
src = src.replace(
  `const publicCoverUrl = 'https://vcrnktkttgprbnoyjeff.supabase.co/storage/v1/object/public/knot-covers/' + coverPath;`,
  `const publicCoverUrl = 'https://vcrnktkttgprbnoyjeff.supabase.co/storage/v1/object/public/knot-covers/' + coverPath + '?t=' + Date.now();`
)

// Verify no conflict markers remain
if (src.includes('<<<<<<<') || src.includes('>>>>>>>') || src.includes('=======')) {
  console.error('FAILED: conflict markers still present. Do not build.')
  process.exit(1)
}

fs.writeFileSync(filePath, src, 'utf8')
console.log('Conflicts resolved. Run: npm run build')
