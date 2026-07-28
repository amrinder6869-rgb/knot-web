const fs = require('fs');
const path = require('path');
const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web\\components\\RoleAssignSheet.tsx');
console.log(fs.readFileSync(filePath, 'utf8'));
