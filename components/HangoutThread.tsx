'use client'
import { useState, useEffect, useRef } from 'react'
import { ImageIcon } from 'lucide-react'
import { supabase, getSignedUrl } from '@/lib/supabase'
import { compressImage } from '@/lib/compressImage'

type ThreadMessage = {
  id: string
  hangout_id: string
  author_id: string
  content: string | null
  photo_path: string | null
  photo_url?: string
  created_at: string
  edited_at: string | null
  profiles?: { name: string | null }
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

export default function HangoutThread({ hangoutId, currentUser, members }: {
  hangoutId: string
  currentUser: any
  members: any[]
}) {
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [loading, setLoading]   = useState(true)
  const [text, setText]         = useState('')
  const [sending, setSending]   = useState(false)
  const [error, setError]       = useState('')
  const [photo, setPhoto]               = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const listRef       = useRef<HTMLDivElement>(null)

  function scrollToBottom() {
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
    })
  }

  async function markRead() {
    if (!currentUser?.id) return
    await supabase.from('hangout_message_reads').upsert(
      { hangout_id: hangoutId, user_id: currentUser.id, last_read_at: new Date().toISOString() },
      { onConflict: 'user_id,hangout_id' }
    )
  }

  async function loadMessages() {
    setLoading(true)
    const { data, error: loadError } = await supabase
      .from('hangout_messages')
      .select('*, profiles:author_id(name)')
      .eq('hangout_id', hangoutId)
      .order('created_at', { ascending: true })
      .limit(100)
    if (loadError) { setError('Could not load messages.'); setLoading(false); return }
    const withUrls = await Promise.all((data || []).map(async (m: any) => {
      if (!m.photo_path) return m
      const url = await getSignedUrl(m.photo_path)
      return { ...m, photo_url: url ?? '' }
    }))
    setMessages(withUrls)
    setLoading(false)
    scrollToBottom()
  }

  async function appendMessage(raw: any) {
    // Realtime payloads only carry raw columns, never the joined profile — resolve the name locally.
    const name = raw.author_id === currentUser?.id
      ? (currentUser?.name || null)
      : (members.find(m => m.id === raw.author_id)?.name || null)
    let photo_url: string | undefined
    if (raw.photo_path) photo_url = (await getSignedUrl(raw.photo_path)) ?? ''
    setMessages(prev => {
      if (prev.some(m => m.id === raw.id)) return prev
      return [...prev, { ...raw, photo_url, profiles: { name } }]
    })
    scrollToBottom()
  }

  useEffect(() => {
    let cancelled = false
    loadMessages()
    markRead()

    const channel = supabase
      .channel(`hangout-thread:${hangoutId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'hangout_messages', filter: `hangout_id=eq.${hangoutId}`,
      }, payload => {
        if (cancelled) return
        appendMessage(payload.new)
        markRead()
      })
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [hangoutId])

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function send() {
    if ((!text.trim() && !photo) || sending || !currentUser?.id) return
    setSending(true)
    setError('')

    let photoPath: string | null = null
    if (photo) {
      const compressed = await compressImage(photo)
      const ext = compressed.name.split('.').pop()
      const path = `threads/${hangoutId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`
      const { error: uploadError } = await supabase.storage.from('knot-photos').upload(path, compressed)
      if (uploadError) { setError('Photo upload failed.'); setSending(false); return }
      photoPath = path
    }

    const { error: insertError } = await supabase.from('hangout_messages').insert({
      hangout_id: hangoutId,
      author_id:  currentUser.id,
      content:    text.trim() || null,
      photo_path: photoPath,
    })
    if (insertError) { setError('Could not send. Try again.'); setSending(false); return }

    setText('')
    setPhoto(null)
    setPhotoPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setSending(false)
    markRead()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#ffffff' }}>
      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {loading ? (
          <div style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: 20 }}>Loading...</div>
        ) : messages.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: '40px 20px' }}>
            No messages yet. Start the conversation.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.map(m => {
              const isMine = m.author_id === currentUser?.id
              const name = m.profiles?.name || 'Someone'
              return (
                <div key={m.id} style={{ display: 'flex', gap: 8, flexDirection: isMine ? 'row-reverse' : 'row', alignItems: 'flex-end' }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--yellow)', color: 'var(--text)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {getInitials(name)}
                  </div>
                  <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
                    {!isMine && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 2 }}>{name}</span>}
                    <div style={{ padding: m.photo_url ? 4 : '8px 12px', borderRadius: 12, background: isMine ? 'var(--yellow)' : 'var(--bg3)' }}>
                      {m.photo_url && (
                        <img src={m.photo_url} alt="" style={{ display: 'block', maxWidth: '100%', borderRadius: 8, marginBottom: m.content ? 6 : 0 }} />
                      )}
                      {m.content && (
                        <span style={{ fontSize: 13, lineHeight: 1.4, color: 'var(--text)', whiteSpace: 'pre-wrap', padding: m.photo_url ? '0 6px 4px' : 0, display: 'block' }}>
                          {m.content}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{timeAgo(m.created_at)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {error && (
        <div className="error-banner" style={{ margin: '0 16px 8px' }}>{error}</div>
      )}

      {photoPreview && (
        <div style={{ position: 'relative', margin: '0 16px 8px', display: 'inline-block' }}>
          <img src={photoPreview} alt="" style={{ height: 60, borderRadius: 8, objectFit: 'cover', display: 'block' }} />
          <button onClick={() => { setPhoto(null); setPhotoPreview(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
            style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>
            ×
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: 12, borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <input type="file" accept="image/*" ref={fileInputRef} onChange={handlePhotoSelect} style={{ display: 'none' }} />
        <button onClick={() => fileInputRef.current?.click()}
          style={{ width: 34, height: 34, borderRadius: 8, background: photo ? 'var(--yellow-soft)' : 'var(--bg3)', border: `1px solid ${photo ? 'var(--yellow)' : 'var(--border2)'}`, color: photo ? 'var(--yellow)' : 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'inherit' }}
          title="Add photo" aria-label="Add photo">
          <ImageIcon size={15} strokeWidth={2} />
        </button>
        <input value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Message the group..."
          style={{ flex: 1, padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
        <button onClick={send} disabled={(!text.trim() && !photo) || sending}
          style={{ padding: '9px 16px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: 'var(--text)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: (!text.trim() && !photo) || sending ? 0.5 : 1, flexShrink: 0 }}>
          {sending ? '...' : 'Send'}
        </button>
      </div>
    </div>
  )
}
