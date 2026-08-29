import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';

/**
 * Source de vérité unique des plans et des droits d'accès ProFoot AI.
 * Toute décision d'accès (Premium, VIP) DOIT passer par ce module, côté serveur.
 */

export type PlanTier = 'FREE' | 'ESSENTIAL' | 'PRO' | 'VIP';

/** Quota illimité — évite un `null` ambigu dans les comparaisons. */
export const UNLIMITED = Infinity;

export interface Entitlements {
  plan: PlanTier;
  premium: boolean;   // Analyseur IA, stats avancées, compétitions, historique…
  vip: boolean;       // Agent IA VIP + exclusivités
  /** Analyses autorisées par période. `UNLIMITED` pour le VIP annuel. */
  analysisLimit: number;
  expiresAt: string | null;
  /** Début de la période de quota en cours (null si aucun abonnement). */
  periodStart: string | null;
  isAdmin: boolean;
}

// Configuration des offres — montants en FCFA (XOF), source de vérité pour le
// checkout ET la validation des webhooks. Ne jamais dupliquer ces montants ailleurs.
// Le prix, le quota et l'accès VIP sont modifiables depuis l'administration
// (table `offres`) : ces valeurs servent de REPLI quand la table est
// injoignable, et de référence pour reconnaître un paiement.
//
// `montantsPrecedents` conserve tous les tarifs jamais pratiqués. C'est ce qui
// permet à un abonné ayant payé 3 000 FCFA d'être encore reconnu après le
// passage à 2 000 : sans cette liste, son paiement deviendrait orphelin.
export const PLANS = {
  essential_monthly: {
    amountXof: 2000, durationDays: 30, tier: 'ESSENTIAL' as PlanTier,
    vip: true, analysisLimit: 20, label: 'Essentiel',
    montantsPrecedents: [9000, 3000],
  },
  pro_monthly: {
    amountXof: 5000, durationDays: 30, tier: 'PRO' as PlanTier,
    vip: true, analysisLimit: 50, label: 'Pro',
    montantsPrecedents: [15000],
  },
  vip_yearly: {
    amountXof: 15000, durationDays: 365, tier: 'VIP' as PlanTier,
    vip: true, analysisLimit: UNLIMITED, label: 'VIP Annuel',
    montantsPrecedents: [60000, 30000],
  },
} as const;

export type PlanKey = keyof typeof PLANS;

/**
 * Correspondance des anciens identifiants vers les nouveaux.
 * Les abonnements déjà vendus (« monthly » à 15 000, « yearly », « lifetime »
 * hérité de Moneroo) doivent continuer de fonctionner sans intervention.
 */
const LEGACY_PLANS: Record<string, PlanKey> = {
  monthly: 'pro_monthly',
  yearly: 'vip_yearly',
  lifetime: 'vip_yearly',
};

/** Normalise un identifiant stocké en base vers une offre courante. */
export function normalizePlan(stored: string | null | undefined): PlanKey | null {
  if (!stored) return null;
  if (stored in PLANS) return stored as PlanKey;
  return LEGACY_PLANS[stored] ?? null;
}

/**
 * Retrouve l'offre à partir du montant payé, en FCFA.
 *
 * Les montants précédents restent acceptés, et ce n'est pas un détail : une
 * page de paiement ouverte avant une baisse de prix est réglée au tarif de
 * l'époque. Sans cette tolérance, le contrôle croisé du webhook rejetterait la
 * vente — le client serait débité sans recevoir son abonnement. C'est arrivé
 * pour dix ventes restées en attente pendant le passage aux nouveaux tarifs.
 *
 * Le montant courant est cherché en premier : si un ancien prix venait un jour
 * à coïncider avec le prix actuel d'une autre offre, c'est l'offre réellement
 * en vente qui l'emporte.
 */
export function planFromAmount(amountXof: number): PlanKey | null {
  const cles = Object.keys(PLANS) as PlanKey[];
  const courant = cles.find((k) => PLANS[k].amountXof === amountXof);
  if (courant) return courant;

  const precedent = cles.find((k) =>
    (PLANS[k].montantsPrecedents as readonly number[]).includes(amountXof)
  );
  return precedent ?? null;
}

// Comptes avec droits permanents (fondateur/équipe). Les admins ont tous les accès.
// Les administrateurs sont désormais listés dans un module unique. Les tenir
// ici en double signifiait qu'ajouter quelqu'un ouvrait /admin sans lui donner
// les droits correspondants — ou l'inverse.
import { ADMIN_EMAILS } from './admins';
const PERMANENT_PREMIUM_EMAILS = ['abdoulayecamara2708@gmail.com'];

/**
 * Partenaires : accès VIP offert, sans échéance et sans paiement.
 *
 * Réservé aux influenceurs et partenaires du lancement. Ils obtiennent tout ce
 * que donne l'abonnement VIP annuel — Analyseur, Agent IA, analyses illimitées —
 * mais AUCUN droit d'administration : l'accès admin reste attaché au seul
 * ADMIN_EMAILS ci-dessus.
 *
 * L'accès est accordé sur l'adresse e-mail, donc avant même la création du
 * compte : le partenaire s'inscrit quand il le souhaite et se retrouve VIP dès
 * sa première connexion, sans intervention. Pour retirer l'accès, supprimer la
 * ligne et redéployer.
 */
const PERMANENT_VIP_EMAILS = [
  'chrisbillalbabou@icloud.com',
  'traoreismaela753@gmail.com',
  'kbeken099@gmail.com',
  'alphakba8@gmail.com', // Alpha
];

/**
 * Accès offerts, tous niveaux confondus, exposés pour l'administration.
 *
 * Ces comptes ne génèrent aucune ligne dans la table des abonnements — ils ne
 * paient pas. Sans cette liste, l'administration les afficherait en « Gratuit »
 * et ils resteraient invisibles dans le suivi.
 */
export const ACCES_OFFERTS: { email: string; niveau: Extract<PlanTier, 'VIP' | 'PRO'> }[] = [
  ...PERMANENT_VIP_EMAILS.map((email) => ({ email, niveau: 'VIP' as const })),
  ...PERMANENT_PREMIUM_EMAILS.map((email) => ({ email, niveau: 'PRO' as const })),
];

/** Niveau offert à cette adresse, ou null si elle n'en a aucun. */
export function niveauOffert(email: string | null | undefined) {
  if (!email) return null;
  return ACCES_OFFERTS.find((a) => a.email === email.toLowerCase())?.niveau ?? null;
}

const FREE_ENTITLEMENTS: Entitlements = {
  plan: 'FREE',
  premium: false,
  vip: false,
  analysisLimit: 0,
  expiresAt: null,
  periodStart: null,
  isAdmin: false,
};

/**
 * Début de la période de quota en cours.
 *
 * Le quota se renouvelle tous les 30 jours à compter de la souscription — et
 * non le 1er du mois : un abonné du 20 doit retrouver ses analyses le 20, pas
 * dix jours plus tard. Un simple compteur global, jamais réinitialisé, aurait
 * bloqué l'utilisateur définitivement une fois sa limite atteinte.
 */
export function currentPeriodStart(
  subscribedAt: string,
  durationDays: number,
  now: Date = new Date()
): Date {
  const anchor = new Date(subscribedAt).getTime();
  const cycle = durationDays * 24 * 60 * 60 * 1000;
  const elapsed = Math.max(0, now.getTime() - anchor);
  return new Date(anchor + Math.floor(elapsed / cycle) * cycle);
}

/**
 * Calcule les droits d'un utilisateur à partir de la table subscriptions.
 * Règles :
 *  - yearly actif  -> Premium + VIP
 *  - monthly actif -> Premium seul
 *  - lifetime (héritage Moneroo) -> traité comme yearly
 *  - sinon FREE
 */
export async function computeEntitlements(
  supabase: SupabaseClient,
  user: User
): Promise<Entitlements> {
  const email = user.email?.toLowerCase() ?? '';

  // Import différé : `offres.ts` importe ce module pour ses valeurs de repli.
  // Un import statique créerait un cycle. Le cache interne du module évite
  // d'interroger la base à chaque calcul de droits.
  const { lireOffres } = await import('./offres');
  const offres = await lireOffres().catch(() => null);
  const offresPro = offres?.pro_monthly;

  if (ADMIN_EMAILS.includes(email)) {
    return {
      plan: 'VIP', premium: true, vip: true, analysisLimit: UNLIMITED,
      expiresAt: null, periodStart: null, isAdmin: true,
    };
  }
  if (PERMANENT_VIP_EMAILS.includes(email)) {
    return {
      plan: 'VIP', premium: true, vip: true, analysisLimit: UNLIMITED,
      expiresAt: null, periodStart: null, isAdmin: false,
    };
  }
  if (PERMANENT_PREMIUM_EMAILS.includes(email)) {
    return {
      plan: 'PRO', premium: true, vip: offresPro?.agentVip ?? PLANS.pro_monthly.vip,
      analysisLimit: offresPro?.limiteAnalyses ?? PLANS.pro_monthly.analysisLimit,
      expiresAt: null, periodStart: null, isAdmin: false,
    };
  }

  const CHAMPS = 'plan, status, expires_at, created_at';
  const { data, error } = await supabase
    .from('subscriptions')
    .select(CHAMPS)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  let subscriptions = data;

  // ── AVANT DE DIRE « GRATUIT », VÉRIFIER QU'ELLE N'A PAS PAYÉ ───────────
  //
  // Le 26 août 2026, Kevine Ndembo a payé 2 000 FCFA à 12h22. La boutique a
  // bien encaissé — statut « completed », MTN MoMo — mais sa notification ne
  // nous est jamais parvenue. Pendant trois heures, cette ligne exactement a
  // conclu « gratuit », et l'application lui a servi l'aperçu à 15 % de
  // l'analyse. Il a réessayé de payer, a renoncé, puis a écrit.
  //
  // L'ouverture normale marche : 90 % des accès s'ouvrent en moins de deux
  // minutes, médiane 45 secondes. Le rattrapage complet, lui, ne passe qu'une
  // fois par nuit — et la tâche qui le porte ne s'est déclenchée que cinq
  // jours sur douze. Deux défaillances rares, additionnées sur un seul client.
  //
  // On ajoute donc le seul angle qui manquait : l'instant où la personne
  // regarde son écran. La vérification est enveloppée de deux verrous — une
  // lecture en base d'abord, une mémoire de cinq minutes ensuite — pour que
  // les cinq mille visiteurs gratuits ne déclenchent aucun appel externe.
  // Voir `acces-immediat.ts`.
  if (!error && !subscriptions?.length) {
    const [{ ouvrirAccesPayeSiBesoin }, { createAdminClient }] = await Promise.all([
      import('./acces-immediat'),
      import('./supabase-admin'),
    ]);
    const admin = createAdminClient();

    if ((await ouvrirAccesPayeSiBesoin(admin, user)).ouvert) {
      // Relecture par le client de service : l'abonnement vient d'être écrit,
      // et le client de session pourrait ne pas le voir immédiatement.
      const { data: apres } = await admin
        .from('subscriptions')
        .select(CHAMPS)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      subscriptions = apres as typeof data;
    }
  }

  if (error || !subscriptions?.length) return FREE_ENTITLEMENTS;

  const now = Date.now();
  // Classement par niveau : un abonné qui cumule plusieurs abonnements actifs
  // bénéficie toujours du plus avantageux.
  const RANK: Record<PlanTier, number> = { FREE: 0, ESSENTIAL: 1, PRO: 2, VIP: 3 };
  let best: Entitlements = FREE_ENTITLEMENTS;

  // ── CHAQUE ACHAT DONNE SON QUOTA, TOUT DE SUITE ─────────────────────────
  //
  // Ce qui se passait : la boucle ne retenait QUE l'abonnement du meilleur
  // niveau (`RANK <= RANK` écarte les suivants). Deux abonnements Essentiel
  // étant du même niveau, le second était purement ignoré — il ne donnait
  // aucune analyse, seulement des jours de validité en plus.
  //
  // Le 28 août 2026 à 10 h 49 et 10 h 50, quelqu'un a payé DEUX FOIS 2 000
  // FCFA. Il a reçu 20 analyses. Il en a fait 20, s'est retrouvé bloqué, et a
  // écrit : « Je paye deux fois, normalement 40 analyses. » Il avait raison :
  // 4 000 francs encaissés, un quota servi.
  //
  // ── LA RÈGLE, TELLE QUE LE PROPRIÉTAIRE L'ÉNONCE ────────────────────────
  //
  // « Il achète 2 000, il a 20 analyses. Il les finit, il rachète 2 000, on
  // lui redonne 20 analyses. Même le même jour. Même cinquante fois. »
  //
  // Ce n'est pas un abonnement à débit mensuel : c'est un carnet qu'on
  // recharge. Le quota est donc la SOMME des offres achetées et encore
  // valides, et la période de décompte part de la plus ancienne d'entre elles
  // — sinon un rachat effacerait les analyses déjà consommées sur la
  // précédente, et ferait cadeau de ce qui a déjà servi.
  //
  // Le niveau, l'Agent VIP et la date d'expiration continuent, eux, de suivre
  // l'abonnement le plus avantageux : quelqu'un qui cumule un Essentiel et un
  // Pro reste Pro.
  let quotaCumule = 0;
  let quotaIllimite = false;
  let debutLePlusAncien: string | null = null;

  for (const sub of subscriptions) {
    // Une absence de date d'expiration ne vaut accès permanent que pour les
    // anciens abonnements « lifetime » (héritage Moneroo). Pour tout le reste,
    // une date valide et future est exigée : un abonnement expiré ne donne
    // plus aucun droit.
    const active = sub.expires_at
      ? new Date(sub.expires_at).getTime() > now
      : sub.plan === 'lifetime';
    if (!active) continue;

    const key = normalizePlan(sub.plan);
    if (!key) continue;
    const config = PLANS[key];
    // Le quota et l'acces a l'Agent VIP sont modifiables depuis
    // l'administration : un acces en cours suit TOUJOURS la valeur actuelle.
    // Faire monter le quota de dix a vingt doit profiter aux abonnes existants
    // le jour meme, sans qu'ils aient a se reabonner.
    const reglee = offres?.[key];

    // ── LE CUMUL SE FAIT AVANT LE CLASSEMENT ──────────────────────────────
    //
    // Ces trois lignes doivent être AU-DESSUS du `continue` qui écarte les
    // abonnements de niveau inférieur ou égal : c'est précisément ceux-là
    // qu'on oubliait, et ce sont eux que le client a payés.
    const limite = reglee?.limiteAnalyses ?? config.analysisLimit;
    if (limite === UNLIMITED) quotaIllimite = true;
    else quotaCumule += limite;

    const debut = sub.created_at
      ? currentPeriodStart(sub.created_at, config.durationDays).toISOString()
      : null;
    if (debut && (!debutLePlusAncien || debut < debutLePlusAncien)) debutLePlusAncien = debut;

    if (RANK[config.tier] <= RANK[best.plan]) continue;

    best = {
      plan: config.tier,
      premium: true,
      vip: reglee?.agentVip ?? config.vip,
      analysisLimit: limite,
      expiresAt: sub.expires_at,
      periodStart: debut,
      isAdmin: false,
    };
  }

  // Le quota et la période retenus sont ceux de TOUS les achats valides, pas
  // du seul mieux classé. Sans abonnement actif, rien n'a été cumulé et l'on
  // rend les droits gratuits inchangés.
  if (!best.premium) return best;

  return {
    ...best,
    analysisLimit: quotaIllimite ? UNLIMITED : quotaCumule,
    periodStart: debutLePlusAncien,
  };
}

// Une session dont la dernière connexion remonte à plus de 24h n'est plus
// valable. Contrôlé ici — point de passage unique de toutes les gardes — pour
// que les routes API soient couvertes au même titre que les pages.
const MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000;

function isSessionFresh(user: User): boolean {
  const lastSignIn = user.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : 0;
  return lastSignIn > 0 && Date.now() - lastSignIn <= MAX_SESSION_AGE_MS;
}

/** Récupère l'utilisateur connecté et ses droits en une seule fois. */
export async function getSessionEntitlements(): Promise<{
  user: User | null;
  entitlements: Entitlements;
}> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { user: null, entitlements: FREE_ENTITLEMENTS };
  if (!isSessionFresh(user)) return { user: null, entitlements: FREE_ENTITLEMENTS };
  return { user, entitlements: await computeEntitlements(supabase, user) };
}

type Guard =
  | { ok: true; user: User; entitlements: Entitlements }
  | { ok: false; response: NextResponse };

/** Garde d'API : exige un utilisateur connecté. */
export async function requireUser(): Promise<Guard> {
  const { user, entitlements } = await getSessionEntitlements();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Authentification requise.' }, { status: 401 }),
    };
  }
  return { ok: true, user, entitlements };
}

/** Garde d'API : exige un abonnement Premium actif (Mensuel ou Annuel). */
export async function requirePremium(): Promise<Guard> {
  const guard = await requireUser();
  if (!guard.ok) return guard;
  if (!guard.entitlements.premium) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Abonnement Premium requis.', code: 'PREMIUM_REQUIRED' },
        { status: 403 }
      ),
    };
  }
  return guard;
}

/** Garde d'API : exige l'abonnement Annuel (accès VIP). */
export async function requireVip(): Promise<Guard> {
  const guard = await requireUser();
  if (!guard.ok) return guard;
  if (!guard.entitlements.vip) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Abonnement Annuel (VIP) requis.', code: 'VIP_REQUIRED' },
        { status: 403 }
      ),
    };
  }
  return guard;
}
