/**
 * UNE ÉVALUATION DU CHALLENGER, DANS SON PROPRE PROCESSUS.
 *
 * ── CE QUI EST REJOUÉ ─────────────────────────────────────────────────────
 *
 * Les matchs des sept grands championnats, de la Ligue des champions et de
 * l'Europa League, entre `debut` et `fin`. Pour chacun, avec seulement ce qui
 * était connu la veille :
 *
 *   - les statistiques de la compétition du match, saison en cours, comme
 *     les lit le pré-calcul — un match sans elles est sauté, comme en
 *     production ;
 *   - le relevé des tirs, reconstruit par le VRAI calcul,
 *     `forcesDepuisRencontres`, sur les 240 jours précédents ;
 *   - le VRAI `calculerScoreProbable`.
 *
 * ── LES COUCHES ───────────────────────────────────────────────────────────
 *
 * Depuis la décision du propriétaire du 11 septembre 2026, on n'essaie plus
 * de variantes des réglages existants : on essaie des COUCHES posées
 * par-dessus le moteur.
 *
 *   erreurs-clubs  ce que le moteur a appris de ses erreurs, club par club —
 *                  n'apprend que des JOURS PRÉCÉDENTS ;
 *   marche         l'avis du marché sur qui domine — n'agit que sur les
 *                  matchs cotés, et la liste de ces matchs est rendue avec
 *                  le résultat pour qu'on la juge sur eux seuls.
 *
 * Usage : `npx tsx scripts/challenger/evaluer.mts <tâche.json>`
 */
import fs from 'node:fs';
import { chargerEnv, FICHIER_RENCONTRES, FICHIER_TIRS, FICHIER_COTES, GRANDS, COUPES_SUIVIES, TIRS_EN_PLUS, lireHierarchieDirect } from './commun.mjs';
import type { Pronostic } from './porte.js';

type Couche =
  | { type: 'erreurs-clubs'; retrecissement: number; poids: number }
  | { type: 'marche'; poids: number }
  | { type: 'elo'; k: number; poids: number }
  | { type: 'terrain'; retrecissement: number; poids: number }
  | { type: 'duel'; retrecissement: number; poids: number }
  | { type: 'elan'; court: number; long: number; poids: number }
  | { type: 'terrain-ligue'; retrecissement: number; poids: number }
  | {
      type: 'melange';
      elo?: { k: number; poids: number };
      elan?: { court: number; long: number; poids: number };
      terrainLigue?: { retrecissement: number; poids: number };
    }
  | { type: 'memoire'; k: number; poids: number }
  | { type: 'demi-vue' }
  | { type: 'tirs-elargis' }
  | { type: 'memoire-ancree'; k: number; poids: number; echelle: number }
  | { type: 'demi-vue-memoire'; echelle: number; force: number }
  | { type: 'forces-globales'; pas: number; rappel: number; minimum?: number; repartitionMemoire?: boolean }
  | { type: 'memoire-poids-variable'; echelle: number; base: number; haut: number; seuil: number }
  | { type: 'memoire-nul-variable'; echelle: number; nulEgal: number; nulEcarte: number; ecartPlein: number }
  | { type: 'memoire-terrain-ligue'; echelle: number; parPoint: number }
  | { type: 'memoire-releve-mince'; echelle: number; seuil: number; partMax: number };

chargerEnv();
const tache: {
  debut: string;
  fin: string;
  variantes: { nom: string; env: Record<string, string>; couche?: Couche }[];
  /**
   * ── LE BANC ÉLARGI, AJOUTÉ LE 12 SEPTEMBRE 2026 ──────────────────────
   *
   * Par défaut (champ absent), le rejeu porte sur les 7 grands
   * championnats + C1 + C3 : le périmètre du produit, celui de l'épreuve
   * officielle, INCHANGÉ.
   *
   * `'cotes'` rejoue À LA PLACE toutes les rencontres COTÉES, quelle que
   * soit la compétition. La couche du marché n'agit que sur celles-là, et
   * le périmètre étroit n'en compte que 188 contre 1 035 au total : la
   * porte refusait faute de matchs, pas faute de résultats.
   *
   * `'tout'` rejoue TOUTES les compétitions rangées — 62 au 12 septembre
   * 2026, 18 977 rencontres. C'est le seul périmètre où les couches qui
   * soignent les clubs HORS grands championnats (demi-vue, mémoire) ont
   * assez de matchs pour être jugées : dans le périmètre du produit, la
   * demi-vue n'en concerne que 132.
   */
  univers?: 'suivies' | 'cotes' | 'tout';
  sortie: string;
} = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

// Chargés APRÈS l'environnement : les réglages du relevé sont lus à l'import.
const { calculerScoreProbable } = await import('../../src/lib/score-probable.js');
const { forcesDepuisRencontres, butsAttendusOccasions } = await import('../../src/lib/forme-occasions.js');
const { apprendreErreurs, correctionPour } = await import('../../src/lib/couche-erreurs.js');
const { butsAttendusDuMarche } = await import('../../src/lib/couche-marche.js');
const { lireForcesChampionnats, coefficientDe } = await import('../../src/lib/forces-championnats.js');
// La hierarchie MESUREE des championnats : 57 competitions, 34 101 matchs,
// recalculee le 12 septembre 2026. C'est elle qui dira ce que vaut un club
// azerbaidjanais face a un anglais, au lieu de le laisser deviner par les
// rares matchs entre pays.
// La lecture normale abandonne au bout d'une seconde et demie et rend `null`
// sans bruit : une mesure entière a été faussée ainsi le 12 septembre 2026.
// Ici on lit directement, avec dix secondes.
const hierarchie = await lireHierarchieDirect();
if (!hierarchie)
  console.warn('[EVALUER] hiérarchie des championnats ILLISIBLE : toute couche ancrée serait sans ancrage.');

const rencontres: any[] = JSON.parse(fs.readFileSync(FICHIER_RENCONTRES, 'utf8'));
rencontres.sort((a, b) => a.date.localeCompare(b.date));
const tirs: any[] = JSON.parse(fs.readFileSync(FICHIER_TIRS, 'utf8'));
const cotes: Record<string, { dom: number; nul: number; ext: number }> = fs.existsSync(FICHIER_COTES)
  ? JSON.parse(fs.readFileSync(FICHIER_COTES, 'utf8'))
  : {};
const quand = (x: any) => Date.parse(x.date);

// ── LE RELEVÉ, TEL QU'IL AURAIT ÉTÉ LA VEILLE ──────────────────────────────
// ── LE RELEVÉ DE RÉFÉRENCE, ET UN RELEVÉ D'ESSAI ─────────────────────────
//
// Les quatre championnats ajoutés le 12 septembre 2026 (Roumanie, Serbie,
// Irlande, Finlande) sont EN PRODUCTION depuis le commit 5819d10 : le relevé
// de référence doit donc les inclure, sinon le moteur de référence serait
// plus faible que le vrai et toute couche paraîtrait meilleure qu'elle n'est.
//
// `construireReleve(jour, false)` reste là pour la prochaine vague : le jour
// où d'autres championnats seront candidats, il suffira de les déclarer dans
// `TIRS_EN_PLUS` et de les juger par la couche `tirs-elargis` avant de les
// mettre en ligne.
const NOMS_EN_PLUS = new Set(Object.values(TIRS_EN_PLUS));
const releves = new Map<string, any>();
const relevesElargis = new Map<string, any>();
function construireReleve(jour: string, avecLesQuatre: boolean) {
  const fin = Date.parse(`${jour}T00:00:00Z`);
  // Une copie : le calcul trie sur place.
  const liste = tirs
    .filter((t) => t.date >= fin - 240 * 86_400_000 && t.date < fin)
    .filter((t) => avecLesQuatre || !NOMS_EN_PLUS.has(String(t.ligue)))
    .map((t) => ({ ...t }));
  // Comme en production : rien sous cent rencontres.
  return liste.length >= 100 ? forcesDepuisRencontres(liste as any, undefined, new Date(fin).toISOString()) : null;
}
function releveLaVeille(jour: string) {
  if (releves.has(jour)) return releves.get(jour);
  // `false` : le relevé de référence ne connaît QUE ce que la production
  // connaît. `TIRS_EN_PLUS` porte la vague SUIVANTE, à l essai — la quatrième
  // (Roumanie, Serbie, Irlande, Finlande) est passée dans CHAMPIONNATS le
  // 12 septembre 2026, la cinquième (2. Bundesliga, CAN, Russie, Biélorussie)
  // attend son verdict.
  const r = construireReleve(jour, false);
  releves.set(jour, r);
  return r;
}
function releveElargiLaVeille(jour: string) {
  if (relevesElargis.has(jour)) return relevesElargis.get(jour);
  const r = construireReleve(jour, true);
  relevesElargis.set(jour, r);
  return r;
}

// ── LES STATISTIQUES DE LA COMPÉTITION, AVANT LE MATCH ─────────────────────
const parEquipe = new Map<number, any[]>();
for (const m of rencontres)
  for (const e of [m.dom, m.ext]) {
    if (!parEquipe.has(e)) parEquipe.set(e, []);
    parEquipe.get(e)!.push(m);
  }
function statsAvant(equipe: number, m: any) {
  let bm = 0, be = 0, n = 0;
  for (const x of parEquipe.get(equipe) ?? []) {
    if (x.ligue !== m.ligue || x.saison !== m.saison || quand(x) >= quand(m)) continue;
    n++;
    if (x.dom === equipe) { bm += x.bd; be += x.be; } else { bm += x.be; be += x.bd; }
  }
  return { butsMarques: bm, butsEncaisses: be, matchsJoues: n };
}

// ── LA LISTE DES MATCHS, LA MÊME POUR TOUS LES ESSAIS ──────────────────────
const suivies = new Set([...Object.keys(GRANDS), ...Object.keys(COUPES_SUIVIES)].map(Number));
const entrees: { m: any; s1: any; s2: any; occ: any; jour: string }[] = [];
const surCotes = tache.univers === 'cotes';
const toutesCompetitions = tache.univers === 'tout';
for (const m of rencontres) {
  const retenue = surCotes ? cotes[String(m.id)] !== undefined : toutesCompetitions ? true : suivies.has(Number(m.ligue));
  if (!retenue || m.date < tache.debut || m.date >= tache.fin) continue;
  const s1 = statsAvant(m.dom, m);
  const s2 = statsAvant(m.ext, m);
  if (s1.matchsJoues < 1 || s2.matchsJoues < 1) continue;
  const jour = m.date.slice(0, 10);
  entrees.push({ m, s1, s2, occ: butsAttendusOccasions(releveLaVeille(jour), m.nomDom, m.nomExt), jour });
}

const versPronostic = (m: any, r: any): Pronostic => {
  const p = [Number(r.probaVictoire1), Number(r.probaNul), Number(r.probaVictoire2)];
  const somme = p[0] + p[1] + p[2] || 1;
  return {
    id: Number(m.id),
    date: String(m.date),
    ligue: Number(m.ligue),
    reel: m.bd > m.be ? 0 : m.bd === m.be ? 1 : 2,
    parScore: r.buts1 > r.buts2 ? 0 : r.buts1 === r.buts2 ? 1 : 2,
    probas: [p[0] / somme, p[1] / somme, p[2] / somme],
  };
};

// ── LES BUTS ATTENDUS DU MOTEUR ACTUEL, DONT LA COUCHE DES ERREURS APPREND ──
let attendus: Map<number, { a1: number; a2: number }> | null = null;
function baseAttendus() {
  if (attendus) return attendus;
  attendus = new Map();
  for (const { m, s1, s2, occ } of entrees) {
    const r: any = calculerScoreProbable(s1, s2, true, false, undefined, null, undefined, false, 1, occ);
    attendus.set(Number(m.id), { a1: Number(r.butsAttendus1), a2: Number(r.butsAttendus2) });
  }
  return attendus;
}

// ── LA COUCHE DES ERREURS, REJOUÉE JOUR APRÈS JOUR ────────────────────────
function avecErreurs(retrecissement: number, poids: number): Pronostic[] {
  const base = baseAttendus();
  const out: Pronostic[] = [];
  const passes: any[] = [];
  let jourCourant = '';
  let clubs = apprendreErreurs([]);
  for (const { m, s1, s2, occ, jour } of entrees) {
    if (jour !== jourCourant) {
      // La leçon ne contient que les matchs des jours précédents.
      clubs = apprendreErreurs(passes);
      jourCourant = jour;
    }
    const corr = correctionPour(clubs, String(m.dom), String(m.ext), { retrecissement, poids });
    const r: any = calculerScoreProbable(s1, s2, true, false, undefined, null, undefined, false, 1, occ, corr, avisDeLaProduction(m));
    out.push(versPronostic(m, r));
    const a = base.get(Number(m.id))!;
    passes.push({ dom: String(m.dom), ext: String(m.ext), attenduDom: a.a1, attenduExt: a.a2, reelDom: m.bd, reelExt: m.be });
  }
  return out;
}

// ── LA COUCHE DU MARCHÉ, SUR LES MATCHS COTÉS ─────────────────────────────
function avecMarche(poids: number): { pronostics: Pronostic[]; actifs: number[] } {
  const pronostics: Pronostic[] = [];
  const actifs: number[] = [];
  for (const { m, s1, s2, occ } of entrees) {
    const c = cotes[String(m.id)];
    const marche = c ? { ...c, poids } : null;
    if (marche) actifs.push(Number(m.id));
    const r: any = calculerScoreProbable(s1, s2, true, false, undefined, null, undefined, false, 1, occ, null, marche);
    pronostics.push(versPronostic(m, r));
  }
  return { pronostics, actifs };
}

// ── LA COUCHE ELO : UNE NOTE PAR CLUB, BÂTIE SUR TOUS SES MATCHS ─────────────
//
// Chaque club part de 1 500. Chaque match déplace les deux notes selon le
// résultat, l'écart de buts et ce qui était attendu. Toutes les compétitions
// suivies comptent, coupes d'Europe comprises : c'est par elles que le niveau
// d'un championnat se transmet à un autre. Le match du jour ne connaît que
// les notes de la veille.
//
// La note se traduit en avis sur qui domine — mêmes probabilités que le
// marché, nul fixé à 26 % — et passe par le même point d'entrée : le moteur
// garde son total de buts et en ajuste la répartition.
const AVANTAGE_TERRAIN_ELO = 65;
const NUL_ELO = 0.26;
const toutesLesRencontres = [...rencontres].sort((a, b) => a.date.localeCompare(b.date));
function avecElo(k: number, poids: number): Pronostic[] {
  const note = new Map<number, number>();
  const lire = (id: number) => note.get(id) ?? 1500;
  const attendu = (dom: number, ext: number) => 1 / (1 + Math.pow(10, -(lire(dom) + AVANTAGE_TERRAIN_ELO - lire(ext)) / 400));
  const apprendre = (x: any) => {
    const we = attendu(x.dom, x.ext);
    const w = x.bd > x.be ? 1 : x.bd === x.be ? 0.5 : 0;
    const n = Math.abs(x.bd - x.be);
    const g = n <= 1 ? 1 : n === 2 ? 1.5 : (11 + n) / 8;
    const delta = k * g * (w - we);
    note.set(x.dom, lire(x.dom) + delta);
    note.set(x.ext, lire(x.ext) - delta);
  };
  const out: Pronostic[] = [];
  let j = 0;
  let jourCourant = '';
  for (const { m, s1, s2, occ, jour } of entrees) {
    if (jour !== jourCourant) {
      // Tous les matchs des jours PRÉCÉDENTS, et rien d'autre.
      while (j < toutesLesRencontres.length && toutesLesRencontres[j].date.slice(0, 10) < jour) apprendre(toutesLesRencontres[j++]);
      jourCourant = jour;
    }
    const we = attendu(m.dom, m.ext);
    const avis = { dom: (1 - NUL_ELO) * we, nul: NUL_ELO, ext: (1 - NUL_ELO) * (1 - we), poids };
    const r: any = calculerScoreProbable(s1, s2, true, false, undefined, null, undefined, false, 1, occ, null, avis);
    out.push(versPronostic(m, r));
  }
  return out;
}

// ── LA COUCHE DU TERRAIN, PROPRE À CHAQUE CLUB ───────────────────────────
//
// Le moteur applique un avantage du terrain UNIQUE pour tous. Or certains
// clubs sont transformés chez eux et s'effondrent au loin. On mesure, pour
// chaque club, l'écart entre ce qu'il fait chez lui et ce qu'il fait
// dehors, puis on en retire ce que TOUT club gagne à recevoir : ce qui
// reste est sa spécialité propre, en buts par match.
//
// Un club n'est jugé qu'à partir de quatre matchs de chaque côté, et sa
// spécialité est ramenée vers zéro par n/(n+retrecissement). Elle entre
// par le point d'entrée des corrections additives, plafonné à un demi-but
// par le moteur lui-même. Comme pour Elo, le match du jour ne connaît que
// les matchs des jours précédents.
const MIN_COTES_TERRAIN = 4;
function avecTerrain(retrecissement: number, poids: number): Pronostic[] {
  type Cotes = { nD: number; dD: number; nE: number; dE: number };
  const par = new Map<number, Cotes>();
  let nTotal = 0;
  let diffTotale = 0;
  const cotes = (id: number) => {
    let c = par.get(id);
    if (!c) { c = { nD: 0, dD: 0, nE: 0, dE: 0 }; par.set(id, c); }
    return c;
  };
  const apprendre = (x: any) => {
    const d = cotes(x.dom); d.nD++; d.dD += x.bd - x.be;
    const e = cotes(x.ext); e.nE++; e.dE += x.be - x.bd;
    nTotal++; diffTotale += x.bd - x.be;
  };
  const specialite = (id: number) => {
    const c = par.get(id);
    if (!c || c.nD < MIN_COTES_TERRAIN || c.nE < MIN_COTES_TERRAIN) return 0;
    const moyen = nTotal ? diffTotale / nTotal : 0;
    const ecart = c.dD / c.nD - c.dE / c.nE - 2 * moyen;
    const n = Math.min(c.nD, c.nE);
    return ((n / (n + retrecissement)) * ecart) / 2;
  };
  const out: Pronostic[] = [];
  let j = 0;
  let jourCourant = '';
  for (const { m, s1, s2, occ, jour } of entrees) {
    if (jour !== jourCourant) {
      while (j < toutesLesRencontres.length && toutesLesRencontres[j].date.slice(0, 10) < jour) apprendre(toutesLesRencontres[j++]);
      jourCourant = jour;
    }
    const d = (poids * (specialite(m.dom) + specialite(m.ext))) / 2;
    const corr = d === 0 ? null : { domicile: d / 2, exterieur: -d / 2 };
    const r: any = calculerScoreProbable(s1, s2, true, false, undefined, null, undefined, false, 1, occ, corr, avisDeLaProduction(m));
    out.push(versPronostic(m, r));
  }
  return out;
}

// ── LA COUCHE DES CONFRONTATIONS DIRECTES ────────────────────────────────
//
// Certaines équipes ne se valent pas entre elles : l'une gêne l'autre
// match après match, quel que soit son niveau général. On ne garde QUE
// cette part-là : pour chaque duel passé, l'écart de buts réel moins
// l'écart que le moteur d'aujourd'hui attendrait, avantage du terrain
// retiré. La moyenne de ces surprises, ramenée vers zéro par
// n/(n+retrecissement), entre par les corrections additives.
//
// Toutes compétitions confondues, deux saisons, et seulement les duels
// joués AVANT le jour du match.
const TERRAIN_MOYEN_DUEL = 0.3;
function avecDuel(retrecissement: number, poids: number): Pronostic[] {
  const base = baseAttendus();
  const vus = new Map<string, { n: number; somme: number }>();
  const cle = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const apprendre = (x: any) => {
    const a = base.get(Number(x.id));
    // Sans attente du moteur pour ce duel, on ne sait pas ce qui est une
    // surprise : on le laisse de côté.
    if (!a) return;
    const petit = Math.min(x.dom, x.ext);
    const reel = x.bd - x.be - TERRAIN_MOYEN_DUEL;
    const attendu = a.a1 - a.a2 - TERRAIN_MOYEN_DUEL;
    const surprise = reel - attendu;
    const k = cle(x.dom, x.ext);
    let v = vus.get(k);
    if (!v) { v = { n: 0, somme: 0 }; vus.set(k, v); }
    v.n++;
    // Toujours du point de vue du club au plus petit numéro.
    v.somme += x.dom === petit ? surprise : -surprise;
  };
  const out: Pronostic[] = [];
  let j = 0;
  let jourCourant = '';
  for (const { m, s1, s2, occ, jour } of entrees) {
    if (jour !== jourCourant) {
      while (j < toutesLesRencontres.length && toutesLesRencontres[j].date.slice(0, 10) < jour) apprendre(toutesLesRencontres[j++]);
      jourCourant = jour;
    }
    const v = vus.get(cle(m.dom, m.ext));
    let d = 0;
    if (v && v.n > 0) {
      const moyenne = v.somme / v.n;
      const vu = Math.min(m.dom, m.ext) === m.dom ? moyenne : -moyenne;
      d = poids * (v.n / (v.n + retrecissement)) * vu;
    }
    const corr = d === 0 ? null : { domicile: d / 2, exterieur: -d / 2 };
    const r: any = calculerScoreProbable(s1, s2, true, false, undefined, null, undefined, false, 1, occ, corr, avisDeLaProduction(m));
    out.push(versPronostic(m, r));
  }
  return out;
}

// ── LA COUCHE DE L'ÉLAN : CE QU'UN CLUB FAIT EN CE MOMENT ────────────────
//
// Le relevé des tirs pèse la forme sur huit rencontres environ, avec une
// décroissance douce : excellent pour le fond, lent à voir une équipe qui
// vient de changer de visage. On mesure donc, pour chaque club, l'écart
// entre ce qu'il produit sur ses TOUTES DERNIÈRES rencontres et sa moyenne
// longue — et la même chose pour ce qu'il concède.
//
// Les occasions sont comptées aux valeurs mesurées du projet : un tir cadré
// vaut 0,325 but, un tir dans la surface 0,170. La couche comparant un club
// à LUI-MÊME, l'échelle ne change que le dosage.
//
// Seules les rencontres des jours PRÉCÉDENTS comptent, et un club sans
// assez de matchs ne pèse rien.
const BUT_PAR_CADRE = 0.325;
const BUT_PAR_SURFACE = 0.17;
type PasseElan = { produit: number; concede: number };
const elanParClub = new Map<string, PasseElan[]>();
{
  const ajouter = (club: string, p: PasseElan) => {
    const l = elanParClub.get(club);
    if (l) l.push(p);
    else elanParClub.set(club, [p]);
  };
  // `tirs` est déjà rangé par date dans le fichier ; on s'en assure.
  for (const t of [...tirs].sort((a, b) => a.date - b.date)) {
    const od = BUT_PAR_CADRE * Number(t.cadresD) + BUT_PAR_SURFACE * Number(t.surfaceD);
    const oe = BUT_PAR_CADRE * Number(t.cadresE) + BUT_PAR_SURFACE * Number(t.surfaceE);
    if (!Number.isFinite(od) || !Number.isFinite(oe)) continue;
    ajouter(String(t.dom), { produit: od, concede: oe });
    ajouter(String(t.ext), { produit: oe, concede: od });
  }
}
function avecElan(court: number, long: number, poids: number): Pronostic[] {
  // Jusqu'où chaque club a déjà joué, à mesure que les jours avancent.
  const vues = new Map<string, number>();
  const dates = new Map<string, number[]>();
  for (const t of [...tirs].sort((a, b) => a.date - b.date))
    for (const club of [String(t.dom), String(t.ext)]) {
      const l = dates.get(club);
      if (l) l.push(t.date);
      else dates.set(club, [t.date]);
    }
  const moyenne = (l: number[]) => (l.length ? l.reduce((x, y) => x + y, 0) / l.length : 0);
  const ecart = (club: string, veille: number) => {
    const passe = elanParClub.get(club);
    const quand = dates.get(club);
    if (!passe || !quand) return null;
    let n = vues.get(club) ?? 0;
    while (n < quand.length && quand[n] < veille) n++;
    vues.set(club, n);
    if (n < long) return null;
    const recents = passe.slice(n - court, n);
    const longs = passe.slice(n - long, n);
    return {
      attaque: moyenne(recents.map((x) => x.produit)) - moyenne(longs.map((x) => x.produit)),
      defense: moyenne(recents.map((x) => x.concede)) - moyenne(longs.map((x) => x.concede)),
    };
  };
  const out: Pronostic[] = [];
  for (const { m, s1, s2, occ, jour } of entrees) {
    const veille = Date.parse(`${jour}T00:00:00Z`);
    const a = ecart(String(m.nomDom), veille);
    const b = ecart(String(m.nomExt), veille);
    let corr: { domicile: number; exterieur: number } | null = null;
    if (a || b) {
      const dom = (poids * ((a?.attaque ?? 0) + (b?.defense ?? 0))) / 2;
      const ext = (poids * ((b?.attaque ?? 0) + (a?.defense ?? 0))) / 2;
      if (dom !== 0 || ext !== 0) corr = { domicile: dom, exterieur: ext };
    }
    const r: any = calculerScoreProbable(s1, s2, true, false, undefined, null, undefined, false, 1, occ, corr, avisDeLaProduction(m));
    out.push(versPronostic(m, r));
  }
  return out;
}

// ── LA COUCHE DU TERRAIN PAR CHAMPIONNAT ─────────────────────────────────
//
// Le moteur applique le MÊME avantage du terrain partout : 1,15 à domicile,
// 0,92 dehors, de la Premier League à la Primeira Liga. Or recevoir ne vaut
// pas la même chose dans chaque championnat : les deux que nos abonnés
// suivent le plus — Premier League et Ligue 1 — sont justement nos deux plus
// faibles quand le moteur se prononce (54 et 58 % contre 73 % en Serie A).
//
// On mesure donc, championnat par championnat, l'écart de buts moyen du club
// qui reçoit, et on le compare à la moyenne de TOUS les championnats. Un
// championnat n'est jugé qu'à partir de cinquante rencontres, et son écart
// est ramené vers zéro par n/(n+retrecissement) : un championnat mal connu
// ne bouge rien.
//
// À la différence de la couche du terrain PAR CLUB (mesurée et refusée le
// 12 septembre), la quantité est ici grossière donc bien estimée : des
// centaines de rencontres par championnat au lieu de quelques-unes par club.
// Seules les rencontres des jours PRÉCÉDENTS comptent.
const MIN_RENCONTRES_LIGUE = 50;
function avecTerrainLigue(retrecissement: number, poids: number): Pronostic[] {
  const par = new Map<number, { n: number; somme: number }>();
  let nTotal = 0;
  let sommeTotale = 0;
  const apprendre = (x: any) => {
    const ligue = Number(x.ligue);
    let c = par.get(ligue);
    if (!c) { c = { n: 0, somme: 0 }; par.set(ligue, c); }
    c.n++;
    c.somme += x.bd - x.be;
    nTotal++;
    sommeTotale += x.bd - x.be;
  };
  const ecartDeLigue = (ligue: number) => {
    const c = par.get(Number(ligue));
    if (!c || c.n < MIN_RENCONTRES_LIGUE || nTotal === 0) return 0;
    const partout = sommeTotale / nTotal;
    return (c.n / (c.n + retrecissement)) * (c.somme / c.n - partout);
  };
  const out: Pronostic[] = [];
  let j = 0;
  let jourCourant = '';
  for (const { m, s1, s2, occ, jour } of entrees) {
    if (jour !== jourCourant) {
      while (j < toutesLesRencontres.length && toutesLesRencontres[j].date.slice(0, 10) < jour) apprendre(toutesLesRencontres[j++]);
      jourCourant = jour;
    }
    const d = poids * ecartDeLigue(Number(m.ligue));
    const corr = d === 0 ? null : { domicile: d / 2, exterieur: -d / 2 };
    const r: any = calculerScoreProbable(s1, s2, true, false, undefined, null, undefined, false, 1, occ, corr, avisDeLaProduction(m));
    out.push(versPronostic(m, r));
  }
  return out;
}

// ── LE MÉLANGE : PLUSIEURS COUCHES POSÉES ENSEMBLE ───────────────────────
//
// Chaque couche, seule, gagne un ou deux matchs — trop peu pour passer la
// porte. Mais elles ne regardent pas la même chose : Elo mesure le niveau
// de fond sur deux saisons, l'élan ce que le club produit en ce moment, le
// terrain par championnat le poids de recevoir là où le match se joue.
//
// Le moteur a deux points d'entrée libres, et ils ne se gênent pas : les
// corrections additives (élan + terrain, plafonnées à un demi-but par le
// moteur lui-même) et l'avis extérieur sur qui domine (Elo), qui garde le
// total de buts du moteur. On peut donc tout poser ensemble sans toucher à
// un seul réglage.
//
// Les trois morceaux n'apprennent que des jours PRÉCÉDENTS, comme dans leurs
// couches respectives.
function avecMelange(couche: {
  elo?: { k: number; poids: number };
  elan?: { court: number; long: number; poids: number };
  terrainLigue?: { retrecissement: number; poids: number };
}): Pronostic[] {
  // Elo : une note par club.
  const note = new Map<number, number>();
  const lireNote = (id: number) => note.get(id) ?? 1500;
  const attendu = (dom: number, ext: number) =>
    1 / (1 + Math.pow(10, -(lireNote(dom) + AVANTAGE_TERRAIN_ELO - lireNote(ext)) / 400));
  // Terrain par championnat : écart de buts du club qui reçoit.
  const parLigue = new Map<number, { n: number; somme: number }>();
  let nLigues = 0;
  let sommeLigues = 0;
  const apprendre = (x: any) => {
    if (couche.elo) {
      const we = attendu(x.dom, x.ext);
      const w = x.bd > x.be ? 1 : x.bd === x.be ? 0.5 : 0;
      const e = Math.abs(x.bd - x.be);
      const g = e <= 1 ? 1 : e === 2 ? 1.5 : (11 + e) / 8;
      const delta = couche.elo.k * g * (w - we);
      note.set(x.dom, lireNote(x.dom) + delta);
      note.set(x.ext, lireNote(x.ext) - delta);
    }
    const ligue = Number(x.ligue);
    let c = parLigue.get(ligue);
    if (!c) { c = { n: 0, somme: 0 }; parLigue.set(ligue, c); }
    c.n++;
    c.somme += x.bd - x.be;
    nLigues++;
    sommeLigues += x.bd - x.be;
  };
  const ecartDeLigue = (ligue: number) => {
    const t = couche.terrainLigue;
    const c = parLigue.get(Number(ligue));
    if (!t || !c || c.n < MIN_RENCONTRES_LIGUE || nLigues === 0) return 0;
    return t.poids * (c.n / (c.n + t.retrecissement)) * (c.somme / c.n - sommeLigues / nLigues);
  };
  // Élan : les occasions des dernières rencontres contre la moyenne longue.
  const dates = new Map<string, number[]>();
  if (couche.elan)
    for (const t of [...tirs].sort((a, b) => a.date - b.date))
      for (const club of [String(t.dom), String(t.ext)]) {
        const l = dates.get(club);
        if (l) l.push(t.date);
        else dates.set(club, [t.date]);
      }
  const vues = new Map<string, number>();
  const moyenne = (l: number[]) => (l.length ? l.reduce((x, y) => x + y, 0) / l.length : 0);
  const ecartDelan = (club: string, veille: number) => {
    const e = couche.elan;
    const passe = elanParClub.get(club);
    const quand = dates.get(club);
    if (!e || !passe || !quand) return null;
    let n = vues.get(club) ?? 0;
    while (n < quand.length && quand[n] < veille) n++;
    vues.set(club, n);
    if (n < e.long) return null;
    const recents = passe.slice(n - e.court, n);
    const longs = passe.slice(n - e.long, n);
    return {
      attaque: moyenne(recents.map((x) => x.produit)) - moyenne(longs.map((x) => x.produit)),
      defense: moyenne(recents.map((x) => x.concede)) - moyenne(longs.map((x) => x.concede)),
    };
  };
  const out: Pronostic[] = [];
  let j = 0;
  let jourCourant = '';
  for (const { m, s1, s2, occ, jour } of entrees) {
    if (jour !== jourCourant) {
      while (j < toutesLesRencontres.length && toutesLesRencontres[j].date.slice(0, 10) < jour) apprendre(toutesLesRencontres[j++]);
      jourCourant = jour;
    }
    const veille = Date.parse(`${jour}T00:00:00Z`);
    // Les deux corrections additives s'ajoutent ; le moteur les plafonne.
    const a = ecartDelan(String(m.nomDom), veille);
    const b = ecartDelan(String(m.nomExt), veille);
    const part = couche.elan?.poids ?? 0;
    const ligue = ecartDeLigue(Number(m.ligue));
    const dom = (part * ((a?.attaque ?? 0) + (b?.defense ?? 0))) / 2 + ligue / 2;
    const ext = (part * ((b?.attaque ?? 0) + (a?.defense ?? 0))) / 2 - ligue / 2;
    const corr = dom === 0 && ext === 0 ? null : { domicile: dom, exterieur: ext };
    // Et l'avis d'Elo sur qui domine, par l'autre point d'entrée.
    let avis: { dom: number; nul: number; ext: number; poids: number } | null = null;
    if (couche.elo) {
      const we = attendu(m.dom, m.ext);
      avis = { dom: (1 - NUL_ELO) * we, nul: NUL_ELO, ext: (1 - NUL_ELO) * (1 - we), poids: couche.elo.poids };
    }
    const r: any = calculerScoreProbable(s1, s2, true, false, undefined, null, undefined, false, 1, occ, corr, avis ?? avisDeLaProduction(m));
    out.push(versPronostic(m, r));
  }
  return out;
}

// ── LA MÉMOIRE DE TOUS LES CLUBS, LÀ OÙ LE MOTEUR EST AVEUGLE ────────────
//
// Le relevé des tirs ne couvre que les sept grands championnats. Dès qu'un
// club en sort — Sabah, Qarabağ, Ararat-Armenia, un tour préliminaire, un
// promu sans fiches — `butsAttendusOccasions` rend « rien » et le moteur
// perd d'un coup TOUTE la moitié occasions de son calcul, sans le dire.
// Mesuré le 12 septembre 2026 : 50 % des matchs de Ligue des champions,
// 41 % de l'Europa League, 14 à 25 % des grands championnats. C'est
// l'erreur Manchester United 0-3 Sabah, annoncée 66 % pour Sabah.
//
// La mémoire, elle, connaît TOUS les clubs : une note bâtie sur les 18 977
// rencontres des 62 compétitions rangées, coupes comprises, veille
// seulement. Elle n'entre QUE sur les matchs aveugles — ailleurs le moteur
// voit mieux qu'elle, c'est mesuré (couche Elo refusée). La liste des
// matchs où elle agit est rendue avec le résultat, pour qu'on la juge sur
// ceux-là seulement.
function avecMemoire(k: number, poids: number): { pronostics: Pronostic[]; actifs: number[] } {
  const note = new Map<number, number>();
  const lire = (id: number) => note.get(id) ?? 1500;
  const attendu = (dom: number, ext: number) =>
    1 / (1 + Math.pow(10, -(lire(dom) + AVANTAGE_TERRAIN_ELO - lire(ext)) / 400));
  const apprendre = (x: any) => {
    const we = attendu(x.dom, x.ext);
    const w = x.bd > x.be ? 1 : x.bd === x.be ? 0.5 : 0;
    const e = Math.abs(x.bd - x.be);
    const g = e <= 1 ? 1 : e === 2 ? 1.5 : (11 + e) / 8;
    const delta = k * g * (w - we);
    note.set(x.dom, lire(x.dom) + delta);
    note.set(x.ext, lire(x.ext) - delta);
  };
  const pronostics: Pronostic[] = [];
  const actifs: number[] = [];
  let j = 0;
  let jourCourant = '';
  for (const { m, s1, s2, occ, jour } of entrees) {
    if (jour !== jourCourant) {
      while (j < toutesLesRencontres.length && toutesLesRencontres[j].date.slice(0, 10) < jour) apprendre(toutesLesRencontres[j++]);
      jourCourant = jour;
    }
    // Le moteur voit-il ce match ? S'il voit, la mémoire se tait.
    const aveugle = !occ;
    let avis: { dom: number; nul: number; ext: number; poids: number } | null = null;
    if (aveugle) {
      actifs.push(Number(m.id));
      const we = attendu(m.dom, m.ext);
      avis = { dom: (1 - NUL_ELO) * we, nul: NUL_ELO, ext: (1 - NUL_ELO) * (1 - we), poids };
    }
    const r: any = calculerScoreProbable(s1, s2, true, false, undefined, null, undefined, false, 1, occ, null, avis);
    pronostics.push(versPronostic(m, r));
  }
  return { pronostics, actifs };
}

// ── LA DEMI-VUE : NE PLUS JETER CE QU'ON SAIT DU CLUB CONNU ──────────────
//
// `butsAttendusOccasions` exige les DEUX clubs dans le relevé des tirs. Si
// un seul manque — Sabah, Qarabağ, un promu sans fiches —, il rend « rien »
// et le moteur jette TOUTE la moitié occasions, y compris ce qu'il sait
// parfaitement du club connu. C'est ainsi que Manchester United, dont le
// relevé savait tout, a été annoncé perdant 66 % contre Sabah le
// 10 septembre 2026, pour finir 4-0.
//
// La formule du relevé est : attaque de l'un contre défense de l'autre,
// rapportées à l'étalon de la rencontre. En traitant le club inconnu comme
// un club MOYEN (attaque = défense = étalon), tout se simplifie :
//
//   buts du club qui reçoit  = (attaque du connu, ou défense du connu s'il
//                               est à l'extérieur) × avantage du terrain
//
// La demi-vue n'agit QUE sur ces matchs-là : deux clubs connus, le moteur
// garde exactement son calcul ; deux clubs inconnus, elle n'a rien à dire.
// L'estimation est donnée ENTIÈRE : c'est le moteur qui la mélange à son
// propre calcul, au poids des occasions déjà réglé (0,6). La doser ici
// n'aurait pas de sens — rapprocher les deux buts attendus de zéro ne
// rapproche pas de l'aveuglement, cela change le total du match.
function avecDemiVue(): { pronostics: Pronostic[]; actifs: number[] } {
  const pronostics: Pronostic[] = [];
  const actifs: number[] = [];
  for (const { m, s1, s2, occ, jour } of entrees) {
    let vue = occ;
    if (!occ) {
      const releve: any = releveLaVeille(jour);
      const d = releve?.clubs?.[m.nomDom];
      const e = releve?.clubs?.[m.nomExt];
      // Exactement un club connu : c'est là que le moteur jetait tout.
      if (releve && !!d !== !!e) {
        const connu: any = d ?? e;
        const avDom = Number(releve.avantageDomicile);
        const avExt = Number(releve.avantageExterieur);
        const attaque = Number(connu.attaque);
        const defense = Number(connu.defense);
        if ([avDom, avExt, attaque, defense].every((x) => Number.isFinite(x) && x > 0)) {
          const domicile = (d ? attaque : defense) * avDom;
          const exterieur = (e ? attaque : defense) * avExt;
          if (domicile > 0 && exterieur > 0) {
            vue = { domicile, exterieur } as any;
            actifs.push(Number(m.id));
          }
        }
      }
    }
    const r: any = calculerScoreProbable(s1, s2, true, false, undefined, null, undefined, false, 1, vue, null, vue ? null : avisDeLaProduction(m));
    pronostics.push(versPronostic(m, r));
  }
  return { pronostics, actifs };
}

// ── LA MÉMOIRE ANCRÉE SUR LA HIÉRARCHIE DES CHAMPIONNATS ─────────────────
//
// ── CE QUI N'ALLAIT PAS ─────────────────────────────────────────────────
//
// La mémoire de type Elo gonfle pour le champion d'un championnat faible :
// Sabah 1796 contre Manchester United 1668 le 10 septembre 2026, parce que
// Sabah gagne tout chez lui et que les matchs entre pays sont trop rares pour
// corriger. Branchée, elle annonçait Sabah vainqueur : retirée le jour même.
//
// ── CE QU'ON FAIT À LA PLACE ────────────────────────────────────────────
//
// On garde la note pour comparer deux clubs du MÊME championnat — là elle est
// juste —, mais on ne la laisse plus décider du niveau d'un pays. Chaque note
// est recentrée sur la moyenne de son championnat, puis ANCRÉE au niveau
// mesuré de ce championnat :
//
//   note ancrée = note − moyenne du championnat + echelle × ln(coefficient)
//
// Le coefficient vient de `forces-championnats` : 1,600 pour la Premier
// League, 0,69 pour les plus faibles, 1 pour un championnat inconnu — qui se
// retrouve donc au milieu, et non au sommet.
//
// Le championnat d'un club est celui où on l'a le plus vu, coupes exclues :
// une coupe d'Europe n'est le championnat de personne.
const COUPES_POUR_ANCRAGE = new Set([2, 3, 848]);
const ligueDuClub = new Map<number, number>();
{
  const vus = new Map<number, Map<number, number>>();
  for (const m of rencontres) {
    const ligue = Number(m.ligue);
    if (COUPES_POUR_ANCRAGE.has(ligue)) continue;
    for (const club of [Number(m.dom), Number(m.ext)]) {
      let c = vus.get(club);
      if (!c) { c = new Map(); vus.set(club, c); }
      c.set(ligue, (c.get(ligue) ?? 0) + 1);
    }
  }
  for (const [club, c] of vus) {
    let meilleure = 0;
    let combien = -1;
    for (const [ligue, n] of c) if (n > combien) { meilleure = ligue; combien = n; }
    ligueDuClub.set(club, meilleure);
  }
}
function avecMemoireAncree(k: number, poids: number, echelle: number): { pronostics: Pronostic[]; actifs: number[] } {
  const note = new Map<number, number>();
  const joues = new Map<number, number>();
  // Somme des notes par championnat, tenue à jour à chaque match : elle donne
  // la moyenne du championnat à l'instant du match, sans tout reparcourir.
  const somme = new Map<number, number>();
  const combien = new Map<number, number>();
  const lire = (id: number) => note.get(id) ?? 1500;
  const poser = (id: number, valeur: number) => {
    const ligue = ligueDuClub.get(id) ?? 0;
    const avant = note.has(id) ? note.get(id)! : null;
    if (avant === null) {
      somme.set(ligue, (somme.get(ligue) ?? 0) + valeur);
      combien.set(ligue, (combien.get(ligue) ?? 0) + 1);
    } else {
      somme.set(ligue, (somme.get(ligue) ?? 0) + (valeur - avant));
    }
    note.set(id, valeur);
  };
  const ancre = (ligue: number) => echelle * Math.log(coefficientDe(hierarchie as any, ligue) || 1);
  const ancree = (id: number) => {
    const ligue = ligueDuClub.get(id) ?? 0;
    const n = combien.get(ligue) ?? 0;
    const moyenne = n > 0 ? (somme.get(ligue) ?? 0) / n : 1500;
    return lire(id) - moyenne + 1500 + ancre(ligue);
  };
  const attendu = (dom: number, ext: number) =>
    1 / (1 + Math.pow(10, -(ancree(dom) + AVANTAGE_TERRAIN_ELO - ancree(ext)) / 400));
  const apprendre = (x: any) => {
    // L'apprentissage se fait sur les notes BRUTES : l'ancrage ne sert qu'à
    // comparer deux clubs, pas à réécrire leur histoire.
    const brutDom = lire(x.dom);
    const brutExt = lire(x.ext);
    const prevu = 1 / (1 + Math.pow(10, -(brutDom + AVANTAGE_TERRAIN_ELO - brutExt) / 400));
    const w = x.bd > x.be ? 1 : x.bd === x.be ? 0.5 : 0;
    const e = Math.abs(x.bd - x.be);
    const g = e <= 1 ? 1 : e === 2 ? 1.5 : (11 + e) / 8;
    const delta = k * g * (w - prevu);
    poser(x.dom, brutDom + delta);
    poser(x.ext, brutExt - delta);
    joues.set(x.dom, (joues.get(x.dom) ?? 0) + 1);
    joues.set(x.ext, (joues.get(x.ext) ?? 0) + 1);
  };
  const pronostics: Pronostic[] = [];
  const actifs: number[] = [];
  let j = 0;
  let jourCourant = '';
  for (const { m, s1, s2, occ, jour } of entrees) {
    if (jour !== jourCourant) {
      while (j < toutesLesRencontres.length && toutesLesRencontres[j].date.slice(0, 10) < jour) apprendre(toutesLesRencontres[j++]);
      jourCourant = jour;
    }
    let avis: { dom: number; nul: number; ext: number; poids: number } | null = null;
    if (!occ && (joues.get(m.dom) ?? 0) >= 5 && (joues.get(m.ext) ?? 0) >= 5) {
      actifs.push(Number(m.id));
      const we = attendu(m.dom, m.ext);
      avis = { dom: (1 - NUL_ELO) * we, nul: NUL_ELO, ext: (1 - NUL_ELO) * (1 - we), poids };
    }
    const r: any = calculerScoreProbable(s1, s2, true, false, undefined, null, undefined, false, 1, occ, null, avis);
    pronostics.push(versPronostic(m, r));
  }
  return { pronostics, actifs };
}

// ── LE RELEVÉ ÉLARGI : QUATRE CHAMPIONNATS DE PLUS ───────────────────────
//
// Roumanie, Serbie, Irlande, Finlande. Ce sont les SEULS pays, parmi ceux qui
// privent le plus de matchs de coupe d'Europe de leurs tirs, dont le
// fournisseur tient des statistiques. Leurs clubs reviennent sans cesse dans
// les tours préliminaires : Universitatea Craiova, l'Étoile Rouge, Shamrock
// Rovers, KuPS.
//
// La couche rejoue avec le relevé élargi. Les matchs qu'elle ÉCLAIRE — ceux
// que la production ne voyait pas et qu'elle voit — sont rendus comme liste
// active, pour qu'on la juge là où elle agit.
function avecTirsElargis(): { pronostics: Pronostic[]; actifs: number[] } {
  const pronostics: Pronostic[] = [];
  const actifs: number[] = [];
  for (const { m, s1, s2, occ, jour } of entrees) {
    const vue = butsAttendusOccasions(releveElargiLaVeille(jour), m.nomDom, m.nomExt);
    if (!occ && vue) actifs.push(Number(m.id));
    const r: any = calculerScoreProbable(
      s1,
      s2,
      true,
      false,
      undefined,
      null,
      undefined,
      false,
      1,
      vue,
      null,
      vue ? null : avisDeLaProduction(m)
    );
    pronostics.push(versPronostic(m, r));
  }
  return { pronostics, actifs };
}

// ── CE QUE LA PRODUCTION FAIT DEPUIS LE 12 SEPTEMBRE 2026 ────────────────
//
// La mémoire des clubs ANCRÉE est en ligne (commit 5819d10) : là où les
// occasions manquent, le moteur reprend son avis sur qui domine, à 60 %. Le
// moteur de référence du challenger doit donc l'inclure, sinon on comparerait
// les couches à un moteur qui n'existe plus — et une couche qui ne fait que
// retrouver ce que la production sait déjà paraîtrait gagnante.
//
// Même calcul que `src/lib/memoire-clubs.ts` : note de type Elo recentrée sur
// la moyenne de son championnat, puis ancrée au niveau MESURÉ de ce
// championnat. Sans hiérarchie lisible, la production se tait : ici aussi.
//
// Chaque couche additive l'inclut également : elle est mesurée COMME UN AJOUT
// à la production. Les couches qui se servent elles-mêmes de l'avis extérieur
// — Elo, mémoire à un autre dosage, marché — le remplacent : c'est leur sujet.
const K_PRODUCTION = 30;
const PART_PRODUCTION = 0.6;
const ECHELLE_PRODUCTION = 400;
const SEUIL_PRODUCTION = 5;
const avisProduction = new Map<number, { dom: number; nul: number; ext: number; poids: number }>();
if (hierarchie) {
  const note = new Map<number, number>();
  const joues = new Map<number, number>();
  const somme = new Map<number, number>();
  const combien = new Map<number, number>();
  const lire = (id: number) => note.get(id) ?? 1500;
  const poser = (id: number, valeur: number) => {
    const ligue = ligueDuClub.get(id) ?? 0;
    const avant = note.has(id) ? note.get(id)! : null;
    if (avant === null) {
      somme.set(ligue, (somme.get(ligue) ?? 0) + valeur);
      combien.set(ligue, (combien.get(ligue) ?? 0) + 1);
    } else {
      somme.set(ligue, (somme.get(ligue) ?? 0) + (valeur - avant));
    }
    note.set(id, valeur);
  };
  const ancre = (ligue: number) => ECHELLE_PRODUCTION * Math.log(coefficientDe(hierarchie as any, ligue) || 1);
  const ancree = (id: number) => {
    const ligue = ligueDuClub.get(id) ?? 0;
    const n = combien.get(ligue) ?? 0;
    const moyenne = n > 0 ? (somme.get(ligue) ?? 0) / n : 1500;
    return lire(id) - moyenne + 1500 + ancre(ligue);
  };
  const apprendre = (x: any) => {
    const brutDom = lire(x.dom);
    const brutExt = lire(x.ext);
    const prevu = 1 / (1 + Math.pow(10, -(brutDom + AVANTAGE_TERRAIN_ELO - brutExt) / 400));
    const w = x.bd > x.be ? 1 : x.bd === x.be ? 0.5 : 0;
    const e = Math.abs(x.bd - x.be);
    const g = e <= 1 ? 1 : e === 2 ? 1.5 : (11 + e) / 8;
    const delta = K_PRODUCTION * g * (w - prevu);
    poser(x.dom, brutDom + delta);
    poser(x.ext, brutExt - delta);
    joues.set(x.dom, (joues.get(x.dom) ?? 0) + 1);
    joues.set(x.ext, (joues.get(x.ext) ?? 0) + 1);
  };
  let j = 0;
  let jourCourant = '';
  for (const { m, s1, s2, occ, jour } of entrees) {
    if (jour !== jourCourant) {
      while (j < toutesLesRencontres.length && toutesLesRencontres[j].date.slice(0, 10) < jour) apprendre(toutesLesRencontres[j++]);
      jourCourant = jour;
    }
    // Mêmes conditions que `avisDeLaMemoire` : occasions absentes, et cinq
    // rencontres au moins pour chacun des deux clubs.
    if (occ) continue;
    if ((joues.get(m.dom) ?? 0) < 5 || (joues.get(m.ext) ?? 0) < 5) continue;
    const we = 1 / (1 + Math.pow(10, -(ancree(m.dom) + AVANTAGE_TERRAIN_ELO - ancree(m.ext)) / 400));
    // La part suit ce que le moteur sait du match, comme en production depuis
    // le 12 septembre 2026 : pleine sous cinq matchs connus.
    const su = Math.min(Number(s1?.matchsJoues ?? 0), Number(s2?.matchsJoues ?? 0));
    const part = su >= SEUIL_PRODUCTION ? PART_PRODUCTION : 1 - ((1 - PART_PRODUCTION) * su) / SEUIL_PRODUCTION;
    avisProduction.set(Number(m.id), {
      dom: (1 - NUL_ELO) * we,
      nul: NUL_ELO,
      ext: (1 - NUL_ELO) * (1 - we),
      poids: part,
    });
  }
}
const avisDeLaProduction = (m: any) => avisProduction.get(Number(m.id)) ?? null;

// ── LA DEMI-VUE ANCRÉE : LE CLUB INCONNU N'EST PLUS SUPPOSÉ MOYEN ─────────
//
// ── CE QUI PRÉCÈDE ──────────────────────────────────────────────────────
//
// `butsAttendusOccasions` exige les DEUX clubs. Un seul manque, et le moteur
// jette toute la moitié occasions — y compris ce qu'il sait parfaitement du
// club connu. La première demi-vue (12 septembre 2026) comblait le trou en
// traitant l'inconnu comme un club MOYEN : refusée à trois matchs près.
//
// ── CE QU'ON AJOUTE ─────────────────────────────────────────────────────
//
// La mémoire ancrée sait ce que vaut l'inconnu : sa note, recentrée sur son
// championnat puis ancrée au niveau mesuré de ce championnat. On en tire un
// niveau d'occasions au lieu de le supposer moyen :
//
//   force = exp((note ancrée − 1500) / ÉCHELLE DE FORCE)
//   attaque de l'inconnu  = étalon × force
//   défense de l'inconnu  = étalon ÷ force
//
// puis la VRAIE formule du relevé : attaque de l'un contre défense de
// l'autre, rapportées à l'étalon, et l'avantage du terrain mesuré.
//
// N'agit que sur les matchs à un seul club connu. Ailleurs, rien ne change :
// deux clubs connus, le moteur garde son calcul ; deux inconnus, la mémoire
// de la production parle déjà.
function avecDemiVueMemoire(echelle: number, echelleForce: number): { pronostics: Pronostic[]; actifs: number[] } {
  const note = new Map<number, number>();
  const joues = new Map<number, number>();
  const somme = new Map<number, number>();
  const combien = new Map<number, number>();
  const lire = (id: number) => note.get(id) ?? 1500;
  const poser = (id: number, valeur: number) => {
    const ligue = ligueDuClub.get(id) ?? 0;
    const avant = note.has(id) ? note.get(id)! : null;
    if (avant === null) {
      somme.set(ligue, (somme.get(ligue) ?? 0) + valeur);
      combien.set(ligue, (combien.get(ligue) ?? 0) + 1);
    } else {
      somme.set(ligue, (somme.get(ligue) ?? 0) + (valeur - avant));
    }
    note.set(id, valeur);
  };
  const ancrage = (ligue: number) => echelle * Math.log(coefficientDe(hierarchie as any, ligue) || 1);
  const ancree = (id: number) => {
    const ligue = ligueDuClub.get(id) ?? 0;
    const n = combien.get(ligue) ?? 0;
    const moyenne = n > 0 ? (somme.get(ligue) ?? 0) / n : 1500;
    return lire(id) - moyenne + 1500 + ancrage(ligue);
  };
  const apprendre = (x: any) => {
    const brutDom = lire(x.dom);
    const brutExt = lire(x.ext);
    const prevu = 1 / (1 + Math.pow(10, -(brutDom + AVANTAGE_TERRAIN_ELO - brutExt) / 400));
    const w = x.bd > x.be ? 1 : x.bd === x.be ? 0.5 : 0;
    const e = Math.abs(x.bd - x.be);
    const g = e <= 1 ? 1 : e === 2 ? 1.5 : (11 + e) / 8;
    const delta = 30 * g * (w - prevu);
    poser(x.dom, brutDom + delta);
    poser(x.ext, brutExt - delta);
    joues.set(x.dom, (joues.get(x.dom) ?? 0) + 1);
    joues.set(x.ext, (joues.get(x.ext) ?? 0) + 1);
  };
  const pronostics: Pronostic[] = [];
  const actifs: number[] = [];
  let j = 0;
  let jourCourant = '';
  for (const { m, s1, s2, occ, jour } of entrees) {
    if (jour !== jourCourant) {
      while (j < toutesLesRencontres.length && toutesLesRencontres[j].date.slice(0, 10) < jour) apprendre(toutesLesRencontres[j++]);
      jourCourant = jour;
    }
    let vue = occ;
    if (!occ) {
      const releve: any = releveLaVeille(jour);
      const d = releve?.clubs?.[m.nomDom];
      const e = releve?.clubs?.[m.nomExt];
      // Exactement un club connu du relevé des tirs, et la mémoire connaît
      // l'autre assez pour en parler.
      const inconnu = d ? Number(m.ext) : Number(m.dom);
      if (releve && !!d !== !!e && (joues.get(inconnu) ?? 0) >= 5) {
        const connu: any = d ?? e;
        const ligueConnue = String(connu.ligue);
        const etalon = Number(releve.moyennesParLigue?.[ligueConnue] ?? releve.moyenne);
        const avDom = Number(releve.avantageDomicile);
        const avExt = Number(releve.avantageExterieur);
        const force = Math.exp((ancree(inconnu) - 1500) / echelleForce);
        if ([etalon, avDom, avExt, force].every((x) => Number.isFinite(x) && x > 0)) {
          const attInconnu = etalon * force;
          const defInconnu = etalon / force;
          const attDom = d ? Number(connu.attaque) : attInconnu;
          const defDom = d ? Number(connu.defense) : defInconnu;
          const attExt = e ? Number(connu.attaque) : attInconnu;
          const defExt = e ? Number(connu.defense) : defInconnu;
          const domicile = etalon * (attDom / etalon) * (defExt / etalon) * avDom;
          const exterieur = etalon * (attExt / etalon) * (defDom / etalon) * avExt;
          if (domicile > 0 && exterieur > 0 && Number.isFinite(domicile) && Number.isFinite(exterieur)) {
            vue = { domicile, exterieur } as any;
            actifs.push(Number(m.id));
          }
        }
      }
    }
    const r: any = calculerScoreProbable(
      s1,
      s2,
      true,
      false,
      undefined,
      null,
      undefined,
      false,
      1,
      vue,
      null,
      vue ? null : avisDeLaProduction(m)
    );
    pronostics.push(versPronostic(m, r));
  }
  return { pronostics, actifs };
}

// ── UNE ATTAQUE ET UNE DÉFENSE POUR CHAQUE CLUB D'EUROPE ─────────────────
//
// ── CE QUI MANQUE ENCORE ────────────────────────────────────────────────
//
// La mémoire des clubs (en production) donne UN nombre par club : qui domine.
// Elle ne dit pas combien de buts. Sur les matchs sans tirs — 57 % de toutes
// compétitions confondues — le moteur n'a donc que les moyennes de buts de la
// compétition pour bâtir son total.
//
// ── CE QU'ON AJOUTE ─────────────────────────────────────────────────────
//
// Deux nombres par club, appris BUT PAR BUT sur les 18 982 rencontres rangées :
// une attaque et une défense, en logarithme de buts. Après chaque match, on
// corrige ce qui a été mal prévu, exactement comme un apprentissage en ligne
// de modèle de Poisson :
//
//   buts attendus du club qui reçoit = exp(mu + attaque(dom) − défense(ext) + terrain)
//   attaque(dom) += pas × (buts réels − buts attendus)
//   défense(ext) −= pas × (buts réels − buts attendus)
//
// `mu` est le niveau de buts du championnat du match, tenu à jour lui aussi ;
// `rappel` ramène doucement chaque club vers la moyenne, pour qu'un club vu
// trois fois ne prenne pas des valeurs extrêmes.
//
// Le résultat entre par la MÊME porte que le relevé des tirs — les buts
// attendus de la rencontre — et uniquement là où ce relevé est muet. Le moteur
// le mélange alors à son propre calcul au poids déjà réglé (0,6).
const TERRAIN_GLOBAL = 0.25;
// `minimum` : combien de matchs un club doit avoir été vu. `repartitionMemoire` :
// garder le TOTAL de buts de ce modèle, mais reprendre de la mémoire ancrée
// l'avis sur QUI domine — les deux pièces déjà validées, chacune à ce qu'elle
// fait de mieux.
function avecForcesGlobales(
  pas: number,
  rappel: number,
  minimum = 8,
  repartitionMemoire = false
): { pronostics: Pronostic[]; actifs: number[] } {
  const attaque = new Map<number, number>();
  const defense = new Map<number, number>();
  const joues = new Map<number, number>();
  // Niveau de buts par championnat : moyenne courante, par équipe et par match.
  const niveau = new Map<number, { somme: number; n: number }>();
  const att = (id: number) => attaque.get(id) ?? 0;
  const def = (id: number) => defense.get(id) ?? 0;
  const mu = (ligue: number) => {
    const x = niveau.get(Number(ligue));
    const moyenne = x && x.n >= 20 ? x.somme / x.n : 1.35;
    return Math.log(Math.max(0.5, Math.min(2.5, moyenne)));
  };
  const attendus = (ligue: number, dom: number, ext: number) => {
    const base = mu(ligue);
    return {
      domicile: Math.exp(base + att(dom) - def(ext) + TERRAIN_GLOBAL),
      exterieur: Math.exp(base + att(ext) - def(dom)),
    };
  };
  const apprendre = (x: any) => {
    const ligue = Number(x.ligue);
    const bd = Number(x.bd);
    const be = Number(x.be);
    if (!Number.isFinite(bd) || !Number.isFinite(be)) return;
    const p = attendus(ligue, x.dom, x.ext);
    // Ce qui a été mal prévu, dans un sens puis dans l'autre.
    const ecartDom = bd - p.domicile;
    const ecartExt = be - p.exterieur;
    attaque.set(x.dom, (att(x.dom) + pas * ecartDom) * (1 - rappel));
    defense.set(x.ext, (def(x.ext) - pas * ecartDom) * (1 - rappel));
    attaque.set(x.ext, (att(x.ext) + pas * ecartExt) * (1 - rappel));
    defense.set(x.dom, (def(x.dom) - pas * ecartExt) * (1 - rappel));
    joues.set(x.dom, (joues.get(x.dom) ?? 0) + 1);
    joues.set(x.ext, (joues.get(x.ext) ?? 0) + 1);
    const n = niveau.get(ligue) ?? { somme: 0, n: 0 };
    n.somme += (bd + be) / 2;
    n.n++;
    niveau.set(ligue, n);
  };
  const pronostics: Pronostic[] = [];
  const actifs: number[] = [];
  let j = 0;
  let jourCourant = '';
  for (const { m, s1, s2, occ, jour } of entrees) {
    if (jour !== jourCourant) {
      while (j < toutesLesRencontres.length && toutesLesRencontres[j].date.slice(0, 10) < jour) apprendre(toutesLesRencontres[j++]);
      jourCourant = jour;
    }
    let vue = occ;
    // Uniquement là où le relevé des tirs est muet, et seulement si les deux
    // clubs ont été vus assez souvent pour que leurs deux nombres veuillent
    // dire quelque chose.
    if (!occ && (joues.get(m.dom) ?? 0) >= minimum && (joues.get(m.ext) ?? 0) >= minimum) {
      const p = attendus(Number(m.ligue), Number(m.dom), Number(m.ext));
      if (
        Number.isFinite(p.domicile) &&
        Number.isFinite(p.exterieur) &&
        p.domicile > 0.05 &&
        p.exterieur > 0.05 &&
        p.domicile < 6 &&
        p.exterieur < 6
      ) {
        // Le total de ce modèle, la répartition de la mémoire : `butsAttendusDuMarche`
        // sait répartir un total selon un avis 1N2 (voir `couche-marche.ts`).
        const avis = repartitionMemoire ? avisDeLaProduction(m) : null;
        const lu = avis ? butsAttendusDuMarche(avis, p.domicile + p.exterieur) : null;
        vue = (lu ? { domicile: lu.dom, exterieur: lu.ext } : p) as any;
        actifs.push(Number(m.id));
      }
    }
    const r: any = calculerScoreProbable(
      s1,
      s2,
      true,
      false,
      undefined,
      null,
      undefined,
      false,
      1,
      vue,
      null,
      vue === occ ? avisDeLaProduction(m) : null
    );
    pronostics.push(versPronostic(m, r));
  }
  return { pronostics, actifs };
}

// ── LA MÉMOIRE PÈSE PLUS QUAND LE MOTEUR SAIT MOINS ──────────────────────
//
// La mémoire entre à part FIXE (0,6) sur tous les matchs aveugles. Or le
// moteur n'est pas également démuni : sur Manchester United — Sabah du
// 10 septembre 2026, United n'avait joué AUCUN match dans la compétition, et
// ses moyennes venaient donc d'un complément. Sur un match de championnat de
// milieu de saison, le moteur a vingt matchs par club : la mémoire n'a pas à
// peser autant.
//
// Ici la part suit ce que le moteur sait : `haut` quand les deux clubs ont
// moins de `seuil` matchs dans la compétition, `base` au-delà, en dégradé
// entre les deux. Rien d'autre ne change — la mémoire reste muette là où les
// tirs parlent.
function avecMemoirePoidsVariable(
  echelle: number,
  base: number,
  haut: number,
  seuil: number
): { pronostics: Pronostic[]; actifs: number[] } {
  const note = new Map<number, number>();
  const joues = new Map<number, number>();
  const somme = new Map<number, number>();
  const combien = new Map<number, number>();
  const lire = (id: number) => note.get(id) ?? 1500;
  const poser = (id: number, valeur: number) => {
    const ligue = ligueDuClub.get(id) ?? 0;
    const avant = note.has(id) ? note.get(id)! : null;
    if (avant === null) {
      somme.set(ligue, (somme.get(ligue) ?? 0) + valeur);
      combien.set(ligue, (combien.get(ligue) ?? 0) + 1);
    } else {
      somme.set(ligue, (somme.get(ligue) ?? 0) + (valeur - avant));
    }
    note.set(id, valeur);
  };
  const ancrage = (ligue: number) => echelle * Math.log(coefficientDe(hierarchie as any, ligue) || 1);
  const ancree = (id: number) => {
    const ligue = ligueDuClub.get(id) ?? 0;
    const n = combien.get(ligue) ?? 0;
    const moyenne = n > 0 ? (somme.get(ligue) ?? 0) / n : 1500;
    return lire(id) - moyenne + 1500 + ancrage(ligue);
  };
  const apprendre = (x: any) => {
    const brutDom = lire(x.dom);
    const brutExt = lire(x.ext);
    const prevu = 1 / (1 + Math.pow(10, -(brutDom + AVANTAGE_TERRAIN_ELO - brutExt) / 400));
    const w = x.bd > x.be ? 1 : x.bd === x.be ? 0.5 : 0;
    const e = Math.abs(x.bd - x.be);
    const g = e <= 1 ? 1 : e === 2 ? 1.5 : (11 + e) / 8;
    const delta = 30 * g * (w - prevu);
    poser(x.dom, brutDom + delta);
    poser(x.ext, brutExt - delta);
    joues.set(x.dom, (joues.get(x.dom) ?? 0) + 1);
    joues.set(x.ext, (joues.get(x.ext) ?? 0) + 1);
  };
  const pronostics: Pronostic[] = [];
  const actifs: number[] = [];
  let j = 0;
  let jourCourant = '';
  for (const { m, s1, s2, occ, jour } of entrees) {
    if (jour !== jourCourant) {
      while (j < toutesLesRencontres.length && toutesLesRencontres[j].date.slice(0, 10) < jour) apprendre(toutesLesRencontres[j++]);
      jourCourant = jour;
    }
    let avis: { dom: number; nul: number; ext: number; poids: number } | null = null;
    if (!occ && (joues.get(m.dom) ?? 0) >= 5 && (joues.get(m.ext) ?? 0) >= 5) {
      // Ce que le moteur sait de CE match : les matchs joués dans la
      // compétition, pour le moins renseigné des deux clubs.
      const su = Math.min(Number(s1?.matchsJoues ?? 0), Number(s2?.matchsJoues ?? 0));
      const part = su >= seuil ? base : haut - ((haut - base) * su) / Math.max(1, seuil);
      const we = 1 / (1 + Math.pow(10, -(ancree(m.dom) + AVANTAGE_TERRAIN_ELO - ancree(m.ext)) / 400));
      avis = { dom: (1 - NUL_ELO) * we, nul: NUL_ELO, ext: (1 - NUL_ELO) * (1 - we), poids: Math.min(1, Math.max(0, part)) };
      actifs.push(Number(m.id));
    }
    const r: any = calculerScoreProbable(s1, s2, true, false, undefined, null, undefined, false, 1, occ, null, avis);
    pronostics.push(versPronostic(m, r));
  }
  return { pronostics, actifs };
}

// ── LE NUL N'EST PAS LE MÊME DANS UN MATCH ÉQUILIBRÉ ET DANS UN ÉCRASEMENT ─
//
// La mémoire fixe le nul à 26 % partout : c'est la moyenne mesurée sur toutes
// les rencontres (26,0 % annoncés pour 25,7 % réels). Mais un match entre deux
// clubs de même niveau produit bien plus de nuls qu'un match où l'un écrase
// l'autre — et c'est justement sur les matchs aveugles, souvent très
// déséquilibrés (un grand club contre un champion d'un petit pays), que la
// mémoire parle.
//
// Ici la part du nul descend avec l'écart de notes : `nulEgal` à notes égales,
// `nulEcarte` quand l'écart atteint `ecartPlein` points, en dégradé entre les
// deux. Le reste est réparti comme avant.
function avecMemoireNulVariable(
  echelle: number,
  nulEgal: number,
  nulEcarte: number,
  ecartPlein: number
): { pronostics: Pronostic[]; actifs: number[] } {
  const note = new Map<number, number>();
  const joues = new Map<number, number>();
  const somme = new Map<number, number>();
  const combien = new Map<number, number>();
  const lire = (id: number) => note.get(id) ?? 1500;
  const poser = (id: number, valeur: number) => {
    const ligue = ligueDuClub.get(id) ?? 0;
    const avant = note.has(id) ? note.get(id)! : null;
    if (avant === null) {
      somme.set(ligue, (somme.get(ligue) ?? 0) + valeur);
      combien.set(ligue, (combien.get(ligue) ?? 0) + 1);
    } else {
      somme.set(ligue, (somme.get(ligue) ?? 0) + (valeur - avant));
    }
    note.set(id, valeur);
  };
  const ancrage = (ligue: number) => echelle * Math.log(coefficientDe(hierarchie as any, ligue) || 1);
  const ancree = (id: number) => {
    const ligue = ligueDuClub.get(id) ?? 0;
    const n = combien.get(ligue) ?? 0;
    const moyenne = n > 0 ? (somme.get(ligue) ?? 0) / n : 1500;
    return lire(id) - moyenne + 1500 + ancrage(ligue);
  };
  const apprendre = (x: any) => {
    const brutDom = lire(x.dom);
    const brutExt = lire(x.ext);
    const prevu = 1 / (1 + Math.pow(10, -(brutDom + AVANTAGE_TERRAIN_ELO - brutExt) / 400));
    const w = x.bd > x.be ? 1 : x.bd === x.be ? 0.5 : 0;
    const e = Math.abs(x.bd - x.be);
    const g = e <= 1 ? 1 : e === 2 ? 1.5 : (11 + e) / 8;
    const delta = 30 * g * (w - prevu);
    poser(x.dom, brutDom + delta);
    poser(x.ext, brutExt - delta);
    joues.set(x.dom, (joues.get(x.dom) ?? 0) + 1);
    joues.set(x.ext, (joues.get(x.ext) ?? 0) + 1);
  };
  const pronostics: Pronostic[] = [];
  const actifs: number[] = [];
  let j = 0;
  let jourCourant = '';
  for (const { m, s1, s2, occ, jour } of entrees) {
    if (jour !== jourCourant) {
      while (j < toutesLesRencontres.length && toutesLesRencontres[j].date.slice(0, 10) < jour) apprendre(toutesLesRencontres[j++]);
      jourCourant = jour;
    }
    let avis: { dom: number; nul: number; ext: number; poids: number } | null = null;
    if (!occ && (joues.get(m.dom) ?? 0) >= 5 && (joues.get(m.ext) ?? 0) >= 5) {
      // La part de la production : pleine sous cinq matchs connus.
      const su = Math.min(Number(s1?.matchsJoues ?? 0), Number(s2?.matchsJoues ?? 0));
      const part = su >= 5 ? 0.6 : 1 - (0.4 * su) / 5;
      const noteDom = ancree(m.dom) + AVANTAGE_TERRAIN_ELO;
      const noteExt = ancree(m.ext);
      const we = 1 / (1 + Math.pow(10, -(noteDom - noteExt) / 400));
      // Le nul suit l'écart de niveaux.
      const ecart = Math.min(1, Math.abs(noteDom - noteExt) / Math.max(1, ecartPlein));
      const nul = nulEgal + (nulEcarte - nulEgal) * ecart;
      avis = { dom: (1 - nul) * we, nul, ext: (1 - nul) * (1 - we), poids: part };
      actifs.push(Number(m.id));
    }
    const r: any = calculerScoreProbable(s1, s2, true, false, undefined, null, undefined, false, 1, occ, null, avis);
    pronostics.push(versPronostic(m, r));
  }
  return { pronostics, actifs };
}

// ── L'AVANTAGE DE RECEVOIR N'EST PAS LE MÊME PARTOUT ─────────────────────
//
// La mémoire accorde 65 points de note au club qui reçoit, partout. Or
// recevoir ne vaut pas la même chose d'un championnat à l'autre : mesuré sur
// les rencontres rangées, 42,4 % de victoires à domicile en Premier League
// contre 49,1 % en Liga — et les matchs aveugles sont souvent des coupes, où
// l'écart entre les deux pays s'ajoute à celui des deux clubs.
//
// On mesure donc l'avantage RÉEL du championnat du match — la part de
// victoires à domicile, tenue à jour match par match — et on le traduit en
// points de note : `parPoint` points par point de pourcentage d'écart à la
// moyenne générale. Un championnat mal connu garde les 65 points d'usage.
const MIN_POUR_TERRAIN_LIGUE = 40;
function avecMemoireTerrainLigue(echelle: number, parPoint: number): { pronostics: Pronostic[]; actifs: number[] } {
  const note = new Map<number, number>();
  const joues = new Map<number, number>();
  const somme = new Map<number, number>();
  const combien = new Map<number, number>();
  // Part de victoires à domicile, par championnat et en tout.
  const domLigue = new Map<number, { gagnes: number; n: number }>();
  let domTotal = 0;
  let nTotal = 0;
  const lire = (id: number) => note.get(id) ?? 1500;
  const poser = (id: number, valeur: number) => {
    const ligue = ligueDuClub.get(id) ?? 0;
    const avant = note.has(id) ? note.get(id)! : null;
    if (avant === null) {
      somme.set(ligue, (somme.get(ligue) ?? 0) + valeur);
      combien.set(ligue, (combien.get(ligue) ?? 0) + 1);
    } else {
      somme.set(ligue, (somme.get(ligue) ?? 0) + (valeur - avant));
    }
    note.set(id, valeur);
  };
  const ancrage = (ligue: number) => echelle * Math.log(coefficientDe(hierarchie as any, ligue) || 1);
  const ancree = (id: number) => {
    const ligue = ligueDuClub.get(id) ?? 0;
    const n = combien.get(ligue) ?? 0;
    const moyenne = n > 0 ? (somme.get(ligue) ?? 0) / n : 1500;
    return lire(id) - moyenne + 1500 + ancrage(ligue);
  };
  // L'avantage du terrain de CE championnat, en points de note.
  const terrainDe = (ligue: number) => {
    const c = domLigue.get(Number(ligue));
    if (!c || c.n < MIN_POUR_TERRAIN_LIGUE || nTotal < 200) return AVANTAGE_TERRAIN_ELO;
    const partLigue = c.gagnes / c.n;
    const partPartout = domTotal / nTotal;
    return AVANTAGE_TERRAIN_ELO + parPoint * 100 * (partLigue - partPartout);
  };
  const apprendre = (x: any) => {
    const brutDom = lire(x.dom);
    const brutExt = lire(x.ext);
    const prevu = 1 / (1 + Math.pow(10, -(brutDom + AVANTAGE_TERRAIN_ELO - brutExt) / 400));
    const w = x.bd > x.be ? 1 : x.bd === x.be ? 0.5 : 0;
    const e = Math.abs(x.bd - x.be);
    const g = e <= 1 ? 1 : e === 2 ? 1.5 : (11 + e) / 8;
    const delta = 30 * g * (w - prevu);
    poser(x.dom, brutDom + delta);
    poser(x.ext, brutExt - delta);
    joues.set(x.dom, (joues.get(x.dom) ?? 0) + 1);
    joues.set(x.ext, (joues.get(x.ext) ?? 0) + 1);
    const ligue = Number(x.ligue);
    const c = domLigue.get(ligue) ?? { gagnes: 0, n: 0 };
    if (x.bd > x.be) { c.gagnes++; domTotal++; }
    c.n++;
    nTotal++;
    domLigue.set(ligue, c);
  };
  const pronostics: Pronostic[] = [];
  const actifs: number[] = [];
  let j = 0;
  let jourCourant = '';
  for (const { m, s1, s2, occ, jour } of entrees) {
    if (jour !== jourCourant) {
      while (j < toutesLesRencontres.length && toutesLesRencontres[j].date.slice(0, 10) < jour) apprendre(toutesLesRencontres[j++]);
      jourCourant = jour;
    }
    let avis: { dom: number; nul: number; ext: number; poids: number } | null = null;
    if (!occ && (joues.get(m.dom) ?? 0) >= 5 && (joues.get(m.ext) ?? 0) >= 5) {
      const su = Math.min(Number(s1?.matchsJoues ?? 0), Number(s2?.matchsJoues ?? 0));
      const part = su >= 5 ? 0.6 : 1 - (0.4 * su) / 5;
      const we = 1 / (1 + Math.pow(10, -(ancree(m.dom) + terrainDe(Number(m.ligue)) - ancree(m.ext)) / 400));
      avis = { dom: (1 - NUL_ELO) * we, nul: NUL_ELO, ext: (1 - NUL_ELO) * (1 - we), poids: part };
      actifs.push(Number(m.id));
    }
    const r: any = calculerScoreProbable(s1, s2, true, false, undefined, null, undefined, false, 1, occ, null, avis);
    pronostics.push(versPronostic(m, r));
  }
  return { pronostics, actifs };
}

// ── QUAND LA LECTURE DES TIRS TIENT À HUIT MATCHS ─────────────────────────
//
// La mémoire ne parle que là où le relevé des tirs est MUET. Mais le relevé
// n'est pas toujours bavard : il accepte un club dès huit rencontres
// (`MINIMUM_RENCONTRES`), et une force bâtie sur huit matchs est fragile —
// un promu, un club revenu de blessures, un début de saison.
//
// Ici la mémoire reprend une part de voix quand le club le moins vu des deux
// a moins de `seuil` rencontres de tirs, proportionnellement à cette
// fragilité : rien à `seuil`, `partMax` au minimum de huit. Le relevé garde
// la main partout ailleurs.
//
// C'est l'extension de ce qui a gagné le 12 septembre 2026 — la part qui suit
// ce que le moteur sait — au côté des tirs.
function avecMemoireReleveMince(
  echelle: number,
  seuil: number,
  partMax: number
): { pronostics: Pronostic[]; actifs: number[] } {
  const note = new Map<number, number>();
  const joues = new Map<number, number>();
  const somme = new Map<number, number>();
  const combien = new Map<number, number>();
  const lire = (id: number) => note.get(id) ?? 1500;
  const poser = (id: number, valeur: number) => {
    const ligue = ligueDuClub.get(id) ?? 0;
    const avant = note.has(id) ? note.get(id)! : null;
    if (avant === null) {
      somme.set(ligue, (somme.get(ligue) ?? 0) + valeur);
      combien.set(ligue, (combien.get(ligue) ?? 0) + 1);
    } else {
      somme.set(ligue, (somme.get(ligue) ?? 0) + (valeur - avant));
    }
    note.set(id, valeur);
  };
  const ancrage = (ligue: number) => echelle * Math.log(coefficientDe(hierarchie as any, ligue) || 1);
  const ancree = (id: number) => {
    const ligue = ligueDuClub.get(id) ?? 0;
    const n = combien.get(ligue) ?? 0;
    const moyenne = n > 0 ? (somme.get(ligue) ?? 0) / n : 1500;
    return lire(id) - moyenne + 1500 + ancrage(ligue);
  };
  const apprendre = (x: any) => {
    const brutDom = lire(x.dom);
    const brutExt = lire(x.ext);
    const prevu = 1 / (1 + Math.pow(10, -(brutDom + AVANTAGE_TERRAIN_ELO - brutExt) / 400));
    const w = x.bd > x.be ? 1 : x.bd === x.be ? 0.5 : 0;
    const e = Math.abs(x.bd - x.be);
    const g = e <= 1 ? 1 : e === 2 ? 1.5 : (11 + e) / 8;
    const delta = 30 * g * (w - prevu);
    poser(x.dom, brutDom + delta);
    poser(x.ext, brutExt - delta);
    joues.set(x.dom, (joues.get(x.dom) ?? 0) + 1);
    joues.set(x.ext, (joues.get(x.ext) ?? 0) + 1);
  };
  const pronostics: Pronostic[] = [];
  const actifs: number[] = [];
  let j = 0;
  let jourCourant = '';
  for (const { m, s1, s2, occ, jour } of entrees) {
    if (jour !== jourCourant) {
      while (j < toutesLesRencontres.length && toutesLesRencontres[j].date.slice(0, 10) < jour) apprendre(toutesLesRencontres[j++]);
      jourCourant = jour;
    }
    let avis = avisDeLaProduction(m);
    // Les occasions existent : la production se taisait. Ici, on regarde sur
    // combien de rencontres elles reposent.
    if (occ && (joues.get(m.dom) ?? 0) >= 5 && (joues.get(m.ext) ?? 0) >= 5) {
      const releve: any = releveLaVeille(jour);
      const rd = Number(releve?.clubs?.[m.nomDom]?.rencontres ?? 0);
      const re = Number(releve?.clubs?.[m.nomExt]?.rencontres ?? 0);
      const vues = Math.min(rd, re);
      if (vues > 0 && vues < seuil) {
        const part = partMax * (1 - vues / seuil);
        if (part > 0.02) {
          const we = 1 / (1 + Math.pow(10, -(ancree(m.dom) + AVANTAGE_TERRAIN_ELO - ancree(m.ext)) / 400));
          avis = { dom: (1 - NUL_ELO) * we, nul: NUL_ELO, ext: (1 - NUL_ELO) * (1 - we), poids: part };
          actifs.push(Number(m.id));
        }
      }
    }
    const r: any = calculerScoreProbable(s1, s2, true, false, undefined, null, undefined, false, 1, occ, null, avis);
    pronostics.push(versPronostic(m, r));
  }
  return { pronostics, actifs };
}

// ── CHAQUE ESSAI ──────────────────────────────────────────────────────────
const sortie: Record<string, Pronostic[]> = {};
const actifs: Record<string, number[]> = {};
for (const v of tache.variantes) {
  if (v.couche?.type === 'erreurs-clubs') {
    sortie[v.nom] = avecErreurs(v.couche.retrecissement, v.couche.poids);
    continue;
  }
  if (v.couche?.type === 'memoire-releve-mince') {
    const { pronostics, actifs: ids } = avecMemoireReleveMince(v.couche.echelle, v.couche.seuil, v.couche.partMax);
    sortie[v.nom] = pronostics;
    actifs[v.nom] = ids;
    continue;
  }
  if (v.couche?.type === 'memoire-terrain-ligue') {
    const { pronostics, actifs: ids } = avecMemoireTerrainLigue(v.couche.echelle, v.couche.parPoint);
    sortie[v.nom] = pronostics;
    actifs[v.nom] = ids;
    continue;
  }
  if (v.couche?.type === 'memoire-nul-variable') {
    const { pronostics, actifs: ids } = avecMemoireNulVariable(
      v.couche.echelle,
      v.couche.nulEgal,
      v.couche.nulEcarte,
      v.couche.ecartPlein
    );
    sortie[v.nom] = pronostics;
    actifs[v.nom] = ids;
    continue;
  }
  if (v.couche?.type === 'memoire-poids-variable') {
    const { pronostics, actifs: ids } = avecMemoirePoidsVariable(
      v.couche.echelle,
      v.couche.base,
      v.couche.haut,
      v.couche.seuil
    );
    sortie[v.nom] = pronostics;
    actifs[v.nom] = ids;
    continue;
  }
  if (v.couche?.type === 'forces-globales') {
    const { pronostics, actifs: ids } = avecForcesGlobales(v.couche.pas, v.couche.rappel, v.couche.minimum, v.couche.repartitionMemoire);
    sortie[v.nom] = pronostics;
    actifs[v.nom] = ids;
    continue;
  }
  if (v.couche?.type === 'demi-vue-memoire') {
    const { pronostics, actifs: ids } = avecDemiVueMemoire(v.couche.echelle, v.couche.force);
    sortie[v.nom] = pronostics;
    actifs[v.nom] = ids;
    continue;
  }
  if (v.couche?.type === 'memoire-ancree') {
    const { pronostics, actifs: ids } = avecMemoireAncree(v.couche.k, v.couche.poids, v.couche.echelle);
    sortie[v.nom] = pronostics;
    actifs[v.nom] = ids;
    continue;
  }
  if (v.couche?.type === 'tirs-elargis') {
    const { pronostics, actifs: ids } = avecTirsElargis();
    sortie[v.nom] = pronostics;
    actifs[v.nom] = ids;
    continue;
  }
  if (v.couche?.type === 'demi-vue') {
    const { pronostics, actifs: ids } = avecDemiVue();
    sortie[v.nom] = pronostics;
    actifs[v.nom] = ids;
    continue;
  }
  if (v.couche?.type === 'memoire') {
    const { pronostics, actifs: ids } = avecMemoire(v.couche.k, v.couche.poids);
    sortie[v.nom] = pronostics;
    actifs[v.nom] = ids;
    continue;
  }
  if (v.couche?.type === 'melange') {
    sortie[v.nom] = avecMelange(v.couche);
    continue;
  }
  if (v.couche?.type === 'terrain-ligue') {
    sortie[v.nom] = avecTerrainLigue(v.couche.retrecissement, v.couche.poids);
    continue;
  }
  if (v.couche?.type === 'elan') {
    sortie[v.nom] = avecElan(v.couche.court, v.couche.long, v.couche.poids);
    continue;
  }
  if (v.couche?.type === 'duel') {
    sortie[v.nom] = avecDuel(v.couche.retrecissement, v.couche.poids);
    continue;
  }
  if (v.couche?.type === 'terrain') {
    sortie[v.nom] = avecTerrain(v.couche.retrecissement, v.couche.poids);
    continue;
  }
  if (v.couche?.type === 'elo') {
    sortie[v.nom] = avecElo(v.couche.k, v.couche.poids);
    continue;
  }
  if (v.couche?.type === 'marche') {
    const r = avecMarche(v.couche.poids);
    sortie[v.nom] = r.pronostics;
    actifs[v.nom] = r.actifs;
    continue;
  }
  const avant: Record<string, string | undefined> = {};
  for (const [k, val] of Object.entries(v.env)) {
    avant[k] = process.env[k];
    process.env[k] = val;
  }
  try {
    sortie[v.nom] = entrees.map(({ m, s1, s2, occ }) =>
      versPronostic(
        m,
        calculerScoreProbable(s1, s2, true, false, undefined, null, undefined, false, 1, occ, null, avisDeLaProduction(m))
      )
    );
  } finally {
    for (const [k, val] of Object.entries(avant)) {
      if (val === undefined) delete process.env[k];
      else process.env[k] = val;
    }
  }
}

fs.writeFileSync(tache.sortie, JSON.stringify({ matchs: entrees.length, variantes: sortie, actifs }));
console.log(
  `  évaluation terminée : ${entrees.length} matchs, ${tache.variantes.length} essai(s), ${releves.size} relevés reconstruits, ` +
    `${Object.keys(cotes).length} rencontres cotées disponibles`
);
