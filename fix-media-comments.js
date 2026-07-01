const fs = require('fs')
let content = fs.readFileSync('components/Memories.tsx', 'utf8')

// Add loading of comment photos alongside regular photos
const oldLoad = `    const { data: photoData } = await supabase
      .from('photos')
      .select('*, profiles:uploaded_by(name)')
      .eq('knot_id', knotId)
      .order('created_at', { ascending: false })

    if (photoData) {
      const withUrls = await Promise.all(photoData.map(async (p: any) => {
        const { data: { publicUrl } } = supabase.storage.from('knot-photos').getPublicUrl(p.storage_path)
        return { ...p, url: publicUrl }
      }))
      setPhotos(withUrls)
    }`

const newLoad = `    const { data: photoData } = await supabase
      .from('photos')
      .select('*, profiles:uploaded_by(name)')
      .eq('knot_id', knotId)
      .order('created_at', { ascending: false })

    // Pull photos attached to comments on this knot's posts
    const { data: knotPosts } = await supabase
      .from('posts')
      .select('id')
      .eq('knot_id', knotId)

    const postIds = (knotPosts || []).map((p: any) => p.id)
    let commentPhotos: any[] = []
    if (postIds.length > 0) {
      const { data: commentPhotoData } = await supabase
        .from('comments')
        .select('id, photo_path, created_at, author_id, profiles:author_id(name)')
        .in('post_id', postIds)
        .not('photo_path', 'is', null)

      commentPhotos = (commentPhotoData || []).map((c: any) => ({
        id:           'comment-' + c.id,
        storage_path: c.photo_path,
        uploaded_by:  c.author_id,
        profiles:     c.profiles,
        created_at:   c.created_at,
        caption:      null,
        hangout_id:   null,
        from_comment: true,
      }))
    }

    const allPhotoRecords = [...(photoData || []), ...commentPhotos]

    if (allPhotoRecords.length > 0) {
      const withUrls = await Promise.all(allPhotoRecords.map(async (p: any) => {
        const { data: { publicUrl } } = supabase.storage.from('knot-photos').getPublicUrl(p.storage_path)
        return { ...p, url: publicUrl }
      }))
      withUrls.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setPhotos(withUrls)
    }`

if (!content.includes(oldLoad)) {
  console.log('ERROR: could not find the exact block to replace in Memories.tsx')
  process.exit(1)
}

content = content.replace(oldLoad, newLoad)

// Update stats photo count to include comment photos
const oldStats = `    const [{ count: hangCount }, { count: photoCount }, { count: memberCount }] = await Promise.all([
      supabase.from('hangouts').select('*', { count: 'exact', head: true }).eq('knot_id', knotId),
      supabase.from('photos').select('*', { count: 'exact', head: true }).eq('knot_id', knotId),
      supabase.from('knot_members').select('*', { count: 'exact', head: true }).eq('knot_id', knotId),
    ])

    setStats({ hangs: hangCount || 0, photos: photoCount || 0, members: memberCount || 0 })`

const newStats = `    const [{ count: hangCount }, { count: photoCount }, { count: memberCount }] = await Promise.all([
      supabase.from('hangouts').select('*', { count: 'exact', head: true }).eq('knot_id', knotId),
      supabase.from('photos').select('*', { count: 'exact', head: true }).eq('knot_id', knotId),
      supabase.from('knot_members').select('*', { count: 'exact', head: true }).eq('knot_id', knotId),
    ])

    // Note: exact comment-photo count added after photos load below; stats.photos updated there too`

content = content.replace(oldStats, newStats)

// Update stats.photos once allPhotoRecords is known
content = content.replace(
  `      withUrls.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setPhotos(withUrls)
    }

    setLoading(false)`,
  `      withUrls.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setPhotos(withUrls)
      setStats(s => ({ ...s, photos: withUrls.length }))
    }

    setLoading(false)`
)

// Disable delete for comment-sourced photos (they belong to the comment, not standalone)
content = content.replace(
  `  async function deletePhoto(photo: any) {
    if (!user || photo.uploaded_by !== user.id) return`,
  `  async function deletePhoto(photo: any) {
    if (photo.from_comment) return
    if (!user || photo.uploaded_by !== user.id) return`
)

fs.writeFileSync('components/Memories.tsx', content, 'utf8')
console.log('Done. Media gallery now includes photos attached to comments.')
