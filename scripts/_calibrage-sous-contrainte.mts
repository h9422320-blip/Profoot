/**
 * DE MEILLEURS COEFFICIENTS, SANS CASSER L'ORDRE DES SEUILS.
 *
 * « Plus de 3,5 buts » ne peut pas ressortir au-dessus de « plus de 2,5 ».
 * L'ajustement libre l'a fait : à 0,70 but attendu, 8 % devenait 9 % contre
 * 8 % pour le seuil du dessous. Un écran absurde coûte plus cher qu'un
 * dixième de millième de Brier.
 *
 * On cherche donc le meilleur couple (a, b) QUI RESPECTE L'ORDRE sur toute la
 * plage réaliste, et qui gagne dans les deux sens.
 */
import fs from 'node:fs';
import { COEFFICIENTS } from '../src/lib/calibration-buts.js';

const r = JSON.parse(fs.readFileSync('.challenger/travail/resultat-buts.json', 'utf8'));
const tout = (r.variantes['champion'] as any[]).filter((x) => x.scoreReel && x.annexes)
  .sort((a, b) => String(a.date).localeCompare(String(b.date)));
const moitie = Math.floor(tout.length / 2);
const [m1, m2] = [tout.slice(0, moitie), tout.slice(moitie)];
const borner = (p: number) => Math.min(0.999, Math.max(0.001, p));
const app = (a: number, b: number, v: number) => 1 / (1 + Math.exp(-(a + b * Math.log(borner(v / 100) / (1 - borner(v / 100))))));
const pc = (a: number, b: number, v: number) => Math.round(100 * app(a, b, v));
const arrive = (s: [number, number]) => s[0] + s[1] > 3.5;
const brier = (l: any[], f: (v: number) => number) =>
  l.reduce((s, x) => s + (f(Number(x.annexes.plusDeTroisCinq)) - (arrive(x.scoreReel) ? 1 : 0)) ** 2, 0) / l.length;

// L'ordre, exactement comme l'épreuve le vérifie.
const ordreTenu = (a: number, b: number) => {
  for (let xg = 0.5; xg <= 5.001; xg += 0.05) {
    const p = (k: number) => (Math.exp(-xg) * Math.pow(xg, k)) / [1, 1, 2, 6][k];
    const o05 = 1 - p(0);
    const brut = [o05, o05 - p(1), o05 - p(1) - p(2), o05 - p(1) - p(2) - p(3)].map((x) => Math.round(x * 100));
    const c05 = pc(COEFFICIENTS.plus05.a, COEFFICIENTS.plus05.b, brut[0]);
    const c15 = pc(COEFFICIENTS.plus15.a, COEFFICIENTS.plus15.b, brut[1]);
    const c25 = pc(COEFFICIENTS.plus25.a, COEFFICIENTS.plus25.b, brut[2]);
    const c35 = pc(a, b, brut[3]);
    if (!(c15 <= c05 && c25 <= c15 && c35 <= c25)) return false;
  }
  return true;
};

// La RÉFÉRENCE est le coefficient d'ORIGINE, pas celui qu'on vient d'écrire :
// se comparer à soi-même ne prouve rien.
const ORIGINE = { a: 0.15, b: 0.85 };
const actuel = (v: number) => app(ORIGINE.a, ORIGINE.b, v);
const refBrut = (v: number) => borner(v / 100);
console.log(`référence — brut : 1re ${brier(m1, refBrut).toFixed(4)} · 2e ${brier(m2, refBrut).toFixed(4)}`);
console.log(`origine ({a:${ORIGINE.a}, b:${ORIGINE.b}}) : 1re ${brier(m1, actuel).toFixed(4)} · 2e ${brier(m2, actuel).toFixed(4)}\n`);

const candidats: { a: number; b: number; g1: number; g2: number }[] = [];
for (let a = -1.2; a <= 1.2001; a += 0.05)
  for (let b = 0.2; b <= 1.3001; b += 0.05) {
    const A = Math.round(a * 100) / 100, B = Math.round(b * 100) / 100;
    if (!ordreTenu(A, B)) continue;
    const f = (v: number) => app(A, B, v);
    const g1 = brier(m1, actuel) - brier(m1, f);
    const g2 = brier(m2, actuel) - brier(m2, f);
    if (g1 > 0.0005 && g2 > 0.0005) candidats.push({ a: A, b: B, g1, g2 });
  }
candidats.sort((x, y) => Math.min(y.g1, y.g2) - Math.min(x.g1, x.g2));
console.log(`${candidats.length} couple(s) gagnent DANS LES DEUX SENS sans casser l'ordre.`);
for (const c of candidats.slice(0, 6))
  console.log(`  { a: ${c.a}, b: ${c.b} } → 1re +${c.g1.toFixed(4)} · 2e +${c.g2.toFixed(4)}`);
if (!candidats.length) console.log('→ aucun : « plus de 3,5 buts » garde ses coefficients d’origine.');
