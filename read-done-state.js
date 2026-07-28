const fs = require('fs');
const path = require('path');

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web\\components\\HangoutCard.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Print lines around isDone and endHangout
lines.forEach((line, i) => {
  if (
    line.includes('isDone') ||
    line.includes('ended') ||
    line.includes('endHangout') ||
    line.includes('End the night') ||
    line.includes('Memories') ||
    line.includes('rating') ||
    line.includes('post_type')
  ) {
    console.log(`Line ${i + 1}: ${line}`);
  }
});
