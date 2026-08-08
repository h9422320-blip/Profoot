import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_ADMIN, cleAdminAttendue, cleValide } from '@/lib/admin-access';

/**
 * Lien d'accès personnel à l'administration : https://profootai.com/a/<clé>
 *
 * Ouvrir ce lien dépose un cookie de longue durée puis renvoie vers /admin.
 * Le lien seul ne donne aucun droit : il faut EN PLUS être connecté avec le
 * compte administrateur, ce que vérifie la page /admin elle-même. Un lien
 * intercepté ne permet donc pas d'entrer.
 *
 * Une clé fausse renvoie vers l'accueil sans rien dire — annoncer « clé
 * invalide » confirmerait à un curieux que cette adresse mène quelque part.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cle: string }> }
) {
  const { cle } = await params;
  const attendue = cleAdminAttendue();

  if (!attendue || !cleValide(cle, attendue)) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  const reponse = NextResponse.redirect(new URL('/admin', request.url));
  reponse.cookies.set(COOKIE_ADMIN, attendue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return reponse;
}
