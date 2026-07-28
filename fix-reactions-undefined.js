const fs = require('fs');
const path = require('path');

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web\\components\\Feed.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Fix the reactions.map call to use safe fallback
content = content.replace(
  `{p.reactions.map(r => (`,
  `{(p.reactions || []).map(r => (`
);

// Also ensure the mapped reactions field always has a default
content = content.replace(
  `reactions:  (reactionsMap[p.id] || []),`,
  `reactions:  (reactionsMap?.[p.id] || []),`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed: reactions.map now uses safe fallback (p.reactions || [])');
