'use client'
import { useCallback, useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ICON_SIZE } from '@/lib/constants'
import { isUpcomingHangout } from '@/lib/hangoutPhase'
import { type OpenChatOpts } from '@/components/AttentionStrip'
import KnotIcon from '@/components/KnotIcon'
import {
  ATTENTION_STRIP_HEADER,
  TODO_RSVP_ACTION,
  TODO_VOTE_ACTION,
  TODO_SETTLE_ACTION,
  TODO_RSVP_SUB,
} from '@/lib/copy'

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (s < 60) return 'Just now'
  if (s < 3600) return Math.floor(s / 60) + 'm ago'
  if (s < 86400) return Math.floor(s / 3600) + 'h ago'
  return Math.floor(s / 86400) + 'd ago'
}

function isToday(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  return d.toDateString() === now.toDateString()
}

function getInitials(name: string) {
  return (name || 'U').split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()
}

const TYPE_LABEL: Record<string, string> = {
  new_post:               'New post',
  reaction:                'Reaction',
  bill_added:              'Bill added',
  bill_settled:            'Bill settled',
  bill_treated:            'Treat',
  new_poll:                'New poll',
  photo_added:             'Photos added',
  member_joined:           'New member',
  role_assigned:           'Role assigned',
  new_hangout:             'New hangout',
  rsvp_momentum:           'RSVP update',
  hangout_confirmed:       'Confirmed',
  hangout_live:            'Live now',
  bill_reminder:           'Bill reminder',
  new_moment:              'New moment',
  hangout_thread_message:  'New message',
  follow_request:          'Follow request',
  connection_accepted:     'Connection',
}

type AttentionItem = {
  key: string
  kind: 'rsvp' | 'poll' | 'bill'
  hangoutId: string
  icon: string
  label: string
  sub: string
  action: string
  scrollTarget?: 'poll' | 'bill' | null
}

export default function Notifications({ userId, onSelectKnot, knots, onOpenChat }: {
  userId: string
  onSelectKnot: (knot: any) => void
  knots: any[]
  onOpenChat: (opts: OpenChatOpts) => void
}) {
  const router = useRouter()
  const [open, setOpen]           = useState(false)
  const [items, setItems]         = useState<any[]>([])
  const [unread, setUnread]       = useState(0)
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([])
  const [showPushPrompt, setShowPushPrompt] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const ref                       = useRef<HTMLDivElement>(null)
  // Mobile sheet is portaled to document.body (see render below) so it isn't
  // contained by the sticky top nav's backdrop-filter — an ancestor with
  // backdrop-filter/filter/transform creates a new containing block for
  // position:fixed descendants, which was clipping the "full screen" sheet
  // to the 52px header bar instead of the viewport. Outside-click detection
  // below checks this ref too since the portaled content sits outside `ref`'s
  // own DOM subtree.
  const panelRef                  = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 768px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (userId) {
      load()
      const channel = supabase
        .channel('notifications:' + userId)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'notifications',
          filter: 'user_id=eq.' + userId
        }, () => load())
        .subscribe()
      return () => { supabase.removeChannel(channel) }
    }
  }, [userId])

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      const target = e.target as Node
      if (ref.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  useEffect(() => {
    if (!open || !isMobile) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open, isMobile])

  useEffect(() => {
    if (!userId || typeof window === 'undefined') return
    if (localStorage.getItem('knot_notif_prompt_dismissed')) return
    if (!('Notification' in window)) return
    if (Notification.permission !== 'default') return
    setShowPushPrompt(true)
  }, [userId])

  function dismissPushPrompt() {
    localStorage.setItem('knot_notif_prompt_dismissed', 'true')
    setShowPushPrompt(false)
  }

  function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = atob(base64)
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
  }

  async function enablePushNotifications() {
    localStorage.setItem('knot_notif_prompt_dismissed', 'true')
    setShowPushPrompt(false)

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!publicKey || !('serviceWorker' in navigator)) return

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      })
      const sub = subscription.toJSON()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify({ endpoint: sub.endpoint, p256dh: sub.keys?.p256dh, auth: sub.keys?.auth }),
      })
    } catch (err) {
      console.error('Push subscribe error:', err)
    }
  }

  const loadAttention = useCallback(async () => {
    if (!userId || knots.length === 0) { setAttentionItems([]); return }
    const knotIds = knots.map((k: any) => k.id).filter(Boolean)
    if (knotIds.length === 0) { setAttentionItems([]); return }

    const { data: hangouts } = await supabase
      .from('hangouts')
      .select('id, title, created_by, planning_status, status, knot_id, profiles:created_by(name)')
      .in('knot_id', knotIds)

    const upcoming = (hangouts || []).filter((h: any) => isUpcomingHangout(h))
    const hangoutIds = upcoming.map((h: any) => h.id)
    const next: AttentionItem[] = []

    if (hangoutIds.length > 0) {
      const { data: myRsvps } = await supabase
        .from('hangout_rsvps')
        .select('hangout_id')
        .eq('user_id', userId)
        .in('hangout_id', hangoutIds)
      const rsvped = new Set((myRsvps || []).map((r: any) => r.hangout_id))
      for (const h of upcoming) {
        if (rsvped.has(h.id)) continue
        const organiser = (h.profiles as any)?.name || (Array.isArray(h.profiles) ? (h.profiles[0] as any)?.name : null)
        next.push({
          key: `rsvp-${h.id}`,
          kind: 'rsvp',
          hangoutId: h.id,
          icon: 'ti-calendar-event',
          label: `RSVP · ${h.title || 'Plan'}`,
          sub: `${organiser || 'Organiser'} ${TODO_RSVP_SUB}`,
          action: TODO_RSVP_ACTION,
        })
      }

      const { data: openPolls } = await supabase
        .from('availability_polls')
        .select('id, hangout_id, title')
        .in('hangout_id', hangoutIds)
        .eq('status', 'open')
      if (openPolls && openPolls.length > 0) {
        const pollIds = openPolls.map((p: any) => p.id)
        const { data: myResponses } = await supabase
          .from('availability_poll_responses')
          .select('poll_id')
          .eq('user_id', userId)
          .in('poll_id', pollIds)
        const voted = new Set((myResponses || []).map((r: any) => r.poll_id))
        for (const p of openPolls) {
          if (voted.has(p.id)) continue
          next.push({
            key: `poll-${p.id}`,
            kind: 'poll',
            hangoutId: p.hangout_id,
            icon: 'ti-list-check',
            label: `Vote · ${(p.title || 'Poll').slice(0, 30)}`,
            sub: 'Poll is still open',
            action: TODO_VOTE_ACTION,
            scrollTarget: 'poll',
          })
        }
      }
    }

    const { data: knotBills } = await supabase
      .from('bills')
      .select('id, description, hangout_id, total_amount, knot_id')
      .in('knot_id', knotIds)
    if (knotBills && knotBills.length > 0) {
      const billIds = knotBills.map((b: any) => b.id)
      const { data: mySplits } = await supabase
        .from('bill_splits')
        .select('id, bill_id, amount, settled')
        .eq('user_id', userId)
        .eq('settled', false)
        .in('bill_id', billIds)
      const billById = new Map(knotBills.map((b: any) => [b.id, b]))
      for (const s of mySplits || []) {
        const bill = billById.get(s.bill_id)
        if (!bill?.hangout_id) continue
        next.push({
          key: `bill-${s.id}`,
          kind: 'bill',
          hangoutId: bill.hangout_id,
          icon: 'ti-receipt',
          label: `Settle · ${bill.description || 'Bill'} · $${parseFloat(s.amount).toFixed(2)}`,
          sub: 'Balance still open',
          action: TODO_SETTLE_ACTION,
          scrollTarget: 'bill',
        })
      }
    }

    setAttentionItems(next)
  }, [userId, knots])

  useEffect(() => { loadAttention() }, [loadAttention])

  function handleAttentionAction(item: AttentionItem) {
    setOpen(false)
    onOpenChat({
      hangoutId: item.hangoutId,
      scrollToBottom: item.kind === 'rsvp',
      scrollTarget: item.scrollTarget || null,
    })
  }

  async function load() {
    const { data } = await supabase
      .from('notifications')
      .select('*, actor:actor_id(name), knot:knot_id(id, name, emoji)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) {
      setItems(data)
      setUnread(data.filter((n: any) => !n.read).length)
    }
  }

  async function markAllRead() {
    await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false)
    setItems(ns => ns.map(n => ({ ...n, read: true })))
    setUnread(0)
  }

  async function handleClick(n: any) {
    if (!n.read) {
      await supabase.from('notifications').update({ read: true }).eq('id', n.id)
      setItems(ns => ns.map(x => x.id === n.id ? { ...x, read: true } : x))
      setUnread(u => Math.max(0, u - 1))
    }
    setOpen(false)
    if (n.link_url) {
      router.push(n.link_url)
      return
    }
    const knot = knots.find(k => k.id === n.knot_id) || n.knot
    if (knot) onSelectKnot(knot)
  }

  const todayItems   = items.filter(n => isToday(n.created_at))
  const earlierItems = items.filter(n => !isToday(n.created_at))
  const badgeCount   = unread + attentionItems.length

  function renderList() {
    const pushPrompt = showPushPrompt && (
      <div style={{ background: 'var(--yellow-soft)', borderBottom: '1px solid var(--yellow)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ flex: 1, fontSize: 12, color: 'var(--text)' }}>Get notified when plans are confirmed and friends RSVP</span>
        <button onClick={enablePushNotifications}
          style={{ padding: '6px 12px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
          Turn on
        </button>
        <button onClick={dismissPushPrompt} aria-label="Dismiss"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, lineHeight: 1, fontFamily: 'inherit', display: 'flex', flexShrink: 0 }}>
          <i className="ti ti-x" style={{ fontSize: ICON_SIZE.inline, color: 'var(--text3)' }} />
        </button>
      </div>
    )

    if (items.length === 0 && attentionItems.length === 0) {
      return (
        <>
          {pushPrompt}
          <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
            You are all caught up
          </div>
        </>
      )
    }
    return (
      <>
        {pushPrompt}
        {attentionItems.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px 4px', background: 'var(--yellow-soft)' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#8a6500', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{ATTENTION_STRIP_HEADER}</span>
              <span style={{ padding: '1px 7px', borderRadius: 20, background: 'var(--yellow)', color: '#111', fontSize: 10, fontWeight: 700 }}>{attentionItems.length}</span>
            </div>
            {attentionItems.map(item => (
              <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'var(--yellow-soft)', borderBottom: '1px solid var(--border)' }}>
                <i className={`ti ${item.icon}`} style={{ fontSize: ICON_SIZE.card, color: '#8a6500', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{item.sub}</div>
                </div>
                <button type="button" onClick={() => handleAttentionAction(item)}
                  style={{ padding: '5px 10px', background: 'var(--yellow)', border: 'none', borderRadius: 6, color: '#111', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                  {item.action}
                </button>
              </div>
            ))}
          </>
        )}
        {todayItems.length > 0 && (
          <>
            <div style={{ padding: '10px 16px 4px', fontSize: 10, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Today</div>
            {todayItems.map(n => <NotificationRow key={n.id} n={n} onClick={() => handleClick(n)} />)}
          </>
        )}
        {earlierItems.length > 0 && (
          <>
            <div style={{ padding: '10px 16px 4px', fontSize: 10, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Earlier</div>
            {earlierItems.map(n => <NotificationRow key={n.id} n={n} onClick={() => handleClick(n)} />)}
          </>
        )}
      </>
    )
  }

  const mobileSheet = open && mounted && isMobile ? createPortal(
    <div ref={panelRef} style={{ position: 'fixed', inset: 0, zIndex: 500, background: '#FFFFFF', backdropFilter: 'none', WebkitBackdropFilter: 'none', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)', height: 52, boxSizing: 'border-box', background: '#FFFFFF', flexShrink: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Notifications</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {unread > 0 && (
            <button onClick={markAllRead} style={{ fontSize: 12, color: 'var(--yellow)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
              Mark all as read
            </button>
          )}
          <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--text3)', cursor: 'pointer', lineHeight: 1, padding: 4 }}>×</button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', background: '#FFFFFF' }}>
        {renderList()}
      </div>
    </div>,
    document.body
  ) : null

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ position: 'relative', width: 32, height: 32, borderRadius: '50%', background: 'var(--bg3)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text2)' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {badgeCount > 0 && (
          <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16, borderRadius: 8, background: '#DC2626', color: '#fff', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', border: '2px solid var(--bg)' }}>
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </button>

      {open && (
        /* Desktop: dropdown, positioned relative to the trigger button — must
           stay in this DOM subtree (not portaled) or position:absolute would
           resolve against document.body instead of `ref`. */
        <div className="desktop-only" style={{ position: 'absolute', top: '110%', right: 0, width: 340, background: '#ffffff', border: '0.5px solid rgba(0,0,0,0.08)', boxShadow: '0 8px 32px rgba(0,0,0,0.14)', borderRadius: 12, zIndex: 300, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} style={{ fontSize: 11, color: 'var(--yellow)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                Mark all as read
              </button>
            )}
          </div>
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {renderList()}
          </div>
        </div>
      )}

      {mobileSheet}
    </div>
  )
}

function NotificationRow({ n, onClick }: { n: any; onClick: () => void }) {
  const initials = n.actor?.name ? getInitials(n.actor.name) : (TYPE_LABEL[n.type]?.substring(0, 2).toUpperCase() || 'N')
  return (
    <div onClick={onClick}
      style={{ display: 'flex', gap: 10, padding: '12px 16px', cursor: 'pointer', background: n.read ? '#FFFFFF' : 'var(--yellow-soft)', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg3)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text3)', flexShrink: 0 }}>
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.4 }}>
          {n.knot && (
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--yellow)', marginRight: 4, display: 'inline-flex', alignItems: 'center', gap: 4, verticalAlign: 'middle' }}>
              <KnotIcon value={n.knot.emoji} size={16} iconSize={9} />
              {n.knot.name}
            </span>
          )}
          {n.message}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{timeAgo(n.created_at)}</div>
      </div>
      {!n.read && (
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--yellow)', flexShrink: 0, marginTop: 4 }} />
      )}
    </div>
  )
}
