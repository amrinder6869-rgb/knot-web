const fs = require('fs');
const path = require('path');

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web\\components\\HangoutCard.tsx');
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Find line 688 anchor (0-indexed = 687)
// We look for the line that has borderSep and paddingTop: 12 (the comments border-top)
let anchorIndex = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('borderSep') && lines[i].includes('paddingTop: 12')) {
    anchorIndex = i;
    break;
  }
}

if (anchorIndex === -1) {
  console.log('ERROR: Could not find anchor line. Printing lines 685-692 for diagnosis:');
  for (let i = 684; i < 692; i++) {
    console.log(`Line ${i + 1}: ${lines[i]}`);
  }
  process.exit(1);
}

console.log(`Found anchor at line ${anchorIndex + 1}: ${lines[anchorIndex]}`);

// Insert CrewSection before that line
const crewLines = [
  `      <CrewSection`,
  `        hangoutId={hangout.id}`,
  `        currentUserId={currentUser?.id || ''}`,
  `        isPlanner={hangout.created_by === currentUser?.id}`,
  `      />`,
  ``,
];

lines.splice(anchorIndex, 0, ...crewLines);

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('CrewSection inserted successfully.');
console.log('HangoutCard.tsx patched.');
