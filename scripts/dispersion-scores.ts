/**
 * QUELLE VARIÉTÉ DE SCORES LE MOTEUR PRODUIT-IL VRAIMENT ?
 *
 * Sur 206 predictions figees en base, 99 annoncent 2-1 : 48 %. Un abonne qui
 * lance trois analyses voit trois fois le meme score et en conclut, a juste
 * titre, que la machine ne calcule rien.
 *
 * Ce script balaie des forces d equipes realistes et compte les scores rendus.
 * Il dit si 48 % est un accident de donnees ou une propriete du calcul.
 */
import { calculerScoreProbable } from '../src/lib/score-probable';

const st = (marques: number, encaisses: number, matchs = 30): any => ({
  butsMarques: Math.round(marques * matchs),
  butsEncaisses: Math.round(encaisses * matchs),
  matchsJoues: matchs,
});

// Moyennes de buts realistes en championnat europeen : de l equipe de bas de
// tableau a la machine offensive.
const PROFILS = [0.7, 0.9, 1.1, 1.3, 1.5, 1.7, 2.0, 2.3];

const compte = new Map<string, number>();
let total = 0;

for (const m1 of PROFILS) {
  for (const e1 of PROFILS) {
    for (const m2 of PROFILS) {
      for (const e2 of PROFILS) {
        const r = calculerScoreProbable(st(m1, e1), st(m2, e2), true, false);
        const cle = `${r.buts1}-${r.buts2}`;
        compte.set(cle, (compte.get(cle) ?? 0) + 1);
        total++;
      }
    }
  }
}

const classe = [...compte.entries()].sort((a, b) => b[1] - a[1]);

console.log(`\n  ${total} combinaisons d equipes testees\n`);
console.log('  score    occurrences    part');
console.log('  ---------------------------------');
for (const [score, n] of classe.slice(0, 15)) {
  const part = (100 * n) / total;
  const barre = '#'.repeat(Math.round(part / 2));
  console.log(`  ${score.padEnd(8)} ${String(n).padStart(6)}      ${part.toFixed(1).padStart(5)} %  ${barre}`);
}
console.log(`\n  Scores distincts produits : ${classe.length}`);
console.log(`  Part du score dominant    : ${((100 * classe[0][1]) / total).toFixed(1)} %  (${classe[0][0]})\n`);
