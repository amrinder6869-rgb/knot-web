'use client'

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
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
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
