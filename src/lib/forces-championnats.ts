import { apiFootball, CACHE_TTL, LEAGUE_IDS, lireReserve, ecrireReserve } from './api-football';

/**
 * LA FORCE RELATIVE DES CHAMPIONNATS.
 *
 * ── LE DÉFAUT QUE CE FICHIER RÉPARE ───────────────────────────────────────
 *
 * Le moteur note chaque équipe À L'INTÉRIEUR de son championnat : une attaque
 * vaut 1,3 parce qu'elle marque 30 % de plus que la moyenne DE SA LIGUE.
 * Confronter la note d'un club belge à celle d'un club kazakh revient donc à
 * comparer deux notes sur vingt données par deux professeurs différents.
 *
 * Constaté en production le 24 août 2026 : 57 % de réussite entre équipes du
 * même championnat, 43 % entre championnats différents. Quatorze points
 * d'écart, sur un défaut purement arithmétique.
 *
 * ── CE QUE MESURE LE COEFFICIENT ──────────────────────────────────────────
 *
 * Un multiplicateur par championnat, appris des SEULS matchs entre
 * championnats différents — coupes d'Europe. Eux seuls disent quelque chose de
 * l'échelle : un match interne ne compare que deux équipes du même vivier.
 *
 * Quand une équipe marque plus que prévu contre un adversaire étranger, son
 * championnat monte ; quand elle encaisse plus que prévu, il descend. À
 * petits pas — un match ne redessine pas la hiérarchie d'un continent.
 *
 * ── CE QUE LA MESURE A DONNÉ ──────────────────────────────────────────────
 *
 * Sur 22 443 rencontres réelles des saisons 2024 et 2025, la hiérarchie
 * apprise sans qu'on lui souffle rien :
 *
 *     Angleterre 1,50 · Italie 1,33 · Espagne 1,28 · Allemagne 1,21
 *     ...
 *     Suède 0,84 · Israël 0,82 · Finlande 0,78 · Biélorussie 0,76
 *
 * Et le gain, sur 10 157 matchs jamais vus pendant l'apprentissage :
 *
 *     Championnats différents  42,5 %  →  50,1 %   (+7,6 points)
 *     Coupes européennes       48,6 %  →  55,9 %   (+7,3 points)
 *     Même championnat         49,5 %  →  49,7 %   (inchangé, comme voulu)
 *
 * Vérifié sur les deux moitiés du jeu de test prises séparément : +10,7 points
 * sur l'une, +4,4 sur l'autre. Le gain n'est pas un accident de découpage.
 */

/**
 * Jusqu'où croire la hiérarchie apprise.
 *
 * Le coefficient est élevé à cette puissance avant usage : à 1 on lui fait
 * pleinement confiance, en dessous on le ramène vers l'égalité.
 *
 * ── POURQUOI PAS 1 ────────────────────────────────────────────────────────
 *
 * Recalculée sur deux périodes sans aucun match commun, la hiérarchie se
 * reproduit fortement au sommet — Angleterre 1,549 puis 1,495, Espagne 1,271
 * puis 1,241 — mais le milieu de tableau bouge beaucoup : les Pays-Bas
 * passent de 1,088 à 0,860. La corrélation des classements vaut 0,62 : réelle,
 * pas parfaite.
 *
 * ── POURQUOI 0,7 ET PAS AUTRE CHOSE ───────────────────────────────────────
 *
 * Parce que c'est la valeur mesurée comme la meilleure, et que le voisinage
 * est plat : 50,1 % à 0,7, contre 49,8 % à 0,85 et 49,6 % à 1. Un réglage dont
 * les voisins valent presque autant n'est pas un réglage en équilibre — c'est
 * le contraire du sur-apprentissage.
 */
const AMORTISSEMENT = 0.7;

/** Bornes du coefficient brut : aucun championnat n'est deux fois un autre. */
const COEF_MIN = 0.6;
const COEF_MAX = 1.6;

/** Vitesse d'apprentissage. Le voisinage est plat de 0,01 à 0,08. */
const VITESSE = 0.03;

/**
 * Longueur de mémoire d'une équipe, en matchs.
 *
 * Sans oubli, une rencontre d'il y a deux ans pèse autant que celle de
 * dimanche. Le poids d'un match est divisé par e au bout de ce nombre de
 * rencontres.
 *
 * Cette valeur n'est pas décorative : elle entre dans les buts attendus, donc
 * dans l'écart entre l'attendu et le survenu, donc dans le coefficient. La
 * retirer faisait diverger le calcul de production de celui qui a servi à
 * mesurer le gain — jusqu'à 0,08 sur un championnat.
 */
const MEMOIRE = 60;

/** Les compétitions qui relient les championnats entre eux. */
const COUPES = [2, 3, 848, 531];

/** Clé de réserve. La hiérarchie bouge lentement : un calcul par semaine suffit. */
const CLE = 'forces-championnats:v1';
const DUREE = 8 * 24 * 60 * 60 * 1000;

export interface ForcesChampionnats {
  /** Coefficient BRUT par identifiant de championnat, avant amortissement. */
  coefficients: Record<string, number>;
  calculeLe: string;
  matchsUtilises: number;
  /** Combien de confrontations entre championnats ont servi. */
  confrontations: number;
}

/**
 * Le coefficient prêt à l'emploi, amorti.
 *
 * Un championnat inconnu rend 1 : il ne doit ni avantager ni pénaliser. C'est
 * le comportement d'avant ce fichier, et c'est le bon quand on ne sait pas.
 */
export function coefficientDe(
  forces: ForcesChampionnats | null,
  ligue: number | string | null | undefined
): number {
  if (!forces || ligue === null || ligue === undefined) return 1;
  const brut = forces.coefficients[String(ligue)];
  if (!Number.isFinite(brut) || brut <= 0) return 1;
  return Math.pow(brut, AMORTISSEMENT);
}

/**
 * Le rapport à appliquer aux buts attendus de l'équipe 1.
 *
 * Renvoie 1 quand les deux championnats sont identiques ou inconnus : dans ce
 * cas le coefficient se simplifierait de lui-même, et l'appliquer quand même
 * ne ferait qu'ajouter du bruit d'arrondi.
 *
 * L'équipe 2 reçoit l'inverse : ce qui avantage l'une désavantage l'autre.
 */
export function rapportEntreChampionnats(
  forces: ForcesChampionnats | null,
  ligue1: number | string | null | undefined,
  ligue2: number | string | null | undefined
): number {
  if (!forces) return 1;
  if (ligue1 === null || ligue1 === undefined || ligue2 === null || ligue2 === undefined) return 1;
  if (String(ligue1) === String(ligue2)) return 1;

  // ── LES DEUX CHAMPIONNATS DOIVENT ÊTRE CONNUS, PAS UN SEUL ──────────────
  //
  // Un championnat absent de la hiérarchie vaudrait 1, c'est-à-dire « moyen ».
  // Confronter l'Angleterre à cette moyenne supposée lui accordait un avantage
  // de 1,30 contre un adversaire dont on ne sait rien.
  //
  // Or les championnats absents sont précisément ceux qu'on n'a jamais vus
  // jouer contre les autres : leur niveau n'est pas moyen, il est INCONNU.
  // Trancher dans un sens ou dans l'autre serait parier sur une ignorance.
  // On s'abstient, et le moteur se comporte comme avant ce fichier.
  const brut1 = forces.coefficients[String(ligue1)];
  const brut2 = forces.coefficients[String(ligue2)];
  if (!Number.isFinite(brut1) || !Number.isFinite(brut2)) return 1;

  const c1 = coefficientDe(forces, ligue1);
  const c2 = coefficientDe(forces, ligue2);
  if (!c2) return 1;
  return c1 / c2;
}

/** Lit la hiérarchie en réserve. Absente, tout le calcul reste celui d'avant. */
export async function lireForcesChampionnats(): Promise<ForcesChampionnats | null> {
  try {
    const r = await lireReserve<ForcesChampionnats>(CLE);
    return r?.contenu ?? null;
  } catch (e: any) {
    console.warn('[CHAMPIONNATS] Lecture impossible :', e?.message);
    return null;
  }
}

interface Rencontre {
  date: string;
  ligue: number;
  dom: number;
  ext: number;
  butsDom: number;
  butsExt: number;
}

/**
 * Recalcule la hiérarchie depuis l'historique réel, et la range en réserve.
 *
 * Appelée par la tâche quotidienne. Deux saisons suffisent : au-delà, les
 * effectifs ont trop changé pour que le championnat d'alors décrive celui
 * d'aujourd'hui.
 */
export async function recalculerForcesChampionnats(
  saisons: number[] = saisonsRecentes(),
  options: { forcer?: boolean } = {}
): Promise<ForcesChampionnats | null> {
  // ── ON NE REFAIT PAS CE QUI EST ENCORE FRAIS ────────────────────────────
  //
  // Le calcul lit près de deux cents pages chez le fournisseur et dure une
  // minute et demie. La hiérarchie d'un championnat, elle, ne bouge pas en
  // vingt-quatre heures : la refaire chaque nuit dépenserait du temps de tâche
  // quotidienne — plafonnée à cinq minutes — pour un résultat identique.
  //
  // Une semaine suffit. Le drapeau `forcer` reste là pour un recalcul à la
  // demande, après un changement de réglage.
  const FRAIS_MS = 7 * 24 * 60 * 60 * 1000;
  if (!options.forcer) {
    const existant = await lireForcesChampionnats();
    const age = existant ? Date.now() - Date.parse(existant.calculeLe) : Infinity;
    if (existant && Number.isFinite(age) && age < FRAIS_MS) {
      console.log(`[CHAMPIONNATS] Hiérarchie vieille de ${Math.round(age / 86400000)} j : conservée.`);
      return existant;
    }
  }

  const ligues = [...new Set([...Object.values(LEAGUE_IDS), ...COUPES])];
  const rencontres: Rencontre[] = [];

  // Un appel par championnat et par saison. Le fournisseur rend les trois cent
  // quatre-vingts rencontres d'une saison d'un coup.
  for (const ligue of ligues) {
    for (const saison of saisons) {
      try {
        const r = await apiFootball<any>(
          `/fixtures?league=${ligue}&season=${saison}&status=FT`,
          CACHE_TTL.TEAM_INFO
        );
        for (const f of r?.response ?? []) {
          if (f?.goals?.home === null || f?.goals?.away === null) continue;
          rencontres.push({
            date: f.fixture.date,
            ligue: f.league.id,
            dom: f.teams.home.id,
            ext: f.teams.away.id,
            butsDom: f.goals.home,
            butsExt: f.goals.away,
          });
        }
      } catch (e: any) {
        // Un championnat manquant n'annule pas les autres : la hiérarchie sera
        // simplement calculée sans lui.
        console.warn(`[CHAMPIONNATS] Ligue ${ligue} saison ${saison} illisible : ${e?.message}`);
      }
    }
  }

  if (rencontres.length < 500) {
    console.warn(`[CHAMPIONNATS] ${rencontres.length} rencontres seulement : trop peu, rien n'est enregistré.`);
    return null;
  }

  const resultat = apprendre(rencontres);

  try {
    await ecrireReserve(CLE, resultat, DUREE);
  } catch (e: any) {
    console.warn('[CHAMPIONNATS] Écriture impossible :', e?.message);
  }

  return resultat;
}

/**
 * Les saisons à considérer.
 *
 * ── POURQUOI TROIS, ET NON DEUX ───────────────────────────────────────────
 *
 * Le gain a été mesuré sur deux saisons COMPLÈTES, qui donnaient 2 030
 * confrontations entre championnats. Or la saison en cours est presque vide
 * en début d'exercice : lancé le 24 août 2026, un calcul sur « la courante et
 * la précédente » ne réunissait plus que 1 046 confrontations — la moitié.
 *
 * La hiérarchie s'en ressentait aussitôt : la Pologne ressortait à 1,296,
 * au-dessus de la France et de l'Allemagne. Ce n'est pas une opinion sur le
 * football polonais, c'est le bruit d'un échantillon trop maigre.
 *
 * Trois saisons garantissent au moins deux exercices complets à tout moment
 * de l'année, donc le volume sur lequel le gain a réellement été constaté.
 */
export function saisonsRecentes(maintenant = new Date()): number[] {
  // Une saison européenne porte le millésime de l'année où elle commence : la
  // saison 2025 va d'août 2025 à mai 2026. Avant juillet, on est donc encore
  // dans la saison de l'année précédente.
  const an = maintenant.getUTCFullYear();
  const courante = maintenant.getUTCMonth() >= 6 ? an : an - 1;
  return [courante - 2, courante - 1, courante];
}

/**
 * L'apprentissage lui-même, isolé pour être vérifiable.
 *
 * Rejoue les rencontres dans l'ordre du calendrier. Chaque match de coupe
 * compare ce qui était attendu — d'après les forces internes de chacun — à ce
 * qui est arrivé, et pousse les deux championnats en conséquence.
 */
export function apprendre(rencontres: Rencontre[]): ForcesChampionnats {
  const parDate = [...rencontres].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));

  const equipes = new Map<number, { marques: number; encaisses: number; matchs: number; ligues: Map<number, number> }>();
  const ligues = new Map<number, { butsDom: number; butsExt: number; matchs: number }>();
  const coefficients = new Map<number, number>();
  let confrontations = 0;

  const fiche = (id: number) => {
    let f = equipes.get(id);
    if (!f) { f = { marques: 0, encaisses: 0, matchs: 0, ligues: new Map() }; equipes.set(id, f); }
    return f;
  };
  const ficheLigue = (id: number) => {
    let f = ligues.get(id);
    if (!f) { f = { butsDom: 0, butsExt: 0, matchs: 0 }; ligues.set(id, f); }
    return f;
  };
  const coef = (l: number) => coefficients.get(l) ?? 1;

  /** Le championnat d'une équipe : celui où elle joue le plus, hors coupe. */
  const ligueDe = (id: number): number | null => {
    const f = equipes.get(id);
    if (!f) return null;
    let meilleure: number | null = null;
    let max = 0;
    for (const [l, n] of f.ligues) if (!COUPES.includes(l) && n > max) { max = n; meilleure = l; }
    return meilleure;
  };

  // Une force ramenée vers 1 tant que l'équipe est peu vue : sans cela, deux
  // matchs suffiraient à la déclarer invincible.
  const AMORTI_EQUIPE = 6;
  const force = (valeur: number, moyenne: number, matchs: number) => {
    if (!moyenne || !matchs) return 1;
    return 1 + (matchs / (matchs + AMORTI_EQUIPE)) * (valeur / moyenne - 1);
  };

  for (const m of parDate) {
    const lDom = ligueDe(m.dom);
    const lExt = ligueDe(m.ext);

    // ── Ce qui était attendu, avant de savoir ────────────────────────────
    if (lDom !== null && lExt !== null && lDom !== lExt) {
      const refDom = ficheLigue(lDom);
      const refExt = ficheLigue(lExt);
      const moyDom = refDom.matchs ? refDom.butsDom / refDom.matchs : 1.45;
      const moyExt = refExt.matchs ? refExt.butsExt / refExt.matchs : 1.15;
      const moyGen = (r: { butsDom: number; butsExt: number; matchs: number }) =>
        r.matchs ? (r.butsDom + r.butsExt) / (2 * r.matchs) : 1.3;

      const a = fiche(m.dom);
      const b = fiche(m.ext);
      const attDom = force(a.matchs ? a.marques / a.matchs : 0, moyGen(refDom), a.matchs);
      const defDom = force(a.matchs ? a.encaisses / a.matchs : 0, moyGen(refDom), a.matchs);
      const attExt = force(b.matchs ? b.marques / b.matchs : 0, moyGen(refExt), b.matchs);
      const defExt = force(b.matchs ? b.encaisses / b.matchs : 0, moyGen(refExt), b.matchs);

      const cD = coef(lDom);
      const cE = coef(lExt);
      const borne = (v: number) => Math.min(4, Math.max(0.25, v));
      const attenduDom = borne(attDom * cD * (defExt / cE) * moyDom);
      const attenduExt = borne(attExt * cE * (defDom / cD) * moyExt);

      // Marquer plus que prévu fait monter son championnat ; en encaisser plus
      // le fait descendre. Le demi-but ajouté évite de diviser par zéro sur un
      // 0-0 et amortit les scores extrêmes.
      const rapportDom = (m.butsDom + 0.5) / (attenduDom + 0.5);
      const rapportExt = (m.butsExt + 0.5) / (attenduExt + 0.5);
      const pas = Math.exp((VITESSE * (Math.log(rapportDom) - Math.log(rapportExt))) / 2);
      const borner = (v: number) => Math.min(COEF_MAX, Math.max(COEF_MIN, v));
      coefficients.set(lDom, borner(cD * pas));
      coefficients.set(lExt, borner(cE / pas));
      confrontations++;
    }

    // ── Puis le match nourrit l'état ─────────────────────────────────────
    const a = fiche(m.dom);
    const b = fiche(m.ext);

    // La mémoire s'efface avant d'accueillir le nouveau match : c'est ce qui
    // fait qu'une équipe est jugée sur sa forme, pas sur son passé lointain.
    const oubli = Math.exp(-1 / MEMOIRE);
    for (const f of [a, b]) {
      f.marques *= oubli; f.encaisses *= oubli; f.matchs *= oubli;
    }

    a.marques += m.butsDom; a.encaisses += m.butsExt; a.matchs++;
    b.marques += m.butsExt; b.encaisses += m.butsDom; b.matchs++;
    a.ligues.set(m.ligue, (a.ligues.get(m.ligue) ?? 0) + 1);
    b.ligues.set(m.ligue, (b.ligues.get(m.ligue) ?? 0) + 1);
    const l = ficheLigue(m.ligue);
    l.butsDom += m.butsDom; l.butsExt += m.butsExt; l.matchs++;
  }

  return {
    coefficients: Object.fromEntries([...coefficients].map(([l, c]) => [String(l), Math.round(c * 10000) / 10000])),
    calculeLe: new Date().toISOString(),
    matchsUtilises: parDate.length,
    confrontations,
  };
}
