const fs = require('fs');
const path = require('path');

const BASE = 'C:\\Users\\amrin\\Documents\\knot-web';

// Check Members.tsx props
const membersPath = path.join(BASE, 'components\\Members.tsx');
if (fs.existsSync(membersPath)) {
  const content = fs.readFileSync(membersPath, 'utf8');
  const lines = content.split('\n').slice(0, 20);
  console.log('===== Members.tsx (first 20 lines) =====');
  lines.forEach((l, i) => console.log(`${i+1}: ${l}`));
}

// Check files with encoding issues
const encodingFiles = [
  'app/invite/[token]/page.tsx',
  'components/MostLikelyTo.tsx',
  'components/Composer.tsx',
];

encodingFiles.forEach(f => {
  const full = path.join(BASE, f);
  if (!fs.existsSync(full)) { console.log('\n' + f + ' NOT FOUND'); return; }
  const content = fs.readFileSync(full, 'utf8');
  const lines = content.split('\n');
  console.log('\n===== ' + f + ' encoding issues =====');
  lines.forEach((line, i) => {
    if (line.includes('\\u00B7') || line.includes('\\u2014') || line.includes('Ã') || line.includes('â€') || line.includes('Â')) {
      console.log(`Line ${i+1}: ${line.trim()}`);
    }
  });
});
