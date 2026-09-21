// Quelle part donner à la note Elo ? Le moteur garde sa lecture des buts, et reprend
// l'avis Elo sur qui domine, dans une proportion à mesurer — comme la mémoire des clubs.
import { chargerEnv } from './commun.mjs';
import { matchsRetenus, rejouer, apprendreProbabilites } from './elo-selections.mjs';
chargerEnv();
const matchs = matchsRetenus();
const { avant } = rejouer(matchs);
const reel = (m: any): 0 | 1 | 2 => (m.bd > m.be ? 0 : m.bd === m.be ? 1 : 2);
const probas = apprendreProbabilites(matchs.filter((m) => m.date < '2022-01-01').map((m) => ({ ecart: avant.get(m.id)!.ecart, reel: reel(m) })));
const fact = (k: number): number => (k <= 1 ? 1 : k * fact(k - 1));
const poisson = (l: number, k: number) => (Math.exp(-l) * Math.pow(l, k)) / fact(k);
function grille(l1: number, l2: number): [number, number, number] {
  let d = 0, n = 0, e = 0;
  for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) {
    const p = poisson(l1, i) * poisson(l2, j);
    if (i > j) d += p; else if (i === j) n += p; else e += p;
  }
  const s = d + n + e; return [d / s, n / s, e / s];
}
const passe = new Map<number, { bm: number; be: number }[]>();
const hist = (id: number) => passe.get(id) ?? [];
const poids = [0, 0.25, 0.5, 0.75, 1];
const res = poids.map(() => ({ n: 0, j: 0, brier: 0, surs: 0, sj: 0 }));
const tranches = new Map<string, number>(); // 3 périodes de jugement
for (const m of matchs) {
  const h1 = hist(m.dom), h2 = hist(m.ext);
  if (m.date >= '2022-01-01' && h1.length >= 5 && h2.length >= 5) {
    const moy = (h: any[], k: 'bm' | 'be') => h.slice(-10).reduce((s, x) => s + x[k], 0) / Math.min(10, h.length);
    const base = grille(Math.max(0.2, (moy(h1, 'bm') + moy(h2, 'be')) / 2 * 1.1), Math.max(0.2, (moy(h2, 'bm') + moy(h1, 'be')) / 2 * 0.9));
    const pe = probas(avant.get(m.id)!.ecart);
    const r = reel(m);
    poids.forEach((w, i) => {
      const p = base.map((v, k) => (1 - w) * v + w * pe[k]);
      const a = p[0] >= p[2] ? 0 : 2;
      const c = res[i];
      c.n++; if (a === r) c.j++;
      c.brier += p.reduce((s, v, k) => s + (v - (k === r ? 1 : 0)) ** 2, 0);
      if (Math.max(p[0], p[2]) >= 0.6) { c.surs++; if (a === r) c.sj++; }
    });
  }
  passe.set(m.dom, [...hist(m.dom), { bm: m.bd, be: m.be }]);
  passe.set(m.ext, [...hist(m.ext), { bm: m.be, be: m.bd }]);
}
const pc = (a: number, n: number) => (n ? ((100 * a) / n).toFixed(1) + ' %' : '—');
console.log('part Elo  vainqueur juste   Brier    sûrs (60 %+)');
poids.forEach((w, i) => { const c = res[i]; console.log(`  ${w.toFixed(2)}     ${pc(c.j, c.n).padStart(7)}      ${(c.brier / c.n).toFixed(4)}   ${pc(c.sj, c.surs)} sur ${c.surs}`); });
