const fs = require('fs');
const path = require('path');

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web\\components\\Feed.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Print lines 120-160
lines.slice(119, 165).forEach((line, i) => {
  console.log(`Line ${i + 120}: ${line}`);
});
