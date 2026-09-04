/**
 * CE QUE LE MOTEUR SAIT DE LUI-MÊME, ET QU'IL NE DISAIT PAS.
 *
 * ── LE CONSTAT QUI A DÉCLENCHÉ CE FICHIER ─────────────────────────────────
 *
 * Mesuré le 4 septembre 2026 sur 2 854 rencontres jugées, en classant chaque
 * match par l'écart entre l'issue la plus probable et la suivante :
 *
 *     match très serré  (< 10 points d'écart)    699 matchs → 33,6 %
 *     léger favori      (10 à 25)               1 049 matchs → 46,8 %
 *     favori net        (25 à 45)                 789 matchs → 55,3 %
 *     favori écrasant   (45 et plus)              317 matchs → 69,1 %
 *
 * Le moteur sait donc parfaitement distinguer un pronostic solide d'un coup de
 * dés. Du simple au double. Et pendant ce temps, l'écran affichait
 * « Confiance de l'IA : Très élevée » sur 89 % des analyses — 2 555 sur 2 854,
 * pour 49,8 % de réussite réelle.
 *
 * Cette confiance-là n'était pas fausse : elle mesurait la SOLIDITÉ de
 * l'analyse — la quantité de données disponibles, la netteté de l'écart. Un
 * choix assumé le 18 août 2026, et défendable. Mais aucun client ne fait cette
 * distinction. Il lit « Très élevée », il comprend « ce pronostic est sûr », et
 * une fois sur deux il se trompe. C'est de là que viennent les
 * « profoot AI nous envoie en brousse » sous les publications, et le message
 * d'un abonné le 4 septembre : « les deux jours là, ils ratent beaucoup ».
 *
 * ── CE QU'ON AFFICHE DÉSORMAIS ────────────────────────────────────────────
 *
 * Non plus une note interne, mais un fait vérifiable : sur les matchs de CE
 * type déjà joués, voici combien de fois l'application a eu raison. Le chiffre
 * est mesuré, jamais choisi. Il vient de `jugements_moteur`, la table où
 * chaque pronostic est confronté à son résultat.
 *
 * ── TROIS GARDE-FOUS ──────────────────────────────────────────────────────
 *
 *   MATIÈRE   Sous `MATCHS_MINIMUM_LIGUE`, on ne descend pas au championnat et
 *             l'on s'en tient au chiffre global. Sous `MATCHS_MINIMUM_GLOBAL`,
 *             on ne dit RIEN : mieux vaut se taire qu'annoncer « 100 % de
 *             réussite » mesuré sur trois rencontres.
 *   SILENCE   Aucune valeur inventée. Quand la matière manque, la fonction
 *             rend `null` et l'écran retombe sur ce qu'il affichait avant.
 *   FRAÎCHEUR Le calcul est refait au plus toutes les six heures. Les taux
 *             bougent lentement — quelques dizaines de matchs par jour sur
 *             plusieurs milliers — et relire la table à chaque analyse
 *             coûterait une requête sur la page la plus visitée du site.
 */

import { createAdminClient } from './supabase-admin';
import { lireReserve, ecrireReserve } from './api-football';

/** En deçà, on ne descend pas au niveau du championnat. */
export const MATCHS_MINIMUM_LIGUE = 40;

/** En deçà, on n'affiche RIEN. Un taux sur dix matchs n'est pas un taux. */
export const MATCHS_MINIMUM_GLOBAL = 100;

const TTL = 6 * 60 * 60 * 1000;
const CLE = 'fiabilite:apprise';

/**
 * Les quatre familles de matchs, par écart entre l'issue la plus probable et
 * la suivante. Ces bornes ne sont pas choisies au hasard : elles séparent des
 * populations dont les taux de réussite vont de 33 % à 69 %.
 */
export const TRANCHES = [
  { cle: 'serre', min: 0, libelle: 'Match très serré' },
  { cle: 'leger', min: 10, libelle: 'Léger favori' },
  { cle: 'net', min: 25, libelle: 'Favori net' },
  { cle: 'ecrasant', min: 45, libelle: 'Favori écrasant' },
] as const;

export type CleTranche = (typeof TRANCHES)[number]['cle'];

/** Range un match dans sa famille, à partir des trois probabilités. */
export function trancheDe(proba1: number, probaNul: number, proba2: number): CleTranche {
  const [premiere, seconde] = [Number(proba1), Number(probaNul), Number(proba2)]
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => b - a);
  const ecart = (premiere ?? 0) - (seconde ?? 0);
  let retenue: CleTranche = 'serre';
  for (const t of TRANCHES) if (ecart >= t.min) retenue = t.cle;
  return retenue;
}

export interface Fiabilite {
  /** Part de pronostics justes, en pourcentage entier. */
  taux: number;
  /** Nombre de rencontres sur lesquelles ce taux est mesuré. */
  matchs: number;
  /** « Match très serré », « Favori net »… */
  famille: string;
  /** Le championnat quand la matière suffit, sinon `null` (chiffre global). */
  ligue: string | null;
}

interface Releve {
  global: Record<string, { justes: number; total: number }>;
  parLigue: Record<string, { justes: number; total: number }>;
  total: number;
  calculeLe: string;
}

async function lireTout<T>(
  requete: (de: number, a: number) => any,
  plafond = 50_000
): Promise<T[]> {
  const sortie: T[] = [];
  for (let de = 0; de < plafond; de += 1000) {
    const { data, error } = await requete(de, de + 999);
    if (error) throw new Error(error.message);
    sortie.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return sortie;
}

/**
 * Recalcule le relevé depuis la table des jugements.
 *
 * Une rencontre ne compte qu'une fois : la table est déjà unique par
 * `fixture_id`, c'est elle qui garantit qu'un match analysé trois cents fois
 * ne pèse pas trois cents fois dans la mesure.
 */
async function calculer(): Promise<Releve> {
  const sb = createAdminClient();
  const jugements = await lireTout<{
    ligue: string | null;
    issue_juste: boolean | null;
    proba_domicile: number | null;
    proba_nul: number | null;
    proba_exterieur: number | null;
  }>((de, a) =>
    sb
      .from('jugements_moteur')
      .select('ligue, issue_juste, proba_domicile, proba_nul, proba_exterieur')
      .range(de, a)
  );

  const global: Record<string, { justes: number; total: number }> = {};
  const parLigue: Record<string, { justes: number; total: number }> = {};

  for (const j of jugements) {
    if (j.proba_domicile == null || j.issue_juste == null) continue;
    const t = trancheDe(Number(j.proba_domicile), Number(j.proba_nul), Number(j.proba_exterieur));

    global[t] ??= { justes: 0, total: 0 };
    global[t].total++;
    if (j.issue_juste) global[t].justes++;

    const ligue = String(j.ligue ?? '').trim();
    if (!ligue) continue;
    const k = `${ligue}|${t}`;
    parLigue[k] ??= { justes: 0, total: 0 };
    parLigue[k].total++;
    if (j.issue_juste) parLigue[k].justes++;
  }

  return { global, parLigue, total: jugements.length, calculeLe: new Date().toISOString() };
}

/** Le relevé, depuis la réserve quand il est frais. */
export async function lireReleve(): Promise<Releve | null> {
  try {
    const cache = await lireReserve<Releve>(CLE);
    if (cache && !cache.expiree) return cache.contenu;

    const releve = await calculer();
    await ecrireReserve(CLE, releve, TTL);
    return releve;
  } catch (e: any) {
    console.warn('[FIABILITÉ] Relevé indisponible :', e?.message);
    // Une analyse ne doit JAMAIS échouer parce que ce chiffre manque : il
    // enrichit la page, il ne la fait pas exister.
    return null;
  }
}

/**
 * La fiabilité observée pour CE match, ou `null` s'il n'y a pas de quoi la
 * mesurer honnêtement.
 *
 * On préfère le chiffre du championnat quand il tient sur assez de rencontres :
 * la Premier League et la Jupiler Pro League n'ont pas la même prévisibilité —
 * 57,3 % contre 29,2 % sur les matchs serrés. Sinon, le chiffre global, qui
 * reste vrai.
 */
export function fiabilitePour(
  releve: Releve | null,
  proba1: number,
  probaNul: number,
  proba2: number,
  ligue: string | null | undefined
): Fiabilite | null {
  if (!releve) return null;

  const t = trancheDe(proba1, probaNul, proba2);
  const famille = TRANCHES.find((x) => x.cle === t)?.libelle ?? 'Match';

  const nom = String(ligue ?? '').trim();
  const local = nom ? releve.parLigue[`${nom}|${t}`] : undefined;
  if (local && local.total >= MATCHS_MINIMUM_LIGUE) {
    return {
      taux: Math.round((100 * local.justes) / local.total),
      matchs: local.total,
      famille,
      ligue: nom,
    };
  }

  const g = releve.global[t];
  if (!g || g.total < MATCHS_MINIMUM_GLOBAL) return null;

  return {
    taux: Math.round((100 * g.justes) / g.total),
    matchs: g.total,
    famille,
    ligue: null,
  };
}
