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

/** La part retenue par la mesure. Plus haut, la correction double celle du marché. */
export const PART_DES_ABSENCES = 0.25;

/** Un titulaire à temps plein sur une saison : environ trente-quatre matchs. */
const MINUTES_PLEINES = 34 * 90;

const CLE_POIDS = 'absences:poids-joueurs:v1';
/** Les minutes d'une saison passée ne bougent plus : un mois suffit. */
const CONSERVATION_MS = 30 * 24 * 60 * 60 * 1000;
const FRAIS_MS = 7 * 24 * 60 * 60 * 1000;

export interface PoidsDesJoueurs {
  calculeLe: string;
  /** `saison:joueur` → minutes jouées cette saison-là. */
  minutes: Record<string, number>;
}

export async function lirePoidsDesJoueurs(): Promise<PoidsDesJoueurs | null> {
  try {
    const r = await lireReserve<PoidsDesJoueurs>(CLE_POIDS);
    return r?.contenu ?? null;
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

  const minutes: Record<string, number> = {};
  for (const ligue of CINQ_GRANDS) {
    for (const s of [saison - 1, saison]) {
      for (let page = 1; page <= 40; page++) {
        const r = await apiFootball<any>(`/players?league=${ligue}&season=${s}&page=${page}`, CACHE_TTL.TEAM_INFO);
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
  const contenu: PoidsDesJoueurs = { calculeLe: new Date().toISOString(), minutes };
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
  if (!fixtureId || !poids || !CINQ_GRANDS.has(Number(ligue))) return null;
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
  const partDe = (idJoueur: number) => {
    const min = Number(poids.minutes[`${s - 1}:${idJoueur}`] ?? 0);
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
