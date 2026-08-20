'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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

export default function Notifications({ userId, onSelectKnot, knots }: {
  userId: string
  onSelectKnot: (knot: any) => void
  knots: any[]
}) {
  const router = useRouter()
  const [open, setOpen]           = useState(false)
  const [items, setItems]         = useState<any[]>([])
  const [unread, setUnread]       = useState(0)
  const ref                       = useRef<HTMLDivElement>(null)

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
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

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

  function renderList() {
    if (items.length === 0) {
      return (
        <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          You are all caught up
        </div>
      )
    }
    return (
      <>
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

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ position: 'relative', width: 32, height: 32, borderRadius: '50%', background: 'var(--bg3)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text2)' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread > 0 && (
          <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16, borderRadius: 8, background: '#DC2626', color: '#fff', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', border: '2px solid var(--bg)' }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Desktop: dropdown */}
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

          {/* Mobile: full-screen sheet */}
          <div className="mobile-only" style={{ display: 'none', position: 'fixed', inset: 0, zIndex: 300, background: 'var(--bg2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)', height: 52, boxSizing: 'border-box' }}>
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
            <div style={{ height: 'calc(100vh - 52px)', overflowY: 'auto' }}>
              {renderList()}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function NotificationRow({ n, onClick }: { n: any; onClick: () => void }) {
  const initials = n.actor?.name ? getInitials(n.actor.name) : (TYPE_LABEL[n.type]?.substring(0, 2).toUpperCase() || 'N')
  return (
    <div onClick={onClick}
      style={{ display: 'flex', gap: 10, padding: '12px 16px', cursor: 'pointer', background: n.read ? 'transparent' : 'var(--yellow-soft)', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg3)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text3)', flexShrink: 0 }}>
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.4 }}>
          {n.knot && (
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--yellow)', marginRight: 4 }}>
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
