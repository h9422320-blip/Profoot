/**
 * Partenaires ambassadeurs : contrats, part du chiffre d'affaires, versements.
 *
 * LE MODÈLE DE RÉMUNÉRATION
 *
 * Un partenaire n'est plus payé aux vues. Il est associé au projet et touche un
 * POURCENTAGE DES RECETTES ENCAISSÉES CHAQUE MOIS. Kader : 35 %. Si le mois
 * rapporte un million, il reçoit trois cent cinquante mille.
 *
 * Ce changement n'est pas cosmétique. Payer aux vues, c'est payer de
 * l'attention, qu'elle rapporte ou non ; payer au pourcentage, c'est ne rien
 * devoir un mois sans recette. Le montant dû n'est donc jamais saisi à la main :
 * il se déduit des abonnements réellement encaissés.
 *
 * CE QUI COMPTE, ET À PARTIR DE QUAND
 *
 * Chaque partenaire porte une date de départ (`remuneration_depuis`). Les
 * recettes antérieures ne lui reviennent pas : elles ont été faites sans lui.
 * Sans cette date, un partenaire arrivé aujourd'hui toucherait un pourcentage
 * de tout l'historique du projet.
 *
 * L'accès VIP d'un partenaire reste ouvert par la liste d'adresses du module
 * d'abonnement — une panne de base ne doit jamais lui retirer son accès. Ce
 * module porte l'autre moitié : qui est la personne, ce qui a été convenu,
 * et ce qu'on lui doit.
 */

import { createAdminClient } from './supabase-admin';
import { niveauOffert, PLANS, normalizePlan, type PlanKey } from './subscription';
import { recettesParJour, parMois as grouperParMois, tauxMaketou } from './recettes-boutique';
import { DERNIER_JOUR_CHARIOW, TAUX_CHARIOW } from './recettes-histoire';

// Les taux vivent désormais dans `recettes-boutique.ts`, avec le calcul qui
// s'en sert. Ils restent exportés d'ici : plusieurs modules les importent par
// ce chemin, et une table de change n'a pas à déménager pour qu'on range le
// code autour d'elle.
export { TAUX_XOF, versXof } from './recettes-boutique';
import { versXof } from './recettes-boutique';

export interface Partenaire {
  id: string;
  email: string;
  name: string;
  handle: string | null;
  platform: string | null;
  country: string | null;
  audience: string | null;
  amount: number;
  currency: string;
  paid: boolean;
  paid_at: string | null;
  terms: string | null;
  starts_on: string | null;
  ends_on: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  /** Part du chiffre d'affaires mensuel, en pourcentage. */
  part_ca_pct: number;
  /** Date à partir de laquelle les recettes lui sont comptées. */
  remuneration_depuis: string | null;
}

/** Ce qu'un mois a rapporté, et ce qu'il doit au partenaire. */
export interface MoisPartenaire {
  /** Premier jour du mois, au format AAAA-MM. */
  mois: string;
  libelle: string;
  /** Recettes encaissées ce mois-là, à partir de la date de départ. */
  recettesXof: number;
  /** Ce que la boutique a prélevé — 15 % chez Chariow, autre taux chez MakeTou. */
  fraisBoutiqueXof: number;
  /** Ce qui reste une fois la boutique payée. C'est là-dessus que porte la part. */
  netXof: number;
  /** Nombre d'abonnements encaissés dans le mois. */
  ventes: number;
  /** Part due au partenaire pour ce mois, calculée sur le NET. */
  duXof: number;
  /** Le mois est-il terminé ? Un mois en cours peut encore monter. */
  clos: boolean;
}

/** Ce que l'administration affiche pour chaque partenaire. */
export interface PartenaireEnrichi extends Partenaire {
  /** Niveau d'accès réellement ouvert par le code, ou null si aucun. */
  accesOuvert: 'VIP' | 'PRO' | null;
  /** Compte rattaché, pour ouvrir sa fiche. Null tant qu'il ne s'est pas inscrit. */
  userId: string | null;
  /** Le partenaire a-t-il créé son compte sur l'application ? */
  inscrit: boolean;
  inscritLe: string | null;
  derniereConnexion: string | null;
  /** Un poste par mois depuis le début du partenariat, du plus récent au plus ancien. */
  mois: MoisPartenaire[];
  /** Recettes du mois en cours qui lui sont comptées, AVANT frais de boutique. */
  recettesMoisEnCoursXof: number;
  /**
   * Ce qui reste du mois en cours une fois la boutique payée.
   *
   * ── POURQUOI CE CHAMP A DÛ ÊTRE AJOUTÉ ──────────────────────────────────
   *
   * Sa fiche annonçait « 334 478 FCFA » puis, juste dessous, « 35 % de
   * 1 117 000 FCFA ». Les deux lignes ne pouvaient pas être vraies ensemble :
   * 35 % de 1 117 000 font 390 950. Le montant versé était juste — il porte
   * sur le net — mais la ligne qui l'expliquait nommait le brut, et 56 472
   * francs d'écart séparaient ce qu'on lisait de ce qu'on pouvait recalculer.
   *
   * C'est la carte de la personne qu'on paie : elle doit pouvoir refaire la
   * multiplication et retomber sur son montant.
   */
  netMoisEnCoursXof: number;
  /** Ce que la boutique a prélevé sur le mois en cours. */
  fraisMoisEnCoursXof: number;
  /** Ce qu'il touche pour le mois en cours, à ce jour. */
  duMoisEnCoursXof: number;
  /** Somme de tout ce qui lui est dû depuis le début, mois clos compris. */
  duCumuleXof: number;
}

/** Devises affichées telles qu'elles ont été versées, sans conversion. */
export function montantPartenaire(montant: number, devise: string): string {
  const symbole: Record<string, string> = { EUR: '€', USD: '$', XOF: 'FCFA' };
  const valeur = Number(montant ?? 0).toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: Number.isInteger(Number(montant)) ? 0 : 2,
  });
  return `${valeur} ${symbole[devise] ?? devise}`;
}

/**
 * Montant réellement encaissé pour un abonnement.
 *
 * ── POURQUOI CE N'EST PLUS LE PRIX CATALOGUE ──────────────────────────────
 *
 * Cette fonction lisait `PLANS[cle].amountXof` — le tarif AFFICHÉ AUJOURD'HUI.
 * On payait donc un partenaire sur un prix théorique, pas sur de l'argent reçu.
 * Trois écarts mesurés le 22 août 2026, sur la base réelle :
 *
 *   • DEUX VENTES ESSENTIAL À 2 000 étaient enregistrées avec le plan
 *     `vip_yearly`. Comptées 15 000 chacune : 26 000 FCFA de recette inventée.
 *   • LES ANCIENS PRIX étaient reprisés au tarif du jour. Sept ventes à 3 000
 *     et 9 000 comptées 2 000 : 13 000 FCFA d'encaissé effacés.
 *   • DEUX ANCIENS PLANS (`monthly`, `yearly`) ne figurent plus au catalogue.
 *     `montantAbonnement` renvoyait 0 et l'appelant les sautait : 11 000 FCFA
 *     purement disparus.
 *
 * Un tarif change ; l'argent déjà reçu, non. La colonne `amount` porte ce qui
 * a effectivement été facturé au moment de la vente, dans la devise de la
 * vente. C'est la seule valeur qui ne se déforme pas quand un prix bouge.
 *
 * ── ET SEULEMENT CE QUI A ÉTÉ PAYÉ ────────────────────────────────────────
 *
 * Un abonnement sans référence de vente — accès offert, compte de test,
 * correction manuelle — n'a rapporté rien. Il ne doit donc rien déclencher.
 * Aucun n'existe à ce jour, mais le script `offrir-acces.mjs` en crée, et ce
 * jour-là la recette aurait grossi sans qu'un centime soit entré.
 */
function montantEncaisse(ligne: {
  plan: string | null;
  amount: number | null;
  currency: string | null;
  chariow_sale_id: string | null;
  moneroo_payment_id: string | null;
}): number {
  // Sans trace de paiement, rien n'a été encaissé.
  if (!ligne.chariow_sale_id && !ligne.moneroo_payment_id) return 0;

  const brut = Number(ligne.amount ?? 0);
  if (!Number.isFinite(brut) || brut <= 0) {
    // Montant absent : on retombe sur le catalogue plutôt que d'effacer une
    // vente réelle. C'est un pis-aller, et il est signalé.
    const cle = normalizePlan(ligne.plan) as PlanKey | null;
    const repli = cle ? PLANS[cle].amountXof : 0;
    if (repli)
      console.warn(
        `[PARTENAIRES] Vente sans montant (${ligne.plan}) : prix catalogue retenu, ${repli} FCFA.`
      );
    return repli;
  }

  return Math.round(versXof(brut, ligne.currency ?? 'XOF'));
}

/**
 * Recettes encaissées, regroupées par mois.
 *
 * Lues dans les abonnements et non dans un compteur tenu à part : un chiffre
 * recopié finit toujours par diverger de la réalité, et c'est sur ce chiffre
 * qu'on paie quelqu'un.
 */
async function recettesParMois(depuis: Date): Promise<Map<string, { xof: number; ventes: number; fraisXof?: number }>> {
  // ── LA BOUTIQUE D'ABORD : C'EST ELLE QUI TIENT LA CAISSE ────────────────
  //
  // La table des abonnements est un reflet de la boutique, pas la boutique.
  // Une vente payée dont le compte ne s'est jamais créé n'y figure pas ; un
  // abonnement écrit avec le mauvais plan y ment. Du 16 au 22 août 2026 :
  // 99 ventes encaissées chez Chariow, 95 abonnements en base.
  //
  // On demande donc le chiffre à Chariow. La base ne sert plus que de secours
  // le jour où la boutique ne répond pas — mieux vaut un chiffre approché
  // qu'une page vide, et l'écart est alors signalé dans le journal.
  const boutique = await recettesParJour();
  if (boutique) return grouperParMois(boutique, depuis.toISOString().slice(0, 10));

  const parMois = new Map<string, { xof: number; ventes: number; fraisXof: number }>();
  const { data, error } = await createAdminClient()
    .from('subscriptions')
    .select('plan, created_at, amount, currency, chariow_sale_id, moneroo_payment_id')
    .gte('created_at', depuis.toISOString());

  if (error) {
    console.warn('[PARTENAIRES] Recettes illisibles :', error.message);
    return parMois;
  }

  // ── UNE VENTE NE COMPTE QU'UNE FOIS ─────────────────────────────────────
  //
  // Une même vente Chariow peut engendrer deux abonnements : un webhook rejoué,
  // un double clic, une reprise après incident. Sans ce garde-fou, la recette
  // — et donc la part du partenaire — doublerait sur cette vente. Aucun doublon
  // n'existe à ce jour ; c'est précisément le moment de poser le verrou.
  const ventesVues = new Set<string>();

  for (const ligne of data ?? []) {
    if (ligne.chariow_sale_id) {
      if (ventesVues.has(ligne.chariow_sale_id)) {
        console.warn(
          `[PARTENAIRES] Vente ${ligne.chariow_sale_id} vue deux fois : comptée une seule.`
        );
        continue;
      }
      ventesVues.add(ligne.chariow_sale_id);
    }

    const montant = montantEncaisse(ligne);
    if (!montant) continue;
    const jour = String(ligne.created_at).slice(0, 10);
    const mois = jour.slice(0, 7); // AAAA-MM
    const poste = parMois.get(mois) ?? { xof: 0, ventes: 0, fraisXof: 0 };
    poste.xof += montant;
    poste.ventes += 1;
    // ── MÊME EN SECOURS, LES FRAIS NE SONT PAS OUBLIÉS ────────────────────
    //
    // Sans cette ligne, ce chemin rendrait un mois sans prélèvement, et la part
    // du partenaire porterait sur le brut : 369 250 francs au lieu de 313 863
    // sur la seule période d'août. Un secours qui se trompe en faveur de
    // quelqu'un reste un secours qui se trompe, et personne ne le verrait —
    // c'est justement le jour où l'on ne regarde pas que ce chemin sert.
    //
    // Le taux est celui de la boutique en service ce jour-là.
    poste.fraisXof += Math.round(
      montant * (jour <= DERNIER_JOUR_CHARIOW ? TAUX_CHARIOW : tauxMaketou())
    );
    parMois.set(mois, poste);
  }
  return parMois;
}

const NOMS_MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

function libelleMois(mois: string): string {
  const [annee, m] = mois.split('-');
  return `${NOMS_MOIS[Number(m) - 1]} ${annee}`;
}

/**
 * Découpe le partenariat en mois, du départ à aujourd'hui.
 *
 * Les mois sans recette apparaissent quand même, à zéro : un mois creux fait
 * partie du bilan, le masquer donnerait une image flatteuse et fausse.
 */
/**
 * ── LA PART SE CALCULE SUR CE QUI RESTE, JAMAIS SUR CE QUI ENTRE ──────────
 *
 * Le contrat, tel que le propriétaire l'a énoncé le 28 août 2026 : le
 * partenaire touche ses 35 % « quand tous les frais sont pris en compte ».
 * Pas sur le chiffre d'affaires brut.
 *
 * L'écart n'est pas théorique. Sur la période du 16 au 27 août :
 *
 *     35 % de 1 055 000 (brut)              = 369 250 FCFA
 *     35 % de   896 750 (après Chariow)     = 313 863 FCFA
 *
 * Cinquante-cinq mille francs séparent les deux lectures. Elles ne peuvent pas
 * cohabiter : l'une des deux fait perdre quelqu'un.
 */
function construireMois(
  depuis: Date,
  recettes: Map<string, { xof: number; ventes: number; fraisXof?: number }>,
  partPct: number
): MoisPartenaire[] {
  const mois: MoisPartenaire[] = [];
  const maintenant = new Date();
  const moisCourant = maintenant.toISOString().slice(0, 7);

  const curseur = new Date(depuis.getFullYear(), depuis.getMonth(), 1);
  const fin = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);

  while (curseur <= fin) {
    const cle = `${curseur.getFullYear()}-${String(curseur.getMonth() + 1).padStart(2, '0')}`;
    const poste = recettes.get(cle) ?? { xof: 0, ventes: 0, fraisXof: 0 };
    const frais = poste.fraisXof ?? 0;
    const net = Math.max(0, poste.xof - frais);
    mois.push({
      mois: cle,
      libelle: libelleMois(cle),
      recettesXof: poste.xof,
      fraisBoutiqueXof: frais,
      netXof: net,
      ventes: poste.ventes,
      duXof: Math.round((net * partPct) / 100),
      clos: cle !== moisCourant,
    });
    curseur.setMonth(curseur.getMonth() + 1);
  }

  return mois.reverse(); // le mois en cours en premier
}

/**
 * Liste des partenaires, enrichie de ce qui vit ailleurs : l'accès réellement
 * ouvert, l'existence du compte, et la part du chiffre d'affaires.
 */
export async function getPartenaires(): Promise<PartenaireEnrichi[]> {
  const sb = createAdminClient();

  const { data: partenaires, error } = await sb
    .from('partners')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('[PARTENAIRES] Table absente ou illisible :', error.message);
    return [];
  }
  if (!partenaires?.length) return [];

  // Les comptes vivent dans l'authentification, pas dans une table métier.
  const comptes = new Map<string, { id: string; created_at: string; last_sign_in_at: string | null }>();
  try {
    const { data } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const u of data?.users ?? []) {
      if (u.email) {
        comptes.set(u.email.toLowerCase(), {
          id: u.id,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
        });
      }
    }
  } catch (erreur: any) {
    console.warn('[PARTENAIRES] Comptes illisibles :', erreur?.message);
  }

  // Une seule lecture des recettes pour tout le monde, à partir de la date de
  // départ la plus ancienne.
  const departs = (partenaires as Partenaire[])
    .map((p) => (p.remuneration_depuis ? new Date(p.remuneration_depuis) : null))
    .filter((d): d is Date => !!d && !isNaN(d.getTime()));
  const plusAncien = departs.length ? new Date(Math.min(...departs.map((d) => d.getTime()))) : new Date();
  const recettes = await recettesParMois(plusAncien);

  const moisCourant = new Date().toISOString().slice(0, 7);

  return (partenaires as Partenaire[]).map((p) => {
    const compte = comptes.get(p.email.toLowerCase());
    const partPct = Number(p.part_ca_pct ?? 0);
    const depart = p.remuneration_depuis ? new Date(p.remuneration_depuis) : null;

    // Chaque partenaire ne voit que les mois qui le concernent : les recettes
    // d'avant son arrivée ont été faites sans lui.
    const siennes = new Map<string, { xof: number; ventes: number }>();
    if (depart && !isNaN(depart.getTime())) {
      const moisDepart = depart.toISOString().slice(0, 7);
      for (const [mois, poste] of recettes) {
        if (mois >= moisDepart) siennes.set(mois, poste);
      }
    }

    const mois = depart && !isNaN(depart.getTime()) ? construireMois(depart, siennes, partPct) : [];
    const enCours = mois.find((m) => m.mois === moisCourant);

    return {
      ...p,
      part_ca_pct: partPct,
      accesOuvert: niveauOffert(p.email),
      userId: compte?.id ?? null,
      inscrit: !!compte,
      inscritLe: compte?.created_at ?? null,
      derniereConnexion: compte?.last_sign_in_at ?? null,
      mois,
      recettesMoisEnCoursXof: enCours?.recettesXof ?? 0,
      netMoisEnCoursXof: enCours?.netXof ?? 0,
      fraisMoisEnCoursXof: enCours?.fraisBoutiqueXof ?? 0,
      duMoisEnCoursXof: enCours?.duXof ?? 0,
      duCumuleXof: mois.reduce((t, m) => t + m.duXof, 0),
    };
  });
}

/** Un partenaire précis, avec tout son suivi. */
export async function getPartenaire(id: string): Promise<PartenaireEnrichi | null> {
  const tous = await getPartenaires();
  return tous.find((p) => p.id === id) ?? null;
}

/**
 * Le bilan de l'ensemble des partenaires.
 *
 * Ce que le projet encaisse, ce qu'il en reverse, et ce qu'il lui reste. La
 * part reversée n'est plus un coût fixe engagé d'avance : elle suit les
 * recettes, et vaut zéro si le mois ne rapporte rien.
 */
export interface EconomiePartenaires {
  /** Recettes du mois en cours, toutes offres confondues. */
  recettesMoisXof: number;
  /**
   * Ce que la boutique a prélevé sur le mois.
   *
   * ── POURQUOI CETTE LIGNE DOIT EXISTER À L'ÉCRAN ─────────────────────────
   *
   * Sans elle, le partage affiché ne tombait pas juste : le projet semblait
   * garder 765 167 FCFA en août alors qu'il en garde 605 118. Les 160 050
   * francs de commission s'évaporaient entre deux chiffres, et rien ne
   * permettait de s'en apercevoir — les deux montants voisins étaient
   * pourtant exacts chacun de son côté.
   *
   * Un partage qui ne s'additionne pas sous les yeux fait douter des trois
   * nombres à la fois.
   */
  fraisBoutiqueMoisXof: number;
  /** Ce qui reste une fois la boutique payée. La part porte là-dessus. */
  netMoisXof: number;
  /** Total reversé aux partenaires pour le mois en cours. */
  partPartenairesMoisXof: number;
  /** Ce qui reste au projet ce mois-ci, une fois la boutique ET les partenaires payés. */
  resteAuProjetMoisXof: number;
  /** Somme due depuis le début des partenariats. */
  duCumuleXof: number;
  /** Part cumulée du chiffre d'affaires reversée, en pourcentage. */
  partTotalePct: number;
  /** Forfaits déjà versés, converti — hérité des anciens contrats. */
  verseXof: number;
  nombrePartenaires: number;
}

export function calculerEconomie(partenaires: PartenaireEnrichi[]): EconomiePartenaires {
  const moisCourant = new Date().toISOString().slice(0, 7);

  // Les recettes du mois sont celles du projet, pas la somme par partenaire :
  // additionner les vues de chacun compterait plusieurs fois le même argent
  // dès qu'il y a deux partenaires.
  const recettesMoisXof = Math.max(
    0,
    ...partenaires.map((p) => p.mois.find((m) => m.mois === moisCourant)?.recettesXof ?? 0)
  );

  // Les frais suivent la même règle que les recettes : ceux du projet, pas la
  // somme par partenaire — sinon deux partenaires feraient compter deux fois
  // la même commission.
  const fraisBoutiqueMoisXof = Math.max(
    0,
    ...partenaires.map((p) => p.mois.find((m) => m.mois === moisCourant)?.fraisBoutiqueXof ?? 0)
  );
  const netMoisXof = Math.max(0, recettesMoisXof - fraisBoutiqueMoisXof);

  const partPartenairesMoisXof = partenaires.reduce((t, p) => t + p.duMoisEnCoursXof, 0);
  const partTotalePct = partenaires.reduce((t, p) => t + Number(p.part_ca_pct ?? 0), 0);

  return {
    recettesMoisXof,
    fraisBoutiqueMoisXof,
    netMoisXof,
    partPartenairesMoisXof,
    // Ce qui reste part du NET, jamais du brut : la boutique a déjà été payée.
    resteAuProjetMoisXof: Math.max(0, netMoisXof - partPartenairesMoisXof),
    duCumuleXof: partenaires.reduce((t, p) => t + p.duCumuleXof, 0),
    partTotalePct,
    verseXof: partenaires.reduce(
      (t, p) => t + (p.paid ? versXof(Number(p.amount ?? 0), p.currency) : 0),
      0
    ),
    nombrePartenaires: partenaires.length,
  };
}
