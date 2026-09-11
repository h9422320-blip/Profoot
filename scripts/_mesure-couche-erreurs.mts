/**
 * LA COUCHE DES ERREURS APPRISES FAIT-ELLE ANNONCER PLUS DE BONS VAINQUEURS ?
 *
 * Lecture seule. Mêmes matchs que le challenger de nuit — sept grands
 * championnats, Ligue des champions, Europa League —, rejoués par le VRAI
 * moteur, chacun avec seulement ce qui était connu la veille.
 *
 * ── SANS TRICHER ──────────────────────────────────────────────────────────
 *
 * La couche d'un match n'apprend que des erreurs des JOURS PRÉCÉDENTS.
 *
 * Le réglage de la couche est CHOISI SUR LA PREMIÈRE MOITIÉ SEULEMENT. La
 * seconde moitié ne sert qu'à confirmer : c'est elle qui dit si la couche
 * part en ligne. Choisir et juger sur les mêmes matchs ferait trouver une
 * « amélioration » qui ne décrit que le hasard.
 */
import fs from 'node:fs';
import { chargerEnv, FICHIER_RENCONTRES, FICHIER_TIRS, GRANDS, COUPES_SUIVIES } from './challenger/commun.mjs';
import { mesurer, moities, verdict, type Pronostic, type Mesure } from './challenger/porte.js';

chargerEnv();
const { calculerScoreProbable } = await import('../src/lib/score-probable.js');
const { forcesDepuisRencontres, butsAttendusOccasions } = await import('../src/lib/forme-occasions.js');
const { apprendreErreurs, correctionPour } = await import('../src/lib/couche-erreurs.js');

const rencontres: any[] = JSON.parse(fs.readFileSync(FICHIER_RENCONTRES, 'utf8')).sort((a: any, b: any) =>
  a.date.localeCompare(b.date)
);
const tirs: any[] = JSON.parse(fs.readFileSync(FICHIER_TIRS, 'utf8'));
const quand = (x: any) => Date.parse(x.date);

const releves = new Map<string, any>();
function releveLaVeille(jour: string) {
  if (releves.has(jour)) return releves.get(jour);
  const fin = Date.parse(`${jour}T00:00:00Z`);
  const liste = tirs.filter((t) => t.date >= fin - 240 * 86_400_000 && t.date < fin).map((t) => ({ ...t }));
  const r = liste.length >= 100 ? forcesDepuisRencontres(liste as any, undefined, new Date(fin).toISOString()) : null;
  releves.set(jour, r);
  return r;
}
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

const suivies = new Set([...Object.keys(GRANDS), ...Object.keys(COUPES_SUIVIES)].map(Number));
const entrees: { m: any; s1: any; s2: any; occ: any; jour: string }[] = [];
for (const m of rencontres) {
  if (!suivies.has(Number(m.ligue)) || m.date < '2026-02-15' || m.date >= new Date().toISOString().slice(0, 10)) continue;
  const s1 = statsAvant(m.dom, m), s2 = statsAvant(m.ext, m);
  if (s1.matchsJoues < 1 || s2.matchsJoues < 1) continue;
  const jour = m.date.slice(0, 10);
  entrees.push({ m, s1, s2, occ: butsAttendusOccasions(releveLaVeille(jour), m.nomDom, m.nomExt), jour });
}

const versPronostic = (m: any, r: any): Pronostic => {
  const p = [Number(r.probaVictoire1), Number(r.probaNul), Number(r.probaVictoire2)];
  const somme = p[0] + p[1] + p[2] || 1;
  return {
    id: Number(m.id), date: String(m.date), ligue: Number(m.ligue),
    reel: m.bd > m.be ? 0 : m.bd === m.be ? 1 : 2,
    parScore: r.buts1 > r.buts2 ? 0 : r.buts1 === r.buts2 ? 1 : 2,
    probas: [p[0] / somme, p[1] / somme, p[2] / somme],
  };
};

// ── LE MOTEUR ACTUEL, SANS COUCHE ─────────────────────────────────────────
const champion: Pronostic[] = [];
const attendus = new Map<number, { a1: number; a2: number }>();
for (const { m, s1, s2, occ } of entrees) {
  const r: any = calculerScoreProbable(s1, s2, true, false, undefined, null, undefined, false, 1, occ);
  champion.push(versPronostic(m, r));
  attendus.set(Number(m.id), { a1: Number(r.butsAttendus1), a2: Number(r.butsAttendus2) });
}

// ── LE MOTEUR AVEC LA COUCHE, POUR UN RÉGLAGE ─────────────────────────────
function avecCouche(retrecissement: number, poids: number): Pronostic[] {
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
    const r: any = calculerScoreProbable(s1, s2, true, false, undefined, null, undefined, false, 1, occ, corr);
    out.push(versPronostic(m, r));
    const a = attendus.get(Number(m.id))!;
    passes.push({ dom: String(m.dom), ext: String(m.ext), attenduDom: a.a1, attenduExt: a.a2, reelDom: m.bd, reelExt: m.be });
  }
  return out;
}

const [h1, h2] = moities(champion);
const decoupe: [Set<number>, Set<number>] = [new Set(h1.map((p) => p.id)), new Set(h2.map((p) => p.id))];
const parMoities = (l: Pronostic[]): [Mesure, Mesure] => [
  mesurer(l.filter((p) => decoupe[0].has(p.id))),
  mesurer(l.filter((p) => decoupe[1].has(p.id))),
];
const mc = parMoities(champion);
const pc = (a: number, n: number) => `${((100 * a) / n).toFixed(1)} %`;
console.log(`${champion.length} matchs rejoués, du ${h1[0].date.slice(0, 10)} au ${h2[h2.length - 1].date.slice(0, 10)}`);
console.log(`moteur actuel : 1re moitié ${mc[0].justes}/${mc[0].n} (${pc(mc[0].justes, mc[0].n)})  2e moitié ${mc[1].justes}/${mc[1].n} (${pc(mc[1].justes, mc[1].n)})\n`);

const grille: { k: number; w: number; m: [Mesure, Mesure] }[] = [];
for (const k of [5, 10, 20, 40])
  for (const w of [0.25, 0.5, 1]) grille.push({ k, w, m: parMoities(avecCouche(k, w)) });

console.log('  réglage            1re moitié (choix)          2e moitié (contrôle)');
for (const g of grille) {
  const d = (i: 0 | 1) => g.m[i].justes - mc[i].justes;
  console.log(
    `  k=${String(g.k).padStart(2)} poids=${String(g.w).padEnd(4)}  ` +
      `${d(0) >= 0 ? '+' : ''}${d(0)} juste(s) Brier ${g.m[0].brier.toFixed(4)}      ` +
      `${d(1) >= 0 ? '+' : ''}${d(1)} juste(s) Brier ${g.m[1].brier.toFixed(4)}`
  );
}

// ── LE CHOIX, SUR LA PREMIÈRE MOITIÉ SEULEMENT ────────────────────────────
const admissibles = grille.filter((g) => g.m[0].brier <= mc[0].brier);
const choisi = (admissibles.length ? admissibles : grille).sort(
  (a, b) => b.m[0].justes - a.m[0].justes || a.m[0].brier - b.m[0].brier
)[0];
const v = verdict(mc, choisi.m);
console.log(`\nréglage choisi sur la 1re moitié : k=${choisi.k}, poids=${choisi.w}`);
console.log(`  1re moitié : ${choisi.m[0].justes} contre ${mc[0].justes} ; 2e moitié : ${choisi.m[1].justes} contre ${mc[1].justes}`);
console.log(`  matchs sûrs : ${pc(choisi.m[0].sursJustes, choisi.m[0].surs)} / ${pc(choisi.m[1].sursJustes, choisi.m[1].surs)} contre ${pc(mc[0].sursJustes, mc[0].surs)} / ${pc(mc[1].sursJustes, mc[1].surs)}`);
console.log(`VERDICT DE LA PORTE : ${v.gagne ? 'GAGNE — la couche peut partir en ligne' : 'REFUSÉE — ' + v.raisons.join(' ; ')}`);
