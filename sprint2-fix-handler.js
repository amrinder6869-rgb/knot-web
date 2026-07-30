const fs = require('fs')
const path = require('path')

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web', 'components', 'HangoutCard.tsx')
const lines = fs.readFileSync(filePath, 'utf8').split('\n')

// Find where handleLivePhotoUpload currently is (wrongly placed)
const wrongStart = lines.findIndex(l => l.includes('async function handleLivePhotoUpload'))
if (wrongStart === -1) { console.log('ERROR: handleLivePhotoUpload not found'); process.exit(1) }

// Find its end — next blank line after the closing }
let wrongEnd = wrongStart
for (let i = wrongStart + 1; i < wrongStart + 25; i++) {
  if (lines[i] && lines[i].trim() === '}\r' || lines[i] && lines[i].trim() === '}') {
    wrongEnd = i
    break
  }
}

console.log('Removing lines', wrongStart + 1, 'to', wrongEnd + 2, '(handler in wrong place)')

// Extract the handler lines
const handlerLines = lines.splice(wrongStart, wrongEnd - wrongStart + 2)

// Now find handlePhotoUpload (the existing one) to insert after it
const handlePhotoStart = lines.findIndex(l => l.includes('async function handlePhotoUpload'))
// Find its end
let handlePhotoEnd = handlePhotoStart
for (let i = handlePhotoStart + 1; i < handlePhotoStart + 60; i++) {
  if (lines[i] && (lines[i].includes('const displayRating') || lines[i].includes('const display'))) {
    handlePhotoEnd = i - 1
    break
  }
}

console.log('Re-inserting handler after line', handlePhotoEnd + 1)

lines.splice(handlePhotoEnd + 1, 0, ...handlerLines)

fs.writeFileSync(filePath, lines.join('\n'), 'utf8')
console.log('Fixed. Run: npm run build')
