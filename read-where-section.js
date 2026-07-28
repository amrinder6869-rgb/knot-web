const fs = require('fs');
const path = require('path');

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web\\components\\Composer.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Print lines around the Where section
let inWhere = false;
lines.forEach((line, i) => {
  if (line.includes('Where') || line.includes('whereMode') || line.includes('tbd') || line.includes('discover') || line.includes('manualVenue') || line.includes('selectedVenue')) {
    console.log(`Line ${i + 1}: ${line}`);
  }
});
