import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
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

  const dest = request.nextUrl.clone()
  dest.search = ''
  
  // Create response early so we can attach cookies to it
  const response = NextResponse.redirect(dest)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Update the request cookies so subsequent calls in this route handler see the new value
            request.cookies.set(name, value)
            // Attach the cookie to the response
            response.cookies.set(name, value, options)
          })
        },
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

  // ── Extract potential Instagram handle from OAuth meta ───────────────────
  let inferredHandle = null
  if (meta.user_name) {
    inferredHandle = `https://instagram.com/${meta.user_name}`
  } else if (meta.preferred_username) {
    inferredHandle = `https://instagram.com/${meta.preferred_username}`
  } else if (meta.name) {
    inferredHandle = `https://instagram.com/${meta.name.replace(/\s+/g, '').toLowerCase()}`
  } else {
    inferredHandle = `https://instagram.com/user_${authUser.id.substring(0, 8)}`
  }

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
      instagram_handle: inferredHandle,
      role: 'user',
    })

    if (insertError) {
      // Profile creation failed — could be RLS or duplicate. Log but continue.
      console.error('[auth/callback] Profile insert error:', insertError)
    }

    // New users always go to dashboard where the modal will appear if needed
    dest.pathname = next === '/update-password' ? next : '/dashboard'
    return NextResponse.redirect(dest, { headers: response.headers })
  }

  // ── Returning user: route by role ─────────────────────────────────────────
  const role = existingProfile.role ?? 'user'

  // Priority to specific flows like password update
  if (next === '/update-password') {
    dest.pathname = next
  } else if (role === 'admin') {
    dest.pathname = '/admin'
  } else if (role === 'security') {
    dest.pathname = '/scanner/security'
  } else if (role === 'barman') {
    dest.pathname = '/scanner/barman'
  } else {
    dest.pathname = next
  }

  // Update the redirect URL in the existing response
  return NextResponse.redirect(dest, { headers: response.headers })
}
