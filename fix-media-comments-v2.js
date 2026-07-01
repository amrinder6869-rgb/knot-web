const fs = require('fs')
const lines = fs.readFileSync('components/Memories.tsx', 'utf8').split('\n')

// Replace lines 58-70 (index 57-69) with the new photo loading logic
const newBlock = `    const { data: photoData } = await supabase
      .from('photos')
      .select('*, profiles:uploaded_by(name)')
      .eq('knot_id', knotId)
      .order('created_at', { ascending: false })

    const { data: knotPosts } = await supabase
      .from('posts')
      .select('id')
      .eq('knot_id', knotId)

    const postIds = (knotPosts || []).map((p) => p.id)
    let commentPhotos = []
    if (postIds.length > 0) {
      const { data: commentPhotoData, error: commentPhotoError } = await supabase
        .from('comments')
        .select('id, photo_path, created_at, author_id, profiles:author_id(name)')
        .in('post_id', postIds)
        .not('photo_path', 'is', null)

      if (commentPhotoError) console.error('Comment photo fetch error:', JSON.stringify(commentPhotoError))

      commentPhotos = (commentPhotoData || []).map((c) => ({
        id: 'comment-' + c.id,
        storage_path: c.photo_path,
        uploaded_by: c.author_id,
        profiles: c.profiles,
        created_at: c.created_at,
        caption: null,
        hangout_id: null,
        from_comment: true,
      }))
    }

    const allPhotoRecords = [...(photoData || []), ...commentPhotos]

    if (allPhotoRecords.length > 0) {
      const withUrls = await Promise.all(allPhotoRecords.map(async (p) => {
        const { data: { publicUrl } } = supabase.storage.from('knot-photos').getPublicUrl(p.storage_path)
        return { ...p, url: publicUrl }
      }))
      withUrls.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setPhotos(withUrls)
      setStats(s => ({ ...s, photos: withUrls.length }))
    }`

const newLines = newBlock.split('\n')

// lines[57] through lines[69] (0-indexed) correspond to displayed lines 58-70
const before = lines.slice(0, 57)
const after = lines.slice(70)
const result = [...before, ...newLines, ...after]

fs.writeFileSync('components/Memories.tsx', result.join('\n'), 'utf8')
console.log('Done. Replaced lines 58-70 with comment photo merge logic.')
