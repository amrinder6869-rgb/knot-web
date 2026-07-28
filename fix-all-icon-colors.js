const fs = require('fs');
const path = require('path');

const BASE = 'C:\\Users\\amrin\\Documents\\knot-web\\components';

// Fix RoleAssignSheet
const sheetPath = path.join(BASE, 'RoleAssignSheet.tsx');
let sheet = fs.readFileSync(sheetPath, 'utf8');
const oldSheetIcon = `          <span style={{ color: active ? styles.activeText : 'var(--text3)', display: 'flex' }}><Icon size={16} strokeWidth={2} /></span>`;
if (sheet.includes(oldSheetIcon)) {
  console.log('RoleAssignSheet already fixed.');
} else {
  sheet = sheet.replace(
    `          <Icon size={16} strokeWidth={2} color={active ? styles.activeText : 'var(--text3)'} />`,
    `          <span style={{ color: active ? styles.activeText : 'var(--text3)', display: 'flex' }}><Icon size={16} strokeWidth={2} /></span>`
  );
  fs.writeFileSync(sheetPath, sheet, 'utf8');
  console.log('Fixed RoleAssignSheet icon color.');
}

// Fix RoleBadge — uses color prop on Icon
const badgePath = path.join(BASE, 'RoleBadge.tsx');
let badge = fs.readFileSync(badgePath, 'utf8');
// The RoleBadge icon inherits color from parent span so no color prop needed
// Check if it has color prop
if (badge.includes('<Icon') && badge.includes('color=')) {
  // Remove color prop from Icon calls
  badge = badge.replace(/(<Icon[^>]*?) color=\{[^}]+\}/g, '$1');
  fs.writeFileSync(badgePath, badge, 'utf8');
  console.log('Fixed RoleBadge icon color prop.');
} else {
  console.log('RoleBadge: no color prop on Icon, already clean.');
}

// Fix CrewSection — CheckCircle uses color prop
const crewPath = path.join(BASE, 'CrewSection.tsx');
let crew = fs.readFileSync(crewPath, 'utf8');
if (crew.includes('CheckCircle') && crew.includes('color=')) {
  crew = crew.replace(/<CheckCircle size=\{11\} strokeWidth=\{2\.5\} \/>/g, '<CheckCircle size={11} strokeWidth={2.5} />');
  // Wrap CheckCircle in colored span
  crew = crew.replace(
    `{done && <CheckCircle size={11} strokeWidth={2.5} />}`,
    `{done && <span style={{ display: 'flex', color: '#4ade80' }}><CheckCircle size={11} strokeWidth={2.5} /></span>}`
  );
  fs.writeFileSync(crewPath, crew, 'utf8');
  console.log('Fixed CrewSection CheckCircle color prop.');
} else {
  console.log('CrewSection: CheckCircle color already handled via span.');
}

// Also fix PostHangoutLoop CheckCircle and Star color props
const loopPath = path.join(BASE, 'PostHangoutLoop.tsx');
let loop = fs.readFileSync(loopPath, 'utf8');
let loopChanged = false;

// Fix Star color and fill props
if (loop.includes('<Star') && loop.includes('color=')) {
  loop = loop.replace(
    /<Star(\s+[^>]*?)color=\{[^}]+\}(\s+[^>]*?)fill=\{[^}]+\}/g,
    (match, before, after) => `<Star${before}${after}`
  );
  // Wrap stars in colored spans
  loop = loop.replace(
    `<Star\n                  size={18}\n                  strokeWidth={2}\n                  color={displayRating && r <= displayRating ? 'var(--yellow)' : 'var(--text3)'}\n                  fill={displayRating && r <= displayRating ? 'var(--yellow)' : 'none'}\n                />`,
    `<span style={{ color: displayRating && r <= displayRating ? 'var(--yellow)' : 'var(--text3)' }}><Star size={18} strokeWidth={2} /></span>`
  );
  loopChanged = true;
}

// Fix CheckCircle color props in PostHangoutLoop
loop = loop.replace(
  `<CheckCircle size={16} color="#4ade80" strokeWidth={2} />`,
  `<span style={{ color: '#4ade80', display: 'flex' }}><CheckCircle size={16} strokeWidth={2} /></span>`
);

if (loopChanged || loop.includes(`style={{ color: '#4ade80'`)) {
  fs.writeFileSync(loopPath, loop, 'utf8');
  console.log('Fixed PostHangoutLoop icon color props.');
} else {
  console.log('PostHangoutLoop: no color props found.');
}

console.log('\nAll icon color props fixed. Push again.');
