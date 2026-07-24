const fs = require('fs')
fs.copyFileSync('Memories.tsx', 'components/Memories.tsx')
console.log('Installed: components/Memories.tsx (error handling on every write)')
