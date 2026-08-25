const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Safe post-auth redirect target from /auth/callback ?next= */
export function safeAuthNext(next: string | null, fallback = '/dashboard'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return fallback
  return next
}

/** Build the email confirmation redirect URL for signUp(). */
export function authCallbackUrl(next?: string): string {
  const url = new URL('/auth/callback', window.location.origin)
  if (next) url.searchParams.set('next', next)
  return url.toString()
}

/** After sign-in or immediate post-signup session, honor pending invites. */
export function redirectAfterAuth(defaultPath = '/dashboard') {
  const pendingInvite = localStorage.getItem('pending_invite')
  localStorage.removeItem('pending_invite')
  if (pendingInvite && UUID_RE.test(pendingInvite)) {
    window.location.href = `/invite/${pendingInvite}`
  } else {
    window.location.href = defaultPath
  }
}
