'use client'

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
