'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function MemberAvatar({
  name,
  avatarUrl,
  size = 32,
  color = 'var(--yellow)',
  textColor = '#111',
}: {
  name: string
  avatarUrl: string | null
  size?: number
  color?: string
  textColor?: string
}) {
  const [displayUrl, setDisplayUrl] = useState<string | null>(null)

  // avatar_url from profiles is a knot-photos storage path, not a usable
  // URL — the bucket is private, so it needs to be exchanged for a signed
  // URL before it can go in an <img src>. Already-full URLs (signed or
  // public) are used as-is.
  useEffect(() => {
    let cancelled = false

    if (!avatarUrl) {
      setDisplayUrl(null)
      return
    }
    if (avatarUrl.startsWith('http')) {
      setDisplayUrl(avatarUrl)
      return
    }
    supabase.storage.from('knot-photos').createSignedUrl(avatarUrl, 3600).then(({ data }) => {
      if (!cancelled) setDisplayUrl(data?.signedUrl || null)
    })

    return () => { cancelled = true }
  }, [avatarUrl])

  if (displayUrl) {
    return (
      <img
        src={displayUrl}
        alt={name}
        onError={() => setDisplayUrl(null)}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }

  const initials = (name || 'U').split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color, color: textColor,
      fontSize: Math.round(size * 0.34), fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      {initials}
    </div>
  )
}
