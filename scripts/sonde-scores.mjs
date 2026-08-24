/**
 * On donne au moteur des équipes de plus en plus déséquilibrées et on regarde
 * ce qu'il annonce. Les statistiques sont des TOTAUX DE SAISON, pas des
 * moyennes : passer 2,6 au lieu de 78 écrase tous les xG sur le plancher.
 */
import path from 'node:path';
import { createJiti } from 'jiti';
const jiti = createJiti(process.cwd(), { alias: { '@': path.resolve(process.cwd(), 'src') } });
const { calculerScoreProbable } = await jiti.import('./src/lib/score-probable.ts');

const J = 30; // matchs joués
const eq = (parMatchMarques, parMatchEncaisses) => ({
  butsMarques: Math.round(parMatchMarques * J),
  butsEncaisses: Math.round(parMatchEncaisses * J),
  matchsJoues: J,
});

console.log('\n  ══ DU MATCH ÉQUILIBRÉ À L\'ÉCRASEMENT ══\n');
console.log('   marq/enc  1     marq/enc  2  │  xG 1   xG 2  │ score │ V1   N   V2 │ conf');
console.log('  ' + '─'.repeat(74));

const cas = [
  [1.3, 1.3, 1.3, 1.3, 'parfaitement egales'],
  [1.6, 1.1, 1.2, 1.4, 'leger favori'],
  [2.0, 0.9, 1.0, 1.6, 'favori net'],
  [2.4, 0.7, 0.9, 1.9, 'gros favori'],
  [2.8, 0.5, 0.7, 2.3, 'ecrasant'],
  [3.4, 0.4, 0.5, 2.8, 'ogre contre nain'],
  [0.9, 1.9, 2.4, 0.7, 'gros favori a l exterieur'],
  [2.2, 1.8, 2.1, 1.9, 'deux attaques folles'],
  [0.7, 0.6, 0.8, 0.7, 'deux defenses de fer'],
];

for (const [m1, e1, m2, e2, nom] of cas) {
  const r = calculerScoreProbable(eq(m1, e1), eq(m2, e2), true);
  console.log(
    `  ${String(m1).padStart(5)} /${String(e1).padStart(5)}  ${String(m2).padStart(5)} /${String(e2).padStart(5)} │` +
    ` ${String(r.butsAttendus1).padStart(5)}  ${String(r.butsAttendus2).padStart(5)} │` +
    ` ${(r.buts1 + '-' + r.buts2).padStart(5)} │` +
    ` ${String(r.probaVictoire1).padStart(2)}  ${String(r.probaNul).padStart(2)}  ${String(r.probaVictoire2).padStart(2)} │` +
    ` ${String(r.confiance).padStart(3)}  ${nom}`
  );
}
console.log('');
