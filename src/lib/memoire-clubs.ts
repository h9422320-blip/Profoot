import { lireReserve, ecrireReserve } from './api-football';

/**
 * ── LA MÉMOIRE DE TOUS LES CLUBS ───────────────────────────────────────────
 *
 * ── LE TROU QU'ELLE BOUCHE ────────────────────────────────────────────────
 *
 * Le relevé des tirs (`forme-occasions.ts`) ne couvre que les sept grands
 * championnats. Dès qu'un club en sort — Sabah, Qarabağ, Ararat-Armenia, un
 * tour préliminaire, un promu sans fiches —, `butsAttendusOccasions` rend
 * `null` et le moteur perd d'un coup TOUTE la moitié occasions de son calcul,
 * sans le dire. Mesuré le 12 septembre 2026 sur les matchs rejoués depuis le
 * 15 février : **50 % des matchs de Ligue des champions, 41 % de l'Europa
 * League, 14 à 25 % des grands championnats**. C'est ainsi que Manchester
 * United a été annoncé perdant à 66 % contre Sabah le 10 septembre, pour finir
 * 4-0 — vu par dix abonnés.
 *
 * ── CE QU'ELLE EST ────────────────────────────────────────────────────────
 *
 * Une note par club, bâtie sur TOUTES les rencontres rangées — 18 977 matchs
 * de 62 compétitions au 12 septembre 2026, coupes d'Europe comprises. Chaque
 * club part de 1 500 ; chaque match déplace les deux notes selon le résultat,
 * l'écart de buts et ce qui était attendu. Les matchs européens font circuler
 * le niveau d'un championnat à l'autre : c'est par eux qu'on sait ce que vaut
 * un club azerbaïdjanais face à un anglais.
 *
 * ── OÙ ELLE AGIT, ET OÙ ELLE SE TAIT ──────────────────────────────────────
 *
 * UNIQUEMENT là où le moteur est aveugle, c'est-à-dire quand les occasions
 * manquent. Partout ailleurs le moteur voit mieux qu'elle — mesuré : la même
 * note appliquée à TOUS les matchs dégrade le pronostic (couche Elo refusée le
 * 11 septembre). Elle se tait aussi si elle ne connaît pas l'un des deux
 * clubs, ou si elle n'a jamais été calculée.
 *
 * ── CE QUI A ÉTÉ MESURÉ ───────────────────────────────────────────────────
 *
 * Rejeu par le vrai moteur, chaque match avec seulement ce qui était connu la
 * veille, sur les 7 780 rencontres de toutes compétitions depuis le
 * 15 février 2026, dont 4 922 aveugles — réglage k=30, part 0,6 :
 *
 *   | période | 1re moitié | 2e moitié | sûr ≥ 60 % |
 *   |---|---|---|---|
 *   | tout l'historique | +1 juste | **+30 justes** | 71,8 % / 68,1 % |
 *   | trois derniers mois | +10 justes | **+23 justes** | 68,8 % / 66,2 % |
 *
 * Contre 63,7 % pour le moteur seul quand il est sûr de lui. Le Brier
 * s'améliore dans les deux moitiés et sur les deux périodes. C'est le seul
 * dosage qui passe la porte du challenger sur l'historique ENTIER **et** sur
 * la période récente. Dans le périmètre des sept grands championnats, où elle
 * ne concerne que 263 matchs, elle est neutre à un match près.
 */

const CLE = 'memoire-clubs:v1';
const CONSERVATION = 30 * 24 * 60 * 60 * 1000;

/** Au-delà, la mémoire est trop vieille pour parler d'équipes d'aujourd'hui. */
const PERIME_APRES_MS = 45 * 24 * 60 * 60 * 1000;

/** Le pas d'apprentissage, et la part du chemin concédée à la mémoire. */
export const K_MEMOIRE = 30;
export const PART_MEMOIRE = 0.6;

/** L'avantage de recevoir, en points de note — l'usage du domaine. */
const AVANTAGE_TERRAIN = 65;

/**
 * La part du nul. Le moteur l'estime à 26,0 % pour 25,7 % réels (mesuré le
 * 5 septembre 2026) : la mémoire ne prétend pas faire mieux, elle ne parle que
 * de qui domine.
 */
const PART_DU_NUL = 0.26;

/**
 * ── L'ANCRAGE SUR LA HIÉRARCHIE, AJOUTÉ LE 12 SEPTEMBRE 2026 ──────────────
 *
 * Une note de type Elo gonfle pour le champion d'un championnat faible : il
 * gagne tout chez lui, et les matchs entre pays sont trop rares pour corriger.
 * Mesuré le 12 septembre 2026 : Sabah 1796 contre Manchester United 1668. La
 * première version, branchée le matin, annonçait Sabah vainqueur — retirée le
 * même jour.
 *
 * On ne laisse donc plus la note décider du niveau d'un pays. Chaque note est
 * recentrée sur la moyenne de son championnat, puis ancrée au niveau MESURÉ de
 * ce championnat (`forces-championnats`, 57 compétitions, 34 101 matchs) :
 *
 *   note ancrée = note − moyenne du championnat + 1500 + ÉCHELLE × ln(coefficient)
 *
 * Premier League 1,600 donne +188 points, un championnat inconnu 1 donne 0 —
 * il se retrouve au milieu, et non au sommet. Dans un même championnat, rien
 * ne change : l'écart entre deux clubs est conservé.
 *
 * Mesuré sur 4 409 matchs aveugles, échelle 400, part 0,6 : +1 et +28
 * vainqueurs justes, Brier meilleur des deux côtés, 72,0 / 68,9 % quand le
 * moteur est sûr de lui contre 64,0 %. Sur les 37 matchs de coupe où un club
 * exotique rencontre un club connu — le type d'erreur le plus visible pour un
 * abonné — la note brute faisait perdre un match, l'ancrée n'en perd aucun.
 */
export const ECHELLE_HIERARCHIE = 400;

/** Une coupe d'Europe n'est le championnat de personne. */
const COUPES = new Set([2, 3, 848]);

/** Sans assez de matchs, une note ne décrit rien. */
const MATCHS_MINIMUM = 5;

export interface MemoireClubs {
  /** Note par identifiant de club, en texte (une réserve JSON n'a pas de clés numériques). */
  notes: Record<string, number>;
  /** Combien de rencontres chaque club a réellement jouées dans ce calcul. */
  joues: Record<string, number>;
  calculeLe: string;
  rencontres: number;
  clubs: number;
  /** L'échelle d'ancrage employée, et le nombre de championnats ancrés. */
  echelle?: number;
  championnatsAncres?: number;
}

export interface RencontreJouee {
  date: string;
  /** Le numéro de la compétition : il sert à ancrer le club sur son niveau. */
  ligue?: number | string;
  dom: number | string;
  ext: number | string;
  /** Buts du club qui reçoit, puis de l'autre. */
  bd: number;
  be: number;
}

/**
 * Bâtit les notes depuis l'historique, du plus ancien au plus récent.
 *
 * Fonction PURE : le challenger l'appelle sur son fichier local, sans coûter
 * une seule demande au fournisseur.
 */
export function calculerMemoireClubs(
  rencontres: RencontreJouee[],
  options: { k?: number; echelle?: number; coefficients?: Record<string, number> | null } = {}
): MemoireClubs {
  const k = options.k ?? K_MEMOIRE;
  const echelle = options.echelle ?? ECHELLE_HIERARCHIE;
  const coefficients = options.coefficients ?? null;

  const notes = new Map<string, number>();
  const joues = new Map<string, number>();
  const lire = (id: string) => notes.get(id) ?? 1500;
  const attendu = (dom: string, ext: string) =>
    1 / (1 + Math.pow(10, -(lire(dom) + AVANTAGE_TERRAIN - lire(ext)) / 400));

  // Le championnat d'un club est celui où on l'a le plus vu, coupes exclues.
  const vus = new Map<string, Map<string, number>>();
  const noter = (club: string, ligue: string | null) => {
    if (!ligue) return;
    let c = vus.get(club);
    if (!c) { c = new Map(); vus.set(club, c); }
    c.set(ligue, (c.get(ligue) ?? 0) + 1);
  };

  let retenues = 0;
  const ordre = [...rencontres].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  for (const m of ordre) {
    const dom = String(m.dom);
    const ext = String(m.ext);
    const bd = Number(m.bd);
    const be = Number(m.be);
    if (!dom || !ext || dom === ext || !Number.isFinite(bd) || !Number.isFinite(be)) continue;

    const ligue = m.ligue === null || m.ligue === undefined ? null : String(m.ligue);
    if (ligue && !COUPES.has(Number(ligue))) {
      noter(dom, ligue);
      noter(ext, ligue);
    }

    const prevu = attendu(dom, ext);
    const obtenu = bd > be ? 1 : bd === be ? 0.5 : 0;
    // Une large victoire en dit plus qu'un but d'écart, sans pour autant
    // compter double : l'échelle du domaine.
    const ecart = Math.abs(bd - be);
    const ampleur = ecart <= 1 ? 1 : ecart === 2 ? 1.5 : (11 + ecart) / 8;
    const delta = k * ampleur * (obtenu - prevu);
    notes.set(dom, lire(dom) + delta);
    notes.set(ext, lire(ext) - delta);
    joues.set(dom, (joues.get(dom) ?? 0) + 1);
    joues.set(ext, (joues.get(ext) ?? 0) + 1);
    retenues++;
  }

  // ── RECENTRER, PUIS ANCRER ─────────────────────────────────────────────
  const ligueDe = new Map<string, string>();
  for (const [club, c] of vus) {
    let meilleure = '';
    let combien = -1;
    for (const [ligue, n] of c) if (n > combien) { meilleure = ligue; combien = n; }
    if (meilleure) ligueDe.set(club, meilleure);
  }
  const somme = new Map<string, number>();
  const nombre = new Map<string, number>();
  for (const [club, note] of notes) {
    const ligue = ligueDe.get(club);
    if (!ligue) continue;
    somme.set(ligue, (somme.get(ligue) ?? 0) + note);
    nombre.set(ligue, (nombre.get(ligue) ?? 0) + 1);
  }
  const ancres = new Map<string, number>();
  // On compte les championnats dont le niveau vient VRAIMENT de la hiérarchie
  // mesurée — un coefficient de 1 en fait partie, même si son ancrage vaut
  // zéro point. C'est ce compteur qui autorise la mémoire à parler.
  let ancresConnues = 0;
  for (const ligue of nombre.keys()) {
    const coef = Number(coefficients?.[ligue]);
    const connu = Number.isFinite(coef) && coef > 0;
    if (connu) ancresConnues++;
    ancres.set(ligue, echelle * Math.log(connu ? coef : 1));
  }
  const finales = new Map<string, number>();
  for (const [club, note] of notes) {
    const ligue = ligueDe.get(club);
    const n = ligue ? nombre.get(ligue) ?? 0 : 0;
    if (!ligue || n < 2) {
      // Sans championnat identifiable, le club reste où il est : on ne sait
      // pas le situer, on ne prétend pas le faire.
      finales.set(club, note);
      continue;
    }
    const moyenne = (somme.get(ligue) ?? 0) / n;
    finales.set(club, note - moyenne + 1500 + (ancres.get(ligue) ?? 0));
  }

  return {
    notes: Object.fromEntries([...finales].map(([id, n]) => [id, Math.round(n * 10) / 10])),
    joues: Object.fromEntries(joues),
    calculeLe: new Date().toISOString(),
    rencontres: retenues,
    clubs: finales.size,
    echelle,
    championnatsAncres: ancresConnues,
  };
}

/**
 * L'avis de la mémoire sur qui domine, ou `null` quand elle n'a rien à dire.
 *
 * `null` dès que : la mémoire manque, elle est périmée, l'un des deux clubs
 * lui est inconnu, ou l'un des deux a joué moins de cinq matchs. Dans tous ces
 * cas le moteur rend EXACTEMENT ce qu'il rendait.
 */
export function avisDeLaMemoire(
  memoire: MemoireClubs | null | undefined,
  idDomicile: number | string | null | undefined,
  idExterieur: number | string | null | undefined,
  part: number = PART_MEMOIRE
): { dom: number; nul: number; ext: number; poids: number } | null {
  if (!memoire?.notes) return null;
  // ── SANS ANCRAGE, ELLE SE TAIT ─────────────────────────────────────────
  //
  // Le 12 septembre 2026, une mémoire calculée SANS la hiérarchie des
  // championnats — la lecture avait silencieusement échoué sur son garde-temps
  // de 1,5 s — notait Sabah au-dessus de Manchester United et annonçait Sabah
  // vainqueur. Une mémoire non ancrée est donc inutilisable, et ce verrou
  // l'empêche de parler.
  if (!memoire.championnatsAncres || memoire.championnatsAncres < 1) return null;
  const age = Date.parse(String(memoire.calculeLe));
  if (!Number.isFinite(age) || Date.now() - age > PERIME_APRES_MS) return null;
  if (idDomicile === null || idDomicile === undefined || idExterieur === null || idExterieur === undefined) return null;

  const dom = String(idDomicile);
  const ext = String(idExterieur);
  const noteDom = Number(memoire.notes[dom]);
  const noteExt = Number(memoire.notes[ext]);
  if (!Number.isFinite(noteDom) || !Number.isFinite(noteExt)) return null;
  if ((memoire.joues?.[dom] ?? 0) < MATCHS_MINIMUM || (memoire.joues?.[ext] ?? 0) < MATCHS_MINIMUM) return null;

  const poids = Number(part);
  if (!Number.isFinite(poids) || poids <= 0) return null;

  const prevu = 1 / (1 + Math.pow(10, -(noteDom + AVANTAGE_TERRAIN - noteExt) / 400));
  if (!Number.isFinite(prevu)) return null;

  return {
    dom: (1 - PART_DU_NUL) * prevu,
    nul: PART_DU_NUL,
    ext: (1 - PART_DU_NUL) * (1 - prevu),
    poids: Math.min(1, poids),
  };
}

/** La mémoire rangée en réserve, ou `null` — jamais une exception. */
export async function lireMemoireClubs(): Promise<MemoireClubs | null> {
  try {
    const r = await lireReserve<MemoireClubs>(CLE);
    return r?.contenu ?? null;
  } catch (e: any) {
    console.warn('[MEMOIRE] Lecture impossible :', e?.message);
    return null;
  }
}

/**
 * Range la mémoire en réserve. Appelée par le challenger, sur l'ordinateur du
 * propriétaire : il a déjà les 18 977 rencontres en local, le calcul ne coûte
 * donc aucune demande au fournisseur. La production ne fait que LIRE.
 */
export async function rangerMemoireClubs(memoire: MemoireClubs): Promise<void> {
  await ecrireReserve(CLE, memoire, CONSERVATION);
}
