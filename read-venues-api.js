const fs = require('fs');
const path = require('path');

const BASE = 'C:\\Users\\amrin\\Documents\\knot-web';

const files = [
  'app/api/venues/route.ts',
  'app/api/venues/route.js',
];

files.forEach(f => {
  const full = path.join(BASE, f);
  if (fs.existsSync(full)) {
    console.log(`\n===== ${f} =====`);
    console.log(fs.readFileSync(full, 'utf8'));
  } else {
    console.log(`\n===== ${f} — NOT FOUND =====`);
  }
});
