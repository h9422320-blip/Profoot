import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';

/**
 * Source de vérité unique des plans et des droits d'accès ProFoot AI.
 * Toute décision d'accès (Premium, VIP) DOIT passer par ce module, côté serveur.
 */

export type PlanTier = 'FREE' | 'MONTHLY' | 'YEARLY';

export interface Entitlements {
  plan: PlanTier;
  premium: boolean;   // Analyseur IA, stats avancées, compétitions, historique…
  vip: boolean;       // Agent IA VIP + exclusivités
  expiresAt: string | null;
  isAdmin: boolean;
}

// Configuration des offres — montants en FCFA (XOF), source de vérité pour le
// checkout ET la validation des webhooks. Ne jamais dupliquer ces montants ailleurs.
export const PLANS = {
  monthly: { amountXof: 15000, durationDays: 30, tier: 'MONTHLY' as PlanTier, vip: false, label: 'Mensuel' },
  yearly: { amountXof: 60000, durationDays: 365, tier: 'YEARLY' as PlanTier, vip: true, label: 'Annuel' },
} as const;

export type PlanKey = keyof typeof PLANS;

export function planFromAmount(amountXof: number): PlanKey | null {
  if (amountXof === PLANS.monthly.amountXof) return 'monthly';
  if (amountXof === PLANS.yearly.amountXof) return 'yearly';
  return null;
}

// Comptes avec droits permanents (fondateur/équipe). Les admins ont tous les accès.
const ADMIN_EMAILS = ['h9422320@gmail.com'];
const PERMANENT_PREMIUM_EMAILS = ['abdoulayecamara2708@gmail.com'];

const FREE_ENTITLEMENTS: Entitlements = {
  plan: 'FREE',
  premium: false,
  vip: false,
  expiresAt: null,
  isAdmin: false,
};

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
    return { plan: 'YEARLY', premium: true, vip: true, expiresAt: null, isAdmin: true };
  }
  if (PERMANENT_PREMIUM_EMAILS.includes(email)) {
    return { plan: 'MONTHLY', premium: true, vip: false, expiresAt: null, isAdmin: false };
  }

  const { data: subscriptions, error } = await supabase
    .from('subscriptions')
    .select('plan, status, expires_at')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error || !subscriptions?.length) return FREE_ENTITLEMENTS;

  const now = Date.now();
  let best: Entitlements = FREE_ENTITLEMENTS;

  for (const sub of subscriptions) {
    const active = !sub.expires_at || new Date(sub.expires_at).getTime() > now;
    if (!active) continue;

    if (sub.plan === 'yearly' || sub.plan === 'lifetime') {
      return { plan: 'YEARLY', premium: true, vip: true, expiresAt: sub.expires_at, isAdmin: false };
    }
    if (sub.plan === 'monthly' && best.plan === 'FREE') {
      best = { plan: 'MONTHLY', premium: true, vip: false, expiresAt: sub.expires_at, isAdmin: false };
    }
  }

  return best;
}

/** Récupère l'utilisateur connecté et ses droits en une seule fois. */
export async function getSessionEntitlements(): Promise<{
  user: User | null;
  entitlements: Entitlements;
}> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { user: null, entitlements: FREE_ENTITLEMENTS };
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
