'use client'

import {
  Crown, Star, Wallet, Zap, Car,
  CalendarCheck, UtensilsCrossed, Camera, Music
} from 'lucide-react'
import { HangoutRoleType, ROLE_LABELS } from '@/types/roles'

const ROLE_ICON_MAP: Record<HangoutRoleType, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  master_planner: Crown,
  co_planner: Star,
  treasurer: Wallet,
  hype_person: Zap,
  ride_coordinator: Car,
  table_booker: CalendarCheck,
  food_orderer: UtensilsCrossed,
  photographer: Camera,
  playlist_curator: Music,
}

// Using hardcoded colors that match the Knot design system
const ROLE_STYLES: Record<HangoutRoleType, { bg: string; text: string; border: string }> = {
  master_planner: { bg: 'rgba(234,179,8,0.15)', text: '#EAB308', border: 'rgba(234,179,8,0.35)' },
  co_planner:     { bg: 'rgba(234,179,8,0.08)', text: '#EAB308', border: 'rgba(234,179,8,0.2)' },
  treasurer:      { bg: 'rgba(90,107,42,0.15)',  text: '#7A9A3A', border: 'rgba(90,107,42,0.3)' },
  hype_person:    { bg: 'rgba(234,179,8,0.1)',   text: '#EAB308', border: 'rgba(234,179,8,0.25)' },
  ride_coordinator: { bg: 'rgba(148,163,184,0.1)', text: '#94A3B8', border: 'rgba(148,163,184,0.25)' },
  table_booker:   { bg: 'rgba(148,163,184,0.1)', text: '#94A3B8', border: 'rgba(148,163,184,0.25)' },
  food_orderer:   { bg: 'rgba(148,163,184,0.1)', text: '#94A3B8', border: 'rgba(148,163,184,0.25)' },
  photographer:   { bg: 'rgba(148,163,184,0.1)', text: '#94A3B8', border: 'rgba(148,163,184,0.25)' },
  playlist_curator: { bg: 'rgba(148,163,184,0.1)', text: '#94A3B8', border: 'rgba(148,163,184,0.25)' },
}

interface RoleBadgeProps {
  role: HangoutRoleType
  size?: 'sm' | 'md'
  showLabel?: boolean
}

export function RoleBadge({ role, size = 'sm', showLabel = true }: RoleBadgeProps) {
  const Icon = ROLE_ICON_MAP[role]
  const styles = ROLE_STYLES[role]

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        padding: size === 'sm' ? '2px 6px' : '3px 8px',
        borderRadius: '999px',
        background: styles.bg,
        border: `1px solid ${styles.border}`,
        fontSize: size === 'sm' ? '10px' : '11px',
        fontWeight: 600,
        color: styles.text,
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap',
      }}
    >
      <Icon size={size === 'sm' ? 10 : 12} strokeWidth={2.5} />
      {showLabel && ROLE_LABELS[role]}
    </span>
  )
}
