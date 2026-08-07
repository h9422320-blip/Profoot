import { PLANS, PlanKey, planFromAmount } from '@/lib/subscription';

/**
 * Client de l'API Chariow (https://chariow.dev).
 * Toutes les interactions avec Chariow passent par ce module : si Chariow fait
 * évoluer son API (abonnements natifs, nouveaux endpoints), seul ce fichier
 * et les routes /api/payments/chariow changent.
 */

const CHARIOW_API_URL = 'https://api.chariow.com/v1';

/**
 * Chariow valide le numéro selon le plan de numérotation du pays. Quand le
 * compte n'a pas de téléphone, on doit donc fournir un numéro cohérent avec le
 * pays de l'acheteur — sinon la vente est refusée. Ces numéros de remplissage
 * sont pré-validés pour chaque marché ; l'acheteur saisit le sien sur la page
 * de paiement.
 */
const FALLBACK_NUMBERS: Record<string, string> = {
  GN: '620000000',   // Guinée
  CI: '0707070707',  // Côte d'Ivoire
  SN: '771234567',   // Sénégal
  ML: '70123456',    // Mali
  BF: '70123456',    // Burkina Faso
  TG: '90123456',    // Togo
  BJ: '0197123456',  // Bénin
  CM: '670000000',   // Cameroun
  FR: '600000000',   // France
  MA: '600000000',   // Maroc
};
const DEFAULT_COUNTRY = 'GN';

function fallbackPhone(country?: string) {
  const cc = (country || '').toUpperCase();
  if (cc && FALLBACK_NUMBERS[cc]) {
    return { number: FALLBACK_NUMBERS[cc], country_code: cc };
  }
  return { number: FALLBACK_NUMBERS[DEFAULT_COUNTRY], country_code: DEFAULT_COUNTRY };
}

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
  // Chariow exige un téléphone ET valide le numéro selon le code pays : un
  // numéro de remplissage n'est accepté que s'il correspond au plan de
  // numérotation du pays envoyé. Sans numéro connu, on utilise donc un couple
  // (pays, numéro) cohérent et non un pays deviné depuis l'adresse IP —
  // l'acheteur corrige de toute façon ses coordonnées sur la page de paiement.
  const phoneDigits = params.phoneNumber?.replace(/\D/g, '');
  const neutralPhone = fallbackPhone(params.phoneCountryCode);
  body.phone =
    phoneDigits && phoneDigits.length >= 6
      ? { number: phoneDigits, country_code: neutralPhone.country_code }
      : neutralPhone;

  const post = async (payload: Record<string, unknown>) => {
    const res = await fetch(`${CHARIOW_API_URL}/checkout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return { res, json: await res.json().catch(() => ({})) };
  };

  let { res, json: data } = await post(body);

  // Le téléphone enregistré peut être invalide pour le pays détecté : plutôt
  // que de bloquer la vente, on refait la tentative avec le couple neutre.
  if (!res.ok && JSON.stringify(data?.errors ?? data?.message ?? '').toLowerCase().includes('phone')) {
    console.warn('Chariow a refusé le téléphone, nouvelle tentative avec le numéro de repli.');
    ({ res, json: data } = await post({ ...body, phone: neutralPhone }));
    // Dernier recours : le pays lui-même n'est pas exploitable.
    if (!res.ok) {
      ({ res, json: data } = await post({ ...body, phone: fallbackPhone(DEFAULT_COUNTRY) }));
    }
  }

  if (!res.ok) {
    console.error('Erreur checkout Chariow:', res.status, data);
    throw new Error(data?.message || `Chariow a refusé la création du paiement (${res.status}).`);
  }

  const payload = data?.data ?? data;
  // L'URL de paiement se trouve dans `payment.checkout_url` ; les autres
  // emplacements sont des replis au cas où Chariow ferait évoluer sa réponse.
  const checkoutUrl =
    payload?.payment?.checkout_url ??
    payload?.checkout_url ??
    payload?.purchase?.checkout_url ??
    payload?.purchase?.payment?.checkout_url;

  if (!checkoutUrl && payload?.step === 'payment') {
    console.error('Chariow: aucune URL de paiement dans la réponse:', JSON.stringify(payload).slice(0, 500));
  }

  return {
    step: payload?.step ?? 'payment',
    checkoutUrl,
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
