const fs = require('fs');
const path = require('path');

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web\\components\\Feed.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const brokenToggle = `    if (existing) {
        .eq('post_id', postId).eq('user_id', user.id).eq('emoji', emoji)
    } else {
    }`;

const fixedToggle = `    if (existing) {
      await supabase.from('reactions').delete()
        .eq('post_id', postId).eq('user_id', user.id).eq('emoji', emoji)
    } else {
      await supabase.from('reactions').insert({ post_id: postId, user_id: user.id, emoji })
    }`;

if (content.includes(brokenToggle)) {
  content = content.replace(brokenToggle, fixedToggle);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Fixed: toggleReaction function restored.');
} else {
  console.log('ERROR: broken toggle pattern not found. Printing lines 248-254:');
  content.split('\n').slice(247, 254).forEach((l, i) => console.log(`Line ${i+248}: ${l}`));
}
