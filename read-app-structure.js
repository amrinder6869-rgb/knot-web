const fs = require('fs');
const path = require('path');

const BASE = 'C:\\Users\\amrin\\Documents\\knot-web\\app';

function readDir(dir, depth = 0) {
  const items = fs.readdirSync(dir);
  items.forEach(item => {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    const indent = '  '.repeat(depth);
    if (stat.isDirectory()) {
      console.log(`${indent}${item}/`);
      if (depth < 3) readDir(full, depth + 1);
    } else {
      console.log(`${indent}${item}`);
    }
  });
}

readDir(BASE);
