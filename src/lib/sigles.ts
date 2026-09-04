/**
 * LES SIGLES DE CLUB, EXTRAITS POUR POUVOIR ÊTRE ESSAYÉS.
 *
 * Ces fonctions vivaient dans « AnalyzeClient.tsx », un composant client de
 * cinq mille lignes qu'aucun test ne peut charger sans React entier. Elles
 * n'étaient donc vérifiées par rien — et c'est ainsi qu'un antislash manquant
 * dans le séparateur a pu tenir jusqu'à ce qu'un client signale « REA 1 - 3
 * REA » sur Real Betis contre Real Madrid.
 *
 * Ici, elles s'exécutent pour de vrai dans « tests/sigles.test.ts ».
 */

/**
 * LE SIGLE DE TROIS LETTRES, SOUS LE LOGO DE LA CARTE DE SCORE.
 *
 * ── POURQUOI CE N'EST PAS LES TROIS PREMIÈRES LETTRES ─────────────────────
 *
 * Ça l'était. Sur Real Betis contre Real Madrid, la carte affichait donc :
 *
 *     [logo Betis]  REA   2 - 1   REA  [logo Real]
 *
 * Deux fois le même sigle, de part et d'autre du score. Le lecteur ne peut
 * plus dire à qui appartient le 2 et à qui appartient le 1 — sur la seule
 * carte de l'écran qui doit se lire d'un coup d'œil.
 *
 * Le cas n'a rien d'exceptionnel en Espagne : Real Madrid, Real Betis, Real
 * Sociedad. Ni ailleurs : Manchester United et Manchester City, Bayer et
 * Bayern, Atlético et Athletic.
 *
 * ── LA RÈGLE : LE MOT QUI DISTINGUE, PAS LE PREMIER ───────────────────────
 *
 * On écarte d'abord les mots qui ne distinguent rien — les formes juridiques
 * et les préfixes de club, qui sont précisément ce que ces équipes ont en
 * commun. Ce qui reste est le nom propre :
 *
 *     Real Betis      → Betis        → BET
 *     Real Madrid     → Madrid       → MAD
 *     Real Sociedad   → Sociedad     → SOC
 *     Manchester Utd  → Manchester   → MAN … et Manchester City aussi.
 *
 * Le dernier cas montre la limite : deux clubs de la même ville gardent le
 * même sigle. On prend alors la première lettre de chaque mot restant —
 * « Manchester United » → MUN, « Manchester City » → MCI — ce qui est aussi
 * l'usage des tableaux d'affichage.
 */
const MOTS_SANS_VALEUR = new Set([
  'fc', 'cf', 'ac', 'as', 'sc', 'sv', 'ss', 'us', 'uc', 'ud', 'cd', 'rc', 'rcd',
  'afc', 'cfc', 'bk', 'if', 'ik', 'fk', 'nk', 'sk', 'gd', 'sd', 'ca', 'club',
  'real', 'atletico', 'atlético', 'athletic', 'deportivo', 'sporting', 'racing',
  'olympique', 'olympiacos', 'de', 'du', 'des', 'la', 'le', 'les', 'el', 'los',
  'las', 'of', 'and', 'et', '1', '04', '05', '96', '1899', '1900', '1909',
]);

/** Les mots du nom, débarrassés de ce qui ne distingue rien. */
function motsDistinctifs(nom: string | null | undefined): { retenus: string[]; ecartes: string[] } {
  // ── LE SÉPARATEUR A PERDU SON ANTISLASH ─────────────────────────────
  //
  // Il s'est longtemps lu « [s.'’-] » au lieu de « [\s.'’-] » : la classe
  // découpait donc sur la LETTRE « s », et jamais sur l'espace.
  //
  // « Real Betis » ne donnait plus deux mots mais un seul, « Real Beti ».
  // Aucun mot ne correspondait plus à MOTS_SANS_VALEUR — « Real Beti »
  // n'est pas « real » — et tout le tri qui suit devenait inopérant :
  // le sigle retombait sur les trois premières lettres du nom entier.
  //
  // Real Betis → REA et Real Madrid → REA : les deux camps du score
  // portaient la même étiquette. Un client l'a signalé le 2 septembre 2026,
  // vérifié en production le 4 sur ce match précis.
  const mots = String(nom ?? '').trim().split(/[\s.'’-]+/).filter(Boolean);
  const retenus = mots.filter((m) => !MOTS_SANS_VALEUR.has(m.toLowerCase()));
  const ecartes = mots.filter((m) => MOTS_SANS_VALEUR.has(m.toLowerCase()));
  // Un nom entièrement fait de mots communs — « Sporting Club » — retombe sur
  // ses propres mots plutôt que de rendre « ??? ».
  return { retenus: retenus.length ? retenus : mots, ecartes };
}

/** Le sigle ordinaire : les trois premières lettres du mot qui distingue. */
export function sigleClub(nom: string | null | undefined): string {
  const { retenus } = motsDistinctifs(nom);
  if (!retenus.length) return '???';
  return retenus[0].slice(0, 3).toUpperCase();
}

/**
 * Les deux sigles d'UNE rencontre, garantis différents l'un de l'autre.
 *
 * ── POURQUOI LA PAIRE, ET PAS CHAQUE NOM SÉPARÉMENT ─────────────────────
 *
 * Un sigle n'a pas à être unique dans le football entier : il a à être unique
 * SUR CETTE CARTE. C'est la seule contrainte réelle, et elle ne peut se
 * satisfaire qu'en regardant les deux noms ensemble.
 *
 * Le repli reprend le mot qu'on avait écarté, ce qui redonne l'abréviation
 * d'usage : Real Madrid → RMA, Atlético Madrid → AMA, Manchester United →
 * MUN, Manchester City → MCI.
 */
export function siglesDuMatch(nom1: string | null | undefined, nom2: string | null | undefined): [string, string] {
  const s1 = sigleClub(nom1);
  const s2 = sigleClub(nom2);
  if (s1 !== s2) return [s1, s2];

  const depart = (nom: string | null | undefined): string => {
    const { retenus, ecartes } = motsDistinctifs(nom);
    if (!retenus.length) return '???';
    // Deux mots distinctifs : initiale du premier + deux lettres du second.
    if (retenus.length > 1) {
      return (retenus[0].slice(0, 1) + retenus[1].slice(0, 2)).toUpperCase();
    }
    // Un seul : on reprend l'initiale du mot écarté — « Real », « Atlético ».
    if (ecartes.length) {
      return (ecartes[0].slice(0, 1) + retenus[0].slice(0, 2)).toUpperCase();
    }
    return retenus[0].slice(0, 3).toUpperCase();
  };

  const d1 = depart(nom1);
  const d2 = depart(nom2);
  // Deux noms réellement identiques : on ne peut plus rien inventer, et il vaut
  // mieux deux sigles égaux qu'un sigle faux.
  return [d1, d2 === d1 ? s2 : d2];
}
