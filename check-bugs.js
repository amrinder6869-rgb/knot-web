const fs = require('fs');
const path = require('path');

const BASE = 'C:\\Users\\amrin\\Documents\\knot-web';

// B1: Check ESLint unused vars
const filesToCheck = [
  'components/Discover.tsx',
  'components/Memories.tsx',
  'components/Feed.tsx',
  'components/Members.tsx',
  'components/MostLikelyTo.tsx',
  'components/Ludo.tsx',
];

console.log('=== B1: Checking for unused variables ===');
filesToCheck.forEach(f => {
  const full = path.join(BASE, f);
  if (!fs.existsSync(full)) { console.log(f + ' — NOT FOUND'); return; }
  const content = fs.readFileSync(full, 'utf8');
  const issues = [];
  if (f.includes('Discover') && content.includes('members: _members') === false && content.match(/members[^:]/)) issues.push('members may be unused');
  if (f.includes('Feed') && content.includes('knotName') && !content.includes('_knotName')) issues.push('knotName may be unused');
  if (f.includes('Members') && content.match(/members[^:]/)) issues.push('check members prop');
  if (f.includes('MostLikelyTo') && content.includes('knotId') && !content.includes('_knotId')) issues.push('knotId may be unused');
  if (f.includes('Ludo') && content.includes('knotId') && !content.includes('_knotId')) issues.push('knotId may be unused');
  console.log(f + ': ' + (issues.length ? issues.join(', ') : 'OK'));
});

// B2: Check BillSplit divide by zero
console.log('\n=== B2: Checking BillSplit ===');
const billPath = path.join(BASE, 'components\\BillSplit.tsx');
if (fs.existsSync(billPath)) {
  const content = fs.readFileSync(billPath, 'utf8');
  if (content.includes('knotMembers.length === 0')) {
    console.log('BillSplit.tsx: Zero guard EXISTS - fixed');
  } else {
    console.log('BillSplit.tsx: Zero guard MISSING - needs fix');
  }
}

// B3: Check CSS tokens
console.log('\n=== B3: Checking CSS tokens ===');
const cssPath = path.join(BASE, 'app\\globals.css');
if (fs.existsSync(cssPath)) {
  const content = fs.readFileSync(cssPath, 'utf8');
  console.log('--indigo defined: ' + content.includes('--indigo'));
  console.log('--indigo-dim defined: ' + content.includes('--indigo-dim'));
  console.log('--rust defined: ' + content.includes('--rust'));
  console.log('--olive defined: ' + content.includes('--olive'));
  console.log('--danger defined: ' + content.includes('--danger'));
}

// U1: Check dashboard empty state
console.log('\n=== U1: Checking dashboard empty state ===');
const dashPath = path.join(BASE, 'app\\dashboard\\page.tsx');
if (fs.existsSync(dashPath)) {
  const content = fs.readFileSync(dashPath, 'utf8');
  if (content.includes('knots.length === 0') || content.includes('setShowHome(false)')) {
    console.log('Dashboard: Empty state check EXISTS');
  } else {
    console.log('Dashboard: Empty state check MISSING - needs fix');
  }
}

// U4: Check Delete Knot styling
console.log('\n=== U4: Checking Delete Knot styling ===');
if (fs.existsSync(dashPath)) {
  const content = fs.readFileSync(dashPath, 'utf8');
  if (content.includes('danger') && content.includes('deleteKnot')) {
    console.log('Delete Knot: Uses danger color - fixed');
  } else {
    console.log('Delete Knot: May not use danger color - check needed');
  }
}

console.log('\nDone. Review above to see what needs fixing.');
