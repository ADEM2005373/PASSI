import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protect routes and check roles
  const url = request.nextUrl.clone()
  const path = request.nextUrl.pathname

  // Allow auth callbacks to process without any interference
  if (path.startsWith('/auth/callback')) {
    return supabaseResponse
  }

  if (
    !user &&
    !path.startsWith('/login') &&
    !path.startsWith('/staff/login') &&
    !path.startsWith('/register') &&
    !path.startsWith('/forgot-password') &&
    !path.startsWith('/update-password') &&
    path !== '/'
  ) {
    if (path.startsWith('/api')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user) {
    // Fetch user profile to get the role and onboarding status
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, instagram_handle')
      .eq('id', user.id)
      .maybeSingle()

    let role = profile?.role || 'user'
    
    if (role === 'admin') {
      const override = request.cookies.get('passi_impersonate_role')?.value;
      if (override && ['admin', 'user', 'barman', 'security'].includes(override)) {
        role = override;
      }
    }

    // 1. Role-specific home pages
    const roleHomes: Record<string, string> = {
      'admin': '/admin',
      'security': '/scanner/security',
      'barman': '/scanner/barman',
      'user': '/dashboard'
    }
    const userHome = roleHomes[role] || '/dashboard'

    // 2. Onboarding check for standard users
    const hasInstagram = profile?.instagram_handle && profile.instagram_handle.trim().length > 0
    if (role === 'user' && !hasInstagram && path !== '/onboarding' && !path.startsWith('/api') && path !== '/update-password') {
      url.pathname = '/onboarding'
      return NextResponse.redirect(url)
    }

    // 3. If profile is completed and user tries to hit /onboarding, send to dashboard
    if (path === '/onboarding' && hasInstagram) {
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    // 4. If logged in and hitting public/login pages, force them to their specific domain
    if (path === '/' || path.startsWith('/login') || path.startsWith('/staff/login') || path.startsWith('/register')) {
      if (role === 'user' && !hasInstagram) {
        url.pathname = '/onboarding'
      } else {
        url.pathname = userHome
      }
      return NextResponse.redirect(url)
    }

    // 5. Strict Domain Isolation (Pages)
    if (!path.startsWith('/api')) {
      if (role === 'admin' && (path.startsWith('/dashboard') || path.startsWith('/events') || path.startsWith('/scanner') || path === '/onboarding')) {
        url.pathname = userHome
        return NextResponse.redirect(url)
      }
      if (role === 'security' && !path.startsWith('/scanner/security')) {
        url.pathname = userHome
        return NextResponse.redirect(url)
      }
      if (role === 'barman' && !path.startsWith('/scanner/barman')) {
        url.pathname = userHome
        return NextResponse.redirect(url)
      }
      if (role === 'user' && (path.startsWith('/admin') || path.startsWith('/scanner') || path.startsWith('/staff'))) {
        url.pathname = userHome
        return NextResponse.redirect(url)
      }
    } else {
      // 4. Strict Domain Isolation (API)
      if (path.startsWith('/api/admin') && role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized: Admin Only' }, { status: 403 })
      }
      if (path.startsWith('/api/scan') && role !== 'security' && role !== 'barman' && role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized: Scanner Only' }, { status: 403 })
      }
    }
  }

  return supabaseResponse
}
