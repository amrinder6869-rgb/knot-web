const fs = require('fs')
const path = require('path')

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web', 'components', 'HangoutCard.tsx')
const lines = fs.readFileSync(filePath, 'utf8').split('\n')

// Line 11 (index 10) should be blank, line 12 (index 11) should be the function body
// Insert the function declaration before index 11
if (!lines[11].includes('function timeAgo')) {
  lines.splice(11, 0, `function timeAgo(date: string) {\r`)
  console.log('Inserted function timeAgo declaration at line 12')
} else {
  console.log('Already present')
}

fs.writeFileSync(filePath, lines.join('\n'), 'utf8')
console.log('Fixed. Run: npm run build')
