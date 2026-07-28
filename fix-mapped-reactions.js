const fs = require('fs');
const path = require('path');

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web\\components\\Feed.tsx');
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Find the mapped object - look for profiles: p.profiles line
let profilesLine = -1;
lines.forEach((line, i) => {
  if (line.includes('profiles:') && line.includes('p.profiles') && !line.includes('//')) {
    profilesLine = i;
    console.log('Found profiles line at ' + (i+1) + ': ' + line);
  }
});

if (profilesLine === -1) {
  console.log('ERROR: profiles line not found');
  process.exit(1);
}

// Check if reactions line already exists nearby
const nearby = lines.slice(profilesLine - 3, profilesLine + 3);
const hasReactions = nearby.some(l => l.includes('reactions:'));
console.log('Has reactions nearby: ' + hasReactions);

if (!hasReactions) {
  // Insert reactions line after profiles line
  lines.splice(profilesLine + 1, 0, `        reactions:  (reactionsMap?.[p.id] || []),`);
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
  console.log('Added reactions field to mapped Post object.');
} else {
  console.log('Reactions already present, checking exact line:');
  lines.slice(profilesLine - 3, profilesLine + 3).forEach((l, i) => {
    console.log(`Line ${profilesLine - 2 + i}: ${l}`);
  });
}
