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
  const [joined, setJoined] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    onLeaveRef.current = onLeave
  }, [onLeave])

  useEffect(() => {
    const el = containerRef.current
    if (!el || !roomUrl) return

    let destroyed = false
    let callFrame: ReturnType<typeof DailyIframe.createFrame> | null = null
    setError('')
    setJoined(false)

    // Destroy any leftover call instance for this page before creating a new one
    try {
      const existing = DailyIframe.getCallInstance?.()
      if (existing && !existing.isDestroyed?.()) {
        existing.destroy().catch(() => {})
      }
    } catch { /* ignore */ }

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

    const onLeft = () => {
      frameRef.current = null
      onLeaveRef.current()
    }

    const onError = (ev: any) => {
      const msg = ev?.errorMsg || ev?.error?.msg || ev?.message || ''
      // RTCRtpSender setParameters race is noisy but usually recovers; surface real join failures
      if (/does not exist/i.test(msg) || /not found/i.test(msg)) {
        if (!destroyed) setError(msg || 'The meeting room was not found.')
      }
    }

    callFrame.on('left-meeting', onLeft)
    callFrame.on('error', onError)

    // Small delay lets the iframe attach tracks before join — reduces RTCRtpSender races
    const joinTimer = window.setTimeout(() => {
      if (destroyed || !callFrame) return
      callFrame
        .join({ url: roomUrl })
        .then(() => {
          if (!destroyed) setJoined(true)
        })
        .catch((err: any) => {
          console.error('Daily join error:', err)
          if (!destroyed) {
            const msg = err?.errorMsg || err?.message || 'Could not join the call. Try opening the link instead.'
            setError(msg)
          }
        })
    }, 150)

    return () => {
      destroyed = true
      window.clearTimeout(joinTimer)
      const frame = callFrame
      callFrame = null
      frameRef.current = null
      if (!frame) return
      ;(async () => {
        try {
          frame.off('left-meeting', onLeft)
          frame.off('error', onError)
          if (!frame.isDestroyed?.()) {
            try { await frame.leave() } catch { /* already left */ }
            try { await frame.destroy() } catch { /* already destroyed */ }
          }
        } catch { /* ignore cleanup races */ }
      })()
    }
  }, [roomUrl])

  function leaveCall() {
    const frame = frameRef.current
    if (frame && !frame.isDestroyed?.()) {
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
