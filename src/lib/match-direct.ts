/**
 * Match en cours de jeu.
 *
 * POURQUOI CE FICHIER EXISTE
 *
 * L'analyseur classait les rencontres en deux paquets : à venir (`NS`, `TBD`,
 * `PST`) et terminées (`FT`, `AET`, `PEN`). Un match EN COURS n'appartient à
 * aucun des deux — son statut est `1H`, `HT`, `2H`, `ET` ou `P`. Il était donc
 * purement invisible.
 *
 * Conséquence constatée le 12 août 2026 : pendant que PSG — Aston Villa se
 * jouait en Supercoupe, l'analyseur affichait leur rencontre du 15 avril 2025
 * sous le bandeau « MATCH TERMINÉ — RÉSULTATS RÉELS ». L'abonné croyait lire le
 * match du jour et consultait un résultat vieux de seize mois.
 *
 * Second piège, vérifié : le match en direct ne figure PAS dans les
 * confrontations directes renvoyées par l'API. Le chercher là revient à ne
 * jamais le trouver. Il faut interroger explicitement les matchs en cours de
 * l'équipe.
 */

/** Statuts qui désignent un match en train de se jouer. */
export const STATUTS_EN_DIRECT = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'SUSP', 'INT', 'LIVE'];

export function estEnDirect(statut: string | undefined | null): boolean {
  return !!statut && STATUTS_EN_DIRECT.includes(statut);
}

export interface ButeurDirect {
  minute: number | null;
  joueur: string | null;
  passeur: string | null;
  /** 'team1' ou 'team2', du point de vue de l'équipe demandée en premier. */
  cote: 'team1' | 'team2';
  /** « Penalty », « Contre son camp »… Null pour un but ordinaire. */
  precision: string | null;
}

export interface MatchDirect {
  fixtureId: number;
  /** Score en cours, dans l'ordre des équipes demandées. */
  buts1: number;
  buts2: number;
  /** Minute écoulée. Null si l'API ne la fournit pas. */
  minute: number | null;
  statut: string;
  /** Libellé lisible : « Mi-temps », « Seconde période »… */
  statutLibelle: string;
  /** Vrai pendant la pause : la minute n'avance plus. */
  miTemps: boolean;
  competition: string | null;
  stade: string | null;
  scoreMiTemps: string | null;
  buteurs: ButeurDirect[];
  /** Tirs, tirs cadrés et possession, quand l'API les fournit. */
  statistiques: {
    tirs1: number | null; tirs2: number | null;
    cadres1: number | null; cadres2: number | null;
    possession1: string | null; possession2: string | null;
  } | null;
  equipe1AJoueADomicile: boolean;
}

const LIBELLES: Record<string, string> = {
  '1H': 'Première période',
  HT: 'Mi-temps',
  '2H': 'Seconde période',
  ET: 'Prolongations',
  BT: 'Pause avant prolongations',
  P: 'Tirs au but',
  SUSP: 'Match suspendu',
  INT: 'Match interrompu',
  LIVE: 'En cours',
};

const nombre = (v: any): number | null => {
  const n = Number(v);
  return isFinite(n) ? n : null;
};

/**
 * Met la réponse de l'API dans l'ordre des équipes demandées.
 *
 * L'API raisonne en « domicile / extérieur », l'application en « équipe 1 /
 * équipe 2 ». Confondre les deux inverse le score, et un score inversé est pire
 * qu'une absence de score.
 */
export function normaliserMatchDirect(fixture: any, idEquipe1: string | number): MatchDirect | null {
  const statut = fixture?.fixture?.status?.short;
  if (!estEnDirect(statut)) return null;

  const domicile = String(fixture?.teams?.home?.id) === String(idEquipe1);
  const butsDomicile = Number(fixture?.goals?.home ?? 0);
  const butsExterieur = Number(fixture?.goals?.away ?? 0);

  const buteurs: ButeurDirect[] = (fixture?.events ?? [])
    .filter((e: any) => e?.type === 'Goal')
    .map((e: any) => {
      const marquePar = String(e?.team?.id) === String(fixture?.teams?.home?.id) ? 'home' : 'away';
      const cote: 'team1' | 'team2' =
        (marquePar === 'home') === domicile ? 'team1' : 'team2';
      return {
        minute: nombre(e?.time?.elapsed),
        joueur: e?.player?.name ?? null,
        passeur: e?.assist?.name ?? null,
        cote,
        // « Normal Goal » n'apprend rien ; un penalty ou un but contre son camp, si.
        precision:
          e?.detail && e.detail !== 'Normal Goal'
            ? e.detail === 'Penalty'
              ? 'Penalty'
              : e.detail === 'Own Goal'
                ? 'Contre son camp'
                : e.detail
            : null,
      };
    })
    .sort((a: ButeurDirect, b: ButeurDirect) => (a.minute ?? 0) - (b.minute ?? 0));

  const lire = (equipe: any, type: string) =>
    equipe?.statistics?.find((s: any) => s?.type === type)?.value ?? null;

  const statsDomicile = (fixture?.statistics ?? []).find(
    (s: any) => String(s?.team?.id) === String(fixture?.teams?.home?.id)
  );
  const statsExterieur = (fixture?.statistics ?? []).find(
    (s: any) => String(s?.team?.id) !== String(fixture?.teams?.home?.id)
  );
  const s1 = domicile ? statsDomicile : statsExterieur;
  const s2 = domicile ? statsExterieur : statsDomicile;

  const mt = fixture?.score?.halftime;
  const scoreMiTemps =
    mt && mt.home !== null && mt.away !== null
      ? domicile
        ? `${mt.home} - ${mt.away}`
        : `${mt.away} - ${mt.home}`
      : null;

  return {
    fixtureId: fixture?.fixture?.id,
    buts1: domicile ? butsDomicile : butsExterieur,
    buts2: domicile ? butsExterieur : butsDomicile,
    minute: nombre(fixture?.fixture?.status?.elapsed),
    statut,
    statutLibelle: LIBELLES[statut] ?? 'En cours',
    miTemps: statut === 'HT',
    competition: fixture?.league?.name ?? null,
    stade: fixture?.fixture?.venue?.name ?? null,
    scoreMiTemps,
    buteurs,
    statistiques: s1 || s2
      ? {
          tirs1: nombre(lire(s1, 'Total Shots')),
          tirs2: nombre(lire(s2, 'Total Shots')),
          cadres1: nombre(lire(s1, 'Shots on Goal')),
          cadres2: nombre(lire(s2, 'Shots on Goal')),
          possession1: lire(s1, 'Ball Possession'),
          possession2: lire(s2, 'Ball Possession'),
        }
      : null,
    equipe1AJoueADomicile: domicile,
  };
}

/**
 * Retrouve, parmi les matchs en cours d'une équipe, celui qui l'oppose à
 * l'autre. Renvoie null si les deux ne se rencontrent pas en ce moment.
 */
export function trouverRencontreEnDirect(
  reponseLive: any,
  idEquipe1: string | number,
  idEquipe2: string | number
): any | null {
  for (const f of reponseLive?.response ?? []) {
    const ids = [f?.teams?.home?.id, f?.teams?.away?.id].map(String);
    if (ids.includes(String(idEquipe1)) && ids.includes(String(idEquipe2))) return f;
  }
  return null;
}
