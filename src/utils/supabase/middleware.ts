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

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with cross-site tracking (CORS).
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // --- SESSION LIMITÉE À 24H ---
  // Au-delà de 24h après la dernière connexion, la session est invalidée :
  // l'utilisateur doit se reconnecter (exigence produit ProFoot).
  const MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000;
  let activeUser = user;
  if (user) {
    const lastSignIn = user.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : 0;
    if (!lastSignIn || Date.now() - lastSignIn > MAX_SESSION_AGE_MS) {
      // Portée locale : n'invalide que cette session, pas celles des autres
      // appareils de l'utilisateur.
      await supabase.auth.signOut({ scope: 'local' });
      activeUser = null;
    }
  }

  // Protéger toutes les pages de l'application (tout sauf accueil, login, signup, pages légales et API publiques)
  const protectedPaths = ['/dashboard', '/analyze', '/match', '/matches', '/club', '/competitions', '/settings', '/history', '/standings', '/pricing', '/stats', '/search', '/ia-center', '/expert', '/payment-success', '/payment-failed', '/admin'];

  const isProtectedPath = protectedPaths.some(path => request.nextUrl.pathname.startsWith(path));

  if (!activeUser && isProtectedPath) {
    // Non connecté (ou session expirée) sur une page protégée : redirection vers /login,
    // en conservant les cookies (notamment l'effacement de session) posés par Supabase.
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    const redirectResponse = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach(cookie => redirectResponse.cookies.set(cookie))
    return redirectResponse
  }

  // --- SECURITE ADMIN STRICTE ---
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!activeUser || activeUser.email?.toLowerCase() !== 'h9422320@gmail.com') {
      const url = request.nextUrl.clone()
      url.pathname = '/analyze' // Rediriger les curieux vers la page d'analyse
      const redirectResponse = NextResponse.redirect(url)
      supabaseResponse.cookies.getAll().forEach(cookie => redirectResponse.cookies.set(cookie))
      return redirectResponse
    }
  }
  // ------------------------------

  return supabaseResponse
}
