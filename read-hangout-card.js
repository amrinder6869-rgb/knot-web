const fs = require('fs');
const path = require('path');

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web\\components\\HangoutCard.tsx');
const content = fs.readFileSync(filePath, 'utf8');
console.log(content);
