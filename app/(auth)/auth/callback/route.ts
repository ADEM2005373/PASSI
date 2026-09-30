import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * OAuth Callback Route Handler
 *
 * Supabase redirects here after a successful social login (Google / Facebook / Instagram).
 * Steps:
 *  1. Exchange the `code` from the URL for a Supabase session.
 *  2. Detect first-time logins and create the profile row in `public.profiles`.
 *  3. Extract the Instagram / Facebook username from OAuth metadata when available.
 *  4. Redirect the user to the correct dashboard based on their role.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) },
      },
    }
  )

  // Safety: if there's no code the provider returned an error (e.g. user cancelled)
  if (!code) {
    // Check if they are already logged in (e.g., admin trying to link account)
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    const errorUrl = request.nextUrl.clone()
    
    if (currentUser) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', currentUser.id).maybeSingle()
      if (profile?.role === 'admin') {
        errorUrl.pathname = '/staff/login'
        errorUrl.searchParams.set('error', 'oauth_failed')
        return NextResponse.redirect(errorUrl)
      }
    }

    errorUrl.pathname = '/login'
    errorUrl.searchParams.set('error', 'oauth_failed')
    return NextResponse.redirect(errorUrl)
  }

  // Exchange the auth code for a session
  const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code)

  if (sessionError || !sessionData.user) {
    console.error('[auth/callback] Session exchange failed:', sessionError)
    
    // Check if they are already logged in (e.g., admin trying to link account)
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    const errorUrl = request.nextUrl.clone()
    
    if (currentUser) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', currentUser.id).maybeSingle()
      if (profile?.role === 'admin') {
        errorUrl.pathname = '/staff/login'
        errorUrl.searchParams.set('error', 'session_exchange_failed')
        return NextResponse.redirect(errorUrl)
      }
    }

    errorUrl.pathname = '/login'
    errorUrl.searchParams.set('error', 'session_exchange_failed')
    return NextResponse.redirect(errorUrl)
  }

  const authUser = sessionData.user
  const meta = authUser.user_metadata ?? {}

  // ── Check whether this user already has a profile row ─────────────────────
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id, role, instagram_handle')
    .eq('id', authUser.id)
    .maybeSingle()

  if (!existingProfile) {
    // ── First-time login: create the profile ─────────────────────────────────
    // Try to extract the Instagram / Facebook username from OAuth metadata.
    // Facebook/Instagram provider sets `user_name` or `preferred_username`.
    const rawHandle: string =
      meta.user_name ||
      meta.preferred_username ||
      meta.full_name ||
      ''

    // Normalise: add @ prefix if the handle looks like a username
    const instagramHandle: string | null =
      rawHandle && !rawHandle.includes(' ')
        ? rawHandle.startsWith('@')
          ? rawHandle
          : `@${rawHandle}`
        : null

    const { error: insertError } = await supabase.from('profiles').insert({
      id: authUser.id,
      email: authUser.email ?? '',
      instagram_handle: instagramHandle, // null = user must complete profile
      role: 'user',
    })

    if (insertError) {
      // Profile creation failed — could be RLS or duplicate. Log but continue.
      console.error('[auth/callback] Profile insert error:', insertError)
    }

    // New users always go to dashboard where the modal will appear if needed
    const dest = request.nextUrl.clone()
    dest.pathname = '/dashboard'
    dest.search = ''
    return NextResponse.redirect(dest)
  }

  // ── Returning user: route by role ─────────────────────────────────────────
  const role = existingProfile.role ?? 'user'
  const dest = request.nextUrl.clone()
  dest.search = ''

  if (role === 'admin') dest.pathname = '/admin'
  else if (role === 'security') dest.pathname = '/scanner/security'
  else if (role === 'barman') dest.pathname = '/scanner/barman'
  else dest.pathname = next

  return NextResponse.redirect(dest)
}
