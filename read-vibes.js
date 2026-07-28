const fs = require('fs');
const path = require('path');

const BASE = 'C:\\Users\\amrin\\Documents\\knot-web';

const filesToCheck = [
  'components/Vibes.tsx',
  'components/VibesCard.tsx',
  'lib/vibes.ts',
  'lib/points.ts',
  'app/dashboard/page.tsx',
];

filesToCheck.forEach(f => {
  const full = path.join(BASE, f);
  if (fs.existsSync(full)) {
    console.log(`\n===== ${f} =====`);
    console.log(fs.readFileSync(full, 'utf8'));
  } else {
    console.log(`\n===== ${f} — NOT FOUND =====`);
  }
});
