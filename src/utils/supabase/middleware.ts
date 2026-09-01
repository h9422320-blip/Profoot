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

  // ── UN APPEL D'AUTHENTIFICATION PAR REQUÊTE A FAIT TOMBER LA BASE ────────
  //
  // Le 25 août 2026 à 21 h, le projet Supabase est passé en « Malsain » :
  // 23 946 requêtes en une heure, 0,0 % de réussite. Plus personne ne pouvait
  // se connecter. Le tableau de bord annonçait « dépassement des limites
  // d'utilisation » sur un serveur NANO en plan gratuit.
  //
  // La cause était ici. Ce fichier s'exécute sur CHAQUE requête — chaque page,
  // chaque navigation, chaque préchargement — et appelait `getUser()`, qui est
  // un appel réseau à Supabase. À lui seul, il produisait 23 127 des requêtes
  // d'authentification de cette heure-là.
  //
  // ── POURQUOI ON PEUT S'EN PASSER SUR LES PAGES PUBLIQUES ────────────────
  //
  // Cet appel ne sert qu'à trois choses : fermer les pages protégées, vérifier
  // le droit d'administrer, et rafraîchir le jeton de session. Sur une page
  // publique — l'accueil, les tarifs, les preuves, les matchs — aucune des
  // trois n'est nécessaire :
  //
  //   — la page ne protège rien ;
  //   — son composant serveur n'interroge pas l'authentification. Vérifié un
  //     par un : ni la mise en page du tableau de bord, ni /pricing, ni
  //     /preuves, ni /matches. La barre latérale lit un simple cookie, sans
  //     appel réseau ;
  //   — le jeton se rafraîchira à la première page protégée, où ce fichier
  //     s'exécute toujours. Le jeton de rafraîchissement, lui, vit bien plus
  //     longtemps : personne n'est déconnecté pour autant.
  //
  // Les routes /api gardent leur propre vérification et savent, elles, écrire
  // les cookies — ce qu'un composant serveur ne peut pas faire.
  //
  // ── CE QUI CHANGE POUR UN ADMINISTRATEUR ────────────────────────────────
  //
  // Pendant une maintenance, un administrateur qui ouvre une page publique
  // n'est plus reconnu et voit l'écran de maintenance comme tout le monde.
  // /admin, /login et /a/ restent ouverts en toutes circonstances : il garde
  // le moyen de la désactiver.
  const chemin = request.nextUrl.pathname;
  // ── LES TARIFS SE FERMENT LE 1er SEPTEMBRE 2026 ────────────────────────
  //
  // Ils étaient publics depuis le 16/08, pour que Google les voie. Décision du
  // propriétaire : on ne veut plus que quiconque y arrive sans compte. Une
  // grille de prix vue par quelqu'un qui ignore ce que fait le produit ne
  // vend rien — et c'est par là qu'arrivaient les acheteurs sans compte, ceux
  // dont la vente n'avait ensuite aucun compte à qui se rattacher.
  //
  // Le parcours voulu : l'accueil, puis l'inscription, puis l'achat.
  const protectedPaths = ['/dashboard', '/analyze', '/settings', '/history', '/search', '/expert', '/payment-success', '/payment-failed', '/admin', '/pricing'];

  /**
   * Les pages dont le visiteur anonyme est FORCÉMENT nouveau.
   *
   * Les autres pages protégées appartiennent à quelqu'un qui a déjà un compte :
   * son historique, ses réglages, son analyse. Le renvoyer vers la connexion a
   * du sens.
   *
   * Les tarifs, non : celui qui les regarde n'a par définition rien acheté. Lui
   * demander ses identifiants, c'est lui demander ce qu'il n'a pas — et le
   * 23 août 2026, quelqu'un au Bénin a fait trois allers-retours entre les deux
   * écrans avant d'abandonner en soixante-sept secondes.
   */
  const versInscription = ['/pricing'];
  const isProtectedPath = protectedPaths.some(
    (path) => chemin === path || chemin.startsWith(path + '/')
  );

  const besoinDIdentite = isProtectedPath || chemin.startsWith('/api/');

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with cross-site tracking (CORS).
  const user = besoinDIdentite ? (await supabase.auth.getUser()).data.user : null

  // --- SESSION LIMITÉE À 7 JOURS ---
  //
  // Au-delà, la session est invalidée : l'utilisateur doit se reconnecter.
  //
  // La limite était d'un jour. Mesuré le 29 août 2026 : 242 des 358 abonnés
  // actifs avaient une session périmée et devaient retaper leur mot de passe
  // à leur prochain retour. Une reconnexion quotidienne imposée à quelqu'un
  // qui a déjà payé, sur un téléphone et une connexion lente, est la friction
  // qui fait écrire « je n'arrive pas à accéder ».
  //
  // CETTE DURÉE EST ÉCRITE DEUX FOIS : ici, et dans `subscription.ts` qui
  // calcule les droits. Elles doivent rester IDENTIQUES. Si ce portier était
  // plus permissif, il laisserait entrer quelqu'un que le calcul des droits
  // tient pour anonyme : l'abonné verrait le mur de paiement sans jamais être
  // renvoyé vers la connexion — donc sans comprendre, ni pouvoir réparer. Un
  // test refuse que les deux nombres diffèrent.
  const MAX_SESSION_AGE_MS = 7 * 24 * 60 * 60 * 1000;
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
  // /club, /match et /stats ont suivi le 16/08/2026, une fois branchés sur
  // des données réelles et rendus par le serveur.
  // /ia-center a été retirée le 24/08/2026. Elle n'était liée depuis nulle
  // part, mais tout compte connecté l'atteignait en tapant l'adresse : elle
  // n'était protégée que par la connexion, pas par le droit d'administrer.
  // Ses quatre chiffres — précision réelle, score exact, pronostics vérifiés,
  // en attente — vivent déjà sur /admin/system, avec en plus l'écart entre la
  // confiance affichée et la précision constatée. Elle portait par ailleurs
  // des promesses jamais tenues : « plus de 50 sources », « 200 variables »,
  // « conditions météo », qui décrivaient un moteur qui n'existe pas.
  // `protectedPaths`, `chemin` et `isProtectedPath` sont désormais calculés
  // PLUS HAUT : il faut savoir si la page est protégée avant de décider s'il
  // vaut la peine d'interroger l'authentification.
  //
  // La comparaison porte sur le SEGMENT complet, et non sur le simple début du
  // chemin. « /match » est un préfixe de « /matches » : une comparaison par
  // début de chaîne fermait la page publique des matchs en même temps que les
  // fiches de rencontre. La page répondait « connectez-vous » sans qu'aucune
  // règle ne la désigne — introuvable à la lecture du code.

  if (!activeUser && isProtectedPath) {
    // Non connecté (ou session expirée) sur une page protégée : redirection vers /login,
    // en conservant les cookies (notamment l'effacement de session) posés par Supabase.
    const url = request.nextUrl.clone()
    url.pathname = versInscription.some((p) => chemin === p || chemin.startsWith(p + '/'))
      ? '/signup'
      : '/login'
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
