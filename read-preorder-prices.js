const fs = require('fs');
const path = require('path');

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web\\components\\PreOrderCard.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, i) => {
  if (line.includes('$') && (line.includes('price') || line.includes('total') || line.includes('amount') || line.includes('toFixed'))) {
    console.log(`Line ${i + 1}: ${line}`);
  }
});
