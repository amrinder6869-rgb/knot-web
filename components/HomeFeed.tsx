'use client'
import { useState, useEffect } from 'react'
import { ChevronRight } from 'lucide-react'
import { supabase, getSignedUrl } from '@/lib/supabase'
import MemberAvatar from '@/components/MemberAvatar'

function timeAgo(date: string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function groupPhotos(photos: any[]) {
  const groups: any[][] = []
  const used = new Set<string>()
  for (const p of photos) {
    if (used.has(p.id)) continue
    const group = photos.filter(q =>
      !used.has(q.id) &&
      q.uploaded_by === p.uploaded_by &&
      q.knot_id === p.knot_id &&
      Math.abs(new Date(q.created_at).getTime() - new Date(p.created_at).getTime()) < 60000
    )
    group.forEach(q => used.add(q.id))
    groups.push(group)
  }
  return groups
}

export default function HomeFeed({ knots, onSelectKnot }: { knots: any[], onSelectKnot: (knot: any) => void }) {
  const [items, setItems]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (knots.length > 0) loadFeed()
  }, [knots])

  async function loadFeed() {
    const knotIds = knots.map(k => k.id)

    const [{ data: posts }, { data: photos }] = await Promise.all([
      supabase
        .from('posts')
        .select('*, profiles:author_id(name, avatar_url, username), knots:knot_id(id, name, emoji)')
        .in('knot_id', knotIds)
        .order('created_at', { ascending: false })
        .limit(40),
      supabase
        .from('photos')
        .select('id, storage_path, media_type, caption, created_at, post_id, hangout_id, knot_id, uploaded_by, profiles:uploaded_by(name, avatar_url, username), knots:knot_id(id, name, emoji)')
        .in('knot_id', knotIds)
        .order('created_at', { ascending: false })
        .limit(40),
    ])

    const photosWithUrls = await Promise.all((photos || []).map(async (p: any) => {
      const signedUrl = await getSignedUrl(p.storage_path)
      return { ...p, url: signedUrl ?? '', media_type: p.media_type ?? 'image' }
    }))

    const photoGroups = groupPhotos(photosWithUrls).map(group => ({
      _type:      'photo_group',
      id:         group[0].id,
      created_at: group[0].created_at,
      knots:      group[0].knots,
      profiles:   group[0].profiles,
      photos:     group,
      caption:    group.find(p => p.caption)?.caption || null,
    }))

    const filteredPosts = (posts || []).filter((p: any) => {
      if (!p.content) return true
      const c = p.content.toLowerCase()
      return !(c.startsWith('added') && (c.includes('photo') || c.includes('photos')))
    }).map((p: any) => ({ ...p, _type: 'post' }))

    const merged = [...filteredPosts, ...photoGroups]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 40)

    setItems(merged)
    setLoading(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {[1,2,3].map(i => (
        <div key={i} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, height: 140, opacity: 0.4 }} />
      ))}
    </div>
  )

  if (items.length === 0) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text2)' }}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>Nothing here yet</div>
      <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>Open a Knot to post a moment or plan something.</div>
      {knots[0] && (
        <button onClick={() => onSelectKnot(knots[0])}
          style={{ padding: '10px 20px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          Open {knots[0].name}
        </button>
      )}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {items.map(item => {
        const knot   = item.knots
        const author = item.profiles?.name || 'Someone'
        const authorAvatarUrl = item.profiles?.avatar_url || null
        // Hangout-creation posts (Composer.tsx's postHangout) always read
        // "{actorName} planned a hangout…" / "…is checking availability
        // for…" / "…is at … the night is on!" / "…set up a weekly
        // hangout…" / "…planned a movie night…" — the actor's name varies,
        // so match on the stable part of each phrase rather than a fixed
        // prefix. These are full sentences that already include the actor's
        // name, unlike the other activity types below.
        const isHangoutActivity = item._type === 'post' && (
          item.content?.includes('planned a hangout') ||
          item.content?.includes('is checking availability for') ||
          item.content?.includes('the night is on') ||
          item.content?.includes('set up a weekly hangout') ||
          item.content?.includes('planned a movie night')
        )
        const isActivity = isHangoutActivity || (item._type === 'post' && (
          item.content?.startsWith('added a bill') ||
          item.content?.startsWith('locked in') ||
          item.content?.startsWith('treated ')
        ))

        return (
          <div key={item._type + item.id}
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', cursor: 'pointer', transition: 'all 0.15s', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
            onClick={() => { if (knot?.id) onSelectKnot(knot) }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--yellow)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(248,189,3,0.1)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)' }}>

            {/* PHOTO GROUP */}
            {item._type === 'photo_group' && (
              <>
                {item.photos.length === 1 ? (
                  <div style={{ width: '100%', aspectRatio: item.photos[0].media_type === 'video' ? '16/9' : '4/5', overflow: 'hidden', background: '#000' }}>
                    {item.photos[0].media_type === 'video' ? (
                      <video src={item.photos[0].url} controls playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    ) : (
                      <img src={item.photos[0].url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    )}
                  </div>
                ) : item.photos.length === 2 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, aspectRatio: '16/9' }}>
                    {item.photos.slice(0, 2).map((p: any) => (
                      p.media_type === 'video'
                        ? <video key={p.id} src={p.url} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        : <img key={p.id} src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    ))}
                  </div>
                ) : item.photos.length === 3 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 2, aspectRatio: '16/9' }}>
                    <img src={item.photos[0].url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', gridRow: 'span 2' }} />
                    <img src={item.photos[1].url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    <img src={item.photos[2].url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 2, aspectRatio: '16/9' }}>
                    {item.photos.slice(0, 3).map((p: any) => (
                      <img key={p.id} src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    ))}
                    <div style={{ position: 'relative', overflow: 'hidden' }}>
                      <img src={item.photos[3].url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      {item.photos.length > 4 && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.52)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20, fontWeight: 800 }}>
                          +{item.photos.length - 4}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <KnotBadge knot={knot} />
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>{timeAgo(item.created_at)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <MemberAvatar name={author} avatarUrl={authorAvatarUrl} size={34} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13 }}>
                        <strong>{author}</strong>
                        <span style={{ color: 'var(--text2)', marginLeft: 6 }}>added {item.photos.length} photo{item.photos.length > 1 ? 's' : ''}</span>
                      </div>
                      {item.caption && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3, fontStyle: 'italic' }}>"{item.caption}"</div>}
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--yellow)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                      Open <ChevronRight size={14} strokeWidth={2.5} />
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* TREAT */}
            {item._type === 'post' && item.post_type === 'treat' && (
              <div style={{ padding: '18px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <KnotBadge knot={knot} />
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>{timeAgo(item.created_at)}</span>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <MemberAvatar name={author} avatarUrl={authorAvatarUrl} size={34} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{author}</div>
                    <div style={{ padding: '12px 14px', background: 'var(--yellow-soft)', border: '1px solid var(--yellow-dim)', borderRadius: 10, fontSize: 13, color: 'var(--yellow)', fontWeight: 600 }}>
                      {item.content}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ACTIVITY */}
            {item._type === 'post' && item.post_type !== 'treat' && isActivity && (
              <div style={{ padding: '18px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <KnotBadge knot={knot} />
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>{timeAgo(item.created_at)}</span>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <MemberAvatar name={author} avatarUrl={authorAvatarUrl} size={40} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14 }}>
                      {isHangoutActivity ? (
                        // These already read as a full sentence starting
                        // with the actor's name — prefixing another
                        // <strong>{author}</strong> would show it twice.
                        <span style={{ color: 'var(--text)' }}>{item.content}</span>
                      ) : (
                        <>
                          <strong>{author}</strong>
                          <span style={{ color: 'var(--text2)', marginLeft: 6 }}>{item.content}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--yellow)', fontWeight: 700, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                    Open <ChevronRight size={14} strokeWidth={2.5} />
                  </span>
                </div>
              </div>
            )}

            {/* REGULAR POST */}
            {item._type === 'post' && item.post_type !== 'treat' && !isActivity && (
              <div style={{ padding: '18px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <KnotBadge knot={knot} />
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>{timeAgo(item.created_at)}</span>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <MemberAvatar name={author} avatarUrl={authorAvatarUrl} size={34} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{author}</div>
                    <div style={{ fontSize: 15, color: 'var(--text)', lineHeight: 1.55 }}>{item.content}</div>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--yellow)', fontWeight: 700, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                    Open <ChevronRight size={14} strokeWidth={2.5} />
                  </span>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function KnotBadge({ knot }: { knot: any }) {
  return (
    <div style={{ padding: '3px 10px', background: 'var(--yellow-soft)', border: '1px solid var(--yellow-dim)', borderRadius: 20, fontSize: 11, fontWeight: 700, color: 'var(--yellow)', display: 'flex', alignItems: 'center', gap: 4 }}>
      <span>{knot?.emoji}</span>
      <span>{knot?.name}</span>
    </div>
  )
}
