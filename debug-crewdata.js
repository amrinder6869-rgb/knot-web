const fs = require('fs');
const path = require('path');

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web\\components\\CrewSection.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const oldLog = `      console.log('CrewSection data:', crewData)
      setCrew(crewData)`;

const newLog = `      console.log('CrewSection data:', JSON.stringify(crewData))
      setCrew(crewData)`;

if (content.includes(oldLog)) {
  content = content.replace(oldLog, newLog);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Updated log to JSON.stringify.');
} else {
  // Add it before setCrew
  const oldSet = `      setCrew(crewData)`;
  const newSet = `      console.log('roleMap:', JSON.stringify(roleMap))
      console.log('profiles:', JSON.stringify(profiles))
      console.log('crewData:', JSON.stringify(crewData))
      setCrew(crewData)`;
  if (content.includes(oldSet)) {
    content = content.replace(oldSet, newSet);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Added detailed logs before setCrew.');
  } else {
    console.log('ERROR: Could not find setCrew. No changes made.');
  }
}
