const fs = require('fs');
const path = require('path');

const BASE = 'C:\\Users\\amrin\\Documents\\knot-web';

// Fix 1: Double dollar sign in PreOrderCard
const preOrderPath = path.join(BASE, 'components\\PreOrderCard.tsx');
let preOrderContent = fs.readFileSync(preOrderPath, 'utf8');

// The template literal has \$\$ which renders as $$ — fix to just \$
preOrderContent = preOrderContent.split('\\$\\$').join('\\$');

fs.writeFileSync(preOrderPath, preOrderContent, 'utf8');
console.log('Fixed: double dollar sign in PreOrderCard');

// Fix 2: Duplicate MerchantMenu in MerchantHome
const homePath = path.join(BASE, 'components\\merchant\\MerchantHome.tsx');
let homeContent = fs.readFileSync(homePath, 'utf8');

// Check how many times MerchantMenu tab is rendered
const count = (homeContent.match(/activeTab === 'menu'/g) || []).length;
console.log('MerchantMenu tab render count: ' + count);

if (count > 1) {
  // Remove the second occurrence
  const idx = homeContent.indexOf("activeTab === 'menu'");
  const second = homeContent.indexOf("activeTab === 'menu'", idx + 1);
  const lineStart = homeContent.lastIndexOf('\n', second) + 1;
  const lineEnd = homeContent.indexOf('\n', second) + 1;
  homeContent = homeContent.slice(0, lineStart) + homeContent.slice(lineEnd);
  fs.writeFileSync(homePath, homeContent, 'utf8');
  console.log('Fixed: removed duplicate MerchantMenu tab render');
} else {
  console.log('No duplicate found in MerchantHome');
}
