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
 * par-dessus le moteur. Une variante peut porter une `couche` ; elle est alors
 * rejouée match par match, la couche n'apprenant que des JOURS PRÉCÉDENTS.
 *
 * Tous les essais sont jugés sur exactement la même liste de matchs : un
 * match dont un club manque au relevé est rejoué SANS les tirs, comme la
 * production le ferait, au lieu d'être écarté.
 *
 * Usage : `npx tsx scripts/challenger/evaluer.mts <tâche.json>`
 */
import fs from 'node:fs';
import { chargerEnv, FICHIER_RENCONTRES, FICHIER_TIRS, GRANDS, COUPES_SUIVIES } from './commun.mjs';
import type { Pronostic } from './porte.js';

type Couche = { type: 'erreurs-clubs'; retrecissement: number; poids: number };

chargerEnv();
const tache: {
  debut: string;
  fin: string;
  variantes: { nom: string; env: Record<string, string>; couche?: Couche }[];
  sortie: string;
} = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

// Chargés APRÈS l'environnement : les réglages du relevé sont lus à l'import.
const { calculerScoreProbable } = await import('../../src/lib/score-probable.js');
const { forcesDepuisRencontres, butsAttendusOccasions } = await import('../../src/lib/forme-occasions.js');
const { apprendreErreurs, correctionPour } = await import('../../src/lib/couche-erreurs.js');

const rencontres: any[] = JSON.parse(fs.readFileSync(FICHIER_RENCONTRES, 'utf8'));
rencontres.sort((a, b) => a.date.localeCompare(b.date));
const tirs: any[] = JSON.parse(fs.readFileSync(FICHIER_TIRS, 'utf8'));
const quand = (x: any) => Date.parse(x.date);

// ── LE RELEVÉ, TEL QU'IL AURAIT ÉTÉ LA VEILLE ──────────────────────────────
const releves = new Map<string, any>();
function releveLaVeille(jour: string) {
  if (releves.has(jour)) return releves.get(jour);
  const fin = Date.parse(`${jour}T00:00:00Z`);
  // Une copie : le calcul trie sur place.
  const liste = tirs.filter((t) => t.date >= fin - 240 * 86_400_000 && t.date < fin).map((t) => ({ ...t }));
  // Comme en production : rien sous cent rencontres.
  const r = liste.length >= 100 ? forcesDepuisRencontres(liste as any, undefined, new Date(fin).toISOString()) : null;
  releves.set(jour, r);
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
for (const m of rencontres) {
  if (!suivies.has(Number(m.ligue)) || m.date < tache.debut || m.date >= tache.fin) continue;
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

// ── LES BUTS ATTENDUS DU MOTEUR ACTUEL, DONT LES COUCHES APPRENNENT ────────
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

// ── UNE COUCHE, REJOUÉE JOUR APRÈS JOUR ───────────────────────────────────
function avecCouche(c: Couche): Pronostic[] {
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
    const corr = correctionPour(clubs, String(m.dom), String(m.ext), {
      retrecissement: c.retrecissement,
      poids: c.poids,
    });
    const r: any = calculerScoreProbable(s1, s2, true, false, undefined, null, undefined, false, 1, occ, corr);
    out.push(versPronostic(m, r));
    const a = base.get(Number(m.id))!;
    passes.push({ dom: String(m.dom), ext: String(m.ext), attenduDom: a.a1, attenduExt: a.a2, reelDom: m.bd, reelExt: m.be });
  }
  return out;
}

// ── CHAQUE ESSAI ──────────────────────────────────────────────────────────
const sortie: Record<string, Pronostic[]> = {};
for (const v of tache.variantes) {
  if (v.couche) {
    sortie[v.nom] = avecCouche(v.couche);
    continue;
  }
  const avant: Record<string, string | undefined> = {};
  for (const [k, val] of Object.entries(v.env)) {
    avant[k] = process.env[k];
    process.env[k] = val;
  }
  try {
    sortie[v.nom] = entrees.map(({ m, s1, s2, occ }) =>
      versPronostic(m, calculerScoreProbable(s1, s2, true, false, undefined, null, undefined, false, 1, occ))
    );
  } finally {
    for (const [k, val] of Object.entries(avant)) {
      if (val === undefined) delete process.env[k];
      else process.env[k] = val;
    }
  }
}

fs.writeFileSync(tache.sortie, JSON.stringify({ matchs: entrees.length, variantes: sortie }));
console.log(`  évaluation terminée : ${entrees.length} matchs, ${tache.variantes.length} essai(s), ${releves.size} relevés reconstruits`);
