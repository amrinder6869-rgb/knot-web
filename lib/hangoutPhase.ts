export const UPCOMING_PLANNING_STATUSES = ['voting', 'confirmed', 'live'] as const
export const PAST_PLANNING_STATUSES = ['ended', 'cancelled'] as const

export type HangoutPhase = 'planning' | 'confirmed' | 'live' | 'ended' | 'cancelled'

export function hangoutPhase(h: any): HangoutPhase {
  const ps = String(h?.planning_status || h?.status || 'voting')
  if (ps === 'cancelled' || ps === 'abandoned' || h?.status === 'cancelled') return 'cancelled'
  if (ps === 'live' || h?.is_live || h?.status === 'live') return 'live'
  if (ps === 'ended' || h?.status === 'ended') return 'ended'
  if (ps === 'confirmed' || ps === 'locked') return 'confirmed'
  return 'planning'
}

export function cardStateKey(h: any): string {
  const phase = hangoutPhase(h)
  if (phase === 'planning') return 'voting'
  return phase
}
