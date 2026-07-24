const fs = require('fs')
fs.copyFileSync('BillSplit.tsx', 'components/BillSplit.tsx')
console.log('Installed: components/BillSplit.tsx (error handling on every write)')
