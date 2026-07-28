const fs = require('fs');
const path = require('path');

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web\\components\\Feed.tsx');
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Find the broken lines
let ifLine = -1;
lines.forEach((line, i) => {
  if (line.includes('.eq(\'post_id\', postId).eq(\'user_id\', user.id).eq(\'emoji\', emoji)')) {
    ifLine = i;
  }
});

if (ifLine === -1) {
  console.log('ERROR: cannot find broken line');
  process.exit(1);
}

console.log('Found broken line at: ' + (ifLine + 1));
console.log('Line content: ' + lines[ifLine]);

// The structure is:
// ifLine-1: if (existing) {
// ifLine:   .eq(...)    <-- broken, missing the delete call above
// ifLine+1: } else {
// ifLine+2: }

// Replace lines ifLine-1 through ifLine+2 with correct code
lines.splice(ifLine - 1, 4,
  '    if (existing) {',
  '      await supabase.from(\'reactions\').delete()',
  '        .eq(\'post_id\', postId).eq(\'user_id\', user.id).eq(\'emoji\', emoji)',
  '    } else {',
  '      await supabase.from(\'reactions\').insert({ post_id: postId, user_id: user.id, emoji })',
  '    }'
);

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('Fixed: toggleReaction function restored with delete and insert calls.');
