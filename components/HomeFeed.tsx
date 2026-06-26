'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

function timeAgo(date: string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function getInitials(name: string) {
  return (name || 'U').split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()
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
        .select('*, profiles:author_id(name), knots:knot_id(id, name, emoji)')
        .in('knot_id', knotIds)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('photos')
        .select('*, profiles:uploaded_by(name), knots:knot_id(id, name, emoji)')
        .in('knot_id', knotIds)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    const photosWithUrls = await Promise.all((photos || []).map(async (p: any) => {
      const { data: { publicUrl } } = supabase.storage.from('knot-photos').getPublicUrl(p.storage_path)
      return { ...p, url: publicUrl, _type: 'photo' }
    }))

    const taggedPosts = (posts || []).map((p: any) => ({ ...p, _type: 'post' }))

    const merged = [...taggedPosts, ...photosWithUrls]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 40)

    setItems(merged)
    setLoading(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[1,2,3].map(i => (
        <div key={i} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, height: 120, opacity: 0.4 }} />
      ))}
    </div>
  )

  if (items.length === 0) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text2)' }}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>Nothing here yet</div>
      <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 24 }}>Posts from all your Knots will show up here.</div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        {knots.map(k => (
          <button key={k.id} onClick={() => onSelectKnot(k)}
            style={{ padding: '8px 16px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, fontSize: 13, color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit' }}>
            {k.emoji} {k.name}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map(item => {
        const knot   = item.knots
        const author = item.profiles?.name || 'Someone'
        const isActivity = item._type === 'post' && (
          item.content?.startsWith('added a bill') ||
          item.content?.startsWith('started a hangout') ||
          item.content?.startsWith('locked in') ||
          item.content?.startsWith('added ') ||
          item.content?.startsWith('treated ')
        )

        return (
          <div key={item._type + item.id}
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.15s' }}
            onClick={() => onSelectKnot(knot)}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--yellow)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>

            {/* PHOTO CARD */}
            {item._type === 'photo' && (
              <>
                <div style={{ width: '100%', aspectRatio: '16/9', overflow: 'hidden', background: 'var(--bg3)' }}>
                  <img src={item.url} alt={item.caption || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </div>
                <div style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <KnotBadge knot={knot} />
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>{timeAgo(item.created_at)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <Avatar name={author} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13 }}>
                        <strong>{author}</strong>
                        <span style={{ color: 'var(--text2)', marginLeft: 6 }}>added a photo</span>
                      </div>
                      {item.caption && (
                        <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 3, fontStyle: 'italic' }}>"{item.caption}"</div>
                      )}
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--yellow)', fontWeight: 600 }}>View</span>
                  </div>
                </div>
              </>
            )}

            {/* TREAT CARD */}
            {item._type === 'post' && item.post_type === 'treat' && (
              <div style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <KnotBadge knot={knot} />
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>{timeAgo(item.created_at)}</span>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <Avatar name={author} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{author}</div>
                    <div style={{ padding: '10px 14px', background: 'var(--yellow-soft)', border: '1px solid var(--yellow-dim)', borderRadius: 10, fontSize: 13, color: 'var(--yellow)', fontWeight: 600 }}>
                      {item.content}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--yellow)', fontWeight: 600 }}>View</span>
                </div>
              </div>
            )}

            {/* ACTIVITY CARD (bills, polls, system) */}
            {item._type === 'post' && item.post_type !== 'treat' && isActivity && (
              <div style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <KnotBadge knot={knot} />
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>{timeAgo(item.created_at)}</span>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg3)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: 'var(--text2)', flexShrink: 0 }}>
                    {item.content?.startsWith('added a bill') ? '$' : item.content?.startsWith('started a hangout') ? '?' : item.content?.startsWith('locked in') ? '!' : item.content?.startsWith('treated') ? 'T' : '+'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13 }}>
                      <strong>{author}</strong>
                      <span style={{ color: 'var(--text2)', marginLeft: 6 }}>{item.content}</span>
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--yellow)', fontWeight: 600 }}>View</span>
                </div>
              </div>
            )}

            {/* REGULAR POST */}
            {item._type === 'post' && item.post_type !== 'treat' && !isActivity && (
              <div style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <KnotBadge knot={knot} />
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>{timeAgo(item.created_at)}</span>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <Avatar name={author} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{author}</div>
                    <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>{item.content}</div>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--yellow)', fontWeight: 600 }}>View</span>
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

function Avatar({ name }: { name: string }) {
  return (
    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--yellow)', color: '#111', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {getInitials(name)}
    </div>
  )
}
