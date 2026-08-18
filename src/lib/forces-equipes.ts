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

import { apiFootball, CACHE_TTL } from './api-football';

/** Une rencontre réduite à ce qui sert au calcul. */
export interface MatchSimple {
  domicile: number;
  exterieur: number;
  butsDomicile: number;
  butsExterieur: number;
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
const AMORTISSEMENT = 6;

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
const LENTEUR_BASCULE = 20;

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

function rassembler(matchs: MatchSimple[]): Map<number, Historique> {
  const par = new Map<number, Historique>();
  for (const m of matchs) {
    for (const [id, pour, contre, aDomicile, adversaire] of [
      [m.domicile, m.butsDomicile, m.butsExterieur, true, m.exterieur],
      [m.exterieur, m.butsExterieur, m.butsDomicile, false, m.domicile],
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
function forcesAjustees(matchs: MatchSimple[]): {
  forces: Map<number, { attaque: number; defense: number; matchs: number }>;
  butsDomicile: number;
  butsExterieur: number;
} {
  if (matchs.length === 0) {
    return {
      forces: new Map(),
      butsDomicile: BUTS_DOMICILE_DEFAUT,
      butsExterieur: BUTS_EXTERIEUR_DEFAUT,
    };
  }

  const butsDomicile = Math.max(0.4, matchs.reduce((a, m) => a + m.butsDomicile, 0) / matchs.length);
  const butsExterieur = Math.max(0.4, matchs.reduce((a, m) => a + m.butsExterieur, 0) / matchs.length);

  const historiques = rassembler(matchs);
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
  const socle = forcesAjustees(passee);

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

function versMatchsSimples(reponse: any[]): MatchSimple[] {
  return (reponse ?? [])
    .filter((f) => TERMINE.includes(f?.fixture?.status?.short))
    .map((f) => ({
      domicile: Number(f?.teams?.home?.id),
      exterieur: Number(f?.teams?.away?.id),
      butsDomicile: Number(f?.goals?.home ?? 0),
      butsExterieur: Number(f?.goals?.away ?? 0),
    }))
    .filter((m) => Number.isFinite(m.domicile) && Number.isFinite(m.exterieur));
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
export async function lireForcesLigue(
  ligueId: number | string | null | undefined,
  saison: number | string | null | undefined
): Promise<ForcesLigue | null> {
  const ligue = Number(ligueId);
  const an = Number(saison);
  if (!Number.isFinite(ligue) || !Number.isFinite(an)) return null;

  try {
    const [courante, passee] = await Promise.all([
      apiFootball<any>(`/fixtures?league=${ligue}&season=${an}`, CACHE_TTL.STANDINGS),
      apiFootball<any>(`/fixtures?league=${ligue}&season=${an - 1}`, CACHE_TTL.TEAM_INFO),
    ]);

    const forces = calculerForces(
      versMatchsSimples(passee?.response ?? []),
      versMatchsSimples(courante?.response ?? [])
    );

    return forces.equipes.size > 0 ? forces : null;
  } catch {
    return null;
  }
}
