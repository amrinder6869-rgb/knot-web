const fs = require('fs');
const path = require('path');

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web\\app\\page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Insert the merchant link after the "No ads" paragraph using line number approach
const lines = content.split('\n');
let insertAfter = -1;
lines.forEach((line, i) => {
  if (line.includes('No ads. No algorithm. No public profiles.')) {
    insertAfter = i;
  }
});

if (insertAfter === -1) {
  console.log('ERROR: Could not find the No ads line.');
  process.exit(1);
}

const merchantLink = `
      <a href="/merchant" style={{ marginTop: 16, fontSize: 12, color: 'var(--text3)', textDecoration: 'none', borderBottom: '1px solid var(--border)', paddingBottom: 1 }}>
        Are you a restaurant or experience business? List on Knot \u2192
      </a>`;

lines.splice(insertAfter + 1, 0, merchantLink);
fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('Added For businesses link to landing page at line ' + (insertAfter + 1));
