import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

const DOMAINE_OFFICIEL = 'profootai.com'

export async function proxy(request: NextRequest) {
  const hote = request.headers.get('host') || ''

  // Redirection permanente de l'ancienne adresse d'hébergement vers le domaine
  // officiel. Sans elle, Google garde les deux adresses en mémoire : il affiche
  // « Vercel » comme nom de site (déduit de profoot-2lqq.vercel.app) et
  // considère les deux versions comme du contenu dupliqué, ce qui dilue le
  // référencement. Le code 308 est PERMANENT : c'est lui qui indique au moteur
  // de transférer l'ancienneté et la position acquises vers le nouveau domaine.
  if (hote.endsWith('.vercel.app')) {
    const url = new URL(request.url)
    url.host = DOMAINE_OFFICIEL
    url.protocol = 'https:'
    url.port = ''
    return NextResponse.redirect(url, 308)
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
