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
export const PLANS = {
  essential_monthly: {
    amountXof: 9000, durationDays: 30, tier: 'ESSENTIAL' as PlanTier,
    vip: false, analysisLimit: 10, label: 'Essentiel',
  },
  pro_monthly: {
    amountXof: 15000, durationDays: 30, tier: 'PRO' as PlanTier,
    vip: false, analysisLimit: 20, label: 'Pro',
  },
  vip_yearly: {
    amountXof: 60000, durationDays: 365, tier: 'VIP' as PlanTier,
    vip: true, analysisLimit: UNLIMITED, label: 'VIP Annuel',
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

export function planFromAmount(amountXof: number): PlanKey | null {
  const found = (Object.keys(PLANS) as PlanKey[]).find(
    (k) => PLANS[k].amountXof === amountXof
  );
  return found ?? null;
}

// Comptes avec droits permanents (fondateur/équipe). Les admins ont tous les accès.
const ADMIN_EMAILS = ['h9422320@gmail.com'];
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
const PERMANENT_VIP_EMAILS = ['chrisbillalbabou@icloud.com'];

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
      plan: 'PRO', premium: true, vip: false, analysisLimit: PLANS.pro_monthly.analysisLimit,
      expiresAt: null, periodStart: null, isAdmin: false,
    };
  }

  const { data: subscriptions, error } = await supabase
    .from('subscriptions')
    .select('plan, status, expires_at, created_at')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error || !subscriptions?.length) return FREE_ENTITLEMENTS;

  const now = Date.now();
  // Classement par niveau : un abonné qui cumule plusieurs abonnements actifs
  // bénéficie toujours du plus avantageux.
  const RANK: Record<PlanTier, number> = { FREE: 0, ESSENTIAL: 1, PRO: 2, VIP: 3 };
  let best: Entitlements = FREE_ENTITLEMENTS;

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

    if (RANK[config.tier] <= RANK[best.plan]) continue;

    best = {
      plan: config.tier,
      premium: true,
      vip: config.vip,
      analysisLimit: config.analysisLimit,
      expiresAt: sub.expires_at,
      periodStart: sub.created_at
        ? currentPeriodStart(sub.created_at, config.durationDays).toISOString()
        : null,
      isAdmin: false,
    };
  }

  return best;
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
