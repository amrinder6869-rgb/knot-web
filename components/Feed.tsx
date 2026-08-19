'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase, getSignedUrl } from '@/lib/supabase'
import HangoutCard, { HangoutCardSkeleton } from '@/components/HangoutCard'
import Composer from '@/components/Composer'
import { Skeleton } from '@/components/Skeleton'
import { loadHangoutBundle } from '@/lib/hangoutBundle'
import PostComments from '@/components/PostComments'
import ReactionBar from '@/components/ReactionBar'
import { computeNetBalances } from '@/lib/ledger'
import { compressImage } from '@/lib/compressImage'
import {
  aggregateReactions,
  legacyHeartEmojis,
  normalizeReactionEmoji,
  toggleReactionLocal,
  type ReactionCount,
} from '@/lib/reactions'

type MomentPhoto = { id: string; storage_path: string; url: string; media_type: string }

type Post = {
  id: string
  author: string
  initials: string
  color: string
  text: string
  action: string
  time: string
  type: string
  reactions: ReactionCount[]
  author_id: string | null
  hangout_id: string | null
  profiles: any
  created_at: string
}

const CARD_STYLE: React.CSSProperties = {
  background: '#ffffff',
  border: '0.5px solid rgba(0,0,0,0.08)',
  borderRadius: 12,
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  padding: '14px 16px',
  marginBottom: 10,
}

const COLORS = [
  { bg: '#EDE6DC', text: '#6B705C' },
  { bg: '#F7EAE4', text: '#B85C38' },
  { bg: '#E6F0EA', text: '#4A7C5F' },
  { bg: '#FEF3E2', text: '#C07A10' },
  { bg: '#EDE6DC', text: '#8B7355' },
  { bg: '#F0EDE8', text: '#7A6B5A' },
]

function getColor(str: string | null | undefined) {
  const s = str || ''
  let hash = 0
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash)
  return COLORS[Math.abs(hash) % COLORS.length]
}

function getInitials(name: string) {
  return (name || 'U').split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()
}

function MomentSkeleton() {
  return (
    <div style={{ display: 'flex', gap: 12, ...CARD_STYLE }}>
      <Skeleton width={36} height={36} borderRadius={999} />
      <div style={{ flex: 1 }}>
        <Skeleton width="35%" height={12} style={{ marginBottom: 10 }} />
        <Skeleton width="90%" height={12} style={{ marginBottom: 6 }} />
        <Skeleton width="55%" height={12} />
      </div>
    </div>
  )
}

function timeAgo(date: string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export default function Feed({ members, knotName: _knotName, knotId, currentUser, onOpenBills }: {
  members: any[], knotName: string, knotId?: string, currentUser?: any, onOpenBills?: () => void
}) {
  const [posts, setPosts]     = useState<Post[]>([])
  const [bundle, setBundle]   = useState<any>(null)
  const [billBalance, setBillBalance] = useState<number | null>(null)
  const [momentComments, setMomentComments] = useState<Map<string, any[]>>(new Map())
  const [momentPhotos, setMomentPhotos] = useState<Map<string, MomentPhoto>>(new Map())
  const [loading, setLoading] = useState(true)
  const [editingPostId, setEditingPostId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null)
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null)
  const [editRemovePhoto, setEditRemovePhoto] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null)
  const [momentActionError, setMomentActionError] = useState('')
  const editPhotoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!knotId) return
    loadPosts()
    loadBillBalance()

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

    // Fetch reactions for all posts
    const postIds = (data || []).map((p: any) => p.id)
    const { data: reactionsData } = await supabase
      .from('reactions')
      .select('post_id, emoji, user_id')
      .in('post_id', postIds)

    const reactionsMap: Record<string, ReactionCount[]> = {}
    const currentAuthUser = (await supabase.auth.getUser()).data.user
    const byPost: Record<string, { emoji: string; user_id: string }[]> = {}
    ;(reactionsData || []).forEach((r: any) => {
      if (!byPost[r.post_id]) byPost[r.post_id] = []
      byPost[r.post_id].push({ emoji: r.emoji, user_id: r.user_id })
    })
    Object.keys(byPost).forEach(pid => {
      reactionsMap[pid] = aggregateReactions(byPost[pid], currentAuthUser?.id)
    })

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
        reactions:  (reactionsMap?.[p.id] || []),
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
        .select('id, post_id, storage_path, media_type')

      const photoMap = new Map<string, MomentPhoto>()
      for (const p of postPhotos || []) {
        if (!p.post_id) continue
        const signedUrl = await getSignedUrl(p.storage_path)
        photoMap.set(p.post_id, { id: p.id, storage_path: p.storage_path, url: signedUrl ?? '', media_type: p.media_type ?? 'image' })
      }
      setMomentPhotos(photoMap)
    } else {
      setMomentPhotos(new Map())
    }

    if (otherPostIds.length > 0) {
      const { data: commentData } = await supabase
        .from('comments')
        .select('*, profiles:author_id(name)')
        .order('created_at', { ascending: true })

      const withUrls = await Promise.all((commentData || []).map(async (c: any) => {
        if (c.photo_path) {
          const signedUrl = await getSignedUrl(c.photo_path)
          return { ...c, photo_url: signedUrl ?? '' }
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

  async function loadBillBalance() {
    if (!knotId || !currentUser) return
    const [{ data: billData }, { data: settlementData }] = await Promise.all([
      supabase.from('bills').select('id, added_by, total_amount').eq('knot_id', knotId),
      supabase.from('settlements').select('from_user_id, to_user_id, amount').eq('knot_id', knotId),
    ])
    if (!billData) return
    const billIds = billData.map((b: any) => b.id)
    let splitData: any[] = []
    if (billIds.length > 0) {
      const { data } = await supabase.from('bill_splits').select('bill_id, user_id, amount').in('bill_id', billIds)
      splitData = data || []
    }
    const memberList = members.map(m => ({ id: m.id, name: m.name }))
    const balances = computeNetBalances(
      billData.map((b: any) => ({ id: b.id, added_by: b.added_by, total_amount: parseFloat(b.total_amount) })),
      splitData.map((s: any) => ({ bill_id: s.bill_id, user_id: s.user_id, amount: parseFloat(s.amount) })),
      (settlementData || []).map((s: any) => ({ from_user_id: s.from_user_id, to_user_id: s.to_user_id, amount: parseFloat(s.amount) })),
      memberList
    )
    setBillBalance(balances.get(currentUser.id) || 0)
  }

  function buildCardData(post: Post) {
    if (!bundle || !post.hangout_id) return null
    const hangout = bundle.hangoutsById.get(post.hangout_id)
    if (!hangout) return null
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
    const normalized = normalizeReactionEmoji(emoji)
    const post = posts.find(p => p.id === postId)
    const existing = post?.reactions.find(r => r.e === normalized && r.mine)
    if (existing) {
      await supabase.from('reactions').delete()
        .eq('post_id', postId).eq('user_id', user.id).in('emoji', legacyHeartEmojis(normalized))
    } else {
      await supabase.from('reactions').insert({ post_id: postId, user_id: user.id, emoji: normalized })
    }
    setPosts(ps => ps.map(p => {
      if (p.id !== postId) return p
      return { ...p, reactions: toggleReactionLocal(p.reactions, normalized) }
    }))
  }

  function startEditMoment(post: Post) {
    setEditingPostId(post.id)
    setEditText(post.action || '')
    setEditPhotoFile(null)
    setEditPhotoPreview(null)
    setEditRemovePhoto(false)
    setEditError('')
    setMomentActionError('')
  }

  function cancelEditMoment() {
    setEditingPostId(null)
    setEditText('')
    setEditPhotoFile(null)
    setEditPhotoPreview(null)
    setEditRemovePhoto(false)
    setEditError('')
    if (editPhotoInputRef.current) editPhotoInputRef.current.value = ''
  }

  function handleEditPhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setEditPhotoFile(file)
    setEditPhotoPreview(URL.createObjectURL(file))
    setEditRemovePhoto(false)
  }

  async function saveEditMoment(post: Post) {
    if (!currentUser || editSaving) return
    if (!editText.trim() && !editPhotoFile && (editRemovePhoto || !momentPhotos.get(post.id))) {
      setEditError('Add some text or a photo before saving.')
      return
    }
    setEditSaving(true)
    setEditError('')

    const { error: updateError } = await supabase
      .from('posts')
      .update({ content: editText.trim() || null })
      .eq('id', post.id)
      .eq('author_id', currentUser.id)

    if (updateError) {
      setEditError('Could not save changes. Please try again.')
      setEditSaving(false)
      return
    }

    const existingPhoto = momentPhotos.get(post.id)

    if (editRemovePhoto && existingPhoto && !editPhotoFile) {
      const { error: storageError } = await supabase.storage.from('knot-photos').remove([existingPhoto.storage_path])
      if (storageError) {
        setEditError('Post saved, but the photo could not be removed from storage.')
      } else {
        const { error: photoDeleteError } = await supabase
          .from('photos')
          .delete()
          .eq('id', existingPhoto.id)
          .eq('uploaded_by', currentUser.id)
        if (photoDeleteError) setEditError('Post saved, but the photo record failed to delete.')
      }
    } else if (editPhotoFile) {
      const compressed = await compressImage(editPhotoFile)
      const ext = compressed.name.split('.').pop()
      const path = `${knotId}/${currentUser.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`
      const { error: uploadError } = await supabase.storage.from('knot-photos').upload(path, compressed)
      if (uploadError) {
        setEditError('Post saved, but the new photo failed to upload.')
        setEditSaving(false)
        cancelEditMoment()
        await loadPosts()
        return
      }

      if (existingPhoto) {
        await supabase.storage.from('knot-photos').remove([existingPhoto.storage_path])
        const { error: photoUpdateError } = await supabase
          .from('photos')
          .update({ storage_path: path, file_name: compressed.name, file_size: compressed.size })
          .eq('id', existingPhoto.id)
          .eq('uploaded_by', currentUser.id)
        if (photoUpdateError) setEditError('Post saved, but the photo record failed to update.')
      } else {
        const { error: photoInsertError } = await supabase.from('photos').insert({
          knot_id: knotId,
          post_id: post.id,
          uploaded_by: currentUser.id,
          storage_path: path,
          file_name: compressed.name,
          file_size: compressed.size,
        })
        if (photoInsertError) setEditError('Post saved, but the photo failed to save.')
      }
    }

    setEditSaving(false)
    cancelEditMoment()
    await loadPosts()
  }

  async function deleteMoment(post: Post) {
    if (!currentUser) return
    if (!confirm('Delete this post? This cannot be undone.')) return
    setDeletingPostId(post.id)
    setMomentActionError('')

    const existingPhoto = momentPhotos.get(post.id)
    if (existingPhoto) {
      const { error: storageError } = await supabase.storage.from('knot-photos').remove([existingPhoto.storage_path])
      if (storageError) {
        setMomentActionError('Could not delete the photo file. Post was not removed.')
        setDeletingPostId(null)
        return
      }
      const { error: photoDeleteError } = await supabase
        .from('photos')
        .delete()
        .eq('id', existingPhoto.id)
        .eq('uploaded_by', currentUser.id)
      if (photoDeleteError) {
        setMomentActionError('Photo file removed, but the photo record failed to delete. Post was not removed.')
        setDeletingPostId(null)
        return
      }
    }

    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', post.id)
      .eq('author_id', currentUser.id)

    if (error) {
      setMomentActionError('Could not delete the post. Please try again.')
      setDeletingPostId(null)
      return
    }

    setDeletingPostId(null)
    setMomentActionError('')
    if (editingPostId === post.id) cancelEditMoment()
    await loadPosts()
  }

  if (!knotId) return null

  return (
    <div style={{ maxWidth: 640 }}>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
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
        <div onClick={onOpenBills}
          style={{ background: 'var(--bg2)', border: `1px solid ${billBalance && Math.abs(billBalance) > 0.01 ? 'var(--yellow)' : 'var(--border)'}`, borderRadius: 12, padding: '14px 16px', cursor: onOpenBills ? 'pointer' : 'default' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Bills</div>
          {billBalance === null ? (
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Loading...</div>
          ) : Math.abs(billBalance) < 0.01 ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: 'var(--sage)' }}>Settled up</div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>View balances</div>
            </>
          ) : billBalance > 0 ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: 'var(--sage)' }}>+${billBalance.toFixed(2)}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>You are owed</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: 'var(--yellow)' }}>-${Math.abs(billBalance).toFixed(2)}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>You owe</div>
            </>
          )}
        </div>
      </div>

      <Composer knotId={knotId} currentUser={currentUser} members={members} onPosted={loadPosts} />

      {momentActionError && (
        <div className="error-banner" style={{ marginBottom: 12 }}>
          {momentActionError}
        </div>
      )}

      {loading && (
        <div>
          <MomentSkeleton />
          <MomentSkeleton />
          <HangoutCardSkeleton />
        </div>
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
              onToggleReaction={(emoji) => toggleReaction(p.id, emoji)}
            />
          )
        }

        if (p.type === 'bill') {
          return (
            <div key={p.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', ...CARD_STYLE }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg3)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: 'var(--text2)', flexShrink: 0 }}>
                $
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13 }}>
                  <strong style={{ color: 'var(--text)' }}>{p.author}</strong>
                  <span style={{ color: 'var(--text2)', marginLeft: 6 }}>{p.action}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{p.time}</div>
                <div style={{ marginTop: 8 }}>
                  <ReactionBar reactions={p.reactions || []} onToggle={(emoji) => toggleReaction(p.id, emoji)} />
                </div>
                <PostComments postId={p.id} currentUser={currentUser} initialComments={momentComments.get(p.id) || []} />
              </div>
            </div>
          )
        }

        return (
          <div key={p.id} style={{ display: 'flex', gap: 12, ...CARD_STYLE }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: p.color, color: p.text, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {p.initials}
            </div>
            <div style={{ flex: 1 }}>
              {editingPostId === p.id ? (
                <div>
                  <div style={{ fontSize: 13, marginBottom: 8 }}>
                    <strong style={{ color: 'var(--text)' }}>{p.author}</strong>
                  </div>
                  {editError && (
                    <div className="error-banner" style={{ marginBottom: 8 }}>
                      {editError}
                    </div>
                  )}
                  <textarea
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    rows={3}
                    style={{ width: '100%', padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical', marginBottom: 8 }}
                  />
                  {editPhotoPreview ? (
                    <div style={{ position: 'relative', marginBottom: 8, display: 'inline-block' }}>
                      <img src={editPhotoPreview} alt="" style={{ width: '100%', aspectRatio: '4/5', borderRadius: 10, objectFit: 'cover', display: 'block' }} />
                      <button onClick={() => { setEditPhotoFile(null); setEditPhotoPreview(null); if (editPhotoInputRef.current) editPhotoInputRef.current.value = '' }}
                        style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>
                        x
                      </button>
                    </div>
                  ) : momentPhotos.get(p.id) && !editRemovePhoto ? (
                    <div style={{ position: 'relative', marginBottom: 8, display: 'inline-block' }}>
                      <img src={momentPhotos.get(p.id)!.url} alt="" style={{ width: '100%', aspectRatio: '4/5', borderRadius: 10, objectFit: 'cover', display: 'block' }} />
                      <button onClick={() => setEditRemovePhoto(true)}
                        style={{ position: 'absolute', top: 6, right: 6, padding: '4px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Remove photo
                      </button>
                    </div>
                  ) : null}
                  <input type="file" accept="image/*" ref={editPhotoInputRef} onChange={handleEditPhotoSelect} style={{ display: 'none' }} />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => editPhotoInputRef.current?.click()}
                      style={{ padding: '6px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {editPhotoFile || (momentPhotos.get(p.id) && !editRemovePhoto) ? 'Replace photo' : 'Add photo'}
                    </button>
                    <button onClick={cancelEditMoment}
                      style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Cancel
                    </button>
                    <button onClick={() => saveEditMoment(p)} disabled={editSaving}
                      style={{ padding: '6px 14px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: editSaving ? 0.5 : 1 }}>
                      {editSaving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 13 }}>
                    <strong style={{ color: 'var(--text)' }}>{p.author}</strong>
                    <span style={{ color: 'var(--text2)', marginLeft: 6 }}>{p.action}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{p.time}</div>
                  {momentPhotos.get(p.id) ? (
                    <div style={{ marginTop: 10, borderRadius: 10, overflow: 'hidden', aspectRatio: '4/5', background: '#000', maxWidth: 400 }}>
                      {momentPhotos.get(p.id)!.media_type === 'video' ? (
                        <video src={momentPhotos.get(p.id)!.url} controls playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      ) : (
                        <img src={momentPhotos.get(p.id)!.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      )}
                    </div>
                  ) : null}
                  <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <ReactionBar reactions={p.reactions || []} onToggle={(emoji) => toggleReaction(p.id, emoji)} />
                    {p.author_id === currentUser?.id && (
                      <>
                        <button onClick={() => startEditMoment(p)}
                          style={{ padding: '4px 10px', borderRadius: 6, background: 'transparent', border: '1px solid var(--border2)', color: 'var(--text2)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Edit
                        </button>
                        <button onClick={() => deleteMoment(p)} disabled={deletingPostId === p.id}
                          style={{ padding: '4px 10px', borderRadius: 6, background: 'transparent', border: '1px solid var(--danger-dim)', color: 'var(--danger)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', opacity: deletingPostId === p.id ? 0.5 : 1 }}>
                          {deletingPostId === p.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </>
                    )}
                  </div>
                  <PostComments postId={p.id} currentUser={currentUser} initialComments={momentComments.get(p.id) || []} />
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
