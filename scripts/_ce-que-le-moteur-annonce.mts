/**
 * CE QUE LE MOTEUR ANNONCE CONTRE CE QUI ARRIVE.
 *
 * Un taux de justesse global cache QUELLE issue il rate. Un moteur qui
 * n'annonce jamais le nul perd mécaniquement un quart des rencontres, et
 * aucune couche de force ne le corrigera.
 */
import fs from 'node:fs';
import { type Pronostic } from './challenger/porte.js';
const r = JSON.parse(fs.readFileSync(process.argv[2] ?? '.challenger/travail/resultat-champion.json', 'utf8'));
const p = r.variantes['champion'] as Pronostic[];
const NOM = ['domicile', 'nul', 'extérieur'];

console.log(`${p.length} rencontres\n`);
console.log('CE QUI ARRIVE VRAIMENT');
for (let i = 0; i < 3; i++) {
  const n = p.filter((x) => x.reel === i).length;
  console.log(`  ${NOM[i].padEnd(10)} ${String(n).padStart(5)}  ${((100 * n) / p.length).toFixed(1)} %`);
}
console.log('\nCE QUE LE MOTEUR ANNONCE (le score qu’il affiche)');
for (let i = 0; i < 3; i++) {
  const l = p.filter((x) => x.parScore === i);
  const justes = l.filter((x) => x.reel === i).length;
  console.log(
    `  ${NOM[i].padEnd(10)} ${String(l.length).padStart(5)}  ${((100 * l.length) / p.length).toFixed(1)} %` +
      (l.length ? `  · juste ${((100 * justes) / l.length).toFixed(1)} %` : '')
  );
}
console.log('\nCE QU’IL ANNONCE QUAND L’ISSUE EST…');
for (let i = 0; i < 3; i++) {
  const l = p.filter((x) => x.reel === i);
  const r2 = [0, 1, 2].map((j) => l.filter((x) => x.parScore === j).length);
  console.log(`  ${NOM[i].padEnd(10)} (${l.length}) → domicile ${r2[0]}, nul ${r2[1]}, extérieur ${r2[2]}  · rattrapé ${((100 * r2[i]) / l.length).toFixed(1)} %`);
}
const exacts = p.filter((x) => x.score && x.scoreReel && x.score[0] === x.scoreReel[0] && x.score[1] === x.scoreReel[1]).length;
console.log(`\nSCORE EXACT : ${exacts} sur ${p.length} — ${((100 * exacts) / p.length).toFixed(1)} %`);

// ── CE QUE LES PROBABILITÉS SAVAIENT DÉJÀ ─────────────────────────────────
//
// Le score affiché et les probabilités affichées sont deux sorties du même
// calcul. Si l'issue la plus probable tombe plus souvent juste que le score
// annoncé, le moteur sait quelque chose qu'il ne dit pas.
const argmax = (x: Pronostic) => x.probas.indexOf(Math.max(...x.probas));
const justesScore = p.filter((x) => x.parScore === x.reel).length;
const justesProba = p.filter((x) => argmax(x) === x.reel).length;
console.log(`\nL'ISSUE ANNONCÉE PAR LE SCORE  : ${justesScore} justes — ${((100 * justesScore) / p.length).toFixed(1)} %`);
console.log(`L'ISSUE LA PLUS PROBABLE       : ${justesProba} justes — ${((100 * justesProba) / p.length).toFixed(1)} %`);
const nulsProba = p.filter((x) => argmax(x) === 1).length;
console.log(`   (elle annonce le nul ${nulsProba} fois, contre ${p.filter((x) => x.parScore === 1).length} pour le score)`);
const desaccord = p.filter((x) => argmax(x) !== x.parScore);
if (desaccord.length) {
  const gScore = desaccord.filter((x) => x.parScore === x.reel).length;
  const gProba = desaccord.filter((x) => argmax(x) === x.reel).length;
  console.log(`\nLES DEUX SE CONTREDISENT SUR ${desaccord.length} RENCONTRES : le score a raison ${gScore} fois, la probabilité ${gProba} fois.`);
}
