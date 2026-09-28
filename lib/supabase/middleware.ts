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
  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/register') &&
    request.nextUrl.pathname !== '/'
  ) {
    if (request.nextUrl.pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user) {
    // Fetch user profile to get the role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role || 'user'
    const path = request.nextUrl.pathname

    // Allow auth callbacks to process
    if (path.startsWith('/auth/callback')) {
      return supabaseResponse
    }

    // 1. Role-specific home pages
    const roleHomes: Record<string, string> = {
      'admin': '/admin',
      'security': '/scanner/security',
      'barman': '/scanner/barman',
      'user': '/dashboard'
    }
    const userHome = roleHomes[role] || '/dashboard'

    // 2. If logged in and hitting public/login pages, force them to their specific domain
    if (path === '/' || path.startsWith('/login') || path.startsWith('/staff/login') || path.startsWith('/register')) {
      url.pathname = userHome
      return NextResponse.redirect(url)
    }

    // 3. Strict Domain Isolation (Pages)
    if (!path.startsWith('/api')) {
      if (role === 'admin' && (path.startsWith('/dashboard') || path.startsWith('/events') || path.startsWith('/scanner'))) {
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
