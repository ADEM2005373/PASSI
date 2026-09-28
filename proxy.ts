import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function proxy(request: NextRequest) {
  // Create the initial response — will be replaced if cookies need setting
  let supabaseResponse = NextResponse.next({ request })

  // Build a Supabase client that reads/writes cookies via the request/response
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // First write into the request so downstream code sees the refreshed cookies
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // Recreate the response from the updated request, then set cookies on it
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Call getUser() (not getSession()) so the JWT is validated server-side
  // and the refresh token is exchanged when needed, keeping the session alive.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // ─── Route protection ─────────────────────────────────────────────────────
  // Allow OAuth callback to run without a session guard
  const isAuthCallback = path.startsWith('/auth/callback')

  const isProtected =
    !isAuthCallback &&
    (
      path.startsWith('/admin') ||
      path.startsWith('/dashboard') ||
      path.startsWith('/events') ||
      path.startsWith('/scanner')
    )

  if (!user && isProtected) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  // Redirect authenticated users away from /login
  if (user && path === '/login') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const role = profile?.role || 'user'
    const dest = request.nextUrl.clone()

    if (role === 'admin') dest.pathname = '/admin'
    else if (role === 'security') dest.pathname = '/scanner/security'
    else if (role === 'barman') dest.pathname = '/scanner/barman'
    else dest.pathname = '/dashboard'

    return NextResponse.redirect(dest)
  }

  // Role-based protection for admin/scanner routes
  if (user && (path.startsWith('/admin') || path.startsWith('/scanner'))) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const role = profile?.role || 'user'

    if (path.startsWith('/admin') && role !== 'admin') {
      const dest = request.nextUrl.clone()
      dest.pathname = '/dashboard'
      return NextResponse.redirect(dest)
    }

    if (
      path.startsWith('/scanner/security') &&
      role !== 'security' &&
      role !== 'admin'
    ) {
      const dest = request.nextUrl.clone()
      dest.pathname = '/dashboard'
      return NextResponse.redirect(dest)
    }

    if (
      path.startsWith('/scanner/barman') &&
      role !== 'barman' &&
      role !== 'admin'
    ) {
      const dest = request.nextUrl.clone()
      dest.pathname = '/dashboard'
      return NextResponse.redirect(dest)
    }
  }

  // ─── Back-button fix ──────────────────────────────────────────────────────
  // Tell the browser never to serve a cached version of protected pages so
  // that pressing Back always re-validates the session instead of showing a
  // stale, potentially logged-out page.
  if (isProtected && user) {
    supabaseResponse.headers.set(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate'
    )
    supabaseResponse.headers.set('Pragma', 'no-cache')
    supabaseResponse.headers.set('Expires', '0')
  }

  // IMPORTANT: Return supabaseResponse (not a new NextResponse) so that any
  // refreshed session cookies are forwarded to the browser.
  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT static assets and image optimisation routes.
     * This ensures the session is refreshed on every navigation.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
