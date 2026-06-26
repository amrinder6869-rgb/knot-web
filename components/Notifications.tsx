'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (s < 60) return 'Just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

const TYPE_ICON: Record<string, string> = {
  new_post:     '??',
  reaction:     '??',
  bill_added:   '??',
  bill_settled: '?',
  bill_treated: '??',
  new_poll:     '???',
  photo_added:  '??',
  member_joined:'??',
}

export default function Notifications({ userId, onSelectKnot, knots }: {
  userId: string
  onSelectKnot: (knot: any) => void
  knots: any[]
}) {
  const [open, setOpen]               = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [unread, setUnread]           = useState(0)
  const ref                           = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (userId) {
      loadNotifications()
      const channel = supabase
        .channel(`notifications:${userId}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'notifications',
          filter: `user_id=eq.${userId}`
        }, () => loadNotifications())
        .subscribe()
      return () => { supabase.removeChannel(channel) }
    }
  }, [userId])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function loadNotifications() {
    const { data } = await supabase
      .from('notifications')
      .select('*, actor:actor_id(name), knot:knot_id(id, name, emoji)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30)
    if (data) {
      setNotifications(data)
      setUnread(data.filter((n: any) => !n.read).length)
    }
  }

  async function markAllRead() {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false)
    setNotifications(ns => ns.map(n => ({ ...n, read: true })))
    setUnread(0)
  }

  async function handleClick(n: any) {
    if (!n.read) {
      await supabase.from('notifications').update({ read: true }).eq('id', n.id)
      setNotifications(ns => ns.map(x => x.id === n.id ? { ...x, read: true } : x))
      setUnread(u => Math.max(0, u - 1))
    }
    const knot = knots.find(k => k.id === n.knot_id) || n.knot
    if (knot) onSelectKnot(knot)
    setOpen(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => { setOpen(!open); if (!open && unread > 0) markAllRead() }}
        style={{ position: 'relative', width: 32, height: 32, borderRadius: '50%', background: 'var(--bg3)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 15 }}>
        ??
        {unread > 0 && (
          <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16, borderRadius: 8, background: 'var(--yellow)', color: '#111', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', border: '2px solid var(--bg)' }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: 'absolute', top: '110%', right: 0, width: 340, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.14)', zIndex: 300, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead}
                style={{ fontSize: 11, color: 'var(--yellow)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                Mark all read
              </button>
            )}
          </div>

          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
                No notifications yet
              </div>
            ) : (
              notifications.map(n => (
                <div key={n.id} onClick={() => handleClick(n)}
                  style={{ display: 'flex', gap: 10, padding: '12px 16px', cursor: 'pointer', background: n.read ? 'transparent' : 'var(--yellow-soft)', borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                  onMouseLeave={e => (e.currentTarget.style.background = n.read ? 'transparent' : 'var(--yellow-soft)')}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg3)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                    {TYPE_ICON[n.type] || '??'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.4 }}>
                      {n.knot && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--yellow)', marginRight: 4 }}>
                          {n.knot.emoji} {n.knot.name}
                        </span>
                      )}
                      {n.message}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{timeAgo(n.created_at)}</div>
                  </div>
                  {!n.read && (
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--yellow)', flexShrink: 0, marginTop: 4 }} />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}


