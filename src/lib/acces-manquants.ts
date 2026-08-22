/**
 * QUI A PAYÉ SANS RECEVOIR SON ACCÈS — ET COMMENT ON LE LUI DONNE.
 *
 * ── POURQUOI CE FICHIER EXISTE ────────────────────────────────────────────
 *
 * Le 22 août 2026 à 14 h 55, un client a écrit : « Je n'arrive pas à activer,
 * vous pouvez m'aider ? » Il avait payé à 14 h 36. Dix-huit minutes plus tôt.
 *
 * Il n'était pas seul. En confrontant la boutique à la base ce jour-là, trois
 * personnes avaient payé sans jamais recevoir leur accès — l'une depuis deux
 * jours. Aucune n'avait été détectée : le webhook avait échoué en silence, et
 * la seule alerte possible était un client assez patient pour écrire un mail.
 *
 * Compter sur la plainte d'un client comme système de détection, c'est ne
 * détecter que les clients qui se plaignent. Les autres demandent un
 * remboursement, ou ne reviennent pas.
 *
 * ── CE QUE FAIT CE MODULE ─────────────────────────────────────────────────
 *
 * Il confronte chaque vente encaissée chez Chariow à ce que la base a
 * réellement servi, et rouvre l'accès manquant en rejouant l'activation.
 *
 * ── POURQUOI IL REJOUE, AU LIEU DE RECRÉER ────────────────────────────────
 *
 * L'activation passe par `activateSubscriptionFromSale`, la fonction que le
 * webhook utilise. Pas une copie : une copie appliquerait ses propres règles
 * de plan et de durée, qui divergeraient au premier changement de tarif. Le
 * client rattrapé reçoit donc exactement ce qu'il aurait reçu si le webhook
 * avait fonctionné — ni plus, ni moins.
 *
 * ── DEUX FAÇONS D'AVOIR ÉTÉ SERVI ─────────────────────────────────────────
 *
 * Un abonnement laisse une ligne dans `subscriptions`. Un match acheté à
 * l'unité laisse une ligne dans `matchs_debloques`, et AUCUNE dans
 * `subscriptions`. Ne regarder que la première table ferait passer tous les
 * achats de match pour des accès manquants — deux faux positifs sur six lors
 * du premier relevé.
 */

import { createAdminClient } from './supabase-admin';
import { listRecentSales, STATUTS_ENCAISSES, type ChariowSale } from './chariow';
import { activateSubscriptionFromSale } from './subscription-activation';

export interface AccesManquant {
  saleId: string;
  email: string;
  montant: number;
  /** Date du paiement, AAAA-MM-JJ. */
  jour: string;
  /** Le compte existe-t-il ? Sans compte, rien ne peut être ouvert. */
  userId: string | null;
}

export interface BilanAcces {
  ventesEncaissees: number;
  dejaServies: number;
  /** Accès rouverts pendant ce passage. */
  repares: number;
  /** Personnes réellement prévenues par courriel. */
  prevenus: number;
  /** Payés, mais aucun compte à ce nom : rien à ouvrir pour l'instant. */
  enAttenteInscription: AccesManquant[];
  /** Tentatives de réparation qui ont échoué — celles-là méritent un regard. */
  echecs: { email: string; raison: string }[];
}

/** L'adresse d'un acheteur, cherchée là où elle peut se trouver. */
function emailDe(vente: ChariowSale, parIntention: Map<string, string>): string {
  return String(
    parIntention.get(vente.id) ??
      vente.customer?.email ??
      (vente as any).buyer?.email ??
      ''
  )
    .toLowerCase()
    .trim();
}

/**
 * Prévient la personne que son accès est ouvert. Une seule fois, jamais deux.
 *
 * ── POURQUOI LA TRACE EST INDISPENSABLE ───────────────────────────────────
 *
 * Le rattrapage tourne chaque jour. Sans mémoire de ce qui a déjà été envoyé,
 * la moindre anomalie qui ferait réapparaître une vente dans la liste
 * enverrait le même message tous les matins à la même personne. Recevoir
 * quatre fois « votre accès est activé » inquiète plus que ça ne rassure.
 *
 * La trace est posée AVANT l'envoi. Si le service de courriel répond mal après
 * avoir malgré tout expédié le message, on préfère ne pas le renvoyer : un
 * message manqué se rattrape en écrivant à la personne, un message envoyé
 * quatre fois ne se rattrape pas.
 *
 * Elle vit dans la réserve, pas dans une nouvelle table : c'est une note de
 * service, pas une donnée du produit.
 */
async function prevenir(
  sb: ReturnType<typeof createAdminClient>,
  saleId: string,
  email: string,
  userId: string
): Promise<boolean> {
  const { courrielDisponible, envoyerCourriel, messageAccesRouvert } = await import('./courriel');
  const { lireReserve, ecrireReserve } = await import('./api-football');

  if (!courrielDisponible()) {
    console.error(
      `[ACCÈS] ${email} a retrouvé son accès mais n'en sera pas informé : ` +
        `RESEND_API_KEY n'est pas configurée.`
    );
    return false;
  }

  const cle = `acces:prevenu:${saleId}`;
  const deja = await lireReserve<string>(cle);
  if (deja) return false;

  // Dix ans : cette note ne doit jamais expirer du vivant du produit.
  await ecrireReserve(cle, new Date().toISOString(), 10 * 365 * 24 * 60 * 60 * 1000);

  // L'échéance réelle, pour l'annoncer sans se tromper.
  const { data } = await sb
    .from('subscriptions')
    .select('expires_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return envoyerCourriel({ a: email, ...messageAccesRouvert((data as any)?.expires_at ?? null) });
}

/** Lit une table entière, mille lignes à la fois. */
async function lireTout<T>(
  requete: (de: number, a: number) => any,
  plafond = 20000
): Promise<T[]> {
  const tout: T[] = [];
  for (let de = 0; de < plafond; de += 1000) {
    const { data, error } = await requete(de, de + 999);
    if (error || !data?.length) break;
    tout.push(...data);
    if (data.length < 1000) break;
  }
  return tout;
}

/**
 * Confronte la boutique à la base, et rouvre ce qui manque.
 *
 * @param reparer  Faux pour un simple relevé, sans rien écrire.
 */
export async function rattraperAccesManquants(reparer = true): Promise<BilanAcces> {
  const sb = createAdminClient();

  const ventes = await listRecentSales();
  const payees = ventes.filter((v) => STATUTS_ENCAISSES.includes(String(v.status)));

  // Ce qui a déjà été servi, des DEUX façons possibles.
  const abos = await lireTout<any>((de, a) =>
    sb.from('subscriptions').select('chariow_sale_id, user_id').range(de, a)
  );
  const { data: matchs } = await sb.from('matchs_debloques').select('sale_id');
  const servies = new Set<string>([
    ...abos.map((a) => a.chariow_sale_id).filter(Boolean),
    ...(matchs ?? []).map((m: any) => m.sale_id).filter(Boolean),
  ]);

  const bilan: BilanAcces = {
    ventesEncaissees: payees.length,
    dejaServies: servies.size,
    repares: 0,
    prevenus: 0,
    enAttenteInscription: [],
    echecs: [],
  };

  const orphelines = payees.filter((v) => !servies.has(v.id));
  if (!orphelines.length) return bilan;

  // L'adresse saisie au moment du paiement est la plus fiable : c'est celle
  // que NOTRE serveur a écrite au checkout, avant que la boutique s'en mêle.
  const intentions = await lireTout<any>((de, a) =>
    sb.from('payment_intents').select('sale_id, email').range(de, a)
  );
  const parIntention = new Map<string, string>(
    intentions.filter((i) => i.sale_id && i.email).map((i) => [i.sale_id, String(i.email)])
  );

  // Les comptes, pour relier une adresse à un identifiant.
  const comptes: any[] = [];
  for (let page = 1; page <= 30; page++) {
    const { data } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (!data?.users?.length) break;
    comptes.push(...data.users);
    if (data.users.length < 1000) break;
  }
  const parEmail = new Map(
    comptes.map((u) => [String(u.email ?? '').toLowerCase().trim(), u.id])
  );

  for (const vente of orphelines) {
    const email = emailDe(vente, parIntention);
    const userId = email ? parEmail.get(email) ?? null : null;
    const manquant: AccesManquant = {
      saleId: vente.id,
      email: email || '(inconnu)',
      montant: Number(vente.amount?.value ?? 0),
      jour: String((vente as any).completed_at ?? vente.created_at ?? '').slice(0, 10),
      userId,
    };

    // Payé, mais aucun compte à ce nom. Rien à ouvrir : l'accès se rattachera
    // à l'inscription. On le signale pour que personne ne soit oublié.
    if (!userId) {
      bilan.enAttenteInscription.push(manquant);
      console.warn(
        `[ACCÈS] ${manquant.email} a payé ${manquant.montant} FCFA le ${manquant.jour} ` +
          `sans compte inscrit — en attente.`
      );
      continue;
    }

    if (!reparer) {
      bilan.repares++;
      continue;
    }

    try {
      const r = await activateSubscriptionFromSale(sb, vente, userId);
      if (r.activated) {
        bilan.repares++;
        console.log(`[ACCÈS] ${email} : accès ${r.plan} rouvert (vente ${vente.id}).`);
        if (await prevenir(sb, vente.id, email, userId)) bilan.prevenus++;
      } else {
        bilan.echecs.push({ email, raison: r.reason ?? 'raison inconnue' });
        console.error(`[ACCÈS] ${email} : réparation refusée — ${r.reason}`);
      }
    } catch (e: any) {
      bilan.echecs.push({ email, raison: String(e?.message ?? e).slice(0, 150) });
      console.error(`[ACCÈS] ${email} : réparation impossible — ${e?.message}`);
    }
  }

  return bilan;
}
