const fs = require('fs');
const path = require('path');

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web\\components\\merchant\\MerchantHome.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Remove the duplicate import line
const duplicate = `import MerchantMenu from './MerchantMenu'\n`;
const first = content.indexOf(duplicate);
const second = content.indexOf(duplicate, first + 1);

if (second !== -1) {
  content = content.slice(0, second) + content.slice(second + duplicate.length);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Removed duplicate MerchantMenu import.');
} else {
  console.log('No duplicate found. Printing import lines:');
  content.split('\n').slice(0, 10).forEach((line, i) => console.log(`Line ${i + 1}: ${line}`));
}
