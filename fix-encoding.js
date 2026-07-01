const fs = require('fs')
const path = require('path')

const filePath = path.join('components', 'Hangout.tsx')
let content = fs.readFileSync(filePath, 'utf8')

// Fix double-encoded UTF-8 sequences in source code strings
const replacements = [
  // em dash variants
  [/Ã¢â‚¬â€/g, '\u2014'],
  [/â€"/g, '\u2014'],
  // middle dot variants
  [/Ã‚Â·/g, '\u00B7'],
  [/Â·/g, '\u00B7'],
  // left double quote
  [/Ã¢â‚¬Å"/g, '\u201C'],
  // right double quote
  [/Ã¢â‚¬\x9D/g, '\u201D'],
  // apostrophe
  [/Ã¢â‚¬â„¢/g, '\u2019'],
]

let count = 0
for (const [pattern, replacement] of replacements) {
  const before = content
  content = content.replace(pattern, replacement)
  if (content !== before) count++
}

fs.writeFileSync(filePath, content, 'utf8')
console.log(`Done. Fixed ${count} encoding pattern(s) in Hangout.tsx`)
