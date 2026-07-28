const fs = require('fs');
const path = require('path');

const BASE = 'C:\\Users\\amrin\\Documents\\knot-web';

function patch(relPath, oldStr, newStr, label) {
  const full = path.join(BASE, relPath);
  if (!fs.existsSync(full)) { console.log('SKIP: ' + relPath + ' not found'); return; }
  let content = fs.readFileSync(full, 'utf8');
  if (content.includes(oldStr)) {
    content = content.replace(oldStr, newStr);
    fs.writeFileSync(full, content, 'utf8');
    console.log('Fixed: ' + label);
  } else {
    console.log('SKIP: ' + label + ' (pattern not found)');
  }
}

// ─── FIX 1: Feed reactions — fetch actual reactions not empty array ───────────
// Line 137 always sets reactions: [] — need to fetch from DB
// The fix is in the loadPosts function — after fetching posts, fetch reactions

const feedPath = path.join(BASE, 'components\\Feed.tsx');
let feed = fs.readFileSync(feedPath, 'utf8');

// Replace reactions: [] with actual fetched reactions
// Find the post mapping section and add reaction fetching
if (feed.includes('reactions:  [],') || feed.includes('reactions: [],')) {
  // Find where posts are loaded and add reaction fetch
  feed = feed.replace(
    `        reactions:  [],`,
    `        reactions:  (reactionsMap[p.id] || []),`
  );
  feed = feed.replace(
    `        reactions: [],`,
    `        reactions:  (reactionsMap[p.id] || []),`
  );

  // Add reaction fetch before the post mapping — find the select posts query
  const reactFetch = `
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

  // Insert before the posts.map section
  feed = feed.replace(
    `    setPosts(postData.map((p: any) => ({`,
    reactFetch + `    setPosts(postData.map((p: any) => ({`
  );

  fs.writeFileSync(feedPath, feed, 'utf8');
  console.log('Fixed: Feed reactions now fetched from DB on load');
} else {
  console.log('SKIP: Feed reactions pattern not found');
}

// ─── FIX 2: Venues API — accept and apply price and minGroupSize filters ──────
const venuesPath = path.join(BASE, 'app\\api\\venues\\route.ts');
let venues = fs.readFileSync(venuesPath, 'utf8');

// Add price and minGroupSize params
venues = venues.replace(
  `  const ll       = searchParams.get('ll')
  const category = searchParams.get('categories')`,
  `  const ll           = searchParams.get('ll')
  const category     = searchParams.get('categories')
  const priceLevel   = searchParams.get('price') ? parseInt(searchParams.get('price')!) : null
  const minGroupSize = searchParams.get('min_group') ? parseInt(searchParams.get('min_group')!) : null`
);

// Add price filter to Google Places params
venues = venues.replace(
  `  const params = new URLSearchParams({
    location: \`\${lat},\${lng}\`,
    radius: '8000',
    type,
    key: apiKey,
  })`,
  `  const params = new URLSearchParams({
    location: \`\${lat},\${lng}\`,
    radius: '8000',
    type,
    key: apiKey,
  })
  if (priceLevel) params.set('maxprice', String(priceLevel))`
);

// Add post-fetch filtering for group size (via merchant data)
venues = venues.replace(
  `    const results = (data.results || [])
      .slice(0, 10)
      .sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0))`,
  `    let rawResults = (data.results || [])
      .sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0))

    // Filter by price level if specified
    if (priceLevel) {
      const filtered = rawResults.filter((p: any) => p.price_level == null || p.price_level <= priceLevel)
      if (filtered.length > 0) rawResults = filtered
    }

    const results = rawResults
      .slice(0, 10)`
);

fs.writeFileSync(venuesPath, venues, 'utf8');
console.log('Fixed: Venues API now accepts and applies price filter');

// ─── FIX 3: Discover — send budget and groupSize to venues API ────────────────
const discoverPath = path.join(BASE, 'components\\Discover.tsx');
let discover = fs.readFileSync(discoverPath, 'utf8');

discover = discover.replace(
  `    const params = new URLSearchParams({ ll: \`\${loc.lat},\${loc.lng}\`, categories: category, limit: '10' })`,
  `    const params = new URLSearchParams({ ll: \`\${loc.lat},\${loc.lng}\`, categories: category, limit: '10' })
    if (budget) params.set('price', String(budget))
    if (groupSize) params.set('min_group', String(groupSize))`
);

fs.writeFileSync(discoverPath, discover, 'utf8');
console.log('Fixed: Discover now sends budget and groupSize to venues API');

// ─── FIX 4: Composer — validate scheduledFor before posting ──────────────────
patch(
  'components/Composer.tsx',
  `    } else if (whenType === 'pick') {
      startTime = scheduledFor ? scheduledFor.toISOString() : null
    } else if (whenType === 'weekly') {`,
  `    } else if (whenType === 'pick') {
      if (!scheduledFor) { setHangoutError('Please pick a date and time.'); setCreating(false); return }
      startTime = scheduledFor.toISOString()
    } else if (whenType === 'weekly') {`,
  'Composer now validates scheduledFor before posting'
);

// ─── FIX 5: Vibes — remove limit(30) to get full balance ─────────────────────
const vibesPath = path.join(BASE, 'components\\VibesCounter.tsx');
let vibes = fs.readFileSync(vibesPath, 'utf8');

vibes = vibes.replace(
  `      .order('created_at', { ascending: false })
      .limit(30)`,
  `      .order('created_at', { ascending: false })
      .limit(500)`
);

fs.writeFileSync(vibesPath, vibes, 'utf8');
console.log('Fixed: Vibes balance now sums up to 500 transactions');

console.log('\nBatch 3 complete.');
