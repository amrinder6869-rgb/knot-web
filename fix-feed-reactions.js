const fs = require('fs');
const path = require('path');

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web\\components\\Feed.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// First remove the misplaced reactionsMap fetch that was inserted after setPosts
const misplacedFetch = `
    // Fetch reactions for all posts
    const postIds2 = (postData || []).map((p: any) => p.id)
    const { data: reactionsData } = await supabase
      .from('reactions')
      .select('post_id, emoji, user_id')
      .in('post_id', postIds2)

    const reactionsMap: Record<string, any[]> = {}
    const currentUserId2 = (await supabase.auth.getUser()).data.user?.id
    ;(reactionsData || []).forEach((r: any) => {
      if (!reactionsMap[r.post_id]) reactionsMap[r.post_id] = []
      const existing = reactionsMap[r.post_id].find((x: any) => x.e === r.emoji)
      if (existing) { existing.n++; if (r.user_id === currentUserId2) existing.mine = true }
      else reactionsMap[r.post_id].push({ e: r.emoji, n: 1, mine: r.user_id === currentUserId2 })
    })

`;

if (content.includes(misplacedFetch)) {
  content = content.replace(misplacedFetch, '');
  console.log('Removed misplaced reactionsMap fetch');
} else {
  console.log('Misplaced fetch not found with exact match, trying line-based removal');
}

// Now insert it in the right place — between error check and mapped variable
const anchor = `    if (error) { setLoading(false); return }

    const mapped: Post[] = (data || []).map((p: any) => {`;

const withReactions = `    if (error) { setLoading(false); return }

    // Fetch reactions for all posts
    const postIds = (data || []).map((p: any) => p.id)
    const { data: reactionsData } = await supabase
      .from('reactions')
      .select('post_id, emoji, user_id')
      .in('post_id', postIds)

    const reactionsMap: Record<string, any[]> = {}
    const currentAuthUser = (await supabase.auth.getUser()).data.user
    ;(reactionsData || []).forEach((r: any) => {
      if (!reactionsMap[r.post_id]) reactionsMap[r.post_id] = []
      const existing = reactionsMap[r.post_id].find((x: any) => x.e === r.emoji)
      if (existing) { existing.n++; if (r.user_id === currentAuthUser?.id) existing.mine = true }
      else reactionsMap[r.post_id].push({ e: r.emoji, n: 1, mine: r.user_id === currentAuthUser?.id })
    })

    const mapped: Post[] = (data || []).map((p: any) => {`;

if (content.includes(anchor)) {
  content = content.replace(anchor, withReactions);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Fixed: reactionsMap now fetched before mapped variable.');
} else {
  console.log('ERROR: anchor not found. Printing lines 118-122:');
  content.split('\n').slice(117, 122).forEach((l, i) => console.log(`Line ${i+118}: ${l}`));
}
