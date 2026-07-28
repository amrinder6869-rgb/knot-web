const fs = require('fs');
const path = require('path');

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web\\components\\HangoutCard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const oldCrew = `      <CrewSection
        hangoutId={hangout.id}
        currentUserId={currentUser?.id || ''}
        isPlanner={hangout.created_by === currentUser?.id}
      />`;

const newCrew = `      <CrewSection
        hangoutId={hangout.id}
        currentUserId={currentUser?.id || ''}
        isPlanner={hangout.created_by === currentUser?.id}
        isLive={isLive}
      />`;

if (content.includes(oldCrew)) {
  content = content.replace(oldCrew, newCrew);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('HangoutCard updated with isLive prop.');
} else {
  console.log('ERROR: Could not find CrewSection in HangoutCard. Printing lines with CrewSection:');
  content.split('\n').forEach((line, i) => {
    if (line.includes('CrewSection')) console.log(`Line ${i + 1}: ${line}`);
  });
}
