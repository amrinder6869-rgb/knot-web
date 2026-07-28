const fs = require('fs');
const path = require('path');

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web\\components\\Feed.tsx');
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Find the line with "const mapped: Post[]"
let mappedLine = -1;
lines.forEach((line, i) => {
  if (line.includes('const mapped: Post[]') && line.includes('.map')) {
    mappedLine = i;
  }
});

if (mappedLine === -1) {
  console.log('ERROR: could not find mapped line');
  process.exit(1);
}

console.log('Found mapped at line ' + (mappedLine + 1));

// Remove any existing misplaced reactionsMap lines
const cleanedLines = lines.filter(line =>
  !line.includes('postIds2') &&
  !line.includes('reactionsData') &&
  !line.includes('reactionsMap') &&
  !line.includes('currentUserId2') &&
  !line.includes('currentAuthUser') &&
  !line.includes('Fetch reactions for all posts') &&
  !line.includes('.from(\'reactions\')') &&
  !line.includes('.select(\'post_id, emoji, user_id\')') &&
  !line.includes('.in(\'post_id\'') &&
  !line.includes('existing.n++') &&
  !line.includes('existing.mine') &&
  !line.includes('reactionsMap[r.post_id]')
);

// Find the new mapped line position after cleaning
let newMappedLine = -1;
cleanedLines.forEach((line, i) => {
  if (line.includes('const mapped: Post[]') && line.includes('.map')) {
    newMappedLine = i;
  }
});

console.log('New mapped line after cleaning: ' + (newMappedLine + 1));

// Insert the reactions fetch before the mapped line
const reactionsFetch = [
  `    // Fetch reactions for all posts`,
  `    const postIds = (data || []).map((p: any) => p.id)`,
  `    const { data: reactionsData } = await supabase`,
  `      .from('reactions')`,
  `      .select('post_id, emoji, user_id')`,
  `      .in('post_id', postIds)`,
  ``,
  `    const reactionsMap: Record<string, any[]> = {}`,
  `    const currentAuthUser = (await supabase.auth.getUser()).data.user`,
  `    ;(reactionsData || []).forEach((r: any) => {`,
  `      if (!reactionsMap[r.post_id]) reactionsMap[r.post_id] = []`,
  `      const existing = reactionsMap[r.post_id].find((x: any) => x.e === r.emoji)`,
  `      if (existing) { existing.n++; if (r.user_id === currentAuthUser?.id) existing.mine = true }`,
  `      else reactionsMap[r.post_id].push({ e: r.emoji, n: 1, mine: r.user_id === currentAuthUser?.id })`,
  `    })`,
  ``,
];

cleanedLines.splice(newMappedLine, 0, ...reactionsFetch);

// Update reactions: [] to use reactionsMap
const finalLines = cleanedLines.map(line => {
  if (line.includes('reactions:') && (line.includes('[]') || line.includes('reactions:  []'))) {
    return line.replace(/reactions:\s*\[\]/, 'reactions:  (reactionsMap[p.id] || [])');
  }
  return line;
});

fs.writeFileSync(filePath, finalLines.join('\n'), 'utf8');
console.log('Fixed: reactionsMap inserted before mapped, reactions populated from DB.');
