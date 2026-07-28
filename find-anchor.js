const fs = require('fs');
const path = require('path');

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web\\components\\HangoutCard.tsx');
const content = fs.readFileSync(filePath, 'utf8');

// Find the line number and surrounding context of the comments section
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('showComments') || line.includes('Add a comment') || line.includes('borderSep') && line.includes('paddingTop')) {
    console.log(`Line ${i + 1}: ${line}`);
  }
});
