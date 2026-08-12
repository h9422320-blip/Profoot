/**
 * Score le plus probable d'un match, calculé.
 *
 * POURQUOI CE FICHIER EXISTE
 *
 * Le score exact était demandé au modèle de langage : « prédit le score
 * exact ». Constaté sur 228 analyses réelles : 186 annonçaient 2-1, soit 82 %.
 * Barcelone contre Elche, Nottingham contre Leverkusen, et même la rencontre
 * inversée — toujours 2-1. Un modèle de langage à qui l'on pose cette question
 * ne calcule rien : il répond le score le plus banal du football.
 *
 * Le score se calcule. La méthode employée ici est celle des bookmakers : on
 * estime le nombre de buts attendu de chaque équipe à partir de son attaque, de
 * la défense adverse et de l'avantage du terrain, puis on en déduit la
 * probabilité de chaque score par la loi de Poisson. Le score retenu est le
 * plus probable de la grille, et les probabilités de victoire, de nul et de
 * défaite en découlent — elles ne peuvent donc plus se contredire.
 *
 * Le modèle de langage garde ce qu'il fait bien : rédiger l'analyse et
 * l'expliquer. Il ne décide plus des chiffres.
 */

export interface StatistiquesEquipe {
  /** Buts marqués sur la saison. */
  butsMarques: number;
  /** Buts encaissés sur la saison. */
  butsEncaisses: number;
  /** Matchs joués. Sert à ramener les totaux à une moyenne par match. */
  matchsJoues: number;
}

export interface ScoreProbable {
  buts1: number;
  buts2: number;
  /** Buts attendus, avant arrondi. C'est la vraie sortie du modèle. */
  butsAttendus1: number;
  butsAttendus2: number;
  /** Probabilités de l'issue, en pourcentage, dont la somme fait 100. */
  probaVictoire1: number;
  probaNul: number;
  probaVictoire2: number;
  /** Probabilité que les deux équipes marquent. */
  probaLesDeuxMarquent: number;
  /** Probabilité de dépasser 0,5 / 1,5 / 2,5 / 3,5 buts au total. */
  probaPlusDe: { zeroCinq: number; unCinq: number; deuxCinq: number; troisCinq: number };
  /** Probabilité du score exact retenu — la mesure honnête de l'incertitude. */
  probaDuScoreExact: number;
  /** Confiance affichable, bornée. */
  confiance: number;
  /** Vrai quand les statistiques étaient trop maigres pour calculer. */
  donneesInsuffisantes: boolean;
}

/**
 * Avantage du terrain, mesuré de longue date dans le football européen : une
 * équipe marque environ 15 % de plus à domicile et 8 % de moins à l'extérieur.
 * Sans information sur le lieu, aucun des deux n'est appliqué.
 */
const AVANTAGE_DOMICILE = 1.15;
const DESAVANTAGE_EXTERIEUR = 0.92;

/** Bornes de sécurité : au-delà, le calcul ne décrit plus un match de football. */
const BUTS_ATTENDUS_MIN = 0.25;
const BUTS_ATTENDUS_MAX = 4;

/** Taille de la grille de scores explorée. Au-delà de 8-8, les probabilités sont négligeables. */
const BUTS_MAX = 8;

/**
 * Confiance affichable. Une analyse à 100 % n'existe pas au football, et une
 * analyse à 8 % ne devrait jamais être servie : les deux ont été observées.
 */
const CONFIANCE_MIN = 45;
const CONFIANCE_MAX = 90;

/** Moyenne de buts par équipe et par match, quand les données manquent. */
const MOYENNE_PAR_DEFAUT = 1.35;

function poisson(k: number, lambda: number): number {
  let factorielle = 1;
  for (let i = 2; i <= k; i++) factorielle *= i;
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorielle;
}

const borner = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Calcule le score le plus probable.
 *
 * `equipe1AJoueADomicile` vaut `null` quand le lieu est inconnu : on n'applique
 * alors aucun avantage plutôt que d'en inventer un. Se tromper de côté serait
 * pire que de l'ignorer.
 */
export function calculerScoreProbable(
  equipe1: StatistiquesEquipe,
  equipe2: StatistiquesEquipe,
  equipe1AJoueADomicile: boolean | null = null
): ScoreProbable {
  const joues1 = Math.max(1, equipe1.matchsJoues);
  const joues2 = Math.max(1, equipe2.matchsJoues);

  // Une équipe sans historique exploitable ne permet aucun calcul honnête : on
  // le signale au lieu de produire un chiffre qui aurait l'air sérieux.
  const donneesInsuffisantes =
    (equipe1.butsMarques === 0 && equipe1.butsEncaisses === 0) ||
    (equipe2.butsMarques === 0 && equipe2.butsEncaisses === 0) ||
    equipe1.matchsJoues < 2 ||
    equipe2.matchsJoues < 2;

  const attaque1 = equipe1.butsMarques / joues1;
  const attaque2 = equipe2.butsMarques / joues2;
  const defense1 = equipe1.butsEncaisses / joues1;
  const defense2 = equipe2.butsEncaisses / joues2;

  // Référence commune, à défaut de la moyenne du championnat : la moyenne des
  // quatre valeurs observées. Elle sert d'étalon pour dire si une attaque est
  // au-dessus ou en dessous de l'ordinaire.
  const moyenne = donneesInsuffisantes
    ? MOYENNE_PAR_DEFAUT
    : Math.max(0.4, (attaque1 + attaque2 + defense1 + defense2) / 4);

  const forceAttaque1 = donneesInsuffisantes ? 1 : attaque1 / moyenne;
  const forceAttaque2 = donneesInsuffisantes ? 1 : attaque2 / moyenne;
  const forceDefense1 = donneesInsuffisantes ? 1 : defense1 / moyenne;
  const forceDefense2 = donneesInsuffisantes ? 1 : defense2 / moyenne;

  const facteur1 =
    equipe1AJoueADomicile === null ? 1 : equipe1AJoueADomicile ? AVANTAGE_DOMICILE : DESAVANTAGE_EXTERIEUR;
  const facteur2 =
    equipe1AJoueADomicile === null ? 1 : equipe1AJoueADomicile ? DESAVANTAGE_EXTERIEUR : AVANTAGE_DOMICILE;

  const butsAttendus1 = borner(forceAttaque1 * forceDefense2 * moyenne * facteur1, BUTS_ATTENDUS_MIN, BUTS_ATTENDUS_MAX);
  const butsAttendus2 = borner(forceAttaque2 * forceDefense1 * moyenne * facteur2, BUTS_ATTENDUS_MIN, BUTS_ATTENDUS_MAX);

  // Grille complète des scores : chaque case est la probabilité de ce score
  // exact. Tout le reste — issue, deux équipes marquent, nombre de buts — s'en
  // déduit, ce qui garantit que ces chiffres ne peuvent pas se contredire.
  const p1 = Array.from({ length: BUTS_MAX + 1 }, (_, i) => poisson(i, butsAttendus1));
  const p2 = Array.from({ length: BUTS_MAX + 1 }, (_, j) => poisson(j, butsAttendus2));

  // On retient le meilleur score DE CHAQUE ISSUE, pas seulement le meilleur de
  // toute la grille.
  //
  // La différence n'est pas un détail. Le score exact le plus probable est très
  // souvent un nul — un nul se joue sur peu de scores, alors qu'une victoire se
  // répartit sur beaucoup. Un match où l'équipe locale est donnée gagnante à
  // 52 % pouvait donc afficher « 1-1 » : deux affirmations exactes, mais qui se
  // contredisent aux yeux de celui qui parie. On annonce donc le score le plus
  // probable PARMI ceux qui donnent l'issue annoncée.
  const meilleurParIssue = {
    victoire1: { buts1: 1, buts2: 0, proba: -1 },
    nul: { buts1: 0, buts2: 0, proba: -1 },
    victoire2: { buts1: 0, buts2: 1, proba: -1 },
  };
  let victoire1 = 0, nul = 0, victoire2 = 0, lesDeux = 0;
  const total = [0, 0, 0, 0]; // au moins 1, 2, 3 ou 4 buts au total

  for (let i = 0; i <= BUTS_MAX; i++) {
    for (let j = 0; j <= BUTS_MAX; j++) {
      const p = p1[i] * p2[j];
      const issue = i > j ? 'victoire1' : i === j ? 'nul' : 'victoire2';
      if (p > meilleurParIssue[issue].proba) meilleurParIssue[issue] = { buts1: i, buts2: j, proba: p };
      if (issue === 'victoire1') victoire1 += p;
      else if (issue === 'nul') nul += p;
      else victoire2 += p;
      if (i >= 1 && j >= 1) lesDeux += p;
      const somme = i + j;
      if (somme >= 1) total[0] += p;
      if (somme >= 2) total[1] += p;
      if (somme >= 3) total[2] += p;
      if (somme >= 4) total[3] += p;
    }
  }

  const issueRetenue =
    victoire1 >= nul && victoire1 >= victoire2 ? 'victoire1' : victoire2 >= nul ? 'victoire2' : 'nul';
  const meilleur = meilleurParIssue[issueRetenue];

  const pct = (v: number) => Math.round(v * 1000) / 10;

  // Les trois issues doivent totaliser exactement 100 : on ajuste la plus
  // grande du reliquat d'arrondi plutôt que d'afficher 99,8 %.
  let pv1 = Math.round(victoire1 * 100);
  let pn = Math.round(nul * 100);
  let pv2 = Math.round(victoire2 * 100);
  const ecart = 100 - (pv1 + pn + pv2);
  if (ecart !== 0) {
    if (pv1 >= pn && pv1 >= pv2) pv1 += ecart;
    else if (pv2 >= pn) pv2 += ecart;
    else pn += ecart;
  }

  // La confiance reflète la probabilité de l'issue annoncée, pas une impression.
  // Elle est bornée : au football, ni la certitude ni le hasard pur n'existent.
  const probaIssue = Math.max(victoire1, nul, victoire2);
  const confiance = donneesInsuffisantes
    ? CONFIANCE_MIN
    : Math.round(borner(probaIssue * 100, CONFIANCE_MIN, CONFIANCE_MAX));

  return {
    buts1: meilleur.buts1,
    buts2: meilleur.buts2,
    butsAttendus1: Math.round(butsAttendus1 * 100) / 100,
    butsAttendus2: Math.round(butsAttendus2 * 100) / 100,
    probaVictoire1: pv1,
    probaNul: pn,
    probaVictoire2: pv2,
    probaLesDeuxMarquent: Math.round(lesDeux * 100),
    probaPlusDe: {
      zeroCinq: pct(total[0]),
      unCinq: pct(total[1]),
      deuxCinq: pct(total[2]),
      troisCinq: pct(total[3]),
    },
    probaDuScoreExact: pct(meilleur.proba),
    confiance,
    donneesInsuffisantes,
  };
}

/** Borne une confiance venue d'ailleurs — celles observées allaient de 8 % à 100 %. */
export function bornerConfiance(valeur: unknown): number {
  const n = Number(valeur);
  if (!isFinite(n) || n <= 0) return CONFIANCE_MIN;
  return Math.round(borner(n, CONFIANCE_MIN, CONFIANCE_MAX));
}
