/**
 * QUI MANQUE AU COUP D'ENVOI, ET COMBIEN IL COMPTE.
 *
 * ── POURQUOI CETTE COUCHE EXISTE ─────────────────────────────────────────
 *
 * Demande du propriétaire, le 20 septembre 2026 : le moteur doit progresser
 * sur l'Angleterre, l'Espagne, l'Italie, l'Allemagne et la France. Or il y
 * égale déjà les bookmakers — 53,4 % contre 53,6 % sur 3 402 rencontres. Pour
 * les dépasser, il lui faut une information qu'il n'a jamais eue : la
 * composition réelle des équipes.
 *
 * ── CE QUI A ÉTÉ MESURÉ, ET CE QUI A ÉTÉ REFUSÉ ─────────────────────────
 *
 * Sur 3 553 rencontres des cinq grands championnats depuis août 2024, avec le
 * marché et la grille de Poisson — donc contre la production telle qu'elle
 * tourne :
 *
 *     part 0,15  →  +3 vainqueurs
 *     part 0,25  →  +12   ← retenue
 *     part 0,35  →  +13
 *     part 0,50  →  +4
 *     part 1,00  →  −31
 *
 * La courbe est cohérente : un peu d'information utile, puis une correction
 * qui double celle des bookmakers et abîme tout. À 0,25, le gain est positif
 * sur les DEUX moitiés de la période, sans période négative, et dans quatre
 * championnats sur cinq (Angleterre +3, France +4, Allemagne +5, Italie +2,
 * Espagne −2).
 *
 * REFUSÉ au passage : la même couche SANS le marché (1 807 → 1 802 → 1 790
 * vainqueurs). Seule, elle ne vaut rien ; c'est bien un complément.
 *
 * ── CE QU'ELLE NE FAIT PAS ──────────────────────────────────────────────
 *
 * Elle ne parle que des cinq grands championnats : ailleurs, le poids des
 * joueurs n'est pas relevé, la part vaut zéro et le moteur rend exactement ce
 * qu'il rendait. Elle ne remplace aucune couche ; elle s'ajoute après le
 * marché.
 */

import { apiFootball, CACHE_TTL, lireReserve, ecrireReserve } from './api-football';

/** Angleterre, Espagne, Italie, Allemagne, France. */
export const CINQ_GRANDS: ReadonlySet<number> = new Set([39, 140, 135, 78, 61]);

/**
 * ── ET LES ONZE AUTRES CHAMPIONNATS COTÉS, DEPUIS LE 20 SEPTEMBRE 2026 ───
 *
 * Championship, Écosse, 2. Bundesliga, Serie B, Segunda, Ligue 2, Belgique,
 * Turquie, Grèce, Pays-Bas, Portugal. Mesuré sur 7 742 rencontres depuis août
 * 2024, avec le marché et la grille de Poisson : 3 885 → 3 895 bons
 * vainqueurs, positif sur les deux moitiés (+6, +4) et sur les trois périodes
 * (+2, +5, +3), avec 4 scores exacts de plus.
 *
 * DEUX COUCHES N'Y ONT PAS ÉTÉ ÉTENDUES, parce qu'elles y font perdre :
 * l'entraîneur fraîchement arrivé (−4) et la parole rendue au moteur sur les
 * matchs serrés (−11). Elles restent réservées aux cinq grands championnats.
 */
export const AUTRES_DU_MARCHE: ReadonlySet<number> = new Set([40, 179, 79, 136, 141, 62, 144, 203, 197, 88, 94]);

/** Les compétitions où les absents sont pesés. */
export const LIGUES_DES_ABSENCES: ReadonlySet<number> = new Set([...CINQ_GRANDS, ...AUTRES_DU_MARCHE]);

/** La part retenue par la mesure. Plus haut, la correction double celle du marché. */
export const PART_DES_ABSENCES = 0.25;

/** Un titulaire à temps plein sur une saison : environ trente-quatre matchs. */
const MINUTES_PLEINES = 34 * 90;

const CLE_POIDS = 'absences:poids-joueurs:v1';
/** Les minutes d'une saison passée ne bougent plus : un mois suffit. */
const CONSERVATION_MS = 30 * 24 * 60 * 60 * 1000;
const FRAIS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * ── UN RELEVÉ COMPACT, PARCE QU'IL EST LU À CHAQUE ANALYSE ───────────────
 *
 * Quinze mille lignes `saison:joueur → minutes` pèsent près de trois cents
 * milliers de caractères, et leur lecture dépassait trois secondes — au-delà
 * du garde-temps de la réserve. Deux décisions :
 *
 *   • on n'écrit que les joueurs à 450 minutes ou plus (cinq matchs pleins).
 *     En dessous, le poids d'un absent vaut moins d'un centième d'équipe :
 *     l'oublier ne change rien au calcul, et le relevé maigrit de moitié ;
 *   • chaque saison tient dans UNE chaîne « joueur:minutes,… », au lieu d'un
 *     objet de milliers de clés.
 */
export interface PoidsDesJoueurs {
  calculeLe: string;
  /** Par saison : « joueur:minutes,joueur:minutes… ». */
  saisons: Record<string, string>;
}

/** En dessous, un absent ne pèse rien : on ne l'enregistre pas. */
const MINUTES_MINIMUM = 450;

/** La chaîne d'une saison, relue en table : joueur → minutes. */
export function tableDeLaSaison(poids: PoidsDesJoueurs | null, saison: number): Map<number, number> {
  const brut = poids?.saisons?.[String(saison)];
  const table = new Map<number, number>();
  if (!brut) return table;
  for (const morceau of brut.split(',')) {
    const [j, min] = morceau.split(':');
    const joueur = Number(j);
    const minutes = Number(min);
    if (joueur > 0 && minutes > 0) table.set(joueur, minutes);
  }
  return table;
}

/** Construit la forme compacte à partir d'une table `saison:joueur → minutes`. */
export function compacter(minutes: Record<string, number>): Record<string, string> {
  const parSaison: Record<string, string[]> = {};
  for (const [cle, valeur] of Object.entries(minutes)) {
    const [saison, joueur] = cle.split(':');
    const min = Math.round(Number(valeur));
    if (!(min >= MINUTES_MINIMUM) || !joueur) continue;
    (parSaison[saison] ??= []).push(`${joueur}:${min}`);
  }
  const sortie: Record<string, string> = {};
  for (const [saison, liste] of Object.entries(parSaison)) sortie[saison] = liste.join(',');
  return sortie;
}

/**
 * ── UNE LECTURE PATIENTE, ET UNE SEULE PAR PASSAGE ──────────────────────
 *
 * Le relevé pèse plusieurs centaines de milliers de caractères : la lecture
 * rapide de la réserve abandonne au bout d'une seconde et demie, et la couche
 * se serait tue EN SILENCE — la faute exacte qui a fait figer Werder Brême
 * sans le marché, le 18 septembre 2026. On relit donc directement en base,
 * avec cinq secondes, et on garde le résultat dix minutes en mémoire : une
 * préparation qui prépare cent rencontres ne relit pas cent fois.
 */
let enMemoire: { quand: number; poids: PoidsDesJoueurs | null } | null = null;
const MEMOIRE_MS = 10 * 60 * 1000;

export async function lirePoidsDesJoueurs(): Promise<PoidsDesJoueurs | null> {
  if (enMemoire && Date.now() - enMemoire.quand < MEMOIRE_MS) return enMemoire.poids;
  try {
    const r = await lireReserve<PoidsDesJoueurs>(CLE_POIDS);
    if (r?.contenu) {
      enMemoire = { quand: Date.now(), poids: r.contenu };
      return r.contenu;
    }
  } catch {
    // La lecture rapide a renoncé : on insiste ci-dessous.
  }
  try {
    const { createAdminClient } = await import('./supabase-admin');
    const lecture = createAdminClient().from('cache_api').select('contenu').eq('cle', CLE_POIDS).maybeSingle();
    const limite = new Promise<'delai'>((r) => setTimeout(() => r('delai'), 8_000));
    const r: any = await Promise.race([lecture, limite]);
    const contenu = r === 'delai' || r?.error ? null : ((r?.data?.contenu as PoidsDesJoueurs) ?? null);
    // Un échec n'est PAS gardé : on retentera au passage suivant.
    if (contenu) enMemoire = { quand: Date.now(), poids: contenu };
    return contenu;
  } catch {
    return null;
  }
}

/**
 * Relève les minutes jouées par chaque joueur des cinq grands championnats.
 *
 * C'est le POIDS d'un absent : sans lui, perdre un remplaçant compterait
 * autant que perdre un buteur. On relève la saison en cours ET la précédente,
 * parce que la couche lit toujours la PRÉCÉDENTE — celle qui ne contient pas
 * l'avenir du match qu'on juge.
 */
export async function recalculerPoidsDesJoueurs(
  saison = saisonCourante(),
  options: { forcer?: boolean } = {}
): Promise<PoidsDesJoueurs | null> {
  if (!options.forcer) {
    const existant = await lirePoidsDesJoueurs();
    const age = existant ? Date.now() - Date.parse(existant.calculeLe) : Infinity;
    if (existant && Number.isFinite(age) && age < FRAIS_MS) return existant;
  }

  // ── ON COMPLÈTE, ON NE REMPLACE JAMAIS ──────────────────────────────────
  //
  // Constaté le 20 septembre 2026 : un relevé où le fournisseur a été lent a
  // rendu 4 170 joueurs au lieu de quinze mille, et il aurait ÉCRASÉ un relevé
  // complet. Le poids d'une saison passée ne bouge plus : ce qu'on sait déjà
  // reste, et chaque passage ajoute ce qui manquait.
  const existant = await lirePoidsDesJoueurs();
  const minutes: Record<string, number> = {};
  for (const saison of Object.keys(existant?.saisons ?? {})) {
    for (const [joueur, min] of tableDeLaSaison(existant, Number(saison))) minutes[`${saison}:${joueur}`] = min;
  }
  for (const ligue of LIGUES_DES_ABSENCES) {
    for (const s of [saison - 1, saison]) {
      for (let page = 1; page <= 60; page++) {
        // ── UNE PAGE MANQUÉE N'ARRÊTE PAS LE RELEVÉ ───────────────────────
        //
        // Constaté le 20 septembre 2026 : une seule réponse lente du
        // fournisseur coupait la boucle, et le relevé s'est arrêté à 799
        // joueurs au lieu de quinze mille. On réessaie deux fois, en soufflant,
        // avant d'abandonner CETTE page — et on continue la suivante.
        let r: any = null;
        for (let essai = 1; essai <= 3 && !r?.response?.length; essai++) {
          r = await apiFootball<any>(`/players?league=${ligue}&season=${s}&page=${page}`, CACHE_TTL.TEAM_INFO);
          if (!r?.response?.length && essai < 3) await new Promise((t) => setTimeout(t, 4_000));
        }
        if (!r?.response?.length) break;
        for (const x of r.response) {
          const st = (x.statistics ?? []).find((y: any) => Number(y?.league?.id) === ligue) ?? x.statistics?.[0];
          const min = Number(st?.games?.minutes ?? 0);
          if (min > 0) minutes[`${s}:${x?.player?.id}`] = min;
        }
        if (page >= Number(r?.paging?.total ?? 1)) break;
      }
    }
  }

  if (!Object.keys(minutes).length) return null;
  const contenu: PoidsDesJoueurs = { calculeLe: new Date().toISOString(), saisons: compacter(minutes) };
  console.log(
    `[ABSENCES] ${Object.keys(minutes).length} joueurs pesés, ${Object.values(contenu.saisons).reduce((t, x) => t + x.split(',').length, 0)} retenus.`
  );
  try {
    await ecrireReserve(CLE_POIDS, contenu, CONSERVATION_MS);
  } catch {
    // Une écriture impossible n'empêche pas de servir le calcul en cours.
  }
  return contenu;
}

function saisonCourante(maintenant = new Date()): number {
  const an = maintenant.getUTCFullYear();
  return maintenant.getUTCMonth() >= 6 ? an : an - 1;
}

/**
 * Ce qui manque à chaque équipe pour CETTE rencontre.
 *
 * Renvoie `null` hors des cinq grands championnats, sans relevé, ou quand le
 * fournisseur ne dit rien : le moteur se comporte alors comme avant.
 */
export async function absencesPourLeMatch(
  fixtureId: number | string | null | undefined,
  ligue: number | string | null | undefined,
  saison: number | string | null | undefined,
  equipeDomicile: number | string | null | undefined,
  equipeExterieur: number | string | null | undefined,
  poids: PoidsDesJoueurs | null
): Promise<{ domicile: number; exterieur: number; poids: number } | null> {
  if (!fixtureId || !poids || !LIGUES_DES_ABSENCES.has(Number(ligue))) return null;
  const s = Number(saison);
  if (!Number.isFinite(s)) return null;

  let reponse: any = null;
  try {
    // Une réserve courte : les absences bougent jusqu'au coup d'envoi.
    reponse = await apiFootball<any>(`/injuries?fixture=${fixtureId}`, CACHE_TTL.FIXTURES_TODAY);
  } catch {
    return null;
  }
  const liste = reponse?.response ?? [];
  if (!liste.length) return null;

  // Le poids d'un joueur est ce qu'il a joué LA SAISON PRÉCÉDENTE : la saison
  // en cours contiendrait l'avenir de la rencontre qu'on juge.
  const table = tableDeLaSaison(poids, s - 1);
  if (!table.size) return null;
  const partDe = (idJoueur: number) => {
    const min = table.get(idJoueur) ?? 0;
    if (!(min > 0)) return 0;
    return Math.min(1, min / MINUTES_PLEINES) / 11;
  };

  let manqueDom = 0;
  let manqueExt = 0;
  for (const x of liste) {
    const part = partDe(Number(x?.player?.id ?? 0));
    if (!part) continue;
    const equipe = Number(x?.team?.id ?? 0);
    if (equipe === Number(equipeDomicile)) manqueDom += part;
    else if (equipe === Number(equipeExterieur)) manqueExt += part;
  }

  if (!(manqueDom > 0) && !(manqueExt > 0)) return null;
  return { domicile: manqueDom, exterieur: manqueExt, poids: PART_DES_ABSENCES };
}

/**
 * LES DEUX CORRECTIONS RÉUNIES : CE QUI MANQUE, ET QUI ENTRAÎNE.
 *
 * Le moteur reçoit UNE couche. Les absents comptent pour leur part mesurée
 * (0,25), l'entraîneur fraîchement arrivé pour la sienne (0,20 pendant
 * soixante jours), et l'ensemble part avec une part de 1 — exactement la forme
 * mesurée au banc d'essai : 1 892 → 1 919 bons vainqueurs.
 */
export function composerLaCouche(
  absences: { domicile: number; exterieur: number; poids: number } | null,
  entraineurNeufDomicile = 0,
  entraineurNeufExterieur = 0
): { domicile: number; exterieur: number; poids: number } | null {
  const domicile = (absences ? absences.domicile * absences.poids : 0) + (entraineurNeufDomicile || 0);
  const exterieur = (absences ? absences.exterieur * absences.poids : 0) + (entraineurNeufExterieur || 0);
  if (!(domicile > 0) && !(exterieur > 0)) return null;
  return { domicile, exterieur, poids: 1 };
}

/**
 * LA COUCHE COMPLÈTE, ET SURTOUT : ELLE NE PEUT PAS FAIRE TOMBER UNE ANALYSE.
 *
 * ── CE QUI EST ARRIVÉ LE 20 SEPTEMBRE 2026 ──────────────────────────────
 *
 * Le relevé des joueurs a changé de forme (compacte) AVANT que la version qui
 * sait la lire soit en ligne. L'ancienne lisait `poids.minutes[…]` sur un
 * objet qui n'existait plus : « Cannot read properties of undefined ». Vingt
 * et une analyses ont échoué en trois minutes, et l'abonné voyait « rien
 * servi » — pour un confort dont il ignore jusqu'au nom.
 *
 * Une couche est un CONFORT. Elle améliore le pronostic quand elle fonctionne,
 * et elle doit disparaître sans bruit quand elle ne fonctionne pas. Tout passe
 * donc désormais par ici, sous un seul `try` : la moindre erreur rend `null`,
 * et le moteur calcule comme avant la couche.
 */
export async function coucheDesAbsences(
  fixtureId: number | string | null | undefined,
  ligue: number | string | null | undefined,
  saison: number | string | null | undefined,
  equipeDomicile: number | string | null | undefined,
  equipeExterieur: number | string | null | undefined,
  entraineurNeufDomicile = 0,
  entraineurNeufExterieur = 0
): Promise<{ domicile: number; exterieur: number; poids: number } | null> {
  try {
    const poids = await lirePoidsDesJoueurs();
    const absences = await absencesPourLeMatch(fixtureId, ligue, saison, equipeDomicile, equipeExterieur, poids);
    return composerLaCouche(absences, entraineurNeufDomicile, entraineurNeufExterieur);
  } catch (e: any) {
    console.warn('[ABSENCES] Couche ignorée pour cette analyse :', e?.message);
    return null;
  }
}
