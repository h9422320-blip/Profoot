import { PLANS, PlanKey, planFromAmount } from '@/lib/subscription';

/**
 * Client de l'API Chariow (https://chariow.dev).
 * Toutes les interactions avec Chariow passent par ce module : si Chariow fait
 * évoluer son API (abonnements natifs, nouveaux endpoints), seul ce fichier
 * et les routes /api/payments/chariow changent.
 */

const CHARIOW_API_URL = 'https://api.chariow.com/v1';

function apiKey(): string {
  const key = process.env.CHARIOW_API_KEY;
  if (!key) throw new Error('CHARIOW_API_KEY manquante.');
  return key;
}

/** ID du produit Chariow correspondant à chaque offre ProFoot. */
export function productIdForPlan(plan: PlanKey): string {
  const id =
    plan === 'monthly'
      ? process.env.CHARIOW_PRODUCT_ID_MONTHLY
      : process.env.CHARIOW_PRODUCT_ID_YEARLY;
  if (!id) throw new Error(`CHARIOW_PRODUCT_ID_${plan.toUpperCase()} manquante.`);
  return id;
}

/** Retrouve l'offre à partir d'un ID produit Chariow (source primaire). */
export function planFromProductId(productId: string | undefined): PlanKey | null {
  if (!productId) return null;
  if (productId === process.env.CHARIOW_PRODUCT_ID_MONTHLY) return 'monthly';
  if (productId === process.env.CHARIOW_PRODUCT_ID_YEARLY) return 'yearly';
  return null;
}

/**
 * Détermine l'offre payée de la façon la plus fiable possible, par ordre de
 * confiance : 1) ID produit, 2) métadonnées du checkout, 3) montant en XOF.
 * Le montant sert aussi de contrôle croisé quand une source primaire existe.
 */
export function resolvePaidPlan(input: {
  productId?: string;
  metadataPlan?: string;
  amountValue?: number;
  amountCurrency?: string;
}): PlanKey | null {
  const byProduct = planFromProductId(input.productId);
  const byMetadata =
    input.metadataPlan === 'monthly' || input.metadataPlan === 'yearly'
      ? (input.metadataPlan as PlanKey)
      : null;
  const byAmount =
    input.amountCurrency?.toUpperCase() === 'XOF' && typeof input.amountValue === 'number'
      ? planFromAmount(input.amountValue)
      : null;

  // Un produit identifié qui n'appartient pas à ProFoot ne doit JAMAIS activer
  // d'abonnement, même si ses métadonnées annoncent une offre : sinon l'achat
  // d'un produit bon marché de la boutique pourrait débloquer le VIP.
  if (input.productId && !byProduct) return null;

  const plan = byProduct ?? byMetadata ?? byAmount;
  if (!plan) return null;

  // Contrôle croisé : si le montant XOF est connu mais ne correspond pas au
  // plan déduit, on refuse (protège contre un produit mal configuré côté store).
  if (byAmount && byAmount !== plan) return null;
  return plan;
}

export interface ChariowCheckoutSession {
  step: 'payment' | 'completed' | 'already_purchased';
  checkoutUrl?: string;
}

/** Crée une session de paiement Chariow pour un utilisateur ProFoot. */
export async function initCheckout(params: {
  plan: PlanKey;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  phoneCountryCode?: string;
  redirectUrl: string;
}): Promise<ChariowCheckoutSession> {
  const body: Record<string, unknown> = {
    product_id: productIdForPlan(params.plan),
    email: params.email,
    first_name: params.firstName.slice(0, 50),
    last_name: params.lastName.slice(0, 50),
    redirect_url: params.redirectUrl,
    // Reliera le paiement à l'utilisateur dans le webhook successful.sale.
    custom_metadata: {
      user_id: params.userId,
      plan: params.plan,
      app: 'profoot',
    },
  };
  // Le téléphone est obligatoire côté Chariow ; repli neutre si l'utilisateur
  // n'en a pas renseigné (il pourra le corriger sur la page de paiement).
  const phoneDigits = params.phoneNumber?.replace(/\D/g, '');
  body.phone = {
    number: phoneDigits && phoneDigits.length >= 5 ? phoneDigits : '600000000',
    country_code: params.phoneCountryCode || 'GN',
  };

  const res = await fetch(`${CHARIOW_API_URL}/checkout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('Erreur checkout Chariow:', res.status, data);
    throw new Error(data?.message || `Chariow a refusé la création du paiement (${res.status}).`);
  }

  const payload = data?.data ?? data;
  return {
    step: payload?.step ?? 'payment',
    checkoutUrl: payload?.checkout_url,
  };
}

export interface ChariowSale {
  id: string;
  status: string;
  amount?: { value?: number; currency?: string };
  product?: { id?: string; name?: string };
  customer?: { id?: string; email?: string };
  custom_metadata?: Record<string, string> | null;
}

/**
 * Liste les ventes complétées associées à un email client.
 * Utilisé en réconciliation si un webhook a été manqué.
 */
export async function listCompletedSalesByEmail(email: string): Promise<ChariowSale[]> {
  const url = new URL(`${CHARIOW_API_URL}/sales`);
  url.searchParams.set('search', email);
  url.searchParams.set('status', 'completed');
  url.searchParams.set('per_page', '50');

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey()}`, Accept: 'application/json' },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('Erreur listing ventes Chariow:', res.status, data);
    throw new Error(`Impossible de vérifier les ventes Chariow (${res.status}).`);
  }
  return Array.isArray(data?.data) ? data.data : [];
}

/** Durée et niveau d'un plan — réexport pratique pour les routes de paiement. */
export function planConfig(plan: PlanKey) {
  return PLANS[plan];
}
