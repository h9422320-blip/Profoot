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
 * L'activation passe par `ouvrirAccesPayeSiBesoin`, la fonction que
 * l'application utilise à chaque connexion. Pas une copie : une copie
 * appliquerait ses propres règles de plan et de durée, qui divergeraient au
 * premier changement de tarif. Le client rattrapé reçoit donc exactement ce
 * qu'il aurait reçu tout seul — ni plus, ni moins.
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
// La boutique Chariow est fermée depuis le 27 août 2026 : la source est
// désormais `payment_intents`, alimentée par le pulse MakeTou.

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
/**
 * ── DEPUIS MAKETOU, LA SOURCE N'EST PLUS LA BOUTIQUE ──────────────────────
 *
 * Défaut trouvé le 25 septembre 2026. Cette fonction interrogeait Chariow, et
 * Chariow est fermé depuis le 27 août : `listRecentSales` rend une liste vide
 * sans rien dire. L'étape « Rouvrir les accès payés mais non reçus » de
 * l'entretien quotidien annonçait donc « 0 accès rouvert sur 0 vente » chaque
 * jour depuis un mois — un filet de sécurité qui se signalait vert alors qu'il
 * ne regardait plus rien. C'est le pire des états : personne ne le vérifie,
 * puisqu'il dit que tout va bien.
 *
 * La source est désormais `payment_intents`, où le pulse MakeTou inscrit chaque
 * vente encaissée (voir `maketou.ts`). Une vente est SERVIE si elle porte un
 * abonnement ou un match débloqué à son numéro.
 *
 * L'ouverture passe par `ouvrirAccesPayeSiBesoin`, la fonction que l'application
 * utilise à chaque connexion : le client rattrapé reçoit exactement ce qu'il
 * aurait reçu tout seul, ni plus, ni moins.
 *
 * Sans compte à son adresse, il n'y a rien à ouvrir : la vente est signalée en
 * attente d'inscription, et la livraison (`livraison-sans-compte.ts`) s'occupe
 * de l'inviter.
 */
export async function rattraperAccesManquants(reparer = true): Promise<BilanAcces> {
  const sb = createAdminClient();
  const bilan: BilanAcces = {
    ventesEncaissees: 0,
    dejaServies: 0,
    repares: 0,
    prevenus: 0,
    enAttenteInscription: [],
    echecs: [],
  };

  const FENETRE_JOURS = 60;
  const depuis = new Date(Date.now() - FENETRE_JOURS * 86_400_000).toISOString();
  const ENCAISSES = ['completed', 'succeeded', 'paid', 'success'];

  const paiements = await lireTout<any>((de, a) =>
    sb
      .from('payment_intents')
      .select('sale_id, email, plan, amount, created_at, consumed_at, statut_boutique')
      .gte('created_at', depuis)
      .range(de, a)
  );
  const encaissees = paiements.filter((p) =>
    ENCAISSES.includes(String(p.statut_boutique ?? '').toLowerCase())
  );
  bilan.ventesEncaissees = encaissees.length;
  if (!encaissees.length) return bilan;

  const abos = await lireTout<any>((de, a) =>
    sb.from('subscriptions').select('chariow_sale_id').range(de, a)
  );
  const { data: matchs } = await sb.from('matchs_debloques').select('sale_id');
  const servies = new Set<string>([
    ...abos.map((a) => a.chariow_sale_id).filter(Boolean),
    ...(matchs ?? []).map((m: any) => m.sale_id).filter(Boolean),
  ]);

  const { venteReglee } = await import('./ventes-reglees');
  const orphelines = encaissees.filter((p) => {
    if (servies.has(p.sale_id)) return false;
    if (venteReglee(p.sale_id)) return false;
    return true;
  });
  bilan.dejaServies = encaissees.length - orphelines.length;
  if (!orphelines.length) return bilan;

  // Les comptes, lus une fois : une vente sans compte à son adresse n'a rien à
  // ouvrir, et c'est le cas le plus fréquent depuis que la boutique est
  // publique.
  const comptes: { id: string; email: string }[] = [];
  for (let page = 1; page <= 30; page++) {
    const { data } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    const lot = data?.users ?? [];
    for (const u of lot) if (u.email) comptes.push({ id: u.id, email: u.email.toLowerCase() });
    if (lot.length < 1000) break;
  }
  const parEmail = new Map(comptes.map((c) => [c.email, c]));

  const { ouvrirAccesPayeSiBesoin } = await import('./acces-immediat');

  for (const p of orphelines) {
    const email = String(p.email ?? '').toLowerCase().trim();
    const manquant: AccesManquant = {
      saleId: String(p.sale_id),
      email,
      montant: Number(p.amount) || 0,
      jour: String(p.created_at ?? '').slice(0, 10),
      userId: parEmail.get(email)?.id ?? null,
    };
    const compte = parEmail.get(email);
    if (!compte) {
      bilan.enAttenteInscription.push(manquant);
      console.warn(
        `[ACCÈS] ${email} a payé ${manquant.montant} FCFA le ${manquant.jour} ` +
          `sans compte à cette adresse — la livraison l'invitera.`
      );
      continue;
    }

    if (!reparer) {
      bilan.repares++;
      continue;
    }

    try {
      const r = await ouvrirAccesPayeSiBesoin(sb, { id: compte.id, email: compte.email } as any);
      if (r.ouvert) {
        bilan.repares++;
        console.log(`[ACCÈS] Accès rouvert pour ${email} (vente ${manquant.saleId}).`);
        // Un accès rendu que le client ignore ne vaut guère mieux qu'un accès
        // manquant : il continue d'attendre. Une seule fois par vente.
        if (await prevenir(sb, manquant.saleId, email, compte.id)) bilan.prevenus++;
      } else {
        bilan.echecs.push({ email, raison: 'ouverture refusée par le filet habituel' });
      }
    } catch (e: any) {
      bilan.echecs.push({ email, raison: e?.message ?? 'inconnue' });
    }
  }

  return bilan;
}
