'use client'

import { useEffect, useRef, useState } from 'react'
import DailyIframe from '@daily-co/daily-js'

interface DailyCallProps {
  roomUrl: string
  onLeave: () => void
}

export function DailyCall({ roomUrl, onLeave }: DailyCallProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<ReturnType<typeof DailyIframe.createFrame> | null>(null)
  const onLeaveRef = useRef(onLeave)
  onLeaveRef.current = onLeave
  const [joined, setJoined] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const el = containerRef.current
    if (!el || !roomUrl) return

    let destroyed = false
    setError('')
    setJoined(false)

    let callFrame: ReturnType<typeof DailyIframe.createFrame>
    try {
      callFrame = DailyIframe.createFrame(el, {
        iframeStyle: {
          width: '100%',
          height: '100%',
          border: 'none',
          borderRadius: '12px',
        },
        showLeaveButton: false,
        showFullscreenButton: true,
      })
    } catch (err: any) {
      setError(err?.message || 'Could not start the call frame.')
      return
    }

    frameRef.current = callFrame

    callFrame
      .join({ url: roomUrl })
      .then(() => {
        if (!destroyed) setJoined(true)
      })
      .catch((err: any) => {
        console.error('Daily join error:', err)
        if (!destroyed) {
          setError(err?.errorMsg || err?.message || 'Could not join the call. Try opening the link instead.')
        }
      })

    const onLeft = () => {
      try { callFrame.destroy() } catch { /* already destroyed */ }
      frameRef.current = null
      onLeaveRef.current()
    }
    callFrame.on('left-meeting', onLeft)

    return () => {
      destroyed = true
      try {
        callFrame.off('left-meeting', onLeft)
        callFrame.destroy()
      } catch { /* already destroyed */ }
      frameRef.current = null
    }
  }, [roomUrl])

  function leaveCall() {
    const frame = frameRef.current
    if (frame) {
      frame.leave().catch(() => onLeaveRef.current())
    } else {
      onLeaveRef.current()
    }
  }

  return (
    <div style={{ marginBottom: 16 }}>
      {error && (
        <div className="error-banner" style={{ marginBottom: 10 }}>
          {error}{' '}
          <a href={roomUrl} target="_blank" rel="noreferrer" style={{ color: 'inherit', fontWeight: 700 }}>
            Open call link
          </a>
        </div>
      )}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: 320,
          borderRadius: 12,
          overflow: 'hidden',
          background: '#111',
          marginBottom: 10,
          display: error && !joined ? 'none' : 'block',
        }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <a
          href={roomUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            flex: 1,
            padding: '9px',
            textAlign: 'center',
            background: 'var(--bg3)',
            border: '1px solid var(--border2)',
            borderRadius: 8,
            color: 'var(--text2)',
            fontSize: 13,
            fontWeight: 600,
            textDecoration: 'none',
            fontFamily: 'inherit',
          }}
        >
          Open in new tab
        </a>
        <button
          onClick={leaveCall}
          style={{
            flex: 1,
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
          {joined ? 'Leave call' : 'Close'}
        </button>
      </div>
    </div>
  )
}
