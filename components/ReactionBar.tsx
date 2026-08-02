'use client'

import { useEffect, useRef, useState } from 'react'
import { SmilePlus } from 'lucide-react'
import {
  REACTION_EMOJIS,
  type ReactionCount,
  normalizeReactionEmoji,
} from '@/lib/reactions'

type ReactionBarProps = {
  reactions: ReactionCount[]
  onToggle: (emoji: string) => void
  compact?: boolean
  dark?: boolean
  disabled?: boolean
}

export default function ReactionBar({
  reactions,
  onToggle,
  compact = false,
  dark = false,
  disabled = false,
}: ReactionBarProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const chipBg = (mine: boolean) =>
    mine
      ? dark ? 'rgba(248,189,3,0.18)' : 'var(--yellow-dim)'
      : dark ? 'rgba(255,255,255,0.06)' : 'var(--bg3)'
  const chipBorder = (mine: boolean) =>
    mine
      ? 'var(--yellow)'
      : dark ? 'rgba(255,255,255,0.12)' : 'var(--border2)'
  const muted = dark ? 'rgba(255,255,255,0.55)' : 'var(--text3)'
  const text = dark ? 'rgba(255,255,255,0.9)' : 'var(--text)'

  const pad = compact ? '2px 7px' : '4px 10px'
  const fontSize = compact ? 11 : 12

  return (
    <div ref={rootRef} style={{ display: 'inline-flex', gap: 5, flexWrap: 'wrap', alignItems: 'center', position: 'relative' }}>
      {reactions.map(r => (
        <button
          key={r.e}
          type="button"
          disabled={disabled}
          onClick={() => onToggle(r.e)}
          aria-pressed={r.mine}
          aria-label={`React ${normalizeReactionEmoji(r.e)}`}
          style={{
            padding: pad,
            borderRadius: 999,
            background: chipBg(r.mine),
            border: `1px solid ${chipBorder(r.mine)}`,
            color: text,
            fontSize,
            cursor: disabled ? 'default' : 'pointer',
            fontFamily: 'inherit',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            opacity: disabled ? 0.6 : 1,
          }}
        >
          <span style={{ lineHeight: 1 }}>{normalizeReactionEmoji(r.e)}</span>
          <span style={{ fontWeight: r.mine ? 700 : 500 }}>{r.n}</span>
        </button>
      ))}

      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        aria-label="Add reaction"
        aria-expanded={open}
        style={{
          padding: compact ? '2px 7px' : '4px 8px',
          borderRadius: 999,
          background: open
            ? (dark ? 'rgba(248,189,3,0.18)' : 'var(--yellow-soft)')
            : (dark ? 'rgba(255,255,255,0.06)' : 'var(--bg3)'),
          border: `1px solid ${open ? 'var(--yellow)' : (dark ? 'rgba(255,255,255,0.12)' : 'var(--border2)')}`,
          color: open ? 'var(--yellow)' : muted,
          fontSize,
          cursor: disabled ? 'default' : 'pointer',
          fontFamily: 'inherit',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <SmilePlus size={compact ? 12 : 14} strokeWidth={2} />
        {!compact && reactions.length === 0 ? 'React' : null}
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Choose reaction"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: 0,
            zIndex: 50,
            display: 'flex',
            gap: 2,
            padding: 6,
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
          }}
        >
          {REACTION_EMOJIS.map(emoji => {
            const mine = !!reactions.find(r => r.e === emoji && r.mine)
            return (
              <button
                key={emoji}
                type="button"
                role="option"
                aria-selected={mine}
                onClick={() => {
                  onToggle(emoji)
                  setOpen(false)
                }}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  border: mine ? '1px solid var(--yellow)' : '1px solid transparent',
                  background: mine ? 'var(--yellow-soft)' : 'transparent',
                  cursor: 'pointer',
                  fontSize: 18,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'inherit',
                }}
              >
                {emoji}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
