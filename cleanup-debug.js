const fs = require('fs');
const path = require('path');

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web\\components\\CrewSection.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Remove all debug console.log lines
const debugLines = [
  `      console.log('Roles query hangoutId:', hangoutId)\n`,
  `      console.log('Roles data:', roles)\n`,
  `      console.log('Roles error:', rolesError)\n`,
  `      console.log('roleMap:', JSON.stringify(roleMap))\n`,
  `      console.log('profiles:', JSON.stringify(profiles))\n`,
  `      console.log('crewData:', JSON.stringify(crewData))\n`,
  `      console.log('CrewSection data:', JSON.stringify(crewData))\n`,
];

debugLines.forEach(line => {
  content = content.split(line).join('');
});

// Also remove the error variable from roles query if it was added
content = content.replace(
  `const { data: roles, error: rolesError } = await supabase`,
  `const { data: roles } = await supabase`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Debug logs removed. CrewSection is clean.');
