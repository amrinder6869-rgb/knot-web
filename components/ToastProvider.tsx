'use client'
import { createContext, useCallback, useContext, useRef, useState } from 'react'

type ToastVariant = 'success' | 'actionable' | 'error'

type Toast = {
  id: string
  message: string
  variant: ToastVariant
  actionLabel?: string
  onAction?: () => void
}

type ActionableInput = {
  message: string
  actionLabel: string
  onAction: () => void
}

type ToastContextValue = {
  success: (message: string) => void
  error: (message: string) => void
  actionable: (input: ActionableInput) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const VARIANT_STYLES: Record<ToastVariant, { bg: string; border: string; text: string }> = {
  success:    { bg: '#F0FDF4', border: '#BBF7D0', text: '#16A34A' },
  actionable: { bg: '#FFFBEE', border: '#F8BD03', text: '#111111' },
  error:      { bg: '#FEF2F2', border: '#FECACA', text: '#DC2626' },
}

const DISMISS_MS = 4000

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) { clearTimeout(timer); timers.current.delete(id) }
  }, [])

  const push = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev, { ...toast, id }])
    const timer = setTimeout(() => dismiss(id), DISMISS_MS)
    timers.current.set(id, timer)
  }, [dismiss])

  const value: ToastContextValue = {
    success:    (message) => push({ message, variant: 'success' }),
    error:      (message) => push({ message, variant: 'error' }),
    actionable: ({ message, actionLabel, onAction }) => push({ message, variant: 'actionable', actionLabel, onAction }),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', pointerEvents: 'none' }}>
        {toasts.map(t => {
          const style = VARIANT_STYLES[t.variant]
          return (
            <div key={t.id} style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: style.bg, border: `1px solid ${style.border}`, borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', fontSize: 13, color: style.text, fontFamily: 'inherit', maxWidth: 360 }}>
              <span style={{ flex: 1 }}>{t.message}</span>
              {t.variant === 'actionable' && t.actionLabel && (
                <button onClick={() => { t.onAction?.(); dismiss(t.id) }}
                  style={{ padding: '4px 10px', background: '#F8BD03', border: 'none', borderRadius: 6, color: '#111', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  {t.actionLabel}
                </button>
              )}
              <button onClick={() => dismiss(t.id)} aria-label="Dismiss"
                style={{ background: 'none', border: 'none', color: style.text, opacity: 0.6, cursor: 'pointer', fontSize: 15, padding: 0, lineHeight: 1, fontFamily: 'inherit' }}>
                ×
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
