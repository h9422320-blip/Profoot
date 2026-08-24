/**
 * PHASE 2 (fin) — LEVIERS G ET H.
 */
import { afficher } from './banc.mjs';
import { poissonParLigue, elo } from './modeles.mjs';
import { poissonAvance } from './modeles2.mjs';
import { avecRepos, ensemble, meilleurPoisson } from './modeles3.mjs';

process.env.BANC_SILENCIEUX = '1';
const { derouler } = await import('./essai.mjs');

const CANDIDATS = [
  { nom: 'reference (Poisson simple)', f: () => poissonParLigue() },
  { nom: 'A+C (meilleur Poisson)', f: () => meilleurPoisson() },
  { nom: 'G. A+C + repos', f: () => avecRepos(meilleurPoisson(), { nom: 'G. A+C + repos' }) },
  { nom: 'G. A+C + repos fort', f: () => avecRepos(meilleurPoisson(), { nom: 'G. A+C + repos fort', effet: 0.08 }) },
  { nom: 'Elo seul', f: () => elo() },
  { nom: 'H. Ensemble 50/50', f: () => ensemble({ poidsElo: 0.5 }) },
  { nom: 'H. Ensemble 30 % Elo', f: () => ensemble({ poidsElo: 0.3, nom: 'H. Ensemble 30 % Elo' }) },
  { nom: 'H. Ensemble 70 % Elo', f: () => ensemble({ poidsElo: 0.7, nom: 'H. Ensemble 70 % Elo' }) },
];

const r = derouler(CANDIDATS.map((c) => c.f));

console.log(`\n  ${r.entraines} matchs d'entrainement, ${r.testes} matchs de test.`);
afficher(r.bilans, 'LEVIERS G ET H');

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
console.log('');

// La calibration du meilleur candidat : c'est elle qui décide si la confiance
// affichée peut être crue.
const meilleur = r.bilans.reduce((a, b, i) => (b.logloss < r.bilans[a].logloss ? i : a), 0);
console.log(`  ══ CALIBRATION DU MEILLEUR — ${CANDIDATS[meilleur].nom} ══\n`);
for (const x of r.juges[meilleur].calibration().filter((c) => c.n >= 40)) {
  const ecart = x.promis - x.tenu;
  console.log(`    ${String(x.de).padStart(3)}-${String(x.a).padStart(3)} %  ${String(x.n).padStart(5)} matchs   promis ${String(x.promis).padStart(3)} %  tenu ${String(x.tenu).padStart(3)} %   ${ecart > 0 ? '+' : ''}${ecart} pt`);
}
console.log('');
