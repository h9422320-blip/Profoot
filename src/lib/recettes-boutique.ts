/**
 * CE QUE LA BOUTIQUE A ENCAISSÉ. LA SEULE RÉPONSE, POUR TOUTE L'APPLICATION.
 *
 * ── POURQUOI CE FICHIER EXISTE ────────────────────────────────────────────
 *
 * Trois pages de l'administration affichaient de l'argent, et chacune le
 * comptait à sa façon :
 *
 *   • la vue d'ensemble additionnait les montants des abonnements ;
 *   • la page des partenaires appliquait le prix catalogue du jour ;
 *   • la boutique Chariow, elle, savait ce qui était réellement entré.
 *
 * Trois chiffres différents pour la même semaine, et c'est sur l'un d'eux
 * qu'on paie un partenaire. Le 22 août 2026 : 343 000 affichés côté
 * partenaires, 319 000 côté base, 325 000 réellement encaissés.
 *
 * La table des abonnements est un REFLET de la boutique, jamais la boutique.
 * Une vente payée dont le compte ne s'est pas créé n'y figure pas — il y en
 * avait trois sur cette seule semaine. Un abonnement modifié à la main y ment.
 *
 * Ce module interroge la caisse. Tout le reste le consulte.
 *
 * ── POURQUOI IL PORTE AUSSI LES TAUX DE CHANGE ────────────────────────────
 *
 * Ils vivaient dans `partenaires.ts`. Les remonter ici évite qu'un module qui
 * a besoin d'une conversion doive importer la page des partenaires — et évite
 * surtout qu'une deuxième table apparaisse un jour ailleurs. Deux tables de
 * taux finissent toujours par diverger, et c'est sur elles qu'on paie
 * quelqu'un.
 */

import { HISTOIRE_CHARIOW, TAUX_CHARIOW, DERNIER_JOUR_CHARIOW } from './recettes-histoire';
import { lireReserve, ecrireReserve } from './api-football';

/**
 * Taux de conversion vers le franc CFA.
 *
 * L'euro est arrimé au franc CFA à une parité fixe et officielle. Le dollar
 * flotte : sa valeur est une approximation, affichée comme telle partout où
 * elle sert.
 */
export const TAUX_XOF: Record<string, number> = {
  XOF: 1,
  EUR: 655.957, // parité fixe
  USD: 600, // approximation
};

export function versXof(montant: number, devise: string): number {
  return Number(montant ?? 0) * (TAUX_XOF[devise] ?? 0);
}

/** Recette d'une journée : le montant encaissé et le nombre de ventes. */
export interface JourneeBoutique {
  xof: number;
  ventes: number;
  /**
   * Ce que la boutique a prélevé sur la journée.
   *
   * ── POURQUOI LES FRAIS VIVENT AVEC LA JOURNÉE ───────────────────────────
   *
   * Le taux a changé en cours de route : Chariow retenait 15 %, MakeTou
   * retient un autre pourcentage depuis le 28 août 2026. Un taux unique
   * appliqué au total ferait payer au partenaire une commission que personne
   * n'a jamais prélevée — ou l'inverse.
   *
   * Chaque journée porte donc SON prélèvement, calculé au taux de la boutique
   * qui l'a encaissée. Le mois n'est plus qu'une addition.
   */
  fraisXof: number;
}

/** Journée par journée, indexée AAAA-MM-JJ. */
export type RecettesParJour = Record<string, JourneeBoutique>;

/**
 * Dernier chiffre connu, gardé UNIQUEMENT pour les pannes.
 *
 * Il n'est jamais servi quand la boutique répond. Ce n'est pas un cache : un
 * cache aurait fait réapparaître le décalage qu'on vient de supprimer.
 */
const CLE_SECOURS = 'chariow:dernier-chiffre-connu';
const SECOURS_TTL = 30 * 24 * 60 * 60 * 1000;

/**
 * Les recettes de la boutique, jour par jour, depuis l'ouverture.
 *
 * ── LA CAISSE EST INTERROGÉE À CHAQUE AFFICHAGE ───────────────────────────
 *
 * Aucune mise en réserve sur le chemin normal. C'est un choix, et il vient
 * d'une erreur : la version précédente gardait le total cinq minutes, et deux
 * pages ouvertes à une minute d'intervalle lisaient deux instantanés
 * différents. Le 22 août 2026 à 12 h 16, la vue d'ensemble affichait
 * 368 000 FCFA et la page des partenaires 325 000, quand la caisse en avait
 * encaissé 375 200 et 336 000.
 *
 * Un chiffre en retard est un chiffre faux, et deux pages en désaccord font
 * douter des deux. Comme demander à la caisse ne coûte que deux requêtes et
 * moins d'une seconde (voir `listSalesEncaissees`), il n'y a plus aucune
 * raison de garder quoi que ce soit : chaque affichage repart de la source.
 *
 * ── CE QUE « ENCAISSÉ » VEUT DIRE ─────────────────────────────────────────
 *
 * Chariow marque une vente payée `completed` ou `settled`. Les autres —
 * `abandoned`, `failed`, `awaiting_payment` — n'ont rien rapporté. Au 22 août
 * 2026 : 1 163 ventes enregistrées, 115 encaissées. Compter les autres
 * multiplierait la recette par dix.
 *
 * ── LA DATE RETENUE EST CELLE DU PAIEMENT ─────────────────────────────────
 *
 * Une vente ouverte le 21 à 23 h 50 et payée le 22 appartient au 22. C'est la
 * date à laquelle l'argent est entré, donc celle qui décide du mois — et donc
 * du mois où elle compte pour un partenaire.
 *
 * Renvoie `null` si la boutique est injoignable et qu'aucun chiffre de secours
 * n'a jamais été enregistré. L'appelant décide alors quoi faire.
 */
export async function recettesParJour(): Promise<RecettesParJour | null> {
  const parJour: RecettesParJour = {};

  // ── CE QUE CHARIOW A ENCAISSÉ : FIGÉ, DÉFINITIF ────────────────────────
  //
  // La boutique a fermé le 27 août 2026. Ces journées ne bougeront plus, et
  // les interroger n'aurait aucun sens : leur source est morte. Elles sont
  // écrites dans le code, versionnées, comparables ligne à ligne avec le
  // tableau de bord de Chariow.
  for (const [jour, j] of Object.entries(HISTOIRE_CHARIOW)) {
    parJour[jour] = {
      xof: j.xof,
      ventes: j.ventes,
      fraisXof: Math.round(j.xof * TAUX_CHARIOW),
    };
  }

  // ── CE QUE MAKETOU ENCAISSE : LU DANS NOTRE PROPRE BASE ────────────────
  //
  // Plus jamais chez un tiers. Le 28 août 2026, toute l'administration est
  // tombée à zéro le jour où l'on a débranché la boutique précédente : elle
  // n'avait aucune source à elle.
  //
  // La source est `payment_intents` et non `subscriptions` : une vente payée
  // par quelqu'un qui n'a pas encore de compte ProFoot n'y crée aucun
  // abonnement, et c'est pourtant de l'argent entré. Il y en avait une dès le
  // premier jour.
  try {
    for (const [jour, j] of Object.entries(await ventesMaketouParJour())) {
      const existant = parJour[jour] ?? { xof: 0, ventes: 0, fraisXof: 0 };
      parJour[jour] = {
        xof: existant.xof + j.xof,
        ventes: existant.ventes + j.ventes,
        fraisXof: existant.fraisXof + Math.round(j.xof * tauxMaketou()),
      };
    }
    void ecrireReserve(CLE_SECOURS, parJour, SECOURS_TTL);
  } catch (e: any) {
    // L'histoire figée reste servie : une base momentanément illisible ne doit
    // pas faire disparaître un million de francs de l'écran.
    console.warn('[BOUTIQUE] Ventes MakeTou illisibles :', e?.message);
  }

  return parJour;
}

/**
 * Ce que MakeTou retient au VENDEUR sur chaque vente.
 *
 * ── CE N'EST PLUS UNE ANNONCE, C'EST UNE MESURE ───────────────────────────
 *
 * Ce taux a longtemps été recopié de la page d'accueil de MakeTou, faute de
 * mieux. Le 28 août 2026, le relevé des transactions l'a confirmé au franc
 * près, sur 21 ventes de l'Accès Essentiel affiché 2 000 FCFA :
 *
 *     Tableau de bord, « Revenus totaux »      42 840  =  21 × 2 040
 *     Transactions, « Entrées en attente »     39 900  =  21 × 1 900
 *
 * Mesuré sur un seul tarif ce jour-là. Le premier Pro (5 000) et le premier
 * VIP (15 000) sont tombés deux heures plus tard : si les 5 % valent aussi
 * pour eux, les 23 ventes du 28 août doivent afficher 58 900 en attente. Le
 * jour où ce nombre ne tombe pas, c'est que le taux dépend de l'offre.
 *
 * Deux prélèvements distincts, et non un seul :
 *
 *   • 100 F retenus au VENDEUR, soit 5 % du prix affiché — c'est ce taux-ci ;
 *   • 40 F ajoutés à l'ACHETEUR — voir TAUX_MAKETOU_ACHETEUR.
 *
 * Seuls les 5 % sortent de la poche du projet : les 40 F n'y sont jamais
 * entrés. Confondre les deux ferait payer à un partenaire une commission de
 * 7 % que personne n'a prélevée sur nous.
 *
 * Il reste réglable par variable d'environnement et AFFICHÉ sur la page des
 * partenaires : un taux faux se voit ; un taux caché ne se voit pas. C'est un
 * partenaire qu'on paie avec.
 */
export const TAUX_MAKETOU_VENDEUR = 0.05;

export function tauxMaketou(): number {
  const brut = Number(process.env.MAKETOU_COMMISSION_PCT);
  if (Number.isFinite(brut) && brut >= 0 && brut <= 100) return brut / 100;
  return TAUX_MAKETOU_VENDEUR;
}

/**
 * Ce que MakeTou ajoute PAR-DESSUS le prix, à la charge de l'acheteur.
 *
 * ── POURQUOI COMPTER UN ARGENT QUI NE NOUS COÛTE RIEN ─────────────────────
 *
 * Il n'entre dans aucun calcul de partenaire — cet argent n'a jamais appartenu
 * au projet. Mais il explique le seul écart qui subsiste entre cette
 * application et le tableau de bord MakeTou : 42 840 là-bas contre 42 000 ici,
 * pour exactement les mêmes 21 ventes.
 *
 * Un écart inexpliqué entre deux écrans qui parlent d'argent fait douter des
 * deux à la fois. On l'a déjà vécu le 22 août 2026 avec Chariow, où vingt
 * minutes d'écart d'horloge ont fait chercher une erreur de calcul inexistante.
 * Celui-ci est donc nommé et affiché, pas effacé.
 *
 * ── CE QUE LA MESURE NE TRANCHE PAS ENCORE ────────────────────────────────
 *
 * Les 40 F ont été relevés sur un seul tarif, l'Essentiel à 2 000 FCFA. Un
 * supplément de 2 % et un forfait fixe de 40 F y donnent exactement le même
 * nombre : cette mesure-là ne les distingue pas.
 *
 * De quoi trancher est arrivé le soir même — un VIP à 15 000 (21 h 11) et un
 * Pro à 5 000 (21 h 16). Sur les 23 ventes du 28 août, 62 000 FCFA de prix de
 * vente, les deux hypothèses cessent de coïncider :
 *
 *     supplément de 2 %   →  63 240 affichés par MakeTou
 *     forfait de 40 F     →  62 920 affichés par MakeTou
 *
 * Trois cent vingt francs les séparent, et c'est le tableau de bord de la
 * boutique qui tranche, pas un raisonnement. La page des partenaires affiche
 * la première hypothèse : si l'écran de MakeTou annonce l'autre nombre, c'est
 * cette constante-ci qu'il faut corriger, et elle seule.
 */
export const TAUX_MAKETOU_ACHETEUR = 0.02;

export function surcoutAcheteurMaketou(xof: number): number {
  return Math.round(Number(xof ?? 0) * TAUX_MAKETOU_ACHETEUR);
}

/**
 * Ce qui a DÉJÀ été retiré de MakeTou, déclaré à la main.
 *
 * ── POURQUOI CE CHIFFRE N'EST PAS CALCULÉ ─────────────────────────────────
 *
 * MakeTou garde l'argent jusqu'au retrait et ne nous en dit rien. Au 28 août
 * 2026 : « Entrées en attente 39 900 », « Solde retirable 0 ». L'application
 * n'a aucun moyen de savoir ce qui est réellement arrivé en banque.
 *
 * Sans cette déclaration, la page affirmerait éternellement que la totalité
 * dort encore chez la boutique — ce qui devient faux au premier retrait. Elle
 * est donc affichée COMME déclarée, pour qu'on voie bien qu'une main humaine
 * la tient à jour et qu'aucune mesure ne la garantit.
 */
export function retireDeMaketouXof(): number {
  const brut = Number(process.env.MAKETOU_RETIRE_XOF);
  return Number.isFinite(brut) && brut >= 0 ? Math.round(brut) : 0;
}

/**
 * Ce que MakeTou a encaissé depuis son ouverture.
 *
 * La frontière est le dernier jour de Chariow, pas une date recopiée : les
 * deux boutiques n'ont jamais encaissé le même jour, et une constante de plus
 * finirait par diverger de celle qui décide déjà du taux de frais.
 */
export function totalMaketou(parJour: RecettesParJour): JourneeBoutique {
  let xof = 0;
  let ventes = 0;
  let fraisXof = 0;
  for (const [jour, poste] of Object.entries(parJour)) {
    if (jour <= DERNIER_JOUR_CHARIOW) continue;
    xof += poste.xof;
    ventes += poste.ventes;
    fraisXof += poste.fraisXof ?? 0;
  }
  return { xof, ventes, fraisXof };
}

/**
 * Le pouls de la boutique : combien de ventes, pour combien, à cet instant.
 *
 * ── POURQUOI UNE LECTURE SÉPARÉE, ET SI COURTE ────────────────────────────
 *
 * La page entière est chère à reconstruire : elle relit les partenaires, la
 * liste des comptes, l'histoire jour par jour. La redemander toutes les vingt
 * secondes pour découvrir qu'il ne s'est rien passé serait la punir de
 * surveiller.
 *
 * Cette lecture-ci ne rend que deux nombres. Tant qu'ils ne bougent pas, rien
 * n'est reconstruit ; dès qu'ils bougent, la page se refait entièrement. On
 * paie le prix fort seulement quand il y a quelque chose à voir.
 *
 * ── LE MÊME FILTRE, OBLIGATOIREMENT ───────────────────────────────────────
 *
 * Il passe par `ventesMaketouParJour` plutôt que de refaire sa requête : les
 * ventes de diagnostic y sont écartées. Une lecture qui en compterait 24 quand
 * la page en affiche 23 déclencherait une reconstruction toutes les vingt
 * secondes, indéfiniment, sans que rien ne change à l'écran.
 */
export async function poulsMaketou(): Promise<{ ventes: number; xof: number }> {
  let ventes = 0;
  let xof = 0;
  for (const [jour, j] of Object.entries(await ventesMaketouParJour())) {
    // ── EXACTEMENT LA MÊME FRONTIÈRE QUE `totalMaketou` ──────────────────
    //
    // Sans elle, une ligne MakeTou datée d'avant la fermeture de Chariow
    // serait comptée ici et écartée là. Les deux nombres ne pourraient plus
    // jamais coïncider, et la page se reconstruirait toutes les vingt
    // secondes pour afficher rigoureusement la même chose — une boucle
    // silencieuse, invisible à l'écran, qui ne se verrait que sur la facture.
    if (jour <= DERNIER_JOUR_CHARIOW) continue;
    ventes += j.ventes;
    xof += j.xof;
  }
  return { ventes, xof };
}

/** Les ventes MakeTou de notre base, regroupées par jour. */
async function ventesMaketouParJour(): Promise<Record<string, { xof: number; ventes: number }>> {
  const { createAdminClient } = await import('./supabase-admin');
  const admin = createAdminClient();

  const parJour: Record<string, { xof: number; ventes: number }> = {};
  const TAILLE = 1000;

  for (let de = 0; de < 20000; de += TAILLE) {
    const { data, error } = await admin
      .from('payment_intents')
      .select('sale_id, amount, created_at')
      .eq('pays_source', 'maketou')
      .order('created_at')
      .range(de, de + TAILLE - 1);

    if (error) throw new Error(error.message);
    if (!data?.length) break;

    for (const v of data) {
      // Les vérifications techniques ne sont pas des recettes. Elles portent
      // une référence reconnaissable, posée exprès pour cet instant.
      if (/^(verif|diagnostic)/i.test(String(v.sale_id ?? ''))) continue;

      const jour = String(v.created_at ?? '').slice(0, 10);
      if (!jour) continue;

      const poste = parJour[jour] ?? { xof: 0, ventes: 0 };
      poste.xof += Math.round(Number(v.amount ?? 0));
      poste.ventes += 1;
      parJour[jour] = poste;
    }

    if (data.length < TAILLE) break;
  }

  return parJour;
}

/**
 * Le total encaissé entre deux dates incluses, au format AAAA-MM-JJ.
 *
 * Les bornes sont comparées comme du texte : `'2026-08-16' <= '2026-08-22'`.
 * Aucune conversion de fuseau horaire n'intervient, donc aucune vente ne peut
 * glisser d'un jour à l'autre selon l'endroit d'où la page est consultée.
 */
export function totalEntre(
  parJour: RecettesParJour,
  du?: string | null,
  au?: string | null
): JourneeBoutique {
  let xof = 0;
  let ventes = 0;
  let fraisXof = 0;
  for (const [jour, poste] of Object.entries(parJour)) {
    if (du && jour < du) continue;
    if (au && jour > au) continue;
    xof += poste.xof;
    ventes += poste.ventes;
    // Les frais s'additionnent journée par journée, au taux de la boutique qui
    // a encaissé chacune. Un taux moyen appliqué au total donnerait un montant
    // que personne n'a jamais prélevé.
    fraisXof += poste.fraisXof ?? 0;
  }
  return { xof, ventes, fraisXof };
}

/** Ce qui reste réellement après les frais de la boutique. */
export function netApresFrais(j: JourneeBoutique): number {
  return Math.max(0, j.xof - (j.fraisXof ?? 0));
}

/**
 * L'heure de lecture, telle qu'elle doit être écrite sous un chiffre d'argent.
 *
 * ── POURQUOI UN CHIFFRE D'ARGENT DOIT PORTER SON HEURE ────────────────────
 *
 * Le 22 août 2026, la page affichait 325 000 FCFA et la boutique 336 000. Les
 * deux étaient exacts : ils avaient simplement été lus à vingt minutes
 * d'intervalle, et rien à l'écran ne permettait de s'en apercevoir. On a donc
 * cherché une erreur de calcul là où il n'y avait qu'un écart d'horloge.
 *
 * Un montant sans heure ne peut pas être confronté à quoi que ce soit. Avec
 * son heure, la comparaison avec le tableau de bord Chariow devient immédiate
 * et sans ambiguïté : mêmes secondes, mêmes francs.
 *
 * L'heure est celle de Conakry, celle du propriétaire — pas celle du serveur,
 * qui tourne en Europe.
 */
export function heureDeLecture(): string {
  return new Date().toLocaleTimeString('fr-FR', {
    timeZone: 'Africa/Conakry',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** Regroupe les journées par mois, indexé AAAA-MM. */
export function parMois(
  parJour: RecettesParJour,
  depuis?: string | null
): Map<string, JourneeBoutique> {
  const mois = new Map<string, JourneeBoutique>();
  for (const [jour, poste] of Object.entries(parJour)) {
    if (depuis && jour < depuis) continue;
    const cle = jour.slice(0, 7);
    const cumul = mois.get(cle) ?? { xof: 0, ventes: 0, fraisXof: 0 };
    cumul.xof += poste.xof;
    cumul.ventes += poste.ventes;
    cumul.fraisXof += poste.fraisXof ?? 0;
    mois.set(cle, cumul);
  }
  return mois;
}
