import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

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
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/dashboard'

  const supabase = await createClient()

  let sessionData: any
  let sessionError: any

  if (token_hash && type === 'recovery') {
    // 1) Handle OTP flow
    const { data, error } = await supabase.auth.verifyOtp({ token_hash, type: 'recovery' })
    sessionData = data
    sessionError = error
  } else if (code) {
    // 2) Handle standard OAuth/PKCE flow
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    sessionData = data
    sessionError = error
  } else {
    // Safety: no valid auth parameters
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

  if (sessionError || !sessionData?.user) {
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

  // ── Check whether this user already has a profile row ─────────────────────
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id, role, instagram_handle')
    .eq('id', authUser.id)
    .maybeSingle()

  if (!existingProfile) {
    // ── First-time login: create the profile ─────────────────────────────────
    // Use service role to bypass RLS since the current server client might not have 
    // the exchanged session fully propagated yet.
    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error: insertError } = await supabaseAdmin.from('profiles').insert({
      id: authUser.id,
      email: authUser.email ?? '',
      instagram_handle: null,
      role: 'user',
    })

    if (insertError) {
      // Profile creation failed — could be RLS or duplicate. Log but continue.
      console.error('[auth/callback] Profile insert error:', insertError)
    }

    // New users always go to dashboard where the modal will appear if needed
    const finalPath = next === '/update-password' ? next : '/dashboard'
    return NextResponse.redirect(`${origin}${finalPath}`)
  }

  // ── Returning user: route by role ─────────────────────────────────────────
  const role = existingProfile.role ?? 'user'
  let finalPath = next

  // Priority to specific flows like password update
  if (next === '/update-password') {
    finalPath = next
  } else if (role === 'admin') {
    finalPath = '/admin'
  } else if (role === 'security') {
    finalPath = '/scanner/security'
  } else if (role === 'barman') {
    finalPath = '/scanner/barman'
  }

  return NextResponse.redirect(`${origin}${finalPath}`)
}
