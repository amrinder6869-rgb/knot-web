const fs = require('fs');
const path = require('path');

const BASE = 'C:\\Users\\amrin\\Documents\\knot-web';

const files = [
  'components/VibesCounter.tsx',
  'components/Notifications.tsx',
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
