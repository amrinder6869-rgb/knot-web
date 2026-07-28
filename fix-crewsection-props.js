const fs = require('fs');
const path = require('path');

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web\\components\\HangoutCard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Find the CrewSection without knotId and add it
const oldCrew = `      <CrewSection
        hangoutId={hangout.id}
        currentUserId={currentUser?.id || ''}
        isPlanner={hangout.created_by === currentUser?.id}
      />`;

const newCrew = `      <CrewSection
        hangoutId={hangout.id}
        knotId={knotId}
        currentUserId={currentUser?.id || ''}
        isPlanner={hangout.created_by === currentUser?.id}
        isLive={isLive}
      />`;

if (content.includes(oldCrew)) {
  content = content.replace(oldCrew, newCrew);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Fixed: added knotId and isLive props to CrewSection.');
} else {
  console.log('Pattern not found. Printing all CrewSection usages:');
  content.split('\n').forEach((line, i) => {
    if (line.includes('CrewSection')) console.log(`Line ${i + 1}: ${line}`);
  });
}
