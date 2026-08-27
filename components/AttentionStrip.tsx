'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ICON_SIZE } from '@/lib/constants'
import { isUpcomingHangout } from '@/lib/hangoutPhase'
import {
  ATTENTION_STRIP_HEADER,
  EMPTY_TODO,
  TODO_RSVP_ACTION,
  TODO_VOTE_ACTION,
  TODO_SETTLE_ACTION,
  TODO_RSVP_SUB,
} from '@/lib/copy'

export type OpenChatOpts = {
  hangoutId: string
  scrollToBottom?: boolean
  scrollTarget?: 'poll' | 'bill' | null
  autoJoinCall?: boolean
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

export default function AttentionStrip({
  currentUser,
  knots,
  onOpenChat,
}: {
  currentUser: any
  knots: any[]
  onOpenChat: (opts: OpenChatOpts) => void
}) {
  const [items, setItems] = useState<AttentionItem[]>([])
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    if (!currentUser?.id || knots.length === 0) { setItems([]); setLoaded(true); return }
    const knotIds = knots.map((k: any) => k.id).filter(Boolean)
    if (knotIds.length === 0) { setItems([]); setLoaded(true); return }

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
        .eq('user_id', currentUser.id)
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
          .eq('user_id', currentUser.id)
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
        .eq('user_id', currentUser.id)
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

    setItems(next)
    setLoaded(true)
  }, [currentUser, knots])

  useEffect(() => { load() }, [load])

  if (!loaded) return null

  if (items.length === 0) {
    return (
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>{EMPTY_TODO}</div>
    )
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {ATTENTION_STRIP_HEADER}
        </span>
        <span style={{ padding: '1px 7px', borderRadius: 20, background: 'var(--yellow)', color: '#111', fontSize: 10, fontWeight: 700 }}>{items.length}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
        {items.map(item => (
          <div key={item.key} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: '#fff', border: '1px solid var(--border)', borderRadius: 10, minWidth: 200 }}>
            <i className={`ti ${item.icon}`} style={{ fontSize: ICON_SIZE.card, color: 'var(--text3)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>{item.sub}</div>
            </div>
            <button
              type="button"
              onClick={() => onOpenChat({
                hangoutId: item.hangoutId,
                scrollToBottom: item.kind === 'rsvp' ? true : false,
                scrollTarget: item.scrollTarget || null,
              })}
              style={{ padding: '5px 10px', background: 'var(--yellow)', border: 'none', borderRadius: 6, color: '#111', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
            >
              {item.action}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
