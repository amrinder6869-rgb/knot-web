const fs = require('fs')
const path = require('path')

const files = [
  { src: 'HangoutCard.tsx', dest: path.join('components', 'HangoutCard.tsx') },
  { src: 'Composer.tsx',    dest: path.join('components', 'Composer.tsx') },
  { src: 'Feed.tsx',        dest: path.join('components', 'Feed.tsx') },
]

let ok = 0
let fail = 0

for (const f of files) {
  if (!fs.existsSync(f.src)) {
    console.log('MISSING:', f.src, '- download it from the chat first')
    fail++
    continue
  }
  fs.copyFileSync(f.src, f.dest)
  console.log('Installed:', f.dest)
  ok++
}

console.log(`\nDone. ${ok} installed, ${fail} missing.`)
if (fail > 0) console.log('Download missing files from chat and re-run.')
