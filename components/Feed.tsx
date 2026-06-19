'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Skeleton, SkeletonRow } from '@/components/Skeleton'

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

const REACTION_EMOJIS = ['🔥', '😂', '❤️', '🏆']

export default function Feed({ members, knotName, knotId, currentUser }: {
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

    if (error) { setLoading(false); return }

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
    if (!error) { setNewPost(''); loadPosts() }
    setPosting(false)
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

  function focusInput(e: React.FocusEvent<HTMLInputElement>) {
    e.currentTarget.style.borderColor = 'var(--rust)'
    e.currentTarget.style.boxShadow   = '0 0 0 3px var(--rust-dim)'
  }
  function blurInput(e: React.FocusEvent<HTMLInputElement>) {
    e.currentTarget.style.borderColor = 'var(--border2)'
    e.currentTarget.style.boxShadow   = 'none'
  }

  return (
    <div style={{ maxWidth: 640 }}>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        <div className="card-hover" style={{ background: 'var(--bg2)', border: '1px solid var(--rust)', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, color: 'var(--rust)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Tonight&apos;s Plan</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Start a hangout poll</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>Go to Tonight to plan</div>
        </div>
        <div className="card-hover" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Members</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, letterSpacing: '-0.3px' }}>{members.length}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>in this Knot</div>
        </div>
      </div>

      {/* Compose */}
      <div className="card-hover" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: userColor.bg, color: userColor.text, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {getInitials(userName)}
          </div>
          <input
            value={newPost}
            onChange={e => setNewPost(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addPost()}
            onFocus={focusInput}
            onBlur={blurInput}
            placeholder="Share a moment with the group..."
            style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s, box-shadow 0.15s' }}
          />
          <button
            className="btn btn-primary"
            onClick={addPost}
            disabled={posting || !newPost.trim()}
            style={{ padding: '9px 16px', fontSize: 13 }}
          >
            {posting ? '...' : 'Post'}
          </button>
        </div>
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
              <Skeleton width={36} height={36} borderRadius={18} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
                <Skeleton height={13} width="45%" />
                <Skeleton height={12} width="75%" />
                <Skeleton height={11} width="25%" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && posts.length === 0 && (
        <div style={{ textAlign: 'center', padding: '56px 20px' }}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ marginBottom: 16, opacity: 0.25 }}>
            <path d="M8 12C8 9.79086 9.79086 8 12 8H36C38.2091 8 40 9.79086 40 12V28C40 30.2091 38.2091 32 36 32H26L18 40V32H12C9.79086 32 8 30.2091 8 28V12Z" stroke="var(--text)" strokeWidth="2" fill="none"/>
          </svg>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, letterSpacing: '-0.3px' }}>Nothing here yet.</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20, lineHeight: 1.6 }}>Be the first to share a moment with the group.</div>
          <button
            className="btn btn-primary"
            onClick={() => document.querySelector<HTMLInputElement>('input[placeholder*="moment"]')?.focus()}
            style={{ fontSize: 13 }}
          >
            Share something
          </button>
        </div>
      )}

      {/* Posts */}
      {posts.map(p => (
        <div key={p.id} style={{ display: 'flex', gap: 12, padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: p.color, color: p.text, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {p.initials}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{p.author}</strong>
              <span style={{ color: 'var(--text2)', marginLeft: 6 }}>{p.action}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{p.time}</div>

            {p.type === 'treat' && (
              <div style={{ marginTop: 8, padding: '10px 12px', background: 'var(--rust-soft)', border: '1px solid var(--rust-dim)', borderRadius: 8, fontSize: 13, fontWeight: 500, color: 'var(--rust)' }}>
                {p.action}
              </div>
            )}
            {p.type === 'settled' && (
              <div style={{ marginTop: 6, fontSize: 13, color: 'var(--sage)' }}>{p.sub}</div>
            )}

            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              {REACTION_EMOJIS.map(e => {
                const r = p.reactions.find(r => r.e === e)
                return r ? (
                  <button key={e} onClick={() => toggleReaction(p.id, e)}
                    style={{ padding: '4px 10px', borderRadius: 20, background: r.mine ? 'var(--rust-dim)' : 'var(--bg3)', border: `1px solid ${r.mine ? 'var(--rust-dim)' : 'var(--border2)'}`, color: 'var(--text)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                    {e} {r.n}
                  </button>
                ) : null
              })}
              <button
                onClick={() => {
                  const next = REACTION_EMOJIS.find(e => !p.reactions.find(r => r.e === e)) || REACTION_EMOJIS[0]
                  toggleReaction(p.id, next)
                }}
                style={{ padding: '4px 10px', borderRadius: 20, background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                + React
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
