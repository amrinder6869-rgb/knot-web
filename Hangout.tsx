'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import HangoutCard from '@/components/HangoutCard'
import Composer from '@/components/Composer'

export default function Hangout({ members, knotId, currentUser }: { members: any[], knotId?: string, currentUser?: any }) {
  const [posts, setPosts]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!knotId) return
    loadHangoutPosts()
    const channel = supabase
      .channel(`tonight:${knotId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts', filter: `knot_id=eq.${knotId}` }, () => loadHangoutPosts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hangouts', filter: `knot_id=eq.${knotId}` }, () => loadHangoutPosts())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [knotId])

  async function loadHangoutPosts() {
    if (!knotId) return
    const { data: postData } = await supabase
      .from('posts')
      .select('*, profiles:author_id(name)')
      .eq('knot_id', knotId)
      .eq('post_type', 'hangout')
      .order('created_at', { ascending: false })

    if (!postData || postData.length === 0) { setPosts([]); setLoading(false); return }

    // Pull hangout scheduled_for for sorting: live/upcoming first, then by date
    const hangoutIds = postData.map((p: any) => p.hangout_id).filter(Boolean)
    const { data: hangoutData } = await supabase
      .from('hangouts')
      .select('id, status, is_live, scheduled_for')
      .in('id', hangoutIds)

    const hangoutMap = new Map((hangoutData || []).map((h: any) => [h.id, h]))

    const sorted = [...postData].sort((a: any, b: any) => {
      const ha = hangoutMap.get(a.hangout_id)
      const hb = hangoutMap.get(b.hangout_id)
      // Live first
      if (ha?.is_live && !hb?.is_live) return -1
      if (!ha?.is_live && hb?.is_live) return 1
      // Then voting/confirmed (upcoming) before done
      const aDone = ha?.status === 'ended'
      const bDone = hb?.status === 'ended'
      if (!aDone && bDone) return -1
      if (aDone && !bDone) return 1
      // Then by scheduled date, soonest first for upcoming, most recent first for done
      const aTime = ha?.scheduled_for ? new Date(ha.scheduled_for).getTime() : 0
      const bTime = hb?.scheduled_for ? new Date(hb.scheduled_for).getTime() : 0
      if (!aDone) return aTime - bTime
      return bTime - aTime
    })

    setPosts(sorted)
    setLoading(false)
  }

  if (loading) return <div style={{ color: 'var(--text2)', fontSize: 13, padding: '20px 0' }}>Loading...</div>

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Planner</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>All your hangouts, live and upcoming</div>
        </div>
      </div>

      <Composer knotId={knotId!} currentUser={currentUser} members={members} onPosted={loadHangoutPosts} />

      {posts.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 4 }}>Nothing planned yet.</div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>Use the composer above to start a hangout.</div>
        </div>
      )}

      {posts.map((post: any) => (
        <HangoutCard
          key={post.id}
          post={post}
          currentUser={currentUser}
          knotId={knotId!}
          members={members}
          onRefresh={loadHangoutPosts}
        />
      ))}
    </div>
  )
}
