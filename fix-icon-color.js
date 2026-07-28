const fs = require('fs');
const path = require('path');

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web\\components\\RoleAssignSheet.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Fix the Icon component call that passes color prop
// Instead wrap in a span with the color and remove color from Icon
const oldIcon = `          <Icon size={16} strokeWidth={2} color={active ? styles.activeText : 'var(--text3)'} />`;
const newIcon = `          <span style={{ color: active ? styles.activeText : 'var(--text3)', display: 'flex' }}><Icon size={16} strokeWidth={2} /></span>`;

if (content.includes(oldIcon)) {
  content = content.replace(oldIcon, newIcon);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Fixed: removed color prop from Icon, wrapped in colored span.');
} else {
  console.log('Pattern not found. Checking icon lines:');
  content.split('\n').forEach((line, i) => {
    if (line.includes('<Icon') && line.includes('color')) console.log(`Line ${i + 1}: ${line}`);
  });
}
