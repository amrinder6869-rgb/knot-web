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

export default function HomeFeed({ knots, onSelectKnot }: { knots: any[], onSelectKnot: (knot: any) => void }) {
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (knots.length > 0) loadHomeFeed()
  }, [knots])

  async function loadHomeFeed() {
    const knotIds = knots.map(k => k.id)
    const { data, error } = await supabase
      .from('posts')
      .select('*, profiles:author_id(name), knots:knot_id(id, name, emoji)')
      .in('knot_id', knotIds)
      .order('created_at', { ascending: false })
      .limit(30)

    if (error) { console.error(error); setLoading(false); return }
    setPosts(data || [])
    setLoading(false)
  }

  function getInitials(name: string) {
    return (name || 'U').split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()
  }

  function getPostSummary(post: any) {
    switch (post.post_type) {
      case 'moment': return post.content
      default: return post.content
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[1,2,3].map(i => (
        <div key={i} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, height: 100, opacity: 0.5 }} />
      ))}
    </div>
  )

  if (posts.length === 0) return (
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
      {posts.map(post => {
        const knot = post.knots
        const author = post.profiles?.name || 'Someone'
        return (
          <div key={post.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, cursor: 'pointer', transition: 'border-color 0.15s' }}
            onClick={() => onSelectKnot(knot)}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--yellow)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>

            {/* Knot badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <div style={{ padding: '3px 10px', background: 'var(--yellow-soft)', border: '1px solid var(--yellow-dim)', borderRadius: 20, fontSize: 11, fontWeight: 700, color: 'var(--yellow)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>{knot?.emoji}</span>
                <span>{knot?.name}</span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>{timeAgo(post.created_at)}</span>
            </div>

            {/* Post content */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--yellow)', color: '#111', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {getInitials(author)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, marginBottom: 4 }}>
                  <strong style={{ color: 'var(--text)' }}>{author}</strong>
                  <span style={{ color: 'var(--text2)', marginLeft: 6 }}>{getPostSummary(post)}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                  {post.post_type === 'moment' ? 'Moment' : post.post_type}
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--yellow)', fontWeight: 600, flexShrink: 0 }}>
                View →
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
