/**
 * PHASE 2 — CHAQUE LEVIER MESURÉ SEUL.
 *
 * Ajouté un par un au Poisson de référence, jamais en bloc : un gain groupé
 * ne dit pas lequel des trois l'a produit, ni si l'un des trois nuit.
 */
import { afficher } from './banc.mjs';
import { referenceDomicile, poissonParLigue, elo } from './modeles.mjs';
import { poissonAvance } from './modeles2.mjs';

process.env.BANC_SILENCIEUX = '1';
const { derouler } = await import('./essai.mjs');

const r = derouler([
  () => referenceDomicile(),
  () => poissonParLigue(),
  () => poissonAvance({ nom: 'A. + normalisation ligues', normaliserLigues: true }),
  () => poissonAvance({ nom: 'C. + ponderation temporelle', ponderationTemporelle: true }),
  () => poissonAvance({ nom: 'D. + domicile/exterieur', domicileExterieurSepares: true }),
  () => elo(),
]);

console.log(`\n  ${r.entraines} matchs d'entrainement, ${r.testes} matchs de test.`);
afficher(r.bilans, 'CHAQUE LEVIER AJOUTE SEUL AU POISSON DE REFERENCE');

const base = r.bilans[1];
const baseA = r.moities.A[1];
const baseB = r.moities.B[1];

console.log('\n  ══ GAIN CONTRE LE POISSON DE REFERENCE ══\n');
console.log('  levier                          vainqueur      score       Brier    log-loss   deux moities');
console.log('  ' + '─'.repeat(94));

const s = (v, d = 1) => (v > 0 ? '+' : '') + Math.round(v * 10 ** d) / 10 ** d;

r.bilans.forEach((b, i) => {
  if (i < 2) return;
  const dA = r.moities.A[i].vainqueur - baseA.vainqueur;
  const dB = r.moities.B[i].vainqueur - baseB.vainqueur;
  const verdict = dA > 0 && dB > 0 ? 'TIENT' : dA < 0 && dB < 0 ? 'pire' : 'incertain';
  console.log(
    `  ${b.nom.padEnd(30)} ${s(b.vainqueur - base.vainqueur).padStart(8)} pt` +
    ` ${s(b.scoreExact - base.scoreExact).padStart(9)} pt` +
    ` ${s(b.brier - base.brier, 4).padStart(11)} ${s(b.logloss - base.logloss, 4).padStart(11)}   ${verdict}`
  );
});

console.log('\n  (Brier et log-loss : plus BAS est meilleur — un signe negatif est donc un gain.)\n');

// Ce que la normalisation a appris des championnats : la hiérarchie doit
// ressembler à ce qu'un amateur de football sait déjà, sinon elle est fausse.
const normalise = r.modeles[2];
if (normalise?.coefLigue?.size) {
  const noms = new Map([
    [39, 'Angleterre'], [140, 'Espagne'], [135, 'Italie'], [78, 'Allemagne'], [61, 'France'],
    [94, 'Portugal'], [88, 'Pays-Bas'], [144, 'Belgique'], [203, 'Turquie'], [179, 'Ecosse'],
    [218, 'Autriche'], [197, 'Grece'], [106, 'Pologne'], [119, 'Danemark'], [103, 'Norvege'],
    [113, 'Suede'], [345, 'Tchequie'], [283, 'Roumanie'], [389, 'Kazakhstan'], [172, 'Bulgarie'],
    [235, 'Russie'], [210, 'Croatie'], [271, 'Hongrie'], [164, 'Islande'], [244, 'Finlande'],
  ]);
  const tri = [...normalise.coefLigue].sort((a, b) => b[1] - a[1]);
  console.log('  ══ HIERARCHIE APPRISE DES CHAMPIONNATS (levier A) ══\n');
  console.log('  Les plus forts :');
  for (const [id, c] of tri.slice(0, 8)) {
    console.log(`    ${(noms.get(id) ?? `ligue ${id}`).padEnd(14)} ${(Math.round(c * 1000) / 1000).toFixed(3)}`);
  }
  console.log('  Les plus faibles :');
  for (const [id, c] of tri.slice(-6)) {
    console.log(`    ${(noms.get(id) ?? `ligue ${id}`).padEnd(14)} ${(Math.round(c * 1000) / 1000).toFixed(3)}`);
  }
  console.log('');
}
