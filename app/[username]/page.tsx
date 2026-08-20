import type { Metadata } from 'next'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import ProfileClient from './ProfileClient'

// Minimal shape of the fields generateMetadata actually reads from the
// get_public_profile RPC response. See ProfileClient.tsx for the full type.
type PublicProfileRow = {
  found: boolean
  locked: boolean
  tier?: 'private' | 'members_only' | 'public'
  privacy_tier?: 'private' | 'members_only' | 'public'
  name: string | null
  username: string
  bio?: string | null
}

async function fetchPublicProfile(username: string): Promise<PublicProfileRow | null> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        // generateMetadata runs during rendering, where cookies can't be
        // written — this is a read-only lookup, so setAll is a no-op.
        setAll() {},
      },
    }
  )
  const { data, error } = await supabase.rpc('get_public_profile', { p_username: username })
  if (error) return null
  return data as PublicProfileRow | null
}

export async function generateMetadata(
  { params }: { params: Promise<{ username: string }> }
): Promise<Metadata> {
  const { username } = await params
  const row = await fetchPublicProfile(username)
  const url = `https://knot.app/${username}`

  if (!row || !row.found) {
    return { title: 'Profile not found – Knot' }
  }

  if (row.locked || row.tier === 'private') {
    return {
      title: 'Knot – Private Profile',
      robots: 'noindex, nofollow',
      alternates: { canonical: url },
    }
  }

  if (row.privacy_tier === 'public') {
    const displayName = row.name || row.username
    const title = `${displayName} (@${row.username}) on Knot`
    const description = row.bio || 'Planning great nights with close friends on Knot.'
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url,
        siteName: 'Knot',
        type: 'profile',
      },
      robots: 'index, follow',
      alternates: { canonical: url },
    }
  }

  // members_only (or any other unlocked-but-non-public state): keep it out
  // of search results and link previews without exposing profile details.
  // get_public_profile doesn't lock this tier server-side today — see the
  // comment on membersOnlyGated in ProfileClient.tsx.
  return {
    title: 'Knot – Private Profile',
    robots: 'noindex, nofollow',
    alternates: { canonical: url },
  }
}

export default async function PublicProfilePage(
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params
  return <ProfileClient username={username} />
}
