const fs = require('fs');
const path = require('path');

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web\\components\\Feed.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Print lines around toggleReaction
lines.forEach((line, i) => {
  if (i >= 235 && i <= 270) {
    console.log(`Line ${i + 1}: ${line}`);
  }
});
