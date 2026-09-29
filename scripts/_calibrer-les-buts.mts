/**
 * LES MARCHÉS DE BUTS, TELS QUE L'ABONNÉ LES LIT — ET CE QU'ILS VALENT.
 *
 * Le banc rend les pourcentages BRUTS ; la production les calibre avant de les
 * afficher (`calibration-buts.ts`). On mesure donc les deux, puis on cherche de
 * meilleurs coefficients SUR LA PREMIÈRE MOITIÉ, et on les juge sur la
 * seconde — celle que l'ajustement n'a jamais vue.
 */
import fs from 'node:fs';
import { calibrerMarcheDeButs, COEFFICIENTS } from '../src/lib/calibration-buts.js';

const r = JSON.parse(fs.readFileSync('.challenger/travail/resultat-buts.json', 'utf8'));
const tout = (r.variantes['champion'] as any[])
  .filter((x) => x.scoreReel && x.annexes)
  .sort((a, b) => String(a.date).localeCompare(String(b.date)));
const moitie = Math.floor(tout.length / 2);
const [m1, m2] = [tout.slice(0, moitie), tout.slice(moitie)];

const MARCHES: [string, string, string, (s: [number, number]) => boolean][] = [
  ['plus de 1,5 but', 'plusDeUnCinq', 'plus15', (s) => s[0] + s[1] > 1.5],
  ['plus de 2,5 buts', 'plusDeDeuxCinq', 'plus25', (s) => s[0] + s[1] > 2.5],
  ['plus de 3,5 buts', 'plusDeTroisCinq', 'plus35', (s) => s[0] + s[1] > 3.5],
  ['les deux marquent', 'deuxMarquent', 'lesDeuxMarquent', (s) => s[0] > 0 && s[1] > 0],
];
const borner = (p: number) => Math.min(0.999, Math.max(0.001, p));
const applique = (a: number, b: number, v: number) => 1 / (1 + Math.exp(-(a + b * Math.log(borner(v / 100) / (1 - borner(v / 100))))));
const brier = (l: any[], cle: string, arrive: any, f: (v: number) => number) =>
  l.reduce((s, x) => s + (f(Number(x.annexes[cle])) - (arrive(x.scoreReel) ? 1 : 0)) ** 2, 0) / l.length;

for (const [nom, cle, coefCle, arrive] of MARCHES) {
  const l1 = m1.filter((x) => Number.isFinite(Number(x.annexes[cle])));
  const l2 = m2.filter((x) => Number.isFinite(Number(x.annexes[cle])));
  if (l2.length < 200) continue;
  const c = (COEFFICIENTS as any)[coefCle];
  const brut = (v: number) => borner(v / 100);
  const actuel = (v: number) => calibrerMarcheDeButs(coefCle as any, v) / 100;

  // Recherche des meilleurs coefficients SUR LA PREMIÈRE MOITIÉ seulement.
  let meilleur = { a: c.a, b: c.b, brier: Infinity };
  for (let a = -1.2; a <= 1.2001; a += 0.05)
    for (let b = 0.2; b <= 1.3001; b += 0.05) {
      const s = brier(l1, cle, arrive, (v) => applique(a, b, v));
      if (s < meilleur.brier) meilleur = { a: Math.round(a * 100) / 100, b: Math.round(b * 100) / 100, brier: s };
    }

  const b2Brut = brier(l2, cle, arrive, brut);
  const b2Actuel = brier(l2, cle, arrive, actuel);
  const b2Neuf = brier(l2, cle, arrive, (v) => applique(meilleur.a, meilleur.b, v));
  const gain = b2Actuel - b2Neuf;
  console.log(
    `${nom.padEnd(18)} 2e moitié (${l2.length}) — brut ${b2Brut.toFixed(4)} · en ligne ${b2Actuel.toFixed(4)} · proposé ${b2Neuf.toFixed(4)}` +
      `   { a: ${meilleur.a}, b: ${meilleur.b} } contre { a: ${c.a}, b: ${c.b} }   ${gain > 0.0005 ? '✅ gagne' : gain < -0.0005 ? '✗ perd' : '— égal'}`
  );
}

// ── L'ÉPREUVE DANS LES DEUX SENS ──────────────────────────────────────────
//
// Ajuster sur une moitié et juger sur l'autre ne prouve rien si l'on ne fait
// le trajet qu'une fois : la seconde moitié peut simplement ressembler à la
// première. On refait donc le chemin en sens inverse. Un coefficient n'est
// retenu que s'il gagne DANS LES DEUX SENS — et il doit alors battre à la fois
// le brut et ce qui est en ligne.
console.log('\n── LES DEUX SENS ──');
for (const [nom, cle, coefCle, arrive] of MARCHES) {
  const l1 = m1.filter((x) => Number.isFinite(Number(x.annexes[cle])));
  const l2 = m2.filter((x) => Number.isFinite(Number(x.annexes[cle])));
  if (l2.length < 200) continue;
  const c = (COEFFICIENTS as any)[coefCle];
  const actuel = (v: number) => calibrerMarcheDeButs(coefCle as any, v) / 100;
  const ajuster = (l: any[]) => {
    let best = { a: 0, b: 1, brier: Infinity };
    for (let a = -1.2; a <= 1.2001; a += 0.05)
      for (let b = 0.2; b <= 1.3001; b += 0.05) {
        const s = brier(l, cle, arrive, (v) => applique(a, b, v));
        if (s < best.brier) best = { a: Math.round(a * 100) / 100, b: Math.round(b * 100) / 100, brier: s };
      }
    return best;
  };
  const sur1 = ajuster(l1);
  const sur2 = ajuster(l2);
  const g1 = brier(l2, cle, arrive, actuel) - brier(l2, cle, arrive, (v) => applique(sur1.a, sur1.b, v));
  const g2 = brier(l1, cle, arrive, actuel) - brier(l1, cle, arrive, (v) => applique(sur2.a, sur2.b, v));
  // Le compromis : la moyenne des deux ajustements, jugée sur l'ensemble.
  const a = Math.round(((sur1.a + sur2.a) / 2) * 100) / 100;
  const b = Math.round(((sur1.b + sur2.b) / 2) * 100) / 100;
  const tousDeux = [...l1, ...l2];
  const gTotal = brier(tousDeux, cle, arrive, actuel) - brier(tousDeux, cle, arrive, (v) => applique(a, b, v));
  const ok = g1 > 0.0005 && g2 > 0.0005;
  console.log(
    `${nom.padEnd(18)} ajusté sur 1re → gain 2e ${g1 >= 0 ? '+' : ''}${g1.toFixed(4)} · ajusté sur 2e → gain 1re ${g2 >= 0 ? '+' : ''}${g2.toFixed(4)}` +
      `   compromis { a: ${a}, b: ${b} } gain ${gTotal >= 0 ? '+' : ''}${gTotal.toFixed(4)}   ${ok ? '✅ RETENU' : '— refusé'}   (en ligne { a: ${c.a}, b: ${c.b} })`
  );
}
