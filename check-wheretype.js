const fs = require('fs')
const lines = fs.readFileSync('components/Composer.tsx', 'utf8').split('\n')
lines.forEach((line, i) => {
  if (line.includes('whereMode') || line.includes('WhereMode')) {
    console.log(`${i + 1}: ${line}`)
  }
})
