const fs = require('fs');
const path = require('path');

const BASE = 'C:\\Users\\amrin\\Documents\\knot-web';

// Read Feed.tsx - just the reactions related lines
const feedPath = path.join(BASE, 'components\\Feed.tsx');
if (fs.existsSync(feedPath)) {
  const content = fs.readFileSync(feedPath, 'utf8');
  const lines = content.split('\n');
  console.log('===== Feed.tsx reaction lines =====');
  lines.forEach((line, i) => {
    if (line.includes('reaction') || line.includes('React') && line.includes('post')) {
      console.log(`Line ${i+1}: ${line}`);
    }
  });
}

// Read venues API
const venuesPath = path.join(BASE, 'app\\api\\venues\\route.ts');
if (fs.existsSync(venuesPath)) {
  console.log('\n===== venues API =====');
  console.log(fs.readFileSync(venuesPath, 'utf8'));
}
