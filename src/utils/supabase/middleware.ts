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

  // Proteger toutes les routes qui commencent par /dashboard, /analyze, /match, /club, /competitions, /settings, /history, /standings, /pricing, /stats, /search, /ia-center
  const protectedPaths = ['/dashboard', '/analyze', '/match', '/club', '/competitions', '/settings', '/history', '/standings', '/pricing', '/stats', '/search', '/ia-center', '/admin'];
  
  const isProtectedPath = protectedPaths.some(path => request.nextUrl.pathname.startsWith(path));

  if (!user && isProtectedPath) {
    // Si l'utilisateur n'est pas connecté et essaie d'accéder à une route protégée, redirection vers /login
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
