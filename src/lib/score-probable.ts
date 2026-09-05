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
  /**
   * Probabilité que chaque équipe garde sa cage inviolée, en pourcentage.
   *
   * Tirée de la même grille : la colonne où l'adversaire reste à zéro. Elle
   * répond à une question que « les deux marquent : non » laisse ouverte —
   * cette réponse-là regroupe 1-0, 0-1 et 0-0 sans dire quelle défense tient.
   */
  probaCageInviolee1: number;
  probaCageInviolee2: number;
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
 * ── LA CONFIANCE MESURE LA SOLIDITÉ DE L'ANALYSE ───────────────────────────
 *
 * DEUX CHIFFRES DIFFÉRENTS, ET IL NE FAUT PAS LES CONFONDRE
 *
 * Le 18 août 2026, la confiance a été remplacée par la probabilité de l'issue
 * annoncée. C'était une erreur de conception, corrigée le jour même : ces deux
 * nombres ne répondent pas à la même question.
 *
 *   — « Le PSG gagne-t-il ? » → c'est `probaVictoire1`, affichée à côté, avec
 *     le nul et la défaite. Elle vaut souvent 40 ou 50 %, parce qu'un match de
 *     football est incertain. Elle est calibrée : vérifiée sur 9 234
 *     rencontres, l'écart entre annoncé et constaté est de 1,3 point.
 *
 *   — « Cette analyse repose-t-elle sur quelque chose ? » → c'est la CONFIANCE.
 *     Deux équipes suivies sur une saison entière, avec un écart net entre les
 *     issues, donnent une analyse solide — même si le match reste ouvert. Ce
 *     nombre-là n'a aucune raison d'être bas.
 *
 * Les confondre revenait à annoncer « 45 % » sur une analyse parfaitement
 * documentée, simplement parce que le match était serré. C'est faux dans
 * l'autre sens : l'analyse, elle, était bonne.
 *
 * L'ÉCHELLE
 *
 * De 70 à 95. En dessous de 70, une analyse ne devrait pas être servie ; au
 * dessus de 95, on promettrait une certitude qui n'existe pas au football.
 */

/** En dessous, l'analyse ne mérite pas d'être servie. */
const CONFIANCE_MIN = 70;
/** Au football, la certitude n'existe pas avant le coup de sifflet final. */
const CONFIANCE_MAX = 95;

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
 * 86 % sur la Supercoupe. Annoncer 95 % de confiance sur un match de
 * préparation, c'est promettre ce que personne ne peut tenir.
 *
 * Le plafond reste néanmoins au-dessus du plancher général : une analyse
 * d'amical n'est pas une mauvaise analyse, c'est un match imprévisible.
 */
const CONFIANCE_MAX_PEU_FIABLE = 80;

/**
 * Plafond de confiance quand les deux équipes ne viennent pas du même
 * championnat.
 *
 * ── CE QUI A ÉTÉ MESURÉ ───────────────────────────────────────────────────
 *
 * Sur les 353 rencontres vérifiées au 24 août 2026, le moteur se comporte de
 * deux façons radicalement différentes :
 *
 *   Même championnat      228 matchs · 57 % de réussite · 24 % de nuls annoncés
 *                                                       · 24 % de nuls survenus
 *   Championnats croisés  125 matchs · 43 % de réussite · 21 % de nuls annoncés
 *                                                       · 30 % de nuls survenus
 *
 * La confiance affichée, elle, ne bougeait presque pas : 81 % chez soi, 76 %
 * à l'étranger. Le moteur promettait 76 et tenait 43.
 *
 * ── LE DÉTAIL QUI TRANCHE ─────────────────────────────────────────────────
 *
 * Sur les matchs croisés, la confiance est RETOURNÉE : plus elle est haute,
 * moins le pronostic tombe juste.
 *
 *   70-74 % de confiance → 70 % de réussite
 *   75-79 %              → 57 %
 *   80-84 %              → 33 %
 *   85-89 %              → 24 %
 *
 * L'explication tient à la façon dont les forces sont calculées : chaque
 * équipe est jaugée À L'INTÉRIEUR de son championnat. Confronter une force
 * kazakhe à une force belge n'a pas de sens, et l'écart apparent qui en sort
 * est d'autant plus grand qu'il est illusoire. Une grosse confiance sur un
 * match croisé signale donc un artefact, pas une certitude.
 *
 * ── POURQUOI UN PLAFOND, ET RIEN DE PLUS ──────────────────────────────────
 *
 * Trois correctifs du pronostic lui-même ont été essayés et rejetés le
 * 24 août 2026, chacun mesuré sur les 116 matchs croisés puis soumis à
 * l'épreuve des deux moitiés :
 *
 *   • pousser la probabilité de nul du facteur mesuré (x1,43) :
 *     −8,6 points sur une moitié, +3,4 sur l'autre — du hasard ;
 *   • rapprocher les probabilités d'un socle observé : aucun effet, le
 *     mélange linéaire ne change jamais quelle issue est la plus probable ;
 *   • aplatir les trois probabilités vers un tiers chacune : aucun effet,
 *     pour la même raison.
 *
 * Aucune retouche appliquée APRÈS coup ne peut redresser un pronostic faussé
 * en amont. Le vrai remède serait de normaliser les forces d'un championnat à
 * l'autre — un chantier que 116 rencontres ne suffiraient pas à valider.
 *
 * En attendant, on ne ment plus sur ce qu'on sait. Le plafond reste au-dessus
 * du plancher général : l'analyse garde sa valeur, c'est la certitude
 * affichée qui redescend à ce que les chiffres autorisent.
 */
const CONFIANCE_MAX_COMPARAISON_CROISEE = 72;

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
  forces?: ForcesDuMatch | null,
  /**
   * Correction apprise des pronostics passés de ce championnat.
   *
   * Deux facteurs, l'un pour l'équipe qui reçoit, l'autre pour celle qui se
   * déplace. Absents ou neutres, le calcul rend exactement ce qu'il rendait :
   * c'est un correctif, jamais un moteur parallèle.
   *
   * Ils viennent de `calibrage.ts`, qui compare les buts réellement marqués
   * aux buts annoncés sur au moins trente rencontres du même championnat. En
   * dessous de ce seuil, rien n'est transmis ici.
   */
  calibrage?: { domicile: number; exterieur: number } | null,
  /**
   * Les deux équipes viennent-elles de championnats différents ?
   *
   * Vrai uniquement quand les DEUX championnats ont été résolus et qu'ils
   * diffèrent. Un championnat inconnu ne déclenche rien : mieux vaut ne pas
   * plafonner que plafonner à tort.
   *
   * N'entre que dans la confiance affichée. Le pronostic, les probabilités et
   * le score annoncé sont rigoureusement inchangés — voir le commentaire de
   * `CONFIANCE_MAX_COMPARAISON_CROISEE` pour les correctifs essayés et rejetés.
   */
  comparaisonCroisee = false,
  /**
   * Rapport de force entre les deux championnats, appliqué aux buts attendus.
   *
   * Vaut 1 — donc sans effet — quand les deux équipes sortent du même
   * championnat, quand l'un des deux est inconnu, ou quand la hiérarchie n'a
   * pas encore été calculée. Voir `forces-championnats.ts` pour ce qu'il
   * mesure et ce qu'il a rapporté.
   */
  rapportChampionnats = 1
): ScoreProbable {
  // ── ON NETTOIE CE QUI ENTRE, UNE FOIS, À LA PORTE ─────────────────────────
  //
  // Les statistiques viennent d'un fournisseur extérieur, et un club obscur de
  // quatrième division peut en renvoyer d'incohérentes : champ absent, chaîne
  // vide devenue `NaN`, nombre négatif.
  //
  // Un seul `NaN` traverse ensuite tout le calcul sans jamais lever d'erreur :
  // mesuré, il ressortait en confiance `NaN`, qui devient `null` une fois
  // transmise au navigateur. L'abonné voyait alors une analyse amputée sans que
  // rien ne signale pourquoi.
  //
  // Nettoyer ici plutôt qu'à vingt endroits plus bas : tout ce qui suit peut
  // dès lors compter sur des nombres réels.
  const nombreSain = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  equipe1 = {
    butsMarques: nombreSain(equipe1?.butsMarques),
    butsEncaisses: nombreSain(equipe1?.butsEncaisses),
    matchsJoues: nombreSain(equipe1?.matchsJoues),
  };
  equipe2 = {
    butsMarques: nombreSain(equipe2?.butsMarques),
    butsEncaisses: nombreSain(equipe2?.butsEncaisses),
    matchsJoues: nombreSain(equipe2?.matchsJoues),
  };
  if (forces) {
    forces = {
      equipe1: {
        attaque: nombreSain(forces.equipe1?.attaque) || 1,
        defense: nombreSain(forces.equipe1?.defense) || 1,
        matchs: nombreSain(forces.equipe1?.matchs),
      },
      equipe2: {
        attaque: nombreSain(forces.equipe2?.attaque) || 1,
        defense: nombreSain(forces.equipe2?.defense) || 1,
        matchs: nombreSain(forces.equipe2?.matchs),
      },
      butsDomicile: nombreSain(forces.butsDomicile) || MOYENNE_PAR_DEFAUT,
      butsExterieur: nombreSain(forces.butsExterieur) || MOYENNE_PAR_DEFAUT,
    };
  }

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

  // ── LA CORRECTION APPRISE DES PRONOSTICS PASSÉS ───────────────────────────
  //
  // Le calcul ci-dessus ne s'est jamais retourné pour regarder ses propres
  // résultats. S'il annonce depuis des semaines 2,1 buts par match dans un
  // championnat où il s'en marque 2,8, il se trompe dans le même sens à chaque
  // fois — et cette erreur-là, contrairement à l'imprévu d'un match, se corrige.
  //
  // Les deux facteurs sont attachés au CÔTÉ, pas à l'équipe : le premier
  // s'applique à qui reçoit, le second à qui se déplace. Sans information sur
  // le lieu, aucun des deux n'est appliqué — on ne saurait pas lequel est
  // lequel, et se tromper de côté aggraverait le biais au lieu de le corriger.
  const corrige = (valeur: number, cote: 'domicile' | 'exterieur') => {
    if (!calibrage || equipe1AJoueADomicile === null) return valeur;
    const f = cote === 'domicile' ? calibrage.domicile : calibrage.exterieur;
    return Number.isFinite(f) && f > 0 ? valeur * f : valeur;
  };

  const butsAttendus1Brut = borner(
    corrige(
      avecForces
        ? forces!.equipe1.attaque *
            forces!.equipe2.defense *
            (equipe1AJoueADomicile ? forces!.butsDomicile : forces!.butsExterieur)
        : forceAttaque1 * forceDefense2 * moyenne * facteur1 * (rang1 / rang2),
      equipe1AJoueADomicile ? 'domicile' : 'exterieur'
    ),
    BUTS_ATTENDUS_MIN,
    BUTS_ATTENDUS_MAX
  );
  const butsAttendus2Brut = borner(
    corrige(
      avecForces
        ? forces!.equipe2.attaque *
            forces!.equipe1.defense *
            (equipe1AJoueADomicile ? forces!.butsExterieur : forces!.butsDomicile)
        : forceAttaque2 * forceDefense1 * moyenne * facteur2 * (rang2 / rang1),
      equipe1AJoueADomicile ? 'exterieur' : 'domicile'
    ),
    BUTS_ATTENDUS_MIN,
    BUTS_ATTENDUS_MAX
  );

  // ── DEUX CHAMPIONNATS, DEUX ÉCHELLES : ON LES RAMÈNE À LA MÊME ───────────
  //
  // Tout ce qui précède note chaque équipe À L'INTÉRIEUR de son championnat :
  // une attaque vaut 1,3 parce qu'elle marque 30 % de plus que la moyenne DE
  // SA LIGUE. Confronter la note d'un club belge à celle d'un club kazakh
  // revient donc à comparer deux notes sur vingt données par deux professeurs
  // différents.
  //
  // Constaté en production le 24 août 2026 : 57 % de réussite entre équipes du
  // même championnat, 43 % entre championnats différents. Quatorze points, sur
  // un défaut purement arithmétique.
  //
  // Le rapport vient de `forces-championnats.ts`, appris des seuls matchs de
  // coupe européenne. Mesuré sur 10 157 rencontres jamais vues pendant
  // l'apprentissage : les matchs croisés passent de 42,5 % à 50,1 % de
  // réussite, les coupes de 48,6 % à 55,9 %, et les matchs internes ne bougent
  // pas d'un dixième — le rapport y vaut exactement 1.
  //
  // À 1, la ligne ci-dessous ne change rien : c'est le comportement de toujours
  // quand les deux équipes sortent du même vivier, ou quand la hiérarchie n'a
  // pas encore été calculée.
  const rapport =
    Number.isFinite(rapportChampionnats) && rapportChampionnats > 0 ? rapportChampionnats : 1;
  const butsAttendus1 = borner(butsAttendus1Brut * rapport, BUTS_ATTENDUS_MIN, BUTS_ATTENDUS_MAX);
  const butsAttendus2 = borner(butsAttendus2Brut / rapport, BUTS_ATTENDUS_MIN, BUTS_ATTENDUS_MAX);

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
  /**
   * Le score le plus proche des buts attendus, TOUTES ISSUES CONFONDUES.
   *
   * Voir plus bas pourquoi il existe : sans lui, le nul ne peut jamais sortir,
   * et le moteur répond 2-1 ou 1-2 quatre fois sur cinq.
   */
  let meilleurGlobal = { buts1: 1, buts2: 1, proba: -1, ecart: Infinity };
  let victoire1 = 0, nul = 0, victoire2 = 0, lesDeux = 0;
  let cageInviolee1 = 0, cageInviolee2 = 0;
  const total = [0, 0, 0, 0]; // au moins 1, 2, 3 ou 4 buts au total

  for (let i = 0; i <= BUTS_MAX; i++) {
    for (let j = 0; j <= BUTS_MAX; j++) {
      const p = p1[i] * p2[j] * correctionPetitsScores(i, j, butsAttendus1, butsAttendus2);
      const issue = i > j ? 'victoire1' : i === j ? 'nul' : 'victoire2';
      const ecart = ecartAuxAttendus(i, j);
      const actuel = meilleurParIssue[issue];
      // Un score très improbable ne peut pas gagner sur la seule proximité :
      // on écarte la queue de distribution avant de comparer.
      // Le score le plus probable DE CETTE ISSUE. La proximité aux buts
      // attendus servait auparavant de critère principal ; elle ramenait
      // invariablement sur 2-1, parce que les buts attendus de deux équipes
      // ordinaires tiennent tous dans la même poignée de dixièmes. La
      // probabilité, elle, suit réellement les deux attaques.
      if (p > actuel.proba) meilleurParIssue[issue] = { buts1: i, buts2: j, proba: p, ecart };

      // Le score le plus PROBABLE, tout simplement — le sommet de la
      // distribution, sans filtre d'issue et sans passer par la proximité aux
      // buts attendus. C'est lui qui porte la variété : il suit les deux
      // moyennes de buts au lieu de retomber sur le même couple d'entiers.
      if (p > meilleurGlobal.proba)
        meilleurGlobal = { buts1: i, buts2: j, proba: p, ecart };
      if (issue === 'victoire1') victoire1 += p;
      else if (issue === 'nul') nul += p;
      else victoire2 += p;
      if (i >= 1 && j >= 1) lesDeux += p;
      const somme = i + j;
      if (somme >= 1) total[0] += p;
      if (somme >= 2) total[1] += p;
      if (somme >= 3) total[2] += p;
      if (somme >= 4) total[3] += p;

      // ── LA CAGE INVIOLÉE ──────────────────────────────────────────────
      //
      // Une équipe garde sa cage inviolée quand l'AUTRE ne marque pas. Rien
      // de nouveau n'est calculé : c'est une colonne de la grille déjà
      // construite, celle où l'adversaire reste à zéro.
      //
      // Elle n'est pas déductible de ce qui était déjà affiché. « Les deux
      // marquent : non » regroupe trois situations très différentes — 1-0,
      // 0-1 et 0-0 — et ne dit pas laquelle des deux défenses tient.
      if (j === 0) cageInviolee1 += p;
      if (i === 0) cageInviolee2 += p;
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

  /**
   * ── LE MOTEUR NE RÉPOND PLUS TOUJOURS LA MÊME CHOSE ───────────────────────
   *
   * Mesuré sur 4 096 combinaisons d'équipes réalistes : 2-1 sortait 46,2 % du
   * temps, 1-2 32,9 % — 79 % à eux deux — quand 1-1 ne sortait que 1 % et 0-0
   * jamais. Un abonné lançait trois analyses dans trois championnats et lisait
   * trois fois le même score.
   *
   * La cause : le score était pris parmi les seuls scores de l'issue en tête.
   * Le nul n'est presque jamais en tête — il plafonne vers 27 % quand une
   * victoire monte à 45 %. Tous les scores de parité étaient donc éliminés
   * avant même d'être comparés, et il ne restait que des scores de victoire,
   * dont le plus proche des buts attendus est 2-1 pour des équipes ordinaires.
   *
   * Un temps, la règle a donc été : si l'issue en tête ne domine pas nettement,
   * on annonce le score le plus probable quelle que soit son issue. Elle a
   * rendu la variété, mais au prix d'une contradiction affichée.
   *
   * ── LE SEUIL RESSERRÉ DE HUIT À QUATRE (24 AOÛT 2026) ───────────────────
   *
   * L'échappatoire produisait 9 % d'analyses affichant un score de PARITÉ sous
   * un texte annonçant une VICTOIRE. « 1-1 » écrit en gros au-dessus de
   * « Victoire de Liverpool, 54 % » : l'abonné n'a aucun moyen de savoir
   * lequel des deux croire.
   *
   * Le rejeu des 344 rencontres vérifiées dont les buts attendus sont
   * conservés — la grille de Poisson reconstruite à l'identique, confrontée au
   * score réellement tombé — donne :
   *
   *   seuil │ score exact │ scores diff. │ le plus servi │ contradictoires
   *       8 │    14,5 %   │      11      │   2-1 · 25 %  │      9 %
   *       4 │    15,4 %   │      11      │   2-1 · 25 %  │      3 %
   *       0 │    16,6 %   │      10      │   2-1 · 25 %  │      0 %
   *
   * Quatre est retenu, et non zéro, parce que le seuil zéro fait disparaître
   * les scores de parité : deux équipes de force identique n'en produisent
   * plus aucun, et `non-regression.test.ts` le refuse à juste titre — un
   * moteur qui n'annonce jamais 1-1 est faux, quelle que soit sa justesse par
   * ailleurs. Trois échoue à la même épreuve ; quatre est le plus bas qui la
   * passe.
   *
   * Le gain tient sur les deux moitiés de l'échantillon prises séparément —
   * +0,5 point sur la récente, +1,2 sur l'ancienne — ce qui exclut un réglage
   * taillé sur la chance. La variété ne bouge pas : onze scores distincts
   * avant comme après, et le 2-1 reste à 25 %.
   *
   * ── CE QUI A ÉTÉ ESSAYÉ ET REFUSÉ LE MÊME JOUR ──────────────────────────
   *
   * Écarter la correction Dixon-Coles du choix du score fait mieux sur le
   * papier — 17,2 % de scores exacts, et elle n'a jamais été validée pour cet
   * usage, seulement pour la probabilité de nul. Mais elle fait passer le
   * score dominant de « 2-1 à 25 % » à « 1-0 à 32 % » : plus juste, et plus
   * répétitif. Le moteur n'a rien à gagner à répondre 1-0 un tiers du temps.
   *
   * Élargir la variété au-delà, en annonçant des scores moins probables, fait
   * baisser la justesse à chaque essai. La variété des vrais scores n'est pas
   * un réglage manquant : c'est du hasard, et le modèle le porte déjà
   * correctement — dispersion des buts que la grille peut produire 1,32,
   * dispersion réellement observée 1,31, sur les mêmes 344 rencontres.
   */
  const issueDuScoreNaturel: 'victoire1' | 'nul' | 'victoire2' =
    meilleurGlobal.buts1 > meilleurGlobal.buts2
      ? 'victoire1'
      : meilleurGlobal.buts1 === meilleurGlobal.buts2
        ? 'nul'
        : 'victoire2';

  const pourcentageAffiche = { victoire1: pv1, nul: pn, victoire2: pv2 };
  const avanceDeLIssue =
    pourcentageAffiche[issueRetenue] - pourcentageAffiche[issueDuScoreNaturel];

  // Quatre : le seuil le plus bas qui laisse encore sortir un score de parité
  // entre deux équipes de force égale. Voir juste au-dessus pour le rejeu qui
  // l'a fixé, et pour ce qui a été essayé puis refusé.
  /**
   * ── REMONTÉ DE QUATRE À HUIT LE 3 SEPTEMBRE 2026 ────────────────────────
   *
   * Ce seuil décide quand on ABANDONNE le score le plus probable de la grille
   * pour aller chercher le meilleur score de l'issue annoncée. Plus il est bas,
   * plus souvent un 1-1 naturel devient un 2-1.
   *
   * C'est lui qui produisait la plupart des 2-1. Relevé sur les 317 rencontres
   * à venir : parmi les 121 qui donnaient 2-1, l'écart médian de buts attendus
   * n'était que de 0,44 — le score naturel de ces matchs est 1-1, et le seuil
   * le poussait à 2-1.
   *
   * Mesuré sur 2 305 rencontres, banc branché sur cette fonction :
   *
   *     seuil    issue    exact   score dominant   deux premiers
   *        4    49,5 %   10,5 %   1-0 à 24,9 %        45 %
   *        8    49,0 %   10,6 %   1-0 à 22,5 %        43 %
   *       15    46,8 %   11,1 %   1-1 à 21,6 %        40 %
   *       30    41,3 %   12,1 %   1-1 à 50,6 %        63 %
   *
   * Huit est retenu : meilleur sur le score exact, moins concentré, et une
   * demi-unité d'issue — soit à l'intérieur du bruit.
   *
   * Quinze donnerait la répartition la plus plate jamais obtenue (aucun score
   * au-dessus de 22 %) mais coûte 2,7 points d'issue, et l'issue est le chiffre
   * annoncé publiquement sur le mur des preuves. Ce compromis-là appartient au
   * propriétaire, pas à ce fichier.
   *
   * Au-delà de trente le moteur s'effondre sur le nul : 1-1 une fois sur deux.
   *
   * `BANC_ECART_DOMINATION` n'existe QUE pour le banc.
   */
  const ECART_DOMINATION = Number(process.env.BANC_ECART_DOMINATION) || 8;

  /**
   * ── ON N'ANNONCE PAS UN VAINQUEUR QUE LE CALCUL N'A PAS DÉPARTAGÉ ────────
   *
   * L'issue retenue se décide plus haut par `pv1 >= pv2`. Avec une ÉGALITÉ
   * PARFAITE, ce test rend « victoire1 » sans que rien ne l'ait départagée : le
   * signe « supérieur ou égal » tranche à la place du modèle.
   *
   * Ce que ça donnait à l'écran, relevé le 2 septembre 2026 sur Real Betis —
   * Real Madrid :
   *
   *     buts attendus   1,40  contre  1,40
   *     probabilités      36  ·  28  ·  36
   *     score annoncé          2 - 1        pour le Betis
   *     confiance                81 %       affichée « Très élevée »
   *
   * Le score le plus probable de cette grille est 1-1. Mais « victoire1 » (36)
   * devançait le nul (28) de huit points, donc au-dessus du seuil de
   * domination : le calcul abandonnait le 1-1 pour aller chercher le meilleur
   * score DANS la victoire du Betis, c'est-à-dire 2-1.
   *
   * Le seuil de domination compare l'issue retenue à celle du score naturel.
   * Il ne compare jamais les deux victoires ENTRE ELLES — et c'est là que
   * l'égalité passait.
   *
   * Mesuré sur les 1 019 prédictions enregistrées : 80 désignent un vainqueur
   * alors que les deux équipes sont à trois points ou moins l'une de l'autre,
   * avec une confiance moyenne annoncée de 77 %. Quarante-deux le font sur des
   * buts attendus rigoureusement identiques.
   *
   * C'est aussi ce qui nourrissait le 2-1 : il pesait 30,5 % de toutes les
   * prédictions.
   *
   * Le nul, lui, garde le droit de forcer son score : quand `pn` domine
   * réellement, l'égalité entre les deux victoires n'est pas une indécision,
   * c'est le résultat annoncé.
   */
  const ECART_INDECIS = 4;
  const vainqueurNonDepartage =
    (issueRetenue === 'victoire1' || issueRetenue === 'victoire2') &&
    Math.abs(pv1 - pv2) < ECART_INDECIS;

  /**
   * ── LE SOMMET DE LA GRILLE EST UN PLANCHER ──────────────────────────────
   *
   * Le score le plus probable d'une loi de Poisson est l'entier juste EN
   * DESSOUS de son espérance. Une équipe attendue à 2,74 buts y ressort à 2 ;
   * à 3,74 buts, à 3. On perd un demi-but par équipe, à chaque match.
   *
   * Relevé le 3 septembre 2026 sur les 317 rencontres à venir : le 2-1 pesait
   * 38 % à lui seul. Barcelone — Villarreal, attendu à 2,74 contre 1,07,
   * ressortait « 2-1 » alors que le calcul dit 3-1.
   *
   * ── LA RÈGLE EST CHOISIE PAR MESURE, PLUS À LA MAIN ─────────────────────
   *
   * `BANC_REGLE_SCORE` n'existe QUE pour le banc d'essai. En production la
   * variable n'est pas posée et la valeur retenue est celle écrite ici.
   *
   * Une règle réglée sur un banc qui réimplémentait le moteur a déjà été
   * essayée, et refusée par les tests de non-régression : le 2-1 remontait à
   * 43 % et les nuls entre équipes égales disparaissaient. Le banc importe
   * désormais cette fonction-ci — toute valeur retenue vient de lui.
   */
  const REGLE_SCORE = process.env.BANC_REGLE_SCORE || 'domination';

  /**
   * ── QUAND UNE ÉQUIPE DOMINE, LE SCORE DOIT LE DIRE ──────────────────────
   *
   * Le sommet de la grille est un PLANCHER : il rend l'entier juste en dessous
   * de l'espérance. Barcelone attendu à 2,74 buts contre Villarreal y ressort à
   * 2 — d'où « 2-1 » sur une affiche que le calcul voit à 2,74 contre 1,07.
   *
   * Sur un match serré, ce plancher est sans conséquence : entre 1,5 et 1,3, le
   * score le plus probable est bien 1-1 ou 2-1, et l'arrondi n'apporte rien —
   * mesuré, il fait même perdre cinq points de justesse sur l'issue.
   *
   * Sur une affiche DÉSÉQUILIBRÉE, il coûte un but au favori à chaque fois.
   * C'est ce qui empêchait les 3-0, 3-1, 4-1 d'apparaître.
   *
   * On arrondit donc les buts attendus UNIQUEMENT quand l'écart entre les deux
   * équipes est franc. Ailleurs, le sommet garde la main.
   *
   * ── LE SEUIL, MESURÉ SUR 2 305 RENCONTRES ───────────────────────────────
   *
   *     seuil      issue    exact   scores   score dominant   deux premiers
   *     sommet    49,0 %   10,6 %     13     1-0 à 22,5 %        43 %
   *      0,9      49,0 %   10,1 %     18     2-1 à 30,0 %        49 %
   *      1,3      49,0 %   10,4 %     17     2-1 à 23,2 %        46 %
   *      1,6      49,0 %   10,1 %     17     1-0 à 22,5 %        44 %
   *
   * À 0,9 le seuil mord sur le milieu de tableau : deux équipes séparées d'un
   * but ne sont pas une grosse affiche, et l'arrondi y remonte le 2-1 à 30 %.
   *
   * À 1,6 il ne touche que les vraies dominations. La justesse sur l'issue ne
   * bouge pas d'un centième, la concentration reste celle du sommet — et le
   * moteur gagne quatre scores distincts, dont ceux qui manquaient : 3-1 à 4 %,
   * 2-0 à 8 %, 1-3 à 1 %.
   */
  const ECART_DOMINATION_BUTS =
    Number(process.env.BANC_ECART_BUTS) || 1.6;
  const dominationFranche =
    Math.abs(butsAttendus1 - butsAttendus2) >= ECART_DOMINATION_BUTS;

  let meilleur:
    | typeof meilleurGlobal
    | { buts1: number; buts2: number; proba: number };

  // « domination » : le sommet partout, sauf sur les affiches déséquilibrées
  // où l'on arrondit les buts attendus. C'est la règle de production.
  const parLeSommet =
    REGLE_SCORE === 'sommet' || (REGLE_SCORE === 'domination' && !dominationFranche);

  if (parLeSommet) {
    meilleur =
      issueDuScoreNaturel === issueRetenue ||
      avanceDeLIssue < ECART_DOMINATION ||
      vainqueurNonDepartage
        ? meilleurGlobal
        : meilleurParIssue[issueRetenue];
  } else {
    // ── ARRONDI : on rend au favori les buts qu'il est censé marquer ──────
    const borne = (v: number) => Math.max(0, Math.min(BUTS_MAX, Math.round(v)));
    let b1 = borne(butsAttendus1);
    let b2 = borne(butsAttendus2);

    // On ne remet le score d'accord avec les probabilités QUE lorsqu'elles ont
    // réellement tranché. Sinon l'arrondi décide seul — c'est ce qui préserve
    // les scores de parité entre deux équipes de même force, et ce que la
    // première tentative avait détruit en forçant l'issue à tous les coups.
    const trancheNet =
      !vainqueurNonDepartage && avanceDeLIssue >= ECART_DOMINATION;

    // Sur une affiche déséquilibrée, l'arrondi désigne déjà le bon vainqueur —
    // sauf accident d'arrondi (2,49 contre 1,51 donnerait 2-2). On remet alors
    // le score d'accord avec les probabilités, en AJOUTANT un but au favori.
    if ((REGLE_SCORE === 'accorde' || REGLE_SCORE === 'domination') && trancheNet) {
      if (issueRetenue === 'victoire1' && b1 <= b2) b1 = Math.min(BUTS_MAX, b2 + 1);
      else if (issueRetenue === 'victoire2' && b2 <= b1) b2 = Math.min(BUTS_MAX, b1 + 1);
      else if (issueRetenue === 'nul' && b1 !== b2) {
        b1 = b2 = borne((butsAttendus1 + butsAttendus2) / 2);
      }
    }

    meilleur = {
      buts1: b1,
      buts2: b2,
      // La probabilité affichée est celle du score RÉELLEMENT annoncé, relue
      // dans la même grille — jamais celle d'un score qu'on n'affiche plus.
      proba: p1[b1] * p2[b2] * correctionPetitsScores(b1, b2, butsAttendus1, butsAttendus2),
    };
  }

  /**
   * ── LE 2-1 N'EST PLUS AFFICHÉ, PAR DÉCISION DU PROPRIÉTAIRE ─────────────
   *
   * ── CE QUI A CONDUIT LÀ ─────────────────────────────────────────────────
   *
   * Les buts attendus de la plupart des rencontres tiennent entre 1,0 et 1,9.
   * Relevé sur huit matchs analysés le 3 septembre 2026 au matin :
   *
   *     Atlético 1,78 – Athletic 1,13     Dortmund 1,73 – Hoffenheim 1,37
   *     Lille    1,75 – Toulouse  1,07    Basel    1,34 – Sion       1,45
   *
   * Trois chiffres différents, un seul couple d'entiers possible : 2 et 1. Il
   * n'existe aucun entier entre 1 et 2. Le 2-1 pesait donc 30 à 38 % de toutes
   * les analyses, et le propriétaire l'a vu sur quatre matchs d'affilée, dans
   * quatre championnats différents.
   *
   * ── CE QUI A ÉTÉ ESSAYÉ AVANT ───────────────────────────────────────────
   *
   * Sur 2 305 rencontres, banc branché sur cette fonction : arrondi des buts
   * attendus, arrondi accordé à l'issue, quatre seuils de domination, deux
   * valeurs d'amortissement. TOUTES concentrent davantage — l'arrondi fait
   * monter le 1-1 à 36 %, le seuil élevé à 59 %. On remplaçait un score
   * répétitif par un autre.
   *
   * ── LA DÉCISION, ET CE QU'ELLE COÛTE ────────────────────────────────────
   *
   * Le propriétaire l'a demandé une douzaine de fois sur deux jours, la
   * dernière sans ambiguïté : ce score ne doit plus apparaître. C'est sa
   * décision commerciale, elle est prise, et elle est appliquée ici.
   *
   * Le coût est réel et il faut le connaître : quand le calcul désigne 2-1,
   * c'est que 2-1 EST le score le plus probable. On affiche donc le SUIVANT,
   * qui est par construction un peu moins probable. Le score exact perdra
   * quelques dixièmes de point de justesse.
   *
   * ── COMMENT LE REMPLAÇANT EST CHOISI ────────────────────────────────────
   *
   * Dans la même grille, à la même issue. On ne prend pas un score au hasard :
   * on prend le plus probable après lui, ce qui garde le vainqueur annoncé, la
   * cohérence avec les probabilités affichées, et un lien direct avec les buts
   * attendus. Un 1,78 contre 1,13 donnera 2-0 ou 1-0, jamais 4-3.
   */
  /**
   * ── LA RÉPARTITION DES SCORES EST CELLE DEMANDÉE PAR LE PROPRIÉTAIRE ────
   *
   * Le 3 septembre 2026, après deux jours d'échanges, il a fixé lui-même la
   * répartition qu'il veut voir à l'écran :
   *
   *     3-0  33     0-2  25     0-1  13
   *     3-1  30     2-0  25     1-1   9
   *     1-3  28     4-1  18     1-0   6     0-0   5
   *
   * Et le 2-1, qu'il a demandé une douzaine de fois de retirer, à zéro.
   *
   * ── POURQUOI CE N'EST PAS UN TIRAGE AU HASARD ──────────────────────────
   *
   * Ces poids ne remplacent pas le calcul : ils le PONDÈRENT. Pour chaque
   * rencontre on parcourt la même grille de Poisson, on ne garde que les
   * scores compatibles avec l'issue que les probabilités désignent, et l'on
   * retient celui dont `probabilité × poids` est le plus fort.
   *
   * Un score reste donc impossible s'il est improbable : une équipe attendue à
   * 0,8 but ne se verra jamais accorder un 4-1, quel que soit son poids. Ce qui
   * change, c'est l'arbitrage ENTRE des scores tous plausibles — là où le
   * modèle hésitait entre 1-0, 2-0 et 2-1, il choisit désormais celui que le
   * propriétaire veut voir.
   *
   * ── CE QUE ÇA COÛTE, ET IL FAUT LE SAVOIR ──────────────────────────────
   *
   * Le score le plus probable n'est plus toujours celui qui s'affiche. La
   * justesse sur le SCORE EXACT baisse mécaniquement. L'issue annoncée, elle,
   * ne bouge pas : elle vient des probabilités, pas de ces poids, et c'est
   * elle qui est publiée sur le mur des preuves.
   *
   * ── CE QUI N'EST PAS NÉGOCIABLE ────────────────────────────────────────
   *
   * Le score doit rester d'accord avec l'issue. Un 3-0 affiché sous des
   * probabilités qui donnent l'adversaire gagnant serait la contradiction que
   * l'on vient de passer deux jours à corriger — c'est la seule chose que ces
   * poids n'ont pas le droit de casser.
   */
  /**
   * ── L'ORDRE DE PRÉFÉRENCE DES SCORES ───────────────────────────────────
   *
   * Le propriétaire a fixé la répartition qu'il veut voir : les scores larges
   * devant, le 1-0 rare, le 2-1 nulle part.
   *
   *     3-0  33     0-2  25     0-1  13
   *     3-1  30     2-0  25     1-1   9
   *     1-3  28     4-1  18     1-0   6     0-0   5
   *
   * ── POURQUOI UN ORDRE ET NON DES POIDS ─────────────────────────────────
   *
   * Des poids multipliés à la probabilité ont été essayés et calibrés
   * automatiquement sur 1 250 rencontres : la boucle diverge. Les poids
   * saturent et la répartition s'effondre sur deux scores (0-2 à 57 %). La
   * raison est structurelle : chaque score dépend de l'issue déjà décidée, et
   * les parts visées ne sont pas atteignables simultanément par un simple
   * facteur.
   *
   * Un ORDRE, lui, se contrôle. On descend la liste et l'on prend le premier
   * score qui reste plausible.
   *
   * ── LE GARDE-FOU DE PLAUSIBILITÉ ───────────────────────────────────────
   *
   * Un score n'est retenu que si sa probabilité atteint une fraction de celle
   * du meilleur score de la même issue. Sans ce seuil, on afficherait 4-1 sur
   * une rencontre où les deux équipes attendent un but — ce qui serait faux,
   * et le client le verrait au coup de sifflet final.
   *
   * À 0,35, une équipe attendue à 0,8 but ne se verra jamais accorder un 4-1 ;
   * une équipe attendue à 2,6 buts, oui.
   *
   * ── CE QUI RESTE NON NÉGOCIABLE ────────────────────────────────────────
   *
   * Le score doit rester d'accord avec l'ISSUE que les probabilités désignent.
   * Un 3-0 sous des probabilités donnant l'adversaire gagnant serait la
   * contradiction corrigée le 2 septembre. La liste est donc parcourue à
   * l'intérieur de l'issue retenue, jamais à travers.
   */
  const PALIERS: Record<'victoire1' | 'nul' | 'victoire2', [number, number][][]> = {
    // Trois paliers. On descend d'un palier au suivant seulement si aucun de
    // ses scores n'est plausible. À l'intérieur d'un palier, c'est la
    // PROBABILITÉ qui départage — sans quoi le premier de la liste sortirait
    // toujours, et l'on remplacerait le 2-1 par un 3-0 tout aussi répétitif.
    victoire1: [
      [[3, 0], [3, 1], [4, 1], [4, 0]],
      [[2, 0], [4, 2], [3, 2], [5, 1]],
      [[1, 0]],
    ],
    victoire2: [
      [[0, 3], [1, 3], [1, 4], [0, 4]],
      [[0, 2], [2, 4], [2, 3], [1, 5]],
      [[0, 1]],
    ],
    // Il n'existe pas de « grand » nul : l'ordre naturel suffit.
    nul: [[[1, 1], [2, 2]], [[0, 0], [3, 3]]],
  };

  /**
   * Part de la probabilité du meilleur score de l'issue qu'un score doit
   * atteindre pour être retenu.
   *
   * Sans ce seuil, on afficherait 4-1 sur une rencontre où les deux équipes
   * attendent un but — faux, et visible au coup de sifflet final.
   *
   * Mesuré sur 2 305 rencontres, part du score le plus servi :
   *
   * Mesuré sur 2 305 rencontres, une fois les paliers en place :
   *
   *     0,45  →  3-1 à 24 %,  8 scores,  deux premiers 43 %
   *     0,55  →  2-0 à 22 %, 10 scores,  deux premiers 42 %
   *     0,65  →  2-0 à 28 %, 10 scores,  deux premiers 44 %
   *
   * 0,55 est retenu : c'est la répartition la plus plate que ce moteur ait
   * produite. Aucun score au-dessus de 22 %.
   *
   *     2-0 22 %   3-1 20 %   3-0 16 %   1-1 13 %   0-2 13 %   1-3 11 %
   */
  const SEUIL_PLAUSIBILITE = Number(process.env.BANC_SEUIL_PLAUSIBLE) || 0.45;

  /**
   * ── QUELLE RÈGLE CHOISIT LE SCORE ─────────────────────────────────────
   *
   * `paliers` — la liste ordonnée ci-dessus. Elle a remplacé le 2-1 unique,
   *   et a fini par produire sa propre répétition : 3-0 ou 3-1 sur presque
   *   toute victoire nette.
   *
   * `grille`  — chaque score compatible avec l'issue, pondéré par sa
   *   probabilité réelle sur CE match. Le score suit alors l'intensité de la
   *   domination au lieu d'une liste écrite d'avance.
   *
   * Réglable par `BANC_CHOIX_SCORE` pour que le banc d'essai compare les deux
   * sur des milliers de rencontres, et non sur une impression. À ne pas
   * confondre avec `BANC_REGLE_SCORE`, plus haut, qui décide comment les BUTS
   * ATTENDUS deviennent des entiers — deux étapes distinctes du même calcul.
   */
  const CHOIX_DU_SCORE = process.env.BANC_CHOIX_SCORE || 'grille';

  /**
   * Sous ce seuil, un score n'entre pas dans le tirage.
   *
   * Plus bas que celui des paliers, et c'est voulu : ici le poids fait déjà
   * le tri, un score improbable étant rarement tiré. Le seuil ne sert qu'à
   * écarter l'absurde — un 5-0 sur une rencontre à deux buts attendus.
   */
  const SEUIL_GRILLE = Number(process.env.BANC_SEUIL_GRILLE) || 0.12;

  /** Le 2-1 reste-t-il proscrit ? Décision du 3 septembre 2026. */
  const SANS_DEUX_UN = process.env.BANC_AVEC_DEUX_UN !== 'oui';

  /**
   * ── LE POIDS DES GROS SCORES, RAMENÉ À CE QU'ILS PÈSENT VRAIMENT ───────
   *
   * Chaque but supplémentaire multiplie le poids d'un score par ce facteur.
   * En dessous de 1, les scores fleuves reculent et les petits avancent.
   *
   * Pourquoi c'est nécessaire alors que la grille est déjà « la vraie
   * probabilité » : parce que le tirage se fait À L'INTÉRIEUR d'une issue déjà
   * choisie, et que l'issue retenue est presque toujours celle du favori. La
   * masse conditionnelle penche donc vers les scores larges, plus qu'ils
   * n'arrivent en vrai.
   *
   * Un seul réglage produit les deux effets demandés le 5 septembre 2026 :
   * moins de 3-0, 3-1 et 0-3 — et, mécaniquement, plus de 1-0, 2-0, 0-1 et
   * 0-2, puisque la masse retirée aux uns revient aux autres dans la même
   * issue.
   *
   * Il ne touche PAS à l'issue annoncée : 3-0 et 1-0 disent la même chose du
   * vainqueur. La justesse du résultat ne peut donc pas bouger.
   */
  //
  // ── LA VALEUR RETENUE EST 1, C'EST-À-DIRE AUCUNE PÉNALITÉ ──────────────
  //
  // Le propriétaire a donné le 5 septembre 2026 une répartition à atteindre :
  // 1-0 16 %, 2-0 14 %, 3-0 6 %, 3-1 5 %, 0-1 11 %, 0-2 11 %, 1-3 5 %,
  // 0-3 2 %, 1-1 4 %, 4-0 4 %.
  //
  // Dix réglages ont été essayés sur les 2 305 rencontres du banc, en mesurant
  // l'écart total à cette liste. Toute pénalité ÉLOIGNE : 14 points d'écart
  // sans elle, 18 à 0,9, 22 à 0,8, 23 à 0,6. La masse retirée aux gros scores
  // revient au 1-0 et au 2-0, qui dépassent alors la cible autant que les
  // autres lui manquaient.
  //
  // Le levier reste en place, réglable, parce qu'il faudra peut-être le
  // reprendre quand la table d'apprentissage aura doublé. Mais il est neutre
  // aujourd'hui, et c'est une mesure qui l'a décidé.
  const PENALITE_BUTS = Number(process.env.BANC_PENALITE_BUTS) || 1;

  /** Nombre de buts au-dessous duquel la pénalité ne s'applique pas. */
  const FRANCHISE_BUTS = Number(process.env.BANC_FRANCHISE_BUTS) || 2;

  /**
   * ── L'APLATISSEMENT : RESSERRER SANS INVERSER ─────────────────────────
   *
   * Chaque poids est élevé à cette puissance avant le tirage.
   *
   *   1     — les probabilités telles quelles. Le score deux fois plus
   *           probable sort deux fois plus souvent, et le 1-0 finit à 13 %
   *           parce qu'il est en tête sur beaucoup de rencontres.
   *   0,5   — la racine carrée. Un score quatre fois plus probable ne sort
   *           plus que deux fois plus souvent : les écarts s'écrasent,
   *           L'ORDRE NE CHANGE PAS.
   *   0     — tous les scores à égalité. À proscrire : le score ne dirait
   *           plus rien du match et contredirait les pourcentages affichés
   *           juste en dessous — le défaut signalé le 3 septembre 2026.
   *
   * Ce réglage ne touche QUE la répartition à l'intérieur de l'issue déjà
   * retenue. Le vainqueur annoncé reste celui des probabilités, quoi qu'il
   * arrive : un favori à 85 % ne peut pas recevoir un score perdant.
   */
  /**
   * ── LA VALEUR RETENUE : 0,5 ────────────────────────────────────────────
   *
   * Choisie par le propriétaire le 5 septembre 2026, sur ces mesures — six
   * réglages, 2 305 rencontres, le vrai moteur :
   *
   *     réglage   score le plus servi   score exact
   *       1            1-0  16,4 %         7,4 %
   *       0,8          1-0  14,8 %         7,2 %
   *       0,65         1-0  14,0 %         6,9 %
   *       0,5          1-0  12,8 %         6,8 %     <-- retenu
   *       0,35         1-0  11,7 %         6,2 %
   *       0,2          2-0  10,5 %         5,7 %
   *
   * C'est le meilleur rapport de la série : 3,6 points de concentration en
   * moins pour 0,6 point de précision. En dessous, on paie deux fois plus
   * cher — et à 0,35, une domination à 77 % commence à rendre des 3-2, ce qui
   * n'a pas de sens.
   *
   * Le plancher, lui, est à 9 % : même en aplatissant à l'extrême, le 1-0 et
   * le 2-0 restent les scores POSSIBLES sur presque toutes les victoires à
   * domicile, quand un 5-2 ne l'est que sur quelques rencontres. Viser 7 %
   * était donc hors d'atteinte, et le savoir évite d'y revenir.
   */
  const APLATISSEMENT = Number(process.env.BANC_APLATISSEMENT) || 0.5;

  /**
   * Un nombre de [0, 1) tiré d'une graine, sans aucun hasard réel.
   *
   * Mélange entier de Thomas Wang : deux graines voisines donnent deux
   * résultats sans rapport, ce qui est exactement ce qu'on demande — les buts
   * attendus de deux matchs voisins ne doivent pas produire le même score.
   */
  const melangeur = (graine: number): number => {
    let x = graine | 0;
    x = (x ^ 61) ^ (x >>> 16);
    x = x + (x << 3);
    x = x ^ (x >>> 4);
    x = Math.imul(x, 0x27d4eb2d);
    x = x ^ (x >>> 15);
    return ((x >>> 0) % 100_000) / 100_000;
  };

  /**
   * ── LE NUL N'EST ANNONCÉ QUE S'IL DOMINE VRAIMENT ─────────────────────
   *
   * Le propriétaire veut voir le 1-1 autour de 7 %, contre 13 % mesurés.
   *
   * Le nul est l'issue la plus difficile à annoncer : il tombe une fois sur
   * quatre dans la réalité, mais il n'est presque jamais l'issue LA PLUS
   * PROBABLE — il partage la masse entre deux victoires possibles.
   *
   * On exige donc qu'il devance la meilleure victoire d'une marge nette avant
   * de l'annoncer. En dessous, on prend la victoire en tête.
   *
   * Ce réglage ne touche QUE le score affiché. Les trois probabilités restent
   * celles du calcul, et c'est sur elles que la justesse de l'issue est jugée.
   */
  const MARGE_DU_NUL = Number(process.env.BANC_MARGE_NUL) || 3;
  const meilleureVictoire = Math.max(pv1, pv2);
  const nulDomine = pn >= meilleureVictoire + MARGE_DU_NUL;

  /**
   * ── CE GARDE-FOU PASSE AVANT TOUT LE RESTE ────────────────────────────
   *
   * Quand les deux victoires sont à moins de quatre points l'une de l'autre,
   * le calcul n'a départagé personne. Annoncer un vainqueur là revient à
   * laisser le signe « supérieur ou égal » trancher à la place du modèle —
   * c'est exactement le défaut corrigé le 2 septembre 2026, quand l'écran
   * affichait « Real Betis 2-1 Real Madrid » sur des probabilités de
   * 36 · 28 · 36.
   *
   * La suppression du nul ci-dessus l'avait rouvert : mesuré, 156 cas sur
   * 4 096 annonçaient de nouveau un vainqueur non départagé, et deux équipes
   * rigoureusement identiques ne produisaient plus aucun nul.
   *
   * Aucun réglage de répartition n'a le droit de rouvrir cette porte.
   */
  const deuxVictoiresAegalite = Math.abs(pv1 - pv2) < ECART_INDECIS;

  /**
   * ── ET LE NUL RESTE POSSIBLE ENTRE DEUX ÉQUIPES DE MÊME FORCE ─────────
   *
   * Le 1-1 est l'un des scores les plus fréquents du football réel. Un moteur
   * qui ne le produit jamais est faux, quelle que soit sa justesse ailleurs.
   *
   * Mesuré : avec la seule suppression du nul, deux équipes rigoureusement
   * identiques ne rendaient plus AUCUN nul sur seize affiches — l'avantage du
   * terrain suffisait à faire pencher l'issue, et le score suivait.
   *
   * Quand le score le plus probable de la grille est un nul et que la
   * meilleure victoire ne le devance pas nettement, on garde le nul.
   */
  const grilleDitNul = meilleurGlobal.buts1 === meilleurGlobal.buts2;
  const MARGE_NUL_CONSERVE = Number(process.env.BANC_NUL_CONSERVE) || 1;
  const nulPasDetrone = meilleureVictoire - pn < MARGE_NUL_CONSERVE;

  /**
   * ── LE NUL N'EST ANNONCÉ QUE S'IL EST LA PLUS FORTE PROBABILITÉ ────────
   *
   * Mesuré le 5 septembre 2026 sur les 3 467 rencontres réellement jugées —
   * pas sur un banc, sur ce que le moteur a produit en production :
   *
   *     nuls annoncés ......................... 295  (8,5 %)
   *     leur réussite ......................... 26,8 %
   *     réussite si l'on avait joué le favori .. 44,7 %
   *
   * Cinquante-trois rencontres perdues pour rien. Ramené au total, la règle
   * précédente coûtait 1,53 point de justesse : 48,9 % au lieu de 50,4 %.
   *
   * Elle annonçait le nul sur trois conditions — deux victoires à égalité, un
   * nul dominant, ou une grille dont le sommet est un nul. Chacune se
   * défendait ; ensemble elles annonçaient le nul quatre fois trop souvent,
   * sur des matchs où il n'était PAS l'issue la plus probable. Or le nul a
   * cette particularité : il arrive une fois sur quatre, mais il n'est presque
   * jamais en tête, car il partage la masse entre deux victoires possibles.
   * L'annoncer sans qu'il domine, c'est choisir sciemment une issue moins
   * probable qu'une autre.
   *
   * ── CE QUE ÇA COÛTE, ET C'EST ASSUMÉ ──────────────────────────────────
   *
   * Le 1-1 devient rare. Le propriétaire l'avait demandé autour de 7 % le
   * 3 septembre ; il demande aujourd'hui, plus fort, que les ratés cessent.
   * Entre les deux, la justesse l'emporte — c'est elle que ses clients
   * regardent.
   *
   * Les probabilités affichées, elles, ne bougent pas d'un point : le nul
   * continue d'être annoncé à sa vraie valeur, 26,0 % en moyenne pour 25,7 %
   * de nuls réels. C'est le SCORE qui cesse de le désigner, pas le calcul qui
   * cesse de le voir.
   */
  const NUL_SEULEMENT_SI_EN_TETE = process.env.BANC_NUL_LARGE !== 'oui';
  const nulEnTete = pn > pv1 && pn > pv2;

  /**
   * ── L'EXCEPTION QUI RESTE, ET POURQUOI ────────────────────────────────
   *
   * Quand les deux victoires sont à égalité, désigner un vainqueur revient à
   * le tirer au sort — c'est le défaut signalé le 3 septembre 2026 :
   * « Real Betis 2-1 Real Madrid » sur des probabilités de 36/28/36. Le nul
   * reste donc annoncé dans ce cas, et un test balaie 4 096 combinaisons pour
   * s'en assurer.
   *
   * Le seuil passe de 4 à 2 points. Les probabilités sont arrondies à
   * l'entier : en deçà de deux points, l'écart est du bruit, et rien ne
   * départage vraiment. Au-delà, il y a un signal, et l'ignorer coûtait cher.
   *
   * Mesuré sur les 3 467 rencontres jugées :
   *
   *     nul si en tête OU deux victoires à moins de 4 pts .. 49,41 %
   *     nul si en tête OU deux victoires à moins de 3 pts .. 49,96 %
   *     nul si en tête OU deux victoires à moins de 2 pts .. 50,27 %   <-- retenu
   *     nul seulement s'il est en tête ..................... 50,36 %
   *
   * Le dernier gagne neuf centièmes de plus, et abandonne le principe. On
   * garde le principe.
   */
  const ECART_NON_DEPARTAGE = Number(process.env.BANC_ECART_NUL) || 2;
  const vraimentAegalite = Math.abs(pv1 - pv2) < ECART_NON_DEPARTAGE;

  const issueVisee: 'victoire1' | 'nul' | 'victoire2' =
    (
      NUL_SEULEMENT_SI_EN_TETE
        ? nulEnTete || vraimentAegalite
        : deuxVictoiresAegalite || nulDomine || (grilleDitNul && nulPasDetrone)
    )
      ? 'nul'
      : pv1 >= pv2
        ? 'victoire1'
        : 'victoire2';

  const probaDe = (i: number, j: number) =>
    p1[i] * p2[j] * correctionPetitsScores(i, j, butsAttendus1, butsAttendus2);

  // La référence : le score le plus probable DE CETTE ISSUE, 2-1 exclu.
  let referenceProba = 0;
  for (let i = 0; i <= BUTS_MAX; i++) {
    for (let j = 0; j <= BUTS_MAX; j++) {
      const ici = i > j ? 'victoire1' : i === j ? 'nul' : 'victoire2';
      if (ici !== issueVisee) continue;
      if ((i === 2 && j === 1) || (i === 1 && j === 2)) continue;
      const p = probaDe(i, j);
      if (p > referenceProba) referenceProba = p;
    }
  }

  if (CHOIX_DU_SCORE === 'grille') {
    // ── TOUS LES SCORES DE L'ISSUE, CHACUN SELON SON POIDS ───────────────
    //
    // Les paliers ci-dessus font sortir 3-0 ou 3-1 sur presque toute victoire
    // nette : leur premier rang contient ces deux scores, et l'on n'en
    // descend que si aucun n'est plausible. Constaté le 5 septembre 2026 sur
    // neuf rencontres du jour analysées à la main — Manchester City 3-0
    // Coventry à 85 %, Brentford 3-0 Sunderland à 60 % : deux dominations
    // très différentes, le même score.
    //
    // Ici, chaque score compatible avec l'issue reçoit son poids réel, celui
    // que la loi de Poisson lui donne pour CE match. Une domination écrasante
    // pousse la masse vers 3-0 et 4-0 ; une victoire modeste vers 1-0 et 2-1.
    // Le score suit enfin l'intensité de la rencontre.
    const candidats: { buts1: number; buts2: number; proba: number }[] = [];
    let masse = 0;
    for (let i = 0; i <= BUTS_MAX; i++) {
      for (let j = 0; j <= BUTS_MAX; j++) {
        const ici = i > j ? 'victoire1' : i === j ? 'nul' : 'victoire2';
        if (ici !== issueVisee) continue;
        // Le 2-1 (et son miroir) reste écarté tant que la décision du
        // 3 septembre 2026 tient : le propriétaire ne veut plus le voir.
        // C'est un réglage, pas une loi — d'où la variable.
        if (SANS_DEUX_UN && ((i === 2 && j === 1) || (i === 1 && j === 2))) continue;
        const pr = probaDe(i, j);
        // Le seuil reste : sans lui, un 5-0 improbable finirait par sortir.
        // Il s'applique à la probabilité NUE, avant pénalité : c'est la
        // plausibilité du score qui décide s'il entre, pas notre préférence.
        if (pr < SEUIL_GRILLE * referenceProba) continue;
        // La pénalité ne mord qu'AU-DELÀ de deux buts. Sans cette franchise,
        // elle écrase aussi le 1-0 face au 2-0 et concentre tout sur le plus
        // petit score : mesuré, 1-0 grimpait à 28 %, soit le défaut qu'on
        // vient de corriger, dans l'autre sens.
        const brut = pr * Math.pow(PENALITE_BUTS, Math.max(0, i + j - FRANCHISE_BUTS));
        const poids = APLATISSEMENT === 1 ? brut : Math.pow(brut, APLATISSEMENT);
        candidats.push({ buts1: i, buts2: j, proba: poids });
        masse += poids;
      }
    }

    if (candidats.length && masse > 0) {
      // ── UN TIRAGE, MAIS PAS UN HASARD ──────────────────────────────────
      //
      // La graine vient des buts attendus du match lui-même. Deux
      // conséquences, toutes deux nécessaires : le même match rend TOUJOURS
      // le même score — un abonné qui rouvre son analyse doit y retrouver ce
      // qu'il a lu —, et deux matchs différents tombent sur des scores
      // différents, puisque leurs buts attendus le sont.
      //
      // Sans cela, le score le plus probable sortirait à chaque fois, et l'on
      // retomberait sur la répétition qu'on vient de quitter : le mode d'une
      // loi de Poisson est très stable d'un match à l'autre.
      const graine =
        (Math.round(butsAttendus1 * 10_000) * 73_856_093) ^
        (Math.round(butsAttendus2 * 10_000) * 19_349_663);
      const tirage = melangeur(graine);

      let cumul = 0;
      for (const c of candidats) {
        cumul += c.proba / masse;
        if (tirage <= cumul) {
          meilleur = c;
          break;
        }
      }
    }
  } else {
    for (const palier of PALIERS[issueVisee]) {
      let retenu: { buts1: number; buts2: number; proba: number } | null = null;
      for (const [i, j] of palier) {
        if (i > BUTS_MAX || j > BUTS_MAX) continue;
        const pr = probaDe(i, j);
        if (pr < SEUIL_PLAUSIBILITE * referenceProba) continue;
        if (!retenu || pr > retenu.proba) retenu = { buts1: i, buts2: j, proba: pr };
      }
      if (retenu) { meilleur = retenu; break; }
    }
  }

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
  const issues = [victoire1, nul, victoire2].sort((a, b) => b - a);
  const nettete = Math.min(1, (issues[0] - issues[1]) / 0.35);

  // La matière : combien de rencontres ont réellement servi au calcul. Avec les
  // forces ajustées, c'est une saison entière derrière chaque équipe — et non
  // les deux matchs qu'elle a disputés depuis la reprise.
  const matchsConnus = avecForces
    ? Math.min(forces!.equipe1.matchs, forces!.equipe2.matchs)
    : Math.min(joues1, joues2);
  const matiere = Math.min(1, matchsConnus / MATCHS_POUR_ETRE_SUR);

  // Le plafond le plus bas l'emporte : un amical entre deux clubs de pays
  // différents cumule les deux raisons de se méfier.
  const plafond = Math.min(
    peuFiable ? CONFIANCE_MAX_PEU_FIABLE : CONFIANCE_MAX,
    comparaisonCroisee ? CONFIANCE_MAX_COMPARAISON_CROISEE : CONFIANCE_MAX
  );
  const confiance = Math.round(
    borner(
      CONFIANCE_MIN + (CONFIANCE_MAX - CONFIANCE_MIN) * (0.45 * matiere + 0.55 * nettete),
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
    probaCageInviolee1: Math.round(cageInviolee1 * 100),
    probaCageInviolee2: Math.round(cageInviolee2 * 100),
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
  // ── LE NUL DOIT DIRE POURQUOI, SINON IL PASSE POUR UNE RECOPIE ───────────
  //
  // Sur Espanyol — Real Madrid, 1-1 à la 74ᵉ, le moteur annonçait « 1-1 ». Le
  // calcul était juste : à seize minutes de la fin, le partage des points vaut
  // 60 %, et à la 88ᵉ il en vaut 94. Annoncer autre chose serait mentir.
  //
  // Mais à l'écran, « 1-1 » sous un direct à 1-1 se lit comme un copier-coller.
  // La même prévision, à la mi-temps, donnait 1-2 pour le Real — preuve qu'elle
  // se calcule vraiment. Personne ne pouvait le deviner.
  //
  // Le verdict nomme donc ce qui rend le nul probable : le temps qui reste. Un
  // chiffre sans sa raison n'est pas un pronostic, c'est une affirmation.
  const scoreFige =
    meilleur.s1 === butsActuels1 && meilleur.s2 === butsActuels2 && minutesRestantes > 0;

  let verdict: string;
  if (pn === maxi) {
    verdict = serre
      ? `Tout reste ouvert : le partage des points est le scénario le plus probable (${pn} %), mais de peu.`
      : scoreFige
        ? `Il reste ${minutesRestantes} minutes, trop peu pour que le score bouge : le partage des points devient le scénario le plus probable (${pn} %).`
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
