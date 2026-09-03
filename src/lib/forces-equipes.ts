/**
 * La force réelle de chaque équipe d'un championnat.
 *
 * POURQUOI CE FICHIER EXISTE
 *
 * Le moteur estimait la force d'une équipe par ses buts marqués et encaissés
 * par match. Deux angles morts, tous deux mesurés :
 *
 *  1. IL IGNORAIT CONTRE QUI. Battre le dernier 3-0 y pesait autant que battre
 *     le premier. Une équipe au calendrier facile passait pour redoutable.
 *
 *  2. IL OUBLIAIT LA SAISON PRÉCÉDENTE. En août, une équipe a joué une, deux,
 *     trois rencontres ; le moteur calculait ses moyennes là-dessus. Une équipe
 *     battue 0-1 à l'ouverture était réputée ne jamais marquer. Pendant ce
 *     temps, trente-huit journées existaient sur elle, inutilisées.
 *
 * CE QUE ÇA COÛTAIT, MESURÉ
 *
 * Sur les cinq premières journées de dix championnats — 472 rencontres rejouées
 * avec les seules données d'avant-match :
 *
 *     moteur d'alors ................................ 41,9 % d'issues justes
 *     « l'équipe qui reçoit gagne » (repère bête) ... 43,2 %
 *     saison précédente comme socle ................. 53,2 %
 *
 * Le moteur faisait donc moins bien, en début de saison, que si l'on avait
 * annoncé la victoire du club recevant sans rien calculer. Il annonçait aussi
 * 1,95 but par match là où il s'en marque 2,8.
 *
 * COMMENT ON S'Y PREND
 *
 * La force d'attaque d'une équipe est le rapport entre ce qu'elle a marqué et
 * ce qu'une équipe ordinaire aurait marqué contre les MÊMES adversaires. Comme
 * la force des adversaires est elle-même inconnue au départ, on recommence le
 * calcul cinq fois : il se stabilise.
 *
 * La saison précédente fournit le socle. Ce qui se joue cette saison le corrige,
 * mais lentement — le dosage a été mesuré, pas choisi à l'oreille : à quatre
 * matchs joués, l'observation ne pèse encore qu'un cinquième.
 */

import { apiFootball, CACHE_TTL, lireReserve, ecrireReserve } from './api-football';

/** Une rencontre réduite à ce qui sert au calcul. */
export interface MatchSimple {
  domicile: number;
  exterieur: number;
  butsDomicile: number;
  butsExterieur: number;
  /**
   * Buts ATTENDUS, quand le fournisseur les donne.
   *
   * Une équipe qui tire vingt fois et marque une fois a mal fini, pas mal joué.
   * Les buts contiennent beaucoup de réussite pure, et la réussite ne se
   * reproduit pas ; la qualité des occasions créées, si.
   *
   * Absents sur les petits championnats — le fournisseur ne les calcule pas
   * partout. Le calcul retombe alors sur les buts, sans rien perdre.
   */
  xgDomicile?: number;
  xgExterieur?: number;
}

export interface ForceEquipe {
  /** 1 = attaque ordinaire du championnat. 1,4 = 40 % au-dessus. */
  attaque: number;
  /** 1 = défense ordinaire. En dessous de 1, elle encaisse moins que la moyenne. */
  defense: number;
  /** Rencontres ayant servi au calcul, socle compris. */
  matchs: number;
}

export interface ForcesLigue {
  equipes: Map<number, ForceEquipe>;
  /** Buts marqués en moyenne par l'équipe qui reçoit. */
  butsDomicile: number;
  /** Buts marqués en moyenne par l'équipe qui se déplace. */
  butsExterieur: number;
  /** Faux quand la matière est trop mince pour qu'on s'y fie. */
  fiable: boolean;
}

/** Bornes : au-delà, le calcul ne décrit plus une équipe de football. */
const FORCE_MIN = 0.35;
const FORCE_MAX = 2.6;

/**
 * Amortissement d'une équipe peu vue, à l'intérieur d'une saison.
 *
 * Une équipe vue six fois qui a marqué douze buts n'est pas une équipe à deux
 * buts par match : c'est une équipe dont on ne sait pas grand-chose. Son propre
 * bilan ne pèse qu'à hauteur de ce qu'il démontre.
 */
/**
 * ── LA SEULE CONSTANTE DU MOTEUR QUI N'A JAMAIS ÉTÉ MESURÉE ──────────────
 *
 * `LENTEUR_BASCULE` et `PART_XG` portent chacun leurs chiffres, obtenus sur des
 * milliers de rencontres. Celui-ci a été posé à la main et n'a jamais été
 * confronté à quoi que ce soit.
 *
 * Or c'est lui qui décide de la DIFFÉRENCE entre deux équipes en début de
 * saison. Avec cinq matchs joués, le poids vaut 5/(5+6) = 0,45 : une équipe
 * n'est elle-même qu'à 45 %, le reste étant la moyenne du championnat. Un grand
 * club et un promu sont donc à moitié ramenés au même point — exactement au
 * moment de l'année où ils s'affrontent le plus.
 *
 * Mesuré le 21 août 2026 : 47 % des rencontres analysées séparent les deux
 * équipes de moins d'un demi-but attendu. C'est cette compression qui produit
 * des scores identiques d'un match à l'autre.
 *
 * La surcharge par variable d'environnement n'existe QUE pour le banc d'essai.
 * En production la variable n'est pas posée, et la valeur reste celle-ci.
 *
 * ── MESURÉ LE 2 SEPTEMBRE 2026, ET RAMENÉ À ZÉRO ────────────────────────
 *
 * Sur 2 305 rencontres réelles — saison complète, huit championnats, rejouées
 * journée après journée sans jamais connaître la suite :
 *
 *     K = 6  →  2-1 dans 58,2 % des cas, 15 scores distincts, issue 50,5 %
 *     K = 4  →  2-1 dans 55,1 %,         17 scores,           issue 50,3 %
 *     K = 3  →  2-1 dans 53,4 %,         17 scores,           issue 50,2 %
 *     K = 0  →  2-1 dans 46,3 %,         20 scores,           issue 49,6 %
 *
 * Zéro est retenu : douze points de 2-1 en moins et cinq scores de plus, pour
 * neuf dixièmes de point d'issue. Un grand club affronte de nouveau un promu
 * avec l'écart qu'ils ont réellement, au lieu d'être à moitié ramenés au même
 * point.
 *
 * ── CE QUI PROTÈGE ENCORE UNE ÉQUIPE VUE DEUX FOIS ──────────────────────
 *
 * `FORCE_MIN` et `FORCE_MAX` bornent la force à 0,35–2,6, et les buts attendus
 * sont bornés séparément. Une équipe qui gagne 6-0 son premier match ne devient
 * donc pas une machine à six buts : elle plafonne.
 *
 * Le zéro devait être écrit ainsi. `Number('0') || 6` vaut SIX : la valeur
 * était silencieusement remplacée par le défaut, et K = 0 n'avait jamais pu
 * être essayé — ni ici, ni au banc.
 */
const AMORTISSEMENT_PAR_DEFAUT = 0;
const AMORTISSEMENT = (() => {
  const surcharge = Number(process.env.BANC_AMORTISSEMENT);
  return Number.isFinite(surcharge) ? surcharge : AMORTISSEMENT_PAR_DEFAUT;
})();

/**
 * Lenteur avec laquelle la saison en cours remplace le socle.
 *
 * Mesuré sur les 472 rencontres des cinq premières journées :
 *
 *     K = 4  → 51,1 %      K = 12 → 52,8 %
 *     K = 8  → 51,9 %      K = 20 → 52,8 % (et le meilleur score exact)
 *
 * Vingt a été retenu : à égalité de justesse sur l'issue, il conserve la
 * performance sur le score exact, et il laisse la saison en cours reprendre la
 * main progressivement plutôt que d'un coup.
 */
/**
 * ── VINGT ÉTAIT LA VRAIE CAUSE DES SCORES IDENTIQUES ─────────────────────
 *
 * Relevé le 2 septembre 2026, quand les championnats avaient joué TROIS
 * journées :
 *
 *     poids = 3 / (3 + 20) = 0,13
 *
 * Les dix buts du Real Madrid en trois matchs comptaient pour treize pour cent.
 * Les quatre-vingt-sept restants venaient de la saison passée. Conséquence
 * mesurée sur les forces réellement servies ce jour-là : la meilleure attaque
 * de Premier League ressortait à 1,38 fois la moyenne — quand Manchester City
 * en marque deux fois autant.
 *
 * Trois grands clubs analysés d'affilée — Barcelone, Real Madrid, Paris —
 * rendaient tous les trois « 2-1 ».
 *
 * ── POURQUOI TROIS, ET NON ZÉRO ─────────────────────────────────────────
 *
 * Sur 2 305 rencontres, banc branché sur la VRAIE fonction de score :
 *
 *     K = 6   issue 49,7 %   12 scores   2-1 dans 23 %
 *     K = 3   issue 49,5 %   13 scores   2-1 dans 20 %
 *     K = 0   issue 48,6 %   15 scores   2-1 dans 16 %
 *
 * Zéro efface complètement la saison passée. Aux première et deuxième journées,
 * c'est pourtant la SEULE chose qu'on sache d'une équipe : un club qui perd son
 * match d'ouverture deviendrait le pire du championnat. Le banc ne l'a jamais
 * mesuré — il exige cinq matchs joués avant de prédire.
 *
 * Trois garde ce garde-fou tout en rendant la saison en cours majoritaire dès
 * le troisième match : 3/(3+3) = 50 %, contre 13 % auparavant. À dix journées,
 * 77 %.
 */
const LENTEUR_BASCULE = 3;

/**
 * Part des buts attendus dans la force d'une équipe.
 *
 * Mesuré sur 2 247 rencontres, réglage et validation séparés : 0,7 l'emporte
 * sur 0,3, sur 0,5 et sur 1,0, et gagne sur les DEUX jeux. Voir le détail dans
 * `calculerForces`.
 *
 * Le reste — trois dixièmes — revient aux buts réellement marqués. Finir ses
 * occasions n'est pas seulement de la chance : certaines équipes le font
 * durablement mieux que d'autres.
 */
const PART_XG = 0.7;

/** Valeurs de repli quand un championnat n'a pas encore d'histoire. */
const BUTS_DOMICILE_DEFAUT = 1.5;
const BUTS_EXTERIEUR_DEFAUT = 1.2;

const borner = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

interface Historique {
  matchs: number;
  butsPour: number;
  butsContre: number;
  rencontres: { adversaire: number; pour: number; contre: number; aDomicile: boolean }[];
}

/**
 * Ce qu'on retient d'une rencontre : les buts, ou les buts attendus.
 *
 * `xg` bascule sur les buts attendus quand le fournisseur les donne. Sinon on
 * retombe sur les buts marqués — le calcul reste alors exactement celui qui
 * tourne aujourd'hui.
 */
function valeursDe(m: MatchSimple, source: 'buts' | 'xg'): [number, number] | null {
  if (source === 'buts') return [m.butsDomicile, m.butsExterieur];
  if (typeof m.xgDomicile === 'number' && typeof m.xgExterieur === 'number') {
    return [m.xgDomicile, m.xgExterieur];
  }
  return null;
}

function rassembler(matchs: MatchSimple[], source: 'buts' | 'xg' = 'buts'): Map<number, Historique> {
  const par = new Map<number, Historique>();
  for (const m of matchs) {
    const v = valeursDe(m, source);
    if (!v) continue;
    for (const [id, pour, contre, aDomicile, adversaire] of [
      [m.domicile, v[0], v[1], true, m.exterieur],
      [m.exterieur, v[1], v[0], false, m.domicile],
    ] as [number, number, number, boolean, number][]) {
      const h = par.get(id) ?? { matchs: 0, butsPour: 0, butsContre: 0, rencontres: [] };
      h.matchs++;
      h.butsPour += pour;
      h.butsContre += contre;
      h.rencontres.push({ adversaire, pour, contre, aDomicile });
      par.set(id, h);
    }
  }
  return par;
}

/**
 * Forces ajustées à la qualité des adversaires rencontrés.
 *
 * Le calcul se mord la queue — pour juger une attaque il faut connaître les
 * défenses affrontées, et réciproquement. On part donc de « tout le monde est
 * moyen » et on recommence cinq fois ; les valeurs se stabilisent bien avant.
 */
function forcesAjustees(
  matchs: MatchSimple[],
  source: 'buts' | 'xg' = 'buts'
): {
  forces: Map<number, { attaque: number; defense: number; matchs: number }>;
  butsDomicile: number;
  butsExterieur: number;
} {
  const utilisables = matchs.filter((m) => valeursDe(m, source) !== null);
  if (utilisables.length === 0) {
    return {
      forces: new Map(),
      butsDomicile: BUTS_DOMICILE_DEFAUT,
      butsExterieur: BUTS_EXTERIEUR_DEFAUT,
    };
  }

  const moyenne = (indice: 0 | 1) =>
    Math.max(0.4, utilisables.reduce((a, m) => a + valeursDe(m, source)![indice], 0) / utilisables.length);
  const butsDomicile = moyenne(0);
  const butsExterieur = moyenne(1);

  const historiques = rassembler(utilisables, source);
  const forces = new Map<number, { attaque: number; defense: number; matchs: number }>();
  for (const [id, h] of historiques) forces.set(id, { attaque: 1, defense: 1, matchs: h.matchs });

  for (let tour = 0; tour < 5; tour++) {
    const suivant = new Map<number, { attaque: number; defense: number; matchs: number }>();
    for (const [id, h] of historiques) {
      let marques = 0;
      let attendusEnFaceDeCesDefenses = 0;
      let encaisses = 0;
      let attendusDeCesAttaques = 0;

      for (const r of h.rencontres) {
        const adverse = forces.get(r.adversaire) ?? { attaque: 1, defense: 1, matchs: 0 };
        marques += r.pour;
        attendusEnFaceDeCesDefenses += (r.aDomicile ? butsDomicile : butsExterieur) * adverse.defense;
        encaisses += r.contre;
        attendusDeCesAttaques += (r.aDomicile ? butsExterieur : butsDomicile) * adverse.attaque;
      }

      const poids = h.matchs / (h.matchs + AMORTISSEMENT);
      suivant.set(id, {
        attaque: borner(
          poids * (attendusEnFaceDeCesDefenses > 0 ? marques / attendusEnFaceDeCesDefenses : 1) + (1 - poids),
          FORCE_MIN,
          FORCE_MAX
        ),
        defense: borner(
          poids * (attendusDeCesAttaques > 0 ? encaisses / attendusDeCesAttaques : 1) + (1 - poids),
          FORCE_MIN,
          FORCE_MAX
        ),
        matchs: h.matchs,
      });
    }
    for (const [id, v] of suivant) forces.set(id, v);
  }

  return { forces, butsDomicile, butsExterieur };
}

/**
 * Le socle de la saison passée, corrigé par ce qui se joue cette saison.
 *
 * Fonction pure : c'est elle que le banc d'essai met à l'épreuve, et c'est donc
 * exactement le calcul livré qui a été mesuré — pas une réécriture approchante.
 */
export function calculerForces(passee: MatchSimple[], courante: MatchSimple[]): ForcesLigue {
  const socle = forcesAjustees(passee, 'buts');

  // ── LES BUTS ATTENDUS CORRIGENT LES FORCES ───────────────────────────────
  //
  // Une équipe qui tire vingt fois et marque une fois a mal fini, pas mal joué.
  // Le calcul sur les seuls buts la croit faible, et se trompe sur son match
  // suivant. Les buts attendus mesurent les occasions créées — et ça, ça se
  // reproduit.
  //
  // LE DOSAGE A ÉTÉ MESURÉ, PAS CHOISI
  //
  // Sur trois championnats et trois saisons, réglage et validation séparés :
  //
  //     buts seuls (avant) ....... 50,93 %  /  50,62 %  d'issues justes
  //     100 % buts attendus ...... 52,63 %  /  51,07 %
  //     30 % buts attendus ....... 51,47 %  /  50,98 %
  //     50 % buts attendus ....... 52,54 %  /  51,07 %
  //     70 % buts attendus ....... 52,89 %  /  51,42 %   <- retenu
  //
  // Toutes les variantes gagnent sur les DEUX jeux — c'est la première fois sur
  // dix leviers essayés. Le chiffre honnête est celui de la validation : environ
  // huit dixièmes de point.
  //
  // On mélange les FORCES, pas les valeurs match par match : c'est ce qui a été
  // mesuré, et l'échelle des moyennes reste celle des buts réels, puisque c'est
  // un nombre de buts qu'on cherche à prédire.
  const socleXg = forcesAjustees(passee, 'xg');
  if (socleXg.forces.size > 0) {
    for (const [id, f] of socle.forces) {
      const x = socleXg.forces.get(id);
      // Sans buts attendus pour CETTE équipe, elle garde sa force sur les buts.
      if (!x) continue;
      socle.forces.set(id, {
        attaque: borner((1 - PART_XG) * f.attaque + PART_XG * x.attaque, FORCE_MIN, FORCE_MAX),
        defense: borner((1 - PART_XG) * f.defense + PART_XG * x.defense, FORCE_MIN, FORCE_MAX),
        matchs: f.matchs,
      });
    }
  }

  // Sans saison précédente exploitable, on se rabat sur la saison en cours
  // ajustée : c'est déjà mieux que des moyennes brutes.
  if (socle.forces.size === 0) {
    const seul = forcesAjustees(courante);
    return {
      equipes: new Map(
        [...seul.forces].map(([id, f]) => [id, { attaque: f.attaque, defense: f.defense, matchs: f.matchs }])
      ),
      butsDomicile: seul.butsDomicile,
      butsExterieur: seul.butsExterieur,
      fiable: courante.length >= 20,
    };
  }

  const enCours = rassembler(courante);
  const equipes = new Map<number, ForceEquipe>();

  const idsConnus = new Set<number>([...socle.forces.keys(), ...enCours.keys()]);
  for (const id of idsConnus) {
    const base = socle.forces.get(id) ?? { attaque: 1, defense: 1, matchs: 0 };
    const vu = enCours.get(id);
    const joues = vu?.matchs ?? 0;

    if (joues === 0) {
      equipes.set(id, { attaque: base.attaque, defense: base.defense, matchs: base.matchs });
      continue;
    }

    // Ce que cette saison montre, ramené à l'échelle du championnat.
    const observeeAttaque = vu!.butsPour / joues / socle.butsDomicile;
    const observeeDefense = vu!.butsContre / joues / socle.butsExterieur;

    const poids = joues / (joues + LENTEUR_BASCULE);
    equipes.set(id, {
      attaque: borner((1 - poids) * base.attaque + poids * observeeAttaque, FORCE_MIN, FORCE_MAX),
      defense: borner((1 - poids) * base.defense + poids * observeeDefense, FORCE_MIN, FORCE_MAX),
      matchs: base.matchs + joues,
    });
  }

  return {
    equipes,
    butsDomicile: socle.butsDomicile,
    butsExterieur: socle.butsExterieur,
    // Une poignée de rencontres ne décrit pas un championnat : en dessous, le
    // moteur garde son ancien calcul plutôt que de s'appuyer sur du vide.
    fiable: passee.length >= 50,
  };
}

const TERMINE = ['FT', 'AET', 'PEN'];

function versMatchsSimples(reponse: any[], xg?: Map<number, [number, number]>): MatchSimple[] {
  return (reponse ?? [])
    .filter((f) => TERMINE.includes(f?.fixture?.status?.short))
    .map((f) => {
      const paire = xg?.get(Number(f?.fixture?.id));
      return {
        domicile: Number(f?.teams?.home?.id),
        exterieur: Number(f?.teams?.away?.id),
        butsDomicile: Number(f?.goals?.home ?? 0),
        butsExterieur: Number(f?.goals?.away ?? 0),
        ...(paire ? { xgDomicile: paire[0], xgExterieur: paire[1] } : {}),
      };
    })
    .filter((m) => Number.isFinite(m.domicile) && Number.isFinite(m.exterieur));
}

/** Clé sous laquelle les buts attendus d'un championnat sont conservés. */
export function cleXg(ligue: number | string, saison: number | string): string {
  return `xg:${ligue}:${saison}`;
}

/**
 * Les buts attendus d'un championnat, déjà relevés et conservés.
 *
 * JAMAIS D'APPEL AU FOURNISSEUR ICI, ET C'EST TOUT LE POINT.
 *
 * Relever les buts attendus coûte UN appel par rencontre — trois cent quatre
 * vingts pour une saison. Le faire pendant qu'un abonné attend son analyse
 * dépasserait de loin la minute accordée à la page, et brûlerait le quota.
 *
 * Le relevé est donc fait à part, une fois, par `scripts/construire-xg.mjs`.
 * Ici on lit ce qui existe ; s'il n'y a rien — un petit championnat que le
 * fournisseur ne couvre pas, un socle pas encore construit — le calcul retombe
 * sur les buts marqués et reste exactement celui d'avant.
 */
async function lireXgEnReserve(
  ligue: number,
  saison: number
): Promise<Map<number, [number, number]> | undefined> {
  try {
    const enBase = await lireReserve<Record<string, [number, number]>>(cleXg(ligue, saison));
    if (!enBase?.contenu) return undefined;
    const m = new Map<number, [number, number]>();
    for (const [id, paire] of Object.entries(enBase.contenu)) {
      if (Array.isArray(paire) && paire.length === 2) m.set(Number(id), paire);
    }
    return m.size > 0 ? m : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Les forces d'un championnat, prêtes à l'emploi.
 *
 * CE QUE ÇA COÛTE
 *
 * Deux appels par championnat et par jour — la saison en cours et la
 * précédente — quel que soit le nombre d'abonnés qui analysent. Un seul appel
 * ramène les trois cent quatre-vingts rencontres d'une saison ; la réserve
 * conservée en base fait le reste, y compris après un démarrage à froid.
 *
 * Renvoie `null` plutôt qu'un calcul bancal : l'appelant garde alors son ancien
 * chemin, qui reste juste.
 */
/** Durée de vie du résultat calculé. Un championnat ne joue pas deux fois par jour. */
const TTL_FORCES = 6 * 60 * 60 * 1000;

/** Forme sérialisable : une `Map` ne survit pas à un aller-retour en JSON. */
interface ForcesEnReserve {
  equipes: [number, ForceEquipe][];
  butsDomicile: number;
  butsExterieur: number;
  fiable: boolean;
}

export async function lireForcesLigue(
  ligueId: number | string | null | undefined,
  saison: number | string | null | undefined
): Promise<ForcesLigue | null> {
  const ligue = Number(ligueId);
  const an = Number(saison);
  if (!Number.isFinite(ligue) || !Number.isFinite(an)) return null;

  // ── LE RÉSULTAT EST CONSERVÉ, PAS LA MATIÈRE PREMIÈRE ─────────────────────
  //
  // Une saison de championnat pèse 0,35 Mo chez le fournisseur ; deux saisons,
  // 0,7 Mo à relire et à réanalyser à chaque analyse lancée après un démarrage
  // à froid. Les forces calculées, elles, tiennent en quelques lignes — une
  // vingtaine d'équipes et trois nombres chacune, trente fois moins.
  const cle = `forces:${ligue}:${an}`;

  try {
    const enReserve = await lireReserve<ForcesEnReserve>(cle);
    if (enReserve && !enReserve.expiree && Array.isArray(enReserve.contenu?.equipes)) {
      return {
        equipes: new Map(enReserve.contenu.equipes),
        butsDomicile: enReserve.contenu.butsDomicile,
        butsExterieur: enReserve.contenu.butsExterieur,
        fiable: enReserve.contenu.fiable,
      };
    }
  } catch {
    // Réserve illisible : on recalcule plutôt que d'échouer.
  }

  try {
    const [courante, passee, xgPassee, xgCourante] = await Promise.all([
      apiFootball<any>(`/fixtures?league=${ligue}&season=${an}`, CACHE_TTL.STANDINGS),
      apiFootball<any>(`/fixtures?league=${ligue}&season=${an - 1}`, CACHE_TTL.TEAM_INFO),
      lireXgEnReserve(ligue, an - 1),
      lireXgEnReserve(ligue, an),
    ]);

    const forces = calculerForces(
      versMatchsSimples(passee?.response ?? [], xgPassee),
      versMatchsSimples(courante?.response ?? [], xgCourante)
    );

    if (forces.equipes.size === 0) return null;

    void ecrireReserve(
      cle,
      {
        equipes: [...forces.equipes],
        butsDomicile: forces.butsDomicile,
        butsExterieur: forces.butsExterieur,
        fiable: forces.fiable,
      } satisfies ForcesEnReserve,
      TTL_FORCES
    );

    return forces;
  } catch {
    return null;
  }
}
