/**
 * CE QUE LE MOTEUR ANNONCE SUR LES BUTS, ET CE QUI ARRIVE.
 *
 * Le banc ne juge que le vainqueur. Or l'abonné lit aussi « plus de 2,5 buts :
 * 64 % » et « les deux marquent : 58 % ». Ces chiffres n'ont jamais été
 * confrontés à la réalité sur une grande fenêtre.
 *
 * Un pourcentage annoncé se juge par tranche : sur toutes les rencontres où le
 * moteur a dit « 60 à 70 % », combien de fois est-ce arrivé ? Un écart
 * systématique est une promesse non tenue, et elle se corrige.
 */
import fs from 'node:fs';
import { type Pronostic } from './challenger/porte.js';
const r = JSON.parse(fs.readFileSync('.challenger/travail/resultat-buts.json', 'utf8'));
const p = (r.variantes['champion'] as any[]).filter((x) => x.scoreReel && x.annexes);

const MARCHES: [string, string, (s: [number, number]) => boolean][] = [
  ['plus de 1,5 but', 'plusDeUnCinq', (s) => s[0] + s[1] > 1.5],
  ['plus de 2,5 buts', 'plusDeDeuxCinq', (s) => s[0] + s[1] > 2.5],
  ['plus de 3,5 buts', 'plusDeTroisCinq', (s) => s[0] + s[1] > 3.5],
  ['les deux marquent', 'deuxMarquent', (s) => s[0] > 0 && s[1] > 0],
];
console.log(`${p.length} rencontres avec leur score réel\n`);
for (const [nom, cle, arrive] of MARCHES) {
  const avec = p.filter((x) => Number.isFinite(Number(x.annexes?.[cle])));
  if (avec.length < 100) { console.log(`${nom} : ${avec.length} rencontres, trop peu`); continue; }
  const reel = (100 * avec.filter((x) => arrive(x.scoreReel)).length) / avec.length;
  const annonceMoyen = avec.reduce((s, x) => s + Number(x.annexes[cle]), 0) / avec.length;
  console.log(`${nom.padEnd(20)} annoncé en moyenne ${annonceMoyen.toFixed(1)} % · arrivé ${reel.toFixed(1)} %  (écart ${(annonceMoyen - reel >= 0 ? '+' : '') + (annonceMoyen - reel).toFixed(1)} pts)`);
  for (const [bas, haut] of [[0, 40], [40, 50], [50, 60], [60, 70], [70, 80], [80, 101]] as [number, number][]) {
    const l = avec.filter((x) => { const v = Number(x.annexes[cle]); return v >= bas && v < haut; });
    if (l.length < 40) continue;
    const t = (100 * l.filter((x) => arrive(x.scoreReel)).length) / l.length;
    const moyen = l.reduce((s, x) => s + Number(x.annexes[cle]), 0) / l.length;
    const d = moyen - t;
    console.log(`     annoncé ${String(bas).padStart(3)}-${String(haut === 101 ? 100 : haut).padStart(3)} % (${String(l.length).padStart(4)}) → arrivé ${t.toFixed(1).padStart(5)} %  ${Math.abs(d) >= 5 ? (d > 0 ? '⚠️ promet trop' : '⚠️ promet trop peu') : ''}`);
  }
  console.log('');
}
