const fs = require('fs');
const path = require('path');

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web\\components\\Feed.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Print lines 100-125 to find the anchor before mapped
lines.slice(99, 125).forEach((line, i) => {
  console.log(`Line ${i + 100}: ${line}`);
});
