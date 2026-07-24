const fs = require('fs')
fs.copyFileSync('Composer.tsx', 'components/Composer.tsx')
console.log('Installed: components/Composer.tsx (error handling on every write)')
