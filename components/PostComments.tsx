'use client'
import { useState, useRef, useEffect } from 'react'
import { ImageIcon } from 'lucide-react'
import { supabase, getSignedUrl } from '@/lib/supabase'
import { compressImage } from '@/lib/compressImage'
import ReactionBar from '@/components/ReactionBar'
import {
  aggregateReactions,
  legacyHeartEmojis,
  normalizeReactionEmoji,
  toggleReactionLocal,
  type ReactionCount,
} from '@/lib/reactions'

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

type PostCommentsProps = {
  postId: string
  currentUser: any
  initialComments: any[]
  onCommentAdded?: () => void
  dark?: boolean
}

export default function PostComments({ postId, currentUser, initialComments, onCommentAdded, dark = false }: PostCommentsProps) {
  const [comments, setComments]   = useState<any[]>(initialComments)
  const [showComments, setShowComments] = useState(initialComments.length > 0)
  const [newComment, setNewComment]     = useState('')
  const [submitting, setSubmitting]     = useState(false)
  const [error, setError]               = useState('')
  const [reactionsByComment, setReactionsByComment] = useState<Record<string, ReactionCount[]>>({})

  const [commentPhoto, setCommentPhoto]               = useState<File | null>(null)
  const [commentPhotoPreview, setCommentPhotoPreview] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText]   = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    setComments(initialComments)
    if (initialComments.length > 0) setShowComments(true)
  }, [initialComments])

  useEffect(() => {
    const ids = comments.map(c => c.id).filter(Boolean)
    if (ids.length === 0) { setReactionsByComment({}); return }
    let cancelled = false
    async function load() {
      const { data } = await supabase
        .from('comment_reactions')
        .select('comment_id, emoji, user_id')
        .in('comment_id', ids)
      if (cancelled) return
      const byComment: Record<string, { emoji: string; user_id: string }[]> = {}
      ;(data || []).forEach((r: any) => {
        if (!byComment[r.comment_id]) byComment[r.comment_id] = []
        byComment[r.comment_id].push({ emoji: r.emoji, user_id: r.user_id })
      })
      const next: Record<string, ReactionCount[]> = {}
      Object.keys(byComment).forEach(id => {
        next[id] = aggregateReactions(byComment[id], currentUser?.id)
      })
      setReactionsByComment(next)
    }
    load()
    return () => { cancelled = true }
  }, [comments, currentUser?.id])

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCommentPhoto(file)
    setCommentPhotoPreview(URL.createObjectURL(file))
  }

  async function toggleCommentReaction(commentId: string, emoji: string) {
    if (!currentUser?.id) return
    const normalized = normalizeReactionEmoji(emoji)
    const current = reactionsByComment[commentId] || []
    const existing = current.find(r => r.e === normalized && r.mine)
    if (existing) {
      await supabase.from('comment_reactions').delete()
        .eq('comment_id', commentId).eq('user_id', currentUser.id).in('emoji', legacyHeartEmojis(normalized))
    } else {
      const { error: insertError } = await supabase.from('comment_reactions')
        .insert({ comment_id: commentId, user_id: currentUser.id, emoji: normalized })
      if (insertError) {
        setError('Could not save reaction. Make sure comment reactions are enabled.')
        return
      }
    }
    setReactionsByComment(prev => ({
      ...prev,
      [commentId]: toggleReactionLocal(prev[commentId] || [], normalized),
    }))
  }

  async function addComment() {
    if ((!newComment.trim() && !commentPhoto) || !currentUser || submitting) return
    setSubmitting(true)
    setError('')

    let photoPath: string | null = null
    let photoUrl: string | null = null
    if (commentPhoto) {
      const compressed = await compressImage(commentPhoto)
      const ext = compressed.name.split('.').pop()
      const path = `comments/${postId}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('knot-photos').upload(path, compressed)
      if (uploadError) {
        setError('Photo upload failed. Comment not posted.')
        setSubmitting(false)
        return
      }
      photoPath = path
      const signedUrl = await getSignedUrl(path)
      photoUrl = signedUrl ?? ''
    }

    const { data: newC, error: insertError } = await supabase
      .from('comments')
      .insert({ post_id: postId, author_id: currentUser.id, content: newComment.trim() || null, photo_path: photoPath })
      .select()
      .single()

    if (insertError) {
      setError('Could not post comment.')
      setSubmitting(false)
      return
    }

    setComments(prev => [...prev, { ...newC, photo_url: photoUrl, profiles: { name: currentUser.name } }])
    setNewComment('')
    setCommentPhoto(null)
    setCommentPhotoPreview(null)
    setSubmitting(false)
    if (onCommentAdded) onCommentAdded()
  }

  function startEdit(c: any) {
    setEditingId(c.id)
    setEditText(c.content || '')
    setError('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditText('')
  }

  async function saveEdit(commentId: string) {
    if (!editText.trim() || editSaving) return
    setEditSaving(true)
    setError('')
    const { error: updateError } = await supabase
      .from('comments')
      .update({ content: editText.trim() })
      .eq('id', commentId)
    if (updateError) {
      setError('Could not update comment.')
      setEditSaving(false)
      return
    }
    setComments(prev => prev.map(c => c.id === commentId ? { ...c, content: editText.trim() } : c))
    setEditingId(null)
    setEditText('')
    setEditSaving(false)
  }

  async function deleteComment(c: any) {
    if (!confirm('Delete this comment? This cannot be undone.')) return
    setDeletingId(c.id)
    setError('')
    const { error: deleteError } = await supabase.from('comments').delete().eq('id', c.id)
    if (deleteError) {
      setError('Could not delete comment.')
      setDeletingId(null)
      return
    }
    setComments(prev => prev.filter(x => x.id !== c.id))
    if (editingId === c.id) cancelEdit()
    setDeletingId(null)
  }

  const muted = dark ? 'rgba(255,255,255,0.55)' : 'var(--text3)'
  const textColor = dark ? 'rgba(255,255,255,0.9)' : 'var(--text)'
  const subColor = dark ? 'rgba(255,255,255,0.55)' : 'var(--text2)'
  const inputBg = dark ? 'rgba(255,255,255,0.06)' : 'var(--bg3)'
  const borderSep = dark ? 'rgba(255,255,255,0.12)' : 'var(--border2)'

  return (
    <div style={{ marginTop: 10 }}>
      <button onClick={() => setShowComments(s => !s)}
        style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: muted, cursor: 'pointer', fontFamily: 'inherit' }}>
        {comments.length > 0 ? `${comments.length} comment${comments.length > 1 ? 's' : ''}` : 'Add a comment'}
      </button>

      {showComments && (
        <div style={{ marginTop: 10 }}>
          {comments.map((c: any) => (
            <div key={c.id} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--yellow)', color: '#111', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {getInitials(c.profiles?.name || 'U')}
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: textColor }}>{c.profiles?.name || 'Someone'}</span>
                {editingId === c.id ? (
                  <div style={{ marginTop: 6 }}>
                    <input
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      style={{ width: '100%', padding: '7px 10px', background: inputBg, border: `1px solid ${borderSep}`, borderRadius: 8, color: textColor, fontSize: 12, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 6 }}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={cancelEdit}
                        style={{ padding: '5px 10px', background: 'transparent', border: `1px solid ${borderSep}`, borderRadius: 6, color: muted, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Cancel
                      </button>
                      <button onClick={() => saveEdit(c.id)} disabled={editSaving}
                        style={{ padding: '5px 12px', background: 'var(--yellow)', border: 'none', borderRadius: 6, color: '#111', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: editSaving ? 0.5 : 1 }}>
                        {editSaving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {c.content && <span style={{ fontSize: 12, color: subColor, marginLeft: 6 }}>{c.content}</span>}
                    {c.photo_url && (
                      <div style={{ marginTop: 6 }}>
                        <img src={c.photo_url} alt="" style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 8, objectFit: 'cover', display: 'block' }} />
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                      <div style={{ fontSize: 10, color: muted }}>{timeAgo(c.created_at)}</div>
                      <ReactionBar
                        compact
                        dark={dark}
                        reactions={reactionsByComment[c.id] || []}
                        onToggle={(emoji) => toggleCommentReaction(c.id, emoji)}
                      />
                      {c.author_id === currentUser?.id && (
                        <>
                          <button onClick={() => startEdit(c)}
                            style={{ background: 'none', border: 'none', padding: 0, fontSize: 10, color: muted, cursor: 'pointer', fontFamily: 'inherit' }}>
                            Edit
                          </button>
                          <button onClick={() => deleteComment(c)} disabled={deletingId === c.id}
                            style={{ background: 'none', border: 'none', padding: 0, fontSize: 10, color: 'var(--danger)', cursor: 'pointer', fontFamily: 'inherit', opacity: deletingId === c.id ? 0.5 : 1 }}>
                            {deletingId === c.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}

          {error && (
            <div className="error-banner" style={{ marginBottom: 8, fontSize: 11 }}>
              {error}
            </div>
          )}

          {commentPhotoPreview && (
            <div style={{ position: 'relative', marginBottom: 8, display: 'inline-block' }}>
              <img src={commentPhotoPreview} alt="" style={{ height: 70, borderRadius: 8, objectFit: 'cover', display: 'block' }} />
              <button onClick={() => { setCommentPhoto(null); setCommentPhotoPreview(null) }}
                style={{ position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>
                x
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input value={newComment} onChange={e => setNewComment(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && addComment()}
              placeholder="Write a comment..."
              style={{ flex: 1, padding: '7px 10px', background: inputBg, border: `1px solid ${borderSep}`, borderRadius: 8, color: textColor, fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
            <input type="file" accept="image/*" ref={photoInputRef} onChange={handlePhotoSelect} style={{ display: 'none' }} />
            <button onClick={() => photoInputRef.current?.click()}
              style={{ width: 30, height: 30, borderRadius: 8, background: commentPhoto ? 'var(--yellow-soft)' : inputBg, border: `1px solid ${commentPhoto ? 'var(--yellow)' : borderSep}`, color: commentPhoto ? 'var(--yellow)' : muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'inherit' }}
              title="Add photo"
              aria-label="Add photo">
              <ImageIcon size={14} strokeWidth={2} />
            </button>
            <button onClick={addComment} disabled={(!newComment.trim() && !commentPhoto) || submitting}
              style={{ padding: '7px 12px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: (!newComment.trim() && !commentPhoto) || submitting ? 0.5 : 1, flexShrink: 0 }}>
              Post
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
