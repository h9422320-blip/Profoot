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

/**
 * ── LA MESURE PAR CHAMPIONNAT SE FAIT SUR UN PALIER CUMULÉ ────────────────
 *
 * Les familles sont exclusives : « tendance forte » ne contient pas
 * « tendance très forte ». Découpée ainsi, une ligue n'atteint presque jamais
 * assez de rencontres pour être mesurée à part — la Primeira Liga tombait à
 * 37 matchs, la Premier League à 26.
 *
 * On mesure donc chaque championnat sur TOUTES les rencontres AU MOINS aussi
 * sûres que celle qu'on regarde. À 68 % de confiance, la Primeira Liga passe
 * ainsi de 37 à 61 rencontres, et le chiffre devient exploitable.
 *
 * Ce que ça révèle, mesuré le 5 septembre 2026 :
 *
 *     Primeira Liga    61 rencontres → 80,3 %
 *     Bundesliga       35             → 77,1 %
 *     La Liga          39             → 76,9 %
 *     Serie A          22             → 72,7 %
 *     Ligue 1          36             → 63,9 %
 *     Premier League   26             → 61,5 %
 *
 * Dix-neuf points entre le premier et le dernier, à confiance égale. Servir
 * le chiffre global à un match de Premier League revenait à annoncer 76 % là
 * où l'application en fait 61.
 */
export const MATCHS_MINIMUM_LIGUE = 25;

/** En deçà, on n'affiche RIEN. Un taux sur dix matchs n'est pas un taux. */
export const MATCHS_MINIMUM_GLOBAL = 100;

const TTL = 6 * 60 * 60 * 1000;
/**
 * La clé porte un numéro de version.
 *
 * Le relevé range ses compteurs sous les clés des familles. Le jour où
 * celles-ci changent — comme le 5 septembre 2026, en passant de l'écart à la
 * confiance —, un relevé rangé sous les anciennes serait relu sans erreur et
 * ne répondrait plus à aucune famille : la fiabilité disparaîtrait de l'écran
 * pendant six heures, sans que rien ne le signale.
 */
const CLE = 'fiabilite:apprise-v4';

/**
 * ── LES FAMILLES SUIVENT LA CONFIANCE, PAS L'ÉCART ────────────────────────
 *
 * La première version classait par l'écart entre les deux premières
 * probabilités. C'était une approximation : un match à 45/28/27 et un autre à
 * 70/15/15 pouvaient tomber dans la même famille alors que le second est
 * beaucoup plus sûr.
 *
 * On classe désormais par la probabilité de l'issue annoncée elle-même, ce
 * qui donne des paliers autrement plus nets, mesurés sur les 3 467 rencontres
 * jugées :
 *
 *     50 à 60 %   1 502 matchs → 58,5 %
 *     60 à 65 %     672 matchs → 65,0 %
 *     65 à 70 %     438 matchs → 68,5 %
 *     70 à 75 %     267 matchs → 71,2 %
 *     75 % et plus  150 matchs → 76,0 %
 *
 * Et croisé avec le championnat, au-dessus de 70 % : La Liga 83,3 %,
 * Eredivisie 82,4 %, Primeira Liga 80,0 %. C'est là que se trouvent les
 * quatre analyses justes sur cinq.
 */
export const TRANCHES = [
  { cle: 'incertain', min: 0, libelle: 'Issue incertaine' },
  { cle: 'penche', min: 45, libelle: 'La rencontre penche' },
  { cle: 'marque', min: 55, libelle: 'Tendance marquée' },
  { cle: 'nette', min: 62, libelle: 'Tendance nette' },
  { cle: 'forte', min: 68, libelle: 'Tendance forte' },
  { cle: 'tresforte', min: 74, libelle: 'Tendance très forte' },
] as const;

export type CleTranche = (typeof TRANCHES)[number]['cle'];

/**
 * ── LE CÔTÉ DU FAVORI COMPTE, ET IL COMPTE BEAUCOUP ───────────────────────
 *
 * Cherché sur la première moitié de l'histoire, validé sur la seconde — celle
 * que la recherche n'avait jamais vue :
 *
 *     confiance ≥ 76 % et favori À DOMICILE .... 76,7 %  (60 rencontres)
 *     confiance ≥ 76 %, sans distinction ....... 73,1 %  (78)
 *     confiance ≥ 68 % et favori À DOMICILE .... 70,9 % (148)
 *     confiance ≥ 68 %, sans distinction ....... 67,4 % (193)
 *
 * Trois à quatre points, à confiance égale, selon le seul côté du terrain. Un
 * favori qui reçoit tient sa promesse plus souvent qu'un favori qui se
 * déplace, et le moteur ne le disait pas.
 */
export type CoteDuFavori = 'domicile' | 'exterieur';

/** De quel côté penche la rencontre ? */
export function coteDuFavori(proba1: number, proba2: number): CoteDuFavori {
  return Number(proba1) >= Number(proba2) ? 'domicile' : 'exterieur';
}

/**
 * Range un match dans sa famille, d'après la probabilité de l'issue la plus
 * probable — celle que l'analyse annoncera.
 */
export function trancheDe(proba1: number, probaNul: number, proba2: number): CleTranche {
  const tete = Math.max(
    ...[Number(proba1), Number(probaNul), Number(proba2)].filter((n) => Number.isFinite(n))
  );
  let retenue: CleTranche = 'incertain';
  for (const t of TRANCHES) if (tete >= t.min) retenue = t.cle;
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
    const c = coteDuFavori(Number(j.proba_domicile), Number(j.proba_exterieur));

    // Deux compteurs : l'un avec le côté du terrain, l'autre sans. Le second
    // sert de repli quand le premier manque de matière.
    for (const k of [`${t}|${c}`, t]) {
      global[k] ??= { justes: 0, total: 0 };
      global[k].total++;
      if (j.issue_juste) global[k].justes++;
    }

    const ligue = String(j.ligue ?? '').trim();
    if (!ligue) continue;
    // Le palier CUMULÉ : cette rencontre compte pour sa propre famille et pour
    // toutes celles qui lui sont inférieures. Un match à 80 % de confiance
    // nourrit donc aussi la mesure « au moins 68 % » et « au moins 62 % ».
    const tete = Math.max(
      Number(j.proba_domicile),
      Number(j.proba_nul),
      Number(j.proba_exterieur)
    );
    for (const palier of TRANCHES) {
      if (tete < palier.min) continue;
      for (const k of [`${ligue}|${palier.cle}|${c}`, `${ligue}|${palier.cle}`]) {
        parLigue[k] ??= { justes: 0, total: 0 };
        parLigue[k].total++;
        if (j.issue_juste) parLigue[k].justes++;
      }
    }
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
  const c = coteDuFavori(proba1, proba2);
  const famille = TRANCHES.find((x) => x.cle === t)?.libelle ?? 'Match';

  // ── DU PLUS PRÉCIS AU PLUS GÉNÉRAL ──────────────────────────────────────
  //
  // Championnat ET côté du terrain d'abord : c'est la mesure la plus fine, et
  // celle qui distingue une Primeira Liga à 82,9 % d'une Premier League à
  // 61,5 %. On ne descend d'un cran que faute de matière, jamais par défaut.
  const nom = String(ligue ?? '').trim();
  const candidats: [{ justes: number; total: number } | undefined, string | null][] = [
    [nom ? releve.parLigue[`${nom}|${t}|${c}`] : undefined, nom],
    [nom ? releve.parLigue[`${nom}|${t}`] : undefined, nom],
    [releve.global[`${t}|${c}`], null],
  ];

  for (const [source, lig] of candidats) {
    const minimum = lig ? MATCHS_MINIMUM_LIGUE : MATCHS_MINIMUM_GLOBAL;
    if (!source || source.total < minimum) continue;
    return {
      taux: Math.round((100 * source.justes) / source.total),
      matchs: source.total,
      famille,
      ligue: lig,
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
