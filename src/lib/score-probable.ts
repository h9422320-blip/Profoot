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
 * Confiance affichable.
 *
 * ELLE NE VAUT PAS LA PROBABILITÉ DE VICTOIRE, et c'est tout le sujet.
 *
 * En prenant la probabilité de l'issue comme confiance, un match serré tombait
 * à 45 % — alors que ce match-là peut être parfaitement analysé : données
 * complètes des deux côtés, simplement deux équipes de même niveau. On
 * affichait donc « faible confiance » là où il fallait lire « match indécis ».
 * Résultat, une page couverte de 45 %.
 *
 * La confiance répond à une autre question : à quel point l'analyse est-elle
 * solide ? Elle repose sur deux choses mesurables — la quantité de données
 * disponibles, et la netteté de l'écart entre les issues.
 *
 * Le plafond n'est jamais atteint : au football, la certitude n'existe pas
 * avant le coup de sifflet final.
 */
/**
 * ── LA CONFIANCE AFFICHÉE EST DÉSORMAIS UNE PROBABILITÉ ────────────────────
 *
 * CE QU'ELLE ÉTAIT, ET POURQUOI C'ÉTAIT INTENABLE
 *
 * Elle mesurait la SOLIDITÉ de l'analyse — quantité de données disponibles,
 * netteté de l'écart entre les issues — ramenée sur une échelle de 55 à 92.
 * L'abonné, lui, lit « 80 % » et comprend « huit chances sur dix que ce soit
 * juste ». Deux notions différentes sous le même mot.
 *
 * Le résultat est apparu dans l'administration, en toutes lettres : confiance
 * moyenne annoncée 75,8 %, réussite réelle 46 %. Vingt-neuf points d'écart. La
 * tranche « 70 à 80 % » ne tenait que 37,5 % — la plus trompeuse de toutes,
 * parce que c'est celle où l'on croit tenir une quasi-certitude.
 *
 * CE QU'ELLE EST MAINTENANT
 *
 * La probabilité, calculée, que l'issue annoncée se produise. Rien d'autre.
 *
 * Ce n'est pas un pari : cette probabilité a été confrontée à 9 200 rencontres
 * réelles, sur deux saisons séparées, et elle tient.
 *
 *     annoncé 38 % → 37 % de réussite réelle       annoncé 57 % → 51 à 58 %
 *     annoncé 42 % → 41 à 45 %                     annoncé 65 % → 61 à 66 %
 *     annoncé 47 % → 46 %                          annoncé 77 % → 78 à 79 %
 *
 * L'écart moyen est de deux à trois points, dans les deux sens. C'est un
 * chiffre qu'on peut afficher devant quelqu'un qui paie.
 *
 * LES CHIFFRES AFFICHÉS VONT BAISSER, ET C'EST LE BUT
 *
 * On lira désormais 45 % là où on lisait 80 %. Le pronostic, lui, n'a pas
 * changé d'un iota — c'est son étiquette qui devient honnête. Un abonné qui
 * voit 80 % et constate une réussite sur deux cesse de croire le reste.
 */

/** Une issue ne peut pas descendre sous le tiers : il n'y a que trois issues. */
const CONFIANCE_MIN = 33;
/** Au football, la certitude n'existe pas avant le coup de sifflet final. */
const CONFIANCE_MAX = 90;

/** Au-delà, une saison de plus n'apprend plus grand-chose sur une équipe. */
const MATCHS_POUR_ETRE_SUR = 20;

/** Moyenne de buts par équipe et par match, quand les données manquent. */
const MOYENNE_PAR_DEFAUT = 1.35;

function poisson(k: number, lambda: number): number {
  let factorielle = 1;
  for (let i = 2; i <= k; i++) factorielle *= i;
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorielle;
}

/**
 * Correction des petits scores (Dixon-Coles).
 *
 * POURQUOI ELLE EXISTE
 *
 * La loi de Poisson suppose que les deux équipes marquent indépendamment l'une
 * de l'autre. C'est faux : à 0-0 ou 1-1, un match se referme, les deux camps
 * se contentent du point. Le calcul brut sous-estime donc les nuls — et c'est
 * exactement ce que l'administration reprochait au moteur : dix-huit matchs
 * terminés sur un nul, huit annoncés.
 *
 * CE QU'ELLE CHANGE, MESURÉ SUR 9 200 RENCONTRES
 *
 * La probabilité moyenne de nul passe de 23,4 % à 25,5 % au réglage (réel
 * 25,0 %) et de 23,6 % à 25,8 % à la validation (réel 25,8 %). Elle tombe donc
 * juste sur les deux jeux, ce qui exclut un réglage taillé sur mesure.
 *
 * CE QU'ELLE NE CHANGE PAS
 *
 * L'issue annoncée : 51,28 % → 51,26 % et 50,55 % → 50,51 %. Autrement dit,
 * rien. Forcer le moteur à annoncer davantage de nuls a d'ailleurs été essayé
 * et fait BAISSER la justesse de plus d'un point — c'est la probabilité qui
 * devait être corrigée, pas le pronostic.
 *
 * La valeur retenue est celle de la littérature, pas un chiffre ajusté à nos
 * données.
 */
const CORRECTION_PETITS_SCORES = -0.1;

function correctionPetitsScores(i: number, j: number, l1: number, l2: number): number {
  if (i === 0 && j === 0) return 1 - l1 * l2 * CORRECTION_PETITS_SCORES;
  if (i === 0 && j === 1) return 1 + l1 * CORRECTION_PETITS_SCORES;
  if (i === 1 && j === 0) return 1 + l2 * CORRECTION_PETITS_SCORES;
  if (i === 1 && j === 1) return 1 - CORRECTION_PETITS_SCORES;
  return 1;
}

const borner = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Calcule le score le plus probable.
 *
 * `equipe1AJoueADomicile` vaut `null` quand le lieu est inconnu : on n'applique
 * alors aucun avantage plutôt que d'en inventer un. Se tromper de côté serait
 * pire que de l'ignorer.
 */
/**
 * Plafond de confiance sur une compétition peu prédictible.
 *
 * Les matchs amicaux se jouent avec des effectifs remaniés, des joueurs testés
 * et un enjeu nul : la forme du championnat n'y dit presque rien. Constaté sur
 * les vérifications du 12 août 2026 : 14 % de réussite sur les amicaux, contre
 * 86 % sur la Supercoupe. Annoncer 90 % de confiance sur un match de
 * préparation, c'est promettre ce que personne ne peut tenir.
 */
const CONFIANCE_MAX_PEU_FIABLE = 70;

/** Reconnaît une compétition dont les résultats ne se prédisent pas. */
export function competitionPeuFiable(nom: string | null | undefined): boolean {
  return /friendl|amical|pre-?season|test|trophy|summer|cup of champions/i.test(String(nom ?? ''));
}

/**
 * Vraies compétitions internationales, par identifiant.
 *
 * Le fournisseur range TOUTES les compétitions sans pays sous « World » : la
 * Ligue des champions comme la Como Cup. Cette liste sépare les deux. Les
 * identifiants sont stables dans le temps, contrairement aux libellés.
 */
const COMPETITIONS_INTERNATIONALES = new Set([
  1, // Coupe du monde
  2, // Ligue des champions UEFA
  3, // Ligue Europa UEFA
  4, // Championnat d'Europe
  5, // Ligue des nations UEFA
  6, // Coupe d'Afrique des nations
  9, // Copa América
  11, // CONMEBOL Sudamericana
  12, // Ligue des champions CAF
  13, // Copa Libertadores
  15, // Coupe du monde des clubs
  16, // Ligue des champions CONCACAF
  531, // Supercoupe de l'UEFA
  848, // Ligue Europa Conference
]);

/**
 * Ce match est-il une rencontre de préparation ?
 *
 * POURQUOI PAS SEULEMENT LE NOM
 *
 * La détection reposait sur le mot « friendly ». Elle laissait donc passer tous
 * les tournois de pré-saison qui portent un vrai nom : Lens a disputé trois
 * matchs de « Como Cup » en juillet — dont un 3-0 contre Crystal Palace — qui
 * comptaient dans le calcul comme des rencontres officielles et le faisaient
 * paraître plus fort que le Paris Saint-Germain.
 *
 * Le signal structurel est ailleurs : ces tournois n'appartiennent à aucun pays,
 * le fournisseur les range sous « World ». Les vraies compétitions
 * internationales y sont aussi — d'où la liste ci-dessus, qui les protège.
 *
 * Résultat : tout tournoi sans pays et non répertorié est traité comme de la
 * préparation, quel que soit son nom. Emirates Cup, Audi Cup, Soccer Champions
 * Tour et les suivants sont couverts sans avoir à les énumérer.
 */
export function estMatchDePreparation(league: {
  id?: number | string | null;
  name?: string | null;
  country?: string | null;
} | null | undefined): boolean {
  if (!league) return false;

  const id = Number(league.id);
  if (Number.isFinite(id) && COMPETITIONS_INTERNATIONALES.has(id)) return false;

  if (String(league.country ?? '').toLowerCase() === 'world') return true;

  return competitionPeuFiable(league.name);
}

/**
 * Poids de la référence face aux matchs de championnat.
 *
 * Le championnat compte comme s'il partait avec cinq matchs de référence
 * derrière lui. À un match joué, la référence domine ; à quinze, le
 * championnat l'emporte largement. Aucune bascule brutale.
 *
 * Valeur choisie en rejouant le calcul sur les onze rencontres déjà vérifiées :
 * l'erreur absolue moyenne sur le total de buts passe de 1,46 à 0,94 but. Au
 * -delà de cinq, le gain devient marginal (0,90 à K=10) et le championnat en
 * cours pèserait trop peu une fois la saison avancée.
 */
const POIDS_REFERENCE = 5;

/**
 * Établit les moyennes de buts d'une équipe en mêlant deux sources.
 *
 * POURQUOI CE MÉLANGE
 *
 * Le moteur ne lisait que les statistiques du CHAMPIONNAT, et basculait sur
 * une autre source uniquement si l'équipe n'y avait joué AUCUN match. En début
 * de saison, un seul match dictait donc toute la prédiction : Sparta Rotterdam,
 * battue 0-1 en ouverture, était réputée ne jamais marquer — 0,25 but attendu.
 * Le match s'est terminé 1-3.
 *
 * Pendant ce temps, la matière existait : ces équipes avaient dix à douze
 * rencontres jouées toutes compétitions confondues. Le moteur ne les regardait
 * simplement pas.
 *
 * Les deux sources sont désormais pondérées par le poids de preuve qu'elles
 * portent. Le championnat reste prioritaire — c'est le contexte le plus
 * pertinent — mais il ne peut plus, à lui seul et sur un match, produire une
 * valeur aberrante.
 *
 * @param championnat Statistiques du championnat en cours.
 * @param reference   Reconstruction sur les dernières rencontres, toutes
 *                    compétitions. Sert d'ancre quand le championnat est maigre.
 */
export function melangerStatistiques(
  championnat: StatistiquesEquipe,
  reference: StatistiquesEquipe | null
): StatistiquesEquipe {
  const n = championnat.matchsJoues;

  // Aucun match de championnat : la référence est la seule source. C'est le
  // comportement qui existait déjà, et il reste juste.
  if (n <= 0) return reference ?? championnat;

  // Sans référence exploitable, on garde le championnat tel quel plutôt que
  // d'inventer une ancre.
  const refN = reference?.matchsJoues ?? 0;
  if (refN <= 0) return championnat;

  const refPour = reference!.butsMarques / refN;
  const refContre = reference!.butsEncaisses / refN;

  const pour = (championnat.butsMarques + POIDS_REFERENCE * refPour) / (n + POIDS_REFERENCE);
  const contre = (championnat.butsEncaisses + POIDS_REFERENCE * refContre) / (n + POIDS_REFERENCE);

  // LE NOMBRE DE MATCHS EST CELUI DE LA MATIÈRE RÉELLEMENT EXPLOITÉE.
  //
  // Première tentative : garder le compte du championnat, pour ne pas gonfler
  // la confiance affichée. C'était une erreur, et le test l'a montrée — ce même
  // champ commande le garde-fou « données insuffisantes », qui force toutes les
  // forces à 1 en dessous de deux matchs. Le mélange n'avait donc AUCUN effet
  // dans le seul cas où il sert : celui de l'équipe à un match joué.
  //
  // On retient donc la plus large des deux fenêtres — sans les additionner, les
  // matchs de championnat figurant déjà parmi les derniers matchs. Annoncer une
  // seule rencontre de matière alors que le calcul en exploite onze serait tout
  // aussi faux, dans l'autre sens.
  const matiere = Math.max(n, refN);
  return { butsMarques: pour * matiere, butsEncaisses: contre * matiere, matchsJoues: matiere };
}

/**
 * Ce que vaut une équipe d'après son classement, ramené à un multiplicateur.
 *
 * POURQUOI CE COMPLÉMENT
 *
 * Le calcul ne connaissait que les buts marqués et encaissés sur les derniers
 * matchs. Il ignorait CONTRE QUI. Un club battant Boulogne 4-1 en amical y
 * pesait autant qu'un club gagnant une finale européenne — et le Paris
 * Saint-Germain se retrouvait à égalité avec des adversaires qu'il domine
 * largement sur une saison.
 *
 * Le classement corrige cela. Il est déjà récupéré par le moteur, et c'est la
 * mesure la plus fiable dont on dispose : trente-huit journées valent mieux que
 * douze matchs récents.
 *
 * On s'appuie sur les POINTS, pas sur le rang. Deux équipes séparées d'une
 * place peuvent l'être de vingt points ou d'un seul ; le rang efface cette
 * différence, les points la conservent. Paris a fini premier avec 76 points,
 * Lens deuxième avec 70 : l'écart est réel mais mince, et le calcul doit le
 * refléter tel quel plutôt que d'inventer une domination.
 *
 * L'effet est volontairement borné à ±15 % : le classement pèse dans la
 * balance, il ne remplace pas la forme du moment.
 */
export interface ForceClassement {
  points: number;
  pointsMoyens: number;
}

const INFLUENCE_CLASSEMENT = 0.15;

export function forceDepuisClassement(c: ForceClassement | null | undefined): number {
  if (!c || !c.pointsMoyens || c.pointsMoyens <= 0) return 1;
  // Rapport à la moyenne du championnat, puis compression : une équipe à deux
  // fois la moyenne n'est pas deux fois plus forte sur un match.
  const rapport = c.points / c.pointsMoyens;
  return borner(1 + (rapport - 1) * INFLUENCE_CLASSEMENT, 1 - INFLUENCE_CLASSEMENT, 1 + INFLUENCE_CLASSEMENT);
}

/**
 * Forces d'attaque et de défense ajustées aux adversaires, quand elles sont
 * disponibles. Voir `src/lib/forces-equipes.ts` pour leur calcul et les mesures
 * qui l'ont justifié.
 */
export interface ForcesDuMatch {
  equipe1: { attaque: number; defense: number; matchs: number };
  equipe2: { attaque: number; defense: number; matchs: number };
  /** Buts marqués en moyenne par l'équipe qui reçoit, dans ce championnat. */
  butsDomicile: number;
  /** Buts marqués en moyenne par l'équipe qui se déplace. */
  butsExterieur: number;
}

export function calculerScoreProbable(
  equipe1: StatistiquesEquipe,
  equipe2: StatistiquesEquipe,
  equipe1AJoueADomicile: boolean | null = null,
  peuFiable = false,
  /** Classements de fin de saison, quand ils sont connus. */
  classements?: { equipe1?: ForceClassement | null; equipe2?: ForceClassement | null },
  /**
   * Forces ajustées à l'adversaire. Absentes, tout le calcul ci-dessous reste
   * celui d'avant, au caractère près : un championnat que le fournisseur ne
   * couvre pas ne doit rien perdre.
   */
  forces?: ForcesDuMatch | null
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

  // Le classement entre ici : il rehausse l attaque de la meilleure equipe et
  // durcit sa defense, sans jamais ecraser la forme du moment.
  const rang1 = forceDepuisClassement(classements?.equipe1);
  const rang2 = forceDepuisClassement(classements?.equipe2);

  // ── LES BUTS ATTENDUS ──────────────────────────────────────────────────────
  //
  // Deux chemins. Le second n'existe que depuis le 17 août 2026 et ne sert que
  // lorsque le championnat est connu ; sans lui, le premier reste en vigueur et
  // rend exactement ce qu'il rendait.
  //
  // CE QUE LE PREMIER IGNORE, ET CE QUE ÇA COÛTAIT
  //
  // Il ne regarde que les buts marqués et encaissés, sans jamais demander
  // CONTRE QUI, ni ce que valait l'équipe la saison passée. En août, une équipe
  // a joué deux matchs : c'est là-dessus qu'il tranchait. Mesuré sur les cinq
  // premières journées de dix championnats, 472 rencontres rejouées :
  //
  //     ce calcul-ci ................................. 41,9 % d'issues justes
  //     « l'équipe qui reçoit gagne » ................ 43,2 %
  //     forces ajustées, socle de la saison passée ... 52,8 %
  //
  // Il faisait donc moins bien qu'un pronostic sans calcul, et annonçait 1,95
  // but par match là où il s'en marque 2,8.
  const avecForces = forces && equipe1AJoueADomicile !== null;

  const butsAttendus1 = borner(
    avecForces
      ? forces!.equipe1.attaque *
          forces!.equipe2.defense *
          (equipe1AJoueADomicile ? forces!.butsDomicile : forces!.butsExterieur)
      : forceAttaque1 * forceDefense2 * moyenne * facteur1 * (rang1 / rang2),
    BUTS_ATTENDUS_MIN,
    BUTS_ATTENDUS_MAX
  );
  const butsAttendus2 = borner(
    avecForces
      ? forces!.equipe2.attaque *
          forces!.equipe1.defense *
          (equipe1AJoueADomicile ? forces!.butsExterieur : forces!.butsDomicile)
      : forceAttaque2 * forceDefense1 * moyenne * facteur2 * (rang2 / rang1),
    BUTS_ATTENDUS_MIN,
    BUTS_ATTENDUS_MAX
  );

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
  // ── LE SCORE LE PLUS REPRÉSENTATIF, PAS LE PLUS FRÉQUENT ─────────────────
  //
  // Retenir le score le plus PROBABLE de l'issue gagnante donne presque
  // toujours « 1-0 » : c'est mécaniquement le scénario de victoire le plus
  // fréquent, quelles que soient les équipes. Mesuré le 16 août 2026 après une
  // première correction : 1-0 sur 69 % des affiches, contre 27 % avant. Chaque
  // prédiction restait juste isolément, mais un moteur qui répond « 1-0 » sept
  // fois sur dix a l'air en panne — c'est exactement le reproche qu'on faisait
  // au « 2-1 » servi par le modèle de langage.
  //
  // On choisit donc, parmi les scores de l'issue annoncée, celui qui colle le
  // mieux aux BUTS ATTENDUS des deux équipes. Une attaque à 2,3 buts attendus
  // n'annonce plus 1-0 comme une attaque à 1,1. La cohérence est intacte — le
  // score reste pris dans l'issue annoncée — et la variété revient d'elle-même,
  // parce qu'elle vient des équipes.
  //
  // La probabilité est conservée pour départager deux scores aussi proches l'un
  // que l'autre des buts attendus.
  const ecartAuxAttendus = (i: number, j: number) =>
    Math.abs(i - butsAttendus1) + Math.abs(j - butsAttendus2);

  const meilleurParIssue = {
    victoire1: { buts1: 1, buts2: 0, proba: -1, ecart: Infinity },
    nul: { buts1: 0, buts2: 0, proba: -1, ecart: Infinity },
    victoire2: { buts1: 0, buts2: 1, proba: -1, ecart: Infinity },
  };
  let victoire1 = 0, nul = 0, victoire2 = 0, lesDeux = 0;
  const total = [0, 0, 0, 0]; // au moins 1, 2, 3 ou 4 buts au total

  for (let i = 0; i <= BUTS_MAX; i++) {
    for (let j = 0; j <= BUTS_MAX; j++) {
      const p = p1[i] * p2[j] * correctionPetitsScores(i, j, butsAttendus1, butsAttendus2);
      const issue = i > j ? 'victoire1' : i === j ? 'nul' : 'victoire2';
      const ecart = ecartAuxAttendus(i, j);
      const actuel = meilleurParIssue[issue];
      // Un score très improbable ne peut pas gagner sur la seule proximité :
      // on écarte la queue de distribution avant de comparer.
      const credible = p >= actuel.proba * 0.25 || actuel.proba < 0;
      if (credible && (ecart < actuel.ecart || (ecart === actuel.ecart && p > actuel.proba)))
        meilleurParIssue[issue] = { buts1: i, buts2: j, proba: p, ecart };
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

  // ── LE SCORE ANNONCÉ SUIT LE POURCENTAGE LE PLUS ÉLEVÉ, SANS EXCEPTION ─────
  //
  // Il a existé ici une « marge du nul » de quinze points : dès que le nul
  // arrivait à moins de quinze points de la meilleure issue, c'est lui qu'on
  // annonçait. L'intention était bonne — le moteur n'annonçait jamais de nul —
  // le résultat, désastreux.
  //
  // Deportivo Alavés — Getafe l'a montré en grandeur nature. Probabilités
  // affichées : 42 % pour Alavés, 29 % pour le nul. Treize points d'écart, donc
  // sous la marge : le moteur annonçait « 1-1 » juste sous un graphique
  // désignant Alavés favori. Le match s'est terminé 3-0 pour Alavés. Vingt
  // pronostics sur trente-cinq sont passés de justes à faux du seul fait de
  // cette marge.
  //
  // Un utilisateur qui lit deux affirmations contradictoires sur le même écran
  // ne se demande pas laquelle croire : il cesse de croire les deux.
  //
  // Le choix se fait donc sur les pourcentages RÉELLEMENT AFFICHÉS, après
  // arrondi — et non sur les valeurs brutes. Un reliquat d'arrondi pourrait
  // sinon faire passer une issue devant une autre à l'écran sans que le score
  // suive.
  //
  // Le nul reste annoncé quand il est réellement en tête, et sa probabilité
  // s'affiche de toute façon à côté : rien n'est caché, plus rien ne se
  // contredit.
  const issueRetenue: 'victoire1' | 'nul' | 'victoire2' =
    pn >= pv1 && pn >= pv2 ? 'nul' : pv1 >= pv2 ? 'victoire1' : 'victoire2';
  const meilleur = meilleurParIssue[issueRetenue];

  // ── CONFIANCE ──────────────────────────────────────────────────────────────
  //
  // Deux ingrédients, tous deux mesurables :
  //
  //  1. La MATIÈRE : combien de matchs ont servi au calcul. Deux équipes suivies
  //     sur une saison entière donnent une analyse plus sûre que deux clubs vus
  //     cinq fois. C'est l'équipe la moins bien connue qui fixe la limite.
  //
  //  2. La NETTETÉ : de combien l'issue annoncée devance la suivante. Un écart
  //     franc se défend ; deux issues au coude-à-coude, beaucoup moins.
  //
  // Un match serré entre deux équipes parfaitement connues garde donc une
  // confiance honorable — l'analyse est solide, c'est le match qui est indécis.
  // Les deux se lisaient auparavant sur le même chiffre, et tout finissait à
  // 45 %.
  // La probabilité de l'issue annoncée, telle qu'elle vient d'être calculée.
  // C'est elle, et rien d'autre, que l'abonné doit lire.
  const probaIssueAnnoncee =
    issueRetenue === 'victoire1' ? pv1 : issueRetenue === 'nul' ? pn : pv2;

  // QUAND LA MATIÈRE MANQUE, ON RAMÈNE VERS L'IGNORANCE.
  //
  // Sans données solides, la probabilité calculée est elle-même incertaine :
  // l'annoncer telle quelle serait afficher une précision qu'on n'a pas. On la
  // rapproche donc du tiers — le point où l'on ne sait rien — à proportion de
  // ce qui manque. Avec les forces ajustées, la matière est complète et rien
  // n'est retranché.
  const matchsConnus = avecForces
    ? Math.min(forces!.equipe1.matchs, forces!.equipe2.matchs)
    : Math.min(joues1, joues2);
  const matiere = Math.min(1, matchsConnus / MATCHS_POUR_ETRE_SUR);

  const plafond = peuFiable ? CONFIANCE_MAX_PEU_FIABLE : CONFIANCE_MAX;
  const confiance = Math.round(
    borner(
      CONFIANCE_MIN + (probaIssueAnnoncee - CONFIANCE_MIN) * matiere,
      CONFIANCE_MIN,
      plafond
    )
  );

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
    // Les forces ajustées portent une saison entière par équipe : annoncer
    // « données insuffisantes » parce que le championnat vient de reprendre
    // serait faux, et priverait l'abonné d'une analyse solide.
    donneesInsuffisantes: avecForces ? false : donneesInsuffisantes,
  };
}

export interface IssueFinale {
  /** Probabilités, en pourcentage, que le match se termine ainsi. */
  probaVictoire1: number;
  probaNul: number;
  probaVictoire2: number;
  /** Score final le plus probable, en partant du score actuel. */
  scoreFinal1: number;
  scoreFinal2: number;
  /** Minutes restantes prises en compte. */
  minutesRestantes: number;
  /** Phrase prête à afficher, disant qui tient le match. */
  verdict: string;
}

/**
 * Où va le match, à partir du score actuel et du temps restant.
 *
 * La prédiction d'avant-match ne vaut plus rien une fois que le match a
 * commencé : une équipe menée 0-2 à la 80ᵉ minute n'a pas les chances qu'on lui
 * donnait au coup d'envoi. On ne garde donc du calcul initial que le RYTHME de
 * buts attendu, ramené au temps qui reste, et on l'ajoute au score déjà acquis.
 *
 * Aucun modèle de langage n'intervient : un modèle ne sait pas compter les
 * minutes restantes, et cette prédiction doit pouvoir se rafraîchir à chaque
 * consultation sans rien coûter.
 */
export function predireIssueFinale(
  butsAttendus1: number,
  butsAttendus2: number,
  butsActuels1: number,
  butsActuels2: number,
  minuteEcoulee: number,
  nomEquipe1: string,
  nomEquipe2: string
): IssueFinale {
  // La mi-temps compte comme la 45ᵉ minute ; au-delà du temps réglementaire on
  // ne promet plus de temps restant.
  const minutesRestantes = Math.max(0, Math.min(90, 90 - Math.max(0, minuteEcoulee)));
  const part = minutesRestantes / 90;

  const restant1 = borner(butsAttendus1 * part, 0, BUTS_ATTENDUS_MAX);
  const restant2 = borner(butsAttendus2 * part, 0, BUTS_ATTENDUS_MAX);

  const SUP = 6; // buts supplémentaires envisagés d'ici la fin
  const q1 = Array.from({ length: SUP + 1 }, (_, i) => (part === 0 ? (i === 0 ? 1 : 0) : poisson(i, restant1)));
  const q2 = Array.from({ length: SUP + 1 }, (_, j) => (part === 0 ? (j === 0 ? 1 : 0) : poisson(j, restant2)));

  let v1 = 0, n = 0, v2 = 0;

  // ── LE MEILLEUR SCORE DE CHAQUE ISSUE, ET NON LE MEILLEUR TOUT COURT ──────
  //
  // Le score le plus probable pris toutes issues confondues CONTREDIT
  // régulièrement les pourcentages affichés juste à côté. Ce n'est pas une
  // erreur de calcul, c'est une propriété du modèle : une victoire se répartit
  // sur des dizaines de scores (2-1, 3-1, 2-0, 3-2…) tandis qu'un nul se
  // concentre sur trois ou quatre (1-1, 2-2, 0-0). Le nul peut donc être le
  // score unique le plus fréquent alors que « victoire » est de loin l'issue
  // la plus probable.
  //
  // Constaté le 16 août 2026 : FC Barcelone — Bâle affichait 49 % de victoire
  // du Barça et annonçait « 1-1 » ; Lens — PSG donnait le PSG à 38 % et
  // annonçait « 1-1 ». Deux affirmations contraires sur le même écran.
  // Un utilisateur ne se demande pas laquelle croire : il cesse de croire les
  // deux.
  //
  // On retient donc le score le plus probable À L'INTÉRIEUR de l'issue
  // annoncée. C'est exactement ce que fait déjà le calcul d'avant-match.
  const meilleurParIssue = {
    victoire1: { s1: butsActuels1, s2: butsActuels2, proba: -1 },
    nul: { s1: butsActuels1, s2: butsActuels2, proba: -1 },
    victoire2: { s1: butsActuels1, s2: butsActuels2, proba: -1 },
  };

  for (let i = 0; i <= SUP; i++) {
    for (let j = 0; j <= SUP; j++) {
      const p = q1[i] * q2[j];
      const final1 = butsActuels1 + i;
      const final2 = butsActuels2 + j;

      const cle = final1 > final2 ? 'victoire1' : final1 === final2 ? 'nul' : 'victoire2';
      if (p > meilleurParIssue[cle].proba) meilleurParIssue[cle] = { s1: final1, s2: final2, proba: p };

      if (final1 > final2) v1 += p;
      else if (final1 === final2) n += p;
      else v2 += p;
    }
  }

  let pv1 = Math.round(v1 * 100);
  let pn = Math.round(n * 100);
  let pv2 = Math.round(v2 * 100);
  const ecart = 100 - (pv1 + pn + pv2);
  if (ecart !== 0) {
    if (pv1 >= pn && pv1 >= pv2) pv1 += ecart;
    else if (pv2 >= pn) pv2 += ecart;
    else pn += ecart;
  }

  // L'issue annoncée se lit sur les pourcentages RÉELLEMENT AFFICHÉS, après
  // arrondi : un reliquat d'arrondi ferait sinon passer une issue devant une
  // autre à l'écran sans que le score suive.
  const issueRetenue: 'victoire1' | 'nul' | 'victoire2' =
    pn >= pv1 && pn >= pv2 ? 'nul' : pv1 >= pv2 ? 'victoire1' : 'victoire2';
  const meilleur = meilleurParIssue[issueRetenue];

  // Le verdict nomme ce qui est le plus probable, sans jamais présenter une
  // issue serrée comme acquise.
  const maxi = Math.max(pv1, pn, pv2);
  const quasiCertain = maxi >= 80;
  const serre = maxi < 45;
  let verdict: string;
  if (pn === maxi) {
    verdict = serre
      ? `Tout reste ouvert : le partage des points est le scénario le plus probable (${pn} %), mais de peu.`
      : `Le match se dirige vers un partage des points (${pn} %).`;
  } else {
    const nom = pv1 === maxi ? nomEquipe1 : nomEquipe2;
    verdict = quasiCertain
      ? `${nom} tient ce match : ${maxi} % de chances de l'emporter avec ${minutesRestantes} minutes à jouer.`
      : serre
        ? `Rien n'est joué. ${nom} garde un léger avantage (${maxi} %), mais ${minutesRestantes} minutes suffisent à tout changer.`
        : `${nom} a l'avantage : ${maxi} % de chances de l'emporter, ${minutesRestantes} minutes à jouer.`;
  }

  return {
    probaVictoire1: pv1,
    probaNul: pn,
    probaVictoire2: pv2,
    scoreFinal1: meilleur.s1,
    scoreFinal2: meilleur.s2,
    minutesRestantes,
    verdict,
  };
}

/** Borne une confiance venue d'ailleurs — celles observées allaient de 8 % à 100 %. */
export function bornerConfiance(valeur: unknown): number {
  const n = Number(valeur);
  if (!isFinite(n) || n <= 0) return CONFIANCE_MIN;
  return Math.round(borner(n, CONFIANCE_MIN, CONFIANCE_MAX));
}
