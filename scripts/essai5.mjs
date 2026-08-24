/**
 * PHASE 2 (fin) — LEVIER E, ET LE CLASSEMENT FINAL.
 */
import { afficher } from './banc.mjs';
import { poissonParLigue, elo } from './modeles.mjs';
import { ensemble, meilleurPoisson } from './modeles3.mjs';
import { avecCalibration } from './modeles4.mjs';

process.env.BANC_SILENCIEUX = '1';
const { derouler } = await import('./essai.mjs');

const CANDIDATS = [
  { nom: 'Poisson simple (reference)', f: () => poissonParLigue() },
  { nom: 'A+C', f: () => meilleurPoisson() },
  { nom: 'H. Ensemble 30 % Elo', f: () => ensemble({ poidsElo: 0.3, nom: 'H. Ensemble 30 % Elo' }) },
  { nom: 'E. A+C calibre', f: () => avecCalibration(meilleurPoisson(), { nom: 'E. A+C calibre' }) },
  {
    nom: 'E+H. Ensemble calibre',
    f: () => avecCalibration(ensemble({ poidsElo: 0.3 }), { nom: 'E+H. Ensemble calibre' }),
  },
  { nom: 'Elo seul', f: () => elo() },
];

const r = derouler(CANDIDATS.map((c) => c.f));

console.log(`\n  ${r.entraines} matchs d'entrainement, ${r.testes} matchs de test.`);
afficher(r.bilans, 'CLASSEMENT FINAL');

const base = r.bilans[0];
const baseA = r.moities.A[0];
const baseB = r.moities.B[0];

console.log('\n  ══ GAIN CONTRE LE POISSON SIMPLE ══\n');
console.log('  candidat                    vainqueur     score       Brier    log-loss   deux moities');
console.log('  ' + '─'.repeat(92));
const s = (v, d = 1) => (v > 0 ? '+' : '') + Math.round(v * 10 ** d) / 10 ** d;
r.bilans.forEach((b, i) => {
  if (i === 0) return;
  const dA = r.moities.A[i].vainqueur - baseA.vainqueur;
  const dB = r.moities.B[i].vainqueur - baseB.vainqueur;
  const verdict = dA > 0 && dB > 0 ? 'TIENT' : dA < 0 && dB < 0 ? 'pire' : 'incertain';
  console.log(
    `  ${CANDIDATS[i].nom.padEnd(26)} ${s(b.vainqueur - base.vainqueur).padStart(7)} pt` +
    ` ${s(b.scoreExact - base.scoreExact).padStart(8)} pt` +
    ` ${s(b.brier - base.brier, 4).padStart(11)} ${s(b.logloss - base.logloss, 4).padStart(11)}   ${verdict}`
  );
});

console.log('\n  ══ CALIBRATION AVANT ET APRES LE LEVIER E ══\n');
for (const i of [2, 4]) {
  console.log(`  ${CANDIDATS[i].nom}`);
  for (const x of r.juges[i].calibration().filter((c) => c.n >= 40)) {
    const e = x.promis - x.tenu;
    console.log(`    ${String(x.de).padStart(3)}-${String(x.a).padStart(3)} %  ${String(x.n).padStart(5)} matchs   promis ${String(x.promis).padStart(3)} %  tenu ${String(x.tenu).padStart(3)} %   ${e > 0 ? '+' : ''}${e} pt`);
  }
  console.log('');
}
