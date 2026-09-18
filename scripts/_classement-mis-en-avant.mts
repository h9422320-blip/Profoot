/**
 * Les matchs mis en avant : le classement de PRODUCTION (compétition, puis
 * fiabilité apprise) contre le même classement où la fiabilité est remplacée
 * par la moyenne des deux lectures (moteur + modèle de Poisson).
 *
 *   npx tsx scripts/_classement-mis-en-avant.mts
 *
 * Lecture seule. Le relevé de fiabilité est celui d'aujourd'hui : bâti sur des
 * matchs qui recoupent en partie ceux rejoués ici, il est AVANTAGÉ. Une
 * variante qui le bat malgré cela le bat vraiment.
 */
import fs from 'node:fs';
import { chargerEnv, FICHIER_RENCONTRES } from './challenger/commun.mjs';
chargerEnv();
const { lireReleve, fiabilitePour } = await import('../src/lib/fiabilite-apprise.js');
const { ajusterPoisson, avisPoisson } = await import('../src/lib/forces-poisson.js');
const { rangDeCompetition } = await import('../src/lib/precalcul-selection.js');

const releve = await lireReleve();
if (!releve) throw new Error('relevé de fiabilité illisible');

const LIGUES: Record<number, [string, string]> = {
  39: ['Premier League', 'England'], 140: ['La Liga', 'Spain'], 135: ['Serie A', 'Italy'],
  78: ['Bundesliga', 'Germany'], 61: ['Ligue 1', 'France'], 94: ['Primeira Liga', 'Portugal'],
  88: ['Eredivisie', 'Netherlands'], 2: ['UEFA Champions League', 'World'], 3: ['UEFA Europa League', 'World'],
};
const COUPES = new Set([2, 3, 848]);
const R: any[] = JSON.parse(fs.readFileSync(FICHIER_RENCONTRES, 'utf8')).sort((a: any, b: any) => Date.parse(a.date) - Date.parse(b.date));
const CH: any[] = JSON.parse(fs.readFileSync('.challenger/essais/chemin-grands-resultat.json', 'utf8')).variantes.champion;
const parId = new Map(R.map((m) => [m.id, m]));

// L'avis du modèle, réajusté chaque mois sur le seul passé.
const avis = new Map<number, { dom: number; nul: number; ext: number }>();
const mois: number[] = [];
for (let d = new Date('2024-08-01'); d < new Date('2026-10-01'); d.setUTCMonth(d.getUTCMonth() + 1)) mois.push(d.getTime());
for (let i = 1; i < mois.length - 1; i++) {
  const test = CH.filter((x) => Date.parse(x.date) >= mois[i] && Date.parse(x.date) < mois[i + 1]);
  if (!test.length) continue;
  const passe = R.filter((m) => Date.parse(m.date) < mois[i]);
  const glob = ajusterPoisson(passe, mois[i], 300);
  const cache = new Map<number, any>();
  const modele = (l: number) => {
    if (COUPES.has(l)) return glob;
    if (!cache.has(l)) cache.set(l, ajusterPoisson(passe.filter((m) => Number(m.ligue) === l), mois[i], 300));
    return cache.get(l) ?? glob;
  };
  for (const x of test) {
    const m = parId.get(x.id);
    if (!m) continue;
    const a = avisPoisson(modele(Number(m.ligue)), m.dom, m.ext) ?? avisPoisson(glob, m.dom, m.ext);
    if (a) avis.set(x.id, a);
  }
}

const camp = (x: any) => (x.probas[0] >= x.probas[2] ? 0 : 2);
const fiab = (x: any) => {
  const [nom, pays] = LIGUES[Number(x.ligue)] ?? ['', ''];
  const f = fiabilitePour(releve, 100 * x.probas[0], 100 * x.probas[1], 100 * x.probas[2], nom, pays);
  return f ? f.taux / 100 : Math.max(x.probas[0], x.probas[2]);
};
const moyenne = (x: any) => {
  const q = avis.get(x.id);
  const c = camp(x);
  const pq = q ? (c === 0 ? q.dom : q.ext) : x.probas[c];
  return (x.probas[c] + pq) / 2;
};
const rang = (x: any) => rangDeCompetition((LIGUES[Number(x.ligue)] ?? [''])[0]);

const variantes: Record<string, (x: any) => number> = {
  'PRODUCTION (fiabilité)': fiab,
  'confiance du moteur': (x) => Math.max(x.probas[0], x.probas[2]),
  'moyenne des deux lectures': moyenne,
};
const parJour = new Map<string, any[]>();
for (const x of CH) { const d = x.date.slice(0, 10); if (!parJour.has(d)) parJour.set(d, []); parJour.get(d)!.push(x); }
const periode = (d: string) => (d < '2025-08' ? 'A' : d < '2026-02' ? 'B' : 'C');

for (const N of [3, 5]) {
  console.log(`\n── les ${N} mis en avant par jour (Ligue des champions d'abord, comme en production) ──`);
  for (const [nom, note] of Object.entries(variantes)) {
    let n = 0, ok = 0, parfaites = 0, jours = 0;
    const tr: Record<string, [number, number]> = {};
    for (const [d, l] of parJour) {
      if (l.length < N) continue;
      const choix = [...l].sort((a, b) => rang(a) - rang(b) || note(b) - note(a)).slice(0, N);
      const bons = choix.filter((x) => x.reel === x.parScore).length;
      n += N; ok += bons; jours++;
      if (bons === N) parfaites++;
      const t = periode(d);
      tr[t] ??= [0, 0];
      tr[t][0] += N; tr[t][1] += bons;
    }
    console.log(
      `  ${nom.padEnd(28)} ${(100 * ok / n).toFixed(1)} % · ${parfaites}/${jours} journées parfaites · ` +
        ['A', 'B', 'C'].map((t) => `${t} ${(100 * tr[t][1] / tr[t][0]).toFixed(1)} %`).join(' · ')
    );
  }
}
