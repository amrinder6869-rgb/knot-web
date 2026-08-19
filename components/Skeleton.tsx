'use client'

export function Skeleton({ width = '100%', height = 14, borderRadius = 6, style }: {
  width?: number | string
  height?: number | string
  borderRadius?: number
  style?: React.CSSProperties
}) {
  return (
    <div style={{
      width, height, borderRadius,
      background: 'linear-gradient(90deg, var(--bg3) 25%, var(--bg4) 37%, var(--bg3) 63%)',
      backgroundSize: '400% 100%',
      animation: 'skeleton-shimmer 1.4s ease infinite',
      ...style,
    }} />
  )
}
