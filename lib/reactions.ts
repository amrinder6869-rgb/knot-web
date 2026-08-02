/** Shared reaction helpers for posts and comments. */

export const REACTION_EMOJIS = ['❤️', '👍', '😂', '🔥', '😮', '😢', '👏'] as const

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number]

export type ReactionCount = {
  e: string
  n: number
  mine: boolean
}

export function normalizeReactionEmoji(emoji: string): string {
  if (emoji === 'heart' || emoji === '♥' || emoji === '❤') return '❤️'
  return emoji
}

export function aggregateReactions(
  rows: { emoji: string; user_id: string }[],
  currentUserId?: string | null
): ReactionCount[] {
  const map = new Map<string, ReactionCount>()
  for (const r of rows) {
    const e = normalizeReactionEmoji(r.emoji)
    const existing = map.get(e)
    if (existing) {
      existing.n += 1
      if (r.user_id === currentUserId) existing.mine = true
    } else {
      map.set(e, { e, n: 1, mine: r.user_id === currentUserId })
    }
  }
  return Array.from(map.values()).sort((a, b) => b.n - a.n)
}

export function toggleReactionLocal(
  reactions: ReactionCount[],
  emoji: string
): ReactionCount[] {
  const normalized = normalizeReactionEmoji(emoji)
  const exists = reactions.find(r => r.e === normalized)
  if (exists) {
    return reactions
      .map(r =>
        r.e === normalized
          ? { ...r, n: r.mine ? r.n - 1 : r.n + 1, mine: !r.mine }
          : r
      )
      .filter(r => r.n > 0)
      .sort((a, b) => b.n - a.n)
  }
  return [...reactions, { e: normalized, n: 1, mine: true }].sort((a, b) => b.n - a.n)
}

export function legacyHeartEmojis(normalized: string): string[] {
  if (normalized === '❤️') return [normalized, 'heart', '♥', '❤']
  return [normalized]
}
