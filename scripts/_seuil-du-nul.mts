/**
 * EXISTE-T-IL UN SEUIL OÙ ANNONCER LE NUL RAPPORTE ?
 *
 * Le nul arrive dans 24,3 % des rencontres et le moteur n'en annonce que 0,9 %.
 * Ce n'est pas forcément une faute : le nul est rarement l'issue la plus
 * probable, et l'annoncer coûte les victoires qu'on aurait eues. La question se
 * tranche par la mesure, seuil par seuil — sur les deux moitiés, comme toute
 * couche.
 */
import fs from 'node:fs';
import { moities, type Pronostic } from './challenger/porte.js';
const r = JSON.parse(fs.readFileSync('.challenger/travail/resultat-champion.json', 'utf8'));
const p = r.variantes['champion'] as Pronostic[];
const [m1, m2] = moities(p);
const justes = (l: Pronostic[], regle: (x: Pronostic) => number) => l.filter((x) => regle(x) === x.reel).length;
const actuel = (x: Pronostic) => x.parScore;

console.log(`champion : ${justes(m1, actuel)}/${m1.length} et ${justes(m2, actuel)}/${m2.length} justes\n`);
console.log('« annoncer le nul quand sa probabilité dépasse le seuil »');
for (const seuil of [0.24, 0.26, 0.28, 0.3, 0.32, 0.34, 0.36]) {
  const regle = (x: Pronostic) => (x.probas[1] >= seuil ? 1 : x.parScore);
  const n = p.filter((x) => x.probas[1] >= seuil).length;
  const d1 = justes(m1, regle) - justes(m1, actuel);
  const d2 = justes(m2, regle) - justes(m2, actuel);
  console.log(`  seuil ${(100 * seuil).toFixed(0)} % → ${String(n).padStart(4)} nuls annoncés · 1re ${d1 >= 0 ? '+' : ''}${d1} · 2e ${d2 >= 0 ? '+' : ''}${d2}${d1 > 0 && d2 > 0 ? '   ✅' : ''}`);
}

console.log('\n« … et seulement si les deux camps sont proches »');
for (const seuil of [0.26, 0.28, 0.3]) {
  for (const ecartMax of [0.03, 0.05, 0.08, 0.12]) {
    const proche = (x: Pronostic) => Math.abs(x.probas[0] - x.probas[2]) <= ecartMax;
    const regle = (x: Pronostic) => (x.probas[1] >= seuil && proche(x) ? 1 : x.parScore);
    const n = p.filter((x) => x.probas[1] >= seuil && proche(x)).length;
    if (n < 30) continue;
    const d1 = justes(m1, regle) - justes(m1, actuel);
    const d2 = justes(m2, regle) - justes(m2, actuel);
    console.log(`  nul ≥ ${(100 * seuil).toFixed(0)} % et écart ≤ ${(100 * ecartMax).toFixed(0)} pts → ${String(n).padStart(4)} annoncés · 1re ${d1 >= 0 ? '+' : ''}${d1} · 2e ${d2 >= 0 ? '+' : ''}${d2}${d1 > 0 && d2 > 0 ? '   ✅' : ''}`);
  }
}

// ── ET L'ASYMÉTRIE DOMICILE / EXTÉRIEUR ──────────────────────────────────
//
// Le moteur annonce « domicile » 64 % du temps et tombe juste 54,8 % ;
// « extérieur » 35 % du temps et tombe juste 49,6 %. Ses pronostics au dehors
// valent-ils moins parce qu'il y croit trop ?
console.log('\nLES PRONOSTICS À L’EXTÉRIEUR, PAR CONFIANCE');
for (const [nom, bas, haut] of [['< 45 %', 0, 0.45], ['45-50 %', 0.45, 0.5], ['50-60 %', 0.5, 0.6], ['60 % et +', 0.6, 1.01]] as [string, number, number][]) {
  for (const cote of [0, 2] as const) {
    const l = p.filter((x) => x.parScore === cote && x.probas[cote] >= bas && x.probas[cote] < haut);
    if (l.length < 30) continue;
    const j = l.filter((x) => x.reel === cote).length;
    console.log(`  ${(cote === 0 ? 'domicile' : 'extérieur').padEnd(10)} ${nom.padEnd(10)} ${String(l.length).padStart(4)} · ${((100 * j) / l.length).toFixed(1)} % justes`);
  }
}
console.log('\n« basculer vers le domicile les pronostics extérieurs les moins sûrs »');
for (const seuil of [0.4, 0.42, 0.45, 0.48]) {
  const regle = (x: Pronostic) => (x.parScore === 2 && x.probas[2] < seuil ? 0 : x.parScore);
  const n = p.filter((x) => x.parScore === 2 && x.probas[2] < seuil).length;
  if (n < 30) continue;
  const d1 = justes(m1, regle) - justes(m1, actuel);
  const d2 = justes(m2, regle) - justes(m2, actuel);
  console.log(`  sous ${(100 * seuil).toFixed(0)} % → ${String(n).padStart(4)} bascules · 1re ${d1 >= 0 ? '+' : ''}${d1} · 2e ${d2 >= 0 ? '+' : ''}${d2}${d1 > 0 && d2 > 0 ? '   ✅' : ''}`);
}
