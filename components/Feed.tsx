'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import HangoutCard from '@/components/HangoutCard'
import Composer from '@/components/Composer'
import { loadHangoutBundle } from '@/lib/hangoutBundle'
import PostComments from '@/components/PostComments'

type Reaction = { e: string; n: number; mine: boolean }
type Post = {
  id: string
  author: string
  initials: string
  color: string
  text: string
  action: string
  time: string
  type: string
  reactions: Reaction[]
  author_id: string
  hangout_id: string | null
  profiles: any
  created_at: string
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
  return (name || 'U').split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()
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
  const [bundle, setBundle]   = useState<any>(null)
  const [momentComments, setMomentComments] = useState<Map<string, any[]>>(new Map())
  const [momentPhotos, setMomentPhotos] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!knotId) return
    loadPosts()

    // Debounce so a burst of realtime events (e.g. several RSVPs at once) triggers one reload, not several
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    function scheduleReload() {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => loadPosts(), 400)
    }

    const channel = supabase
      .channel(`posts:${knotId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'posts', filter: `knot_id=eq.${knotId}`
      }, () => loadPosts())
      // Hangout interactions from other members — RSVPs, votes, comments, and bills don't
      // carry knot_id directly on every table, so we refresh on any change and let RLS
      // scope what's actually returned. See H.3 hardening notes.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hangout_rsvps' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hangout_votes' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bills', filter: `knot_id=eq.${knotId}` }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bill_splits' }, scheduleReload)
      .subscribe()

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      supabase.removeChannel(channel)
    }
  }, [knotId])

  async function loadPosts() {
    if (!knotId) return
    const { data, error } = await supabase
      .from('posts')
      .select('*, profiles:author_id(name)')
      .eq('knot_id', knotId)
      .order('created_at', { ascending: false })
      .limit(30)

    if (error) { setLoading(false); return }

    const mapped: Post[] = (data || []).map((p: any) => {
      const name = p.profiles?.name || 'Unknown'
      const col  = getColor(p.author_id)
      return {
        id:         p.id,
        author:     name,
        author_id:  p.author_id,
        initials:   getInitials(name),
        color:      col.bg,
        text:       col.text,
        action:     p.content || '',
        time:       timeAgo(p.created_at),
        created_at: p.created_at,
        type:       p.post_type || 'moment',
        hangout_id: p.hangout_id || null,
        profiles:   p.profiles,
        reactions:  [],
      }
    })
    setPosts(mapped)

    // Batch-load all hangout data in one round trip instead of per-card
    const hangoutIds = mapped.filter(p => p.type === 'hangout' && p.hangout_id).map(p => p.hangout_id!) as string[]
    const hangoutPostIds = mapped.filter(p => p.type === 'hangout').map(p => p.id)
    const b = await loadHangoutBundle(hangoutIds, hangoutPostIds)
    setBundle(b)

    // Batch-load comments for moment and bill posts (hangout posts already covered above)
    const otherPostIds = mapped.filter(p => p.type !== 'hangout').map(p => p.id)

    // Batch-load photos attached directly to moment posts
    if (otherPostIds.length > 0) {
      const { data: postPhotos } = await supabase
        .from('photos')
        .select('post_id, storage_path')
        .in('post_id', otherPostIds)

      const photoMap = new Map<string, string>()
      for (const p of postPhotos || []) {
        if (!p.post_id) continue
        const { data: { publicUrl } } = supabase.storage.from('knot-photos').getPublicUrl(p.storage_path)
        photoMap.set(p.post_id, publicUrl)
      }
      setMomentPhotos(photoMap)
    }

    if (otherPostIds.length > 0) {
      const { data: commentData } = await supabase
        .from('comments')
        .select('*, profiles:author_id(name)')
        .in('post_id', otherPostIds)
        .order('created_at', { ascending: true })

      const withUrls = await Promise.all((commentData || []).map(async (c: any) => {
        if (c.photo_path) {
          const { data: { publicUrl } } = supabase.storage.from('knot-photos').getPublicUrl(c.photo_path)
          return { ...c, photo_url: publicUrl }
        }
        return c
      }))

      const grouped = new Map<string, any[]>()
      for (const c of withUrls) {
        const list = grouped.get(c.post_id) || []
        list.push(c)
        grouped.set(c.post_id, list)
      }
      setMomentComments(grouped)
    }

    setLoading(false)
  }

  function buildCardData(post: Post) {
    if (!bundle || !post.hangout_id) return null
    const hangout = bundle.hangoutsById.get(post.hangout_id)
    const options = (bundle.optionsByHangout.get(post.hangout_id) || []).map((o: any) => ({
      ...o,
      _myVote: (bundle.votesByHangout.get(post.hangout_id) || []).some((v: any) => v.option_id === o.id && v.user_id === currentUser?.id),
    }))
    const rsvps = bundle.rsvpsByHangout.get(post.hangout_id) || []
    const comments = bundle.commentsByPost.get(post.id) || []
    const bills = bundle.billsByHangout.get(post.hangout_id) || []
    return { hangout, options, rsvps, comments, bills }
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
        return {
          ...p,
          reactions: p.reactions
            .map(r => r.e === emoji ? { ...r, n: r.mine ? r.n - 1 : r.n + 1, mine: !r.mine } : r)
            .filter(r => r.n > 0)
        }
      }
      return { ...p, reactions: [...p.reactions, { e: emoji, n: 1, mine: true }] }
    }))
  }

  if (!knotId) return null

  return (
    <div style={{ maxWidth: 640 }}>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--yellow)', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, color: 'var(--yellow)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Tonight</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Plan a hangout</div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>Use the composer below</div>
        </div>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Members</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{members.length}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>in this Knot</div>
        </div>
      </div>

      <Composer knotId={knotId} currentUser={currentUser} members={members} onPosted={loadPosts} />

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text3)', fontSize: 13 }}>Loading...</div>
      )}

      {!loading && posts.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Nothing here yet</div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>Post a moment, plan a hangout, or add a bill above.</div>
        </div>
      )}

      {!loading && posts.map(p => {

        if (p.type === 'hangout' && p.hangout_id) {
          const cardData = buildCardData(p)
          if (!cardData || !cardData.hangout) return null
          return (
            <HangoutCard
              key={p.id}
              post={p}
              data={cardData}
              currentUser={currentUser}
              knotId={knotId}
              members={members}
              onRefresh={loadPosts}
            />
          )
        }

        if (p.type === 'bill') {
          return (
            <div key={p.id} style={{ display: 'flex', gap: 12, padding: '16px 0', borderBottom: '1px solid var(--border)', alignItems: 'flex-start' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg3)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: 'var(--text2)', flexShrink: 0 }}>
                $
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13 }}>
                  <strong style={{ color: 'var(--text)' }}>{p.author}</strong>
                  <span style={{ color: 'var(--text2)', marginLeft: 6 }}>{p.action}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{p.time}</div>
                <PostComments postId={p.id} currentUser={currentUser} initialComments={momentComments.get(p.id) || []} />
              </div>
            </div>
          )
        }

        return (
          <div key={p.id} style={{ display: 'flex', gap: 12, padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: p.color, color: p.text, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {p.initials}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13 }}>
                <strong style={{ color: 'var(--text)' }}>{p.author}</strong>
                <span style={{ color: 'var(--text2)', marginLeft: 6 }}>{p.action}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{p.time}</div>
              {momentPhotos.get(p.id) && (
                <div style={{ marginTop: 10 }}>
                  <img src={momentPhotos.get(p.id)} alt="" style={{ maxWidth: '100%', maxHeight: 360, borderRadius: 10, objectFit: 'cover', display: 'block' }} />
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                {p.reactions.map(r => (
                  <button key={r.e} onClick={() => toggleReaction(p.id, r.e)}
                    style={{ padding: '4px 10px', borderRadius: 6, background: r.mine ? 'var(--yellow-dim)' : 'var(--bg3)', border: `1px solid ${r.mine ? 'var(--yellow)' : 'var(--border2)'}`, color: 'var(--text)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {r.e} {r.n}
                  </button>
                ))}
                <button
                  onClick={() => toggleReaction(p.id, 'heart')}
                  style={{ padding: '4px 10px', borderRadius: 6, background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  + React
                </button>
              </div>
              <PostComments postId={p.id} currentUser={currentUser} initialComments={momentComments.get(p.id) || []} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
