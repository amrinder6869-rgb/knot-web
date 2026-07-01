const fs = require('fs')
const c = fs.readFileSync('components/Hangout.tsx', 'utf8')
const bad = ['Ã¢â‚¬â€', 'â€"', 'Ã‚Â·', 'Â·', 'Ã¢â‚¬â„¢', 'Ã¢â‚¬Å"']
let found = 0
bad.forEach(b => {
  const has = c.includes(b)
  if (has) { console.log('CORRUPT:', b); found++ }
})
if (found === 0) console.log('All clean. No corruption found.')
else console.log(found + ' pattern(s) still corrupted.')
