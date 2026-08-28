import { supabase } from '@/lib/supabase'

export async function insertAgentMessage(
  hangoutId: string,
  content: string,
  options?: { photo_path?: string | null },
): Promise<{ ok: boolean; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { ok: false, error: 'Unauthorized' }

  const res = await fetch('/api/hangout-messages/agent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      hangout_id: hangoutId,
      content,
      photo_path: options?.photo_path ?? null,
    }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { ok: false, error: data.error || `HTTP ${res.status}` }
  }

  return { ok: true }
}
