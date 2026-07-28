const fs = require('fs');
const path = require('path');

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web\\components\\HangoutCard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Check if import already exists
if (content.includes("import { CrewSection }")) {
  console.log('Import already present. Checking exact text:');
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('CrewSection')) {
      console.log(`Line ${i + 1}: ${line}`);
    }
  });
  process.exit(0);
}

// Import missing — add it after BillSplitForm import
const oldImport = `import BillSplitForm from '@/components/BillSplitForm'`;
const newImport = `import BillSplitForm from '@/components/BillSplitForm'
import { CrewSection } from '@/components/CrewSection'`;

if (content.includes(oldImport)) {
  content = content.replace(oldImport, newImport);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Import added successfully.');
} else {
  // Try alternate quote style
  const altImport = `import BillSplitForm from "@/components/BillSplitForm"`;
  if (content.includes(altImport)) {
    content = content.replace(altImport, `import BillSplitForm from "@/components/BillSplitForm"
import { CrewSection } from '@/components/CrewSection'`);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Import added successfully (alt quotes).');
  } else {
    console.log('ERROR: Could not find BillSplitForm import. Printing first 10 imports:');
    const lines = content.split('\n');
    lines.slice(0, 10).forEach((line, i) => console.log(`Line ${i + 1}: ${line}`));
  }
}
