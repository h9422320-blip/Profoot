/**
 * ── L'ÉLAN ET LE TERRAIN PAR CHAMPIONNAT ─────────────────────────────────
 *
 * La première couche qui a passé la porte du banc d'essai depuis qu'il existe.
 *
 * ── CE QUE LA MESURE DIT, ET SUR COMBIEN DE MATCHS ───────────────────────
 *
 * Rejouée sur 17 985 rencontres, chacune avec seulement ce qui était connu la
 * veille : **+16 vainqueurs justes sur la première moitié, +35 sur la seconde**,
 * soit cinquante et un de plus — et un Brier MEILLEUR que le moteur actuel
 * (0,6183 contre 0,6184 puis 0,6003 contre 0,6003). La porte du challenger
 * exige strictement plus de vainqueurs justes dans LES DEUX moitiés, un Brier
 * qui ne se dégrade pas, et une précision sur les matchs sûrs qui ne recule
 * pas. Les trois conditions sont tenues sans qu'on ait touché à la porte.
 *
 * Prise séparément, chacune des deux moitiés de la couche gagne aussi, mais
 * moins : le terrain par championnat seul fait +8 / +11. C'est le mélange qui
 * est retenu.
 *
 * ── CE QUE CHACUNE APPORTE ───────────────────────────────────────────────
 *
 * L'ÉLAN. Le moteur juge un club sur la moyenne de ses occasions. Un club qui
 * vient d'enchaîner cinq matchs très au-dessus de son niveau habituel a
 * pourtant changé, et la moyenne longue l'ignore. On compare donc les cinq
 * dernières rencontres aux dix dernières : l'écart est l'élan, en attaque
 * comme en défense.
 *
 * LE TERRAIN PAR CHAMPIONNAT. Le moteur applique le même avantage à celui qui
 * reçoit, partout. Or recevoir ne vaut pas la même chose en Premier League et
 * en Eredivisie. On mesure donc, championnat par championnat, l'écart de buts
 * réel de celui qui reçoit, ramené vers la moyenne générale quand les matchs
 * manquent.
 *
 * ── POURQUOI LE CALCUL EST FAIT AILLEURS, ET SEULEMENT LU ICI ───────────
 *
 * Les deux demandent de relire des milliers de rencontres. L'hébergeur coupe
 * ses fonctions à soixante secondes : impossible en production. Le challenger,
 * lui, a déjà tout en local — il calcule chaque nuit et range le résultat,
 * exactement comme pour la mémoire des clubs.
 *
 * ── ET ELLE N'AJOUTE RIEN QUAND ELLE NE SAIT RIEN ───────────────────────
 *
 * Un club sans dix rencontres relevées n'a pas d'élan : la part correspondante
 * vaut zéro. Un championnat sans assez de matchs garde l'avantage moyen. Une
 * réserve vide rend `null`, et le moteur calcule alors exactement comme avant.
 */

import { lireReserve, ecrireReserve } from './api-football';

/** La clé du relevé dans la réserve partagée. */
const CLE = 'elan-terrain:v1';

/** Trente jours : au-delà, un relevé qui ne se refait plus est périmé. */
const CONSERVATION = 30 * 24 * 3600 * 1000;

/** Un relevé plus vieux que cela n'est plus appliqué. */
const PERIME_APRES_MS = 10 * 24 * 3600 * 1000;

/** Combien de rencontres récentes forment l'élan. */
export const COURT = 5;

/** Contre combien de rencontres il se compare. */
export const LONG = 10;

/** La part de l'élan dans la correction. Valeur jugée gagnante sur le banc. */
export const PART_ELAN = 0.2;

/** La part du terrain par championnat. Valeur jugée gagnante sur le banc. */
export const PART_TERRAIN = 0.2;

/** Le rétrécissement du terrain : un championnat peu fourni tend vers la moyenne. */
export const RETRECISSEMENT_TERRAIN = 20;

/** En dessous, un championnat n'a pas assez de matchs pour avoir son avantage. */
export const MIN_RENCONTRES_LIGUE = 60;

/** L'élan d'un club : de combien ses cinq dernières sortent de ses dix. */
export interface ElanClub {
  /** Écart d'occasions produites. Positif = en progrès. */
  attaque: number;
  /** Écart d'occasions concédées. Positif = défense en recul. */
  defense: number;
}

export interface ElanEtTerrain {
  /** Par nom de club, tel que le fournisseur l'écrit. */
  elan: Record<string, ElanClub>;
  /** Par identifiant de championnat : l'avantage de recevoir, en buts. */
  terrain: Record<string, number>;
  /** Quand ce relevé a été fait. */
  calculeLe: string;
  clubs: number;
  championnats: number;
}

/** Une rencontre avec ses occasions, telle que le challenger les tient. */
export interface RencontreAvecTirs {
  date: string;
  ligue: number;
  nomDom: string;
  nomExt: string;
  bd: number;
  be: number;
  /** Occasions produites par celui qui reçoit, et par le visiteur. */
  produitDom?: number;
  produitExt?: number;
}

const moyenne = (l: number[]) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : 0);

/**
 * Calcule l'élan de chaque club et l'avantage du terrain de chaque championnat.
 *
 * `rencontres` doit être trié du plus ancien au plus récent. Seules les
 * dernières `LONG` rencontres d'un club servent à son élan : c'est un état du
 * jour, pas une moyenne de saison.
 */
export function calculerElanEtTerrain(rencontres: RencontreAvecTirs[]): ElanEtTerrain {
  // ── L'ÉLAN, CLUB PAR CLUB ────────────────────────────────────────────────
  const passe = new Map<string, { produit: number; concede: number }[]>();
  const ajouter = (club: string, produit: number, concede: number) => {
    const l = passe.get(club);
    if (l) l.push({ produit, concede });
    else passe.set(club, [{ produit, concede }]);
  };

  for (const r of rencontres) {
    // ── LES OCCASIONS SEULEMENT, JAMAIS LES BUTS ───────────────────────────
    //
    // Une première version retombait sur les buts quand les tirs manquaient,
    // pour couvrir les championnats sans fiches. Rejouée sur le banc, elle
    // PERD : −3 vainqueurs justes sur la première moitié, −11 sur la seconde.
    // La version sans repli, elle, reproduit le mélange gagnant à l'identique
    // — +0 / +0 sur 15 337 rencontres, c'est-à-dire exactement lui.
    //
    // Les buts sont dix fois moins nombreux que les occasions et donc dix fois
    // plus bruités : un élan bâti dessus ajoute du bruit, pas du signal. Un
    // club sans relevé de tirs n'a donc pas d'élan, et c'est très bien ainsi.
    const pd = Number(r.produitDom);
    const pe = Number(r.produitExt);
    if (!Number.isFinite(pd) || !Number.isFinite(pe)) continue;
    ajouter(String(r.nomDom), pd, pe);
    ajouter(String(r.nomExt), pe, pd);
  }

  const elan: Record<string, ElanClub> = {};
  for (const [club, l] of passe) {
    if (l.length < LONG) continue;
    const recents = l.slice(-COURT);
    const longs = l.slice(-LONG);
    elan[club] = {
      attaque: moyenne(recents.map((x) => x.produit)) - moyenne(longs.map((x) => x.produit)),
      defense: moyenne(recents.map((x) => x.concede)) - moyenne(longs.map((x) => x.concede)),
    };
  }

  // ── L'AVANTAGE DE RECEVOIR, CHAMPIONNAT PAR CHAMPIONNAT ─────────────────
  const parLigue = new Map<number, { n: number; somme: number }>();
  let nTotal = 0;
  let sommeTotale = 0;
  for (const r of rencontres) {
    const l = Number(r.ligue);
    const ecart = Number(r.bd) - Number(r.be);
    if (!Number.isFinite(ecart)) continue;
    const c = parLigue.get(l) ?? { n: 0, somme: 0 };
    c.n++;
    c.somme += ecart;
    parLigue.set(l, c);
    nTotal++;
    sommeTotale += ecart;
  }

  const moyenneGenerale = nTotal ? sommeTotale / nTotal : 0;
  const terrain: Record<string, number> = {};
  for (const [ligue, c] of parLigue) {
    if (c.n < MIN_RENCONTRES_LIGUE) continue;
    // Rétrécissement : un championnat peu fourni tend vers la moyenne générale.
    terrain[String(ligue)] = (c.n / (c.n + RETRECISSEMENT_TERRAIN)) * (c.somme / c.n - moyenneGenerale);
  }

  return {
    elan,
    terrain,
    calculeLe: new Date().toISOString(),
    clubs: Object.keys(elan).length,
    championnats: Object.keys(terrain).length,
  };
}

/**
 * La correction à passer au moteur, ou `null` quand on ne sait rien.
 *
 * Rendue au format attendu par le onzième paramètre de `calculerScoreProbable` :
 * un ajustement en buts pour chaque camp. Le moteur la plafonne lui-même.
 *
 * Les deux parts s'additionnent, comme sur le banc : l'élan agit sur les deux
 * camps selon leur forme, le terrain penche d'un côté puis de l'autre.
 */
export function correctionElanTerrain(
  releve: ElanEtTerrain | null | undefined,
  nomDomicile: string,
  nomExterieur: string,
  ligue: number | null | undefined
): { domicile: number; exterieur: number } | null {
  if (!releve) return null;

  // Un relevé qui ne se refait plus ne doit pas continuer d'agir : les formes
  // du mois dernier ne disent rien de celles d'aujourd'hui.
  const quand = Date.parse(String(releve.calculeLe ?? ''));
  if (!Number.isFinite(quand) || Date.now() - quand > PERIME_APRES_MS) return null;

  const a = releve.elan?.[String(nomDomicile)] ?? null;
  const b = releve.elan?.[String(nomExterieur)] ?? null;
  const t = ligue == null ? 0 : Number(releve.terrain?.[String(ligue)] ?? 0);

  const dom = (PART_ELAN * ((a?.attaque ?? 0) + (b?.defense ?? 0))) / 2 + (PART_TERRAIN * t) / 2;
  const ext = (PART_ELAN * ((b?.attaque ?? 0) + (a?.defense ?? 0))) / 2 - (PART_TERRAIN * t) / 2;

  // Rien à corriger : on ne renvoie pas un objet nul, le moteur doit pouvoir
  // calculer exactement comme avant.
  if (dom === 0 && ext === 0) return null;
  return { domicile: dom, exterieur: ext };
}

/**
 * ── LA RÉSERVE RENONCE AVANT D'AVOIR FINI, ET C'EST UN PIÈGE CONNU ───────
 *
 * `lireReserve` abandonne SILENCIEUSEMENT au bout d'une seconde et demie. Ce
 * relevé pèse plusieurs centaines de kilo-octets — 855 clubs et 61
 * championnats au premier rangement — et la lecture dépasse ce délai.
 *
 * Constaté immédiatement après la mise en place, le 14 septembre 2026 : le
 * relevé était bien en base, et la production lisait « absent ». Sans cette
 * relecture, la couche n'aurait JAMAIS agi en ligne — exactement ce qui était
 * arrivé à l'ancrage de la mémoire des clubs deux jours plus tôt, et au relevé
 * de fiabilité le 5 septembre.
 *
 * Deux temps, et le premier ne change pas : le chemin rapide d'abord ; quand
 * il n'a rien rendu, une relecture directe avec cinq secondes. Une base
 * réellement tombée ne fait donc pas attendre l'abonné, et le moteur sait se
 * passer de ce relevé.
 */
const LIMITE_RELECTURE_MS = 5_000;

export async function lireElanEtTerrain(): Promise<ElanEtTerrain | null> {
  const rapide = await lireReserve<ElanEtTerrain>(CLE).catch(() => null);
  if (rapide?.contenu?.clubs) return rapide.contenu;

  try {
    const { createAdminClient } = await import('./supabase-admin');
    const lecture = createAdminClient().from('cache_api').select('contenu').eq('cle', CLE).maybeSingle();
    const limite = new Promise<null>((r) => setTimeout(() => r(null), LIMITE_RELECTURE_MS));
    const resultat: any = await Promise.race([lecture, limite]);
    const contenu = resultat?.data?.contenu;
    if (!contenu?.clubs) return null;
    console.warn('[ÉLAN] Relevé obtenu par relecture directe — la réserve avait renoncé.');
    return contenu as ElanEtTerrain;
  } catch (e: any) {
    console.warn('[ÉLAN] Lecture impossible :', e?.message);
    return null;
  }
}

/** Range un relevé pour que la production le lise. */
export async function rangerElanEtTerrain(releve: ElanEtTerrain): Promise<void> {
  await ecrireReserve(CLE, releve, CONSERVATION);
}
