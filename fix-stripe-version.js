const fs = require('fs');
const path = require('path');

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web\\app\\api\\stripe\\create-payment-intent\\route.ts');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  `{ apiVersion: '2024-12-18.acacia' }`,
  `{ apiVersion: '2026-06-24.dahlia' }`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed Stripe API version to 2026-06-24.dahlia');
