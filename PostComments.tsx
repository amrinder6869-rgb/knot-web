'use client'
import { useState, useRef } from 'react'
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

type PostCommentsProps = {
  postId: string
  currentUser: any
  initialComments: any[]
  onCommentAdded?: () => void
}

export default function PostComments({ postId, currentUser, initialComments, onCommentAdded }: PostCommentsProps) {
  const [comments, setComments]   = useState<any[]>(initialComments)
  const [showComments, setShowComments] = useState(false)
  const [newComment, setNewComment]     = useState('')
  const [submitting, setSubmitting]     = useState(false)
  const [error, setError]               = useState('')

  const [commentPhoto, setCommentPhoto]               = useState<File | null>(null)
  const [commentPhotoPreview, setCommentPhotoPreview] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCommentPhoto(file)
    setCommentPhotoPreview(URL.createObjectURL(file))
  }

  async function addComment() {
    if ((!newComment.trim() && !commentPhoto) || !currentUser || submitting) return
    setSubmitting(true)
    setError('')

    let photoPath: string | null = null
    let photoUrl: string | null = null
    if (commentPhoto) {
      const ext = commentPhoto.name.split('.').pop()
      const path = `comments/${postId}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('knot-photos').upload(path, commentPhoto)
      if (uploadError) {
        setError('Photo upload failed. Comment not posted.')
        setSubmitting(false)
        return
      }
      photoPath = path
      const { data: { publicUrl } } = supabase.storage.from('knot-photos').getPublicUrl(path)
      photoUrl = publicUrl
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

  return (
    <div style={{ marginTop: 10 }}>
      <button onClick={() => setShowComments(s => !s)}
        style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: 'var(--text3)', cursor: 'pointer', fontFamily: 'inherit' }}>
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
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{c.profiles?.name || 'Someone'}</span>
                {c.content && <span style={{ fontSize: 12, color: 'var(--text2)', marginLeft: 6 }}>{c.content}</span>}
                {c.photo_url && (
                  <div style={{ marginTop: 6 }}>
                    <img src={c.photo_url} alt="" style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 8, objectFit: 'cover', display: 'block' }} />
                  </div>
                )}
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{timeAgo(c.created_at)}</div>
              </div>
            </div>
          ))}

          {error && (
            <div style={{ padding: '6px 10px', background: 'var(--yellow-soft)', border: '1px solid var(--yellow-dim)', borderRadius: 8, fontSize: 11, color: 'var(--yellow)', marginBottom: 8 }}>
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
              style={{ flex: 1, padding: '7px 10px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
            <input type="file" accept="image/*" ref={photoInputRef} onChange={handlePhotoSelect} style={{ display: 'none' }} />
            <button onClick={() => photoInputRef.current?.click()}
              style={{ width: 30, height: 30, borderRadius: 8, background: commentPhoto ? 'var(--yellow-soft)' : 'var(--bg3)', border: `1px solid ${commentPhoto ? 'var(--yellow)' : 'var(--border2)'}`, color: commentPhoto ? 'var(--yellow)' : 'var(--text3)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'inherit' }}
              title="Add photo">
              P
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
