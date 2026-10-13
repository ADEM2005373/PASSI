import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { getURL } from '@/lib/utils/url'

/**
 * OAuth & Auth Callback Route Handler
 *
 * Résout le problème de double redirection OAuth :
 * 1. Attache directement les cookies de session sur l'en-tête de la réponse NextResponse.redirect.
 * 2. Vérifie immédiatement l'état du profil utilisateur (instagram_handle).
 * 3. Aiguille sans intermédiaire : vers /onboarding si instagram_handle est vide, ou /dashboard / espace rôle.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const canonicalBase = getURL()
  const code = requestUrl.searchParams.get('code')
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const next = requestUrl.searchParams.get('next') ?? '/dashboard'

  // Si aucun paramètre d'échange n'est présent
  if (!code && !token_hash) {
    return NextResponse.redirect(new URL('/login?error=oauth_failed', canonicalBase))
  }

  // Prépare une réponse par défaut (sera modifiée pour la redirection finale)
  let response = NextResponse.redirect(new URL('/login?error=oauth_failed', canonicalBase))

  // Client Supabase SSR synchronisé avec les cookies de la requête et de la réponse
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Écrit les cookies sur la requête pour le contexte immédiat
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          // Réinjecte les cookies sur la réponse HTTP pour le navigateur
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  let authUser: any = null

  if (token_hash && type === 'recovery') {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash, type: 'recovery' })
    if (error || !data?.user) {
      console.error('[auth/callback] Verify OTP error:', error)
      return NextResponse.redirect(new URL('/login?error=oauth_failed', canonicalBase))
    }
    authUser = data.user
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error || !data?.user) {
      console.error('[auth/callback] exchangeCodeForSession error:', error)
      return NextResponse.redirect(new URL('/login?error=oauth_failed', canonicalBase))
    }
    authUser = data.user
  }

  if (!authUser) {
    return NextResponse.redirect(new URL('/login?error=oauth_failed', canonicalBase))
  }

  // Client admin pour garantir la création et la lecture immédiate du profil (évite RLS race condition)
  const supabaseAdmin = createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 1. Récupération ou création du profil
  const { data: existingProfile } = await supabaseAdmin
    .from('profiles')
    .select('id, role, instagram_handle')
    .eq('id', authUser.id)
    .maybeSingle()

  let userProfile = existingProfile

  if (!userProfile) {
    // Premier login OAuth : création automatique du profil
    const { data: newProfile, error: insertError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authUser.id,
        email: authUser.email ?? '',
        role: 'user',
        instagram_handle: null,
      })
      .select('id, role, instagram_handle')
      .single()

    if (insertError) {
      console.error('[auth/callback] Profile insert error:', insertError)
    } else {
      userProfile = newProfile
    }
  }

  // 2. Détermination de la destination finale
  let redirectPath = next

  if (next === '/update-password') {
    redirectPath = '/update-password'
  } else {
    const role = userProfile?.role ?? 'user'

    if (role === 'admin') {
      redirectPath = '/admin'
    } else if (role === 'security') {
      redirectPath = '/scanner/security'
    } else if (role === 'barman') {
      redirectPath = '/scanner/barman'
    } else {
      // Pour les utilisateurs réguliers : vérification Instagram
      const hasInstagram = userProfile?.instagram_handle && userProfile.instagram_handle.trim().length > 0
      if (!hasInstagram) {
        redirectPath = '/onboarding'
      } else {
        redirectPath = '/dashboard'
      }
    }
  }

  // 3. Construction de la réponse finale de redirection AVEC transfert exact de tous les cookies de session
  const targetUrl = new URL(redirectPath, canonicalBase)
  const finalResponse = NextResponse.redirect(targetUrl)

  // Copie tous les cookies de session Supabase enregistrés sur `response` vers `finalResponse`
  response.cookies.getAll().forEach((cookie) => {
    finalResponse.cookies.set(cookie.name, cookie.value, {
      ...cookie,
    })
  })

  return finalResponse
}
