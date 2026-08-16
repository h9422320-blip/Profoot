import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { maintenanceActive } from '@/lib/app-settings'
import { estAdmin } from '@/lib/admins'

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
  // ── CE QUI EST OUVERT À GOOGLE, ET POURQUOI ──────────────────────────────
  //
  // Tout le contenu football se trouvait derrière la connexion : Google ne
  // voyait que la page d'accueil et les mentions légales, soit sept pages en
  // tout. Un site de football sans page indexable ne peut pas être trouvé.
  //
  // Sont désormais publics : les tarifs — une page de prix cachée derrière une
  // connexion coûte aussi des ventes —, les compétitions et les classements,
  // qui ne contiennent que des données publiques de football.
  //
  // Restent protégés : l'analyse par IA, l'Agent VIP, l'historique personnel et
  // tout ce qui touche au compte. C'est le produit payant, il ne s'indexe pas.
  //
  // /matches a rejoint les pages publiques le 16/08/2026, une fois branchée
  // sur de vraies rencontres. Elle affichait jusque-là des matchs écrits à la
  // main, datés d'avril 2026, avec des pronostics inventés.
  //
  // /club, /match et /stats restent fermés pour cette même raison, encore non
  // corrigée chez eux.
  const protectedPaths = ['/dashboard', '/analyze', '/match', '/club', '/settings', '/history', '/stats', '/search', '/ia-center', '/expert', '/payment-success', '/payment-failed', '/admin'];

  // Comparaison sur le SEGMENT complet, et non sur le simple début du chemin.
  //
  // « /match » est un préfixe de « /matches » : une comparaison par début de
  // chaîne fermait la page publique des matchs en même temps que les fiches de
  // rencontre. La page répondait « connectez-vous » sans qu'aucune règle ne la
  // désigne — introuvable à la lecture du code.
  const chemin = request.nextUrl.pathname;
  const isProtectedPath = protectedPaths.some(
    (path) => chemin === path || chemin.startsWith(path + '/')
  );

  if (!activeUser && isProtectedPath) {
    // Non connecté (ou session expirée) sur une page protégée : redirection vers /login,
    // en conservant les cookies (notamment l'effacement de session) posés par Supabase.
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // LA PAGE DEMANDÉE EST MÉMORISÉE.
    //
    // Sans cela, la connexion renvoyait TOUJOURS vers l'analyse : quelqu'un qui
    // demandait l'administration se connectait, atterrissait ailleurs, et en
    // concluait qu'il n'avait pas les droits. Il lui fallait deviner qu'il
    // devait retaper l'adresse.
    //
    // Seul le chemin est conservé, jamais une adresse complète : un paramètre
    // libre permettrait d'expédier quelqu'un vers un site tiers depuis notre
    // propre page de connexion.
    url.searchParams.set('suite', request.nextUrl.pathname)
    const redirectResponse = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach(cookie => redirectResponse.cookies.set(cookie))
    return redirectResponse
  }

  // --- SECURITE ADMIN STRICTE ---
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!estAdmin(activeUser?.email)) {
      const url = request.nextUrl.clone()
      url.pathname = '/analyze' // Rediriger les curieux vers la page d'analyse
      const redirectResponse = NextResponse.redirect(url)
      supabaseResponse.cookies.getAll().forEach(cookie => redirectResponse.cookies.set(cookie))
      return redirectResponse
    }
  }
  // ------------------------------

  // --- MODE MAINTENANCE ---
  // Piloté depuis /admin/settings. L'administrateur garde l'accès complet,
  // sans quoi il ne pourrait plus désactiver la maintenance qu'il vient
  // d'activer. Les webhooks de paiement restent ouverts : un paiement encaissé
  // pendant la maintenance doit tout de même activer l'abonnement, sinon le
  // client paie sans rien recevoir.
  const cheminsToujoursOuverts = [
    '/maintenance', '/admin', '/a/', '/login', '/api/payments', '/_next', '/favicon',
  ];
  const estAdministrateur = estAdmin(activeUser?.email);
  const cheminOuvert = cheminsToujoursOuverts.some((p) => request.nextUrl.pathname.startsWith(p));

  if (!estAdministrateur && !cheminOuvert) {
    const { active } = await maintenanceActive(supabase)
    if (active) {
      const url = request.nextUrl.clone()
      url.pathname = '/maintenance'
      // Réécriture plutôt que redirection : l'adresse demandée reste dans la
      // barre du navigateur, donc un simple rechargement suffit une fois la
      // maintenance terminée.
      const reponse = NextResponse.rewrite(url)
      supabaseResponse.cookies.getAll().forEach(cookie => reponse.cookies.set(cookie))
      return reponse
    }
  }
  // ------------------------------

  return supabaseResponse
}
