'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type Reaction = { e: string; n: number; mine: boolean }
type Post = {
  id: string
  author: string
  initials: string
  color: string
  text: string
  action: string
  time: string
  sub: string
  type: string
  reactions: Reaction[]
  author_id: string
}

const COLORS = [
  { bg: '#EDE6DC', text: '#6B705C' },
  { bg: '#F7EAE4', text: '#B85C38' },
  { bg: '#E6F0EA', text: '#4A7C5F' },
  { bg: '#FEF3E2', text: '#C07A10' },
  { bg: '#EDE6DC', text: '#8B7355' },
  { bg: '#F0EDE8', text: '#7A6B5A' },
]

function getColor(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return COLORS[Math.abs(hash) % COLORS.length]
}

function getInitials(name: string) {
  return name.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()
}

function timeAgo(date: string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export default function Feed({ members, knotName: _knotName, knotId, currentUser }: {
  members: any[], knotName: string, knotId?: string, currentUser?: any
}) {
  const [posts, setPosts]     = useState<Post[]>([])
  const [newPost, setNewPost] = useState('')
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    if (!knotId) return
    loadPosts()
    const channel = supabase
      .channel(`posts:${knotId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts', filter: `knot_id=eq.${knotId}` },
        () => loadPosts()
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [knotId])

  async function loadPosts() {
    if (!knotId) return
    const { data, error } = await supabase
      .from('posts')
      .select('*, profiles:author_id(name)')
      .eq('knot_id', knotId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) { console.error('Posts error:', error); setLoading(false); return }

    const mapped: Post[] = (data || []).map((p: any) => {
      const name = p.profiles?.name || 'Unknown'
      const col  = getColor(p.author_id)
      return {
        id:        p.id,
        author:    name,
        author_id: p.author_id,
        initials:  getInitials(name),
        color:     col.bg,
        text:      col.text,
        action:    p.content || '',
        time:      timeAgo(p.created_at),
        sub:       '',
        type:      p.post_type || 'moment',
        reactions: [],
      }
    })
    setPosts(mapped)
    setLoading(false)
  }

  async function addPost() {
    if (!newPost.trim() || !knotId || posting) return
    setPosting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setPosting(false); return }
    const { error } = await supabase.from('posts').insert({
      knot_id:   knotId,
      author_id: user.id,
      content:   newPost.trim(),
      post_type: 'moment',
    })
    if (error) { console.error('Post error:', error); setPosting(false); return }
    setNewPost('')
    setPosting(false)
    loadPosts()
  }

  async function toggleReaction(postId: string, emoji: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const post = posts.find(p => p.id === postId)
    const existing = post?.reactions.find(r => r.e === emoji && r.mine)
    if (existing) {
      await supabase.from('reactions').delete()
        .eq('post_id', postId).eq('user_id', user.id).eq('emoji', emoji)
    } else {
      await supabase.from('reactions').insert({ post_id: postId, user_id: user.id, emoji })
    }
    setPosts(ps => ps.map(p => {
      if (p.id !== postId) return p
      const exists = p.reactions.find(r => r.e === emoji)
      if (exists) {
        return { ...p, reactions: p.reactions.map(r => r.e === emoji ? { ...r, n: r.mine ? r.n - 1 : r.n + 1, mine: !r.mine } : r).filter(r => r.n > 0) }
      }
      return { ...p, reactions: [...p.reactions, { e: emoji, n: 1, mine: true }] }
    }))
  }

  const userName  = currentUser?.name || 'You'
  const userColor = getColor(currentUser?.id || 'default')

  return (
    <div style={{ maxWidth: 640 }}>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--yellow)', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, color: 'var(--yellow)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Tonight's Plan</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Start a hangout poll</div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>Go to Tonight to plan</div>
        </div>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Members</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{members.length}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>in this Knot</div>
        </div>
      </div>

      {/* Post box */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: userColor.bg, color: userColor.text, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {getInitials(userName)}
          </div>
          <input value={newPost} onChange={e => setNewPost(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addPost()}
            placeholder="Share a moment with the group..."
            style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
          <button onClick={addPost} disabled={posting || !newPost.trim()}
            style={{ background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: posting ? 0.7 : 1 }}>
            {posting ? '...' : 'Post'}
          </button>
        </div>
      </div>

      {/* Feed */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text3)', fontSize: 13 }}>
          Loading...
        </div>
      )}

      {!loading && posts.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text2)', fontSize: 14 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>No posts yet</div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>Be the first to share a moment.</div>
        </div>
      )}

      {posts.map(p => (
        <div key={p.id} style={{ display: 'flex', gap: 12, padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: p.color, color: p.text, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{p.initials}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13 }}>
              <strong style={{ color: 'var(--text)' }}>{p.author}</strong>
              <span style={{ color: 'var(--text2)', marginLeft: 6 }}>{p.action}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{p.time}</div>

            {p.type === 'treat' && (
              <div style={{ marginTop: 8, padding: '10px 12px', background: 'var(--yellow-soft)', border: '1px solid var(--yellow-dim)', borderRadius: 8, fontSize: 13, fontWeight: 500, color: 'var(--yellow)' }}>
                {p.action}
              </div>
            )}
            {p.type === 'settled' && (
              <div style={{ marginTop: 6, fontSize: 13, color: 'var(--sage)' }}>{p.sub}</div>
            )}

            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              {['ðŸ”¥', 'ðŸ˜‚', 'â¤ï¸', 'ðŸ†'].map(e => {
                const r = p.reactions.find(r => r.e === e)
                return r ? (
                  <button key={e} onClick={() => toggleReaction(p.id, e)}
                    style={{ padding: '4px 10px', borderRadius: 20, background: r.mine ? 'var(--yellow-dim)' : 'var(--bg3)', border: `1px solid ${r.mine ? 'var(--yellow)' : 'var(--border2)'}`, color: 'var(--text)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {e} {r.n}
                  </button>
                ) : null
              })}
              <button onClick={() => {
                const emojis = ['ðŸ”¥', 'ðŸ˜‚', 'â¤ï¸', 'ðŸ†']
                const next = emojis.find(e => !p.reactions.find(r => r.e === e)) || 'ðŸ”¥'
                toggleReaction(p.id, next)
              }}
                style={{ padding: '4px 10px', borderRadius: 20, background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                + React
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

