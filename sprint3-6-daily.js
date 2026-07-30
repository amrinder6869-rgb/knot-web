const fs = require('fs')
const path = require('path')
const https = require('https')

const BASE = 'C:\\Users\\amrin\\Documents\\knot-web'

function fetchRaw(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => resolve(data))
    }).on('error', reject)
  })
}

// ─── 1. Create API route: app/api/daily/create-room/route.ts ─────────────────

const dailyRoute = `import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.DAILY_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Daily API key not configured' }, { status: 500 })

  const { hangoutId } = await request.json()
  if (!hangoutId) return NextResponse.json({ error: 'Missing hangoutId' }, { status: 400 })

  try {
    const response = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${apiKey}\`,
      },
      body: JSON.stringify({
        name: \`knot-\${hangoutId}\`,
        properties: {
          enable_chat: true,
          enable_knocking: false,
          start_audio_off: false,
          start_video_off: false,
          exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
        },
      }),
    })

    if (!response.ok) {
      const err = await response.json()
      // Room may already exist — fetch it instead
      if (err.error === 'invalid-request-error' && err.info?.includes('already exists')) {
        const existing = await fetch(\`https://api.daily.co/v1/rooms/knot-\${hangoutId}\`, {
          headers: { 'Authorization': \`Bearer \${apiKey}\` },
        })
        const room = await existing.json()
        return NextResponse.json({ url: room.url })
      }
      return NextResponse.json({ error: 'Failed to create room' }, { status: 500 })
    }

    const room = await response.json()
    return NextResponse.json({ url: room.url })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create room' }, { status: 500 })
  }
}
`

const dailyDir = path.join(BASE, 'app', 'api', 'daily', 'create-room')
fs.mkdirSync(dailyDir, { recursive: true })
fs.writeFileSync(path.join(dailyDir, 'route.ts'), dailyRoute, 'utf8')
console.log('CREATED: app/api/daily/create-room/route.ts')

// ─── 2. Create DailyCall component ───────────────────────────────────────────

const dailyCallComponent = `'use client'

import { useEffect, useState } from 'react'
import DailyIframe from '@daily-co/daily-js'

interface DailyCallProps {
  roomUrl: string
  onLeave: () => void
}

export function DailyCall({ roomUrl, onLeave }: DailyCallProps) {
  const [joined, setJoined] = useState(false)
  const [frame, setFrame] = useState<any>(null)

  useEffect(() => {
    const callFrame = DailyIframe.createFrame(
      document.getElementById('daily-call-container')!,
      {
        iframeStyle: {
          width: '100%',
          height: '100%',
          border: 'none',
          borderRadius: '12px',
        },
        showLeaveButton: false,
        showFullscreenButton: true,
      }
    )

    callFrame
      .join({ url: roomUrl })
      .then(() => setJoined(true))
      .catch((err: any) => console.error('Daily join error:', err))

    callFrame.on('left-meeting', () => {
      callFrame.destroy()
      onLeave()
    })

    setFrame(callFrame)

    return () => {
      callFrame.destroy()
    }
  }, [roomUrl])

  function leaveCall() {
    if (frame) frame.leave()
    else onLeave()
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        id="daily-call-container"
        style={{
          width: '100%',
          height: 320,
          borderRadius: 12,
          overflow: 'hidden',
          background: '#111',
          marginBottom: 10,
        }}
      />
      <button
        onClick={leaveCall}
        style={{
          width: '100%',
          padding: '9px',
          background: 'rgba(239,68,68,0.15)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 8,
          color: '#f87171',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        Leave call
      </button>
    </div>
  )
}
`

fs.writeFileSync(path.join(BASE, 'components', 'DailyCall.tsx'), dailyCallComponent, 'utf8')
console.log('CREATED: components/DailyCall.tsx')

// ─── 3. Patch Composer — auto-create Daily room when Online selected ──────────

async function patchComposer() {
  const url = 'https://raw.githubusercontent.com/amrinder6869-rgb/knot-web/master/components/Composer.tsx'
  console.log('Fetching Composer.tsx...')
  let src = await fetchRaw(url)
  if (!src.includes("'use client'")) { console.log('ERROR: bad fetch'); process.exit(1) }

  // Add creatingRoom state after meetingUrl state
  src = src.replace(
    `  const [meetingUrl, setMeetingUrl] = useState('')`,
    `  const [meetingUrl, setMeetingUrl] = useState('')\n  const [creatingRoom, setCreatingRoom] = useState(false)`
  )

  // Add createDailyRoom function before postHangout
  const createRoomFn = `
  async function createDailyRoom(hangoutId: string): Promise<string | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return null
      const res = await fetch('/api/daily/create-room', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + session.access_token,
        },
        body: JSON.stringify({ hangoutId }),
      })
      const data = await res.json()
      return data.url || null
    } catch {
      return null
    }
  }

`
  src = src.replace(
    `  async function postHangout() {`,
    `${createRoomFn}  async function postHangout() {`
  )

  // After hangout is inserted, if online create the Daily room and update meeting_url
  src = src.replace(
    `    if (hangoutInsertError || !h) {\n      setHangoutError('Could not create the hangout. Please try again.')\n      setCreating(false)\n      return\n    }`,
    `    if (hangoutInsertError || !h) {\n      setHangoutError('Could not create the hangout. Please try again.')\n      setCreating(false)\n      return\n    }\n\n    if (whereMode === 'online' && !meetingUrl.trim()) {\n      const dailyUrl = await createDailyRoom(h.id)\n      if (dailyUrl) {\n        await supabase.from('hangouts').update({ meeting_url: dailyUrl }).eq('id', h.id)\n      }\n    }`
  )

  // Replace the online UI block — remove manual paste, show auto-generate message
  src = src.replace(
    `            {whereMode === 'online' && (
              <div>
                <input
                  value={meetingUrl}
                  onChange={e => setMeetingUrl(e.target.value)}
                  placeholder="Paste a Zoom, Meet, or FaceTime link (optional)"
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 6 }}
                />
                <button onClick={() => { setWhereMode('none'); setMeetingUrl('') }} style={{ width: '100%', padding: '8px', background: 'transparent', border: '1px dashed var(--border2)', borderRadius: 8, color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Cancel
                </button>
              </div>
            )}`,
    `            {whereMode === 'online' && (
              <div>
                <div style={{ padding: '10px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, marginBottom: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Video call included</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>A Daily.co room will be created automatically. Members join directly inside the app.</div>
                </div>
                <button onClick={() => { setWhereMode('none'); setMeetingUrl('') }} style={{ width: '100%', padding: '8px', background: 'transparent', border: '1px dashed var(--border2)', borderRadius: 8, color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Cancel
                </button>
              </div>
            )}`
  )

  fs.writeFileSync(path.join(BASE, 'components', 'Composer.tsx'), src, 'utf8')
  console.log('UPDATED: components/Composer.tsx')
}

// ─── 4. Patch HangoutCard — embed DailyCall in live state ───────────────────

async function patchHangoutCard() {
  const url = 'https://raw.githubusercontent.com/amrinder6869-rgb/knot-web/master/components/HangoutCard.tsx'
  console.log('Fetching HangoutCard.tsx...')
  let src = await fetchRaw(url)
  if (!src.includes("'use client'")) { console.log('ERROR: bad fetch'); process.exit(1) }

  // Add DailyCall import
  src = src.replace(
    `import { PreOrderCard } from '@/components/PreOrderCard'`,
    `import { PreOrderCard } from '@/components/PreOrderCard'\nimport { DailyCall } from '@/components/DailyCall'`
  )

  // Add showDailyCall state
  src = src.replace(
    `  const [livePhotoPosted, setLivePhotoPosted] = useState(false)`,
    `  const [livePhotoPosted, setLivePhotoPosted] = useState(false)\n  const [showDailyCall, setShowDailyCall] = useState(false)`
  )

  // Replace the existing Join call link with a button that opens the embedded call
  src = src.replace(
    `        {hangout.meeting_url && (isConfirmed || isLive) && (
          <a href={hangout.meeting_url} target="_blank" rel="noreferrer" style={{ padding: '8px 14px', background: isLive ? 'rgba(74,222,128,0.15)' : 'var(--sage-soft)', border: \`1px solid \${isLive ? 'rgba(74,222,128,0.3)' : 'var(--sage-dim)'}\`, borderRadius: 8, color: isLive ? '#4ade80' : 'var(--sage)', fontSize: 12, fontWeight: 700, textDecoration: 'none', fontFamily: 'inherit' }}>Join call</a>
        )}`,
    `        {hangout.meeting_url && (isConfirmed || isLive) && (
          <button onClick={() => setShowDailyCall(true)} style={{ padding: '8px 14px', background: isLive ? 'rgba(74,222,128,0.15)' : 'var(--sage-soft)', border: \`1px solid \${isLive ? 'rgba(74,222,128,0.3)' : 'var(--sage-dim)'}\`, borderRadius: 8, color: isLive ? '#4ade80' : 'var(--sage)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Join call</button>
        )}`
  )

  // Add DailyCall embed in live state — insert before the live photo nudge section
  src = src.replace(
    `      {isLive && !isCancelled && !livePhotoPosted && (`,
    `      {isLive && showDailyCall && hangout.meeting_url && (
        <DailyCall
          roomUrl={hangout.meeting_url}
          onLeave={() => setShowDailyCall(false)}
        />
      )}

      {isLive && !isCancelled && !livePhotoPosted && (`
  )

  // Add brief state and functions if missing (from Sprint 3)
  if (!src.includes('memberBriefs')) {
    src = src.replace(
      `  const [livePhotoPosted, setLivePhotoPosted] = useState(false)`,
      `  const [livePhotoPosted, setLivePhotoPosted] = useState(false)\n  const [memberBriefs, setMemberBriefs] = useState<any[]>([])\n  const [myBriefNote, setMyBriefNote] = useState('')\n  const [briefSubmitting, setBriefSubmitting] = useState(false)\n  const [myBriefId, setMyBriefId] = useState<string | null>(null)`
    )
  }

  if (!src.includes('handleLivePhotoUpload')) {
    src = src.replace(
      `  if (!hangout) return null`,
      `  async function handleLivePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !currentUser) return
    try {
      const compressed = await compressImage(file)
      const ext = compressed.name.split('.').pop()
      const storagePath = \`moments/\${knotId}/\${hangout.id}/\${Date.now()}.\${ext}\`
      const { error: uploadError } = await supabase.storage.from('knot-photos').upload(storagePath, compressed)
      if (uploadError) return
      await supabase.from('photos').insert({ knot_id: knotId, hangout_id: hangout.id, uploaded_by: currentUser.id, storage_path: storagePath, caption: \`Live from \${hangout.venue_name || hangout.title}\` })
      await supabase.from('posts').insert({ knot_id: knotId, hangout_id: hangout.id, author_id: currentUser.id, content: \`Capturing the night at \${hangout.venue_name || hangout.title}\`, post_type: 'moment' })
      setLivePhotoPosted(true)
      onRefresh()
    } catch (err) { console.error('Live photo error:', err) }
  }

  if (!hangout) return null`
    )
  }

  fs.writeFileSync(path.join(BASE, 'components', 'HangoutCard.tsx'), src, 'utf8')
  console.log('UPDATED: components/HangoutCard.tsx')
}

async function main() {
  await patchComposer()
  await patchHangoutCard()
  console.log('\nAll done. Now run:')
  console.log('npm install @daily-co/daily-js')
  console.log('npm run build')
}

main().catch(console.error)
