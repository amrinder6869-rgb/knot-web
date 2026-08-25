import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { safeAuthNext } from '@/lib/auth'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeAuthNext(searchParams.get('next'))

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      return NextResponse.redirect(
        `${origin}/?error=${encodeURIComponent(error.message)}`
      )
    }

    // A brand-new user who tapped "Sign up to join" on an invite has the
    // token stashed here (set by app/invite/[token]/page.tsx before sending
    // them off to confirm their email) — redeem it now that they have a
    // session, so the invite isn't silently lost.
    const pendingToken = cookieStore.get('pending_invite_token')?.value
    if (pendingToken) {
      await supabase.rpc('redeem_invite', { p_token: pendingToken })
      cookieStore.set('pending_invite_token', '', { path: '/', maxAge: 0 })
    }
  }

  return NextResponse.redirect(`${origin}${next}`)
}
