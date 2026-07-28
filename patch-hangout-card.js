const fs = require('fs');
const path = require('path');

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web\\components\\HangoutCard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add CrewSection import after the BillSplitForm import
const oldImport = `import BillSplitForm from '@/components/BillSplitForm'`;
const newImport = `import BillSplitForm from '@/components/BillSplitForm'
import { CrewSection } from '@/components/CrewSection'`;

if (content.includes(oldImport)) {
  content = content.replace(oldImport, newImport);
  console.log('Import added.');
} else {
  console.log('ERROR: Could not find the BillSplitForm import line. Import not added.');
  process.exit(1);
}

// 2. Add CrewSection component just before the comments section
// We insert it right before the comments border-top div
const oldComments = `      <div style={{ borderTop: \`1px solid \${borderSep}\`, paddingTop: 12 }}>
        <button onClick={() => setShowComments(s => !s)}`;

const newComments = `      <CrewSection
        hangoutId={hangout.id}
        currentUserId={currentUser?.id || ''}
        isPlanner={hangout.created_by === currentUser?.id}
      />

      <div style={{ borderTop: \`1px solid \${borderSep}\`, paddingTop: 12 }}>
        <button onClick={() => setShowComments(s => !s)}`;

if (content.includes(oldComments)) {
  content = content.replace(oldComments, newComments);
  console.log('CrewSection component added.');
} else {
  console.log('ERROR: Could not find the comments section anchor. Component not added.');
  process.exit(1);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('\nHangoutCard.tsx patched successfully.');
console.log('The Crew section will now appear on every hangout card above the comments.');
