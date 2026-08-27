'use client'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { notifyKnotMembers } from '@/lib/notifications'
import { compressImage } from '@/lib/compressImage'
import { useToast } from '@/components/ToastProvider'
import { getRandom, COMPOSER_PLACEHOLDER, PLAN_UNTITLED, TOAST_ERROR } from '@/lib/copy'
import { ICON_SIZE } from '@/lib/constants'
import { track } from '@/lib/track'

export default function Composer({
  knotId,
  currentUser,
  members,
  onPosted,
  onOpenChat,
}: {
  knotId: string
  currentUser: any
  members: any[]
  onPosted: () => void
  onOpenChat: (hangoutId: string) => void
}) {
  const toast = useToast()
  const [momentPlaceholder] = useState(() => getRandom(COMPOSER_PLACEHOLDER))

  const [quickBillDesc, setQuickBillDesc]   = useState('')
  const [quickBillAmount, setQuickBillAmount] = useState('')
  const [quickBillSelectedIds, setQuickBillSelectedIds] = useState<Set<string>>(new Set())
  const [quickBillPosting, setQuickBillPosting] = useState(false)
  const [quickBillError, setQuickBillError] = useState('')

  const [momentText, setMomentText] = useState('')
  const [posting, setPosting]       = useState(false)
  const [momentPhoto, setMomentPhoto]               = useState<File | null>(null)
  const [momentPhotoPreview, setMomentPhotoPreview] = useState<string | null>(null)
  const [momentMediaType, setMomentMediaType] = useState<'image' | 'video'>('image')
  const [momentError, setMomentError] = useState('')
  const momentPhotoInputRef = useRef<HTMLInputElement>(null)

  const [creating, setCreating] = useState(false)
  const [inputText, setInputText] = useState('')
  const [sheet, setSheet] = useState<null | 'plus' | 'moment' | 'bill'>(null)

  useEffect(() => {
    if (sheet === 'bill' && quickBillSelectedIds.size === 0 && members.length > 0) {
      setQuickBillSelectedIds(new Set(members.map(m => m.id)))
    }
  }, [sheet, quickBillSelectedIds.size, members])

  function toggleQuickBillMember(id: string) {
    setQuickBillSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleMomentPhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 100 * 1024 * 1024) {
      setMomentError('File is too large. Maximum size is 100 MB.')
      return
    }
    const isVideo = file.type.startsWith('video/')
    setMomentMediaType(isVideo ? 'video' : 'image')
    setMomentPhoto(file)
    setMomentPhotoPreview(URL.createObjectURL(file))
  }

  async function postMoment(textOverride?: string) {
    const text = (textOverride ?? momentText).trim()
    if ((!text && !momentPhoto) || posting) return
    setPosting(true)
    setMomentError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setMomentError('You need to be signed in to post.'); setPosting(false); return }

    const { data: newPost, error: postError } = await supabase.from('posts').insert({
      knot_id: knotId,
      author_id: user.id,
      content: text || null,
      post_type: 'moment',
    }).select().single()

    if (postError || !newPost) {
      setMomentError('Could not post. Please try again.')
      setPosting(false)
      return
    }

    if (momentPhoto) {
      const isVideo = momentMediaType === 'video'
      const uploadFile = isVideo ? momentPhoto : await compressImage(momentPhoto)
      const ext = uploadFile.name.split('.').pop()
      const storagePath = `${knotId}/${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`
      const { error: uploadError } = await supabase.storage.from('knot-photos').upload(storagePath, uploadFile)
      if (uploadError) {
        setMomentError('Post shared, but the media failed to upload.')
      } else {
        const { error: photoInsertError } = await supabase.from('photos').insert({
          knot_id:      knotId,
          post_id:      newPost.id,
          uploaded_by:  user.id,
          storage_path: storagePath,
          file_name:    uploadFile.name,
          file_size:    uploadFile.size,
          media_type:   momentMediaType,
        })
        if (photoInsertError) setMomentError('Post shared, but the media failed to save.')
      }
    }

    const actorName = currentUser?.name || 'Someone'
    await notifyKnotMembers({
      knotId,
      actorId: user.id,
      type: 'new_moment',
      message: `${actorName} posted${text ? `: "${text.substring(0, 60)}"` : ' a photo'}`,
    })

    setPosting(false)
    setMomentMediaType('image')
    setMomentText('')
    setMomentPhoto(null)
    setMomentPhotoPreview(null)
    setMomentError('')
    setInputText('')
    if (momentPhotoInputRef.current) momentPhotoInputRef.current.value = ''
    onPosted()
  }

  async function postQuickBill() {
    if (!quickBillDesc.trim() || !quickBillAmount || quickBillPosting) return
    const amount = parseFloat(quickBillAmount)
    if (isNaN(amount) || amount <= 0) { setQuickBillError('Enter a valid amount.'); return }
    const splitIds = Array.from(quickBillSelectedIds)
    if (splitIds.length === 0) { setQuickBillError('Select at least one person to split with.'); return }
    setQuickBillPosting(true)
    setQuickBillError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setQuickBillError('You need to be signed in to add a bill.'); setQuickBillPosting(false); return }

    const share = amount / splitIds.length
    const { data: bill, error } = await supabase.from('bills').insert({
      knot_id: knotId, added_by: user.id, total_amount: amount,
      description: quickBillDesc.trim(), split_type: 'equal',
    }).select().single()
    if (error || !bill) { setQuickBillError('Could not add the bill.'); setQuickBillPosting(false); return }

    const splits = splitIds.map((uid: string) => ({ bill_id: bill.id, user_id: uid, amount: parseFloat(share.toFixed(2)), settled: uid === user.id }))
    const { error: splitError } = await supabase.from('bill_splits').insert(splits)
    if (splitError) { setQuickBillError('Bill added, but the split failed to save.'); setQuickBillPosting(false); return }

    await supabase.from('posts').insert({
      knot_id: knotId,
      author_id: user.id,
      content: `added a bill — $${amount.toFixed(2)} for ${quickBillDesc.trim()}, split ${splitIds.length} ways`,
      post_type: 'bill',
    })

    toast.success('Bill added and split with the group.')
    setQuickBillPosting(false)
    setQuickBillDesc('')
    setQuickBillAmount('')
    setQuickBillSelectedIds(new Set())
    onPosted()
  }

  async function startPlan() {
    if (creating) return
    const { data: sessionData } = await supabase.auth.getUser()
    const userId = currentUser?.id || sessionData.user?.id
    if (!knotId || !userId) {
      toast.error(TOAST_ERROR)
      return
    }
    setCreating(true)
    setSheet(null)
    const actorName = currentUser?.name || 'Someone'
    const pInput: Record<string, any> = {
      knot_id:            knotId,
      title:               PLAN_UNTITLED,
      type:                'planned',
      scheduled_for:       null,
      venue_name:          null,
      venue_address:       null,
      venue_place_id:      null,
      venue_lat:           null,
      venue_lng:           null,
      venue_category:      null,
      venue_maps_url:      null,
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
      poll_title:          PLAN_UNTITLED,
      is_standalone:       false,
      post_content:        `${actorName} started a plan`,
      post_type:           'hangout',
    }
    try {
      const { data, error } = await supabase.rpc('create_hangout', { p_input: pInput })
      console.log('[create_hangout] startPlan response', { data, error, pInput })
      if (error || !data || data.error) {
        console.error('[startPlan] rpc failed', { error, data })
        toast.error(TOAST_ERROR)
        return
      }
      const newHangoutId = data.hangout_id as string
      if (!newHangoutId) {
        toast.error(TOAST_ERROR)
        return
      }
      const { error: statusError } = await supabase
        .from('hangouts')
        .update({ planning_status: 'voting', title: PLAN_UNTITLED })
        .eq('id', newHangoutId)
      if (statusError) {
        console.warn('[startPlan] planning_status update failed', statusError)
      }
      track(supabase, 'hangout_created', {
        hangout_id: newHangoutId,
        type: 'planned',
        has_venue: false,
        poll_mode: false,
      }, knotId)
      onOpenChat(newHangoutId)
      setInputText('')
      onPosted()
    } catch (err) {
      console.error('[startPlan] failed', err)
      toast.error(TOAST_ERROR)
    } finally {
      setCreating(false)
    }
  }

  function submitFromBar() {
    if (inputText.trim()) {
      postMoment(inputText)
      return
    }
    setSheet('moment')
  }

  const userName  = currentUser?.name || 'You'
  const userInitials = userName.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()

  const btnYellow: React.CSSProperties = {
    background: 'var(--yellow)', border: 'none', borderRadius: 10,
    color: '#111', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
    padding: '11px 0', width: '100%', cursor: 'pointer',
  }

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, marginBottom: 20, overflow: 'hidden' }}>
      <div style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', borderTop: '0.5px solid var(--border)', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--yellow)', color: '#111', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {userInitials}
        </div>
        <button type="button" onClick={() => setSheet('plus')} aria-label="More options"
          style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--bg3)', border: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' }}>
          <i className="ti ti-plus" style={{ fontSize: ICON_SIZE.nav, color: 'var(--text3)' }} />
        </button>
        <input
          className="composer-input"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && inputText.trim()) postMoment(inputText) }}
          placeholder={momentPlaceholder}
          style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 20, padding: '8px 14px', fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: 'inherit', caretColor: 'var(--yellow)' }}
        />
        <button
          type="button"
          onClick={submitFromBar}
          style={{ width: 34, height: 34, borderRadius: '50%', background: inputText.trim() ? 'var(--yellow)' : 'var(--bg3)', border: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
          aria-label="Post">
          <i className="ti ti-send" style={{ fontSize: ICON_SIZE.nav, color: '#111' }} />
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, padding: '2px 12px 10px', borderTop: '0.5px solid var(--border)' }}>
        <button type="button" onClick={() => setSheet('moment')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
          <i className="ti ti-camera" style={{ fontSize: ICON_SIZE.inline, color: 'var(--text3)' }} /> Moment
        </button>
        <button type="button" onClick={startPlan} disabled={creating}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20, border: '1px solid var(--yellow-dim)', background: 'var(--yellow-soft)', color: 'var(--yellow)', fontSize: 12, fontWeight: 700, cursor: creating ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: creating ? 0.6 : 1 }}>
          <i className="ti ti-calendar" style={{ fontSize: ICON_SIZE.inline, color: 'var(--yellow)' }} /> {creating ? 'Starting…' : 'Plan a hangout'}
        </button>
        <button type="button" onClick={() => setSheet('bill')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
          <i className="ti ti-receipt" style={{ fontSize: ICON_SIZE.inline, color: 'var(--text3)' }} /> Bill
        </button>
      </div>

      {sheet === 'plus' && (
        <>
          <div onClick={() => setSheet(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#fff', borderRadius: '16px 16px 0 0', boxShadow: '0 -8px 32px rgba(0,0,0,0.18)', zIndex: 201, padding: '10px 16px calc(16px + env(safe-area-inset-bottom, 0px))', maxWidth: 480, margin: '0 auto' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)', margin: '4px auto 12px' }} />
            {[
              { icon: 'ti-camera', label: 'Moment', onClick: () => setSheet('moment') },
              { icon: 'ti-calendar', label: 'Plan a hangout', onClick: () => { void startPlan() } },
              { icon: 'ti-receipt', label: 'Bill', onClick: () => setSheet('bill') },
              { icon: 'ti-world', label: 'Online hangout', onClick: () => { void startPlan() } },
              { icon: 'ti-broadcast', label: 'Live join-in', onClick: () => { void startPlan() } },
            ].map(item => (
              <div key={item.label} onClick={item.onClick}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px', cursor: 'pointer', fontFamily: 'inherit' }}>
                <i className={`ti ${item.icon}`} style={{ fontSize: ICON_SIZE.nav, color: 'var(--text3)' }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{item.label}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {sheet === 'moment' && (
        <>
          <div onClick={() => setSheet(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#fff', borderRadius: '16px 16px 0 0', boxShadow: '0 -8px 32px rgba(0,0,0,0.18)', zIndex: 201, padding: '16px 16px calc(16px + env(safe-area-inset-bottom, 0px))', maxWidth: 480, margin: '0 auto', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)', margin: '4px auto 12px' }} />
            {momentError && <div className="error-banner" style={{ marginBottom: 10 }}>{momentError}</div>}
            {momentPhotoPreview && (
              <div style={{ position: 'relative', marginBottom: 10, borderRadius: 10, overflow: 'hidden', aspectRatio: '4/5', background: '#000', maxWidth: 320 }}>
                {momentMediaType === 'video'
                  ? <video src={momentPhotoPreview} controls style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  : <img src={momentPhotoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                <button type="button" onClick={() => { setMomentPhoto(null); setMomentPhotoPreview(null); setMomentMediaType('image'); if (momentPhotoInputRef.current) momentPhotoInputRef.current.value = '' }}
                  style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>×</button>
              </div>
            )}
            <textarea value={momentText} onChange={e => setMomentText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) postMoment() }}
              placeholder={momentPlaceholder} autoFocus rows={3}
              style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 10, padding: '10px 12px', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', resize: 'vertical' as const, marginBottom: 10, lineHeight: 1.5, boxSizing: 'border-box' as const }} />
            <input type="file" accept="image/*,video/*" ref={momentPhotoInputRef} onChange={handleMomentPhotoSelect} style={{ display: 'none' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => momentPhotoInputRef.current?.click()} style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 10, color: 'var(--text2)', fontFamily: 'inherit', fontSize: 12, fontWeight: 500, padding: '9px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="ti ti-camera" style={{ fontSize: ICON_SIZE.inline, color: 'var(--text3)' }} /> {momentPhoto ? 'Change' : 'Add photo'}
              </button>
              <button type="button" onClick={async () => { await postMoment(); setSheet(null) }} disabled={(!momentText.trim() && !momentPhoto) || posting}
                style={{ ...btnYellow, width: 'auto', flex: 1, opacity: (!momentText.trim() && !momentPhoto) || posting ? 0.5 : 1 }}>
                {posting ? 'Posting…' : 'Post'}
              </button>
            </div>
          </div>
        </>
      )}

      {sheet === 'bill' && (
        <>
          <div onClick={() => setSheet(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#fff', borderRadius: '16px 16px 0 0', boxShadow: '0 -8px 32px rgba(0,0,0,0.18)', zIndex: 201, padding: '16px 16px calc(16px + env(safe-area-inset-bottom, 0px))', maxWidth: 480, margin: '0 auto', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)', margin: '4px auto 12px' }} />
            {quickBillError && <div className="error-banner" style={{ marginBottom: 8 }}>{quickBillError}</div>}
            <input value={quickBillDesc} onChange={e => setQuickBillDesc(e.target.value)} placeholder="What was the bill for?"
              style={{ width: '100%', padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const, marginBottom: 8 }} />
            <input type="number" value={quickBillAmount} onChange={e => setQuickBillAmount(e.target.value)} placeholder="Total amount ($)"
              style={{ width: '100%', padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const, marginBottom: 10 }} />
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Split with</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto', marginBottom: 10 }}>
              {members.map(m => {
                const checked = quickBillSelectedIds.has(m.id)
                return (
                  <div key={m.id} onClick={() => toggleQuickBillMember(m.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: checked ? 'var(--yellow-soft)' : 'var(--bg3)', border: `1px solid ${checked ? 'var(--yellow)' : 'var(--border2)'}`, cursor: 'pointer' }}>
                    <div style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${checked ? 'var(--yellow)' : 'var(--border2)'}`, background: checked ? 'var(--yellow)' : 'transparent', color: '#111', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {checked && <i className="ti ti-check" style={{ fontSize: 11, color: '#111' }} />}
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text)' }}>{m.name}</span>
                  </div>
                )
              })}
            </div>
            {quickBillAmount && !isNaN(parseFloat(quickBillAmount)) && quickBillSelectedIds.size > 0 && (
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>
                ${(parseFloat(quickBillAmount) / quickBillSelectedIds.size).toFixed(2)} each, split {quickBillSelectedIds.size} ways
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => { setSheet(null); setQuickBillError('') }} style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 10, color: 'var(--text2)', fontFamily: 'inherit', fontSize: 12, fontWeight: 500, padding: '9px 14px', cursor: 'pointer' }}>Cancel</button>
              <button type="button" onClick={async () => { await postQuickBill(); setSheet(null) }} disabled={!quickBillDesc.trim() || !quickBillAmount || quickBillSelectedIds.size === 0 || quickBillPosting}
                style={{ flex: 1, padding: '10px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: !quickBillDesc.trim() || !quickBillAmount || quickBillSelectedIds.size === 0 || quickBillPosting ? 0.5 : 1 }}>
                {quickBillPosting ? 'Posting…' : 'Post bill'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
