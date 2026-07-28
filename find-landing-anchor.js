const fs = require('fs');
const path = require('path');

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web\\app\\page.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, i) => {
  if (line.includes('No ads') || line.includes('algorithm') || line.includes('Back')) {
    console.log(`Line ${i + 1}: ${JSON.stringify(line)}`);
  }
});
