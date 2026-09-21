// La note Elo contre les deux lectures qu'utilise le moteur actuel pour une sélection :
// la forme récente (points sur les 5 derniers matchs) et les moyennes de buts (10 derniers).
import { chargerEnv } from './commun.mjs';
import { matchsRetenus, rejouer, apprendreProbabilites } from './elo-selections.mjs';
chargerEnv();
const matchs = matchsRetenus();
const { avant } = rejouer(matchs);
const reel = (m: any): 0 | 1 | 2 => (m.bd > m.be ? 0 : m.bd === m.be ? 1 : 2);
const probas = apprendreProbabilites(matchs.filter((m) => m.date < '2022-01-01').map((m) => ({ ecart: avant.get(m.id)!.ecart, reel: reel(m) })));
const passe = new Map<number, { pts: number; bm: number; be: number }[]>();
const hist = (id: number) => passe.get(id) ?? [];
let n = 0, elo = 0, forme = 0, buts = 0, dom = 0, accordEF = 0;
const pc = (a: number) => ((100 * a) / n).toFixed(1) + ' %';
for (const m of matchs) {
  const h1 = hist(m.dom), h2 = hist(m.ext);
  if (m.date >= '2022-01-01' && h1.length >= 5 && h2.length >= 5) {
    n++;
    const r = reel(m);
    const p = probas(avant.get(m.id)!.ecart);
    const aElo = p[0] >= p[2] ? 0 : 2;
    const pts = (h: any[]) => h.slice(-5).reduce((s, x) => s + x.pts, 0);
    const aForme = pts(h1) >= pts(h2) ? 0 : 2;
    const moy = (h: any[], k: 'bm' | 'be') => h.slice(-10).reduce((s, x) => s + x[k], 0) / Math.min(10, h.length);
    const l1 = (moy(h1, 'bm') + moy(h2, 'be')) / 2, l2 = (moy(h2, 'bm') + moy(h1, 'be')) / 2;
    const aButs = l1 >= l2 ? 0 : 2;
    if (aElo === r) elo++;
    if (aForme === r) forme++;
    if (aButs === r) buts++;
    if (r === 0) dom++;
    if (aElo === aForme) accordEF++;
  }
  const w = m.bd > m.be ? [3, 0] : m.bd === m.be ? [1, 1] : [0, 3];
  passe.set(m.dom, [...hist(m.dom), { pts: w[0], bm: m.bd, be: m.be }]);
  passe.set(m.ext, [...hist(m.ext), { pts: w[1], bm: m.be, be: m.bd }]);
}
console.log(`${n} matchs de 2022-2026 où les deux sélections ont au moins 5 matchs connus :`);
console.log(`  la note Elo                         ${pc(elo)}`);
console.log(`  la forme (points des 5 derniers)    ${pc(forme)}`);
console.log(`  les moyennes de buts (10 derniers)  ${pc(buts)}`);
console.log(`  toujours l'équipe qui reçoit        ${pc(dom)}`);
console.log(`  Elo et la forme désignent le même vainqueur dans ${pc(accordEF)} des cas`);
