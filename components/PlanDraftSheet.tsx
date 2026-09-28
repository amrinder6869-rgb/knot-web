'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ToastProvider'
import DateTimePicker from '@/components/DateTimePicker'
import { ICON_SIZE } from '@/lib/constants'
import { track } from '@/lib/track'
import {
  getRandom,
  CHIP_WHEN,
  CHIP_WHERE,
  PLAN_DRAFT_HEADING,
  PLAN_DRAFT_PLACEHOLDER,
  PLAN_DRAFT_POST,
  PLAN_DRAFT_POSTING,
  PLAN_DRAFT_CHIP_DONE,
  PLAN_DRAFT_CHIP_CLEAR,
  PLAN_DRAFT_DISCARD_CONFIRM,
  PLAN_DRAFT_POST_CONTENT,
  PLAN_DRAFT_POST_CONTENT_AT,
  SHEET_EDIT_VENUE_PLACEHOLDER,
  SHEET_EDIT_ADDRESS_PLACEHOLDER,
  SHEET_CANCEL,
  TOAST_PLAN_POSTED,
  TOAST_ERROR,
} from '@/lib/copy'

// A venue handed in from Discover. Every field is optional so callers can
// prefill as much or as little as they have.
export type PlanDraftVenue = {
  name: string
  address?: string | null
  place_id?: string | null
  lat?: number | null
  lng?: number | null
  category?: string | null
  maps_url?: string | null
}

// The draft sheet is the only way a member starts a plan. Everything the
// user types stays in this component's state. The one and only database
// write is the create_hangout RPC inside postPlan, which runs when the
// user taps the post button. Cancel, backdrop, and Escape never write.
export default function PlanDraftSheet({
  knotId,
  currentUser,
  initialTitle = '',
  initialVenue = null,
  onClose,
  onPosted,
}: {
  knotId: string
  currentUser: any
  initialTitle?: string
  initialVenue?: PlanDraftVenue | null
  onClose: () => void
  onPosted: (hangoutId: string) => void
}) {
  const toast = useToast()
  const [placeholder] = useState(() => getRandom(PLAN_DRAFT_PLACEHOLDER))

  const [title, setTitle] = useState(initialTitle)
  const [when, setWhen] = useState<Date | null>(null)
  const [venueName, setVenueName] = useState(initialVenue?.name || '')
  const [venueAddress, setVenueAddress] = useState(initialVenue?.address || '')
  const [picker, setPicker] = useState<null | 'when' | 'where'>(null)
  const [posting, setPosting] = useState(false)

  const canPost = title.trim().length > 0 && !posting

  // Dirty means the user changed something beyond what the sheet opened
  // with. A Discover prefill on its own does not count, so closing an
  // untouched prefilled sheet asks nothing.
  const dirty =
    title.trim() !== (initialTitle || '').trim() ||
    when !== null ||
    venueName.trim() !== (initialVenue?.name || '').trim() ||
    venueAddress.trim() !== (initialVenue?.address || '').trim()

  function requestClose() {
    if (posting) return
    if (dirty && !window.confirm(PLAN_DRAFT_DISCARD_CONFIRM)) return
    onClose()
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        requestClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // requestClose reads the latest state through closure each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, posting])

  // Phone back gesture. Opening the sheet pushes one history entry, so
  // swiping back pops it and behaves exactly like Cancel: confirm only
  // when the draft was edited, and never write. If the user keeps the
  // draft, the entry is pushed again so the next swipe asks again. When
  // the sheet closes any other way, its entry is removed on unmount.
  const dirtyRef = useRef(dirty)
  const postingRef = useRef(posting)
  const onCloseRef = useRef(onClose)
  const closedByBackRef = useRef(false)
  useEffect(() => {
    dirtyRef.current = dirty
    postingRef.current = posting
    onCloseRef.current = onClose
  }, [dirty, posting, onClose])

  useEffect(() => {
    window.history.pushState({ knotPlanSheet: true }, '')
    function onPop() {
      if (postingRef.current || (dirtyRef.current && !window.confirm(PLAN_DRAFT_DISCARD_CONFIRM))) {
        window.history.pushState({ knotPlanSheet: true }, '')
        return
      }
      closedByBackRef.current = true
      onCloseRef.current()
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      if (!closedByBackRef.current && window.history.state?.knotPlanSheet) window.history.back()
    }
  }, [])

  async function postPlan() {
    if (!canPost) return
    const { data: sessionData } = await supabase.auth.getUser()
    const userId = currentUser?.id || sessionData.user?.id
    if (!knotId || !userId) {
      toast.error(TOAST_ERROR)
      return
    }
    setPosting(true)
    const actorName = currentUser?.name || 'Someone'
    const cleanTitle = title.trim()
    const cleanVenue = venueName.trim() || null
    const cleanAddress = venueAddress.trim() || null
    // Only keep the Discover place metadata if the user kept that venue name.
    const keepVenueMeta = !!initialVenue && cleanVenue === initialVenue.name.trim()
    const postContent = cleanVenue
      ? `${actorName} ${PLAN_DRAFT_POST_CONTENT_AT} ${cleanVenue}`
      : `${actorName} ${PLAN_DRAFT_POST_CONTENT}`

    const pInput: Record<string, any> = {
      knot_id:            knotId,
      title:               cleanTitle,
      type:                'planned',
      scheduled_for:       when ? when.toISOString() : null,
      venue_name:          cleanVenue,
      venue_address:       cleanAddress,
      venue_place_id:      keepVenueMeta ? initialVenue?.place_id ?? null : null,
      venue_lat:           keepVenueMeta ? initialVenue?.lat ?? null : null,
      venue_lng:           keepVenueMeta ? initialVenue?.lng ?? null : null,
      venue_category:      keepVenueMeta ? initialVenue?.category ?? null : null,
      venue_maps_url:      keepVenueMeta ? initialVenue?.maps_url ?? null : null,
      venue_booking_url:   null,
      meeting_url:         null,
      brief:               null,
      brief_vibe:          null,
      brief_budget:        null,
      movie_title:         null,
      movie_showtime:      null,
      event_restrictions:  [],
      invite_mode:         'all',
      is_surprise:         false,
      reveal_at:           null,
      poll_mode:           false,
      poll_title:          cleanTitle,
      is_standalone:       false,
      post_content:        postContent,
      post_type:           'hangout',
      // hangouts_planning_status_check allows planning|draft|locked|abandoned
      // (not 'voting' — that is hangouts.status). New plans start in planning.
      planning_status:     'planning',
    }

    try {
      const { data, error } = await supabase.rpc('create_hangout', { p_input: pInput })
      if (error || !data || data.error || !data.hangout_id) {
        console.error('[PlanDraftSheet] create_hangout failed', { error, data })
        toast.error(TOAST_ERROR)
        return
      }
      const newHangoutId = data.hangout_id as string
      track(supabase, 'hangout_created', {
        hangout_id: newHangoutId,
        type: 'planned',
        has_venue: !!cleanVenue,
        has_time: !!when,
        poll_mode: false,
      }, knotId)
      toast.success(getRandom(TOAST_PLAN_POSTED.pool, TOAST_PLAN_POSTED.rare))
      onPosted(newHangoutId)
    } catch (err) {
      console.error('[PlanDraftSheet] postPlan failed', err)
      toast.error(TOAST_ERROR)
    } finally {
      setPosting(false)
    }
  }

  const whenLabel = when
    ? `${when.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${when.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
    : CHIP_WHEN
  const whereLabel = venueName.trim() || CHIP_WHERE

  function chipStyle(filled: boolean, active: boolean): React.CSSProperties {
    return {
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: active ? 'var(--yellow-soft)' : '#fff',
      border: `1px ${filled ? 'solid' : 'dashed'} ${filled || active ? 'var(--yellow)' : 'rgba(248,189,3,0.45)'}`,
      borderRadius: 20, padding: '6px 12px', fontSize: 12, fontWeight: filled ? 600 : 500,
      color: filled ? 'var(--text)' : 'var(--text3)',
      cursor: 'pointer', fontFamily: 'inherit',
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 10,
    padding: '10px 12px', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit',
    boxSizing: 'border-box', marginBottom: 8,
  }

  const smallBtn: React.CSSProperties = {
    background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)',
    fontFamily: 'inherit', fontSize: 12, fontWeight: 600, padding: '7px 12px', cursor: 'pointer',
  }

  return (
    <>
      <div onClick={requestClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 600 }} />
      <div
        role="dialog"
        aria-label={PLAN_DRAFT_HEADING}
        style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#fff', borderRadius: '16px 16px 0 0', boxShadow: '0 -8px 32px rgba(0,0,0,0.18)', zIndex: 601, padding: '0 16px calc(16px + env(safe-area-inset-bottom, 0px))', maxWidth: 480, margin: '0 auto', maxHeight: '85vh', overflowY: 'auto', fontFamily: 'Manrope, sans-serif' }}
      >
        <div style={{ width: 36, height: 3, borderRadius: 100, background: 'rgba(0,0,0,0.12)', margin: '8px auto 0' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{PLAN_DRAFT_HEADING}</span>
          <button type="button" onClick={requestClose} aria-label="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <i className="ti ti-x" style={{ fontSize: 18, color: 'var(--text3)' }} />
          </button>
        </div>

        <textarea
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) postPlan() }}
          placeholder={placeholder}
          autoFocus
          rows={2}
          style={{ ...inputStyle, resize: 'none', lineHeight: 1.5, fontSize: 15, fontWeight: 600, marginBottom: 10 }}
        />

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: picker ? 10 : 14 }}>
          <button type="button" onClick={() => setPicker(p => (p === 'when' ? null : 'when'))} style={chipStyle(!!when, picker === 'when')}>
            <i className="ti ti-clock" style={{ fontSize: ICON_SIZE.inline }} /> {whenLabel}
          </button>
          <button type="button" onClick={() => setPicker(p => (p === 'where' ? null : 'where'))} style={chipStyle(!!venueName.trim(), picker === 'where')}>
            <i className="ti ti-map-pin" style={{ fontSize: ICON_SIZE.inline }} /> {whereLabel}
          </button>
        </div>

        {picker === 'when' && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 10, marginBottom: 14 }}>
            <DateTimePicker value={when} onChange={setWhen} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
              {when && (
                <button type="button" onClick={() => { setWhen(null); setPicker(null) }} style={smallBtn}>{PLAN_DRAFT_CHIP_CLEAR}</button>
              )}
              <button type="button" onClick={() => setPicker(null)} style={{ ...smallBtn, background: 'var(--yellow)', border: 'none', color: '#111' }}>{PLAN_DRAFT_CHIP_DONE}</button>
            </div>
          </div>
        )}

        {picker === 'where' && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 10, marginBottom: 14 }}>
            <input value={venueName} onChange={e => setVenueName(e.target.value)} placeholder={SHEET_EDIT_VENUE_PLACEHOLDER} autoFocus style={inputStyle} />
            <input value={venueAddress} onChange={e => setVenueAddress(e.target.value)} placeholder={SHEET_EDIT_ADDRESS_PLACEHOLDER} style={{ ...inputStyle, marginBottom: 0 }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
              {(venueName || venueAddress) && (
                <button type="button" onClick={() => { setVenueName(''); setVenueAddress(''); setPicker(null) }} style={smallBtn}>{PLAN_DRAFT_CHIP_CLEAR}</button>
              )}
              <button type="button" onClick={() => setPicker(null)} style={{ ...smallBtn, background: 'var(--yellow)', border: 'none', color: '#111' }}>{PLAN_DRAFT_CHIP_DONE}</button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={requestClose} disabled={posting}
            style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 10, color: 'var(--text2)', fontFamily: 'inherit', fontSize: 12, fontWeight: 500, padding: '9px 14px', cursor: 'pointer' }}>
            {SHEET_CANCEL}
          </button>
          <button type="button" onClick={postPlan} disabled={!canPost}
            style={{ flex: 1, padding: '11px 0', background: 'var(--yellow)', border: 'none', borderRadius: 10, color: '#111', fontSize: 13, fontWeight: 700, cursor: canPost ? 'pointer' : 'not-allowed', fontFamily: 'inherit', opacity: canPost ? 1 : 0.5 }}>
            {posting ? PLAN_DRAFT_POSTING : PLAN_DRAFT_POST}
          </button>
        </div>
      </div>
    </>
  )
}
