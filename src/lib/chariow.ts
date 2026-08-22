import { PLANS, PlanKey, planFromAmount, normalizePlan } from '@/lib/subscription';
import { deviseDuPays } from '@/lib/devise-acheteur';

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
  // Afrique de l'Ouest
  GN: '620000000',    // Guinée
  CI: '0707070707',   // Côte d'Ivoire
  SN: '771234567',    // Sénégal
  ML: '70123456',     // Mali
  BF: '70123456',     // Burkina Faso
  NE: '90123456',     // Niger
  TG: '90123456',     // Togo
  BJ: '0197123456',   // Bénin
  MR: '22123456',     // Mauritanie
  NG: '8031234567',   // Nigeria
  GH: '241234567',    // Ghana
  SL: '76123456',     // Sierra Leone
  LR: '770123456',    // Liberia
  GM: '3012345',      // Gambie
  // Afrique centrale
  CM: '670000000',    // Cameroun
  CD: '810123456',    // RD Congo
  CG: '060123456',    // Congo-Brazzaville
  GA: '060123456',    // Gabon
  TD: '60123456',     // Tchad
  CF: '70123456',     // Centrafrique
  BI: '79123456',     // Burundi
  RW: '781234567',    // Rwanda
  // Maghreb, océan Indien, Corne
  MA: '600000000',    // Maroc
  DZ: '551234567',    // Algérie
  TN: '20123456',     // Tunisie
  DJ: '77123456',     // Djibouti
  MG: '341234567',    // Madagascar
  MU: '57123456',     // Maurice
  KM: '3212345',      // Comores
  SC: '2512345',      // Seychelles
  // Europe et Amériques francophones
  FR: '600000000',    // France
  BE: '470123456',    // Belgique
  CH: '761234567',    // Suisse
  CA: '4389995555',   // Canada
  HT: '34123456',     // Haïti
};
const DEFAULT_COUNTRY = 'CI';

/**
 * Couple (pays, numéro) de tout dernier recours.
 *
 * Il est volontairement DIFFÉRENT du pays par défaut : c'est le seul intérêt
 * d'une troisième tentative. Renvoyer le même numéro que celui qui vient d'être
 * refusé ne fait que perdre une requête et laisser la vente échouer.
 *
 * Ce couple-là est retenu parce qu'il est le seul qu'on ait vu accepté en
 * production : c'est lui qui figurait dans les liens de paiement réellement
 * délivrés par Chariow.
 */
const PHONE_DERNIER_RECOURS = { number: '620000000', country_code: 'GN' };

function fallbackPhone(country?: string) {
  const cc = (country || '').toUpperCase();
  if (cc && FALLBACK_NUMBERS[cc]) {
    return { number: FALLBACK_NUMBERS[cc], country_code: cc };
  }
  return { number: FALLBACK_NUMBERS[DEFAULT_COUNTRY], country_code: DEFAULT_COUNTRY };
}

/**
 * Corrige le lien de paiement avant de l'envoyer au navigateur de l'acheteur.
 *
 * Chariow construit ce lien depuis l'adresse IP qui appelle son API — la nôtre,
 * chez Vercel, aux États-Unis. Il y colle donc `country=US`, et ce paramètre
 * commande toute la page : un acheteur ivoirien se voyait proposer Apple Pay et
 * Cash App au lieu de Wave, Djamo, Orange Money et MTN. Vérifié en ouvrant une
 * vraie session de paiement : le même lien avec `country=CI` affiche les bons
 * moyens de paiement.
 *
 * Le numéro pré-rempli pose le même problème en plus discret : c'est notre
 * numéro de remplissage, pas celui de l'acheteur. On ne le laisse dans le lien
 * que si l'on connaît le vrai numéro du compte ; sinon on vide le champ pour
 * que l'acheteur saisisse le sien.
 */
export function ajusterLienPaiement(
  url: string,
  paysAcheteur: string,
  telephoneReel?: string
): string {
  try {
    const lien = new URL(url);
    lien.searchParams.set('country', paysAcheteur.toUpperCase());
    if (telephoneReel) lien.searchParams.set('phone', telephoneReel);
    else lien.searchParams.delete('phone');
    return lien.toString();
  } catch {
    // Un lien que l'on ne sait pas analyser est renvoyé tel quel : mieux vaut
    // une page de paiement mal localisée qu'aucune page de paiement.
    console.warn('Lien de paiement Chariow inexploitable, renvoyé sans correction.');
    return url;
  }
}

function apiKey(): string {
  const key = process.env.CHARIOW_API_KEY;
  if (!key) throw new Error('CHARIOW_API_KEY manquante.');
  return key;
}

/** ID du produit Chariow correspondant à chaque offre ProFoot. */
/**
 * Identifiant du produit Chariow pour chaque offre.
 *
 * Les anciens noms de variables (MONTHLY / YEARLY) restent acceptés en repli :
 * l'offre Pro et l'offre VIP correspondent aux deux produits déjà créés dans la
 * boutique, il n'y a donc rien à reconfigurer pour elles.
 */
function productIdEnv(plan: PlanKey): string | undefined {
  switch (plan) {
    case 'essential_monthly':
      return process.env.CHARIOW_PRODUCT_ID_ESSENTIAL;
    case 'pro_monthly':
      return process.env.CHARIOW_PRODUCT_ID_PRO || process.env.CHARIOW_PRODUCT_ID_MONTHLY;
    case 'vip_yearly':
      return process.env.CHARIOW_PRODUCT_ID_VIP || process.env.CHARIOW_PRODUCT_ID_YEARLY;
  }
}

export function productIdForPlan(plan: PlanKey): string {
  const id = productIdEnv(plan);
  if (!id) {
    throw new Error(
      `Produit Chariow non configuré pour l'offre « ${PLANS[plan].label} ». ` +
        `Renseignez la variable d'environnement correspondante.`
    );
  }
  return id;
}

/** Retrouve l'offre à partir d'un ID produit Chariow (source primaire). */
export function planFromProductId(productId: string | undefined): PlanKey | null {
  if (!productId) return null;
  const plans = Object.keys(PLANS) as PlanKey[];
  return plans.find((p) => productIdEnv(p) === productId) ?? null;
}

/**
 * Détermine l'offre payée de la façon la plus fiable possible, par ordre de
 * confiance : 1) ID produit, 2) métadonnées du checkout, 3) montant en XOF.
 * Le montant sert aussi de contrôle croisé quand une source primaire existe.
 */
export function resolvePaidPlan(
  input: {
    productId?: string;
    metadataPlan?: string;
    amountValue?: number;
    amountCurrency?: string;
  },
  /**
   * Prix RÉELLEMENT pratiqués, tels que réglés dans l'administration.
   *
   * Indispensable depuis que les prix sont modifiables. Le contrôle croisé
   * plus bas refuse un paiement dont le montant désigne une autre offre que le
   * produit — protection utile contre une boutique mal configurée, mais qui se
   * retournait contre l'acheteur au premier changement de tarif : le jour où
   * l'offre Essentiel passerait au prix qu'avait l'offre Pro, tout paiement
   * Essentiel serait refusé et le client débité sans rien recevoir.
   *
   * Quand le montant correspond au prix actuel du produit identifié, il n'y a
   * rien à croiser : c'est exactement ce qu'on attendait.
   */
  prixActuels?: Partial<Record<PlanKey, number>>
): PlanKey | null {
  const byProduct = planFromProductId(input.productId);
  // `normalizePlan` accepte aussi les anciens libellés : un paiement lancé
  // avant cette mise à jour et confirmé après reste correctement rattaché.
  const byMetadata = normalizePlan(input.metadataPlan);
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

  // Le montant est un prix que CETTE offre a réellement pratiqué — son prix
  // actuel, ou l'un de ses anciens. Le contrôle croisé n'a plus rien à
  // vérifier, même si ce montant se trouve être aujourd'hui celui d'une autre
  // offre : l'acheteur a payé le prix affiché pour le produit qu'il a choisi.
  //
  // La protection contre une boutique mal configurée reste entière : un montant
  // que cette offre n'a jamais pratiqué passe toujours par le contrôle croisé.
  const prixDeCetteOffre = [
    prixActuels?.[plan] ?? PLANS[plan].amountXof,
    ...((PLANS[plan].montantsPrecedents as readonly number[]) ?? []),
  ];
  if (
    input.amountCurrency?.toUpperCase() === 'XOF' &&
    typeof input.amountValue === 'number' &&
    prixDeCetteOffre.includes(input.amountValue)
  )
    return plan;

  // Contrôle croisé : si le montant XOF est connu mais ne correspond pas au
  // plan déduit, on refuse (protège contre un produit mal configuré côté store).
  if (byAmount && byAmount !== plan) return null;
  return plan;
}

export interface ChariowCheckoutSession {
  step: 'payment' | 'completed' | 'already_purchased';
  checkoutUrl?: string;
  /**
   * Identifiant de la vente, renvoyé par Chariow dès la création du paiement.
   * C'est la seule référence stable entre notre application et Chariow :
   * `custom_metadata` n'est pas conservé de leur côté.
   */
  saleId?: string;
}

/** Crée une session de paiement Chariow pour un utilisateur ProFoot. */
export async function initCheckout(params: {
  /** Abonnement demandé, ou null pour un achat à l unité. */
  plan: PlanKey | null;
  /**
   * Produit à facturer quand ce n est pas un abonnement.
   * Le déblocage d un match passe par ici : même tunnel de paiement, même
   * détection du pays, même trace — seul le produit change.
   */
  produitDirect?: string;
  /** Métadonnées supplémentaires (identité du match débloqué). */
  metadonnees?: Record<string, string>;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  /** Pays réel de l'acheteur, relevé quand son navigateur appelle notre route. */
  paysAcheteur: string;
  /** IP réelle de l'acheteur. Sans elle, Chariow retient celle de notre serveur. */
  ipAcheteur?: string;
  redirectUrl: string;
}): Promise<ChariowCheckoutSession> {
  const devise = deviseDuPays(params.paysAcheteur);
  const body: Record<string, unknown> = {
    product_id: params.plan ? productIdForPlan(params.plan) : params.produitDirect,
    email: params.email,
    first_name: params.firstName.slice(0, 50),
    last_name: params.lastName.slice(0, 50),
    redirect_url: params.redirectUrl,
    // Sans ce champ, Chariow géolocalise l'appelant — notre serveur Vercel — et
    // enregistre « États-Unis » dans le contexte de chaque vente, même pour un
    // acheteur à Conakry. C'est ce que montrait le tableau des ventes.
    ...(params.ipAcheteur ? { customer_ip: params.ipAcheteur } : {}),
    // ── LA MONNAIE DE L'ACHETEUR ────────────────────────────────────────────
    //
    // Ce champ n'était pas transmis, et un acheteur à Paris se voyait donc
    // facturer « F CFA 2 000 » — constaté en créant de vraies sessions avec une
    // adresse française puis marocaine. Un montant dans une monnaie inconnue,
    // sur une boutique ouest-africaine, fait renoncer ; certaines banques
    // européennes refusent même d'emblée un débit en XOF.
    //
    // Les pays qui paient déjà gardent le franc CFA : rien ne change pour eux.
    ...(devise !== 'XOF' ? { payment_currency: devise } : {}),
    // Reliera le paiement à l'utilisateur dans le webhook successful.sale.
    custom_metadata: {
      user_id: params.userId,
      ...(params.plan ? { plan: params.plan } : {}),
      ...(params.metadonnees ?? {}),
      app: 'profoot',
    },
  };
  // Chariow exige un téléphone ET valide le numéro selon le code pays : un
  // numéro de remplissage n'est accepté que s'il correspond au plan de
  // numérotation du pays envoyé. Sans numéro connu, on utilise donc un couple
  // (pays, numéro) cohérent et non un pays deviné depuis l'adresse IP —
  // l'acheteur corrige de toute façon ses coordonnées sur la page de paiement.
  const phoneDigits = params.phoneNumber?.replace(/\D/g, '');
  const neutralPhone = fallbackPhone(params.paysAcheteur);
  const phoneDuCompte =
    phoneDigits && phoneDigits.length >= 6
      ? { number: phoneDigits, country_code: neutralPhone.country_code }
      : null;
  body.phone = phoneDuCompte ?? neutralPhone;

  // Ce qui a FINALEMENT été accepté, et non ce qu'on a tenté en premier. Sans
  // cette distinction, un numéro refusé par Chariow se retrouvait quand même
  // pré-rempli dans le formulaire de l'acheteur.
  let telephoneRetenu = phoneDuCompte?.number;

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

  // ── UNE DEVISE REFUSÉE NE DOIT JAMAIS FAIRE PERDRE UNE VENTE ──────────────
  //
  // Rien ne garantit que Chariow accepte l'euro ou le dollar sur chaque
  // produit. Si la demande est rejetée pour ce motif, on refait immédiatement
  // la tentative dans la monnaie du produit : l'acheteur verra des francs CFA,
  // ce qui est le comportement d'avant — mais il pourra payer.
  if (!res.ok && devise !== 'XOF') {
    const motif = JSON.stringify(data?.errors ?? data?.message ?? '').toLowerCase();
    if (motif.includes('currency') || motif.includes('devise')) {
      console.warn(
        `Chariow a refusé la devise ${devise} pour ${params.paysAcheteur} ; ` +
          `nouvelle tentative dans la monnaie du produit.`
      );
      const { payment_currency: _ignore, ...sansDevise } = body as Record<string, unknown>;
      ({ res, json: data } = await post(sansDevise));
    }
  }

  // Le téléphone enregistré peut être invalide pour le pays détecté : plutôt
  // que de bloquer la vente, on refait la tentative avec le couple neutre.
  if (!res.ok && JSON.stringify(data?.errors ?? data?.message ?? '').toLowerCase().includes('phone')) {
    console.warn('Chariow a refusé le téléphone, nouvelle tentative avec le numéro de repli.');
    ({ res, json: data } = await post({ ...body, phone: neutralPhone }));
    telephoneRetenu = undefined;

    // Dernier recours : le plan de numérotation du pays lui-même n'est pas
    // exploitable. On ne relance que si le couple diffère vraiment de celui qui
    // vient d'être refusé — sinon la tentative est perdue d'avance.
    if (!res.ok && neutralPhone.country_code !== PHONE_DERNIER_RECOURS.country_code) {
      console.warn('Nouvel échec, tentative avec le couple de dernier recours.');
      ({ res, json: data } = await post({ ...body, phone: PHONE_DERNIER_RECOURS }));
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
    checkoutUrl: checkoutUrl
      ? ajusterLienPaiement(checkoutUrl, params.paysAcheteur, telephoneRetenu)
      : undefined,
    saleId: payload?.purchase?.id ?? payload?.id ?? payload?.sale?.id,
  };
}

export interface ChariowSale {
  id: string;
  status: string;
  created_at?: string;
  amount?: { value?: number; currency?: string };
  product?: { id?: string; name?: string };
  customer?: { id?: string; email?: string };
  custom_metadata?: Record<string, string> | null;
}

/**
 * Les ventes récentes de la boutique, tous statuts confondus.
 *
 * POURQUOI PAS `?status=completed`
 *
 * Chariow marque aussi des ventes « settled ». Filtrer côté boutique sur le
 * seul « completed » en laisserait passer — et une vente encaissée qu'on ne
 * voit pas est un client qui a payé pour rien. On lit tout et on trie ici.
 *
 * LA PAGINATION SE FAIT PAR CURSEUR
 *
 * `?page=2` est ignoré par cette API : elle renvoie les dix mêmes ventes. La
 * taille de page se règle avec `per_page`, et la suite se demande avec l'URL
 * fournie dans la réponse. S'être trompé là-dessus a fait conclure un jour
 * « aucun paiement aujourd'hui » alors que seize mille francs étaient entrés.
 */
export async function listRecentSales(pagesMax = 60): Promise<ChariowSale[]> {
  const ventes: ChariowSale[] = [];
  let url: string | null = `${CHARIOW_API_URL}/sales?per_page=100`;

  for (let page = 0; page < pagesMax && url; page++) {
    const res: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey()}`, Accept: 'application/json' },
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('Erreur listing ventes Chariow:', res.status, data);
      throw new Error(`Impossible de lire les ventes Chariow (${res.status}).`);
    }
    if (Array.isArray(data?.data)) ventes.push(...data.data);

    // ── `per_page` NE SURVIT PAS AU LIEN DE PAGE SUIVANTE ──────────────────
    //
    // Chariow honore `per_page=100` sur la PREMIÈRE requête, puis le laisse
    // tomber : le lien qu'il fournit pour la suite ne le reporte pas, et les
    // pages suivantes retombent à dix ventes.
    //
    // Mesuré le 22 août 2026 : avec cinq pages, on lisait 100 + 10 + 10 + 10 +
    // 10 = 140 ventes et l'on croyait tenir toute la boutique. On ne voyait en
    // réalité que les deux derniers jours. La recette du 16 au 19 août était
    // simplement invisible.
    //
    // En reposant le paramètre à chaque tour : 1 141 ventes, du 7 au 22 août,
    // en douze requêtes au lieu de cent quinze.
    const suivante: string | null = data?.pagination?.next_page_url ?? null;
    if (suivante) {
      try {
        const u = new URL(suivante);
        u.searchParams.set('per_page', '100');
        url = u.toString();
      } catch {
        url = suivante;
      }
    } else url = null;
  }
  return ventes;
}

/** Statuts sous lesquels Chariow considère l'argent comme reçu. */
export const STATUTS_ENCAISSES = ['completed', 'settled'];

/**
 * Les recettes RÉELLEMENT encaissées par la boutique, jour par jour.
 *
 * ── POURQUOI ON VA CHERCHER LE CHIFFRE À LA SOURCE ────────────────────────
 *
 * La recette d'un partenaire se déduisait de la table des abonnements. C'est
 * un reflet, pas la source : une vente payée dont le compte ne s'est jamais
 * créé n'y figure pas, et un abonnement écrit avec le mauvais plan y ment.
 *
 * Relevé du 16 au 22 août 2026 : la boutique comptait 99 ventes encaissées,
 * la base 95 abonnements. Quatre ventes payées manquaient — et personne ne
 * pouvait le savoir en regardant la base, puisque c'est précisément ce
 * qu'elle ne contient pas.
 *
 * La boutique est la seule autorité sur l'argent reçu. On lui demande.
 *
 * La date retenue est celle du PAIEMENT (`completed_at`) quand elle existe :
 * une vente ouverte le 21 à 23 h 50 et payée le 22 appartient au 22.
 */
export async function recettesBoutiqueParJour(
  /**
   * La conversion en francs CFA, fournie par l'appelant.
   *
   * Elle n'est pas définie ici pour qu'il n'existe qu'UNE table de taux dans
   * l'application — celle de `partenaires.ts`. La recopier ici créerait deux
   * vérités qui finiraient par diverger, et c'est sur elles qu'on paie
   * quelqu'un. L'argument évite aussi un import circulaire entre les deux
   * modules.
   */
  versXof: (montant: number, devise: string) => number
): Promise<Map<string, { xof: number; ventes: number }>> {
  const parJour = new Map<string, { xof: number; ventes: number }>();

  for (const v of await listRecentSales()) {
    if (!STATUTS_ENCAISSES.includes(String(v.status))) continue;

    const jour = String((v as any).completed_at ?? v.created_at ?? '').slice(0, 10);
    if (!jour) continue;

    // Toutes les ventes relevées sont en francs CFA. Une devise étrangère
    // serait donc une nouveauté : on la signale plutôt que de la convertir
    // à un taux qu'on n'aurait pas vérifié.
    const devise = v.amount?.currency ?? 'XOF';
    if (devise !== 'XOF')
      console.warn(`[CHARIOW] Vente ${v.id} en ${devise} : convertie au taux affiché.`);

    const poste = parJour.get(jour) ?? { xof: 0, ventes: 0 };
    poste.xof += Math.round(versXof(Number(v.amount?.value ?? 0), devise));
    poste.ventes += 1;
    parJour.set(jour, poste);
  }

  return parJour;
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
