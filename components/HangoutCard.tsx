'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Skeleton } from '@/components/Skeleton'
import { useToast } from '@/components/ToastProvider'
import ReactionBar from '@/components/ReactionBar'
import MemberAvatar from '@/components/MemberAvatar'
import { ACTIVITY_ICONS, ICON_SIZE } from '@/lib/constants'
import { CARD_STATE_COPY, CHIP_WHEN, CHIP_WHERE, CONFIRM_CANCEL_HANGOUT, PLAN_UNTITLED } from '@/lib/copy'
import { cardStateKey } from '@/lib/hangoutPhase'

function timeAgo(date: string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function categoryLabel(hangout: any): string {
  const raw = hangout?.activity_type || hangout?.occasion_type || hangout?.brief_vibe || hangout?.type || 'hangout'
  return String(raw).replace(/_/g, ' ')
}

function activityIcon(hangout: any): string {
  const keys = [hangout?.activity_type, hangout?.occasion_type, hangout?.brief_vibe, hangout?.type, hangout?.movie_title ? 'movie' : null]
  for (const key of keys) {
    if (key && ACTIVITY_ICONS[String(key).toLowerCase()]) return ACTIVITY_ICONS[String(key).toLowerCase()]
  }
  return 'ti-calendar-event'
}

type HangoutCardData = {
  hangout: any
  options: any[]
  rsvps: any[]
  comments: any[]
  bills: any[]
  invites: any[]
  poll: any | null
}

type HangoutCardProps = {
  post: any
  data: HangoutCardData
  currentUser: any
  knotId: string
  members: any[]
  onRefresh: () => void
  onToggleReaction?: (emoji: string) => void
  onOpenChat: (hangoutId: string) => void
}

export default function HangoutCard({ post, data, currentUser, onRefresh, onToggleReaction, onOpenChat }: HangoutCardProps) {
  const toast = useToast()
  const [hangout, setHangout] = useState<any>(data.hangout)
  const [rsvps, setRsvps] = useState<any[]>(data.rsvps ?? [])
  const [comments, setComments] = useState<any[]>(data.comments ?? [])
  const [invites, setInvites] = useState<any[]>(data.invites ?? [])
  const [menuOpen, setMenuOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setHangout(data.hangout)
    setRsvps(data.rsvps ?? [])
    setComments(data.comments ?? [])
    setInvites(data.invites ?? [])
  }, [data])

  useEffect(() => {
    if (!menuOpen) return
    function onDoc(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  if (!hangout) return null

  const myInvite = invites.find((inv: any) => inv.user_id === currentUser?.id)
  const revealPending = !!(hangout.is_surprise && myInvite?.is_surprise && myInvite.reveal_at && new Date(myInvite.reveal_at) > new Date())
  if (revealPending) return null

  const isCreator = hangout.created_by === currentUser?.id
  const stateKey = cardStateKey(hangout)
  const stateCopy = CARD_STATE_COPY[stateKey] || CARD_STATE_COPY.voting
  const going = rsvps.filter((r: any) => r.status === 'yes')
  const goingCount = going.length
  const scheduled = hangout.scheduled_for ? new Date(hangout.scheduled_for) : null
  const dateOpen = !scheduled
  const timeOpen = !scheduled
  const venueOpen = !hangout.venue_name
  const dateLabel = scheduled ? scheduled.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : CHIP_WHEN
  const timeLabel = scheduled ? scheduled.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : CHIP_WHEN
  const venueLabel = hangout.venue_name || CHIP_WHERE
  const iconClass = activityIcon(hangout)
  const title = hangout.title || hangout.venue_name || PLAN_UNTITLED
  const timestamp = post?.created_at || hangout.created_at

  function openChat() {
    onOpenChat(hangout.id)
  }

  async function shareInvite(e: React.MouseEvent) {
    e.stopPropagation()
    setMenuOpen(false)
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const link = hangout.standalone_token
      ? `${origin}/event/${hangout.standalone_token}`
      : `${origin}/dashboard`
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Invite link copied.')
    } catch {
      toast.error('Could not copy the link.')
    }
  }

  async function cancelHangout(e: React.MouseEvent) {
    e.stopPropagation()
    if (!currentUser || hangout.created_by !== currentUser.id || cancelling) return
    if (!confirm(CONFIRM_CANCEL_HANGOUT)) return
    setCancelling(true)
    const { error } = await supabase
      .from('hangouts')
      .update({ status: 'cancelled', is_live: false, planning_status: 'cancelled' })
      .eq('id', hangout.id)
      .eq('created_by', currentUser.id)
    setCancelling(false)
    setMenuOpen(false)
    if (error) { toast.error('Could not cancel the hangout.'); return }
    setHangout((prev: any) => ({ ...prev, status: 'cancelled', is_live: false, planning_status: 'cancelled' }))
    onRefresh()
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpenChat(hangout.id)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenChat(hangout.id) } }}
      style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: 12, marginBottom: 10, cursor: 'pointer' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--yellow-soft)', border: '1px solid var(--yellow-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <i className={`ti ${iconClass}`} style={{ fontSize: ICON_SIZE.nav, color: 'var(--yellow)' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {categoryLabel(hangout)}
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </div>
        </div>
        <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button
            type="button"
            aria-label="Hangout menu"
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v) }}
            style={{ width: 32, height: 32, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}
          >
            <i className="ti ti-dots" style={{ fontSize: ICON_SIZE.card, color: 'var(--text3)' }} />
          </button>
          {menuOpen && (
            <div style={{ position: 'absolute', right: 0, top: '110%', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 6, minWidth: 168, zIndex: 40, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
              {isCreator && (
                <button type="button" onClick={e => { e.stopPropagation(); setMenuOpen(false); openChat() }}
                  style={{ width: '100%', textAlign: 'left', padding: '8px 10px', background: 'none', border: 'none', borderRadius: 8, color: 'var(--text)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Edit hangout
                </button>
              )}
              {isCreator && hangout.status !== 'ended' && hangout.status !== 'cancelled' && (
                <button type="button" onClick={cancelHangout} disabled={cancelling}
                  style={{ width: '100%', textAlign: 'left', padding: '8px 10px', background: 'none', border: 'none', borderRadius: 8, color: 'var(--danger)', fontSize: 13, cursor: cancelling ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  {cancelling ? 'Cancelling…' : 'Cancel hangout'}
                </button>
              )}
              <button type="button" onClick={shareInvite}
                style={{ width: '100%', textAlign: 'left', padding: '8px 10px', background: 'none', border: 'none', borderRadius: 8, color: 'var(--text)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Share invite link
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{stateCopy.title}</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 1 }}>{stateCopy.subtitle}</div>
      </div>

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 10, fontSize: 11, color: 'var(--text2)' }}>
        <span style={{ whiteSpace: 'nowrap', ...(dateOpen ? { color: 'var(--text3)', fontStyle: 'italic' as const } : {}) }}>{dateLabel}</span>
        <span style={{ color: 'var(--border2)' }}>·</span>
        <span style={{ whiteSpace: 'nowrap', ...(timeOpen ? { color: 'var(--text3)', fontStyle: 'italic' as const } : {}) }}>{timeLabel}</span>
        <span style={{ color: 'var(--border2)' }}>·</span>
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...(venueOpen ? { color: 'var(--text3)', fontStyle: 'italic' as const } : {}) }}>{venueLabel}</span>
        <span style={{ color: 'var(--border2)' }}>·</span>
        <span style={{ whiteSpace: 'nowrap' }}>{goingCount} RSVP{goingCount === 1 ? '' : 's'}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', flex: 1, minWidth: 0, alignItems: 'center' }}>
          {going.slice(0, 4).map((r: any, i: number) => (
            <div key={r.user_id} style={{ marginLeft: i > 0 ? -6 : 0, border: '2px solid #fff', borderRadius: '50%', lineHeight: 0 }}>
              <MemberAvatar name={r.profiles?.name || 'Someone'} avatarUrl={r.profiles?.avatar_url || null} size={22} />
            </div>
          ))}
          {goingCount > 4 && (
            <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 6 }}>+{goingCount - 4}</span>
          )}
        </div>
        {onToggleReaction && (
          <div
            onClick={e => e.stopPropagation()}
            onKeyDown={e => e.stopPropagation()}
            style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}
          >
            <ReactionBar compact iconTrigger reactions={post.reactions || []} onToggle={onToggleReaction} />
          </div>
        )}
        <span style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{comments.length} comment{comments.length === 1 ? '' : 's'}</span>
        {timestamp && <span style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{timeAgo(timestamp)}</span>}
      </div>
    </div>
  )
}

export function HangoutCardSkeleton() {
  return (
    <div style={{ background: '#ffffff', border: '0.5px solid rgba(0,0,0,0.08)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderRadius: 12, padding: 12, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <Skeleton width={40} height={40} borderRadius={999} />
        <div style={{ flex: 1 }}>
          <Skeleton width="30%" height={10} style={{ marginBottom: 6 }} />
          <Skeleton width="65%" height={14} />
        </div>
      </div>
      <Skeleton width="50%" height={12} style={{ marginBottom: 8 }} />
      <Skeleton width="80%" height={11} />
    </div>
  )
}
