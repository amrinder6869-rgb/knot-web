const fs = require('fs')
let content = fs.readFileSync('app/dashboard/page.tsx', 'utf8')

const oldLine = `{active === 'split'     && <BillSplit members={knotMembers} knotId={activeKnot?.id} />}`
const newLine = `{active === 'split'     && <BillSplit members={knotMembers} knotId={activeKnot?.id} currentUser={profile} />}`

if (!content.includes(oldLine)) {
  console.log('ERROR: could not find the exact line to replace.')
  process.exit(1)
}

content = content.replace(oldLine, newLine)
fs.writeFileSync('app/dashboard/page.tsx', content, 'utf8')
console.log('Done. BillSplit now receives currentUser={profile}.')
