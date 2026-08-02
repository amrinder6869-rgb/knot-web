import { supabase } from '@/lib/supabase'
import {
  aggregateReactions,
  legacyHeartEmojis,
  normalizeReactionEmoji,
  toggleReactionLocal,
  type ReactionCount,
} from '@/lib/reactions'

/** Cached probe: null = unknown, true = usable, false = missing / blocked */
let tableAvailable: boolean | null = null
let probePromise: Promise<boolean> | null = null

function isMissingTableError(error: { code?: string; message?: string } | null) {
  if (!error) return false
  const msg = (error.message || '').toLowerCase()
  return (
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    msg.includes('could not find the table') ||
    msg.includes('does not exist') ||
    msg.includes('schema cache')
  )
}

async function ensureTableAvailable(): Promise<boolean> {
  if (tableAvailable === true) return true
  if (tableAvailable === false) return false
  if (!probePromise) {
    probePromise = (async () => {
      // Single probe so the browser only ever logs one 404 if the table is missing
      const { error } = await supabase
        .from('comment_reactions')
        .select('comment_id')
        .limit(1)
      if (error && isMissingTableError(error)) {
        tableAvailable = false
        return false
      }
      // Other errors (RLS, network) — don't keep hammering missing-table path
      if (error) {
        tableAvailable = false
        return false
      }
      tableAvailable = true
      return true
    })()
  }
  return probePromise
}

export function commentReactionsSupported() {
  return tableAvailable !== false
}

export async function loadCommentReactions(
  commentIds: string[],
  currentUserId?: string | null
): Promise<Record<string, ReactionCount[]>> {
  if (commentIds.length === 0) return {}
  const ok = await ensureTableAvailable()
  if (!ok) return {}

  const { data, error } = await supabase
    .from('comment_reactions')
    .select('comment_id, emoji, user_id')
    .in('comment_id', commentIds)

  if (error) {
    if (isMissingTableError(error)) tableAvailable = false
    return {}
  }

  const byComment: Record<string, { emoji: string; user_id: string }[]> = {}
  ;(data || []).forEach((r: any) => {
    if (!byComment[r.comment_id]) byComment[r.comment_id] = []
    byComment[r.comment_id].push({ emoji: r.emoji, user_id: r.user_id })
  })
  const next: Record<string, ReactionCount[]> = {}
  Object.keys(byComment).forEach(id => {
    next[id] = aggregateReactions(byComment[id], currentUserId)
  })
  return next
}

export async function toggleCommentReactionRemote(
  commentId: string,
  emoji: string,
  userId: string,
  current: ReactionCount[]
): Promise<{ ok: boolean; next: ReactionCount[]; error?: string }> {
  const ok = await ensureTableAvailable()
  if (!ok) {
    return {
      ok: false,
      next: current,
      error: 'Run the comment_reactions migration in Supabase to enable comment reacts.',
    }
  }

  const normalized = normalizeReactionEmoji(emoji)
  const existing = current.find(r => r.e === normalized && r.mine)

  if (existing) {
    const { error } = await supabase.from('comment_reactions').delete()
      .eq('comment_id', commentId).eq('user_id', userId).in('emoji', legacyHeartEmojis(normalized))
    if (error) {
      if (isMissingTableError(error)) tableAvailable = false
      return { ok: false, next: current, error: error.message }
    }
  } else {
    const { error } = await supabase.from('comment_reactions')
      .insert({ comment_id: commentId, user_id: userId, emoji: normalized })
    if (error) {
      if (isMissingTableError(error)) tableAvailable = false
      return { ok: false, next: current, error: error.message }
    }
  }

  return { ok: true, next: toggleReactionLocal(current, normalized) }
}
