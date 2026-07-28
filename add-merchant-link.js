const fs = require('fs');
const path = require('path');

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web\\app\\page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const oldFooter = `      <p style={{ marginTop: 24, fontSize: 12, color: 'var(--text3)' }}>No ads. No algorithm. No public profiles.</p>
    </div>
  )`;

const newFooter = `      <p style={{ marginTop: 24, fontSize: 12, color: 'var(--text3)' }}>No ads. No algorithm. No public profiles.</p>

      <a href="/merchant" style={{ marginTop: 16, fontSize: 12, color: 'var(--text3)', textDecoration: 'none', borderBottom: '1px solid var(--border)', paddingBottom: 1 }}>
        Are you a restaurant or experience business? List on Knot →
      </a>
    </div>
  )`;

if (content.includes(oldFooter)) {
  content = content.replace(oldFooter, newFooter);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Added For businesses link to landing page.');
} else {
  console.log('ERROR: anchor not found.');
}
