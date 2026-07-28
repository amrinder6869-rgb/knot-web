const fs = require('fs');
const path = require('path');

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web\\components\\Composer.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// The state was defined as suggestions2 but JSX uses suggestions2 too
// The issue is the useState declaration used setSuggestions2 but the variable name
// Check what was actually written
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('suggestions2') || line.includes('setSuggestions2')) {
    console.log(`Line ${i + 1}: ${line}`);
  }
});
