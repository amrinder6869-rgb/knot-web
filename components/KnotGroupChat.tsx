'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ToastProvider'
import MemberAvatar from '@/components/MemberAvatar'
import {
  GROUP_CHAT_PLACEHOLDER,
  GROUP_CHAT_EMPTY,
  AGENT_START_PLAN,
  AGENT_NOT_A_PLAN,
  POST_OPEN_PLAN,
  PLAN_UNTITLED,
  TOAST_ERROR,
  CHAT_LOADING,
} from '@/lib/copy'
import { ICON_SIZE } from '@/lib/constants'

interface KnotGroupChatProps {
  knotId: string
  knotName: string
  knotEmoji?: string
  members: any[]
  currentUser: any
  onClose: () => void
  onOpenHangout: (hangoutId: string) => void
}

const HOUR_MS = 60 * 60 * 1000

function KnotMark({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      <circle cx="17" cy="17" r="10" stroke="var(--yellow)" strokeWidth="3" fill="none" />
      <circle cx="27" cy="27" r="10" stroke="var(--yellow)" strokeWidth="3" fill="none" opacity="0.5" />
    </svg>
  )
}

function timeAgo(date: string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function dateDividerLabel(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === now.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function KnotGroupChat({ knotId, knotName, knotEmoji, members, currentUser, onClose, onOpenHangout }: KnotGroupChatProps) {
  const toast = useToast()
  const agentId = process.env.NEXT_PUBLIC_KNOT_AGENT_USER_ID || ''

  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [agentSuggestion, setAgentSuggestion] = useState<{ text: string; hangoutId?: string } | null>(null)
  const [startingPlan, setStartingPlan] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false

    async function loadMessages() {
      const { data } = await supabase
        .from('posts')
        .select('*, profiles:author_id(id, name, avatar_url)')
        .eq('knot_id', knotId)
        .order('created_at', { ascending: true })
      if (!cancelled) {
        setMessages(data || [])
        setLoading(false)
      }
    }
    loadMessages()

    const channel = supabase
      .channel(`group-chat:${knotId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'posts', filter: `knot_id=eq.${knotId}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new])
      })
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [knotId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function sendMessage() {
    const content = input.trim()
    if (!content || sending || !currentUser?.id) return
    setSending(true)
    setInput('')

    const { error: postError } = await supabase.from('posts').insert({
      knot_id: knotId,
      author_id: currentUser.id,
      content,
      post_type: 'chat',
    })

    if (postError) {
      toast.error(TOAST_ERROR)
      setSending(false)
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const res = await fetch('/api/planning-agent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            message: content,
            hangout_id: null,
            knot_id: knotId,
            sender_id: currentUser.id,
            current_plan_state: null,
            detection_mode: true,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.plan_detected && data.agent_message) {
            setAgentSuggestion({ text: data.agent_message })
          }
        }
      }
    } catch (err) {
      console.error('[KnotGroupChat] detection request failed:', err)
    }

    setSending(false)
  }

  async function handleStartPlan() {
    if (startingPlan || !currentUser?.id) return
    setStartingPlan(true)
    const actorName = currentUser?.name || 'Someone'
    const pInput: Record<string, any> = {
      knot_id: knotId,
      title: PLAN_UNTITLED,
      type: 'planned',
      scheduled_for: null,
      venue_name: null,
      venue_address: null,
      venue_place_id: null,
      venue_lat: null,
      venue_lng: null,
      venue_category: null,
      venue_maps_url: null,
      venue_booking_url: null,
      meeting_url: null,
      brief: null,
      brief_vibe: null,
      brief_budget: null,
      movie_title: null,
      movie_showtime: null,
      event_restrictions: [],
      invite_mode: 'all',
      is_surprise: false,
      reveal_at: null,
      poll_mode: false,
      poll_title: PLAN_UNTITLED,
      is_standalone: false,
      post_content: `${actorName} started a plan`,
      post_type: 'hangout',
      planning_status: 'planning',
    }
    try {
      const { data, error } = await supabase.rpc('create_hangout', { p_input: pInput })
      if (error || !data?.hangout_id) {
        toast.error(TOAST_ERROR)
        return
      }
      setAgentSuggestion(null)
      onOpenHangout(data.hangout_id as string)
    } catch (err) {
      console.error('[KnotGroupChat] handleStartPlan failed:', err)
      toast.error(TOAST_ERROR)
    } finally {
      setStartingPlan(false)
    }
  }

  function memberFor(authorId: string) {
    return members.find(m => m.id === authorId)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* TOP BAR */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button onClick={onClose} aria-label="Back"
          style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg3)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <i className="ti ti-arrow-left" style={{ fontSize: ICON_SIZE.nav, color: 'var(--text2)' }} />
        </button>
        <span style={{ fontSize: 18 }}>{knotEmoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{knotName}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{members.length} member{members.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* THREAD */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
        {loading ? (
          <div style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: 20 }}>{CHAT_LOADING}</div>
        ) : messages.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: '40px 20px' }}>{GROUP_CHAT_EMPTY}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.map((m, i) => {
              const isAgent = !!(agentId && m.author_id === agentId)
              const isMine = m.author_id === currentUser?.id
              const member = memberFor(m.author_id)
              const name = isAgent ? 'Knot' : (isMine ? (currentUser?.name || 'You') : (member?.name || 'Someone'))
              const avatarUrl = isAgent ? null : (isMine ? (currentUser?.avatar_url || null) : (member?.avatar_url || null))
              const showDateDivider = i > 0 && (new Date(m.created_at).getTime() - new Date(messages[i - 1].created_at).getTime()) > HOUR_MS

              if (m.post_type === 'hangout' || m.post_type === 'bill' || m.post_type === 'moment') {
                return (
                  <div key={m.id} style={{ display: 'contents' }}>
                    {showDateDivider && (
                      <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--text3)', margin: '4px 0' }}>{dateDividerLabel(m.created_at)}</div>
                    )}
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, maxWidth: '90%' }}>
                        <span style={{ fontSize: 12, color: 'var(--text2)' }}>
                          <strong style={{ color: 'var(--text)' }}>{name}</strong>{' '}
                          {m.post_type === 'hangout' ? 'started a plan' : m.post_type === 'bill' ? 'added a bill' : 'posted a moment'}
                          {m.post_type === 'moment' && m.content ? ` — ${m.content}` : ''}
                        </span>
                        {m.post_type === 'hangout' && m.hangout_id && (
                          <button onClick={() => onOpenHangout(m.hangout_id)}
                            style={{ padding: '5px 12px', background: 'var(--yellow)', border: 'none', borderRadius: 20, color: '#111', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                            {POST_OPEN_PLAN}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              }

              return (
                <div key={m.id} style={{ display: 'contents' }}>
                  {showDateDivider && (
                    <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--text3)', margin: '4px 0' }}>{dateDividerLabel(m.created_at)}</div>
                  )}
                  <div style={{ display: 'flex', gap: 8, flexDirection: isMine ? 'row-reverse' : 'row', alignItems: 'flex-end' }}>
                    {isAgent ? (
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#FFFBEE', border: '1px solid rgba(248,189,3,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <KnotMark size={14} />
                      </div>
                    ) : (
                      <MemberAvatar name={name} avatarUrl={avatarUrl} size={28} />
                    )}
                    <div style={{ maxWidth: '76%', display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
                      {!isMine && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 2 }}>{name}</span>}
                      <div style={{
                        padding: '8px 12px', borderRadius: 12,
                        background: isAgent ? '#FFFBEE' : (isMine ? '#111' : '#fff'),
                        border: isAgent ? '1px solid rgba(248,189,3,0.25)' : (isMine ? 'none' : '0.5px solid rgba(0,0,0,0.08)'),
                      }}>
                        <span style={{ fontSize: 13, lineHeight: 1.4, color: isAgent ? '#111' : (isMine ? '#fff' : 'var(--text)'), whiteSpace: 'pre-wrap', display: 'block' }}>{m.content}</span>
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{timeAgo(m.created_at)}</span>
                    </div>
                  </div>
                </div>
              )
            })}

            {agentSuggestion && (
              <div style={{ alignSelf: 'center', width: '100%', maxWidth: 320, margin: '4px auto', padding: 12, background: '#FFFBEE', border: '1px solid rgba(248,189,3,0.3)', borderRadius: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <KnotMark size={16} />
                  <span style={{ fontSize: 13, color: '#111', fontWeight: 600 }}>{agentSuggestion.text}</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleStartPlan} disabled={startingPlan}
                    style={{ flex: 1, padding: '8px 0', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 12, fontWeight: 700, cursor: startingPlan ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: startingPlan ? 0.6 : 1 }}>
                    {AGENT_START_PLAN}
                  </button>
                  <button onClick={() => setAgentSuggestion(null)}
                    style={{ flex: 1, padding: '8px 0', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {AGENT_NOT_A_PLAN}
                  </button>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* COMPOSER */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderTop: '1px solid var(--border)', background: '#F5F3EE', flexShrink: 0, paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))' }}>
        <button type="button" aria-label="Add"
          style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--bg3)', border: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' }}>
          <i className="ti ti-plus" style={{ fontSize: ICON_SIZE.nav, color: 'var(--text3)' }} />
        </button>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          placeholder={GROUP_CHAT_PLACEHOLDER}
          style={{ flex: 1, minWidth: 0, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 20, padding: '9px 14px', fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: 'inherit', caretColor: 'var(--yellow)' }}
        />
        <button
          type="button"
          onClick={sendMessage}
          disabled={sending || !input.trim()}
          style={{ width: 34, height: 34, borderRadius: '50%', background: input.trim() ? 'var(--yellow)' : 'var(--bg3)', border: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: sending || !input.trim() ? 'default' : 'pointer', flexShrink: 0 }}
          aria-label="Send">
          <i className="ti ti-send" style={{ fontSize: ICON_SIZE.nav, color: '#111' }} />
        </button>
      </div>
    </div>
  )
}
