import { getKnotIcon } from '@/lib/constants'

interface KnotIconProps {
  value: string | null | undefined
  size?: number
  iconSize?: number
}

export default function KnotIcon({ value, size = 32, iconSize = 16 }: KnotIconProps) {
  const knot = getKnotIcon(value)
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: size * 0.28,
      background: knot.bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      <i className={`ti ${knot.icon}`} style={{ fontSize: iconSize, color: knot.color }} />
    </div>
  )
}
