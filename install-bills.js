const fs = require('fs')
fs.copyFileSync('BillSplit.tsx', 'components/BillSplit.tsx')
console.log('Installed: components/BillSplit.tsx')

let content = fs.readFileSync('app/dashboard/page.tsx', 'utf8')
const lines = content.split('\n')
lines.forEach((line, i) => {
  if (line.includes('BillSplit')) console.log(`${i + 1}: ${line}`)
})
