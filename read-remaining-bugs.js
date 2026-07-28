const fs = require('fs');
const path = require('path');

const BASE = 'C:\\Users\\amrin\\Documents\\knot-web';

const files = [
  'app/api/autocomplete/route.ts',
  'app/invite/[token]/page.tsx',
  'components/MostLikelyTo.tsx',
  'components/Members.tsx',
  'components/BillSplit.tsx',
];

files.forEach(f => {
  const full = path.join(BASE, f);
  if (!fs.existsSync(full)) { console.log('\n' + f + ' NOT FOUND'); return; }
  const content = fs.readFileSync(full, 'utf8');
  console.log('\n===== ' + f + ' =====');
  // For large files just show encoding problem lines and first 30 lines
  const lines = content.split('\n');
  const problemLines = [];
  lines.forEach((line, i) => {
    if (line.includes('Ã') || line.includes('â€') || line.includes('Â') || 
        line.includes('\\u00B7') || line.includes('\\u2014') || 
        line.includes('Ã¢') || line.includes('fsq_id') || line.includes('place_id')) {
      problemLines.push(`Line ${i+1}: ${line.trim()}`);
    }
  });
  if (problemLines.length > 0) {
    console.log('Problem lines:');
    problemLines.forEach(l => console.log(l));
  } else {
    console.log('First 20 lines:');
    lines.slice(0, 20).forEach((l, i) => console.log(`${i+1}: ${l}`));
  }
});
